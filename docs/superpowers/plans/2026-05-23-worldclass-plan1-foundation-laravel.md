# WorldClass Phase 1: Foundation & Auth Implementation Plan (Laravel)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Laravel 13 + Inertia.js + React + TypeScript + Filament v4 + カスタムDockerで基盤を構築し、3ロール（member・partner・admin）の認証・DBマイグレーション・クリーンアーキテクチャ骨格を完成させる。

**Architecture:** クリーンアーキテクチャ（Domain / UseCase / Infrastructure / Http）。フロントはInertia.js + React + TypeScript。管理画面はFilament v4。

**Tech Stack:** Laravel 13, Inertia.js, React, TypeScript, Filament v4, PostgreSQL 16, Redis 7, Nginx, Docker Compose, PHPUnit（TDD・Laravel 13はPest未対応のためクラス形式）, Larastan level 5, Pint

**DB設計:** → [`../specs/2026-05-29-worldclass-db-design.md`](../specs/2026-05-29-worldclass-db-design.md)（ER図: `2026-05-29-worldclass-db-er.drawio`）
**Engineering Principles:** → [`../specs/2026-05-25-worldclass-engineering-principles.md`](../specs/2026-05-25-worldclass-engineering-principles.md)

> **⚠️ 重要な仕様変更（2026-05-29）:** 旧プランの `schools` / `RegisterSchool*` 命名は廃止。LP仕様に合わせ **日本側利用者 = `members`（type区分）**、**海外側 = `partners`（provider_type区分）**、**予約 = `sessions`（枠）+ `session_participants`（参加グループ）** に再設計済み。本プランは新設計に準拠する。

> **📌 dig確定判断（2026-06-12）:**
> ① 登録UseCaseのトランザクション化＋`user_id` unique制約＋旧`RegistrationTest.php`清算＋pending審査中バナー → **Task 8.5に統合**
> ② `EnsurePartnerApproved` ミドルウェアは Phase 2 冒頭で新設（Phase 1はバナーのみ）
> ③ 日時はUTC保存・閲覧者TZ変換（`partners.timezone` カラムは Phase 2 マイグレーションで追加）
> ④ UIテキストは**全部日本語**（パートナー向け含む。lang分岐なし）
> ⑤ メール検証は Phase 2 前に `MustVerifyEmail` 強制（既存判断メモどおり）
> ⑥ `$table->enum()` → `string`＋backed enum cast → **Task 8.6 新設**
> ⑦ テストコードは PHPUnit クラス形式（Pestは Laravel 13 未対応）

---

## 進捗サマリ

| Task | 内容 | 状態 |
|---|---|---|
| Task 0 | Docker環境構築 | ✅ 完了 |
| Task 1 | Laravel 13 + Inertia + React + Pest | ✅ 完了（Breezeは現状 .jsx。新規ページは .tsx で追加・漸進移行） |
| Task 2 | Filament v4 管理画面 | ✅ 完了（v3はLaravel13非対応のためv4。ext-intl必須でDockerfileに`libicu-dev`+`intl`追加済み） |
| Task 3 | GitHub Actions CI（test + larastan level5 + pint） | ✅ 完了（CI green確認済み） |
| Task 4 | DBマイグレーション（新設計・全7テーブル） | ✅ 完了（全7テーブル、マイグレーション適用済み） |
| Task 5 | クリーンアーキ骨格（Domain/UseCase/Infrastructure） | ✅ 完了（テスト25件pass・Larastan通過） |
| Task 6 | TDD UseCaseユニットテスト | ✅ 完了（65870a8） |
| Task 7 | ロール保護ミドルウェア | ✅ 完了（cfe0a46） |
| Task 8 | 登録フォーム（Controller→UseCase, .tsx・UI全部日本語） | 🔶 途中（FormRequest・Controller・ルート済み: 5f3f612。**RegisterMember.tsx / RegisterPartner.tsx 未作成**） |
| Task 8.5 | 登録まわり修正一括（死にルート・throttle・トランザクション・unique制約・旧テスト清算・審査中バナー） | ⬜ |
| Task 8.6 | enum()→string＋backed enum cast 化 | ⬜ |
| Task 9 | Feature Test（登録フロー・PHPUnit） | ⬜ |
| Task 10 | AdminUserSeeder | ⬜ |
| Task 11 | Filament PartnerResource（審査画面） | ⬜ |

> Task 0〜3 の実装手順は完了済みのため割愛。詳細はgit履歴（`edc1d1c` Filament / `dc477a6`・`544d642` CI）を参照。Task 4-0（SESSION_DRIVER=redis・sessionsテーブル削除）・Task 4-1（usersにrole追加・PostgreSQL切替）完了（2026-06-06）。

---

## ファイル構成（Phase 1完了時点・新設計）

```
worldclass/
├── app/
│   ├── Domain/
│   │   ├── ValueObjects/
│   │   │   ├── MemberType.php         # enum: family/cram_school/circle/public_facility/other
│   │   │   ├── ProviderType.php       # enum: overseas_school/local_japanese
│   │   │   ├── PartnerStatus.php      # enum: pending/approved/suspended/rejected
│   │   │   └── ThemeType.php          # enum: culture/english/global
│   │   └── Repositories/              # インターフェース
│   │       ├── MemberRepositoryInterface.php
│   │       └── PartnerRepositoryInterface.php
│   ├── UseCases/
│   │   └── Auth/
│   │       ├── RegisterMemberInput.php
│   │       ├── RegisterMemberOutput.php
│   │       ├── RegisterMemberUseCase.php
│   │       ├── RegisterPartnerInput.php
│   │       ├── RegisterPartnerOutput.php
│   │       └── RegisterPartnerUseCase.php
│   ├── Infrastructure/
│   │   └── Repositories/
│   │       ├── EloquentMemberRepository.php
│   │       └── EloquentPartnerRepository.php
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Auth/RegisteredUserController.php
│   │   │   └── DashboardController.php
│   │   ├── Requests/
│   │   │   ├── RegisterMemberRequest.php
│   │   │   └── RegisterPartnerRequest.php
│   │   └── Middleware/EnsureRole.php
│   ├── Models/                        # Eloquentモデル（インフラ層）
│   │   ├── User.php                   # role追加済み（member/partner/admin）
│   │   ├── Member.php
│   │   ├── Partner.php
│   │   ├── Session.php
│   │   ├── SessionParticipant.php
│   │   ├── SupportRequest.php
│   │   └── Coupon.php
│   ├── Filament/Resources/PartnerResource.php
│   └── Providers/AppServiceProvider.php   # DIバインディング
├── database/
│   ├── migrations/
│   │   ├── xxxx_add_role_to_users_table.php
│   │   ├── xxxx_create_members_table.php
│   │   ├── xxxx_create_partners_table.php
│   │   ├── xxxx_create_sessions_table.php
│   │   ├── xxxx_create_session_participants_table.php
│   │   ├── xxxx_create_support_requests_table.php
│   │   └── xxxx_create_coupons_table.php
│   └── seeders/AdminUserSeeder.php
├── resources/js/Pages/
│   ├── Auth/RegisterMember.tsx
│   ├── Auth/RegisterPartner.tsx
│   └── Dashboard/{Member,Partner}.tsx
└── tests/
    ├── Unit/UseCases/
    │   ├── RegisterMemberUseCaseTest.php
    │   └── RegisterPartnerUseCaseTest.php
    └── Feature/Auth/
        ├── RegisterMemberTest.php
        └── RegisterPartnerTest.php
```

> ⚠️ Laravelの予約名衝突に注意: `app/Models/Session.php` は Eloquentモデルだが、`Illuminate\Support\Facades\Session` と名前が衝突する。モデル内・利用側では完全修飾 or エイリアスに注意（マイグレーションのテーブル名は `sessions` だが、Laravelデフォルトの `sessions` セッションテーブルは本プロジェクトでは未使用＝セッションドライバはRedis/databaseのうちRedis想定。衝突回避のため後述）。

---

## Task 4: DBマイグレーション（新設計・全7テーブル）

**Files:**
- Create: 8マイグレーション（role追加 + 7テーブル）
- Create/Modify: `app/Models/` 各モデル

> **前提:** Docker起動中であること。未起動なら `DOCKER_BUILDKIT=0 docker compose up -d`。

### 4-0: usersのセッションテーブル名衝突を回避

`app/Models/Session.php`（交流セッション）と、Laravelの認証セッション格納テーブル `sessions` が衝突する。本プロジェクトはセッションドライバに `database` を使わない（`.env` の `SESSION_DRIVER` を `redis` にする）ことで衝突を避ける。

- [x] **Step 1: `.env` と `.env.example` の SESSION_DRIVER を確認/変更**

`.env` と `.env.example` の両方で次を設定：
```
SESSION_DRIVER=redis
```

- [x] **Step 2: デフォルトのsessionsマイグレーションが無いことを確認**

Run: `ls database/migrations/ | grep -i session`
Expected: 何も表示されない（Laravel 13のデフォルト `0001_01_01_000000_create_users_table.php` 内にsessionsが含まれる場合は、その `sessions` テーブル定義行を削除する。下記Step 3）。

- [x] **Step 3: `create_users_table` 内のsessionsテーブル定義を削除（存在する場合）**

`database/migrations/0001_01_01_000000_create_users_table.php` を開き、`Schema::create('sessions', ...)` ブロックがあれば削除する。`down()` の `Schema::dropIfExists('sessions');` も削除。
これにより交流セッション用 `sessions` テーブルと衝突しない。

- [x] **Step 4: コミット**

```bash
git add .env.example database/migrations/0001_01_01_000000_create_users_table.php
git commit -m "chore(db): use redis session driver to free 'sessions' table name"
```

### 4-1: usersテーブルにroleカラム追加

- [x] **Step 1: マイグレーション作成**

Run: `docker compose exec app php artisan make:migration add_role_to_users_table --table=users`

- [x] **Step 2: マイグレーション編集**

```php
public function up(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->enum('role', ['member', 'partner', 'admin'])
              ->default('member')
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

- [x] **Step 3: `app/Models/User.php` の $fillable に 'role' を追加**

既存の `canAccessPanel()`（Filament用）はそのまま。`$fillable` に `'role'` を追加し、リレーションを定義：
```php
protected $fillable = ['name', 'email', 'password', 'role'];

public function member()
{
    return $this->hasOne(Member::class);
}

public function partner()
{
    return $this->hasOne(Partner::class);
}
```

> `canAccessPanel()` は admin のみ許可に更新： `return $this->role === 'admin';`

### 4-2: membersテーブル（日本側利用者）

- [x] **Step 1: モデル+マイグレーション作成**

Run: `docker compose exec app php artisan make:model Member -m`

- [x] **Step 2: マイグレーション編集**

```php
Schema::create('members', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->enum('type', ['family', 'cram_school', 'circle', 'public_facility', 'other']);
    $table->string('org_name')->nullable();      // 法人名（家庭はnull）
    $table->string('prefecture');
    $table->string('contact_name');
    $table->string('grade_range')->nullable();   // 家庭=お子さんの学年帯
    $table->timestamps();
});
```

- [x] **Step 3: `app/Models/Member.php` 編集**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Member extends Model
{
    protected $fillable = [
        'user_id', 'type', 'org_name', 'prefecture', 'contact_name', 'grade_range',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function participations()
    {
        return $this->hasMany(SessionParticipant::class);
    }

    public function coupons()
    {
        return $this->hasMany(Coupon::class);
    }
}
```

### 4-3: partnersテーブル（海外側提供者）

- [x] **Step 1: モデル+マイグレーション作成**

Run: `docker compose exec app php artisan make:model Partner -m`

- [x] **Step 2: マイグレーション編集**

```php
Schema::create('partners', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->enum('provider_type', ['overseas_school', 'local_japanese']);
    $table->string('display_name');               // 校名 or 活動者名
    $table->string('country');                    // 例: "ケニア"
    $table->string('region');
    $table->string('contact_name');
    $table->string('video_url')->nullable();
    $table->enum('status', ['pending', 'approved', 'suspended', 'rejected'])
          ->default('pending');
    $table->decimal('rating_score', 3, 2)->default(0);
    $table->unsignedInteger('penalty_count')->default(0);
    $table->unsignedInteger('support_pool')->default(0);   // 物資支援プール(円)
    $table->json('themes')->nullable();           // ThemeType値の配列
    $table->string('grade_range');
    $table->timestamps();
});
```

- [x] **Step 3: `app/Models/Partner.php` 編集**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Partner extends Model
{
    protected $fillable = [
        'user_id', 'provider_type', 'display_name', 'country', 'region',
        'contact_name', 'video_url', 'status', 'rating_score',
        'penalty_count', 'support_pool', 'themes', 'grade_range',
    ];

    protected $casts = [
        'themes'       => 'array',
        'rating_score' => 'float',
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

### 4-4: sessionsテーブル（セッション枠）

- [x] **Step 1: モデル+マイグレーション作成**

Run: `docker compose exec app php artisan make:model Session -m`

- [x] **Step 2: マイグレーション編集**

```php
Schema::create('sessions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('partner_id')->constrained()->cascadeOnDelete();
    $table->enum('session_type', ['private', 'open']);
    $table->dateTime('scheduled_at');
    $table->unsignedInteger('duration_min');       // 45 or 60
    $table->string('theme');                       // ThemeType値
    $table->unsignedInteger('capacity');           // 専用=1, オープン=N
    $table->unsignedInteger('min_groups')->default(1);  // オープン成立最低数
    $table->boolean('with_facilitator')->default(false);
    $table->unsignedInteger('price_jpy');          // 1グループあたり
    $table->enum('status', ['draft', 'open', 'confirmed', 'ready', 'completed', 'cancelled'])
          ->default('draft');
    $table->dateTime('ready_checked_at')->nullable();
    $table->dateTime('cancelled_at')->nullable();
    $table->timestamps();
});
```

- [x] **Step 3: `app/Models/Session.php` 編集**

> ⚠️ クラス名 `Session` は `Illuminate\Support\Facades\Session` と衝突しうる。本モデルを使う側では `use App\Models\Session;` を明示し、Facadeとの混在を避ける。

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Session extends Model
{
    protected $fillable = [
        'partner_id', 'session_type', 'scheduled_at', 'duration_min',
        'theme', 'capacity', 'min_groups', 'with_facilitator',
        'price_jpy', 'status', 'ready_checked_at', 'cancelled_at',
    ];

    protected $casts = [
        'scheduled_at'     => 'datetime',
        'ready_checked_at' => 'datetime',
        'cancelled_at'     => 'datetime',
        'with_facilitator' => 'boolean',
    ];

    public function partner()
    {
        return $this->belongsTo(Partner::class);
    }

    public function participants()
    {
        return $this->hasMany(SessionParticipant::class);
    }
}
```

### 4-5: session_participantsテーブル（参加グループ）

- [x] **Step 1: モデル+マイグレーション作成**

Run: `docker compose exec app php artisan make:model SessionParticipant -m`

- [x] **Step 2: マイグレーション編集**

```php
Schema::create('session_participants', function (Blueprint $table) {
    $table->id();
    $table->foreignId('session_id')->constrained()->cascadeOnDelete();
    $table->foreignId('member_id')->constrained()->cascadeOnDelete();
    $table->enum('status', ['pending', 'confirmed', 'cancelled'])->default('pending');
    $table->string('stripe_payment_id')->nullable();   // Phase2で使用
    $table->unsignedInteger('price_paid');
    $table->unsignedInteger('support_amount');         // price_paidの50%
    $table->text('question_list')->nullable();
    $table->dateTime('question_list_sent_at')->nullable();
    $table->unsignedTinyInteger('rating_score')->nullable();  // ★1-5
    $table->text('rating_comment')->nullable();
    $table->dateTime('cancelled_at')->nullable();
    $table->timestamps();
});
```

- [x] **Step 3: `app/Models/SessionParticipant.php` 編集**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SessionParticipant extends Model
{
    protected $fillable = [
        'session_id', 'member_id', 'status', 'stripe_payment_id',
        'price_paid', 'support_amount', 'question_list',
        'question_list_sent_at', 'rating_score', 'rating_comment', 'cancelled_at',
    ];

    protected $casts = [
        'question_list_sent_at' => 'datetime',
        'cancelled_at'          => 'datetime',
    ];

    public function session()
    {
        return $this->belongsTo(Session::class);
    }

    public function member()
    {
        return $this->belongsTo(Member::class);
    }
}
```

### 4-6: support_requests / support_item_catalogsテーブル（物資支援）

> **⚠️ 仕様変更（2026-06-08）:** 「カタログ選択→WorldClass発送」方式から「自己購入→領収書提出→照合→送金」方式に変更。設計詳細は `docs/superpowers/specs/2026-05-29-worldclass-db-design.md` 4.6/4.6.1 参照。

- [x] **Step 1: モデル+マイグレーション作成**

Run:
```
docker compose exec app php artisan make:model SupportRequest -m
docker compose exec app php artisan make:model SupportItemCatalog -m
```

- [x] **Step 2: support_requests マイグレーション編集**

```php
Schema::create('support_requests', function (Blueprint $table) {
    $table->id();
    $table->foreignId('partner_id')->constrained()->cascadeOnDelete();
    $table->json('item_list');                              // 申請内容 [{name, quantity, unit_price}]
    $table->unsignedInteger('claimed_amount_jpy');           // 領収書記載の申請額
    $table->string('receipt_photo_url');                     // 領収書写真（証拠の核、必須）
    $table->enum('status', ['pending', 'approved', 'rejected', 'paid'])->default('pending');
    $table->unsignedInteger('approved_amount_jpy')->nullable();  // 照合後の承認（送金）額
    $table->text('rejection_reason')->nullable();
    $table->dateTime('reviewed_at')->nullable();
    $table->dateTime('paid_at')->nullable();
    $table->timestamps();
});
```

- [x] **Step 3: `app/Models/SupportRequest.php` 編集**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'partner_id', 'item_list', 'claimed_amount_jpy', 'receipt_photo_url',
    'status', 'approved_amount_jpy', 'rejection_reason', 'reviewed_at', 'paid_at',
])]
class SupportRequest extends Model
{
    protected $casts = [
        'item_list'   => 'array',
        'reviewed_at' => 'datetime',
        'paid_at'     => 'datetime',
    ];

    public function partner()
    {
        return $this->belongsTo(Partner::class);
    }
}
```

- [x] **Step 4: support_item_catalogs マイグレーション編集**

> 価格情報は持たない（現地物価差が大きく、固定参考価格は誤った審査基準を作るため）。「品目として支援対象に該当するか」のカテゴリ判定に純化する。

```php
Schema::create('support_item_catalogs', function (Blueprint $table) {
    $table->id();
    $table->string('name');                       // 品目名（例: ノート、サッカーボール）
    $table->string('category')->nullable();       // 分類（文房具/教材/スポーツ用品 等）
    $table->boolean('is_active')->default(true);  // 支援対象として現在有効か
    $table->timestamps();
});
```

- [x] **Step 5: `app/Models/SupportItemCatalog.php` 編集**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'category', 'is_active'])]
class SupportItemCatalog extends Model
{
    protected $casts = [
        'is_active' => 'boolean',
    ];
}
```

> 他テーブルとFK関係を持たない参照マスタ（審査時の目視照合用）。`support_requests.item_list` はこのマスタへの厳密参照を持たず自由記述のまま（領収書表記の揺れに対応するため）。

### 4-7: couponsテーブル（クーポン）

- [x] **Step 1: モデル+マイグレーション作成**

Run: `docker compose exec app php artisan make:model Coupon -m`

- [x] **Step 2: マイグレーション編集**

```php
Schema::create('coupons', function (Blueprint $table) {
    $table->id();
    $table->foreignId('member_id')->constrained()->cascadeOnDelete();
    $table->unsignedInteger('discount_pct');
    $table->enum('reason', ['early_bird', 'auto_cancel']);  // 先着300名特典 / 自動キャンセル時
    $table->string('code')->nullable();
    $table->dateTime('used_at')->nullable();
    $table->dateTime('expires_at');
    $table->timestamps();
});
```

- [x] **Step 3: `app/Models/Coupon.php` 編集**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    protected $fillable = [
        'member_id', 'discount_pct', 'reason', 'code', 'used_at', 'expires_at',
    ];

    protected $casts = [
        'used_at'    => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function member()
    {
        return $this->belongsTo(Member::class);
    }
}
```

### 4-8: マイグレーション実行・検証・コミット

- [x] **Step 1: マイグレーション実行**

Run: `docker compose exec app php artisan migrate`
Expected: 全テーブルが `DONE` 表示。

- [x] **Step 2: テーブル確認**

Run: `docker compose exec app php artisan db:show --counts`
Expected: members / partners / sessions / session_participants / support_requests / support_item_catalogs / coupons / users が並ぶ。

- [x] **Step 3: Larastan・Pint チェック**

Run: `docker compose exec app ./vendor/bin/pint`
Run: `docker compose exec app ./vendor/bin/phpstan analyse --no-progress --memory-limit=512M`
Expected: pint整形・phpstan `[OK] No errors`。

- [x] **Step 4: コミット**

```bash
git add database/migrations/ app/Models/
git commit -m "feat(db): add members/partners/sessions/participants/support/coupons migrations and models"
```

---

## Task 5: クリーンアーキテクチャ骨格

**Files:**
- Create: `app/Domain/ValueObjects/` 4ファイル
- Create: `app/Domain/Repositories/` 2ファイル
- Create: `app/UseCases/Auth/` 6ファイル
- Create: `app/Infrastructure/Repositories/` 2ファイル
- Modify: `app/Providers/AppServiceProvider.php`

### 5-1: ValueObjects（PHP enum）

- [x] **Step 1: `app/Domain/ValueObjects/MemberType.php`**

```php
<?php

namespace App\Domain\ValueObjects;

enum MemberType: string
{
    case Family         = 'family';
    case CramSchool     = 'cram_school';
    case Circle         = 'circle';
    case PublicFacility = 'public_facility';
    case Other          = 'other';
}
```

- [x] **Step 2: `app/Domain/ValueObjects/ProviderType.php`**

```php
<?php

namespace App\Domain\ValueObjects;

enum ProviderType: string
{
    case OverseasSchool = 'overseas_school';
    case LocalJapanese  = 'local_japanese';
}
```

- [x] **Step 3: `app/Domain/ValueObjects/PartnerStatus.php`**

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

- [x] **Step 4: `app/Domain/ValueObjects/ThemeType.php`**

```php
<?php

namespace App\Domain\ValueObjects;

enum ThemeType: string
{
    case Culture = 'culture';   // 文化交流
    case English = 'english';   // 英語学習
    case Global  = 'global';    // 国際理解
}
```

### 5-2: Repository Interfaces

- [x] **Step 5: `app/Domain/Repositories/MemberRepositoryInterface.php`**

```php
<?php

namespace App\Domain\Repositories;

use App\Models\Member;

interface MemberRepositoryInterface
{
    public function create(array $attributes): Member;
}
```

- [x] **Step 6: `app/Domain/Repositories/PartnerRepositoryInterface.php`**

```php
<?php

namespace App\Domain\Repositories;

use App\Models\Partner;

interface PartnerRepositoryInterface
{
    public function create(array $attributes): Partner;
}
```

### 5-3: UseCase — RegisterMember

- [x] **Step 7: `app/UseCases/Auth/RegisterMemberInput.php`**

```php
<?php

namespace App\UseCases\Auth;

readonly class RegisterMemberInput
{
    public function __construct(
        public string $email,
        public string $password,
        public string $name,
        public string $type,           // MemberType値
        public ?string $orgName,
        public string $prefecture,
        public string $contactName,
        public ?string $gradeRange,
    ) {}
}
```

- [x] **Step 8: `app/UseCases/Auth/RegisterMemberOutput.php`**

```php
<?php

namespace App\UseCases\Auth;

use App\Models\User;

readonly class RegisterMemberOutput
{
    public function __construct(
        public User $user,
    ) {}
}
```

- [x] **Step 9: `app/UseCases/Auth/RegisterMemberUseCase.php`**

```php
<?php

namespace App\UseCases\Auth;

use App\Domain\Repositories\MemberRepositoryInterface;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class RegisterMemberUseCase
{
    public function __construct(
        private MemberRepositoryInterface $memberRepository,
    ) {}

    public function execute(RegisterMemberInput $input): RegisterMemberOutput
    {
        $user = User::create([
            'name'     => $input->name,
            'email'    => $input->email,
            'password' => Hash::make($input->password),
            'role'     => 'member',
        ]);

        $this->memberRepository->create([
            'user_id'      => $user->id,
            'type'         => $input->type,
            'org_name'     => $input->orgName,
            'prefecture'   => $input->prefecture,
            'contact_name' => $input->contactName,
            'grade_range'  => $input->gradeRange,
        ]);

        return new RegisterMemberOutput($user);
    }
}
```

### 5-4: UseCase — RegisterPartner

- [x] **Step 10: `app/UseCases/Auth/RegisterPartnerInput.php`**

```php
<?php

namespace App\UseCases\Auth;

readonly class RegisterPartnerInput
{
    public function __construct(
        public string $email,
        public string $password,
        public string $providerType,   // ProviderType値
        public string $displayName,
        public string $country,
        public string $region,
        public string $contactName,
        public array  $themes,         // ThemeType値の配列
        public string $gradeRange,
    ) {}
}
```

- [x] **Step 11: `app/UseCases/Auth/RegisterPartnerOutput.php`**

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

- [x] **Step 12: `app/UseCases/Auth/RegisterPartnerUseCase.php`**

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
            'user_id'       => $user->id,
            'provider_type' => $input->providerType,
            'display_name'  => $input->displayName,
            'country'       => $input->country,
            'region'        => $input->region,
            'contact_name'  => $input->contactName,
            'themes'        => $input->themes,
            'grade_range'   => $input->gradeRange,
            'status'        => 'pending',
        ]);

        return new RegisterPartnerOutput($user);
    }
}
```

### 5-5: Infrastructure（Eloquentリポジトリ実装）

- [x] **Step 13: `app/Infrastructure/Repositories/EloquentMemberRepository.php`**

```php
<?php

namespace App\Infrastructure\Repositories;

use App\Domain\Repositories\MemberRepositoryInterface;
use App\Models\Member;

class EloquentMemberRepository implements MemberRepositoryInterface
{
    public function create(array $attributes): Member
    {
        return Member::create($attributes);
    }
}
```

- [x] **Step 14: `app/Infrastructure/Repositories/EloquentPartnerRepository.php`**

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

### 5-6: DIバインディング

- [x] **Step 15: `app/Providers/AppServiceProvider.php` の register() にバインディング追加**

```php
use App\Domain\Repositories\MemberRepositoryInterface;
use App\Domain\Repositories\PartnerRepositoryInterface;
use App\Infrastructure\Repositories\EloquentMemberRepository;
use App\Infrastructure\Repositories\EloquentPartnerRepository;

public function register(): void
{
    $this->app->bind(MemberRepositoryInterface::class, EloquentMemberRepository::class);
    $this->app->bind(PartnerRepositoryInterface::class, EloquentPartnerRepository::class);
}
```

- [x] **Step 16: Pint・Larastan・コミット**

```bash
docker compose exec app ./vendor/bin/pint
docker compose exec app ./vendor/bin/phpstan analyse --no-progress --memory-limit=512M
git add app/Domain/ app/UseCases/ app/Infrastructure/ app/Providers/
git commit -m "feat(arch): add clean architecture skeleton (Domain/UseCase/Infrastructure)"
```

---

## Task 6: TDD — UseCaseユニットテスト

**TDDサイクル：🔴 Red → 🟢 Green → 🔵 Refactor**

**Files:**
- Create: `tests/Unit/UseCases/RegisterMemberUseCaseTest.php`
- Create: `tests/Unit/UseCases/RegisterPartnerUseCaseTest.php`

- [ ] **Step 1: `tests/Unit/UseCases/RegisterMemberUseCaseTest.php`（🔴）**

```php
<?php

use App\Domain\Repositories\MemberRepositoryInterface;
use App\Models\Member;
use App\UseCases\Auth\RegisterMemberInput;
use App\UseCases\Auth\RegisterMemberUseCase;

it('利用者を登録してmemberロールが付与される', function () {
    $memberRepo = Mockery::mock(MemberRepositoryInterface::class);
    $memberRepo->shouldReceive('create')
        ->once()
        ->with(Mockery::on(fn ($attrs) =>
            $attrs['type'] === 'family' &&
            $attrs['prefecture'] === '東京都'
        ))
        ->andReturn(new Member(['type' => 'family']));

    $useCase = new RegisterMemberUseCase($memberRepo);

    $input = new RegisterMemberInput(
        email:       'family@example.com',
        password:    'password123',
        name:        '田中家',
        type:        'family',
        orgName:     null,
        prefecture:  '東京都',
        contactName: '田中太郎',
        gradeRange:  '小4〜6年',
    );

    $output = $useCase->execute($input);

    expect($output->user->role)->toBe('member');
    expect($output->user->email)->toBe('family@example.com');
});
```

- [ ] **Step 2: `tests/Unit/UseCases/RegisterPartnerUseCaseTest.php`（🔴）**

```php
<?php

use App\Domain\Repositories\PartnerRepositoryInterface;
use App\Models\Partner;
use App\UseCases\Auth\RegisterPartnerInput;
use App\UseCases\Auth\RegisterPartnerUseCase;

it('海外パートナーをpendingステータスで登録する', function () {
    $partnerRepo = Mockery::mock(PartnerRepositoryInterface::class);
    $partnerRepo->shouldReceive('create')
        ->once()
        ->with(Mockery::on(fn ($attrs) =>
            $attrs['status'] === 'pending' &&
            $attrs['provider_type'] === 'overseas_school' &&
            $attrs['display_name'] === 'Sunshine Elementary'
        ))
        ->andReturn(new Partner(['display_name' => 'Sunshine Elementary']));

    $useCase = new RegisterPartnerUseCase($partnerRepo);

    $input = new RegisterPartnerInput(
        email:        'partner@example.com',
        password:     'password123',
        providerType: 'overseas_school',
        displayName:  'Sunshine Elementary',
        country:      'ケニア',
        region:       'Nairobi',
        contactName:  'Maria Santos',
        themes:       ['culture', 'global'],
        gradeRange:   'Grade 4-6',
    );

    $output = $useCase->execute($input);

    expect($output->user->role)->toBe('partner');
});
```

- [ ] **Step 3: テスト実行（🔴→🟢）**

Run: `docker compose exec app php artisan test tests/Unit/`
Expected: `PASS  Tests\Unit\UseCases\...` × 2（UseCaseはTask5で実装済みのため通る）

- [ ] **Step 4: コミット**

```bash
git add tests/Unit/
git commit -m "test(usecase): add RegisterMember and RegisterPartner unit tests (TDD)"
```

---

## Task 7: ロール保護ミドルウェア

**Files:**
- Create: `app/Http/Middleware/EnsureRole.php`
- Modify: `bootstrap/app.php`
- Modify: `routes/web.php`
- Create: `app/Http/Controllers/DashboardController.php`

- [ ] **Step 1: ミドルウェア作成**

Run: `docker compose exec app php artisan make:middleware EnsureRole`

- [ ] **Step 2: `app/Http/Middleware/EnsureRole.php` 編集**

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
        if (! Auth::check()) {
            return redirect()->route('login');
        }

        if (! in_array(Auth::user()->role, $roles, true)) {
            abort(403, 'このページへのアクセス権限がありません。');
        }

        return $next($request);
    }
}
```

- [ ] **Step 3: `bootstrap/app.php` にエイリアス登録**

`->withMiddleware(function (Middleware $middleware) { ... })` 内に追加：
```php
$middleware->alias([
    'role' => \App\Http\Middleware\EnsureRole::class,
]);
```

- [ ] **Step 4: `app/Http/Controllers/DashboardController.php` 作成**

Run: `docker compose exec app php artisan make:controller DashboardController`

```php
<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function member(): Response
    {
        return Inertia::render('Dashboard/Member');
    }

    public function partner(): Response
    {
        return Inertia::render('Dashboard/Partner');
    }
}
```

- [ ] **Step 5: `routes/web.php` でロール別ルート定義**

```php
<?php

use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect()->route('login'));

Route::middleware(['auth', 'role:member'])->prefix('member')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'member'])->name('member.dashboard');
});

Route::middleware(['auth', 'role:partner'])->prefix('partner')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'partner'])->name('partner.dashboard');
});

require __DIR__.'/auth.php';
```

- [ ] **Step 6: ダッシュボードページ作成（.tsx）**

`resources/js/Pages/Dashboard/Member.tsx`:
```tsx
export default function MemberDashboard() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-bold">利用者ダッシュボード</h1>
    </div>
  )
}
```

`resources/js/Pages/Dashboard/Partner.tsx`:
```tsx
export default function PartnerDashboard() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-bold">Partner Dashboard</h1>
    </div>
  )
}
```

- [ ] **Step 7: コミット**

```bash
git add app/Http/Middleware/ bootstrap/app.php routes/web.php app/Http/Controllers/DashboardController.php resources/js/Pages/Dashboard/
git commit -m "feat(auth): add role-based middleware and dashboard routes"
```

---

## Task 8: 登録フォーム（Controller → UseCase呼び出し）

**Files:**
- Create: `app/Http/Requests/RegisterMemberRequest.php`
- Create: `app/Http/Requests/RegisterPartnerRequest.php`
- Modify: `app/Http/Controllers/Auth/RegisteredUserController.php`
- Modify: `routes/auth.php`
- Create: `resources/js/Pages/Auth/RegisterMember.tsx`
- Create: `resources/js/Pages/Auth/RegisterPartner.tsx`

- [ ] **Step 1: FormRequest作成**

```bash
docker compose exec app php artisan make:request RegisterMemberRequest
docker compose exec app php artisan make:request RegisterPartnerRequest
```

- [ ] **Step 2: `app/Http/Requests/RegisterMemberRequest.php` 編集**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules;

class RegisterMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email'        => ['required', 'email', 'unique:users'],
            'password'     => ['required', 'confirmed', Rules\Password::defaults()],
            'name'         => ['required', 'string', 'max:255'],
            'type'         => ['required', 'in:family,cram_school,circle,public_facility,other'],
            'org_name'     => ['nullable', 'string', 'max:255'],
            'prefecture'   => ['required', 'string', 'max:10'],
            'contact_name' => ['required', 'string', 'max:255'],
            'grade_range'  => ['nullable', 'string', 'max:50'],
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
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email'         => ['required', 'email', 'unique:users'],
            'password'      => ['required', 'confirmed', Rules\Password::defaults()],
            'provider_type' => ['required', 'in:overseas_school,local_japanese'],
            'display_name'  => ['required', 'string', 'max:255'],
            'country'       => ['required', 'string', 'max:100'],
            'region'        => ['required', 'string', 'max:100'],
            'contact_name'  => ['required', 'string', 'max:255'],
            'themes'        => ['required', 'array', 'min:1'],
            'themes.*'      => ['in:culture,english,global'],
            'grade_range'   => ['required', 'string', 'max:50'],
        ];
    }
}
```

- [ ] **Step 4: `RegisteredUserController.php` をUseCase呼び出しに書き直す**

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterMemberRequest;
use App\Http\Requests\RegisterPartnerRequest;
use App\UseCases\Auth\RegisterMemberInput;
use App\UseCases\Auth\RegisterMemberUseCase;
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
        private RegisterMemberUseCase  $registerMemberUseCase,
        private RegisterPartnerUseCase $registerPartnerUseCase,
    ) {}

    public function createMember(): Response
    {
        return Inertia::render('Auth/RegisterMember');
    }

    public function createPartner(): Response
    {
        return Inertia::render('Auth/RegisterPartner');
    }

    public function storeMember(RegisterMemberRequest $request): RedirectResponse
    {
        $input = new RegisterMemberInput(
            email:       $request->email,
            password:    $request->password,
            name:        $request->name,
            type:        $request->type,
            orgName:     $request->org_name,
            prefecture:  $request->prefecture,
            contactName: $request->contact_name,
            gradeRange:  $request->grade_range,
        );

        $output = $this->registerMemberUseCase->execute($input);

        event(new Registered($output->user));
        Auth::login($output->user);

        return redirect()->route('member.dashboard');
    }

    public function storePartner(RegisterPartnerRequest $request): RedirectResponse
    {
        $input = new RegisterPartnerInput(
            email:        $request->email,
            password:     $request->password,
            providerType: $request->provider_type,
            displayName:  $request->display_name,
            country:      $request->country,
            region:       $request->region,
            contactName:  $request->contact_name,
            themes:       $request->themes,
            gradeRange:   $request->grade_range,
        );

        $output = $this->registerPartnerUseCase->execute($input);

        event(new Registered($output->user));
        Auth::login($output->user);

        return redirect()->route('partner.dashboard');
    }
}
```

- [ ] **Step 5: `routes/auth.php` に登録ルート追加**

`Route::middleware('guest')->group(function () { ... })` 内に追加：
```php
use App\Http\Controllers\Auth\RegisteredUserController;

Route::get('register/member', [RegisteredUserController::class, 'createMember'])->name('register.member');
Route::post('register/member', [RegisteredUserController::class, 'storeMember']);

Route::get('register/partner', [RegisteredUserController::class, 'createPartner'])->name('register.partner');
Route::post('register/partner', [RegisteredUserController::class, 'storePartner']);
```

- [ ] **Step 6: `resources/js/Pages/Auth/RegisterMember.tsx` 作成**

```tsx
import { useForm } from '@inertiajs/react'
import React from 'react'

const MEMBER_TYPES = [
  { value: 'family', label: 'ご家庭' },
  { value: 'cram_school', label: '個人塾' },
  { value: 'circle', label: 'サークル団体' },
  { value: 'public_facility', label: '公民館/図書館' },
  { value: 'other', label: 'その他' },
] as const

export default function RegisterMember() {
  const { data, setData, post, processing, errors } = useForm({
    email: '',
    password: '',
    password_confirmation: '',
    name: '',
    type: 'family',
    org_name: '',
    prefecture: '',
    contact_name: '',
    grade_range: '',
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    post('/register/member')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-6">利用者 新規登録</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">利用者区分</label>
            <select
              value={data.type}
              onChange={(e) => setData('type', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              {MEMBER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {data.type !== 'family' && (
            <div>
              <label className="block text-sm font-medium mb-1">団体名</label>
              <input
                type="text"
                value={data.org_name}
                onChange={(e) => setData('org_name', e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
              {errors.org_name && <p className="text-red-500 text-sm mt-1">{errors.org_name}</p>}
            </div>
          )}

          {[
            { label: 'お名前 / 団体名', field: 'name', type: 'text' },
            { label: '都道府県', field: 'prefecture', type: 'text' },
            { label: '担当者名', field: 'contact_name', type: 'text' },
            { label: 'お子さんの学年帯（任意）', field: 'grade_range', type: 'text' },
            { label: 'メールアドレス', field: 'email', type: 'email' },
            { label: 'パスワード', field: 'password', type: 'password' },
            { label: 'パスワード確認', field: 'password_confirmation', type: 'password' },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                type={type}
                value={(data as Record<string, string>)[field]}
                onChange={(e) => setData(field as keyof typeof data, e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
              {(errors as Record<string, string>)[field] && (
                <p className="text-red-500 text-sm mt-1">{(errors as Record<string, string>)[field]}</p>
              )}
            </div>
          ))}

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

- [ ] **Step 7: `resources/js/Pages/Auth/RegisterPartner.tsx` 作成**

```tsx
import { useForm } from '@inertiajs/react'
import React from 'react'

const THEMES = [
  { value: 'culture', label: '文化交流' },
  { value: 'english', label: '英語学習' },
  { value: 'global', label: '国際理解' },
] as const

const PROVIDER_TYPES = [
  { value: 'overseas_school', label: '海外校' },
  { value: 'local_japanese', label: '現地で活動する日本人' },
] as const

export default function RegisterPartner() {
  const { data, setData, post, processing, errors } = useForm({
    email: '',
    password: '',
    password_confirmation: '',
    provider_type: 'overseas_school',
    display_name: '',
    country: '',
    region: '',
    contact_name: '',
    themes: [] as string[],
    grade_range: '',
  })

  const toggleTheme = (theme: string) => {
    setData('themes', data.themes.includes(theme)
      ? data.themes.filter((t) => t !== theme)
      : [...data.themes, theme])
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    post('/register/partner')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-6">海外パートナー登録</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">提供者タイプ</label>
            <select
              value={data.provider_type}
              onChange={(e) => setData('provider_type', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              {PROVIDER_TYPES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {[
            { label: '表示名（学校名 / 活動名）', field: 'display_name', type: 'text' },
            { label: '国', field: 'country', type: 'text' },
            { label: '地域', field: 'region', type: 'text' },
            { label: '担当者名', field: 'contact_name', type: 'text' },
            { label: '対象学年', field: 'grade_range', type: 'text' },
            { label: 'メールアドレス', field: 'email', type: 'email' },
            { label: 'パスワード', field: 'password', type: 'password' },
            { label: 'パスワード（確認）', field: 'password_confirmation', type: 'password' },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                type={type}
                value={(data as Record<string, string>)[field]}
                onChange={(e) => setData(field as keyof typeof data, e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
              {(errors as Record<string, string>)[field] && (
                <p className="text-red-500 text-sm mt-1">{(errors as Record<string, string>)[field]}</p>
              )}
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium mb-1">対応テーマ</label>
            <div className="flex gap-2 flex-wrap">
              {THEMES.map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  onClick={() => toggleTheme(theme.value)}
                  className={`px-3 py-1 rounded-full border text-sm ${
                    data.themes.includes(theme.value)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {theme.label}
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
            登録する
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: フロントをビルド**

Run: `docker compose exec app npm run build`
Expected: ビルド成功（manifest.json 生成）。

- [ ] **Step 9: Pint・コミット**

```bash
docker compose exec app ./vendor/bin/pint
git add app/Http/ routes/auth.php resources/js/Pages/Auth/
git commit -m "feat(auth): add member/partner registration via UseCase with FormRequests"
```

---

## Task 8.5: 登録まわりのセキュリティ・整合性修正（2026-06-10レビュー＋2026-06-12 digで拡張）

**Files:**
- Modify: `routes/auth.php`
- Modify: `app/UseCases/Auth/RegisterMemberUseCase.php` / `app/UseCases/Auth/RegisterPartnerUseCase.php`（トランザクション化）
- Modify: `tests/Unit/UseCases/RegisterMemberUseCaseTest.php` / `RegisterPartnerUseCaseTest.php`（DB Facadeモック追加）
- Create: `database/migrations/xxxx_add_unique_user_id_to_members_and_partners.php`
- Modify: `app/Http/Controllers/DashboardController.php` / `resources/js/Pages/Dashboard/Partner.tsx`（審査中バナー）
- Delete: `tests/Feature/Auth/RegistrationTest.php`（旧Breezeテスト・存在しない `GET/POST /register` 前提）
- Delete: `resources/js/Pages/Auth/Register.jsx`（Breeze残骸・遷移元なしを確認のうえ）

- [ ] **Step 1: 死にルートの削除**

`routes/auth.php` から以下を削除する。`RegisteredUserController::store` は member/partner 分割時に削除済みのため、このルートはPOSTすると即エラーになる:

```php
Route::post('register', [RegisteredUserController::class, 'store']);  // ← 削除
```

- [ ] **Step 2: 登録POSTにレート制限を追加**

bot による大量アカウント作成を防ぐ。`routes/auth.php` の登録POST 2本に `throttle` を付与:

```php
Route::post('register/member', [RegisteredUserController::class,
    'storeMember'])->middleware('throttle:5,1');

Route::post('register/partner', [RegisteredUserController::class,
    'storePartner'])->middleware('throttle:5,1');
```

- [ ] **Step 3: Breeze残骸の `Register.jsx` を削除**

`resources/js/Pages/Auth/Register.jsx` への遷移が残っていないことを確認（`grep -rn "Auth/Register'" resources/js/` で参照ゼロ）してから削除。`Login.jsx` 内に `route('register')` リンクがある場合は `register.member` へ差し替える。

- [ ] **Step 4: 旧 `RegistrationTest.php` の削除**

`tests/Feature/Auth/RegistrationTest.php` は `GET /register`（ルート自体が存在しない）と `POST /register`（Step 1で削除）を前提とした旧Breezeテストで、Step 1実施後は確実に赤になる。削除する（代替はTask 9の `RegisterMemberTest` / `RegisterPartnerTest`）。

- [ ] **Step 5: 登録UseCaseのトランザクション化（🔴→🟢）**

現状はUser作成→プロフィール作成が非トランザクション。2件目のINSERTが失敗すると「メールだけ取られた孤児ユーザー」が残り、`unique:users` により**そのメールで再登録不能**になる。`RegisterMemberUseCase` / `RegisterPartnerUseCase` の `execute()` 全体を `DB::transaction` でラップする:

```php
use Illuminate\Support\Facades\DB;

public function execute(RegisterMemberInput $input): RegisterMemberOutput
{
    return DB::transaction(function () use ($input) {
        // 既存の User作成 → Member作成 処理をそのまま中に移動
    });
}
```

> クリーンアーキ的にはTransactionインターフェース注入が純粋だが、MVPでは過剰のためFacade直書きを許容（2026-06-12判断）。

**既存Unitテストへの影響:** `tests/Unit/UseCases/` のテストは `Tests\TestCase` 継承だがDB未接続。`DB::transaction` が実DBに繋ごうとして落ちるため、各テストの冒頭でFacadeをモックする:

```php
DB::shouldReceive('transaction')
    ->andReturnUsing(fn (callable $callback) => $callback());
```

- [ ] **Step 6: `user_id` unique制約マイグレーション**

`members.user_id` / `partners.user_id` は現状plain FKで、DB上は1ユーザーに複数プロフィールを許してしまう（`hasOne` の1:1前提と不整合）。

Run: `docker compose exec app php artisan make:migration add_unique_user_id_to_members_and_partners`

```php
public function up(): void
{
    Schema::table('members', function (Blueprint $table) {
        $table->unique('user_id');
    });
    Schema::table('partners', function (Blueprint $table) {
        $table->unique('user_id');
    });
}

public function down(): void
{
    Schema::table('members', function (Blueprint $table) {
        $table->dropUnique(['user_id']);
    });
    Schema::table('partners', function (Blueprint $table) {
        $table->dropUnique(['user_id']);
    });
}
```

Run: `docker compose exec app php artisan migrate`

- [ ] **Step 7: pendingパートナーに「審査中」バナー（dig判断②）**

登録直後のパートナーは `status=pending` のまま即ログイン・ダッシュボード遷移する。Phase 1ではバナー表示のみ対応（行動制限の `EnsurePartnerApproved` ミドルウェアはPhase 2冒頭）。

`DashboardController` のpartnerアクションでstatusを渡す（実装の形に合わせて調整）:

```php
return Inertia::render('Dashboard/Partner', [
    'status' => Auth::user()->partner?->status,
]);
```

`resources/js/Pages/Dashboard/Partner.tsx`:

```tsx
export default function PartnerDashboard({ status }: { status: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      {status === 'pending' && (
        <p className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded">
          現在審査中です。承認されるとセッションを提供できるようになります。
        </p>
      )}
      <h1 className="text-2xl font-bold">パートナーダッシュボード</h1>
    </div>
  )
}
```

※既存 `Partner.tsx` の見出しが `Partner Dashboard`（英語）の場合は日本語へ差し替え（dig判断④）。

- [ ] **Step 8: テスト・コミット**

```bash
docker compose exec app php artisan test
```

Expected: 全PASS（旧RegistrationTest削除済みのため赤なし）

```bash
git add routes/auth.php resources/js/ app/UseCases/ app/Http/Controllers/ database/migrations/ tests/
git commit -m "fix(auth): harden registration (dead route, throttle, transaction, unique user_id, pending banner)"
```

> **メール検証について（判断メモ）:** `User` の `MustVerifyEmail` は現在無効（Breezeデフォルト）。`Registered` イベントで検証メール自体は送られるが、未検証でもダッシュボードに入れる。MVPでは非強制のままとし、強制する場合は `User implements MustVerifyEmail` ＋ dashboardルートに `verified` ミドルウェアを追加する（決済を伴うPhase 2前に再検討。2026-06-12 digで「Phase 2前に強制」を確定）。

---

## Task 8.6: enum() → string ＋ backed enum cast（2026-06-12 dig判断⑥）

**理由:** PostgreSQLで `$table->enum()` はCHECK制約として実装される。`sessions.status` は既に6状態あり、Phase 3以降の状態追加のたびに制約変更マイグレーションが必要になる負債。**本番データがない今が変更最安**のため、既存マイグレーションを直接編集して `migrate:fresh` で作り直す。

**Files:**
- Modify: `database/migrations/`（`enum()` 使用箇所すべて）
- Modify: `app/Models/Partner.php` 等（casts追加・任意適用）

- [ ] **Step 1: 既存マイグレーションの `enum()` を `string()` へ置換**

対象（`grep -rn "enum(" database/migrations/` で全件確認）:

- `users.role` / `members.type` / `partners.provider_type` / `partners.status` / `sessions.session_type` / `sessions.status` / `session_participants.status` / `support_requests.status` / `coupons.reason`

```php
// 例: 変更前
$table->enum('status', ['pending', 'approved', 'suspended', 'rejected'])->default('pending');
// 変更後（default はそのまま維持）
$table->string('status')->default('pending');
```

許容値の担保はFormRequestのバリデーション（`Rule::enum()` / `Rule::in()`）が担う。各FormRequestに許容値ルールがあることを確認する。

- [ ] **Step 2: backed enum cast（必要な列のみ・任意適用）**

Task 5-1 の `app/Domain/ValueObjects/` のPHP enumをモデルcastに流用できる（Model→Domainの依存はクリーンアーキの方向として正しい）:

```php
// app/Models/Partner.php
protected function casts(): array
{
    return ['status' => PartnerStatus::class];
}
```

> **⚠️ `users.role` はcastしない。** `EnsureRole` が `in_array(Auth::user()->role, $roles, true)` と文字列厳密比較しており、castするとenum instanceになり全認可が壊れる。castを入れるなら比較箇所の修正とセットで（MVPではstringのままが安全）。castした列はテストの比較も `->value` になる点に注意。

- [ ] **Step 3: DB再構築・検証**

```bash
docker compose exec app php artisan migrate:fresh --seed
docker compose exec app php artisan test
docker compose exec app ./vendor/bin/phpstan analyse  # Larastan
```

Expected: マイグレーション成功・全テストPASS

- [ ] **Step 4: コミット**

```bash
git add database/migrations/ app/Models/
git commit -m "refactor(db): replace enum columns with string + backed enum casts"
```

---

## Task 9: Feature Test — 登録フロー

**Files:**
- Create: `tests/Feature/Auth/RegisterMemberTest.php`
- Create: `tests/Feature/Auth/RegisterPartnerTest.php`

- [ ] **Step 1: `tests/Feature/Auth/RegisterMemberTest.php`（🔴・PHPUnitクラス形式）**

```php
<?php

namespace Tests\Feature\Auth;

use App\Models\Member;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegisterMemberTest extends TestCase
{
    use RefreshDatabase;

    public function test_利用者の家庭が登録できる(): void
    {
        $response = $this->post('/register/member', [
            'email'                 => 'family@example.com',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'name'                  => '田中家',
            'type'                  => 'family',
            'org_name'              => null,
            'prefecture'            => '東京都',
            'contact_name'          => '田中太郎',
            'grade_range'           => '小4〜6年',
        ]);

        $response->assertRedirect('/member/dashboard');

        $user = User::where('email', 'family@example.com')->first();
        $this->assertNotNull($user);
        $this->assertSame('member', $user->role);
        $this->assertTrue(
            Member::where('user_id', $user->id)->where('type', 'family')->exists()
        );
    }

    public function test_重複メールで登録するとバリデーションエラー(): void
    {
        User::factory()->create(['email' => 'dup@example.com']);

        $response = $this->post('/register/member', [
            'email'                 => 'dup@example.com',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'name'                  => 'テスト塾',
            'type'                  => 'cram_school',
            'org_name'              => 'テスト塾',
            'prefecture'            => '東京都',
            'contact_name'          => '山田',
            'grade_range'           => null,
        ]);

        $response->assertSessionHasErrors('email');
    }
}
```

- [ ] **Step 2: `tests/Feature/Auth/RegisterPartnerTest.php`（🔴・PHPUnitクラス形式）**

```php
<?php

namespace Tests\Feature\Auth;

use App\Models\Partner;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegisterPartnerTest extends TestCase
{
    use RefreshDatabase;

    public function test_海外パートナーがpendingステータスで登録される(): void
    {
        $response = $this->post('/register/partner', [
            'email'                 => 'partner@example.com',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
            'provider_type'         => 'overseas_school',
            'display_name'          => 'Sunshine Elementary',
            'country'               => 'ケニア',
            'region'                => 'Nairobi',
            'contact_name'          => 'Maria Santos',
            'themes'                => ['culture', 'global'],
            'grade_range'           => 'Grade 4-6',
        ]);

        $response->assertRedirect('/partner/dashboard');

        $user = User::where('email', 'partner@example.com')->first();
        $this->assertSame('partner', $user->role);

        $partner = Partner::where('user_id', $user->id)->first();
        // Task 8.6 で status にbacked enum castを適用済みなら ->value で比較、未適用なら $partner->status を直接比較
        $this->assertSame('pending', $partner->status->value);
        $this->assertContains('culture', $partner->themes);
    }
}
```

> **throttleとの共存メモ:** Task 8.5で登録POSTに `throttle:5,1` を付与済み。本テストのPOSTは計3回で上限内のため対応不要だが、テストを増やす場合は `RateLimiter` のクリア or `withoutMiddleware(ThrottleRequests::class)` を検討。

- [ ] **Step 3: テスト実行（🟢）**

Run: `docker compose exec app php artisan test tests/Feature/Auth/`
Expected: `PASS` × 3（member登録・重複エラー・partner登録）

- [ ] **Step 4: コミット**

```bash
git add tests/Feature/
git commit -m "test(feature): add member and partner registration feature tests (TDD)"
```

---

## Task 10: 管理者シードデータ

**Files:**
- Create: `database/seeders/AdminUserSeeder.php`
- Modify: `database/seeders/DatabaseSeeder.php`

- [ ] **Step 1: Seeder作成**

Run: `docker compose exec app php artisan make:seeder AdminUserSeeder`

- [ ] **Step 2: `database/seeders/AdminUserSeeder.php` 編集**

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
        // パスワードのハードコード禁止: リポジトリは公開され得る・本番seedで既知弱パスワードの
        // admin（Filament全権）が作られる事故を防ぐため、envから必須で受け取る
        $password = env('ADMIN_SEED_PASSWORD');

        if (! $password) {
            $this->command->warn('ADMIN_SEED_PASSWORD が未設定のため管理者ユーザーを作成しません。');

            return;
        }

        $email = env('ADMIN_SEED_EMAIL', 'admin@worldclass.jp');

        User::updateOrCreate(
            ['email' => $email],
            [
                'name'     => 'WorldClass Admin',
                'password' => Hash::make($password),
                'role'     => 'admin',
            ]
        );

        $this->command->info("Admin user created: {$email}");
    }
}
```

`.env` に追記し、`.env.example` にはキー名のみ追加:

```env
ADMIN_SEED_EMAIL=admin@worldclass.jp
ADMIN_SEED_PASSWORD=   # ローカル用の任意の強いパスワード（コミットしない）
```

- [ ] **Step 3: `database/seeders/DatabaseSeeder.php` に登録**

```php
public function run(): void
{
    $this->call([AdminUserSeeder::class]);
}
```

- [ ] **Step 4: Seeder実行**

Run: `docker compose exec app php artisan db:seed`
Expected: `Admin user created: admin@worldclass.jp`（`ADMIN_SEED_PASSWORD` 設定済みの場合）

- [ ] **Step 5: コミット**

```bash
git add database/seeders/
git commit -m "feat(db): add admin user seeder"
```

---

## Task 11: Filament海外パートナー審査リソース

**Files:**
- Create: `app/Filament/Resources/PartnerResource.php` ほか（自動生成）

> Filament v4 の生成物・名前空間は v3 と異なる場合がある。`--generate` 後の生成内容に合わせて以下を調整すること。

- [ ] **Step 1: Filamentリソース作成**

Run: `docker compose exec app php artisan make:filament-resource Partner --generate`

- [ ] **Step 2: フォーム/テーブルを審査用に編集**

`form()` に以下のフィールドを定義（Filament v4 のスキーマAPIに合わせる）：
- `display_name`（label: 名称・required）
- `provider_type`（Select・label: 提供者種別・options: overseas_school=海外校 / local_japanese=現地日本人）
- `country`（label: 国・required） / `region`（label: 地域・required）
- `contact_name`（label: 担当者名・required）
- `video_url`（label: VTR URL・url）
- `status`（Select・label: 審査ステータス・options: pending=審査中 / approved=承認 / suspended=停止 / rejected=不承認・required）
- `themes`（CheckboxList・options: culture=文化交流 / english=英語学習 / global=国際理解）
- `grade_range`（label: 対象学年・required）
- `support_pool`（numeric・label: 物資支援プール(円)・disabled）

`table()` に以下のカラム：
- `display_name`（searchable） / `provider_type` / `country`
- `status`（バッジ: pending=warning / approved=success / suspended・rejected=danger）
- `rating_score`（label: ★） / `penalty_count` / `support_pool`

`filters()` に `status` の SelectFilter（pending/approved/suspended/rejected）。
`actions()` に EditAction。

- [ ] **Step 3: 動作確認**

`http://localhost/admin` → `.env` の `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` でログイン → Partners一覧でステータス変更ができる。

- [ ] **Step 4: Pint・Larastan・コミット**

```bash
docker compose exec app ./vendor/bin/pint
docker compose exec app ./vendor/bin/phpstan analyse --no-progress --memory-limit=512M
git add app/Filament/
git commit -m "feat(admin): add Filament partner review resource"
```

---

## セルフレビュー（スペックカバレッジ）

- ✅ 全DBスキーマ（members / partners / sessions / session_participants / support_requests / support_item_catalogs / coupons）— DB設計書準拠
- ✅ 3ロール認証（member / partner / admin）
- ✅ 利用者5区分（MemberType enum）/ 提供者2区分（ProviderType enum）
- ✅ セッション枠 + 参加グループ（専用/オープン両対応スキーマ）
- ✅ テーマ enum（ThemeType: culture/english/global）
- ✅ クリーンアーキ骨格（Domain / UseCase / Infrastructure）+ DIバインディング
- ✅ TDD（Unit: UseCase / Feature: 登録フロー）
- ✅ FormRequest バリデーション
- ✅ Controller → UseCase → Repository の呼び出しチェーン
- ✅ Filament管理画面（海外パートナー審査・provider_type対応）
- ✅ Conventional Commits
- ⏭️ カタログ・予約ロジック・Stripe → Phase 2（`stripe_payment_id` 等のカラムは用意済み）
- ⏭️ 準備フロー・自動キャンセル・通知 → Phase 3（`ready_checked_at` 等のカラムは用意済み）
- ⏭️ 物資支援運用フロー → Phase 4
- ⏭️ 自治体ダッシュボード → Phase 5

## タスク実行順序

```
Task 4（DB）→ Task 5（Clean Arch骨格）→ Task 6（Unit Test）
→ Task 7（Middleware）→ Task 8（Controller/UseCase/Form・UI日本語）
→ Task 8.5（登録修正一括: 死にルート/throttle/トランザクション/unique/旧テスト清算/審査中バナー）
→ Task 8.6（enum→string＋backed enum cast）
→ Task 9（Feature Test・PHPUnit）→ Task 10（Seeder）→ Task 11（Filament Resource）
```
