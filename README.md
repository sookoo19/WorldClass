# WorldClass

日本国内のご家庭・個人塾・サークル団体・公民館・図書館等と、発展途上国の学校や現地で活動する日本人をつなぐ、オンライン国際交流マッチングプラットフォーム。文化交流・英語学習・国際理解を1セッションで実現し、セッション料金の50%を現地の教育施設へ物資支援として還元する。

**LP:** https://worldclassjp.netlify.app/

---

## 技術スタック

| 区分 | 技術 |
|---|---|
| バックエンド | Laravel 13 |
| 管理画面 | Filament v4 |
| フロントエンド | Inertia.js + React + TypeScript |
| DB | PostgreSQL 16 |
| キャッシュ/Queue | Redis 7 |
| 決済 | Stripe Checkout |
| 環境 | Docker Compose（カスタム） |
| テスト | Pest |
| CI | GitHub Actions（test + Pint + Larastan level 5） |

---

## アーキテクチャ

クリーンアーキテクチャを採用。依存の方向は外側→内側のみ。

```
Http/Controllers → UseCases → Domain（Entities / Repositories Interface）
                                   ↑
                Infrastructure/Repositories（Eloquent実装）
```

詳細は [`CLAUDE.md`](CLAUDE.md) と [技術方針](docs/superpowers/specs/2026-05-25-worldclass-engineering-principles.md) を参照。

---

## セットアップ

```bash
# 1. .env を用意
cp .env.example .env

# 2. コンテナ起動（BuildKit を無効化してビルド）
DOCKER_BUILDKIT=0 docker compose build
docker compose up -d

# 3. 依存インストール・アプリキー・マイグレーション
docker compose exec app composer install
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed

# 4. フロントビルド
docker compose exec app npm install
docker compose exec app npm run build
```

アクセス: http://localhost  ／  管理画面: http://localhost/admin

---

## 開発コマンド

```bash
docker compose exec app php artisan test          # テスト
docker compose exec app ./vendor/bin/pint         # コード整形
docker compose exec app ./vendor/bin/phpstan analyse   # 静的解析
docker compose exec app npm run dev               # フロント開発サーバ
```

---

## ドキュメント

| ドキュメント | パス |
|---|---|
| サービス設計書 | `docs/superpowers/specs/2026-05-23-worldclass-design.md` |
| DB設計書 | `docs/superpowers/specs/2026-05-29-worldclass-db-design.md` |
| ER図（draw.io） | `docs/superpowers/specs/2026-05-29-worldclass-db-er.drawio` |
| 技術方針 | `docs/superpowers/specs/2026-05-25-worldclass-engineering-principles.md` |
| Phase 1 プラン | `docs/superpowers/plans/2026-05-23-worldclass-plan1-foundation-laravel.md` |
| Phase 2 プラン | `docs/superpowers/plans/2026-05-24-worldclass-phase2-catalog-booking-stripe.md` |

---

## 実装フェーズ

| フェーズ | 内容 |
|---|---|
| Phase 1 | 認証・DB基盤・クリーンアーキ骨格 |
| Phase 2 | カタログ・予約・Stripe決済 |
| Phase 3〜5 | 準備フロー・物資支援・自治体ダッシュボード |
