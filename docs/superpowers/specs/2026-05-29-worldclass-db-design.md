# WorldClass データベース設計書

**作成日:** 2026-05-29
**ステータス:** 設計確定
**関連:** [サービス設計書](2026-05-23-worldclass-design.md) / [技術方針](2026-05-25-worldclass-engineering-principles.md) / [Phase1プラン](../plans/2026-05-23-worldclass-plan1-foundation-laravel.md)

> **ER図:** [`2026-05-29-worldclass-db-er.drawio`](2026-05-29-worldclass-db-er.drawio)（draw.io で開く）

---

## 1. 設計の前提

本DB設計は **現行LP（https://worldclassjp.netlify.app/ ・2026-05-29時点）の仕様を正** とする。
サービス設計書（2026-05-23）から以下の仕様変更が発生しており、それを反映する。

| 論点 | 旧（設計書） | 新（LP・本設計） |
|---|---|---|
| 主役ユーザー | 法人中心 | **ご家庭中心**（法人も対象） |
| 利用者区分 | school / partner / admin | ご家庭・個人塾・サークル団体・公民館/図書館・その他 |
| 交流相手 | 海外校のみ | 海外校 **＋ 現地で活動する日本人** |
| テーマ | 文化紹介 / SDGs / 英語教育 | 文化交流 / 英語学習 / 国際理解 |
| 対象国 | フィリピン等（例示） | ケニア・ブータン・モロッコ・東ティモール・ガーナ・チュニジア |
| 個人課金単位 | 人単位 | **グループ単位**（3グループ以上で成立） |

料金体系（45分8,000円 / 60分10,000円・ファシリテーターオプション・50%物資支援）は不変。

---

## 2. 設計判断（なぜこの構造か）

1. **日本側利用者を単一 `members` テーブルに統合**
   - 5区分（家庭・塾・団体・公民館・その他）を `type` enum で表現。
   - 理由: 区分が増減しても enum 変更で済み、テーブル分割による予約・決済ロジックの二重化を避ける。家庭/法人の振る舞いの違いはアプリ層（UseCase）で分岐する。

2. **海外側提供者を単一 `partners` テーブルに統合**
   - 「海外校」「現地日本人」を `provider_type` enum で表現。
   - 理由: 審査・評価・物資支援プールの仕組みが両者で共通。`members` と対称な構造にして全体の見通しを保つ。

3. **`sessions`（枠）と `session_participants`（参加グループ）の分離**
   - 専用セッション（1対1）= `session_type: private` ・ `capacity: 1`。
   - オープンセッション（相乗り）= `session_type: open` ・ `capacity: N` ・複数グループが参加。
   - 理由: 課金・評価・準備フローは「参加グループ」単位で発生するため、参加を中間テーブルに切り出す。専用とオープンを単一スキーマで扱え、集計クエリも一本化できる。

4. **テーマは PHP enum / 国は文字列（YAGNI）**
   - Phase1ではマスタテーブルを作らない。
   - 理由: テーマは固定3値。国は増えるが Filament の選択肢追加で足り、FK・中間テーブルのコストに見合わない。必要になればマイグレーションでマスタ化する。

---

## 3. テーマ定義（PHP enum）

`app/Domain/ValueObjects/ThemeType.php`（Phase1のクリーンアーキ骨格で作成予定）

| enum値 | 表示名 |
|---|---|
| `culture` | 文化交流 |
| `english` | 英語学習 |
| `global` | 国際理解 |

---

## 4. テーブル定義

### 4.1 users（認証・既存テーブルを拡張）

Laravel Breeze 標準の `users` に `role` を追加する。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | bigint | PK | |
| name | string | | |
| email | string | unique | |
| email_verified_at | timestamp | nullable | |
| password | string | | |
| role | enum(member, partner, admin) | default member, after email | アクセス制御の起点 |
| remember_token | string | nullable | |
| timestamps | | | |

### 4.2 members（日本側利用者）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | bigint | PK | |
| user_id | bigint | FK→users, cascadeOnDelete | |
| type | enum(family, cram_school, circle, public_facility, other) | | 利用者区分 |
| org_name | string | nullable | 法人名（家庭は null） |
| prefecture | string | | 都道府県 |
| contact_name | string | | 担当者名 |
| grade_range | string | nullable | 家庭=お子さんの学年帯 |
| timestamps | | | |

### 4.3 partners（海外側提供者）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | bigint | PK | |
| user_id | bigint | FK→users, cascadeOnDelete | |
| provider_type | enum(overseas_school, local_japanese) | | 提供者種別 |
| display_name | string | | 校名 or 活動者名 |
| country | string | | 対象国（例: ケニア） |
| region | string | | 地域 |
| contact_name | string | | 担当者名 |
| video_url | string | nullable | 紹介VTR URL |
| status | enum(pending, approved, suspended, rejected) | default pending | 審査ステータス |
| rating_score | decimal(3,2) | default 0 | 準備評価スコア（★平均） |
| penalty_count | unsignedInteger | default 0 | ペナルティ蓄積 |
| support_pool | unsignedInteger | default 0 | 物資支援プール残高（円） |
| themes | json | | 対応テーマ（ThemeType値の配列） |
| grade_range | string | | 対象学年 |
| timestamps | | | |

### 4.4 sessions（セッション枠）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | bigint | PK | |
| partner_id | bigint | FK→partners, cascadeOnDelete | |
| session_type | enum(private, open) | | 専用 / オープン |
| scheduled_at | datetime | | 開催日時 |
| duration_min | unsignedInteger | | 45 or 60 |
| theme | string | | ThemeType値 |
| capacity | unsignedInteger | | 専用=1, オープン=N グループ |
| min_groups | unsignedInteger | default 1 | オープン成立の最低グループ数（例: 3） |
| with_facilitator | boolean | default false | ファシリテーター付与 |
| price_jpy | unsignedInteger | | 1グループあたり料金 |
| status | enum(draft, open, confirmed, ready, completed, cancelled) | default draft | 枠のステータス |
| ready_checked_at | datetime | nullable | 海外校の準備完了チェック日時 |
| cancelled_at | datetime | nullable | キャンセル日時 |
| timestamps | | | |

### 4.5 session_participants（参加グループ）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | bigint | PK | |
| session_id | bigint | FK→sessions, cascadeOnDelete | |
| member_id | bigint | FK→members, cascadeOnDelete | |
| status | enum(pending, confirmed, cancelled) | default pending | 参加ステータス |
| stripe_payment_id | string | nullable | 決済ID（Phase2で使用） |
| price_paid | unsignedInteger | | 支払額（円） |
| support_amount | unsignedInteger | | price_paid の50%（物資支援額） |
| question_list | text | nullable | 各グループの質問リスト |
| question_list_sent_at | datetime | nullable | 質問送信日時 |
| rating_score | unsignedTinyInteger | nullable | 準備評価 ★1-5 |
| rating_comment | text | nullable | 評価コメント |
| cancelled_at | datetime | nullable | キャンセル日時 |
| timestamps | | | |

### 4.6 support_requests（物資支援）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | bigint | PK | |
| partner_id | bigint | FK→partners, cascadeOnDelete | |
| item_list | json | | 申請品目 [{name, quantity}] |
| total_amount_jpy | unsignedInteger | | 申請総額（円） |
| status | enum(pending, shipped, delivered) | default pending | 発送ステータス |
| receipt_photo_url | string | nullable | 受領写真URL |
| delivered_at | datetime | nullable | 受領日時 |
| timestamps | | | |

### 4.7 coupons（クーポン）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | bigint | PK | |
| member_id | bigint | FK→members, cascadeOnDelete | |
| discount_pct | unsignedInteger | | 割引率（%） |
| reason | enum(early_bird, auto_cancel) | | 先着300名特典 / 自動キャンセル時10% |
| code | string | nullable | クーポンコード |
| used_at | datetime | nullable | 使用日時 |
| expires_at | datetime | | 有効期限 |
| timestamps | | | |

---

## 5. リレーション一覧

```
users (1) ──── (1) members
users (1) ──── (1) partners
members (1) ──── (N) session_participants
members (1) ──── (N) coupons
partners (1) ──── (N) sessions
partners (1) ──── (N) support_requests
sessions (1) ──── (N) session_participants
```

- `users.role = member` のとき `members` を1件持つ。
- `users.role = partner` のとき `partners` を1件持つ。
- `users.role = admin` は付随プロフィールを持たない（運営）。

---

## 6. Phase 境界

| 範囲 | 扱い |
|---|---|
| 全テーブルのスキーマ作成 | **Phase 1**（本設計） |
| 認証・ロール・登録フロー | Phase 1 |
| カタログ検索・予約ロジック・Stripe決済 | Phase 2（`stripe_payment_id` 等のカラムは Phase1 で用意） |
| 準備フロー・自動キャンセル・通知 | Phase 3（`ready_checked_at` 等のカラムは Phase1 で用意） |
| 物資支援の運用フロー | Phase 4 |
| 自治体ダッシュボード | Phase 5 |

Phase1ではスキーマ（マイグレーション + Eloquentモデル）のみ確定させ、業務ロジックは後続フェーズで実装する。
