# WorldClass Phase 4 設計書：物資支援（リインバース方式）

**作成日:** 2026-06-10
**ステータス:** 設計確定

> **全体設計** → [`2026-05-23-worldclass-design.md`](2026-05-23-worldclass-design.md)
> **DB設計** → [`2026-05-29-worldclass-db-design.md`](2026-05-29-worldclass-db-design.md)（`support_requests` は2026-06-08にリインバース方式へ再設計済み）
> **準備フロー（Phase 3）** → [`2026-06-10-worldclass-phase3-preparation-flow-design.md`](2026-06-10-worldclass-phase3-preparation-flow-design.md)

---

## 1. スコープ・方式

**リインバース（立替精算）方式。** 海外パートナーが支援対象物資を現地で自己購入し、領収書を提出。運営が照合・承認した金額をWise経由で送金する。

当初設計（運営による現地調達・NGO経由手配）からの変更。変更により当初の「現金のやり取りなし」原則は緩和されるが、以下で着服・流用リスクを抑える:

1. **カタログ限定** — 支援対象品目マスタ（`support_item_catalogs`）にある教育用途品のみ承認
2. **領収書必須** — 申請には領収書写真の添付が必須
3. **事後承認制** — 運営が領収書・申請内容・カタログの3点照合後に送金（前払いなし）
4. **プール上限** — 申請額はパートナーごとの支援プール残高を超えられない

精算サイクルは**随時**（締め日なし）。

---

## 2. プール積算

- Phase 3 の完了判定（`CompleteFinishedSessionsJob` → status=completed）時に積算:
  `partners.support_pool += Σ（confirmed参加者の support_amount）`（= 支払額の50%）
- ファシリテーターオプション料金は積算対象外（スタッフコスト専用・全体設計どおり）
- キャンセル済みセッション・cancelled参加者は積算しない（返金との二重流出防止）
- 未使用残高は失効しない（繰越）

---

## 3. 申請フロー（パートナーダッシュボード）

```
1. 残高確認
   └─ ダッシュボードに support_pool 残高を常時表示

2. 申請フォーム（随時）
   └─ 品目リスト: [{品名, 数量, 単価}]（item_list・自由記述）
   └─ 円換算申請額（claimed_amount_jpy）— パートナーの自己換算（目安レートを画面表示）
   └─ 領収書写真アップロード（必須・receipt_photo_url）
   └─ 対象品目カタログを参照表示（厳密一致は強制しない。DB設計の方針どおり）

3. バリデーション
   └─ claimed_amount_jpy ≤ support_pool 残高
   └─ 領収書ファイル: 画像/PDF・サイズ上限あり
```

- 領収書は **private storage** 保存。閲覧は署名付きURL（Filament・パートナー本人のみ）
- 申請後は status=pending。審査完了まで編集不可（取り下げは運営へ連絡→手動reject）

---

## 4. 審査・送金（運営・Filament）

```
SupportRequestResource
  └─ pending一覧（申請日順）
  └─ 詳細: 領収書プレビュー・品目リスト・カタログ照合（目視）・パートナー国情報

承認（approve）
  └─ 承認額（approved_amount_jpy）を入力 — 部分承認可
  └─ 現地通貨→円の換算はこの時点で運営が最終確定（申請額は目安扱い）
  └─ support_pool から approved_amount_jpy を減算・status=approved
  └─ パートナーへ承認通知メール

却下（reject）
  └─ rejection_reason 必須・status=rejected・プール変動なし
  └─ パートナーへ却下通知メール（理由付き）

送金（手動・Wise）
  └─ 運営がWise画面から手動送金
  └─ Filamentで「送金済み」操作: paid_at＋送金参照ID（transfer_reference）を記録・status=paid
  └─ パートナーへ送金完了メール
```

Wise API連携はMVP外。取引量増加後に自動化を検討する。

**ステータス遷移:** `pending → approved → paid` / `pending → rejected`

---

## 5. 支援実績の可視化（利用者向け）

- パートナー詳細ページ（カタログ）に承認済み（approved / paid）実績を自動表示
  - 表示: 品目・時期・活用写真（あれば）
  - 非表示: 金額・領収書
- 活用写真: パートナーが任意で後日アップロードし実績に添付（`usage_photo_url`）
- 利用者へのメール配信レポート（四半期レポート等）はMVP外。当面は運営が手動で実施

---

## 6. スキーマ追加（support_requests）

| カラム | 型 | 用途 |
|---|---|---|
| `transfer_reference` | string nullable | Wise送金参照ID |
| `usage_photo_url` | string nullable | 物資活用写真（任意・公開用） |

その他は既存スキーマ（2026-06-08再設計済み）をそのまま使用。

---

## 7. コンポーネント構成

```
app/
├── UseCases/Support/
│   ├── AccrueSupportPoolUseCase.php       # completed時の積算（Phase 3ジョブから呼ばれる）
│   ├── SubmitSupportRequestUseCase.php    # 申請・残高検証
│   ├── ApproveSupportRequestUseCase.php   # 承認額確定・プール減算
│   ├── RejectSupportRequestUseCase.php    # 却下
│   └── MarkSupportRequestPaidUseCase.php  # 送金記録
├── Http/Controllers/
│   └── SupportRequestController.php       # パートナー側: 残高表示・申請・履歴
└── Filament/Resources/
    └── SupportRequestResource.php         # 審査・送金記録
```

ドメイン例外: `InsufficientSupportPoolException` / `InvalidSupportRequestStateException`（pending以外の承認等）

---

## 8. メール一覧（Markdown Mailable・送信元 no-reply@）

| メール | 宛先 | トリガー |
|---|---|---|
| 申請受付 | パートナー | 申請完了時 |
| 承認通知（承認額） | パートナー | approve時 |
| 却下通知（理由） | パートナー | reject時 |
| 送金完了 | パートナー | paid記録時 |

---

## 9. テスト方針

- **Unit:** 積算境界（completed時のみ・cancelled除外・ファシリテーター料金除外）/ 残高超過申請の拒否 / 部分承認→正確な減算 / 却下時プール不変 / 状態遷移ガード（approved済みの再承認不可）
- **Feature:** 申請→Filament承認→送金記録の一連 / 領収書なし申請の拒否
- **Integration:** support_pool の同時更新（積算と減算の整合）
