# WorldClass Phase 1: Foundation & Auth Implementation Plan (Laravel)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Laravel 11 + Inertia.js + React + Filamentで基盤を構築し、3ロール（日本校・海外校・管理者）の認証とDBマイグレーションを完成させる。

**Architecture:** Laravelモノリス。フロントはInertia.js + React（SPA的UX、API不要）。管理画面はFilament v3で別パネル。認証はLaravel Breezeベースにロール制御を追加。

**Tech Stack:** Laravel 11, Inertia.js, React, Filament v3, PostgreSQL, AWS Lightsail, AWS S3

---

## ファイル構成

```
worldclass/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Auth/
│   │   │   │   └── RegisteredUserController.php  # 登録処理（ロール分岐）
│   │   │   └── DashboardController.php
│   │   └── Middleware/
│   │       └── EnsureRole.php                    # ロール保護
│   ├── Models/
│   │   ├── User.php
│   │   ├── School.php
│   │   └── Partner.php
│   └── Filament/
│       └── Resources/
│           ├── PartnerResource.php               # 海外校審査
│           └── UserResource.php
├── database/
│   ├── migrations/
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
└── routes/
    └── web.php
```

---

## Task 1: Laravelプロジェクト作成

**Files:**
- Create: プロジェクトルート一式

- [ ] **Step 1: Laravelプロジェクト作成**

```bash
composer create-project laravel/laravel worldclass
cd worldclass
```

- [ ] **Step 2: PostgreSQL設定（`.env`）**

`.env` を以下に変更：

```
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=worldclass
DB_USERNAME=postgres
DB_PASSWORD=your_password
```

- [ ] **Step 3: PostgreSQL DB作成**

```bash
psql -U postgres -c "CREATE DATABASE worldclass;"
```

- [ ] **Step 4: Inertia.js + React インストール**

```bash
composer require inertiajs/inertia-laravel
npm install @inertiajs/react react react-dom
npm install -D @types/react @types/react-dom typescript
```

- [ ] **Step 5: Laravel Breeze（Inertia + React）インストール**

```bash
composer require laravel/breeze --dev
php artisan breeze:install react
npm install
npm run build
```

- [ ] **Step 6: 動作確認**

```bash
php artisan serve
```

Expected: `http://127.0.0.1:8000` でLaravelデフォルト画面が表示される

- [ ] **Step 7: コミット**

```bash
git init
git add .
git commit -m "feat: initialize Laravel + Inertia.js + React project"
```

---

## Task 2: Filament v3インストール（管理画面）

**Files:**
- Modify: `app/Models/User.php`

- [ ] **Step 1: Filamentインストール**

```bash
composer require filament/filament:"^3.2" -W
php artisan filament:install --panels
```

対話式で以下を入力：
- Panel ID: `admin`
- Panel path: `admin`

- [ ] **Step 2: `app/Models/User.php` にFilamentインターフェース追加**

既存の `User.php` の `implements` と `use` に追加：

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

    // ADMINロールのみFilamentパネルにアクセス可
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

```bash
php artisan serve
```

`http://127.0.0.1:8000/admin` にアクセス → Filamentログイン画面が表示される

- [ ] **Step 4: コミット**

```bash
git add .
git commit -m "feat: install Filament v3 admin panel"
```

---

## Task 3: usersテーブルにroleカラム追加

**Files:**
- Create: `database/migrations/xxxx_add_role_to_users_table.php`

- [ ] **Step 1: マイグレーション作成**

```bash
php artisan make:migration add_role_to_users_table --table=users
```

- [ ] **Step 2: 生成されたマイグレーションファイルを以下に編集**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
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
};
```

- [ ] **Step 3: マイグレーション実行**

```bash
php artisan migrate
```

Expected: `Migrated: xxxx_add_role_to_users_table`

- [ ] **Step 4: コミット**

```bash
git add database/migrations/
git commit -m "feat: add role column to users table"
```

---

## Task 4: schoolsテーブル・Schoolモデル

**Files:**
- Create: `database/migrations/xxxx_create_schools_table.php`
- Create: `app/Models/School.php`

- [ ] **Step 1: マイグレーション・モデル作成**

```bash
php artisan make:model School -m
```

- [ ] **Step 2: マイグレーションファイルを編集**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schools', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');                          // 学校名
            $table->string('type');                          // 学校・公民館・図書館・その他
            $table->string('prefecture');                    // 都道府県
            $table->string('contact_name');                  // 担当者名
            $table->string('grade_range');                   // 対象学年（例: "小4-小6"）
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('schools');
    }
};
```

- [ ] **Step 3: `app/Models/School.php` を編集**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class School extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'type',
        'prefecture',
        'contact_name',
        'grade_range',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function sessions()
    {
        return $this->hasMany(Session::class);
    }

    public function coupons()
    {
        return $this->hasMany(Coupon::class);
    }
}
```

- [ ] **Step 4: マイグレーション実行**

```bash
php artisan migrate
```

Expected: `Migrated: xxxx_create_schools_table`

- [ ] **Step 5: コミット**

```bash
git add database/migrations/ app/Models/School.php
git commit -m "feat: add schools table and School model"
```

---

## Task 5: partnersテーブル・Partnerモデル

**Files:**
- Create: `database/migrations/xxxx_create_partners_table.php`
- Create: `app/Models/Partner.php`

- [ ] **Step 1: マイグレーション・モデル作成**

```bash
php artisan make:model Partner -m
```

- [ ] **Step 2: マイグレーションファイルを編集**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('partners', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('school_name');                   // 学校名
            $table->string('country');                       // 国
            $table->string('region');                        // 地域
            $table->string('contact_name');                  // 担当教師名
            $table->string('video_url')->nullable();         // 自己紹介VTR URL
            $table->enum('status', ['pending', 'approved', 'suspended', 'rejected'])
                  ->default('pending');
            $table->decimal('rating_score', 3, 2)->default(0); // ★平均
            $table->unsignedInteger('penalty_count')->default(0);
            $table->unsignedInteger('support_pool')->default(0); // 物資支援プール（円）
            $table->json('themes')->nullable();              // 対応テーマ一覧
            $table->string('grade_range');                   // 対象学年
            $table->json('available_slots')->nullable();     // 空き時間
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partners');
    }
};
```

- [ ] **Step 3: `app/Models/Partner.php` を編集**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Partner extends Model
{
    protected $fillable = [
        'user_id',
        'school_name',
        'country',
        'region',
        'contact_name',
        'video_url',
        'status',
        'rating_score',
        'penalty_count',
        'support_pool',
        'themes',
        'grade_range',
        'available_slots',
    ];

    protected $casts = [
        'themes'          => 'array',
        'available_slots' => 'array',
        'rating_score'    => 'float',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function sessions()
    {
        return $this->hasMany(Session::class);
    }

    public function supportRequests()
    {
        return $this->hasMany(SupportRequest::class);
    }
}
```

- [ ] **Step 4: マイグレーション実行**

```bash
php artisan migrate
```

Expected: `Migrated: xxxx_create_partners_table`

- [ ] **Step 5: コミット**

```bash
git add database/migrations/ app/Models/Partner.php
git commit -m "feat: add partners table and Partner model"
```

---

## Task 6: sessions・support_requests・couponsテーブル

**Files:**
- Create: 3つのマイグレーション
- Create: `app/Models/Session.php`, `app/Models/SupportRequest.php`, `app/Models/Coupon.php`

- [ ] **Step 1: マイグレーション・モデル一括作成**

```bash
php artisan make:model Session -m
php artisan make:model SupportRequest -m
php artisan make:model Coupon -m
```

- [ ] **Step 2: sessions マイグレーション編集**

```php
Schema::create('sessions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('school_id')->constrained()->cascadeOnDelete();
    $table->foreignId('partner_id')->constrained()->cascadeOnDelete();
    $table->dateTime('scheduled_at');
    $table->unsignedInteger('duration_min');               // 45 or 60
    $table->string('theme');
    $table->text('question_list')->nullable();
    $table->enum('status', [
        'pending', 'confirmed', 'checklist_sent',
        'ready', 'completed', 'cancelled'
    ])->default('pending');
    $table->unsignedInteger('price_jpy');
    $table->unsignedInteger('support_amount');             // 物資支援積算額
    $table->string('stripe_payment_id')->nullable();
    $table->unsignedTinyInteger('rating_score')->nullable(); // 1〜5
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
    $table->json('item_list');                             // [{name, quantity}]
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
    $table->unsignedInteger('discount_pct');               // 割引率（例: 10 = 10%オフ）
    $table->string('reason');                              // 発行理由
    $table->dateTime('used_at')->nullable();
    $table->dateTime('expires_at');
    $table->timestamps();
});
```

- [ ] **Step 5: 3モデルのfillable定義**

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
php artisan migrate
```

Expected: 3テーブルが `Migrated` と表示される

- [ ] **Step 7: コミット**

```bash
git add database/migrations/ app/Models/
git commit -m "feat: add sessions, support_requests, coupons tables and models"
```

---

## Task 7: ロール保護ミドルウェア

**Files:**
- Create: `app/Http/Middleware/EnsureRole.php`
- Modify: `bootstrap/app.php`

- [ ] **Step 1: ミドルウェア作成**

```bash
php artisan make:middleware EnsureRole
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

`withMiddleware` ブロック内に追加：

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

// 日本校ダッシュボード
Route::middleware(['auth', 'role:school'])->prefix('school')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'school'])->name('school.dashboard');
});

// 海外校ダッシュボード
Route::middleware(['auth', 'role:partner'])->prefix('partner')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'partner'])->name('partner.dashboard');
});

require __DIR__.'/auth.php';
```

- [ ] **Step 5: `app/Http/Controllers/DashboardController.php` を作成**

```bash
php artisan make:controller DashboardController
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
git commit -m "feat: add role-based middleware and dashboard routes"
```

---

## Task 8: 日本校・海外校の登録フォーム

**Files:**
- Modify: `app/Http/Controllers/Auth/RegisteredUserController.php`
- Create: `resources/js/Pages/Auth/RegisterSchool.tsx`
- Create: `resources/js/Pages/Auth/RegisterPartner.tsx`

- [ ] **Step 1: `RegisteredUserController.php` を編集（store メソッド）**

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    public function createSchool(): Response
    {
        return Inertia::render('Auth/RegisterSchool');
    }

    public function createPartner(): Response
    {
        return Inertia::render('Auth/RegisterPartner');
    }

    public function storeSchool(Request $request): RedirectResponse
    {
        $request->validate([
            'email'        => ['required', 'email', 'unique:users'],
            'password'     => ['required', 'confirmed', Rules\Password::defaults()],
            'name'         => ['required', 'string', 'max:255'],
            'type'         => ['required', 'in:学校,公民館,図書館,その他'],
            'prefecture'   => ['required', 'string', 'max:10'],
            'contact_name' => ['required', 'string', 'max:255'],
            'grade_range'  => ['required', 'string', 'max:50'],
        ]);

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            'role'     => 'school',
        ]);

        $user->school()->create([
            'name'         => $request->name,
            'type'         => $request->type,
            'prefecture'   => $request->prefecture,
            'contact_name' => $request->contact_name,
            'grade_range'  => $request->grade_range,
        ]);

        event(new Registered($user));
        Auth::login($user);

        return redirect()->route('school.dashboard');
    }

    public function storePartner(Request $request): RedirectResponse
    {
        $request->validate([
            'email'        => ['required', 'email', 'unique:users'],
            'password'     => ['required', 'confirmed', Rules\Password::defaults()],
            'school_name'  => ['required', 'string', 'max:255'],
            'country'      => ['required', 'string', 'max:100'],
            'region'       => ['required', 'string', 'max:100'],
            'contact_name' => ['required', 'string', 'max:255'],
            'themes'       => ['required', 'array', 'min:1'],
            'themes.*'     => ['in:文化紹介,SDGs,英語教育'],
            'grade_range'  => ['required', 'string', 'max:50'],
        ]);

        $user = User::create([
            'name'     => $request->contact_name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            'role'     => 'partner',
        ]);

        $user->partner()->create([
            'school_name'  => $request->school_name,
            'country'      => $request->country,
            'region'       => $request->region,
            'contact_name' => $request->contact_name,
            'themes'       => $request->themes,
            'grade_range'  => $request->grade_range,
            'status'       => 'pending',
        ]);

        event(new Registered($user));
        Auth::login($user);

        return redirect()->route('partner.dashboard');
    }
}
```

- [ ] **Step 2: `routes/auth.php` に登録ルート追加**

既存の `auth.php` に追記：

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

- [ ] **Step 3: `resources/js/Pages/Auth/RegisterSchool.tsx` を作成**

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
          <div>
            <label className="block text-sm font-medium mb-1">学校名</label>
            <input
              type="text"
              value={data.name}
              onChange={e => setData('name', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">種別</label>
            <select
              value={data.type}
              onChange={e => setData('type', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              {['学校', '公民館', '図書館', 'その他'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">都道府県</label>
            <input
              type="text"
              value={data.prefecture}
              onChange={e => setData('prefecture', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
            {errors.prefecture && <p className="text-red-500 text-sm mt-1">{errors.prefecture}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">担当者名</label>
            <input
              type="text"
              value={data.contact_name}
              onChange={e => setData('contact_name', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">対象学年（例: 小4〜小6）</label>
            <input
              type="text"
              value={data.grade_range}
              onChange={e => setData('grade_range', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">メールアドレス</label>
            <input
              type="email"
              value={data.email}
              onChange={e => setData('email', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">パスワード</label>
            <input
              type="password"
              value={data.password}
              onChange={e => setData('password', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">パスワード確認</label>
            <input
              type="password"
              value={data.password_confirmation}
              onChange={e => setData('password_confirmation', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
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

- [ ] **Step 4: `resources/js/Pages/Auth/RegisterPartner.tsx` を作成**

```tsx
import { useForm } from '@inertiajs/react'

const THEMES = ['文化紹介', 'SDGs', '英語教育']

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
          <div>
            <label className="block text-sm font-medium mb-1">School Name</label>
            <input
              type="text"
              value={data.school_name}
              onChange={e => setData('school_name', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
            {errors.school_name && <p className="text-red-500 text-sm mt-1">{errors.school_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Country</label>
            <input
              type="text"
              value={data.country}
              onChange={e => setData('country', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Region</label>
            <input
              type="text"
              value={data.region}
              onChange={e => setData('region', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Teacher Name</label>
            <input
              type="text"
              value={data.contact_name}
              onChange={e => setData('contact_name', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Grade Range (e.g. Grade 4-6)</label>
            <input
              type="text"
              value={data.grade_range}
              onChange={e => setData('grade_range', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={data.email}
              onChange={e => setData('email', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={data.password}
              onChange={e => setData('password', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Confirm Password</label>
            <input
              type="password"
              value={data.password_confirmation}
              onChange={e => setData('password_confirmation', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
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

- [ ] **Step 5: フロントをビルド**

```bash
npm run build
```

- [ ] **Step 6: 動作確認（日本校登録）**

```
http://127.0.0.1:8000/register/school
```

フォームに入力して送信 → `/school/dashboard` にリダイレクトされる

- [ ] **Step 7: コミット**

```bash
git add .
git commit -m "feat: add school and partner registration forms with Inertia"
```

---

## Task 9: 管理者シードデータ

**Files:**
- Create: `database/seeders/AdminUserSeeder.php`

- [ ] **Step 1: Seeder作成**

```bash
php artisan make:seeder AdminUserSeeder
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

        $this->command->info('✅ Admin user created: admin@worldclass.jp / admin123456');
    }
}
```

- [ ] **Step 3: `database/seeders/DatabaseSeeder.php` に追記**

```php
public function run(): void
{
    $this->call([
        AdminUserSeeder::class,
    ]);
}
```

- [ ] **Step 4: Seeder実行**

```bash
php artisan db:seed
```

Expected: `✅ Admin user created: admin@worldclass.jp / admin123456`

- [ ] **Step 5: Filament管理画面でログイン確認**

```
http://127.0.0.1:8000/admin
```

`admin@worldclass.jp` / `admin123456` でログイン → Filamentダッシュボードが表示される

- [ ] **Step 6: コミット**

```bash
git add database/seeders/
git commit -m "feat: add admin user seeder"
```

---

## Task 10: Filament海外校審査リソース

**Files:**
- Create: `app/Filament/Resources/PartnerResource.php`

- [ ] **Step 1: Filamentリソース作成**

```bash
php artisan make:filament-resource Partner --generate
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
            ->actions([
                Tables\Actions\EditAction::make(),
            ]);
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

```
http://127.0.0.1:8000/admin/partners
```

Expected: 海外校一覧が表示され、ステータスを `pending` → `approved` に変更できる

- [ ] **Step 4: コミット**

```bash
git add app/Filament/
git commit -m "feat: add Filament partner review resource"
```

---

## セルフレビュー

**スペックカバレッジ:**
- ✅ 3ロール認証（school / partner / admin）
- ✅ 日本校登録（学校情報・担当者・学年）
- ✅ 海外校登録（PENDING → 管理者審査）
- ✅ 全DBスキーマ（sessions・support_requests・coupons含む）
- ✅ ロール別ルート保護
- ✅ Filament管理画面（海外校審査）
- ⏭️ カタログ・予約 → Plan 2
- ⏭️ 決済（Stripe） → Plan 2
- ⏭️ 準備フロー・通知 → Plan 3
- ⏭️ 物資支援管理 → Plan 4
- ⏭️ 自治体ダッシュボード → Plan 5

**プレースホルダー:** なし

**型一貫性:** Eloquentリレーション（`hasOne` / `hasMany` / `belongsTo`）はTask 2〜6で定義済み。RegisteredUserControllerのリレーション呼び出し（`$user->school()->create()`）はTask 4・5と一致。
