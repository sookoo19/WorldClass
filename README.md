# WorldClass

日本の学校・公民館・塾と発展途上国の学校をつなぐ、オンライン国際交流マッチングプラットフォーム。

---

## セットアップ

### 必要なもの

- Docker Desktop
- Git

### 手順

```bash
# 1. リポジトリをクローン
git clone <repo-url>
cd worldclass

# 2. 環境変数ファイルを作成
cp .env.example .env

# 3. コンテナを起動
docker compose up -d

# 4. アプリケーションキーを生成
docker compose exec app php artisan key:generate

# 5. マイグレーション + シードデータ
docker compose exec app php artisan migrate --seed

# 6. フロントエンドをビルド
docker compose exec app npm install
docker compose exec app npm run build
```

### アクセス

| URL | 内容 |
|---|---|
| http://localhost | アプリケーション |
| http://localhost/admin | Filament 管理画面 |

**管理者アカウント（開発用）:**
- Email: `admin@worldclass.jp`
- Password: `admin123456`

---

## 開発

```bash
# テスト実行
docker compose exec app php artisan test

# コードスタイル修正
docker compose exec app ./vendor/bin/pint

# フロント開発サーバー（ホットリロード）
docker compose exec app npm run dev
```

---

## ドキュメント

- [サービス設計書](docs/superpowers/specs/2026-05-23-worldclass-design.md)
- [技術方針・アーキテクチャ](docs/superpowers/specs/2026-05-25-worldclass-engineering-principles.md)
- [Phase 1 実装計画](docs/superpowers/plans/2026-05-23-worldclass-plan1-foundation-laravel.md)
- [Phase 2 実装計画](docs/superpowers/plans/2026-05-24-worldclass-phase2-catalog-booking-stripe.md)