# WorldClass エンジニアリング原則・技術方針

**作成日:** 2026-05-25  
**ステータス:** 確定

---

## 1. 技術スタック（確定）

| 区分 | 採用技術 | 理由 |
|---|---|---|
| バックエンド | Laravel 13 | PHP安定・Filament管理画面が強力 |
| 管理画面 | Filament v4 | 海外校審査・物資管理を最速で構築 |
| フロントエンド | Inertia.js + React | SPA的UX、APIレス |
| DB | PostgreSQL | リレーション・トランザクション重視 |
| キャッシュ/Queue | Redis | ジョブキュー（キャンセル処理等） |
| 決済 | Stripe Checkout | Webhook確定方式 |
| インフラ | カスタム Docker Compose | 学習・本番環境の一貫性 |

---

## 2. アーキテクチャ：フルレイヤー分離（クリーンアーキテクチャ）

### 基本方針

依存の方向は **外側 → 内側のみ**。ドメイン層は Laravel に依存しない。

```
┌────────────────────────────────────────┐
│  Interface Layer（HTTP Controllers）    │
│  ├── Request を UseCase Input に変換    │
│  └── UseCase Output を Response に変換  │
├────────────────────────────────────────┤
│  Application Layer（UseCases）          │
│  ├── ビジネスフローを記述               │
│  └── Repository Interface を呼ぶ        │
├────────────────────────────────────────┤
│  Domain Layer（Entities / ValueObjects）│
│  ├── ビジネスルールを持つ               │
│  └── フレームワーク依存なし             │
├────────────────────────────────────────┤
│  Infrastructure Layer                  │
│  ├── Eloquent Repository実装            │
│  └── 外部サービス（Stripe, Mail 等）    │
└────────────────────────────────────────┘
```

### ディレクトリ構成

```
app/
├── Domain/
│   ├── Entities/
│   │   ├── Session.php           # セッション（予約・ステータス）
│   │   ├── Partner.php           # 海外校
│   │   └── School.php            # 日本校
│   ├── ValueObjects/
│   │   ├── SessionStatus.php     # enum: pending/confirmed/cancelled...
│   │   ├── Money.php             # 金額（円単位）
│   │   ├── Rating.php            # ★1〜5
│   │   └── FacilitatorOption.php # ファシリテーターオプション（enabled + fee）
│   ├── Repositories/             # インターフェース
│   │   ├── SessionRepositoryInterface.php
│   │   ├── PartnerRepositoryInterface.php
│   │   └── SchoolRepositoryInterface.php
│   └── Exceptions/
│       ├── SlotUnavailableException.php
│       └── PaymentFailedException.php
│
├── UseCases/
│   ├── Booking/
│   │   ├── CreateBookingInput.php
│   │   ├── CreateBookingOutput.php
│   │   └── CreateBookingUseCase.php
│   ├── Slot/
│   │   ├── GetAvailableSlotsInput.php
│   │   ├── GetAvailableSlotsOutput.php
│   │   └── GetAvailableSlotsUseCase.php
│   └── Cancellation/
│       ├── ProcessCancellationInput.php
│       └── ProcessCancellationUseCase.php
│
├── Infrastructure/
│   ├── Repositories/
│   │   ├── EloquentSessionRepository.php
│   │   ├── EloquentPartnerRepository.php
│   │   └── EloquentSchoolRepository.php
│   └── Services/
│       ├── StripePaymentService.php
│       └── MailNotificationService.php
│
├── Http/
│   └── Controllers/
│       ├── CatalogController.php     # UseCase を呼ぶのみ
│       ├── BookingController.php
│       └── WebhookController.php
│
├── Models/                           # Eloquentモデル（インフラ層）
│   ├── User.php
│   ├── School.php
│   ├── Partner.php
│   ├── Session.php
│   ├── Coupon.php
│   └── SupportRequest.php
│
└── Providers/
    └── AppServiceProvider.php        # DI バインディング登録
```

### 依存性の注入（DI）バインディング例

```php
// AppServiceProvider.php
$this->app->bind(
    \App\Domain\Repositories\SessionRepositoryInterface::class,
    \App\Infrastructure\Repositories\EloquentSessionRepository::class,
);
```

### コントローラの責務

コントローラは **薄く** 保つ。UseCaseを呼ぶだけ。

```php
// BookingController.php
public function store(CreateBookingRequest $request): Response
{
    $input  = new CreateBookingInput(/* バリデーション済みデータ */);
    $output = $this->createBookingUseCase->execute($input);

    return Inertia::render('Booking/Complete', ['session' => $output->session]);
}
```

### ファシリテーターオプションの設計方針

**DBスキーマ（`sessions` テーブルへの追加）**

```
sessions
  + with_facilitator  boolean  not null  default false
  + facilitator_fee   integer  not null  default 0      ← 円単位、決済時の金額を記録
```

`facilitator_fee` を別カラムで保存することで、将来の料金改定があっても過去の予約金額が変わらない。

**ValueObject: `FacilitatorOption`**

```php
// app/Domain/ValueObjects/FacilitatorOption.php
final class FacilitatorOption
{
    public function __construct(
        public readonly bool  $enabled,
        public readonly Money $fee,
    ) {}

    public static function none(): self
    {
        return new self(false, Money::zero());
    }

    public static function forDuration(SessionDuration $duration): self
    {
        $fee = match ($duration->value) {
            45 => Money::ofYen(2500),
            60 => Money::ofYen(3000),
        };
        return new self(true, $fee);
    }
}
```

**UseCase（`CreateBookingInput` への追加）**

```php
// CreateBookingInput に追加
public readonly FacilitatorOption $facilitatorOption,
```

料金計算は UseCase 内で完結させる：

```php
$totalAmount = $basePrice->add($input->facilitatorOption->fee);
```

**Stripeへの渡し方**

Stripeには合算した `$totalAmount` を渡す。内訳はメタデータに記録する：

```php
'metadata' => [
    'base_fee'          => $basePrice->toYen(),
    'facilitator_fee'   => $input->facilitatorOption->fee->toYen(),
    'with_facilitator'  => $input->facilitatorOption->enabled ? 'true' : 'false',
],
```

**Filament管理画面**

- 予約一覧に「🎙 ファシリテーター要」バッジを表示
- 手動アサイン用メモ欄（`facilitator_note: text nullable`）を追加
- 将来フェーズ：スタッフカレンダー連携による自動アサイン

**オープンセッション**

- `with_facilitator = true` 固定
- `facilitator_fee = 0`（料金に内包されているため）

---

## 3. Docker構成（カスタム Docker Compose）

### ファイル構成

```
worldclass/
├── docker/
│   ├── php/
│   │   └── Dockerfile        # PHP 8.3 + Composer
│   ├── nginx/
│   │   └── default.conf      # Nginxリバースプロキシ設定
│   └── redis/
│       └── redis.conf
├── docker-compose.yml
└── docker-compose.override.yml  # ローカル開発用（ボリューム等）
```

### `docker-compose.yml`（本番ベース）

```yaml
services:
  app:
    build:
      context: .
      dockerfile: docker/php/Dockerfile
    volumes:
      - .:/var/www/html
    environment:
      - APP_ENV=${APP_ENV}
    depends_on:
      - db
      - redis

  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
    volumes:
      - .:/var/www/html
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${DB_DATABASE}
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    ports:
      - "6379:6379"

volumes:
  pgdata:
  redisdata:
```

### `docker/php/Dockerfile`

```dockerfile
FROM php:8.3-fpm

# 依存パッケージ
RUN apt-get update && apt-get install -y \
    git curl zip unzip libpq-dev libzip-dev \
    && docker-php-ext-install pdo pdo_pgsql zip bcmath \
    && pecl install redis && docker-php-ext-enable redis

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
```

### よく使うコマンド

```bash
docker compose up -d          # 起動
docker compose exec app bash  # コンテナ内に入る
docker compose exec app php artisan migrate
docker compose exec app php artisan test
docker compose down -v        # 停止＋ボリューム削除
```

---

## 4. 実務エンジニアリング原則

### 4-1. TDD（テスト駆動開発）

**方針：** UseCase・Repository・Service は **テストファースト**。Controllerは Feature Test でカバー。

```
テスト種別          対象                    ツール
─────────────────────────────────────────────────────
Unit Test          UseCase / Entity         Pest / PHPUnit
Integration Test   Repository（DB込み）      RefreshDatabase
Feature Test       HTTP エンドポイント       Pest (feature)
```

**ファイル構成例：**

```
tests/
├── Unit/
│   ├── UseCases/
│   │   ├── CreateBookingUseCaseTest.php
│   │   └── GetAvailableSlotsUseCaseTest.php
│   └── Domain/
│       └── Entities/
│           └── SessionTest.php
├── Feature/
│   ├── BookingTest.php
│   ├── CatalogTest.php
│   └── WebhookTest.php
└── Integration/
    └── Repositories/
        └── EloquentSessionRepositoryTest.php
```

**TDDサイクル（各タスク）：**

1. `🔴 Red` — 失敗するテストを書く
2. `🟢 Green` — 最小限のコードでテストを通す
3. `🔵 Refactor` — リファクタリング（SOLIDに整える）

### 4-2. SOLID原則の適用

| 原則 | Laravelでの適用例 |
|---|---|
| **S** (単一責任) | UseCase は1ユースケースのみ。Controller は薄く |
| **O** (開放閉鎖) | Repository Interface + DI で実装差し替え可能 |
| **L** (リスコフ置換) | Repository実装がInterfaceを完全に満たす |
| **I** (インターフェース分離) | 大きなRepositoryを `ReadRepository` / `WriteRepository` に分割 |
| **D** (依存性逆転) | UseCase は Infrastructure に依存しない（Interface経由） |

### 4-3. Git Conventional Commits

**形式：** `<type>(<scope>): <description>`

```
feat(booking): add slot selection UI
fix(stripe): handle webhook signature mismatch
refactor(session): extract status logic to ValueObject
test(usecase): add CreateBookingUseCase unit tests
chore(docker): add PHP Dockerfile
docs(api): update booking endpoint docs
```

**type 一覧：**

| type | 用途 |
|---|---|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `refactor` | リファクタリング（機能変更なし） |
| `test` | テスト追加・修正 |
| `chore` | ビルド・設定・依存関係 |
| `docs` | ドキュメントのみ |
| `perf` | パフォーマンス改善 |

**ブランチ戦略：**

```
main          ← 本番（直push禁止）
staging       ← ステージング
feat/<name>   ← 機能開発
fix/<name>    ← バグ修正
```

### 4-4. CI/CD（GitHub Actions）

**`.github/workflows/ci.yml`（概要）:**

```yaml
name: CI

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: worldclass_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: secret
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
          extensions: pdo_pgsql, redis, zip, bcmath

      - name: Install dependencies
        run: composer install --no-interaction --prefer-dist

      - name: Copy .env
        run: cp .env.example .env.testing

      - name: Generate key
        run: php artisan key:generate --env=testing

      - name: Run tests
        run: php artisan test --env=testing

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Pint (code style)
        run: ./vendor/bin/pint --test
```

**パイプライン構成：**

```
PR作成
  ↓
GitHub Actions
  ├── テスト（Unit / Feature / Integration）
  ├── コードスタイルチェック（Laravel Pint）
  └── 型チェック（Larastan）
  ↓
All green → レビュー → マージ
  ↓
staging push → ステージングデプロイ（将来）
main push    → 本番デプロイ（将来）
```

### 4-5. env管理

**方針：** `.env` はgitに含めない。`.env.example` のみコミット。

**`.env.example`（抜粋）:**

```
APP_NAME=WorldClass
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost

DB_CONNECTION=pgsql
DB_HOST=db
DB_PORT=5432
DB_DATABASE=worldclass
DB_USERNAME=postgres
DB_PASSWORD=

REDIS_HOST=redis
REDIS_PORT=6379

STRIPE_KEY=
STRIPE_SECRET=
STRIPE_WEBHOOK_SECRET=

MAIL_MAILER=smtp
MAIL_HOST=
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=noreply@worldclass.jp
```

**環境別ファイル：**

| ファイル | 用途 | git管理 |
|---|---|---|
| `.env` | ローカル開発 | ❌ .gitignore |
| `.env.example` | テンプレ | ✅ コミット |
| `.env.testing` | テスト用 | ❌ .gitignore |
| GitHub Secrets | CI/CD・本番 | GitHub管理 |

---

## 5. 実装フェーズとの関係

| フェーズ | 主な実装 | アーキ適用範囲 |
|---|---|---|
| Phase 1 | 認証・DB基盤 | Domain Entity定義・Repository Interface作成 |
| Phase 2 | カタログ・予約・Stripe | UseCase実装・Repository Eloquent実装 |
| Phase 3 | 準備フロー・通知 | Job/UseCase・Domain Event検討 |
| Phase 4 | 物資支援管理 | 管理画面（Filament）+ UseCase |
| Phase 5 | 自治体ダッシュボード | 集計UseCase・CSVエクスポート |
