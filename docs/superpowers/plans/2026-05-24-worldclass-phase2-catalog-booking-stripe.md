# WorldClass Phase 2: カタログ・予約・決済 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** カタログ（海外校一覧・フィルタ・詳細）、スロット管理（週次パターン＋例外ブロック）、予約フロー（テンプレ選択→Stripe決済）、Webhook確定処理を実装する。

**Architecture:** LaravelモノリスにServiceレイヤー（SlotService, StripeService）を追加。フロントはInertia.js + React。Stripe Checkout（ホステッドページへリダイレクト）でPCI scopeを最小化。予約確定はWebhookで行い、ブラウザ離脱による取りこぼしを防ぐ。

**Tech Stack:** Laravel 13, Inertia.js, React + TypeScript, Stripe PHP SDK (`stripe/stripe-php`), PostgreSQL, Laravel Queue（DB driver）

---

> ## ⚠️ 未整合の警告（2026-05-29 追記）
>
> **このプランは旧DB設計（`schools` / `Session`を予約レコードとして直接利用）で書かれており、Phase1で確定した新DB設計と全面的に矛盾している。Phase2着手時（Phase1完了後）に下表に従って全コード例を書き直すこと。** 新設計の正は [`../specs/2026-05-29-worldclass-db-design.md`](../specs/2026-05-29-worldclass-db-design.md)。
>
> **不整合マップ（旧→新）:**
>
> | 旧プランの記述 | 新設計での扱い |
> |---|---|
> | `School` モデル / `school_id` / role `school` / `school.dashboard` | `Member` / `member_id` / role `member` / `member.dashboard` |
> | `SchoolFactory` | `MemberFactory`（`type` 必須: family/cram_school/circle/public_facility/other） |
> | `Session` を予約1件として直接 `create`（`school_id`・`question_list`・`price_jpy`・`support_amount`・`stripe_payment_id`・`status pending/confirmed` を保持） | **二層化**: `sessions`（枠: `session_type=private`・`capacity=1`・`partner_id`・`scheduled_at`・`price_jpy`・`status`）＋ **`session_participants`**（参加グループ: `member_id`・`question_list`・`price_paid`・`support_amount`・`stripe_payment_id`・`status pending/confirmed/cancelled`）。**決済・質問・返金は `session_participants` 側に紐づく** |
> | テーマ `文化紹介` / `SDGs` / `英語教育` | `ThemeType` enum: `culture`（文化交流）/ `english`（英語学習）/ `global`（国際理解） |
> | `partner.school_name` | `partner.display_name` |
> | Coupon `school_id` / 自由文字列 `reason` | `member_id` / `reason` enum（`early_bird` / `auto_cancel`） |
> | `Partner.factory()->create(['country' => 'Philippines'])` 等の例示国 | 新対象国（ケニア・ブータン・モロッコ・東ティモール・ガーナ・チュニジア） |
>
> **影響を受ける主なコンポーネント:** SlotService（確定予約の衝突判定は `sessions`枠 + `session_participants.status` を考慮）、BookingController（Session枠生成 + Participant作成の2段）、StripeService（`display_name` 参照・metadataに participant_id）、WebhookController（confirmedにするのは participant）、ProcessCancellation（返金・クーポンは participant/member 基準）。
>
> ※ オープンセッション（相乗り・グループ単位・min_groups成立）は本Phase2の旧スコープに無い。新設計では対応済みのため、Phase2再設計時にオープンセッション予約フローを含めるか要検討。

---

## ファイル構成

**新規作成:**
```
database/migrations/
  xxxx_create_partner_schedules_table.php
  xxxx_create_partner_schedule_blocks_table.php

app/Models/
  PartnerSchedule.php
  PartnerScheduleBlock.php

app/Services/
  SlotService.php
  StripeService.php

app/Http/Controllers/
  CatalogController.php
  BookingController.php
  WebhookController.php
  Partner/ScheduleController.php

app/Jobs/
  ProcessCancellation.php

resources/js/Pages/
  Catalog/Index.tsx
  Catalog/Show.tsx
  Booking/Create.tsx
  Booking/Complete.tsx

tests/Unit/
  SlotServiceTest.php
tests/Feature/
  CatalogControllerTest.php
  BookingControllerTest.php
  WebhookControllerTest.php
```

**既存ファイル変更:**
```
app/Models/Partner.php         ← schedules/scheduleBlocks リレーション追加
bootstrap/app.php              ← Webhook を CSRF 除外
routes/web.php                 ← 新規ルート追加
config/services.php            ← Stripe キー追加
```

---

## Task 1: Stripe SDKインストール・設定

**Files:**
- Modify: `composer.json`（composer経由）
- Modify: `config/services.php`
- Modify: `.env`（ローカル設定）

- [ ] **Step 1: Stripe PHP SDKをインストール**

```bash
composer require stripe/stripe-php
```

Expected: `./composer.json has been updated` と表示される

- [ ] **Step 2: `config/services.php` にStripe設定追加**

`config/services.php` の配列末尾に追記：

```php
'stripe' => [
    'key'            => env('STRIPE_KEY'),
    'secret'         => env('STRIPE_SECRET'),
    'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
],
```

- [ ] **Step 3: `.env` にStripeキー追加**

```env
STRIPE_KEY=pk_test_xxxxxxxxxxxxxxxx
STRIPE_SECRET=sk_test_xxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
```

※ 実際のキーはStripeダッシュボード（https://dashboard.stripe.com/test/apikeys）から取得。
テスト環境では `pk_test_` / `sk_test_` プレフィックスのキーを使用。

- [ ] **Step 4: コミット**

```bash
git add composer.json composer.lock config/services.php
git commit -m "feat: install stripe/stripe-php and add config"
```

---

## Task 2: DBマイグレーション（スロット管理テーブル）

**Files:**
- Create: `database/migrations/xxxx_create_partner_schedules_table.php`
- Create: `database/migrations/xxxx_create_partner_schedule_blocks_table.php`

- [ ] **Step 1: マイグレーションファイル作成**

```bash
php artisan make:migration create_partner_schedules_table
php artisan make:migration create_partner_schedule_blocks_table
```

- [ ] **Step 2: `create_partner_schedules_table` を編集**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('partner_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week');
            // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun（JST基準）
            $table->time('start_time_jst');               // 例: "10:00:00"
            $table->unsignedInteger('duration_min');       // 45 or 60
            $table->unsignedInteger('max_sessions')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partner_schedules');
    }
};
```

- [ ] **Step 3: `create_partner_schedule_blocks_table` を編集**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('partner_schedule_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained()->cascadeOnDelete();
            $table->date('blocked_date');
            $table->string('reason')->nullable();
            $table->timestamps();

            $table->unique(['partner_id', 'blocked_date']); // 同一日の重複登録を防ぐ
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partner_schedule_blocks');
    }
};
```

- [ ] **Step 4: マイグレーション実行**

```bash
php artisan migrate
```

Expected:
```
Migrated: xxxx_create_partner_schedules_table
Migrated: xxxx_create_partner_schedule_blocks_table
```

- [ ] **Step 5: コミット**

```bash
git add database/migrations/
git commit -m "feat: add partner_schedules and partner_schedule_blocks tables"
```

---

## Task 3: Eloquentモデル

**Files:**
- Create: `app/Models/PartnerSchedule.php`
- Create: `app/Models/PartnerScheduleBlock.php`
- Modify: `app/Models/Partner.php`

- [ ] **Step 1: `app/Models/PartnerSchedule.php` を作成**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartnerSchedule extends Model
{
    protected $fillable = [
        'partner_id',
        'day_of_week',
        'start_time_jst',
        'duration_min',
        'max_sessions',
    ];

    protected $casts = [
        'day_of_week'  => 'integer',
        'duration_min' => 'integer',
        'max_sessions' => 'integer',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }
}
```

- [ ] **Step 2: `app/Models/PartnerScheduleBlock.php` を作成**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartnerScheduleBlock extends Model
{
    protected $fillable = [
        'partner_id',
        'blocked_date',
        'reason',
    ];

    protected $casts = [
        'blocked_date' => 'date',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }
}
```

- [ ] **Step 3: `app/Models/Partner.php` にリレーションを追加**

既存の Partner クラスの末尾（`supportRequests()` の後）に追記：

```php
use App\Models\PartnerSchedule;
use App\Models\PartnerScheduleBlock;

// --- Partner.php に追記 ---

public function schedules(): \Illuminate\Database\Eloquent\Relations\HasMany
{
    return $this->hasMany(PartnerSchedule::class);
}

public function scheduleBlocks(): \Illuminate\Database\Eloquent\Relations\HasMany
{
    return $this->hasMany(PartnerScheduleBlock::class);
}
```

- [ ] **Step 4: コミット**

```bash
git add app/Models/
git commit -m "feat: add PartnerSchedule and PartnerScheduleBlock models"
```

---

## Task 4: SlotService（TDD）

`SlotService` は「週次パターン + 例外ブロック + 既存予約」から予約可能スロット一覧を生成する。

**Files:**
- Create: `tests/Unit/SlotServiceTest.php`
- Create: `app/Services/SlotService.php`

- [ ] **Step 1: テストファイルを作成**

```bash
php artisan make:test SlotServiceTest --unit
```

- [ ] **Step 2: `tests/Unit/SlotServiceTest.php` を以下に書き換え**

```php
<?php

namespace Tests\Unit;

use App\Models\Partner;
use App\Models\PartnerSchedule;
use App\Models\PartnerScheduleBlock;
use App\Models\Session;
use App\Services\SlotService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SlotServiceTest extends TestCase
{
    use RefreshDatabase;

    private SlotService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new SlotService();
        // テスト実行中の「今日」をJST月曜日に固定
        Carbon::setTestNow(Carbon::parse('2026-06-01 00:00:00', 'Asia/Tokyo'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** @test */
    public function スケジュールがない場合は空配列を返す(): void
    {
        $partner = Partner::factory()->create(['status' => 'approved']);

        $slots = $this->service->getAvailableSlots($partner, 1);

        $this->assertSame([], $slots);
    }

    /** @test */
    public function 週次パターンから正しくスロットを展開する(): void
    {
        $partner = Partner::factory()->create(['status' => 'approved']);
        // 月曜（0）10:00 45分
        PartnerSchedule::factory()->create([
            'partner_id'    => $partner->id,
            'day_of_week'   => 0,
            'start_time_jst'=> '10:00:00',
            'duration_min'  => 45,
        ]);

        // 1週間分（今日2026-06-01月〜2026-06-07日）
        $slots = $this->service->getAvailableSlots($partner, 1);

        $this->assertCount(1, $slots);
        $this->assertSame('2026-06-01', $slots[0]['date']);
        $this->assertSame('10:00', $slots[0]['start_time']);
        $this->assertSame(45, $slots[0]['duration_min']);
    }

    /** @test */
    public function ブロック日はスロットから除外される(): void
    {
        $partner = Partner::factory()->create(['status' => 'approved']);
        PartnerSchedule::factory()->create([
            'partner_id'    => $partner->id,
            'day_of_week'   => 0, // 月曜
            'start_time_jst'=> '10:00:00',
            'duration_min'  => 45,
        ]);
        // 今日（月曜）をブロック
        PartnerScheduleBlock::factory()->create([
            'partner_id'   => $partner->id,
            'blocked_date' => '2026-06-01',
        ]);

        $slots = $this->service->getAvailableSlots($partner, 1);

        $this->assertSame([], $slots);
    }

    /** @test */
    public function 確定済み予約がある日時はスロットから除外される(): void
    {
        $partner = Partner::factory()->create(['status' => 'approved']);
        $school  = \App\Models\School::factory()->create();
        PartnerSchedule::factory()->create([
            'partner_id'    => $partner->id,
            'day_of_week'   => 0,
            'start_time_jst'=> '10:00:00',
            'duration_min'  => 45,
        ]);
        // 同日時に confirmed セッションが存在
        Session::factory()->create([
            'partner_id'   => $partner->id,
            'school_id'    => $school->id,
            'scheduled_at' => Carbon::parse('2026-06-01 10:00', 'Asia/Tokyo')->utc(),
            'status'       => 'confirmed',
        ]);

        $slots = $this->service->getAvailableSlots($partner, 1);

        $this->assertSame([], $slots);
    }

    /** @test */
    public function 今週のスロット数を正しく返す(): void
    {
        $partner = Partner::factory()->create(['status' => 'approved']);
        // 月・水・金に週次スロット
        foreach ([0, 2, 4] as $dow) {
            PartnerSchedule::factory()->create([
                'partner_id'    => $partner->id,
                'day_of_week'   => $dow,
                'start_time_jst'=> '10:00:00',
                'duration_min'  => 45,
            ]);
        }

        $count = $this->service->countThisWeekSlots($partner);

        $this->assertSame(3, $count);
    }
}
```

- [ ] **Step 3: テストが失敗することを確認（SlotServiceが存在しないため）**

```bash
php artisan test tests/Unit/SlotServiceTest.php
```

Expected: `ERROR` または `Fatal error: Class "App\Services\SlotService" not found`

- [ ] **Step 4: `app/Services/SlotService.php` を作成**

```php
<?php

namespace App\Services;

use App\Models\Partner;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class SlotService
{
    /**
     * 指定したパートナーの予約可能スロット一覧を返す。
     *
     * @return array<int, array{date: string, start_time: string, duration_min: int, schedule_id: int}>
     */
    public function getAvailableSlots(Partner $partner, int $weeks = 6): array
    {
        $tz      = 'Asia/Tokyo';
        $today   = Carbon::today($tz);
        $endDate = $today->copy()->addWeeks($weeks)->subDay();

        $schedules = $partner->schedules;

        if ($schedules->isEmpty()) {
            return [];
        }

        // ブロック日（文字列セット）
        $blockedDates = $partner->scheduleBlocks()
            ->whereBetween('blocked_date', [$today->toDateString(), $endDate->toDateString()])
            ->pluck('blocked_date')
            ->map(fn ($d) => Carbon::parse($d)->format('Y-m-d'))
            ->flip() // O(1) lookup
            ->all();

        // 確定済み予約（date+time の複合キー）
        $bookedKeys = $partner->sessions()
            ->where('status', 'confirmed')
            ->whereBetween('scheduled_at', [
                $today->copy()->startOfDay()->utc(),
                $endDate->copy()->endOfDay()->utc(),
            ])
            ->get()
            ->map(function ($s) use ($tz) {
                $jst = Carbon::parse($s->scheduled_at)->setTimezone($tz);
                return $jst->format('Y-m-d') . '_' . $jst->format('H:i');
            })
            ->flip()
            ->all();

        $slots = [];

        foreach ($schedules as $schedule) {
            $current = $today->copy();
            while ($current->lte($endDate)) {
                // dayOfWeekIso: 1=Mon…7=Sun → 0-based で 0=Mon…6=Sun
                $dow = $current->dayOfWeekIso - 1;

                if ($dow === $schedule->day_of_week) {
                    $dateStr = $current->format('Y-m-d');
                    // start_time_jst は "HH:MM:SS" で格納されているため先頭5文字を使用
                    $timeStr = substr($schedule->start_time_jst, 0, 5);
                    $key     = "{$dateStr}_{$timeStr}";

                    if (!isset($blockedDates[$dateStr]) && !isset($bookedKeys[$key])) {
                        $slots[] = [
                            'date'         => $dateStr,
                            'start_time'   => $timeStr,
                            'duration_min' => $schedule->duration_min,
                            'schedule_id'  => $schedule->id,
                        ];
                    }
                }

                $current->addDay();
            }
        }

        // 日付・時刻昇順にソート
        usort($slots, fn ($a, $b) =>
            "{$a['date']}{$a['start_time']}" <=> "{$b['date']}{$b['start_time']}"
        );

        return $slots;
    }

    /**
     * 今週（月〜日）の予約可能スロット数を返す。
     */
    public function countThisWeekSlots(Partner $partner): int
    {
        $tz          = 'Asia/Tokyo';
        $startOfWeek = Carbon::now($tz)->startOfWeek(Carbon::MONDAY)->toDateString();
        $endOfWeek   = Carbon::now($tz)->endOfWeek(Carbon::SUNDAY)->toDateString();

        // 2週分だけ取得してフィルタ（6週全展開は不要）
        $slots = $this->getAvailableSlots($partner, 2);

        return collect($slots)
            ->filter(fn ($s) => $s['date'] >= $startOfWeek && $s['date'] <= $endOfWeek)
            ->count();
    }
}
```

- [ ] **Step 5: Factoryが存在しない場合は作成**

```bash
php artisan make:factory PartnerScheduleFactory --model=PartnerSchedule
php artisan make:factory PartnerScheduleBlockFactory --model=PartnerScheduleBlock
```

`database/factories/PartnerScheduleFactory.php`:

```php
<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class PartnerScheduleFactory extends Factory
{
    public function definition(): array
    {
        return [
            'day_of_week'    => $this->faker->numberBetween(0, 6),
            'start_time_jst' => '10:00:00',
            'duration_min'   => 45,
            'max_sessions'   => 1,
        ];
    }
}
```

`database/factories/PartnerScheduleBlockFactory.php`:

```php
<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class PartnerScheduleBlockFactory extends Factory
{
    public function definition(): array
    {
        return [
            'blocked_date' => $this->faker->dateTimeBetween('now', '+6 weeks')->format('Y-m-d'),
            'reason'       => null,
        ];
    }
}
```

※ `PartnerFactory`, `SchoolFactory`, `SessionFactory` が未作成の場合も同様に作成すること。

- [ ] **Step 6: テスト実行（全パス確認）**

```bash
php artisan test tests/Unit/SlotServiceTest.php
```

Expected:
```
PASS  Tests\Unit\SlotServiceTest
✓ スケジュールがない場合は空配列を返す
✓ 週次パターンから正しくスロットを展開する
✓ ブロック日はスロットから除外される
✓ 確定済み予約がある日時はスロットから除外される
✓ 今週のスロット数を正しく返す

Tests:  5 passed
```

- [ ] **Step 7: コミット**

```bash
git add app/Services/SlotService.php tests/Unit/SlotServiceTest.php \
        database/factories/PartnerScheduleFactory.php \
        database/factories/PartnerScheduleBlockFactory.php
git commit -m "feat: add SlotService with unit tests"
```

---

## Task 5: StripeService

**Files:**
- Create: `app/Services/StripeService.php`

- [ ] **Step 1: `app/Services/StripeService.php` を作成**

```php
<?php

namespace App\Services;

use App\Models\Session;
use Stripe\StripeClient;

class StripeService
{
    private StripeClient $stripe;

    public function __construct()
    {
        $this->stripe = new StripeClient(config('services.stripe.secret'));
    }

    /**
     * Stripe Checkout Session を作成してURLを返す。
     */
    public function createCheckoutSession(
        Session $session,
        string $successUrl,
        string $cancelUrl
    ): string {
        $partnerName = $session->partner->school_name;
        $label = "WorldClass セッション（{$partnerName}）{$session->duration_min}分";

        $checkout = $this->stripe->checkout->sessions->create([
            'mode'       => 'payment',
            'line_items' => [[
                'price_data' => [
                    'currency'     => 'jpy',
                    'product_data' => ['name' => $label],
                    'unit_amount'  => $session->price_jpy,
                ],
                'quantity' => 1,
            ]],
            'metadata'    => ['session_id' => (string) $session->id],
            'success_url' => $successUrl,
            'cancel_url'  => $cancelUrl,
        ]);

        return $checkout->url;
    }

    /**
     * PaymentIntent IDを指定して全額返金する。
     */
    public function refund(string $paymentIntentId): void
    {
        $this->stripe->refunds->create([
            'payment_intent' => $paymentIntentId,
        ]);
    }
}
```

- [ ] **Step 2: `app/Providers/AppServiceProvider.php` でDIコンテナに登録**

`AppServiceProvider.php` の `register()` メソッドに追記：

```php
use App\Services\SlotService;
use App\Services\StripeService;

public function register(): void
{
    $this->app->singleton(SlotService::class);
    $this->app->singleton(StripeService::class);
}
```

- [ ] **Step 3: コミット**

```bash
git add app/Services/StripeService.php app/Providers/AppServiceProvider.php
git commit -m "feat: add StripeService and register services in AppServiceProvider"
```

---

## Task 6: CatalogController（フィルタ・一覧・詳細）

**Files:**
- Create: `app/Http/Controllers/CatalogController.php`
- Create: `tests/Feature/CatalogControllerTest.php`
- Modify: `routes/web.php`

- [ ] **Step 1: テストを先に作成**

```bash
php artisan make:test CatalogControllerTest
```

`tests/Feature/CatalogControllerTest.php` を以下に書き換え：

```php
<?php

namespace Tests\Feature;

use App\Models\Partner;
use App\Models\PartnerSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogControllerTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function 未ログインユーザーでもカタログを閲覧できる(): void
    {
        Partner::factory()->create(['status' => 'approved', 'country' => 'Philippines']);

        $response = $this->get('/catalog');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page->component('Catalog/Index'));
    }

    /** @test */
    public function 国フィルタが機能する(): void
    {
        Partner::factory()->create(['status' => 'approved', 'country' => 'Philippines']);
        Partner::factory()->create(['status' => 'approved', 'country' => 'Kenya']);

        $response = $this->get('/catalog?country=Philippines');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) =>
            $page->component('Catalog/Index')
                 ->where('partners.data.0.country', 'Philippines')
                 ->count('partners.data', 1)
        );
    }

    /** @test */
    public function 審査中の海外校はカタログに表示されない(): void
    {
        Partner::factory()->create(['status' => 'pending']);

        $response = $this->get('/catalog');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) =>
            $page->component('Catalog/Index')
                 ->count('partners.data', 0)
        );
    }

    /** @test */
    public function パートナー詳細ページが表示される(): void
    {
        $partner = Partner::factory()->create(['status' => 'approved']);
        PartnerSchedule::factory()->create(['partner_id' => $partner->id]);

        $response = $this->get("/catalog/{$partner->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) =>
            $page->component('Catalog/Show')
                 ->where('partner.id', $partner->id)
                 ->has('slots')
        );
    }
}
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
php artisan test tests/Feature/CatalogControllerTest.php
```

Expected: FAIL（ルートが存在しない）

- [ ] **Step 3: `app/Http/Controllers/CatalogController.php` を作成**

```php
<?php

namespace App\Http\Controllers;

use App\Models\Partner;
use App\Services\SlotService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CatalogController extends Controller
{
    public function __construct(private readonly SlotService $slotService) {}

    public function index(Request $request): Response
    {
        $query = Partner::where('status', 'approved')
            ->with('schedules');

        if ($request->filled('country')) {
            $query->where('country', $request->country);
        }

        if ($request->filled('time_slot')) {
            $query->whereHas('schedules', function ($q) use ($request) {
                match ($request->time_slot) {
                    'weekday_morning'   => $q->whereIn('day_of_week', [0, 1, 2, 3, 4])
                                            ->where('start_time_jst', '>=', '09:00:00')
                                            ->where('start_time_jst', '<=', '11:59:59'),
                    'weekday_afternoon' => $q->whereIn('day_of_week', [0, 1, 2, 3, 4])
                                            ->where('start_time_jst', '>=', '12:00:00')
                                            ->where('start_time_jst', '<=', '17:59:59'),
                    'weekend'           => $q->whereIn('day_of_week', [5, 6]),
                    default             => null,
                };
            });
        }

        $partners = $query->paginate(12)->through(function (Partner $p) {
            return [
                'id'              => $p->id,
                'school_name'     => $p->school_name,
                'country'         => $p->country,
                'region'          => $p->region,
                'rating_score'    => $p->rating_score,
                'slots_this_week' => $this->slotService->countThisWeekSlots($p),
            ];
        });

        $countries = Partner::where('status', 'approved')
            ->distinct()
            ->orderBy('country')
            ->pluck('country');

        return Inertia::render('Catalog/Index', [
            'partners'  => $partners,
            'countries' => $countries,
            'filters'   => $request->only(['country', 'time_slot']),
        ]);
    }

    public function show(Partner $partner): Response
    {
        abort_if($partner->status !== 'approved', 404);

        $slots = $this->slotService->getAvailableSlots($partner, 6);

        return Inertia::render('Catalog/Show', [
            'partner' => [
                'id'              => $partner->id,
                'school_name'     => $partner->school_name,
                'country'         => $partner->country,
                'region'          => $partner->region,
                'video_url'       => $partner->video_url,
                'themes'          => $partner->themes,
                'grade_range'     => $partner->grade_range,
                'rating_score'    => $partner->rating_score,
                'support_pool'    => $partner->support_pool,
            ],
            'slots' => $slots,
        ]);
    }
}
```

- [ ] **Step 4: `routes/web.php` にカタログルートを追記**

```php
use App\Http\Controllers\CatalogController;

// カタログ（誰でも閲覧可）
Route::get('/catalog', [CatalogController::class, 'index'])->name('catalog.index');
Route::get('/catalog/{partner}', [CatalogController::class, 'show'])->name('catalog.show');
```

- [ ] **Step 5: テスト実行**

```bash
php artisan test tests/Feature/CatalogControllerTest.php
```

Expected: 4 passed

- [ ] **Step 6: コミット**

```bash
git add app/Http/Controllers/CatalogController.php \
        tests/Feature/CatalogControllerTest.php \
        routes/web.php
git commit -m "feat: add CatalogController with filter and slot count"
```

---

## Task 7: Catalog React ページ

**Files:**
- Create: `resources/js/Pages/Catalog/Index.tsx`
- Create: `resources/js/Pages/Catalog/Show.tsx`

- [ ] **Step 1: `resources/js/Pages/Catalog/Index.tsx` を作成**

```tsx
import { Link, router } from '@inertiajs/react'

type Partner = {
  id: number
  school_name: string
  country: string
  region: string
  rating_score: number
  slots_this_week: number
}

type PaginatedPartners = {
  data: Partner[]
  links: { url: string | null; label: string; active: boolean }[]
}

type Props = {
  partners: PaginatedPartners
  countries: string[]
  filters: { country?: string; time_slot?: string }
}

const TIME_SLOTS = [
  { value: '', label: 'すべて' },
  { value: 'weekday_morning', label: '平日午前（9〜12時）' },
  { value: 'weekday_afternoon', label: '平日午後（12〜18時）' },
  { value: 'weekend', label: '土日' },
]

export default function CatalogIndex({ partners, countries, filters }: Props) {
  const applyFilter = (key: string, value: string) => {
    router.get('/catalog', { ...filters, [key]: value }, { preserveState: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">海外校カタログ</h1>

        {/* フィルタ */}
        <div className="flex gap-4 mb-8 flex-wrap">
          <select
            value={filters.country ?? ''}
            onChange={e => applyFilter('country', e.target.value)}
            className="border rounded-lg px-3 py-2 bg-white"
          >
            <option value="">国：すべて</option>
            {countries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={filters.time_slot ?? ''}
            onChange={e => applyFilter('time_slot', e.target.value)}
            className="border rounded-lg px-3 py-2 bg-white"
          >
            {TIME_SLOTS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* カード一覧 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.data.map(p => (
            <Link
              key={p.id}
              href={`/catalog/${p.id}`}
              className="bg-white rounded-xl shadow hover:shadow-md transition-shadow p-5 flex flex-col gap-2"
            >
              <div className="font-bold text-lg">{p.school_name}</div>
              <div className="text-gray-500 text-sm">{p.country}・{p.region}</div>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-yellow-500 font-semibold">
                  ★ {p.rating_score.toFixed(1)}
                </span>
                <span className="text-sm text-green-600 font-medium">
                  今週 残{p.slots_this_week}枠
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* ページネーション */}
        <div className="flex gap-2 mt-8 justify-center">
          {partners.links.map((link, i) => (
            link.url ? (
              <Link
                key={i}
                href={link.url}
                className={`px-3 py-1 rounded border text-sm ${
                  link.active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'
                }`}
                dangerouslySetInnerHTML={{ __html: link.label }}
              />
            ) : (
              <span
                key={i}
                className="px-3 py-1 rounded border text-sm text-gray-400 bg-white"
                dangerouslySetInnerHTML={{ __html: link.label }}
              />
            )
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `resources/js/Pages/Catalog/Show.tsx` を作成**

```tsx
import { Link, router } from '@inertiajs/react'
import { useState } from 'react'

type Slot = {
  date: string
  start_time: string
  duration_min: number
  schedule_id: number
}

type Partner = {
  id: number
  school_name: string
  country: string
  region: string
  video_url: string | null
  themes: string[]
  grade_range: string
  rating_score: number
  support_pool: number
}

type Props = {
  partner: Partner
  slots: Slot[]
}

export default function CatalogShow({ partner, slots }: Props) {
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)

  const handleBook = () => {
    if (!selectedSlot) return
    router.get('/booking/create', {
      partner_id:  partner.id,
      date:        selectedSlot.date,
      start_time:  selectedSlot.start_time,
      duration_min: selectedSlot.duration_min,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/catalog" className="text-blue-600 text-sm mb-4 inline-block">
          ← カタログに戻る
        </Link>

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h1 className="text-2xl font-bold mb-1">{partner.school_name}</h1>
          <p className="text-gray-500 mb-4">{partner.country}・{partner.region}</p>

          {partner.video_url && (
            <div className="mb-4">
              <iframe
                src={partner.video_url}
                className="w-full aspect-video rounded-lg"
                allowFullScreen
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            {partner.themes.map(t => (
              <span key={t} className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full">
                {t}
              </span>
            ))}
          </div>

          <div className="text-sm text-gray-600">
            <span>★ {partner.rating_score.toFixed(1)}</span>
            <span className="ml-4">対象学年: {partner.grade_range}</span>
          </div>
        </div>

        {/* スロット選択 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold mb-4">予約可能スロット</h2>

          {slots.length === 0 ? (
            <p className="text-gray-500">現在予約可能なスロットがありません。</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {slots.map((slot, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedSlot(slot)}
                  className={`border rounded-lg p-3 text-sm text-left transition-colors ${
                    selectedSlot?.date === slot.date && selectedSlot?.start_time === slot.start_time
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-400'
                  }`}
                >
                  <div className="font-medium">{slot.date}</div>
                  <div className="text-gray-500">{slot.start_time} ({slot.duration_min}分)</div>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleBook}
            disabled={!selectedSlot}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium
                       hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {selectedSlot
              ? `${selectedSlot.date} ${selectedSlot.start_time} で予約する`
              : 'スロットを選択してください'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: フロントをビルド**

```bash
npm run build
```

Expected: ビルドエラーなし

- [ ] **Step 4: 動作確認**

```bash
php artisan serve
```

`http://127.0.0.1:8000/catalog` を開く → カタログ一覧が表示される（データが0件でも画面が表示されればOK）

- [ ] **Step 5: コミット**

```bash
git add resources/js/Pages/Catalog/
git commit -m "feat: add Catalog/Index and Catalog/Show React pages"
```

---

## Task 8: BookingController（予約フォーム→Stripe）

**Files:**
- Create: `app/Http/Controllers/BookingController.php`
- Create: `tests/Feature/BookingControllerTest.php`
- Modify: `routes/web.php`

- [ ] **Step 1: テストを先に作成**

```bash
php artisan make:test BookingControllerTest
```

`tests/Feature/BookingControllerTest.php` を以下に書き換え：

```php
<?php

namespace Tests\Feature;

use App\Models\Partner;
use App\Models\School;
use App\Models\Session;
use App\Models\User;
use App\Services\StripeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingControllerTest extends TestCase
{
    use RefreshDatabase;

    private function schoolUser(): User
    {
        $user   = User::factory()->create(['role' => 'school']);
        $school = School::factory()->create(['user_id' => $user->id]);
        return $user;
    }

    /** @test */
    public function 未ログインは予約フォームにアクセスできない(): void
    {
        $partner = Partner::factory()->create(['status' => 'approved']);

        $this->get('/booking/create?partner_id=' . $partner->id)
             ->assertRedirect('/login');
    }

    /** @test */
    public function schoolロールの場合に予約フォームが表示される(): void
    {
        $user    = $this->schoolUser();
        $partner = Partner::factory()->create(['status' => 'approved']);

        $this->actingAs($user)
             ->get('/booking/create?' . http_build_query([
                 'partner_id'  => $partner->id,
                 'date'        => '2026-06-08',
                 'start_time'  => '10:00',
                 'duration_min'=> 45,
             ]))
             ->assertStatus(200)
             ->assertInertia(fn ($p) => $p->component('Booking/Create'));
    }

    /** @test */
    public function 予約送信でsessionsにpendingが作成される(): void
    {
        $this->mock(StripeService::class, function ($mock) {
            $mock->shouldReceive('createCheckoutSession')
                 ->once()
                 ->andReturn('https://checkout.stripe.com/test');
        });

        $user    = $this->schoolUser();
        $partner = Partner::factory()->create(['status' => 'approved']);

        $this->actingAs($user)->post('/booking', [
            'partner_id'   => $partner->id,
            'date'         => '2026-06-08',
            'start_time'   => '10:00',
            'duration_min' => 45,
            'theme'        => '文化紹介',
            'question_list'=> 'テスト質問',
        ])->assertRedirect('https://checkout.stripe.com/test');

        $this->assertDatabaseHas('sessions', [
            'partner_id' => $partner->id,
            'status'     => 'pending',
            'price_jpy'  => 8000,
        ]);
    }

    /** @test */
    public function キャンセル時にpendingセッションが削除される(): void
    {
        $user    = $this->schoolUser();
        $partner = Partner::factory()->create(['status' => 'approved']);
        $session = Session::factory()->create([
            'school_id'  => $user->school->id,
            'partner_id' => $partner->id,
            'status'     => 'pending',
        ]);

        $this->actingAs($user)
             ->get("/booking/{$session->id}/cancel")
             ->assertRedirect('/catalog');

        $this->assertDatabaseMissing('sessions', ['id' => $session->id]);
    }
}
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
php artisan test tests/Feature/BookingControllerTest.php
```

Expected: FAIL

- [ ] **Step 3: `app/Http/Controllers/BookingController.php` を作成**

```php
<?php

namespace App\Http\Controllers;

use App\Models\Partner;
use App\Models\Session;
use App\Services\StripeService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class BookingController extends Controller
{
    public function __construct(private readonly StripeService $stripeService) {}

    /** 予約フォーム画面 */
    public function create(Request $request): Response
    {
        $partner = Partner::findOrFail($request->partner_id);

        return Inertia::render('Booking/Create', [
            'partner' => [
                'id'          => $partner->id,
                'school_name' => $partner->school_name,
                'country'     => $partner->country,
                'themes'      => $partner->themes,
            ],
            'slot' => [
                'date'         => $request->date,
                'start_time'   => $request->start_time,
                'duration_min' => (int) $request->duration_min,
            ],
        ]);
    }

    /** 予約作成 → Stripe Checkout へリダイレクト */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'partner_id'    => ['required', 'exists:partners,id'],
            'date'          => ['required', 'date', 'after_or_equal:today'],
            'start_time'    => ['required', 'date_format:H:i'],
            'duration_min'  => ['required', 'in:45,60'],
            'theme'         => ['required', 'in:文化紹介,SDGs,英語教育'],
            'question_list' => ['nullable', 'string', 'max:2000'],
        ]);

        $school  = Auth::user()->school;
        $partner = Partner::findOrFail($validated['partner_id']);

        $priceMap     = [45 => 8000, 60 => 10000];
        $priceJpy     = $priceMap[$validated['duration_min']];
        $supportAmount = (int) ($priceJpy * 0.5);

        $scheduledAt = Carbon::createFromFormat(
            'Y-m-d H:i',
            "{$validated['date']} {$validated['start_time']}",
            'Asia/Tokyo'
        )->utc();

        $session = Session::create([
            'school_id'      => $school->id,
            'partner_id'     => $partner->id,
            'scheduled_at'   => $scheduledAt,
            'duration_min'   => $validated['duration_min'],
            'theme'          => $validated['theme'],
            'question_list'  => $validated['question_list'],
            'status'         => 'pending',
            'price_jpy'      => $priceJpy,
            'support_amount' => $supportAmount,
        ]);

        $checkoutUrl = $this->stripeService->createCheckoutSession(
            $session,
            route('booking.complete', $session),
            route('booking.cancel', $session)
        );

        return redirect($checkoutUrl);
    }

    /** 決済成功後の完了画面 */
    public function complete(Session $session): Response
    {
        return Inertia::render('Booking/Complete', [
            'session' => [
                'id'           => $session->id,
                'scheduled_at' => $session->scheduled_at,
                'duration_min' => $session->duration_min,
                'theme'        => $session->theme,
                'price_jpy'    => $session->price_jpy,
                'partner_name' => $session->partner->school_name,
            ],
        ]);
    }

    /** 決済キャンセル → pending を削除してカタログへ */
    public function cancel(Session $session): RedirectResponse
    {
        if ($session->status === 'pending') {
            $session->delete();
        }

        return redirect()->route('catalog.index');
    }
}
```

- [ ] **Step 4: `routes/web.php` に予約ルートを追記**

```php
use App\Http\Controllers\BookingController;

// 予約フロー（schoolロールのみ）
Route::middleware(['auth', 'role:school'])->group(function () {
    Route::get('/booking/create', [BookingController::class, 'create'])->name('booking.create');
    Route::post('/booking', [BookingController::class, 'store'])->name('booking.store');
    Route::get('/booking/{session}/complete', [BookingController::class, 'complete'])->name('booking.complete');
    Route::get('/booking/{session}/cancel', [BookingController::class, 'cancel'])->name('booking.cancel');
});
```

- [ ] **Step 5: `User` モデルの `school` リレーションを確認**

`app/Models/User.php` に `school()` リレーションが既に定義されていることを確認。
未定義の場合は追記：

```php
public function school(): \Illuminate\Database\Eloquent\Relations\HasOne
{
    return $this->hasOne(School::class);
}
```

- [ ] **Step 6: テスト実行**

```bash
php artisan test tests/Feature/BookingControllerTest.php
```

Expected: 4 passed

- [ ] **Step 7: コミット**

```bash
git add app/Http/Controllers/BookingController.php \
        tests/Feature/BookingControllerTest.php \
        routes/web.php
git commit -m "feat: add BookingController with Stripe redirect"
```

---

## Task 9: Booking React ページ

**Files:**
- Create: `resources/js/Pages/Booking/Create.tsx`
- Create: `resources/js/Pages/Booking/Complete.tsx`

- [ ] **Step 1: `resources/js/Pages/Booking/Create.tsx` を作成**

```tsx
import { useForm } from '@inertiajs/react'

type Partner = {
  id: number
  school_name: string
  country: string
  themes: string[]
}

type Slot = {
  date: string
  start_time: string
  duration_min: number
}

type Props = {
  partner: Partner
  slot: Slot
}

const THEMES = ['文化紹介', 'SDGs', '英語教育']
const PRICES: Record<number, number> = { 45: 8000, 60: 10000 }

export default function BookingCreate({ partner, slot }: Props) {
  const { data, setData, post, processing, errors } = useForm({
    partner_id:    partner.id,
    date:          slot.date,
    start_time:    slot.start_time,
    duration_min:  slot.duration_min,
    theme:         partner.themes[0] ?? '文化紹介',
    question_list: '',
  })

  const price = PRICES[data.duration_min] ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">予約内容の確認</h1>

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <p className="text-gray-500 text-sm mb-1">海外校</p>
          <p className="font-semibold mb-4">{partner.school_name}（{partner.country}）</p>

          <p className="text-gray-500 text-sm mb-1">セッション日時</p>
          <p className="font-semibold mb-4">
            {slot.date} {slot.start_time}〜（{slot.duration_min}分）
          </p>

          {/* 時間変更 */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">セッション時間</label>
            <div className="flex gap-3">
              {[45, 60].map(min => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setData('duration_min', min)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    data.duration_min === min
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-700'
                  }`}
                >
                  {min}分 ¥{PRICES[min].toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* テーマ選択 */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">テーマ</label>
            <div className="flex gap-2 flex-wrap">
              {THEMES.filter(t => partner.themes.includes(t)).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setData('theme', t)}
                  className={`px-3 py-1 rounded-full border text-sm transition-colors ${
                    data.theme === t
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {errors.theme && <p className="text-red-500 text-sm mt-1">{errors.theme}</p>}
          </div>

          {/* 質問リスト */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              質問リスト（任意・海外校へ事前共有）
            </label>
            <textarea
              value={data.question_list}
              onChange={e => setData('question_list', e.target.value)}
              rows={4}
              placeholder="例：「あなたの国の学校給食を教えてください」"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* 料金内訳 */}
          <div className="border-t pt-4 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-500">運営手数料（50%）</span>
              <span>¥{(price * 0.5).toLocaleString()}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-500">物資支援プール（50%）</span>
              <span>¥{(price * 0.5).toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-base">
              <span>合計</span>
              <span>¥{price.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => post('/booking')}
          disabled={processing}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium
                     hover:bg-blue-700 disabled:opacity-50"
        >
          {processing ? '処理中...' : `¥${price.toLocaleString()} を決済して予約する`}
        </button>

        <p className="text-center text-xs text-gray-400 mt-3">
          Stripe の決済ページに移動します
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `resources/js/Pages/Booking/Complete.tsx` を作成**

```tsx
import { Link } from '@inertiajs/react'

type Props = {
  session: {
    id: number
    scheduled_at: string
    duration_min: number
    theme: string
    price_jpy: number
    partner_name: string
  }
}

export default function BookingComplete({ session }: Props) {
  const jst = new Date(session.scheduled_at)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold mb-2">予約が完了しました</h1>
        <p className="text-gray-500 mb-6">予約番号: #{session.id}</p>

        <div className="bg-gray-50 rounded-lg p-4 text-left mb-6 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">海外校</span>
            <span className="font-medium">{session.partner_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">日時</span>
            <span className="font-medium">{jst.toLocaleString('ja-JP')}（JST）</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">時間</span>
            <span className="font-medium">{session.duration_min}分</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">テーマ</span>
            <span className="font-medium">{session.theme}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">料金</span>
            <span className="font-medium">¥{session.price_jpy.toLocaleString()}</span>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          セッション1週間前までに質問リストをお送りください。
          確認メールをご確認ください。
        </p>

        <Link
          href="/school/dashboard"
          className="block w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
        >
          ダッシュボードへ
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: ビルド**

```bash
npm run build
```

- [ ] **Step 4: コミット**

```bash
git add resources/js/Pages/Booking/
git commit -m "feat: add Booking/Create and Booking/Complete React pages"
```

---

## Task 10: WebhookController（Stripe Webhook確定処理）

**Files:**
- Create: `app/Http/Controllers/WebhookController.php`
- Create: `tests/Feature/WebhookControllerTest.php`
- Modify: `bootstrap/app.php`（CSRF除外）
- Modify: `routes/web.php`

- [ ] **Step 1: Webhook ルートを CSRF 除外**

`bootstrap/app.php` の `withMiddleware` ブロックに追記：

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->validateCsrfTokens(except: [
        'stripe/webhook',
    ]);

    $middleware->alias([
        'role' => \App\Http\Middleware\EnsureRole::class,
    ]);
})
```

- [ ] **Step 2: テストを作成**

```bash
php artisan make:test WebhookControllerTest
```

`tests/Feature/WebhookControllerTest.php` を以下に書き換え：

```php
<?php

namespace Tests\Feature;

use App\Models\Partner;
use App\Models\School;
use App\Models\Session;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WebhookControllerTest extends TestCase
{
    use RefreshDatabase;

    private function makePayload(int $sessionId, string $paymentIntentId): string
    {
        return json_encode([
            'type' => 'checkout.session.completed',
            'data' => [
                'object' => [
                    'payment_intent' => $paymentIntentId,
                    'metadata'       => ['session_id' => (string) $sessionId],
                ],
            ],
        ]);
    }

    /** @test */
    public function 署名が不正な場合は400を返す(): void
    {
        $this->post('/stripe/webhook', [], ['Stripe-Signature' => 'invalid'])
             ->assertStatus(400);
    }

    /** @test */
    public function checkout_session_completedでsessionがconfirmedになる(): void
    {
        // 署名検証をスキップするため config を dummy に設定
        config(['services.stripe.webhook_secret' => 'whsec_test']);

        $user    = User::factory()->create(['role' => 'school']);
        $school  = School::factory()->create(['user_id' => $user->id]);
        $partner = Partner::factory()->create(['status' => 'approved']);
        $session = Session::factory()->create([
            'school_id'  => $school->id,
            'partner_id' => $partner->id,
            'status'     => 'pending',
        ]);

        $payload = $this->makePayload($session->id, 'pi_test_123');

        // テスト環境では署名検証を bypass するため WebhookController 内で
        // APP_ENV=testing の場合は署名スキップの分岐を入れる（Step 3参照）
        $this->post('/stripe/webhook', [], [
            'Stripe-Signature' => 'bypass',
            'Content-Type'     => 'application/json',
        ])->assertStatus(200);

        // ペイロードを直接送信するカスタムヘルパーを使う
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class)
             ->call('POST', '/stripe/webhook', [], [], [], [
                 'HTTP_STRIPE_SIGNATURE' => 'bypass',
                 'CONTENT_TYPE'          => 'application/json',
             ], $payload)
             ->assertStatus(200);

        $this->assertDatabaseHas('sessions', [
            'id'                => $session->id,
            'status'            => 'confirmed',
            'stripe_payment_id' => 'pi_test_123',
        ]);
    }
}
```

- [ ] **Step 3: `app/Http/Controllers/WebhookController.php` を作成**

```php
<?php

namespace App\Http\Controllers;

use App\Models\Session;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

class WebhookController extends Controller
{
    public function handle(Request $request): Response
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature', '');
        $secret = config('services.stripe.webhook_secret');

        // テスト環境では署名検証をスキップ
        if (app()->environment('testing') && $sigHeader === 'bypass') {
            $event = json_decode($payload, true);
        } else {
            try {
                $event = Webhook::constructEvent($payload, $sigHeader, $secret);
                $event = json_decode(json_encode($event), true);
            } catch (SignatureVerificationException $e) {
                return response('Invalid signature', 400);
            }
        }

        if ($event['type'] === 'checkout.session.completed') {
            $obj             = $event['data']['object'];
            $sessionId       = $obj['metadata']['session_id'] ?? null;
            $paymentIntentId = $obj['payment_intent'] ?? null;

            if ($sessionId && $paymentIntentId) {
                Session::where('id', $sessionId)
                    ->where('status', 'pending')
                    ->update([
                        'status'            => 'confirmed',
                        'stripe_payment_id' => $paymentIntentId,
                    ]);
            }
        }

        return response('OK', 200);
    }
}
```

- [ ] **Step 4: `routes/web.php` にWebhookルートを追記**

```php
use App\Http\Controllers\WebhookController;

// Stripe Webhook（認証・CSRF不要）
Route::post('/stripe/webhook', [WebhookController::class, 'handle']);
```

- [ ] **Step 5: テスト実行**

```bash
php artisan test tests/Feature/WebhookControllerTest.php
```

Expected: 2 passed

- [ ] **Step 6: コミット**

```bash
git add app/Http/Controllers/WebhookController.php \
        tests/Feature/WebhookControllerTest.php \
        bootstrap/app.php \
        routes/web.php
git commit -m "feat: add WebhookController for Stripe checkout.session.completed"
```

---

## Task 11: ProcessCancellation Job

**Files:**
- Create: `app/Jobs/ProcessCancellation.php`

- [ ] **Step 1: Jobクラスを作成**

```bash
php artisan make:job ProcessCancellation
```

- [ ] **Step 2: `app/Jobs/ProcessCancellation.php` を以下に書き換え**

```php
<?php

namespace App\Jobs;

use App\Models\Coupon;
use App\Models\Session;
use App\Services\StripeService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class ProcessCancellation implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private readonly Session $session,
        private readonly string $reason = 'システムによるキャンセル'
    ) {}

    public function handle(StripeService $stripeService): void
    {
        // すでにキャンセル済みなら何もしない
        if ($this->session->status === 'cancelled') {
            return;
        }

        // Stripe 返金
        if ($this->session->stripe_payment_id) {
            $stripeService->refund($this->session->stripe_payment_id);
        }

        // ステータス更新
        $this->session->update([
            'status'       => 'cancelled',
            'cancelled_at' => now(),
        ]);

        // 10% 割引クーポン発行（学校向け）
        Coupon::create([
            'school_id'    => $this->session->school_id,
            'discount_pct' => 10,
            'reason'       => $this->reason,
            'expires_at'   => now()->addMonths(3),
        ]);

        // メール通知（未実装の場合はコメントアウト）
        // Mail::to($this->session->school->user->email)
        //     ->send(new \App\Mail\SessionCancelled($this->session));
    }
}
```

- [ ] **Step 3: Queue ドライバーを database に設定（`.env`）**

```env
QUEUE_CONNECTION=database
```

- [ ] **Step 4: キューテーブルを作成**

```bash
php artisan queue:table
php artisan migrate
```

Expected: `Migrated: xxxx_create_jobs_table`

- [ ] **Step 5: コミット**

```bash
git add app/Jobs/ProcessCancellation.php database/migrations/
git commit -m "feat: add ProcessCancellation job with Stripe refund and coupon"
```

---

## Task 12: パートナー・スケジュール管理（海外校ダッシュボード）

**Files:**
- Create: `app/Http/Controllers/Partner/ScheduleController.php`
- Modify: `routes/web.php`
- Modify: `resources/js/Pages/Dashboard/Partner.tsx`

- [ ] **Step 1: `app/Http/Controllers/Partner/ScheduleController.php` を作成**

```bash
mkdir -p app/Http/Controllers/Partner
```

```php
<?php

namespace App\Http\Controllers\Partner;

use App\Http\Controllers\Controller;
use App\Models\PartnerSchedule;
use App\Models\PartnerScheduleBlock;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ScheduleController extends Controller
{
    private function partner(): \App\Models\Partner
    {
        return Auth::user()->partner;
    }

    /** 週次スロット登録 */
    public function storeSchedule(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'day_of_week'    => ['required', 'integer', 'between:0,6'],
            'start_time_jst' => ['required', 'date_format:H:i'],
            'duration_min'   => ['required', 'in:45,60'],
        ]);

        $this->partner()->schedules()->create([
            'day_of_week'    => $validated['day_of_week'],
            'start_time_jst' => $validated['start_time_jst'] . ':00',
            'duration_min'   => $validated['duration_min'],
            'max_sessions'   => 1,
        ]);

        return back();
    }

    /** 週次スロット削除 */
    public function destroySchedule(PartnerSchedule $schedule): RedirectResponse
    {
        abort_if($schedule->partner_id !== $this->partner()->id, 403);
        $schedule->delete();
        return back();
    }

    /** ブロック日登録 */
    public function storeBlock(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'blocked_date' => ['required', 'date', 'after_or_equal:today'],
            'reason'       => ['nullable', 'string', 'max:255'],
        ]);

        $this->partner()->scheduleBlocks()->updateOrCreate(
            ['blocked_date' => $validated['blocked_date']],
            ['reason'       => $validated['reason'] ?? null]
        );

        return back();
    }

    /** ブロック日削除 */
    public function destroyBlock(PartnerScheduleBlock $block): RedirectResponse
    {
        abort_if($block->partner_id !== $this->partner()->id, 403);
        $block->delete();
        return back();
    }
}
```

- [ ] **Step 2: `routes/web.php` にパートナースケジュールルートを追記**

```php
use App\Http\Controllers\Partner\ScheduleController;

Route::middleware(['auth', 'role:partner'])->prefix('partner')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'partner'])->name('partner.dashboard');

    // スケジュール管理
    Route::post('/schedules', [ScheduleController::class, 'storeSchedule'])->name('partner.schedules.store');
    Route::delete('/schedules/{schedule}', [ScheduleController::class, 'destroySchedule'])->name('partner.schedules.destroy');
    Route::post('/schedules/blocks', [ScheduleController::class, 'storeBlock'])->name('partner.blocks.store');
    Route::delete('/schedules/blocks/{block}', [ScheduleController::class, 'destroyBlock'])->name('partner.blocks.destroy');
});
```

- [ ] **Step 3: `DashboardController::partner()` を更新してスケジュールデータを渡す**

`app/Http/Controllers/DashboardController.php` を以下に更新：

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function school(): Response
    {
        $school = Auth::user()->school;

        return Inertia::render('Dashboard/School', [
            'school' => $school,
        ]);
    }

    public function partner(): Response
    {
        $partner = Auth::user()->partner->load(['schedules', 'scheduleBlocks']);

        return Inertia::render('Dashboard/Partner', [
            'partner'   => $partner,
            'schedules' => $partner->schedules,
            'blocks'    => $partner->scheduleBlocks,
        ]);
    }
}
```

- [ ] **Step 4: `resources/js/Pages/Dashboard/Partner.tsx` を作成**

```tsx
import { useForm } from '@inertiajs/react'
import { router } from '@inertiajs/react'

type Schedule = {
  id: number
  day_of_week: number
  start_time_jst: string
  duration_min: number
}

type Block = {
  id: number
  blocked_date: string
  reason: string | null
}

type Props = {
  partner: { school_name: string; country: string; status: string }
  schedules: Schedule[]
  blocks: Block[]
}

const DOW_LABELS = ['月', '火', '水', '木', '金', '土', '日']

export default function PartnerDashboard({ partner, schedules, blocks }: Props) {
  const scheduleForm = useForm({
    day_of_week: 0,
    start_time_jst: '10:00',
    duration_min: 45,
  })

  const blockForm = useForm({
    blocked_date: '',
    reason: '',
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">{partner.school_name}</h1>
          <p className="text-gray-500">{partner.country}</p>
          <span className={`text-sm px-2 py-0.5 rounded-full mt-1 inline-block ${
            partner.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {partner.status === 'approved' ? '承認済み' : '審査中'}
          </span>
        </div>

        {/* 週次スケジュール */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold mb-4">週次スロット設定</h2>

          <div className="flex gap-3 mb-4 flex-wrap">
            <select
              value={scheduleForm.data.day_of_week}
              onChange={e => scheduleForm.setData('day_of_week', Number(e.target.value))}
              className="border rounded-lg px-3 py-2"
            >
              {DOW_LABELS.map((label, i) => (
                <option key={i} value={i}>{label}曜日</option>
              ))}
            </select>

            <input
              type="time"
              value={scheduleForm.data.start_time_jst}
              onChange={e => scheduleForm.setData('start_time_jst', e.target.value)}
              className="border rounded-lg px-3 py-2"
            />

            <select
              value={scheduleForm.data.duration_min}
              onChange={e => scheduleForm.setData('duration_min', Number(e.target.value))}
              className="border rounded-lg px-3 py-2"
            >
              <option value={45}>45分</option>
              <option value={60}>60分</option>
            </select>

            <button
              onClick={() => scheduleForm.post('/partner/schedules')}
              disabled={scheduleForm.processing}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              追加
            </button>
          </div>

          {schedules.length === 0 ? (
            <p className="text-gray-400 text-sm">スロットが登録されていません。</p>
          ) : (
            <ul className="space-y-2">
              {schedules.map(s => (
                <li key={s.id} className="flex items-center justify-between border rounded-lg px-4 py-2">
                  <span className="text-sm">
                    毎週{DOW_LABELS[s.day_of_week]}曜 {s.start_time_jst.slice(0, 5)}（{s.duration_min}分）
                  </span>
                  <button
                    onClick={() => router.delete(`/partner/schedules/${s.id}`)}
                    className="text-red-500 text-sm hover:underline"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ブロック日設定 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold mb-4">ブロック日（お休み）設定</h2>

          <div className="flex gap-3 mb-4 flex-wrap">
            <input
              type="date"
              value={blockForm.data.blocked_date}
              onChange={e => blockForm.setData('blocked_date', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="border rounded-lg px-3 py-2"
            />

            <input
              type="text"
              value={blockForm.data.reason}
              onChange={e => blockForm.setData('reason', e.target.value)}
              placeholder="理由（任意）"
              className="border rounded-lg px-3 py-2 flex-1"
            />

            <button
              onClick={() => blockForm.post('/partner/schedules/blocks')}
              disabled={blockForm.processing || !blockForm.data.blocked_date}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              ブロック
            </button>
          </div>

          {blocks.length === 0 ? (
            <p className="text-gray-400 text-sm">ブロック日が設定されていません。</p>
          ) : (
            <ul className="space-y-2">
              {blocks.map(b => (
                <li key={b.id} className="flex items-center justify-between border rounded-lg px-4 py-2">
                  <span className="text-sm">
                    {b.blocked_date}{b.reason ? `（${b.reason}）` : ''}
                  </span>
                  <button
                    onClick={() => router.delete(`/partner/schedules/blocks/${b.id}`)}
                    className="text-red-500 text-sm hover:underline"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: ビルド**

```bash
npm run build
```

- [ ] **Step 6: コミット**

```bash
git add app/Http/Controllers/Partner/ \
        app/Http/Controllers/DashboardController.php \
        resources/js/Pages/Dashboard/Partner.tsx \
        routes/web.php
git commit -m "feat: add partner schedule management UI and ScheduleController"
```

---

## セルフレビュー

**スペックカバレッジ:**

| 要件 | 対応Task |
|---|---|
| 週次スロットパターン（day_of_week + start_time_jst） | Task 2, 3 |
| 例外ブロック（blocked_date） | Task 2, 3, 12 |
| スロット生成ロジック（ブロック・確定済み予約を除外） | Task 4 |
| カタログ一覧（国・時間帯フィルタ） | Task 6 |
| カード表示（学校名・国・★・今週残枠） | Task 6, 7 |
| 詳細ページ（VTR・テーマ・スロット選択） | Task 6, 7 |
| 予約フォーム（テンプレ選択・質問リスト・料金内訳） | Task 8, 9 |
| Stripe Checkout 即時キャプチャ | Task 5, 8 |
| Webhook で confirmed 確定 | Task 10 |
| キャンセル時の pending 削除 | Task 8 |
| キャンセルポリシー（返金・クーポン） | Task 11 |
| 海外校スケジュール管理UI | Task 12 |

**プレースホルダーなし:** 全Taskにコード記載済み。

**型一貫性チェック:**
- `SlotService::getAvailableSlots()` の戻り値 `['date', 'start_time', 'duration_min', 'schedule_id']` → `Catalog/Show.tsx` の `Slot` 型と一致 ✅
- `Session::price_jpy` は `Task 8` の `$priceMap` で設定 → `ProcessCancellation` で `stripe_payment_id` を参照 ✅
- `day_of_week` は 0=Mon…6=Sun で `SlotService` と `ScheduleController` で統一 ✅
- `start_time_jst` は DB に `HH:MM:SS` で格納、`SlotService` で `substr(..., 0, 5)` で `HH:MM` を取り出す ✅

**未実装（Phase 3以降）:**
- ⏭️ 確認メール送信（Session::Mail）
- ⏭️ 準備フロー（質問リスト送付・ready_checked_at 管理）
- ⏭️ キャンセルの自動スケジュール（`scheduled:run` でのチェック）
- ⏭️ 自治体ダッシュボード
