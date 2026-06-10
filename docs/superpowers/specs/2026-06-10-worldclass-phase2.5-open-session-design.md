# WorldClass Phase 2.5 設計書：オープンセッション

**作成日:** 2026-06-10
**ステータス:** 設計確定

> **全体設計** → [`2026-05-23-worldclass-design.md`](2026-05-23-worldclass-design.md)
> **DB設計** → [`2026-05-29-worldclass-db-design.md`](2026-05-29-worldclass-db-design.md)
> **Phase 2（カタログ・予約・Stripe）** → [`2026-05-24-worldclass-phase2-design.md`](2026-05-24-worldclass-phase2-design.md)
> **準備フロー（Phase 3）** → [`2026-06-10-worldclass-phase3-preparation-flow-design.md`](2026-06-10-worldclass-phase3-preparation-flow-design.md)

---

## 1. スコープ

ご家庭向けの相乗り型セッション。運営がオープンセッション枠を作成し、利用者（member）がグループ単位で申込・決済する。最低3グループで成立、未達なら自動キャンセル・全額返金。

Phase 2（専用セッション予約・Stripe基盤）の上に構築する。Stripe Checkout・Webhook・返金Jobは Phase 2 の実装を流用する。

---

## 2. 前提（既存スキーマ）

DB設計時点でオープンセッションを想定済み。**新規テーブル・カラム追加は不要。**

| テーブル | 使用カラム |
|---|---|
| `sessions` | `session_type=open` / `capacity` / `min_groups` / `price_jpy` / `status` |
| `session_participants` | `status` / `stripe_payment_id` / `price_paid` / `support_amount` |
| `coupons` | `reason=auto_cancel`（不成立時の10%クーポン） |

---

## 3. 確定済みパラメータ

| 項目 | 値 | 備考 |
|---|---|---|
| 料金 | 45分: 2,500円 / 60分: 3,000円（1グループ） | 仮確定。後日変更の可能性あり（`price_jpy` はセッション作成時に運営が入力するため変更容易） |
| 最低成立グループ数 | 3（`min_groups`） | セッションごとに運営が上書き可 |
| 最大参加グループ数 | 6（`capacity`） | セッションごとに運営が上書き可 |
| ファシリテーター | 常時付き（料金込み） | `with_facilitator=true` 固定 |
| 申込締切 | 3日前12時（JST） | 成立判定と同時刻 |
| 直前参加 | 成立済み＋残枠ありの場合のみ12時間前まで可 | 質問送信は不可（§6参照） |

---

## 4. セッション作成（運営・Filament）

OpenSession用のFilamentリソース（`SessionResource` にオープン作成フォームを用意）。

入力項目: パートナー / 開催日時 / 45分 or 60分 / テーマ（ThemeType） / capacity（既定6） / min_groups（既定3） / 料金（既定 2,500 / 3,000円）

ステータス遷移:

```
draft（下書き）→ open（公開・募集中）→ confirmed（成立）→ ready → completed
                                  └→ cancelled（3日前12時 未達）
```

`confirmed` 以降の準備フロー（ready チェック・リマインド・完了判定）は Phase 3 設計に従う。

---

## 5. 申込・決済フロー（member）

```
1. 一覧 /open-sessions
   └─ 公開中（status=open or confirmed で残枠あり）のセッションを表示
   └─ 表示項目: 日時・国・パートナー名・テーマ・対象年齢・残枠・料金
   └─ 残枠 = capacity − confirmed参加数
   └─ 満枠 or 締切超過 → 申込ボタン無効

   ※超過販売防止: 申込時の残枠判定は pending（決済中）も含めてカウントする。
     決済失敗で pending が削除されれば枠は解放される


2. 申込
   └─ session_participants に status=pending で作成
   └─ price_paid・support_amount（50%）を記録

3. Stripe Checkout（即時決済・Phase 2と同方式）
   └─ 成功 → success_url（完了画面）
   └─ 失敗 → cancel_url（pending レコード削除）

4. Webhook（checkout.session.completed・Phase 2のWebhookControllerを拡張）
   └─ participant を confirmed に更新・stripe_payment_id 保存
   └─ 申込完了メール送信
   └─ confirmed数が min_groups に到達 → セッションを confirmed に更新
        └─ 全参加者へ成立確定メール
```

**決済方針:** 申込時即時決済。不成立時は全額返金（申込画面に明示する）。

---

## 6. 成立判定・直前参加

### 成立判定（3日前12時・Scheduler）

```
status=open のまま3日前12時を迎えたセッション
  └─ confirmed参加数 >= min_groups → confirmed に更新・成立確定メール
  └─ 未達 → cancelled に更新
       └─ ProcessCancellationJob（Phase 2実装を流用）
            └─ 全参加者へ Stripe 全額返金
            └─ 10%割引クーポン発行（coupons.reason=auto_cancel）
            └─ 不成立キャンセルメール送信
```

なお min_groups 到達時点（Webhook内）で即時 confirmed にするため、このSchedulerが成立側を処理するのは「3日前12時ちょうどに判定が必要な残り」のみ。実装上は冪等に書く（既にconfirmedならスキップ）。

### 直前参加（成立済みセッションへの相乗り）

- 対象: `status=confirmed`（または `ready`）かつ残枠あり、開始12時間前まで
- 申込・決済フローは §5 と同一（成立済みのため不成立返金リスクなし）
- **質問送信は不可**（質問締切は3日前12時・Phase 3参照）。申込画面に明示
- パートナーへ「参加グループが追加されました」通知メールを即時送信

---

## 7. キャンセル（MVP）

- **参加者都合のキャンセル機能は提供しない**。運営がFilamentから手動対応（participant を cancelled に変更 → 手動返金トリガーボタン → Stripe Refunds API）
- 天災・回線障害等の例外も同じ手動オペレーション
- セッション単位の手動キャンセル（運営）: 全参加者に返金＋通知（ProcessCancellationJob 流用）

---

## 8. コンポーネント構成

```
app/
├── UseCases/OpenSession/
│   ├── ListOpenSessionsUseCase.php        # 一覧（残枠計算込み）
│   ├── ApplyToOpenSessionUseCase.php      # 申込作成・Checkout起動・締切/残枠検証
│   └── JudgeOpenSessionFormationUseCase.php # 成立判定（Scheduler起動・冪等）
├── Http/Controllers/
│   └── OpenSessionController.php          # index / apply
├── Jobs/
│   └── JudgeOpenSessionFormationJob.php   # 毎時実行 → UseCase呼び出し
└── Filament/Resources/
    └── SessionResource.php                # オープンセッション作成・手動キャンセル操作
```

ドメイン例外: `SessionFullException` / `ApplicationDeadlinePassedException`

---

## 9. メール（Markdown Mailable・送信元 no-reply@）

| メール | 宛先 | トリガー |
|---|---|---|
| 申込完了 | 参加member | Webhook confirmed時 |
| 成立確定 | 全参加member | min_groups到達時 |
| 不成立キャンセル（返金・クーポン案内） | 全参加member | 3日前12時 未達時 |
| 参加グループ追加 | パートナー | 直前参加の確定時 |

---

## 10. テスト方針

- **Unit（UseCase・モック）:** 成立判定境界（2/3グループ）・満枠（6/7申込目）・締切超過申込・直前参加可否（confirmed×残枠×12時間前）・冪等性
- **Feature:** 申込→Checkout→Webhook→confirmed の一連 / 不成立→返金Job投入
- **Integration:** participantリポジトリの残枠集計
