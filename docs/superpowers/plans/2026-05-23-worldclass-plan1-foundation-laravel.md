# WorldClass Phase 1: Foundation & Auth Implementation Plan (Laravel)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Laravel 11 + Inertia.js + React + Filament + カスタムDockerで基盤を構築し、3ロール（日本校・海外校・管理者）の認証・DBマイグレーション・クリーンアーキテクチャ骨格を完成させる。

**Architecture:** クリーンアーキテクチャ（Domain / UseCase / Infrastructure / Http）。フロントはInertia.js + React。管理画面はFilament v3。

**Tech Stack:** Laravel 11, Inertia.js, React, Filament v3, PostgreSQL 16, Redis 7, Nginx, Docker Compose, Pest（TDD）

**Engineering Principles:** → [`engineering-principles.md`](../specs/2026-05-25-worldclass-engineering-principles.md)

---

## ファイル構成（Phase 1完了時点）

```
worldclass/
├── docker/
│   ├── php/
│   │   └── Dockerfile
│   └── nginx/
│       └── default.conf
├── docker-compose.yml
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── app/
│   ├── Domain/
│   │   ├── Entities/
│   │   │   ├── School.php           # ドメインエンティティ（Eloquentモデルではない）
│   │   │   └── Partner.php
│   │   ├── ValueObjects/
│   │   │   └── PartnerStatus.php    # enum: pending/approved/suspended/rejected
│   │   └── Repositories/            # インターフェース
│   │       ├── SchoolRepositoryInterface.php
│   │       └── PartnerRepositoryInterface.php
│   ├── UseCases/
│   │   └── Auth/
│   │       ├── RegisterSchoolInput.php
│   │       ├── RegisterSchoolOutput.php
│   │       ├── RegisterSchoolUseCase.php
│   │       ├── RegisterPartnerInput.php
│   │       ├── RegisterPartnerOutput.php
│   │       └── RegisterPartnerUseCase.php
│   ├── Infrastructure/
│   │   └── Repositories/
│   │       ├── EloquentSchoolRepository.php
│   │       └── EloquentPartnerRepository.php
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Auth/
│   │   │   │   └── RegisteredUserController.php
│   │   │   └── DashboardController.php
│   │   ├── Requests/
│   │   │   ├── RegisterSchoolRequest.php
│   │   │   └── RegisterPartnerRequest.php
│   │   └── Middleware/
│   │       └── EnsureRole.php
│   ├── Models/                       # Eloquentモデル（インフラ層）
│   │   ├── User.php
│   │   ├── School.php
│   │   ├── Partner.php
│   │   ├── Session.php
│   │   ├── Coupon.php
│   │   └── SupportRequest.php
│   ├── Filament/
│   │   └── Resources/
│   │       └── PartnerResource.php
│   └── Providers/
│       └── AppServiceProvider.php    # DIバインディング
├── database/
│   ├── migrations/
│   │   ├── xxxx_add_role_to_users_table.php
│   │   ├── xxxx_create_schools_table.php
│   │   ├── xxxx_create_partners_table.php
│   │   ├── xxxx_create_sessions_table.php
│   │   ├── xxxx_create_support_requests_table.php
│   │   └── xxxx_create_coupons_table.php
│   └── seeders/
│       └── AdminUserSeeder.php
├── resources/
│   └── js/
│       ├── Pages/
│       │   ├── Auth/
│       │   │   ├── Login.tsx
│       │   │   ├── RegisterSchool.tsx
│       │   │   └── RegisterPartner.tsx
│       │   └── Dashboard/
│       │       ├── School.tsx
│       │       └── Partner.tsx
│       └── app.tsx
├── routes/
│   ├── web.php
│   └── auth.php
└── tests/
    ├── Unit/
    │   └── UseCases/
    │       ├── RegisterSchoolUseCaseTest.php
    │       └── RegisterPartnerUseCaseTest.php
    └── Feature/
        ├── Auth/
        │   ├── RegisterSchoolTest.php
        │   └── RegisterPartnerTest.php
        └── DashboardTest.php
```

---

## Task 0: Docker環境構築

**Files:**
- Create: `docker/php/Dockerfile`
- Create: `docker/nginx/default.conf`
- Create: `docker-compose.yml`

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p docker/php docker/nginx
```

- [ ] **Step 2: `docker/php/Dockerfile` を作成**

```dockerfile
FROM php:8.3-fpm

RUN apt-get update && apt-get install -y \
    git curl zip unzip libpq-dev libzip-dev \
    && docker-php-ext-install pdo pdo_pgsql zip bcmath \
    && pecl install redis && docker-php-ext-enable redis

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
```

- [ ] **Step 3: `docker/nginx/default.conf` を作成**

```nginx
server {
    listen 80;
    root /var/www/html/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass app:9000;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    }
}
```

- [ ] **Step 4: `docker-compose.yml` を作成**

```yaml
services:
  app:
    build:
      context: .
      dockerfile: docker/php/Dockerfile
    volumes:
      - .:/var/www/html
    environment:
      - APP_ENV=${APP_ENV:-local}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

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
      POSTGRES_DB: ${DB_DATABASE:-worldclass}
      POSTGRES_USER: ${DB_USERNAME:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-secret}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

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

- [ ] **Step 5: `.env.example` を作成**

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
DB_PASSWORD=secret

REDIS_HOST=redis
REDIS_PORT=6379

STRIPE_KEY=
STRIPE_SECRET=
STRIPE_WEBHOOK_SECRET=

MAIL_MAILER=log
MAIL_FROM_ADDRESS=noreply@worldclass.jp
MAIL_FROM_NAME="${APP_NAME}"
```

- [ ] **Step 6: `.env` を `.env.example` からコピー**

```bash
cp .env.example .env
```

- [ ] **Step 7: コミット**

```bash
git add docker/ docker-compose.yml .env.example
git commit -m "chore(docker): add custom Docker Compose with PHP 8.3, Nginx, PostgreSQL, Redis"
```

---

## Task 1: Laravelプロジェクト作成

**Files:**
- Create: プロジェクトルート一式

- [ ] **Step 1: Laravelプロジェクト作成（コンテナ外 or ローカルComposer）**

```bash
composer create-project laravel/laravel worldclass
cd worldclass
```

> 既存ディレクトリに作る場合: `composer create-project laravel/laravel .`

- [ ] **Step 2: Dockerコンテナ起動**

```bash
docker compose up -d
docker compose exec app php artisan key:generate
```

- [ ] **Step 3: Inertia.js + React インストール**

```bash
docker compose exec app composer require inertiajs/inertia-laravel
docker compose exec app npm install @inertiajs/react react react-dom
docker compose exec app npm install -D @types/react @types/react-dom typescript
```

- [ ] **Step 4: Laravel Breeze（Inertia + React）インストール**

```bash
docker compose exec app composer require laravel/breeze --dev
docker compose exec app php artisan breeze:install react
docker compose exec app npm install
docker compose exec app npm run build
```

- [ ] **Step 5: Pest インストール（TDD用）**

```bash
docker compose exec app composer require pestphp/pest --dev --with-all-dependencies
docker compose exec app php artisan pest:install
```

- [ ] **Step 6: 動作確認**

`http://localhost` にアクセス → Laravelデフォルト画面が表示される

- [ ] **Step 7: コミット**

```bash
git add .
git commit -m "feat: initialize Laravel 11 + Inertia.js + React + Pest"
```

---

## Task 2: Filament v3インストール（管理画面）

**Files:**
- Modify: `app/Models/User.php`

- [ ] **Step 1: Filamentインストール**

```bash
docker compose exec app composer require filament/filament:"^3.2" -W
docker compose exec app php artisan filament:install --panels
```

対話式で以下を入力：
- Panel ID: `admin`
- Panel path: `admin`

- [ ] **Step 2: `app/Models/User.php` にFilamentインターフェース追加**

```php
<?php

namespace App\Models;

use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable implements FilamentUser
{
    use Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'password' => 'hashed',
    ];

    public function canAccessPanel(Panel $panel): bool
    {
        return $this->role === 'admin';
    }

    public function school()
    {
        return $this->hasOne(School::class);
    }

    public function partner()
    {
        return $this->hasOne(Partner::class);
    }
}
```

- [ ] **Step 3: 動作確認**

`http://localhost/admin` → Filamentログイン画面が表示される

- [ ] **Step 4: コミット**

```bash
git add .
git commit -m "feat(admin): install Filament v3 admin panel"
```

---

## Task 3: GitHub Actions CI設定

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: `.github/workflows/ci.yml` を作成**

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

      - name: Install PHP dependencies
        run: composer install --no-interaction --prefer-dist

      - name: Copy .env
        run: |
          cp .env.example .env.testing
          sed -i 's/DB_HOST=db/DB_HOST=127.0.0.1/' .env.testing
          sed -i 's/DB_DATABASE=worldclass/DB_DATABASE=worldclass_test/' .env.testing
          sed -i 's/REDIS_HOST=redis/REDIS_HOST=127.0.0.1/' .env.testing

      - name: Generate app key
        run: php artisan key:generate --env=testing

      - name: Run migrations
        run: php artisan migrate --env=testing

      - name: Run tests
        run: php artisan test --env=testing

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
      - run: composer install --no-interaction --prefer-dist
      - name: Pint (code style)
        run: ./vendor/bin/pint --test
```

- [ ] **Step 3: コミット**

```bash
git add .github/
git commit -m "chore(ci): add GitHub Actions CI with test and lint jobs"
```

---

## Task 4: DBマイグレーション（全テーブル）

**Files:**
- Create: 6つのマイグレーション
- Create: `app/Models/` 各モデル

### 4-1: usersテーブルにroleカラム追加

- [ ] **Step 1: マイグレーション作成**

```bash
docker compose exec app php artisan make:migration add_role_to_users_table --table=users
```

- [ ] **Step 2: マイグレーション編集**

```php
public function up(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->enum('role', ['school', 'partner', 'admin'])
              ->default('school')
              ->after('email');
    });
}

public function down(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->dropColumn('role');
    });
}
```

### 4-2: schoolsテーブル

- [ ] **Step 1: マイグレーション・モデル作成**

```bash
docker compose exec app php artisan make:model School -m
```

- [ ] **Step 2: マイグレーション編集**

```php
Schema::create('schools', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('name');
    $table->string('type');           // 学校・公民館・図書館・その他
    $table->string('prefecture');
    $table->string('contact_name');
    $table->string('grade_range');    // 例: "小4-小6"
    $table->timestamps();
});
```

- [ ] **Step 3: `app/Models/School.php` 編集**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class School extends Model
{
    protected $fillable = [
        'user_id', 'name', 'type', 'prefecture', 'contact_name', 'grade_range',
    ];

    public function user() { return $this->belongsTo(User::class); }
    public function sessions() { return $this->hasMany(Session::class); }
    public function coupons() { return $this->hasMany(Coupon::class); }
}
```

### 4-3: partnersテーブル

- [ ] **Step 1: マイグレーション・モデル作成**

```bash
docker compose exec app php artisan make:model Partner -m
```

- [ ] **Step 2: マイグレーション編集**

```php
Schema::create('partners', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('school_name');
    $table->string('country');
    $table->string('region');
    $table->string('contact_name');
    $table->string('video_url')->nullable();
    $table->enum('status', ['pending', 'approved', 'suspended', 'rejected'])
          ->default('pending');
    $table->decimal('rating_score', 3, 2)->default(0);
    $table->unsignedInteger('penalty_count')->default(0);
    $table->unsignedInteger('support_pool')->default(0);
    $table->json('themes')->nullable();
    $table->string('grade_range');
    $table->timestamps();
});
```

- [ ] **Step 3: `app/Models/Partner.php` 編集**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Partner extends Model
{
    protected $fillable = [
        'user_id', 'school_name', 'country', 'region', 'contact_name',
        'video_url', 'status', 'rating_score', 'penalty_count',
        'support_pool', 'themes', 'grade_range',
    ];

    protected $casts = [
        'themes'       => 'array',
        'rating_score' => 'float',
    ];

    public function user() { return $this->belongsTo(User::class); }
    public function sessions() { return $this->hasMany(Session::class); }
    public function supportRequests() { return $this->hasMany(SupportRequest::class); }
}
```

### 4-4: sessions / support_requests / couponsテーブル

- [ ] **Step 1: マイグレーション・モデル一括作成**

```bash
docker compose exec app php artisan make:model Session -m
docker compose exec app php artisan make:model SupportRequest -m
docker compose exec app php artisan make:model Coupon -m
```

- [ ] **Step 2: sessions マイグレーション編集**

```php
Schema::create('sessions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('school_id')->constrained()->cascadeOnDelete();
    $table->foreignId('partner_id')->constrained()->cascadeOnDelete();
    $table->dateTime('scheduled_at');
    $table->unsignedInteger('duration_min');      // 45 or 60
    $table->string('theme');
    $table->text('question_list')->nullable();
    $table->enum('status', [
        'pending', 'confirmed', 'checklist_sent', 'ready', 'completed', 'cancelled'
    ])->default('pending');
    $table->unsignedInteger('price_jpy');
    $table->unsignedInteger('support_amount');
    $table->string('stripe_payment_id')->nullable();
    $table->unsignedTinyInteger('rating_score')->nullable();
    $table->text('rating_comment')->nullable();
    $table->dateTime('question_list_sent_at')->nullable();
    $table->dateTime('ready_checked_at')->nullable();
    $table->dateTime('cancelled_at')->nullable();
    $table->timestamps();
});
```

- [ ] **Step 3: support_requests マイグレーション編集**

```php
Schema::create('support_requests', function (Blueprint $table) {
    $table->id();
    $table->foreignId('partner_id')->constrained()->cascadeOnDelete();
    $table->json('item_list');                    // [{name, quantity}]
    $table->unsignedInteger('total_amount_jpy');
    $table->enum('status', ['pending', 'shipped', 'delivered'])->default('pending');
    $table->string('receipt_photo_url')->nullable();
    $table->dateTime('delivered_at')->nullable();
    $table->timestamps();
});
```

- [ ] **Step 4: coupons マイグレーション編集**

```php
Schema::create('coupons', function (Blueprint $table) {
    $table->id();
    $table->foreignId('school_id')->constrained()->cascadeOnDelete();
    $table->unsignedInteger('discount_pct');
    $table->string('reason');
    $table->dateTime('used_at')->nullable();
    $table->dateTime('expires_at');
    $table->timestamps();
});
```

- [ ] **Step 5: Session / SupportRequest / Coupon モデルのfillable定義**

`app/Models/Session.php`:
```php
protected $fillable = [
    'school_id', 'partner_id', 'scheduled_at', 'duration_min',
    'theme', 'question_list', 'status', 'price_jpy', 'support_amount',
    'stripe_payment_id', 'rating_score', 'rating_comment',
    'question_list_sent_at', 'ready_checked_at', 'cancelled_at',
];
protected $casts = ['scheduled_at' => 'datetime'];
```

`app/Models/SupportRequest.php`:
```php
protected $fillable = [
    'partner_id', 'item_list', 'total_amount_jpy',
    'status', 'receipt_photo_url', 'delivered_at',
];
protected $casts = ['item_list' => 'array'];
```

`app/Models/Coupon.php`:
```php
protected $fillable = [
    'school_id', 'discount_pct', 'reason', 'used_at', 'expires_at',
];
protected $casts = [
    'used_at'    => 'datetime',
    'expires_at' => 'datetime',
];
```

- [ ] **Step 6: マイグレーション実行**

```bash
docker compose exec app php artisan migrate
```

Expected: 全テーブルが `Migrated` と表示される

- [ ] **Step 7: コミット**

```bash
git add database/migrations/ app/Models/
git commit -m "feat(db): add all migrations and Eloquent models"
```

---

## Task 5: クリーンアーキテクチャ骨格

**Files:**
- Create: `app/Domain/` 以下（Entity / ValueObject / Repository Interface）
- Create: `app/UseCases/Auth/` 以下
- Create: `app/Infrastructure/Repositories/` 以下
- Modify: `app/Providers/AppServiceProvider.php`

### 5-1: Domain Layer

- [ ] **Step 1: ValueObject — `app/Domain/ValueObjects/PartnerStatus.php`**

```php
<?php

namespace App\Domain\ValueObjects;

enum PartnerStatus: string
{
    case Pending   = 'pending';
    case Approved  = 'approved';
    case Suspended = 'suspended';
    case Rejected  = 'rejected';
}
```

- [ ] **Step 2: Repository Interface — `app/Domain/Repositories/SchoolRepositoryInterface.php`**

```php
<?php

namespace App\Domain\Repositories;

use App\Models\School;

interface SchoolRepositoryInterface
{
    public function create(array $attributes): School;
}
```

- [ ] **Step 3: Repository Interface — `app/Domain/Repositories/PartnerRepositoryInterface.php`**

```php
<?php

namespace App\Domain\Repositories;

use App\Models\Partner;

interface PartnerRepositoryInterface
{
    public function create(array $attributes): Partner;
}
```

### 5-2: UseCase Layer — RegisterSchool

- [ ] **Step 4: `app/UseCases/Auth/RegisterSchoolInput.php`**

```php
<?php

namespace App\UseCases\Auth;

readonly class RegisterSchoolInput
{
    public function __construct(
        public string $email,
        public string $password,
        public string $name,
        public string $type,
        public string $prefecture,
        public string $contactName,
        public string $gradeRange,
    ) {}
}
```

- [ ] **Step 5: `app/UseCases/Auth/RegisterSchoolOutput.php`**

```php
<?php

namespace App\UseCases\Auth;

use App\Models\User;

readonly class RegisterSchoolOutput
{
    public function __construct(
        public User $user,
    ) {}
}
```

- [ ] **Step 6: `app/UseCases/Auth/RegisterSchoolUseCase.php`**

```php
<?php

namespace App\UseCases\Auth;

use App\Domain\Repositories\SchoolRepositoryInterface;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class RegisterSchoolUseCase
{
    public function __construct(
        private SchoolRepositoryInterface $schoolRepository,
    ) {}

    public function execute(RegisterSchoolInput $input): RegisterSchoolOutput
    {
        $user = User::create([
            'name'     => $input->name,
            'email'    => $input->email,
            'password' => Hash::make($input->password),
            'role'     => 'school',
        ]);

        $this->schoolRepository->create([
            'user_id'      => $user->id,
            'name'         => $input->name,
            'type'         => $input->type,
            'prefecture'   => $input->prefecture,
            'contact_name' => $input->contactName,
            'grade_range'  => $input->gradeRange,
        ]);

        return new RegisterSchoolOutput($user);
    }
}
```

### 5-3: UseCase Layer — RegisterPartner

- [ ] **Step 7: `app/UseCases/Auth/RegisterPartnerInput.php`**

```php
<?php

namespace App\UseCases\Auth;

readonly class RegisterPartnerInput
{
    public function __construct(
        public string $email,
        public string $password,
        public string $schoolName,
        public string $country,
        public string $region,
        public string $contactName,
        public array  $themes,
        public string $gradeRange,
    ) {}
}
```

- [ ] **Step 8: `app/UseCases/Auth/RegisterPartnerOutput.php`**

```php
<?php

namespace App\UseCases\Auth;

use App\Models\User;

readonly class RegisterPartnerOutput
{
    public function __construct(
        public User $user,
    ) {}
}
```

- [ ] **Step 9: `app/UseCases/Auth/RegisterPartnerUseCase.php`**

```php
<?php

namespace App\UseCases\Auth;

use App\Domain\Repositories\PartnerRepositoryInterface;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class RegisterPartnerUseCase
{
    public function __construct(
        private PartnerRepositoryInterface $partnerRepository,
    ) {}

    public function execute(RegisterPartnerInput $input): RegisterPartnerOutput
    {
        $user = User::create([
            'name'     => $input->contactName,
            'email'    => $input->email,
            'password' => Hash::make($input->password),
            'role'     => 'partner',
        ]);

        $this->partnerRepository->create([
            'user_id'      => $user->id,
            'school_name'  => $input->schoolName,
            'country'      => $input->country,
            'region'       => $input->region,
            'contact_name' => $input->contactName,
            'themes'       => $input->themes,
            'grade_range'  => $input->gradeRange,
            'status'       => 'pending',
        ]);

        return new RegisterPartnerOutput($user);
    }
}
```

### 5-4: Infrastructure Layer（Eloquentリポジトリ実装）

- [ ] **Step 10: `app/Infrastructure/Repositories/EloquentSchoolRepository.php`**

```php
<?php

namespace App\Infrastructure\Repositories;

use App\Domain\Repositories\SchoolRepositoryInterface;
use App\Models\School;

class EloquentSchoolRepository implements SchoolRepositoryInterface
{
    public function create(array $attributes): School
    {
        return School::create($attributes);
    }
}
```

- [ ] **Step 11: `app/Infrastructure/Repositories/EloquentPartnerRepository.php`**

```php
<?php

namespace App\Infrastructure\Repositories;

use App\Domain\Repositories\PartnerRepositoryInterface;
use App\Models\Partner;

class EloquentPartnerRepository implements PartnerRepositoryInterface
{
    public function create(array $attributes): Partner
    {
        return Partner::create($attributes);
    }
}
```

### 5-5: DIバインディング

- [ ] **Step 12: `app/Providers/AppServiceProvider.php` にバインディング追加**

```php
<?php

namespace App\Providers;

use App\Domain\Repositories\SchoolRepositoryInterface;
use App\Domain\Repositories\PartnerRepositoryInterface;
use App\Infrastructure\Repositories\EloquentSchoolRepository;
use App\Infrastructure\Repositories\EloquentPartnerRepository;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            SchoolRepositoryInterface::class,
            EloquentSchoolRepository::class,
        );

        $this->app->bind(
            PartnerRepositoryInterface::class,
            EloquentPartnerRepository::class,
        );
    }
}
```

- [ ] **Step 13: コミット**

```bash
git add app/Domain/ app/UseCases/ app/Infrastructure/ app/Providers/
git commit -m "feat(arch): add clean architecture skeleton (Domain/UseCase/Infrastructure)"
```

---

## Task 6: TDD — UseCaseユニットテスト

**TDDサイクル：🔴 Red → 🟢 Green → 🔵 Refactor**

**Files:**
- Create: `tests/Unit/UseCases/RegisterSchoolUseCaseTest.php`
- Create: `tests/Unit/UseCases/RegisterPartnerUseCaseTest.php`

- [ ] **Step 1: `tests/Unit/UseCases/RegisterSchoolUseCaseTest.php` を作成（🔴 先にテストを書く）**

```php
<?php

use App\Domain\Repositories\SchoolRepositoryInterface;
use App\Models\School;
use App\Models\User;
use App\UseCases\Auth\RegisterSchoolInput;
use App\UseCases\Auth\RegisterSchoolUseCase;

it('学校ユーザーを登録してschoolロールが付与される', function () {
    // Arrange: リポジトリをモック
    $schoolRepo = Mockery::mock(SchoolRepositoryInterface::class);
    $schoolRepo->shouldReceive('create')
        ->once()
        ->with(Mockery::on(fn($attrs) =>
            $attrs['name'] === 'テスト小学校' &&
            $attrs['prefecture'] === '東京都'
        ))
        ->andReturn(new School(['name' => 'テスト小学校']));

    $useCase = new RegisterSchoolUseCase($schoolRepo);

    $input = new RegisterSchoolInput(
        email:       'school@example.com',
        password:    'password123',
        name:        'テスト小学校',
        type:        '学校',
        prefecture:  '東京都',
        contactName: '田中太郎',
        gradeRange:  '小4-小6',
    );

    // Act
    $output = $useCase->execute($input);

    // Assert
    expect($output->user->role)->toBe('school');
    expect($output->user->email)->toBe('school@example.com');
});
```

- [ ] **Step 2: `tests/Unit/UseCases/RegisterPartnerUseCaseTest.php` を作成（🔴）**

```php
<?php

use App\Domain\Repositories\PartnerRepositoryInterface;
use App\Models\Partner;
use App\UseCases\Auth\RegisterPartnerInput;
use App\UseCases\Auth\RegisterPartnerUseCase;

it('海外校ユーザーをpendingステータスで登録する', function () {
    $partnerRepo = Mockery::mock(PartnerRepositoryInterface::class);
    $partnerRepo->shouldReceive('create')
        ->once()
        ->with(Mockery::on(fn($attrs) =>
            $attrs['status'] === 'pending' &&
            $attrs['school_name'] === 'Sunshine Elementary'
        ))
        ->andReturn(new Partner(['school_name' => 'Sunshine Elementary']));

    $useCase = new RegisterPartnerUseCase($partnerRepo);

    $input = new RegisterPartnerInput(
        email:       'partner@example.com',
        password:    'password123',
        schoolName:  'Sunshine Elementary',
        country:     'Philippines',
        region:      'Manila',
        contactName: 'Maria Santos',
        themes:      ['文化紹介', 'SDGs'],
        gradeRange:  'Grade 4-6',
    );

    $output = $useCase->execute($input);

    expect($output->user->role)->toBe('partner');
});
```

- [ ] **Step 3: テスト実行（🔴 Red確認）**

```bash
docker compose exec app php artisan test tests/Unit/
```

Expected: テストが失敗する（UseCaseがまだ不完全 or DBがない）

- [ ] **Step 4: テストが通ることを確認（🟢 Green）**

```bash
docker compose exec app php artisan test tests/Unit/
```

Expected: `PASS  Tests\Unit\UseCases\...` × 2

- [ ] **Step 5: コミット**

```bash
git add tests/Unit/
git commit -m "test(usecase): add RegisterSchool and RegisterPartner unit tests (TDD)"
```

---

## Task 7: ロール保護ミドルウェア

**Files:**
- Create: `app/Http/Middleware/EnsureRole.php`
- Modify: `bootstrap/app.php`
- Modify: `routes/web.php`
- Create: `app/Http/Controllers/DashboardController.php`

- [ ] **Step 1: ミドルウェア作成**

```bash
docker compose exec app php artisan make:middleware EnsureRole
```

- [ ] **Step 2: `app/Http/Middleware/EnsureRole.php` を編集**

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): mixed
    {
        if (!Auth::check()) {
            return redirect()->route('login');
        }

        if (!in_array(Auth::user()->role, $roles)) {
            abort(403, 'このページへのアクセス権限がありません。');
        }

        return $next($request);
    }
}
```

- [ ] **Step 3: `bootstrap/app.php` にミドルウェア登録**

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'role' => \App\Http\Middleware\EnsureRole::class,
    ]);
})
```

- [ ] **Step 4: `routes/web.php` でロール別ルート定義**

```php
<?php

use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn() => redirect()->route('login'));

Route::middleware(['auth', 'role:school'])->prefix('school')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'school'])->name('school.dashboard');
});

Route::middleware(['auth', 'role:partner'])->prefix('partner')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'partner'])->name('partner.dashboard');
});

require __DIR__.'/auth.php';
```

- [ ] **Step 5: `app/Http/Controllers/DashboardController.php` 作成**

```bash
docker compose exec app php artisan make:controller DashboardController
```

```php
<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function school(): Response
    {
        return Inertia::render('Dashboard/School');
    }

    public function partner(): Response
    {
        return Inertia::render('Dashboard/Partner');
    }
}
```

- [ ] **Step 6: コミット**

```bash
git add app/Http/Middleware/ bootstrap/app.php routes/web.php app/Http/Controllers/DashboardController.php
git commit -m "feat(auth): add role-based middleware and dashboard routes"
```

---

## Task 8: 登録フォーム（Controller → UseCase呼び出し）

**Files:**
- Create: `app/Http/Requests/RegisterSchoolRequest.php`
- Create: `app/Http/Requests/RegisterPartnerRequest.php`
- Modify: `app/Http/Controllers/Auth/RegisteredUserController.php`
- Modify: `routes/auth.php`
- Create: `resources/js/Pages/Auth/RegisterSchool.tsx`
- Create: `resources/js/Pages/Auth/RegisterPartner.tsx`

- [ ] **Step 1: FormRequest作成**

```bash
docker compose exec app php artisan make:request RegisterSchoolRequest
docker compose exec app php artisan make:request RegisterPartnerRequest
```

- [ ] **Step 2: `app/Http/Requests/RegisterSchoolRequest.php` 編集**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules;

class RegisterSchoolRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'email'        => ['required', 'email', 'unique:users'],
            'password'     => ['required', 'confirmed', Rules\Password::defaults()],
            'name'         => ['required', 'string', 'max:255'],
            'type'         => ['required', 'in:学校,公民館,図書館,その他'],
            'prefecture'   => ['required', 'string', 'max:10'],
            'contact_name' => ['required', 'string', 'max:255'],
            'grade_range'  => ['required', 'string', 'max:50'],
        ];
    }
}
```

- [ ] **Step 3: `app/Http/Requests/RegisterPartnerRequest.php` 編集**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules;

class RegisterPartnerRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'email'        => ['required', 'email', 'unique:users'],
            'password'     => ['required', 'confirmed', Rules\Password::defaults()],
            'school_name'  => ['required', 'string', 'max:255'],
            'country'      => ['required', 'string', 'max:100'],
            'region'       => ['required', 'string', 'max:100'],
            'contact_name' => ['required', 'string', 'max:255'],
            'themes'       => ['required', 'array', 'min:1'],
            'themes.*'     => ['in:文化紹介,SDGs,英語教育'],
            'grade_range'  => ['required', 'string', 'max:50'],
        ];
    }
}
```

- [ ] **Step 4: `RegisteredUserController.php` をUseCase呼び出しに書き直す**

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterSchoolRequest;
use App\Http\Requests\RegisterPartnerRequest;
use App\UseCases\Auth\RegisterSchoolInput;
use App\UseCases\Auth\RegisterSchoolUseCase;
use App\UseCases\Auth\RegisterPartnerInput;
use App\UseCases\Auth\RegisterPartnerUseCase;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    public function __construct(
        private RegisterSchoolUseCase  $registerSchoolUseCase,
        private RegisterPartnerUseCase $registerPartnerUseCase,
    ) {}

    public function createSchool(): Response
    {
        return Inertia::render('Auth/RegisterSchool');
    }

    public function createPartner(): Response
    {
        return Inertia::render('Auth/RegisterPartner');
    }

    public function storeSchool(RegisterSchoolRequest $request): RedirectResponse
    {
        $input = new RegisterSchoolInput(
            email:       $request->email,
            password:    $request->password,
            name:        $request->name,
            type:        $request->type,
            prefecture:  $request->prefecture,
            contactName: $request->contact_name,
            gradeRange:  $request->grade_range,
        );

        $output = $this->registerSchoolUseCase->execute($input);

        event(new Registered($output->user));
        Auth::login($output->user);

        return redirect()->route('school.dashboard');
    }

    public function storePartner(RegisterPartnerRequest $request): RedirectResponse
    {
        $input = new RegisterPartnerInput(
            email:       $request->email,
            password:    $request->password,
            schoolName:  $request->school_name,
            country:     $request->country,
            region:      $request->region,
            contactName: $request->contact_name,
            themes:      $request->themes,
            gradeRange:  $request->grade_range,
        );

        $output = $this->registerPartnerUseCase->execute($input);

        event(new Registered($output->user));
        Auth::login($output->user);

        return redirect()->route('partner.dashboard');
    }
}
```

- [ ] **Step 5: `routes/auth.php` に登録ルート追加**

```php
use App\Http\Controllers\Auth\RegisteredUserController;

Route::middleware('guest')->group(function () {
    Route::get('register/school', [RegisteredUserController::class, 'createSchool'])
         ->name('register.school');
    Route::post('register/school', [RegisteredUserController::class, 'storeSchool']);

    Route::get('register/partner', [RegisteredUserController::class, 'createPartner'])
         ->name('register.partner');
    Route::post('register/partner', [RegisteredUserController::class, 'storePartner']);
});
```

- [ ] **Step 6: `resources/js/Pages/Auth/RegisterSchool.tsx` を作成**

```tsx
import { useForm } from '@inertiajs/react'

export default function RegisterSchool() {
  const { data, setData, post, processing, errors } = useForm({
    email: '',
    password: '',
    password_confirmation: '',
    name: '',
    type: '学校',
    prefecture: '',
    contact_name: '',
    grade_range: '',
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    post('/register/school')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-6">日本校 新規登録</h1>
        <form onSubmit={submit} className="space-y-4">
          {[
            { label: '学校名', field: 'name', type: 'text' },
            { label: '都道府県', field: 'prefecture', type: 'text' },
            { label: '担当者名', field: 'contact_name', type: 'text' },
            { label: '対象学年（例: 小4〜小6）', field: 'grade_range', type: 'text' },
            { label: 'メールアドレス', field: 'email', type: 'email' },
            { label: 'パスワード', field: 'password', type: 'password' },
            { label: 'パスワード確認', field: 'password_confirmation', type: 'password' },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                type={type}
                value={(data as any)[field]}
                onChange={e => setData(field as any, e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
              {(errors as any)[field] && (
                <p className="text-red-500 text-sm mt-1">{(errors as any)[field]}</p>
              )}
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium mb-1">種別</label>
            <select
              value={data.type}
              onChange={e => setData('type', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              {['学校', '公民館', '図書館', 'その他'].map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={processing}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            登録する
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: `resources/js/Pages/Auth/RegisterPartner.tsx` を作成**

```tsx
import { useForm } from '@inertiajs/react'

const THEMES = ['文化紹介', 'SDGs', '英語教育'] as const

export default function RegisterPartner() {
  const { data, setData, post, processing, errors } = useForm({
    email: '',
    password: '',
    password_confirmation: '',
    school_name: '',
    country: '',
    region: '',
    contact_name: '',
    themes: [] as string[],
    grade_range: '',
  })

  const toggleTheme = (theme: string) => {
    setData('themes', data.themes.includes(theme)
      ? data.themes.filter(t => t !== theme)
      : [...data.themes, theme]
    )
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    post('/register/partner')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-6">Partner School Registration</h1>
        <form onSubmit={submit} className="space-y-4">
          {[
            { label: 'School Name', field: 'school_name', type: 'text' },
            { label: 'Country', field: 'country', type: 'text' },
            { label: 'Region', field: 'region', type: 'text' },
            { label: 'Teacher Name', field: 'contact_name', type: 'text' },
            { label: 'Grade Range (e.g. Grade 4-6)', field: 'grade_range', type: 'text' },
            { label: 'Email', field: 'email', type: 'email' },
            { label: 'Password', field: 'password', type: 'password' },
            { label: 'Confirm Password', field: 'password_confirmation', type: 'password' },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                type={type}
                value={(data as any)[field]}
                onChange={e => setData(field as any, e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
              {(errors as any)[field] && (
                <p className="text-red-500 text-sm mt-1">{(errors as any)[field]}</p>
              )}
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium mb-1">Themes</label>
            <div className="flex gap-2 flex-wrap">
              {THEMES.map(theme => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => toggleTheme(theme)}
                  className={`px-3 py-1 rounded-full border text-sm ${
                    data.themes.includes(theme)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
            {errors.themes && <p className="text-red-500 text-sm mt-1">{errors.themes}</p>}
          </div>

          <button
            type="submit"
            disabled={processing}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Register
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: フロントをビルド**

```bash
docker compose exec app npm run build
```

- [ ] **Step 9: コミット**

```bash
git add .
git commit -m "feat(auth): add registration controllers using UseCase pattern with FormRequests"
```

---

## Task 9: Feature Test — 登録フロー

- [ ] **Step 1: `tests/Feature/Auth/RegisterSchoolTest.php` を作成（🔴）**

```php
<?php

use App\Models\User;
use App\Models\School;

it('日本校ユーザーが登録できる', function () {
    $response = $this->post('/register/school', [
        'email'                 => 'school@example.com',
        'password'              => 'Password123!',
        'password_confirmation' => 'Password123!',
        'name'                  => 'テスト小学校',
        'type'                  => '学校',
        'prefecture'            => '東京都',
        'contact_name'          => '田中太郎',
        'grade_range'           => '小4-小6',
    ]);

    $response->assertRedirect('/school/dashboard');

    $user = User::where('email', 'school@example.com')->first();
    expect($user)->not->toBeNull();
    expect($user->role)->toBe('school');
    expect(School::where('user_id', $user->id)->exists())->toBeTrue();
});

it('重複メールで登録するとバリデーションエラー', function () {
    User::factory()->create(['email' => 'dup@example.com']);

    $response = $this->post('/register/school', [
        'email'                 => 'dup@example.com',
        'password'              => 'Password123!',
        'password_confirmation' => 'Password123!',
        'name'                  => 'テスト校',
        'type'                  => '学校',
        'prefecture'            => '東京都',
        'contact_name'          => '山田',
        'grade_range'           => '小1-小3',
    ]);

    $response->assertSessionHasErrors('email');
});
```

- [ ] **Step 2: `tests/Feature/Auth/RegisterPartnerTest.php` を作成（🔴）**

```php
<?php

use App\Models\User;
use App\Models\Partner;

it('海外校ユーザーがpendingステータスで登録される', function () {
    $response = $this->post('/register/partner', [
        'email'                 => 'partner@example.com',
        'password'              => 'Password123!',
        'password_confirmation' => 'Password123!',
        'school_name'           => 'Sunshine Elementary',
        'country'               => 'Philippines',
        'region'                => 'Manila',
        'contact_name'          => 'Maria Santos',
        'themes'                => ['文化紹介', 'SDGs'],
        'grade_range'           => 'Grade 4-6',
    ]);

    $response->assertRedirect('/partner/dashboard');

    $user = User::where('email', 'partner@example.com')->first();
    expect($user->role)->toBe('partner');

    $partner = Partner::where('user_id', $user->id)->first();
    expect($partner->status)->toBe('pending');
    expect($partner->themes)->toContain('文化紹介');
});
```

- [ ] **Step 3: テスト実行（🟢 Green確認）**

```bash
docker compose exec app php artisan test tests/Feature/Auth/
```

Expected: `PASS` × 3（school登録・重複エラー・partner登録）

- [ ] **Step 4: コミット**

```bash
git add tests/Feature/
git commit -m "test(feature): add school and partner registration feature tests (TDD)"
```

---

## Task 10: 管理者シードデータ

**Files:**
- Create: `database/seeders/AdminUserSeeder.php`

- [ ] **Step 1: Seeder作成**

```bash
docker compose exec app php artisan make:seeder AdminUserSeeder
```

- [ ] **Step 2: `database/seeders/AdminUserSeeder.php` を編集**

```php
<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@worldclass.jp'],
            [
                'name'     => 'WorldClass Admin',
                'email'    => 'admin@worldclass.jp',
                'password' => Hash::make('admin123456'),
                'role'     => 'admin',
            ]
        );

        $this->command->info('✅ Admin user: admin@worldclass.jp / admin123456');
    }
}
```

- [ ] **Step 3: `database/seeders/DatabaseSeeder.php` に追記**

```php
public function run(): void
{
    $this->call([AdminUserSeeder::class]);
}
```

- [ ] **Step 4: Seeder実行**

```bash
docker compose exec app php artisan db:seed
```

Expected: `✅ Admin user: admin@worldclass.jp / admin123456`

- [ ] **Step 5: コミット**

```bash
git add database/seeders/
git commit -m "feat(db): add admin user seeder"
```

---

## Task 11: Filament海外校審査リソース

**Files:**
- Create: `app/Filament/Resources/PartnerResource.php`

- [ ] **Step 1: Filamentリソース作成**

```bash
docker compose exec app php artisan make:filament-resource Partner --generate
```

- [ ] **Step 2: `app/Filament/Resources/PartnerResource.php` を編集**

```php
<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PartnerResource\Pages;
use App\Models\Partner;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class PartnerResource extends Resource
{
    protected static ?string $model = Partner::class;
    protected static ?string $navigationIcon = 'heroicon-o-building-library';
    protected static ?string $navigationLabel = '海外校管理';

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('school_name')->label('学校名')->required(),
            Forms\Components\TextInput::make('country')->label('国')->required(),
            Forms\Components\TextInput::make('region')->label('地域')->required(),
            Forms\Components\TextInput::make('contact_name')->label('担当教師名')->required(),
            Forms\Components\TextInput::make('video_url')->label('VTR URL')->url(),
            Forms\Components\Select::make('status')
                ->label('審査ステータス')
                ->options([
                    'pending'   => '審査中',
                    'approved'  => '承認',
                    'suspended' => '停止',
                    'rejected'  => '不承認',
                ])
                ->required(),
            Forms\Components\CheckboxList::make('themes')
                ->label('対応テーマ')
                ->options([
                    '文化紹介' => '文化紹介',
                    'SDGs'    => 'SDGs',
                    '英語教育' => '英語教育',
                ]),
            Forms\Components\TextInput::make('grade_range')->label('対象学年')->required(),
            Forms\Components\TextInput::make('support_pool')
                ->label('物資支援プール（円）')
                ->numeric()
                ->disabled(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('school_name')->label('学校名')->searchable(),
                Tables\Columns\TextColumn::make('country')->label('国'),
                Tables\Columns\BadgeColumn::make('status')
                    ->label('ステータス')
                    ->colors([
                        'warning' => 'pending',
                        'success' => 'approved',
                        'danger'  => fn ($state) => in_array($state, ['suspended', 'rejected']),
                    ]),
                Tables\Columns\TextColumn::make('rating_score')->label('★'),
                Tables\Columns\TextColumn::make('penalty_count')->label('ペナルティ'),
                Tables\Columns\TextColumn::make('support_pool')->label('プール（円）'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'pending'   => '審査中',
                        'approved'  => '承認済み',
                        'suspended' => '停止',
                        'rejected'  => '不承認',
                    ]),
            ])
            ->actions([Tables\Actions\EditAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListPartners::route('/'),
            'create' => Pages\CreatePartner::route('/create'),
            'edit'   => Pages\EditPartner::route('/{record}/edit'),
        ];
    }
}
```

- [ ] **Step 3: 動作確認**

`http://localhost/admin` → `admin@worldclass.jp / admin123456` でログイン  
`http://localhost/admin/partners` → 海外校一覧表示・ステータス変更できる

- [ ] **Step 4: コミット**

```bash
git add app/Filament/
git commit -m "feat(admin): add Filament partner review resource"
```

---

## セルフレビュー

**スペックカバレッジ:**
- ✅ カスタム Docker Compose（PHP 8.3 / Nginx / PostgreSQL 16 / Redis 7）
- ✅ GitHub Actions CI（テスト + Pint）
- ✅ クリーンアーキテクチャ骨格（Domain / UseCase / Infrastructure）
- ✅ DIバインディング（AppServiceProvider）
- ✅ TDD（Unit: UseCase、Feature: 登録フロー）
- ✅ 3ロール認証（school / partner / admin）
- ✅ FormRequest バリデーション（SchoolRequest / PartnerRequest）
- ✅ Controller → UseCase → Repository の呼び出しチェーン
- ✅ 全DBスキーマ（sessions / support_requests / coupons 含む）
- ✅ Filament管理画面（海外校審査）
- ✅ Conventional Commits（全コミット）
- ⏭️ カタログ・予約 → Plan 2
- ⏭️ Stripe決済 → Plan 2
- ⏭️ 準備フロー・通知 → Plan 3
- ⏭️ 物資支援管理 → Plan 4
- ⏭️ 自治体ダッシュボード → Plan 5

**タスク実行順序:**
```
Task 0（Docker）→ Task 1（Laravel）→ Task 2（Filament）
→ Task 3（CI）→ Task 4（DB）→ Task 5（Clean Architecture骨格）
→ Task 6（Unit Test）→ Task 7（Middleware）→ Task 8（Controller/UseCase）
→ Task 9（Feature Test）→ Task 10（Seeder）→ Task 11（Filament Resource）
```
