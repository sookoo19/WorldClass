# WorldClass Phase 2 設計書：カタログ・予約・決済

**作成日:** 2026-05-24  
**更新日:** 2026-05-25（クリーンアーキテクチャ方針を反映）  
**ステータス:** 設計確定

> **技術方針・アーキテクチャ詳細** → [`2026-05-25-worldclass-engineering-principles.md`](2026-05-25-worldclass-engineering-principles.md)

---

## 1. スコープ

Phase 1（認証・DB基盤）の上に以下を追加する：

- **カタログ**：海外校一覧の閲覧・フィルタ
- **スロット管理**：海外校が週次パターン＋例外ブロックで空き枠を登録
- **予約フロー**：スロット選択 → テンプレ選択 → 確認 → Stripe決済
- **Stripe連携**：即時キャプチャ＋Webhookによる確定処理＋返金API

---

## 2. スロット管理

### データ構造

**`partner_schedules`（週次パターン）**

| カラム | 型 | 説明 |
|---|---|---|
| id | bigint | PK |
| partner_id | bigint FK | 海外校 |
| day_of_week | tinyint | 0=Mon … 6=Sun |
| start_time_jst | time | 例: "10:00" |
| duration_min | unsignedInt | 45 or 60 |
| max_sessions | unsignedInt | 同時受付上限（MVP: 1固定） |
| timestamps | | |

**`partner_schedule_blocks`（例外ブロック）**

| カラム | 型 | 説明 |
|---|---|---|
| id | bigint | PK |
| partner_id | bigint FK | 海外校 |
| blocked_date | date | ブロック対象日 |
| reason | string nullable | 理由（任意） |
| timestamps | | |

### スロット生成ロジック

カタログ閲覧時に「今日から6週先」の予約可能スロットを動的生成する。

```
週次パターンを展開（今日〜42日後）
  ↓
blocked_date に該当する日 → 除外
  ↓
sessions テーブルに同 partner_id × scheduled_at の confirmed 予約あり → 除外
  ↓
残ったものが「予約可能スロット」として表示
```

### 海外校ダッシュボード（スロット管理UI）

- **週次パターン**：曜日×時間帯のチェックボックス形式（複数設定可）
- **例外ブロック**：カレンダーで特定日をクリック → ブロック登録（理由任意）

---

## 3. カタログ

### フィルタ

| フィルタ | 選択肢 |
|---|---|
| 国 | 承認済み海外校の国一覧（動的生成） |
| 時間帯 | 平日午前 / 平日午後 / 土日 |

### カード表示（一覧）

```
┌─────────────────────────────────┐
│ 🇵🇭 Sunshine Elementary School  │
│ フィリピン・マニラ                │
│ ★ 4.8　　　今週 残3枠            │
│ [詳細を見る →]                  │
└─────────────────────────────────┘
```

表示項目：学校名・国・地域 / 評価スコア（★） / 空きスロット数（今週）

### 詳細ページ

- 学校紹介VTR（video_url を埋め込み）
- 対応テーマバッジ（文化紹介 / SDGs / 英語教育）
- 過去の物資支援実績（写真＋コメント）
- 予約可能スロット一覧（6週先まで）→ 予約フローへ

---

## 4. 予約フロー

```
1. スロット選択
   └─ カレンダーUI（6週先まで）
   └─ 選択後に「45分 / 60分」選択

2. テンプレ選択 + カスタマイズ
   └─ A) 文化紹介 / B) SDGs / C) 英語教育
   └─ 質問リスト追加（テキストエリア、任意）

3. 確認画面
   └─ 日時・海外校・テーマ・時間・料金内訳（運営手数料 / 物資支援）表示
   └─ 「予約・決済する」ボタン

4. Stripe決済（Checkout リダイレクト方式）
   └─ 成功 → success_url へリダイレクト
   └─ 失敗 → cancel_url へリダイレクト（仮登録を削除）

5. 完了画面
   └─ 予約番号・日時・次のステップ表示
   └─ 確認メール送信（Laravel Mail）
```

---

## 5. Stripe実装詳細

### 決済フロー

```
日本校が「予約・決済する」クリック
  ↓
sessions に status=pending で仮登録
  ↓
StripeService が Checkout Session を作成
  ↓
Stripe ホステッドページへリダイレクト
  ↓
┌─ 成功 → success_url へ戻る（完了画面表示）
└─ 失敗 → cancel_url へ戻る（pending レコード削除）

Webhook（checkout.session.completed）
  └─ sessions を confirmed に更新
  └─ stripe_payment_id を保存
  └─ 海外校に通知メール送信
```

> **Webhookで確定する理由：** success_url へのリダイレクトはブラウザを閉じると届かないため、Webhookで確実に処理する。

### DBステータス遷移

| タイミング | sessions.status |
|---|---|
| Checkout作成前（仮登録） | `pending` |
| Webhook: checkout.session.completed | `confirmed` |
| キャンセルポリシー発動 | `cancelled` |

### キャンセル・返金処理

```
キャンセル発生（準備未確認・1日前12時 or 最低人数未達）
  ↓
ProcessCancellation Job（Queue）
  ↓
Stripe Refunds API → 全額返金
sessions → cancelled
  ↓
日本校にメール通知 + 10%割引クーポン発行（coupons テーブル）
```

---

## 6. コンポーネント構成（クリーンアーキテクチャ準拠）

```
app/
├── Domain/
│   ├── Entities/
│   │   └── Session.php                      # セッションエンティティ
│   ├── ValueObjects/
│   │   ├── SessionStatus.php                # enum: pending/confirmed/cancelled
│   │   └── Money.php                        # 金額（円単位）
│   ├── Repositories/
│   │   ├── SessionRepositoryInterface.php
│   │   └── PartnerRepositoryInterface.php
│   └── Exceptions/
│       └── SlotUnavailableException.php
│
├── UseCases/
│   ├── Slot/
│   │   ├── GetAvailableSlotsInput.php
│   │   ├── GetAvailableSlotsOutput.php
│   │   └── GetAvailableSlotsUseCase.php     # スロット生成ロジック
│   ├── Booking/
│   │   ├── CreateBookingInput.php
│   │   ├── CreateBookingOutput.php
│   │   └── CreateBookingUseCase.php         # 予約作成・Stripe Checkout起動
│   └── Cancellation/
│       ├── ProcessCancellationInput.php
│       └── ProcessCancellationUseCase.php   # 返金・クーポン発行
│
├── Infrastructure/
│   ├── Repositories/
│   │   ├── EloquentSessionRepository.php
│   │   └── EloquentPartnerRepository.php
│   └── Services/
│       └── StripePaymentService.php         # Checkout Session作成・返金API
│
├── Http/Controllers/
│   ├── CatalogController.php                # GetAvailableSlotsUseCase を呼ぶ
│   ├── BookingController.php                # CreateBookingUseCase を呼ぶ
│   └── WebhookController.php               # Stripe Webhook受信・署名検証
│
└── Jobs/
    └── ProcessCancellationJob.php           # ProcessCancellationUseCase をQueue経由で実行
```

> **UseCase はフレームワーク非依存**。テストで Eloquent なしで動作検証できる。

---

## 7. 未決定事項（Phase 2実装前に要確認）

- 時間帯フィルタの定義（例：平日午前 = JST 9:00〜12:00、等）
- Stripe の `stripe_secret_key` / `webhook_signing_secret` の管理方法（.env）
- キャンセルポリシーの例外（天災・回線障害時の扱い）→ 運営が手動対応か自動か
- 確認メールのデザイン・送信元アドレス
