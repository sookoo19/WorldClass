# WorldClass Phase 3 設計書：準備フロー・評価

**作成日:** 2026-06-10
**ステータス:** 設計確定

> **全体設計** → [`2026-05-23-worldclass-design.md`](2026-05-23-worldclass-design.md)
> **オープンセッション（Phase 2.5）** → [`2026-06-10-worldclass-phase2.5-open-session-design.md`](2026-06-10-worldclass-phase2.5-open-session-design.md)
> **物資支援（Phase 4）** → [`2026-06-10-worldclass-phase4-supply-reimbursement-design.md`](2026-06-10-worldclass-phase4-supply-reimbursement-design.md)

---

## 1. スコープ

予約・申込の確定後からセッション事後評価まで。専用セッション・オープンセッション共通。

- 質問リスト送信（利用者 → パートナー）
- 準備完了チェック（パートナー）・催促・自動キャンセル
- リマインド・Zoom URL配布
- セッション完了判定
- 事後評価（★1〜5）・パートナー品質管理

---

## 2. 確定タイムライン（JST）

```
専用セッション
  予約締切        1週間前（スロット生成ロジックで担保・Phase 2改修）
  質問送信・編集   3日前12時まで

オープンセッション
  申込締切        3日前12時（成立判定と同時）
  直前参加        成立済み＋残枠あり → 12時間前まで（質問送信不可）

共通
  3日前12時      質問締切・オープン成立判定・未readyパートナーへ催促
  前日12時       未ready → 自動キャンセル（全額返金＋10%クーポン）
  前日           リマインドメール（Zoom URL・当日チェックリスト）
  終了時刻経過    completed 判定（物資プール積算のトリガー → Phase 4）
  翌日           評価依頼メール
  4日後          評価未提出ならリマインド1回（以後なし）
```

> 当初設計の「質問は1週間前まで」は廃止。3日前12時に統一することで、オープンセッションの3日前申込者も質問を送れる。パートナーの準備期間は3日前12時〜前日12時として全セッション共通で保証する。

---

## 3. 質問リスト送信（利用者）

- マイページの予約詳細から質問・要望をテキスト送信（`session_participants.question_list` / `question_list_sent_at`）
- 3日前12時まで何度でも編集可。期限後はフォームをロックし閲覧のみ
- パートナーダッシュボードでセッションごとに全グループ分を一覧表示

---

## 4. 準備完了チェック（パートナー）

- パートナーダッシュボードの該当セッションに「準備完了」ボタン
- 押下 → `sessions.ready_checked_at` 記録・status を `confirmed` → `ready` に更新
- ready 後は質問一覧の再確認のみ（取り消し機能なし。MVPでは運営が手動で戻す）

---

## 5. Schedulerジョブ（毎時実行）

Laravel Scheduler（`schedule:work` / 本番はcron 1分間隔→内部で毎時判定）＋ Redis Queue。すべて冪等に実装する。

| ジョブ | 判定タイミング | 処理 |
|---|---|---|
| `RemindUnreadySessionsJob` | 3日前12時経過・未ready | パートナーへ催促メール＋運営へアラートメール |
| `AutoCancelUnreadySessionsJob` | 前日12時経過・未ready | `ProcessCancellationJob` 投入（全額返金・10%クーポン・利用者通知）・status=cancelled |
| `SendSessionRemindersJob` | 前日・ready済み | 利用者・パートナー双方へリマインドメール（日時・Zoom URL・当日チェックリストURL） |
| `CompleteFinishedSessionsJob` | `scheduled_at + duration_min` 経過・ready | status=completed・物資プール積算（Phase 4の `AccrueSupportPool` を呼ぶ）・翌日評価依頼のための起点 |
| `SendRatingRequestsJob` | completed翌日 / 4日後未提出 | 評価依頼メール / リマインド1回 |

各メールの重複送信防止: 送信済みフラグはジョブごとに `sessions` / `session_participants` の既存日時カラムと専用の送信記録（`notifications_log` テーブルは作らず、`reminded_at` 等の最小カラム追加で対応）で判定する。

**スキーマ追加（sessions）:**

| カラム | 型 | 用途 |
|---|---|---|
| `meeting_url` | string nullable | Zoom URL。運営がFilamentから設定 |
| `unready_reminded_at` | datetime nullable | 催促メール送信済み判定 |
| `reminded_at` | datetime nullable | 前日リマインド送信済み判定 |

**スキーマ追加（session_participants）:**

| カラム | 型 | 用途 |
|---|---|---|
| `rating_requested_at` | datetime nullable | 評価依頼送信済み判定 |
| `rating_reminded_at` | datetime nullable | 評価リマインド送信済み判定 |

---

## 6. Zoom URL・当日チェックリスト

- Zoom等のミーティングURLは運営が手動発行し、Filamentから `sessions.meeting_url` に設定
- 前日リマインドメールと利用者・パートナー双方の予約詳細画面に表示
- 当日チェックリストは静的ページ（接続確認・カメラ/マイク・進行の流れ）。リマインドメールからリンク

---

## 7. 事後評価（任意＋リマインド1回）

- completed 翌日に参加グループ（participant）単位で評価依頼メール
- 評価フォーム: ★1〜5（`rating_score`）＋任意コメント（`rating_comment`）
- 提出は任意。4日後未提出ならリマインド1回のみ。以後の強制なし
- 提出時に `partners.rating_score` を全評価の平均で再計算

---

## 8. パートナー品質管理

| 状況 | 対応 | 実装 |
|---|---|---|
| ★2以下が3回連続 | カタログ非表示＋運営通知 | 評価提出時に当該パートナーの直近3件を判定（`SubmitRatingUseCase` 内）。非表示は `partners.status` を `hidden` に更新 |
| 当日ドタキャン | ペナルティ加算 | 運営がFilamentから `penalty_count` を手動加算 |
| ペナルティ3回 | アカウント停止 | 手動加算時に3到達で `suspended` へ（Filamentアクション内で判定） |

**スキーマ確認:** `PartnerStatus` enum に `hidden` / `suspended` が無い場合は追加する。

---

## 9. コンポーネント構成

```
app/
├── UseCases/Preparation/
│   ├── SubmitQuestionListUseCase.php   # 締切検証・保存
│   ├── MarkSessionReadyUseCase.php     # ready遷移
│   └── SubmitRatingUseCase.php         # 評価保存・平均再計算・連続低評価判定
├── Http/Controllers/
│   ├── QuestionListController.php
│   ├── SessionReadyController.php      # パートナーダッシュボード
│   └── RatingController.php
├── Jobs/                               # §5の5ジョブ
└── Filament/
    └── SessionResource                 # meeting_url設定・手動キャンセル・penalty加算
```

ドメイン例外: `QuestionDeadlinePassedException` / `SessionNotReadyableException`

---

## 10. メール一覧（Markdown Mailable・送信元 no-reply@）

| メール | 宛先 | トリガー |
|---|---|---|
| 準備催促 | パートナー | 3日前12時 未ready |
| 未ready運営アラート | 運営 | 3日前12時 未ready |
| 自動キャンセル通知（返金・クーポン） | 利用者 | 前日12時 未ready |
| 前日リマインド | 利用者・パートナー | 前日・ready済み |
| 評価依頼 / 評価リマインド | 利用者 | completed翌日 / 4日後 |

---

## 11. テスト方針

- **Unit:** 締切境界（3日前12時±1分での質問送信可否）・ready遷移条件・評価平均再計算・★2×3連続判定（2連続では非表示にならない）
- **Unit（ジョブ）:** 各Schedulerジョブの対象抽出条件・冪等性（2回実行で重複送信なし）
- **Feature:** 質問送信→パートナー閲覧 / ready→前日12時スキップ / 未ready→自動キャンセル→返金Job投入
