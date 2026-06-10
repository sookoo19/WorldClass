# WorldClass Phase 2: カタログ・予約・決済 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** カタログ（パートナー一覧・フィルタ・詳細）、スロット管理（週次パターン＋例外ブロック）、専用セッション予約フロー（テンプレ選択→Stripe決済）、Webhook確定処理を実装する。

**Architecture:** 決済・確定は **participant（`session_participants`）単位**。予約時に `sessions`（枠・draft）＋ participant（pending）を作成し、Webhookで両者を確定する。この構造はPhase 2.5（オープンセッション）と共通。スロット生成はSlotService、決済はStripeService（Checkoutリダイレクト方式）。

**Tech Stack:** Laravel 13, Inertia.js + React (.tsx), Stripe PHP SDK, PostgreSQL, Redis Queue

**Spec:** `docs/superpowers/specs/2026-05-24-worldclass-phase2-design.md`

> **改訂履歴（2026-06-10 全面改訂）:**
> - 新DB設計（`members` / `sessions`＋`session_participants` 二層・`ThemeType` enum）に全コードを書き直し
> - **セキュリティ修正:** 予約時のスロット実在性のサーバー側再検証 / `cancel`・`complete` の所有者チェック / Webhook署名検証のfail-closed化（テスト環境のみbypass） / `support_pool` の公開カタログからの除去 / 放置pendingの自動掃除Job
> - 確定事項を反映: 予約締切1週間前 / 時間帯フィルタ（午前9-12・午後13-18・土日終日） / ファシリテーターオプション / Queue=Redis
> - 旧Task 11（ProcessCancellation）は廃止。キャンセル処理はPhase 2.5の `ProcessSessionCancellation`（participant単位返金）が担う

**前提:** Phase 1 完了（`members`/`partners`/`sessions`/`session_participants` テーブル・`role` ミドルウェア・`member.dashboard`/`partner.dashboard` ルート・`ThemeType` enum: `culture`/`english`/`global`）。すべてのコマンドは `docker compose exec app` 内で実行。

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
  ExpirePendingApplicationsJob.php
app/Mail/
  BookingConfirmed.php        # member宛 確認メール
  BookingReceived.php         # partner宛 新規予約通知
resources/js/Pages/
  Catalog/Index.tsx
  Catalog/Show.tsx
  Booking/Create.tsx
  Booking/Complete.tsx
tests/Unit/SlotServiceTest.php
tests/Feature/
  CatalogControllerTest.php
  BookingControllerTest.php
  WebhookControllerTest.php
  ExpirePendingApplicationsJobTest.php
```

**既存ファイル変更:**
```
app/Models/Partner.php         ← schedules/scheduleBlocks/sessions リレーション
app/Models/User.php            ← member()/partner() リレーション（未定義なら）
bootstrap/app.php              ← Webhook を CSRF 除外
routes/web.php, routes/console.php
config/services.php            ← Stripe キー追加
.env.example
```

---

## Task 1: Stripe SDK・設定・Queue確認

**Files:**
- Modify: `composer.json` / `config/services.php` / `.env` / `.env.example`

- [ ] **Step 1: Stripe PHP SDKをインストール**

```bash
docker compose exec app composer require stripe/stripe-php
```

Expected: `./composer.json has been updated`

- [ ] **Step 2: `config/services.php` にStripe設定追加**

```php
'stripe' => [
    'key'            => env('STRIPE_KEY'),
    'secret'         => env('STRIPE_SECRET'),
    'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
],
```

- [ ] **Step 3: `.env` にキー追加・`.env.example` にキー名を追加**

`.env`（実キーはStripeダッシュボードのテストキー）:

```env
STRIPE_KEY=pk_test_xxxxxxxxxxxxxxxx
STRIPE_SECRET=sk_test_xxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
```

`.env.example` には値なしでキー名のみ記載。

- [ ] **Step 4: Queue接続がRedisであることを確認**

`.env` の `QUEUE_CONNECTION=redis` を確認（Phase 1で設定済みのはず。`database` になっていたら `redis` に変更し `.env.example` も揃える）。

- [ ] **Step 5: コミット**

```bash
git add composer.json composer.lock config/services.php .env.example
git commit -m "feat(stripe): install stripe/stripe-php and add config"
```

---

## Task 2: DBマイグレーション（スロット管理テーブル）

**Files:**
- Create: `database/migrations/xxxx_create_partner_schedules_table.php`
- Create: `database/migrations/xxxx_create_partner_schedule_blocks_table.php`

- [ ] **Step 1: マイグレーションファイル作成**

```bash
docker compose exec app php artisan make:migration create_partner_schedules_table
docker compose exec app php artisan make:migration create_partner_schedule_blocks_table
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
            $table->unsignedTinyInteger('day_of_week'); // 0=Mon … 6=Sun（JST基準）
            $table->time('start_time_jst');             // 例: "10:00:00"
            $table->unsignedInteger('duration_min');    // 45 or 60
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

            $table->unique(['partner_id', 'blocked_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partner_schedule_blocks');
    }
};
```

- [ ] **Step 4: 実行・コミット**

```bash
docker compose exec app php artisan migrate
```

Expected: 2件 Migrated

```bash
git add database/migrations/
git commit -m "feat(db): add partner_schedules and partner_schedule_blocks tables"
```

---

## Task 3: Eloquentモデル・リレーション

**Files:**
- Create: `app/Models/PartnerSchedule.php` / `app/Models/PartnerScheduleBlock.php`
- Modify: `app/Models/Partner.php` / `app/Models/User.php`

- [ ] **Step 1: `app/Models/PartnerSchedule.php` を作成**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['partner_id', 'day_of_week', 'start_time_jst', 'duration_min', 'max_sessions'])]
class PartnerSchedule extends Model
{
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

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['partner_id', 'blocked_date', 'reason'])]
class PartnerScheduleBlock extends Model
{
    protected $casts = [
        'blocked_date' => 'date',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }
}
```

- [ ] **Step 3: `app/Models/Partner.php` にリレーション追加**

```php
public function schedules(): \Illuminate\Database\Eloquent\Relations\HasMany
{
    return $this->hasMany(PartnerSchedule::class);
}

public function scheduleBlocks(): \Illuminate\Database\Eloquent\Relations\HasMany
{
    return $this->hasMany(PartnerScheduleBlock::class);
}

public function sessions(): \Illuminate\Database\Eloquent\Relations\HasMany
{
    return $this->hasMany(Session::class);
}
```

- [ ] **Step 4: `app/Models/User.php` に member/partner リレーション（未定義の場合）**

```php
public function member(): \Illuminate\Database\Eloquent\Relations\HasOne
{
    return $this->hasOne(Member::class);
}

public function partner(): \Illuminate\Database\Eloquent\Relations\HasOne
{
    return $this->hasOne(Partner::class);
}
```

- [ ] **Step 5: コミット**

```bash
git add app/Models/
git commit -m "feat(model): add PartnerSchedule/PartnerScheduleBlock and relations"
```

---

## Task 4: SlotService（TDD）

「週次パターン＋例外ブロック＋既存予約」から予約可能スロットを生成する。**窓は7日後〜42日後**（予約締切=1週間前）。衝突判定は**枠を塞ぐ全ステータス**（draft/open/confirmed/ready）を対象にする — pending決済中のdraft枠も塞ぐことで超過販売を防ぐ。

**Files:**
- Create: `app/Services/SlotService.php`
- Test: `tests/Unit/SlotServiceTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Unit/SlotServiceTest.php`:

```php
<?php

namespace Tests\Unit;

use App\Models\Partner;
use App\Models\PartnerSchedule;
use App\Models\PartnerScheduleBlock;
use App\Models\Session;
use App\Models\User;
use App\Services\SlotService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SlotServiceTest extends TestCase
{
    use RefreshDatabase;

    private SlotService $service;
    private Partner $partner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new SlotService();
        // 「今日」を2026-06-01(月) JST に固定
        Carbon::setTestNow(Carbon::parse('2026-06-01 00:00:00', 'Asia/Tokyo'));

        $user = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => 'x', 'role' => 'partner']);
        $this->partner = Partner::create([
            'user_id' => $user->id, 'provider_type' => 'school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function addSchedule(int $dow, string $time = '10:00:00'): void
    {
        PartnerSchedule::create([
            'partner_id' => $this->partner->id, 'day_of_week' => $dow,
            'start_time_jst' => $time, 'duration_min' => 45, 'max_sessions' => 1,
        ]);
    }

    public function test_スケジュールがない場合は空配列(): void
    {
        $this->assertSame([], $this->service->getAvailableSlots($this->partner));
    }

    public function test_1週間以内の枠は予約締切のため表示されない(): void
    {
        $this->addSchedule(0); // 毎週月曜10:00

        $slots = $this->service->getAvailableSlots($this->partner);

        // 今日(6/1月)・翌週(6/8月=7日後)は対象、ただし窓は「7日後から」→ 6/1は除外・6/8は含む
        $dates = array_column($slots, 'date');
        $this->assertNotContains('2026-06-01', $dates);
        $this->assertContains('2026-06-08', $dates);
    }

    public function test_ブロック日は除外される(): void
    {
        $this->addSchedule(0);
        PartnerScheduleBlock::create([
            'partner_id' => $this->partner->id, 'blocked_date' => '2026-06-08',
        ]);

        $dates = array_column($this->service->getAvailableSlots($this->partner), 'date');

        $this->assertNotContains('2026-06-08', $dates);
        $this->assertContains('2026-06-15', $dates);
    }

    public function test_枠を塞ぐステータスのセッションがある日時は除外される(): void
    {
        $this->addSchedule(0);
        // draft（決済中の仮押さえ）でも塞ぐ
        Session::create([
            'partner_id' => $this->partner->id, 'session_type' => 'private',
            'scheduled_at' => Carbon::parse('2026-06-08 10:00', 'Asia/Tokyo'),
            'duration_min' => 45, 'theme' => 'culture', 'capacity' => 1, 'min_groups' => 1,
            'price_jpy' => 8000, 'status' => 'draft',
        ]);

        $dates = array_column($this->service->getAvailableSlots($this->partner), 'date');

        $this->assertNotContains('2026-06-08', $dates);
    }

    public function test_キャンセル済みセッションの枠は再度予約可能(): void
    {
        $this->addSchedule(0);
        Session::create([
            'partner_id' => $this->partner->id, 'session_type' => 'private',
            'scheduled_at' => Carbon::parse('2026-06-08 10:00', 'Asia/Tokyo'),
            'duration_min' => 45, 'theme' => 'culture', 'capacity' => 1, 'min_groups' => 1,
            'price_jpy' => 8000, 'status' => 'cancelled',
        ]);

        $dates = array_column($this->service->getAvailableSlots($this->partner), 'date');

        $this->assertContains('2026-06-08', $dates);
    }

    public function test_isAvailableでスロット実在性を検証できる(): void
    {
        $this->addSchedule(0); // 月曜10:00 45分

        $this->assertTrue($this->service->isAvailable($this->partner, '2026-06-08', '10:00', 45));
        $this->assertFalse($this->service->isAvailable($this->partner, '2026-06-08', '03:00', 45)); // スケジュール外
        $this->assertFalse($this->service->isAvailable($this->partner, '2026-06-02', '10:00', 45)); // 火曜=スケジュール外
        $this->assertFalse($this->service->isAvailable($this->partner, '2026-06-01', '10:00', 45)); // 締切超過（7日以内）
    }

    public function test_直近2週間のスロット数を返す(): void
    {
        foreach ([0, 2, 4] as $dow) { // 月水金
            $this->addSchedule($dow);
        }

        // 窓7日後〜: 6/8(月),6/10(水),6/12(金),6/15(月)... 直近2週間(6/8〜6/21)=6枠
        $this->assertSame(6, $this->service->countUpcomingSlots($this->partner));
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Unit/SlotServiceTest.php
```

Expected: FAIL（SlotService未定義）

- [ ] **Step 3: `app/Services/SlotService.php` を実装**

```php
<?php

namespace App\Services;

use App\Models\Partner;
use Carbon\Carbon;

class SlotService
{
    /** 枠を塞ぐステータス（pending決済中のdraftも含めて超過販売を防ぐ） */
    private const BLOCKING_STATUSES = ['draft', 'open', 'confirmed', 'ready'];

    /**
     * 予約可能スロット一覧（7日後〜42日後・JST）。
     *
     * @return array<int, array{date: string, start_time: string, duration_min: int, schedule_id: int}>
     */
    public function getAvailableSlots(Partner $partner): array
    {
        $tz        = 'Asia/Tokyo';
        $startDate = Carbon::today($tz)->addDays(7); // 予約締切=1週間前
        $endDate   = Carbon::today($tz)->addDays(42);

        $schedules = $partner->schedules;

        if ($schedules->isEmpty()) {
            return [];
        }

        $blockedDates = $partner->scheduleBlocks()
            ->whereBetween('blocked_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->pluck('blocked_date')
            ->map(fn ($d) => Carbon::parse($d)->format('Y-m-d'))
            ->flip()
            ->all();

        $bookedKeys = $partner->sessions()
            ->whereIn('status', self::BLOCKING_STATUSES)
            ->whereBetween('scheduled_at', [
                $startDate->copy()->startOfDay(),
                $endDate->copy()->endOfDay(),
            ])
            ->get()
            ->map(fn ($s) => $s->scheduled_at->setTimezone($tz)->format('Y-m-d_H:i'))
            ->flip()
            ->all();

        $slots = [];

        foreach ($schedules as $schedule) {
            $current = $startDate->copy();
            while ($current->lte($endDate)) {
                $dow = $current->dayOfWeekIso - 1; // 0=Mon…6=Sun

                if ($dow === $schedule->day_of_week) {
                    $dateStr = $current->format('Y-m-d');
                    $timeStr = substr($schedule->start_time_jst, 0, 5);
                    $key     = "{$dateStr}_{$timeStr}";

                    if (! isset($blockedDates[$dateStr]) && ! isset($bookedKeys[$key])) {
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

        usort($slots, fn ($a, $b) => "{$a['date']}{$a['start_time']}" <=> "{$b['date']}{$b['start_time']}");

        return $slots;
    }

    /**
     * 指定日時がこのパートナーの予約可能スロットとして実在するか。
     * 予約POSTのサーバー側再検証に使用する（スケジュール外日時・締切超過・
     * ダブルブッキングをすべて弾く）。
     */
    public function isAvailable(Partner $partner, string $date, string $startTime, int $durationMin): bool
    {
        foreach ($this->getAvailableSlots($partner) as $slot) {
            if ($slot['date'] === $date
                && $slot['start_time'] === $startTime
                && $slot['duration_min'] === $durationMin) {
                return true;
            }
        }

        return false;
    }

    /** 直近2週間（窓の先頭から14日間）の予約可能スロット数 */
    public function countUpcomingSlots(Partner $partner): int
    {
        $tz    = 'Asia/Tokyo';
        $start = Carbon::today($tz)->addDays(7)->toDateString();
        $end   = Carbon::today($tz)->addDays(20)->toDateString();

        return collect($this->getAvailableSlots($partner))
            ->filter(fn ($s) => $s['date'] >= $start && $s['date'] <= $end)
            ->count();
    }
}
```

- [ ] **Step 4: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Unit/SlotServiceTest.php
```

Expected: PASS（7件）

```bash
git add app/Services/SlotService.php tests/Unit/SlotServiceTest.php
git commit -m "feat(slot): add SlotService with 1-week deadline window and server-side validation"
```

---

## Task 5: StripeService（participant単位Checkout）

**Files:**
- Create: `app/Services/StripeService.php`
- Modify: `app/Providers/AppServiceProvider.php`

- [ ] **Step 1: `app/Services/StripeService.php` を作成**

```php
<?php

namespace App\Services;

use App\Models\SessionParticipant;
use Stripe\StripeClient;

class StripeService
{
    private StripeClient $stripe;

    public function __construct()
    {
        $this->stripe = new StripeClient(config('services.stripe.secret'));
    }

    /**
     * participant単位のCheckout Sessionを作成してURLを返す。
     * 専用セッション・オープンセッション共通（金額はサーバー側のprice_paidを使用）。
     */
    public function createParticipantCheckout(
        SessionParticipant $participant,
        string $successUrl,
        string $cancelUrl
    ): string {
        $session = $participant->session;
        $label = "WorldClass セッション（{$session->partner->display_name}）{$session->duration_min}分";

        $checkout = $this->stripe->checkout->sessions->create([
            'mode'       => 'payment',
            'line_items' => [[
                'price_data' => [
                    'currency'     => 'jpy',
                    'product_data' => ['name' => $label],
                    'unit_amount'  => $participant->price_paid,
                ],
                'quantity' => 1,
            ]],
            'metadata'    => ['participant_id' => (string) $participant->id],
            'success_url' => $successUrl,
            'cancel_url'  => $cancelUrl,
        ]);

        return $checkout->url;
    }

    /** PaymentIntent IDを指定して全額返金する */
    public function refund(string $paymentIntentId): void
    {
        $this->stripe->refunds->create([
            'payment_intent' => $paymentIntentId,
        ]);
    }
}
```

- [ ] **Step 2: DIコンテナ登録**

`app/Providers/AppServiceProvider.php` の `register()` に追記:

```php
$this->app->singleton(\App\Services\SlotService::class);
$this->app->singleton(\App\Services\StripeService::class);
```

- [ ] **Step 3: コミット**

```bash
git add app/Services/StripeService.php app/Providers/AppServiceProvider.php
git commit -m "feat(stripe): add participant-based StripeService"
```

---

## Task 6: CatalogController（TDD）

**Files:**
- Create: `app/Http/Controllers/CatalogController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/CatalogControllerTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Feature/CatalogControllerTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Partner;
use App\Models\PartnerSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogControllerTest extends TestCase
{
    use RefreshDatabase;

    private function makePartner(string $status = 'approved', string $country = 'Kenya'): Partner
    {
        $user = User::create(['name' => 'P', 'email' => uniqid().'@example.com', 'password' => 'x', 'role' => 'partner']);

        return Partner::create([
            'user_id' => $user->id, 'provider_type' => 'school', 'display_name' => 'School '.$country,
            'country' => $country, 'region' => 'R', 'contact_name' => 'T', 'status' => $status,
            'themes' => ['culture', 'english'], 'grade_range' => '1-6',
        ]);
    }

    public function test_未ログインでもカタログを閲覧できる(): void
    {
        $this->makePartner();

        $this->get('/catalog')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Catalog/Index'));
    }

    public function test_国フィルタが機能する(): void
    {
        $this->makePartner(country: 'Kenya');
        $this->makePartner(country: 'Ghana');

        $this->get('/catalog?country=Kenya')
            ->assertInertia(fn ($page) => $page
                ->component('Catalog/Index')
                ->where('partners.data.0.country', 'Kenya')
                ->count('partners.data', 1));
    }

    public function test_審査中パートナーは表示されない(): void
    {
        $this->makePartner(status: 'pending');

        $this->get('/catalog')
            ->assertInertia(fn ($page) => $page->count('partners.data', 0));
    }

    public function test_詳細ページにスロットが含まれsupport_poolは露出しない(): void
    {
        $partner = $this->makePartner();
        PartnerSchedule::create([
            'partner_id' => $partner->id, 'day_of_week' => 0,
            'start_time_jst' => '10:00:00', 'duration_min' => 45, 'max_sessions' => 1,
        ]);

        $this->get("/catalog/{$partner->id}")
            ->assertInertia(fn ($page) => $page
                ->component('Catalog/Show')
                ->where('partner.id', $partner->id)
                ->has('slots')
                ->missing('partner.support_pool')); // 内部財務情報は公開しない
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/CatalogControllerTest.php
```

Expected: FAIL（ルート未定義）

- [ ] **Step 3: `app/Http/Controllers/CatalogController.php` を作成**

時間帯フィルタ定義（確定値）: 平日午前=9:00〜12:00 / 平日午後=13:00〜18:00 / 土日=終日。

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
        $query = Partner::where('status', 'approved')->with('schedules');

        if ($request->filled('country')) {
            $query->where('country', $request->country);
        }

        if ($request->filled('time_slot')) {
            $query->whereHas('schedules', function ($q) use ($request) {
                match ($request->time_slot) {
                    'weekday_morning'   => $q->whereIn('day_of_week', [0, 1, 2, 3, 4])
                                            ->where('start_time_jst', '>=', '09:00:00')
                                            ->where('start_time_jst', '<', '12:00:00'),
                    'weekday_afternoon' => $q->whereIn('day_of_week', [0, 1, 2, 3, 4])
                                            ->where('start_time_jst', '>=', '13:00:00')
                                            ->where('start_time_jst', '<', '18:00:00'),
                    'weekend'           => $q->whereIn('day_of_week', [5, 6]),
                    default             => null,
                };
            });
        }

        $partners = $query->paginate(12)->through(fn (Partner $p) => [
            'id'             => $p->id,
            'display_name'   => $p->display_name,
            'country'        => $p->country,
            'region'         => $p->region,
            'rating_score'   => (float) $p->rating_score,
            'upcoming_slots' => $this->slotService->countUpcomingSlots($p),
        ]);

        $countries = Partner::where('status', 'approved')
            ->distinct()->orderBy('country')->pluck('country');

        return Inertia::render('Catalog/Index', [
            'partners'  => $partners,
            'countries' => $countries,
            'filters'   => $request->only(['country', 'time_slot']),
        ]);
    }

    public function show(Partner $partner): Response
    {
        abort_if($partner->status !== 'approved', 404);

        return Inertia::render('Catalog/Show', [
            'partner' => [
                'id'           => $partner->id,
                'display_name' => $partner->display_name,
                'country'      => $partner->country,
                'region'       => $partner->region,
                'video_url'    => $partner->video_url,
                'themes'       => $partner->themes,
                'grade_range'  => $partner->grade_range,
                'rating_score' => (float) $partner->rating_score,
                // support_pool（内部財務情報）は意図的に含めない
            ],
            'slots' => $this->slotService->getAvailableSlots($partner),
        ]);
    }
}
```

- [ ] **Step 4: ルート追加**

`routes/web.php`:

```php
use App\Http\Controllers\CatalogController;

Route::get('/catalog', [CatalogController::class, 'index'])->name('catalog.index');
Route::get('/catalog/{partner}', [CatalogController::class, 'show'])->name('catalog.show');
```

- [ ] **Step 5: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/CatalogControllerTest.php
```

Expected: PASS（4件）

```bash
git add app/Http/Controllers/CatalogController.php routes/web.php tests/Feature/CatalogControllerTest.php
git commit -m "feat(catalog): add catalog endpoints with confirmed time filters"
```

---

## Task 7: Catalog React ページ

**Files:**
- Create: `resources/js/Pages/Catalog/Index.tsx`
- Create: `resources/js/Pages/Catalog/Show.tsx`

- [ ] **Step 1: `resources/js/Pages/Catalog/Index.tsx` を作成**

```tsx
import { Head, Link, router } from '@inertiajs/react';

type Partner = {
    id: number;
    display_name: string;
    country: string;
    region: string;
    rating_score: number;
    upcoming_slots: number;
};

type Props = {
    partners: { data: Partner[]; links: { url: string | null; label: string; active: boolean }[] };
    countries: string[];
    filters: { country?: string; time_slot?: string };
};

const TIME_SLOTS = [
    { value: '', label: 'すべて' },
    { value: 'weekday_morning', label: '平日午前（9〜12時）' },
    { value: 'weekday_afternoon', label: '平日午後（13〜18時）' },
    { value: 'weekend', label: '土日' },
];

export default function CatalogIndex({ partners, countries, filters }: Props) {
    const applyFilter = (key: string, value: string) =>
        router.get('/catalog', { ...filters, [key]: value }, { preserveState: true });

    return (
        <div className="min-h-screen bg-gray-50">
            <Head title="海外パートナーカタログ" />
            <div className="mx-auto max-w-6xl px-4 py-8">
                <h1 className="mb-6 text-3xl font-bold">海外パートナーカタログ</h1>

                <div className="mb-8 flex flex-wrap gap-4">
                    <select
                        value={filters.country ?? ''}
                        onChange={(e) => applyFilter('country', e.target.value)}
                        className="rounded-lg border bg-white px-3 py-2"
                    >
                        <option value="">国：すべて</option>
                        {countries.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.time_slot ?? ''}
                        onChange={(e) => applyFilter('time_slot', e.target.value)}
                        className="rounded-lg border bg-white px-3 py-2"
                    >
                        {TIME_SLOTS.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {partners.data.map((p) => (
                        <Link
                            key={p.id}
                            href={`/catalog/${p.id}`}
                            className="flex flex-col gap-2 rounded-xl bg-white p-5 shadow transition-shadow hover:shadow-md"
                        >
                            <div className="text-lg font-bold">{p.display_name}</div>
                            <div className="text-sm text-gray-500">
                                {p.country}・{p.region}
                            </div>
                            <div className="mt-auto flex items-center justify-between">
                                <span className="font-semibold text-yellow-500">★ {p.rating_score.toFixed(1)}</span>
                                <span className="text-sm font-medium text-green-600">
                                    直近2週間 残{p.upcoming_slots}枠
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>

                <div className="mt-8 flex justify-center gap-2">
                    {partners.links.map((link, i) =>
                        link.url ? (
                            <Link
                                key={i}
                                href={link.url}
                                className={`rounded border px-3 py-1 text-sm ${
                                    link.active ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white'
                                }`}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ) : (
                            <span
                                key={i}
                                className="rounded border bg-white px-3 py-1 text-sm text-gray-400"
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ),
                    )}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: `resources/js/Pages/Catalog/Show.tsx` を作成**

```tsx
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

type Slot = { date: string; start_time: string; duration_min: number; schedule_id: number };

type Partner = {
    id: number;
    display_name: string;
    country: string;
    region: string;
    video_url: string | null;
    themes: string[];
    grade_range: string;
    rating_score: number;
};

const THEME_LABELS: Record<string, string> = {
    culture: '文化交流',
    english: '英語学習',
    global: '国際理解',
};

export default function CatalogShow({ partner, slots }: { partner: Partner; slots: Slot[] }) {
    const [selected, setSelected] = useState<Slot | null>(null);

    const handleBook = () => {
        if (!selected) return;
        router.get('/booking/create', {
            partner_id: partner.id,
            date: selected.date,
            start_time: selected.start_time,
            duration_min: selected.duration_min,
        });
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Head title={partner.display_name} />
            <div className="mx-auto max-w-3xl px-4 py-8">
                <Link href="/catalog" className="mb-4 inline-block text-sm text-blue-600">
                    ← カタログに戻る
                </Link>

                <div className="mb-6 rounded-xl bg-white p-6 shadow">
                    <h1 className="mb-1 text-2xl font-bold">{partner.display_name}</h1>
                    <p className="mb-4 text-gray-500">
                        {partner.country}・{partner.region}
                    </p>

                    {partner.video_url && (
                        <iframe src={partner.video_url} className="mb-4 aspect-video w-full rounded-lg" allowFullScreen />
                    )}

                    <div className="mb-4 flex flex-wrap gap-2">
                        {partner.themes.map((t) => (
                            <span key={t} className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
                                {THEME_LABELS[t] ?? t}
                            </span>
                        ))}
                    </div>

                    <div className="text-sm text-gray-600">
                        <span>★ {partner.rating_score.toFixed(1)}</span>
                        <span className="ml-4">対象学年: {partner.grade_range}</span>
                    </div>
                </div>

                <div className="rounded-xl bg-white p-6 shadow">
                    <h2 className="mb-4 text-lg font-bold">予約可能スロット（1週間後〜6週間先）</h2>

                    {slots.length === 0 ? (
                        <p className="text-gray-500">現在予約可能なスロットがありません。</p>
                    ) : (
                        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {slots.map((slot, i) => (
                                <button
                                    key={i}
                                    onClick={() => setSelected(slot)}
                                    className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                                        selected?.date === slot.date && selected?.start_time === slot.start_time
                                            ? 'border-blue-600 bg-blue-50'
                                            : 'border-gray-200 hover:border-blue-400'
                                    }`}
                                >
                                    <div className="font-medium">{slot.date}</div>
                                    <div className="text-gray-500">
                                        {slot.start_time}（{slot.duration_min}分）
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={handleBook}
                        disabled={!selected}
                        className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {selected ? `${selected.date} ${selected.start_time} で予約する` : 'スロットを選択してください'}
                    </button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: ビルド・コミット**

```bash
docker compose exec app npm run build
```

Expected: ビルド成功

```bash
git add resources/js/Pages/Catalog/
git commit -m "feat(ui): add catalog list and detail pages"
```

---

## Task 8: BookingController（TDD・スロット再検証＋所有者チェック）

予約POSTでは**SlotServiceによるスロット実在性の再検証**を行う（スケジュール外日時・締切超過・ダブルブッキングをサーバー側で遮断）。`cancel`/`complete` は**所有者チェック必須**。

**Files:**
- Create: `app/Http/Controllers/BookingController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/BookingControllerTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Feature/BookingControllerTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\Partner;
use App\Models\PartnerSchedule;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\Models\User;
use App\Services\StripeService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class BookingControllerTest extends TestCase
{
    use RefreshDatabase;

    private Partner $partner;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-06-01 00:00:00', 'Asia/Tokyo'));

        $pUser = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => 'x', 'role' => 'partner']);
        $this->partner = Partner::create([
            'user_id' => $pUser->id, 'provider_type' => 'school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6',
        ]);
        PartnerSchedule::create([
            'partner_id' => $this->partner->id, 'day_of_week' => 0, // 月曜
            'start_time_jst' => '10:00:00', 'duration_min' => 45, 'max_sessions' => 1,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function memberUser(string $email = 'm@example.com'): User
    {
        $user = User::create(['name' => 'M', 'email' => $email, 'password' => bcrypt('x'), 'role' => 'member']);
        Member::create(['user_id' => $user->id, 'type' => 'cram_school', 'org_name' => '塾', 'prefecture' => '東京都', 'contact_name' => 'M']);

        return $user;
    }

    private function bookingPayload(array $overrides = []): array
    {
        return array_merge([
            'partner_id'       => $this->partner->id,
            'date'             => '2026-06-08', // 月曜・7日後
            'start_time'       => '10:00',
            'duration_min'     => 45,
            'theme'            => 'culture',
            'with_facilitator' => false,
            'question_list'    => 'テスト質問',
        ], $overrides);
    }

    public function test_未ログインは予約フォームにアクセスできない(): void
    {
        $this->get('/booking/create?partner_id='.$this->partner->id)
            ->assertRedirect('/login');
    }

    public function test_予約でdraftセッションとpending参加者が作成される(): void
    {
        $this->mock(StripeService::class, function ($mock) {
            $mock->shouldReceive('createParticipantCheckout')->once()
                ->andReturn('https://checkout.stripe.com/test');
        });

        $this->actingAs($this->memberUser())
            ->post('/booking', $this->bookingPayload())
            ->assertRedirect('https://checkout.stripe.com/test');

        $this->assertDatabaseHas('sessions', [
            'partner_id' => $this->partner->id,
            'session_type' => 'private', 'status' => 'draft', 'price_jpy' => 8000,
        ]);
        $this->assertDatabaseHas('session_participants', [
            'status' => 'pending', 'price_paid' => 8000, 'support_amount' => 4000,
        ]);
    }

    public function test_ファシリテーターオプションで料金が加算される_支援額は基本料金の50パーセント(): void
    {
        $this->mock(StripeService::class, function ($mock) {
            $mock->shouldReceive('createParticipantCheckout')->once()->andReturn('https://checkout.stripe.com/test');
        });

        $this->actingAs($this->memberUser())
            ->post('/booking', $this->bookingPayload(['with_facilitator' => true]));

        // 45分: 基本8,000 + オプション2,500 = 10,500 / 支援は基本の50%=4,000のまま
        $this->assertDatabaseHas('session_participants', [
            'price_paid' => 10500, 'support_amount' => 4000,
        ]);
    }

    public function test_スケジュール外の日時はサーバー側で拒否される(): void
    {
        $this->actingAs($this->memberUser())
            ->post('/booking', $this->bookingPayload(['start_time' => '03:00']))
            ->assertSessionHasErrors();

        $this->assertEquals(0, Session::count());
    }

    public function test_締切超過_1週間以内_の日時は拒否される(): void
    {
        // 2026-06-01(月)当日のスロットはスケジュール上存在するが7日以内 → 拒否
        $this->actingAs($this->memberUser())
            ->post('/booking', $this->bookingPayload(['date' => '2026-06-01']))
            ->assertSessionHasErrors();

        $this->assertEquals(0, Session::count());
    }

    public function test_予約済みスロットへの二重予約は拒否される(): void
    {
        Session::create([
            'partner_id' => $this->partner->id, 'session_type' => 'private',
            'scheduled_at' => Carbon::parse('2026-06-08 10:00', 'Asia/Tokyo'),
            'duration_min' => 45, 'theme' => 'culture', 'capacity' => 1, 'min_groups' => 1,
            'price_jpy' => 8000, 'status' => 'confirmed',
        ]);

        $this->actingAs($this->memberUser())
            ->post('/booking', $this->bookingPayload())
            ->assertSessionHasErrors();
    }

    public function test_cancelで自分のpending予約が削除される(): void
    {
        $user = $this->memberUser();
        [$session, $participant] = $this->makeDraftBooking($user);

        $this->actingAs($user)
            ->get("/booking/cancel/{$participant->id}")
            ->assertRedirect('/catalog');

        $this->assertNull(SessionParticipant::find($participant->id));
        $this->assertNull(Session::find($session->id)); // draft枠も解放
    }

    public function test_他人の予約はcancelもcompleteもできない(): void
    {
        $owner = $this->memberUser();
        [, $participant] = $this->makeDraftBooking($owner);

        $attacker = $this->memberUser('attacker@example.com');

        $this->actingAs($attacker)->get("/booking/cancel/{$participant->id}")->assertForbidden();
        $this->actingAs($attacker)->get("/booking/complete/{$participant->id}")->assertForbidden();

        $this->assertNotNull(SessionParticipant::find($participant->id));
    }

    /** @return array{0: Session, 1: SessionParticipant} */
    private function makeDraftBooking(User $user): array
    {
        $session = Session::create([
            'partner_id' => $this->partner->id, 'session_type' => 'private',
            'scheduled_at' => Carbon::parse('2026-06-08 10:00', 'Asia/Tokyo'),
            'duration_min' => 45, 'theme' => 'culture', 'capacity' => 1, 'min_groups' => 1,
            'price_jpy' => 8000, 'status' => 'draft',
        ]);
        $participant = SessionParticipant::create([
            'session_id' => $session->id, 'member_id' => $user->member->id,
            'status' => 'pending', 'price_paid' => 8000, 'support_amount' => 4000,
        ]);

        return [$session, $participant];
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/BookingControllerTest.php
```

Expected: FAIL（ルート未定義）

- [ ] **Step 3: `app/Http/Controllers/BookingController.php` を作成**

```php
<?php

namespace App\Http\Controllers;

use App\Models\Partner;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\Services\SlotService;
use App\Services\StripeService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class BookingController extends Controller
{
    /** 基本料金（円） */
    private const BASE_PRICES = [45 => 8000, 60 => 10000];

    /** ファシリテーターオプション料金（円・スタッフコスト専用、支援プール対象外） */
    private const FACILITATOR_PRICES = [45 => 2500, 60 => 3000];

    public function __construct(
        private readonly SlotService $slotService,
        private readonly StripeService $stripeService,
    ) {}

    public function create(Request $request): Response
    {
        $partner = Partner::where('status', 'approved')->findOrFail($request->partner_id);

        return Inertia::render('Booking/Create', [
            'partner' => [
                'id'           => $partner->id,
                'display_name' => $partner->display_name,
                'country'      => $partner->country,
                'themes'       => $partner->themes,
            ],
            'slot' => [
                'date'         => $request->date,
                'start_time'   => $request->start_time,
                'duration_min' => (int) $request->duration_min,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'partner_id'       => ['required', 'exists:partners,id'],
            'date'             => ['required', 'date_format:Y-m-d'],
            'start_time'       => ['required', 'date_format:H:i'],
            'duration_min'     => ['required', 'integer', 'in:45,60'],
            'theme'            => ['required', 'in:culture,english,global'],
            'with_facilitator' => ['required', 'boolean'],
            'question_list'    => ['nullable', 'string', 'max:5000'],
        ]);

        $partner = Partner::where('status', 'approved')->findOrFail($validated['partner_id']);

        // サーバー側再検証: スケジュール実在・1週間前締切・ダブルブッキングをまとめて遮断
        if (! $this->slotService->isAvailable(
            $partner, $validated['date'], $validated['start_time'], (int) $validated['duration_min']
        )) {
            return back()->withErrors(['slot' => 'このスロットは予約できません。最新の空き状況をご確認ください。']);
        }

        $duration  = (int) $validated['duration_min'];
        $basePrice = self::BASE_PRICES[$duration];
        $option    = $validated['with_facilitator'] ? self::FACILITATOR_PRICES[$duration] : 0;
        $total     = $basePrice + $option;

        $scheduledAt = Carbon::createFromFormat(
            'Y-m-d H:i', "{$validated['date']} {$validated['start_time']}", 'Asia/Tokyo'
        );

        $participant = DB::transaction(function () use ($request, $validated, $partner, $scheduledAt, $duration, $basePrice, $option, $total) {
            $session = Session::create([
                'partner_id'       => $partner->id,
                'session_type'     => 'private',
                'scheduled_at'     => $scheduledAt,
                'duration_min'     => $duration,
                'theme'            => $validated['theme'],
                'capacity'         => 1,
                'min_groups'       => 1,
                'with_facilitator' => $validated['with_facilitator'],
                'price_jpy'        => $total,
                'status'           => 'draft', // Webhookでconfirmedへ
            ]);

            return SessionParticipant::create([
                'session_id'     => $session->id,
                'member_id'      => $request->user()->member->id,
                'status'         => 'pending',
                'price_paid'     => $total,
                'support_amount' => (int) floor($basePrice * 0.5), // オプション分は支援対象外
                'question_list'  => $validated['question_list'],
                'question_list_sent_at' => $validated['question_list'] ? now() : null,
            ]);
        });

        $checkoutUrl = $this->stripeService->createParticipantCheckout(
            $participant,
            route('booking.complete', $participant),
            route('booking.cancel', $participant),
        );

        return redirect()->away($checkoutUrl);
    }

    public function complete(Request $request, SessionParticipant $participant): Response
    {
        abort_unless($participant->member->user_id === $request->user()->id, 403);

        $session = $participant->session;

        return Inertia::render('Booking/Complete', [
            'booking' => [
                'id'               => $participant->id,
                'scheduled_at'     => $session->scheduled_at->toIso8601String(),
                'duration_min'     => $session->duration_min,
                'theme'            => $session->theme,
                'with_facilitator' => $session->with_facilitator,
                'price_paid'       => $participant->price_paid,
                'partner_name'     => $session->partner->display_name,
            ],
        ]);
    }

    /** Stripe決済キャンセルの戻り先: pending参加者とdraft枠を削除して解放 */
    public function cancel(Request $request, SessionParticipant $participant): RedirectResponse
    {
        abort_unless($participant->member->user_id === $request->user()->id, 403);

        if ($participant->status === 'pending') {
            $session = $participant->session;
            $participant->delete();

            if ($session->session_type === 'private' && $session->status === 'draft') {
                $session->delete();
            }
        }

        return redirect()->route('catalog.index');
    }
}
```

- [ ] **Step 4: ルート追加**

`routes/web.php`:

```php
use App\Http\Controllers\BookingController;

Route::middleware(['auth', 'role:member'])->group(function () {
    Route::get('/booking/create', [BookingController::class, 'create'])->name('booking.create');
    Route::post('/booking', [BookingController::class, 'store'])->name('booking.store');
    Route::get('/booking/complete/{participant}', [BookingController::class, 'complete'])->name('booking.complete');
    Route::get('/booking/cancel/{participant}', [BookingController::class, 'cancel'])->name('booking.cancel');
});
```

- [ ] **Step 5: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/BookingControllerTest.php
```

Expected: PASS（8件）

```bash
git add app/Http/Controllers/BookingController.php routes/web.php tests/Feature/BookingControllerTest.php
git commit -m "feat(booking): add booking flow with server-side slot validation and ownership checks"
```

---

## Task 9: Booking React ページ

**Files:**
- Create: `resources/js/Pages/Booking/Create.tsx`
- Create: `resources/js/Pages/Booking/Complete.tsx`

- [ ] **Step 1: `resources/js/Pages/Booking/Create.tsx` を作成**

```tsx
import { Head, useForm, usePage } from '@inertiajs/react';

type Props = {
    partner: { id: number; display_name: string; country: string; themes: string[] };
    slot: { date: string; start_time: string; duration_min: number };
};

const THEME_LABELS: Record<string, string> = {
    culture: '文化交流',
    english: '英語学習',
    global: '国際理解',
};

const BASE_PRICES: Record<number, number> = { 45: 8000, 60: 10000 };
const FACILITATOR_PRICES: Record<number, number> = { 45: 2500, 60: 3000 };

export default function BookingCreate({ partner, slot }: Props) {
    const { errors } = usePage().props;
    const { data, setData, post, processing } = useForm({
        partner_id: partner.id,
        date: slot.date,
        start_time: slot.start_time,
        duration_min: slot.duration_min,
        theme: partner.themes[0] ?? 'culture',
        with_facilitator: false,
        question_list: '',
    });

    const base = BASE_PRICES[data.duration_min] ?? 0;
    const option = data.with_facilitator ? (FACILITATOR_PRICES[data.duration_min] ?? 0) : 0;
    const total = base + option;

    return (
        <div className="min-h-screen bg-gray-50">
            <Head title="予約内容の確認" />
            <div className="mx-auto max-w-xl px-4 py-8">
                <h1 className="mb-6 text-2xl font-bold">予約内容の確認</h1>
                {errors.slot && <p className="mb-4 text-red-600">{errors.slot}</p>}

                <div className="mb-6 rounded-xl bg-white p-6 shadow">
                    <p className="mb-1 text-sm text-gray-500">海外パートナー</p>
                    <p className="mb-4 font-semibold">
                        {partner.display_name}（{partner.country}）
                    </p>

                    <p className="mb-1 text-sm text-gray-500">セッション日時</p>
                    <p className="mb-4 font-semibold">
                        {slot.date} {slot.start_time}〜（{data.duration_min}分）
                    </p>

                    <div className="mb-4">
                        <label className="mb-1 block text-sm font-medium">テーマ</label>
                        <div className="flex flex-wrap gap-2">
                            {partner.themes.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setData('theme', t)}
                                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                                        data.theme === t
                                            ? 'border-blue-600 bg-blue-600 text-white'
                                            : 'border-gray-300 text-gray-600'
                                    }`}
                                >
                                    {THEME_LABELS[t] ?? t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <label className="mb-4 flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={data.with_facilitator}
                            onChange={(e) => setData('with_facilitator', e.target.checked)}
                        />
                        <span className="text-sm">
                            ファシリテーター（日英通訳・進行）を付ける +¥
                            {(FACILITATOR_PRICES[data.duration_min] ?? 0).toLocaleString()}
                        </span>
                    </label>

                    <div className="mb-4">
                        <label className="mb-1 block text-sm font-medium">質問リスト（任意・パートナーへ事前共有）</label>
                        <textarea
                            value={data.question_list}
                            onChange={(e) => setData('question_list', e.target.value)}
                            rows={4}
                            placeholder="例：「あなたの国の学校給食を教えてください」"
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-400">3日前の12時まで追加・編集できます</p>
                    </div>

                    <div className="border-t pt-4 text-sm">
                        <div className="mb-1 flex justify-between">
                            <span className="text-gray-500">運営手数料（基本料金の50%）</span>
                            <span>¥{(base * 0.5).toLocaleString()}</span>
                        </div>
                        <div className="mb-1 flex justify-between">
                            <span className="text-gray-500">物資支援プール（基本料金の50%）</span>
                            <span>¥{(base * 0.5).toLocaleString()}</span>
                        </div>
                        {option > 0 && (
                            <div className="mb-1 flex justify-between">
                                <span className="text-gray-500">ファシリテーター（スタッフ費用）</span>
                                <span>¥{option.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-base font-bold">
                            <span>合計</span>
                            <span>¥{total.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => post('/booking')}
                    disabled={processing}
                    className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                    {processing ? '処理中...' : `¥${total.toLocaleString()} を決済して予約する`}
                </button>
                <p className="mt-3 text-center text-xs text-gray-400">Stripe の決済ページに移動します</p>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: `resources/js/Pages/Booking/Complete.tsx` を作成**

```tsx
import { Head, Link } from '@inertiajs/react';

type Props = {
    booking: {
        id: number;
        scheduled_at: string;
        duration_min: number;
        theme: string;
        with_facilitator: boolean;
        price_paid: number;
        partner_name: string;
    };
};

const THEME_LABELS: Record<string, string> = {
    culture: '文化交流',
    english: '英語学習',
    global: '国際理解',
};

export default function BookingComplete({ booking }: Props) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <Head title="予約完了" />
            <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow">
                <div className="mb-4 text-4xl">🎉</div>
                <h1 className="mb-2 text-2xl font-bold">予約が完了しました</h1>
                <p className="mb-6 text-gray-500">予約番号: #{booking.id}</p>

                <div className="mb-6 space-y-2 rounded-lg bg-gray-50 p-4 text-left text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-500">パートナー</span>
                        <span className="font-medium">{booking.partner_name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">日時</span>
                        <span className="font-medium">{new Date(booking.scheduled_at).toLocaleString('ja-JP')}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">時間</span>
                        <span className="font-medium">{booking.duration_min}分</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">テーマ</span>
                        <span className="font-medium">{THEME_LABELS[booking.theme] ?? booking.theme}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">ファシリテーター</span>
                        <span className="font-medium">{booking.with_facilitator ? 'あり' : 'なし'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">料金</span>
                        <span className="font-medium">¥{booking.price_paid.toLocaleString()}</span>
                    </div>
                </div>

                <p className="mb-6 text-sm text-gray-500">
                    質問リストはセッション3日前の12時まで追加・編集できます。確認メールをご確認ください。
                </p>

                <Link
                    href="/member/dashboard"
                    className="block w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700"
                >
                    ダッシュボードへ
                </Link>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: ビルド・コミット**

```bash
docker compose exec app npm run build
```

```bash
git add resources/js/Pages/Booking/
git commit -m "feat(ui): add booking create/complete pages with facilitator option"
```

---

## Task 10: WebhookController（participant確定・確認メール）

署名検証は **fail-closed**: テスト環境の明示的bypass以外では、secret未設定なら500で落とす（設定漏れで検証が無効化されるのを防ぐ）。

**Files:**
- Create: `app/Http/Controllers/WebhookController.php`
- Create: `app/Mail/BookingConfirmed.php` + `resources/views/mail/booking/confirmed.blade.php`
- Create: `app/Mail/BookingReceived.php` + `resources/views/mail/booking/received.blade.php`
- Modify: `bootstrap/app.php` / `routes/web.php`
- Test: `tests/Feature/WebhookControllerTest.php`

- [ ] **Step 1: Webhook ルートを CSRF 除外**

`bootstrap/app.php` の `withMiddleware` に追記:

```php
$middleware->validateCsrfTokens(except: [
    'stripe/webhook',
]);
```

- [ ] **Step 2: メール2種を作成**

```bash
docker compose exec app php artisan make:mail BookingConfirmed --markdown=mail.booking.confirmed
docker compose exec app php artisan make:mail BookingReceived --markdown=mail.booking.received
```

両クラスとも `public function __construct(public \App\Models\SessionParticipant $participant) {}`。

`BookingConfirmed`（member宛）: subject `【WorldClass】ご予約が確定しました`

`resources/views/mail/booking/confirmed.blade.php`:

```blade
<x-mail::message>
# ご予約が確定しました

- 日時: {{ $participant->session->scheduled_at->format('Y年n月j日 H:i') }}
- パートナー: {{ $participant->session->partner->display_name }}
- 料金: {{ number_format($participant->price_paid) }}円

質問リストはセッション3日前の12時まで追加・編集できます。
開催前日にZoomのURLをお送りします。

{{ config('app.name') }}
</x-mail::message>
```

`BookingReceived`（partner宛）: subject `[WorldClass] New session booked`

`resources/views/mail/booking/received.blade.php`:

```blade
<x-mail::message>
# A new session has been booked

- Date: {{ $participant->session->scheduled_at->format('Y-m-d H:i') }} (JST)
- Duration: {{ $participant->session->duration_min }} min
- Theme: {{ $participant->session->theme }}

Please review the question list on your dashboard and mark the session as Ready **by 12:00 JST on the day before**.

{{ config('app.name') }}
</x-mail::message>
```

- [ ] **Step 3: 失敗するテストを書く**

`tests/Feature/WebhookControllerTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\Partner;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class WebhookControllerTest extends TestCase
{
    use RefreshDatabase;

    private function makePendingBooking(): SessionParticipant
    {
        $pUser = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => 'x', 'role' => 'partner']);
        $partner = Partner::create([
            'user_id' => $pUser->id, 'provider_type' => 'school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6',
        ]);
        $session = Session::create([
            'partner_id' => $partner->id, 'session_type' => 'private',
            'scheduled_at' => now()->addDays(14), 'duration_min' => 45, 'theme' => 'culture',
            'capacity' => 1, 'min_groups' => 1, 'price_jpy' => 8000, 'status' => 'draft',
        ]);
        $mUser = User::create(['name' => 'M', 'email' => 'm@example.com', 'password' => 'x', 'role' => 'member']);
        $member = Member::create(['user_id' => $mUser->id, 'type' => 'cram_school', 'org_name' => '塾', 'prefecture' => '東京都', 'contact_name' => 'M']);

        return SessionParticipant::create([
            'session_id' => $session->id, 'member_id' => $member->id,
            'status' => 'pending', 'price_paid' => 8000, 'support_amount' => 4000,
        ]);
    }

    private function postWebhook(int $participantId): \Illuminate\Testing\TestResponse
    {
        $payload = json_encode([
            'type' => 'checkout.session.completed',
            'data' => ['object' => [
                'payment_intent' => 'pi_test_123',
                'metadata' => ['participant_id' => (string) $participantId],
            ]],
        ]);

        // テスト環境のみ 'bypass' 署名で検証スキップ（WebhookController参照）
        return $this->call('POST', '/stripe/webhook', [], [], [], [
            'HTTP_STRIPE_SIGNATURE' => 'bypass',
            'CONTENT_TYPE' => 'application/json',
        ], $payload);
    }

    public function test_署名が不正な場合は400(): void
    {
        config(['services.stripe.webhook_secret' => 'whsec_test']);

        $this->call('POST', '/stripe/webhook', [], [], [], [
            'HTTP_STRIPE_SIGNATURE' => 'invalid',
            'CONTENT_TYPE' => 'application/json',
        ], '{}')->assertStatus(400);
    }

    public function test_webhookで参加者とセッションが確定しメールが送られる(): void
    {
        Mail::fake();
        $participant = $this->makePendingBooking();

        $this->postWebhook($participant->id)->assertOk();

        $this->assertEquals('confirmed', $participant->fresh()->status);
        $this->assertEquals('pi_test_123', $participant->fresh()->stripe_payment_id);
        $this->assertEquals('confirmed', $participant->fresh()->session->status);
        Mail::assertQueued(\App\Mail\BookingConfirmed::class, 1);
        Mail::assertQueued(\App\Mail\BookingReceived::class, 1);
    }

    public function test_二重Webhookは冪等に無視される(): void
    {
        Mail::fake();
        $participant = $this->makePendingBooking();

        $this->postWebhook($participant->id)->assertOk();
        $this->postWebhook($participant->id)->assertOk();

        Mail::assertQueued(\App\Mail\BookingConfirmed::class, 1);
    }
}
```

- [ ] **Step 4: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/WebhookControllerTest.php
```

Expected: FAIL

- [ ] **Step 5: `app/Http/Controllers/WebhookController.php` を作成**

```php
<?php

namespace App\Http\Controllers;

use App\Mail\BookingConfirmed;
use App\Mail\BookingReceived;
use App\Models\SessionParticipant;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Mail;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

class WebhookController extends Controller
{
    public function handle(Request $request): Response
    {
        $payload   = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature', '');
        $secret    = config('services.stripe.webhook_secret');

        if (app()->environment('testing') && $sigHeader === 'bypass') {
            // テスト環境のみ署名検証をスキップ
            $event = json_decode($payload, true);
        } else {
            // fail-closed: secret未設定なら処理しない（設定漏れで検証が無効化されるのを防ぐ）
            abort_if(empty($secret), 500, 'Stripe webhook secret is not configured.');

            try {
                $event = Webhook::constructEvent($payload, $sigHeader, $secret);
                $event = json_decode(json_encode($event), true);
            } catch (SignatureVerificationException) {
                return response('Invalid signature', 400);
            }
        }

        if (($event['type'] ?? null) === 'checkout.session.completed') {
            $this->handleParticipantCompleted($event['data']['object'] ?? []);
        }

        return response('OK', 200);
    }

    private function handleParticipantCompleted(array $object): void
    {
        $participantId = (int) ($object['metadata']['participant_id'] ?? 0);
        $participant = SessionParticipant::with('session.partner.user', 'member.user')->find($participantId);

        if ($participant === null || $participant->status !== 'pending') {
            return; // 冪等: 二重Webhook・不明IDは無視
        }

        $participant->update([
            'status'            => 'confirmed',
            'stripe_payment_id' => $object['payment_intent'] ?? null,
        ]);

        $session = $participant->session;

        if ($session->session_type === 'private') {
            $session->update(['status' => 'confirmed']);

            Mail::to($participant->member->user->email)->queue(new BookingConfirmed($participant));
            Mail::to($session->partner->user->email)->queue(new BookingReceived($participant));
        }
        // session_type=open の分岐（成立判定・直前参加通知）は Phase 2.5 で追加する
    }
}
```

- [ ] **Step 6: ルート追加**

`routes/web.php`:

```php
use App\Http\Controllers\WebhookController;

Route::post('/stripe/webhook', [WebhookController::class, 'handle']);
```

- [ ] **Step 7: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/WebhookControllerTest.php
```

Expected: PASS（3件）

```bash
git add app/Http/Controllers/WebhookController.php app/Mail/ resources/views/mail/booking/ bootstrap/app.php routes/web.php tests/Feature/WebhookControllerTest.php
git commit -m "feat(webhook): confirm bookings via fail-closed Stripe webhook with mails"
```

---

## Task 11: ExpirePendingApplicationsJob（放置pendingの掃除）

Checkoutを開いたまま離脱（cancel_url未到達）したpending参加者は枠を死蔵する。**24時間経過したpendingを削除**し、空になったdraft専用枠も解放する。オープンセッションのpending（Phase 2.5）も同じロジックで掃除される。

**Files:**
- Create: `app/Jobs/ExpirePendingApplicationsJob.php`
- Modify: `routes/console.php`
- Test: `tests/Feature/ExpirePendingApplicationsJobTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Feature/ExpirePendingApplicationsJobTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Jobs\ExpirePendingApplicationsJob;
use App\Models\Member;
use App\Models\Partner;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExpirePendingApplicationsJobTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makePending(string $sessionStatus, string $sessionType): SessionParticipant
    {
        $pUser = User::create(['name' => 'P', 'email' => uniqid().'@example.com', 'password' => 'x', 'role' => 'partner']);
        $partner = Partner::create([
            'user_id' => $pUser->id, 'provider_type' => 'school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6',
        ]);
        $session = Session::create([
            'partner_id' => $partner->id, 'session_type' => $sessionType,
            'scheduled_at' => now()->addDays(14), 'duration_min' => 45, 'theme' => 'culture',
            'capacity' => $sessionType === 'open' ? 6 : 1, 'min_groups' => $sessionType === 'open' ? 3 : 1,
            'price_jpy' => 8000, 'status' => $sessionStatus,
        ]);
        $mUser = User::create(['name' => 'M', 'email' => uniqid().'@example.com', 'password' => 'x', 'role' => 'member']);
        $member = Member::create(['user_id' => $mUser->id, 'type' => 'family', 'prefecture' => '東京都', 'contact_name' => 'M']);

        return SessionParticipant::create([
            'session_id' => $session->id, 'member_id' => $member->id,
            'status' => 'pending', 'price_paid' => 8000, 'support_amount' => 4000,
        ]);
    }

    public function test_24時間経過したpendingは削除されdraft枠も解放される(): void
    {
        $participant = $this->makePending('draft', 'private');
        $sessionId = $participant->session_id;

        Carbon::setTestNow(now()->addHours(25));
        (new ExpirePendingApplicationsJob())->handle();

        $this->assertNull(SessionParticipant::find($participant->id));
        $this->assertNull(Session::find($sessionId));
    }

    public function test_24時間未満のpendingとオープンセッション枠は残る(): void
    {
        $fresh = $this->makePending('draft', 'private');
        $openStale = $this->makePending('open', 'open');
        $openSessionId = $openStale->session_id;

        Carbon::setTestNow(now()->addHours(25));
        // freshは25時間後の時点で「25時間前作成」になってしまうため作り直す
        Carbon::setTestNow();
        $fresh2 = $this->makePending('draft', 'private');
        Carbon::setTestNow(now()->addHours(1));

        (new ExpirePendingApplicationsJob())->handle();

        $this->assertNotNull(SessionParticipant::find($fresh2->id)); // 1時間しか経っていない
        $this->assertNotNull(Session::find($openSessionId));          // オープン枠自体は消さない
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/ExpirePendingApplicationsJobTest.php
```

Expected: FAIL

- [ ] **Step 3: Job実装**

```bash
docker compose exec app php artisan make:job ExpirePendingApplicationsJob
```

`app/Jobs/ExpirePendingApplicationsJob.php`:

```php
<?php

namespace App\Jobs;

use App\Models\SessionParticipant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ExpirePendingApplicationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        // Stripe Checkoutの有効期限（24時間）を過ぎたpendingは決済される可能性がない
        $stale = SessionParticipant::query()
            ->where('status', 'pending')
            ->where('created_at', '<=', now()->subDay())
            ->with('session')
            ->get();

        foreach ($stale as $participant) {
            $session = $participant->session;
            $participant->delete();

            // 専用セッションのdraft枠は誰も使わないため解放（オープン枠は運営管理のため残す）
            if ($session->session_type === 'private'
                && $session->status === 'draft'
                && $session->participants()->count() === 0) {
                $session->delete();
            }
        }
    }
}
```

- [ ] **Step 4: Scheduler登録**

`routes/console.php`:

```php
use Illuminate\Support\Facades\Schedule;

Schedule::job(new \App\Jobs\ExpirePendingApplicationsJob)->hourly();
```

- [ ] **Step 5: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/ExpirePendingApplicationsJobTest.php
```

Expected: PASS（2件）

```bash
git add app/Jobs/ExpirePendingApplicationsJob.php routes/console.php tests/Feature/ExpirePendingApplicationsJobTest.php
git commit -m "feat(job): expire stale pending applications and release draft slots"
```

---

## Task 12: パートナー・スケジュール管理（ダッシュボード）

**Files:**
- Create: `app/Http/Controllers/Partner/ScheduleController.php`
- Modify: `app/Http/Controllers/DashboardController.php` / `routes/web.php`
- Create: `resources/js/Pages/Dashboard/Partner.tsx`（既存なら置き換え）

- [ ] **Step 1: `app/Http/Controllers/Partner/ScheduleController.php` を作成**

```php
<?php

namespace App\Http\Controllers\Partner;

use App\Http\Controllers\Controller;
use App\Models\PartnerSchedule;
use App\Models\PartnerScheduleBlock;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ScheduleController extends Controller
{
    public function storeSchedule(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'day_of_week'    => ['required', 'integer', 'between:0,6'],
            'start_time_jst' => ['required', 'date_format:H:i'],
            'duration_min'   => ['required', 'in:45,60'],
        ]);

        $request->user()->partner->schedules()->create([
            'day_of_week'    => $validated['day_of_week'],
            'start_time_jst' => $validated['start_time_jst'].':00',
            'duration_min'   => $validated['duration_min'],
            'max_sessions'   => 1,
        ]);

        return back();
    }

    public function destroySchedule(Request $request, PartnerSchedule $schedule): RedirectResponse
    {
        abort_if($schedule->partner_id !== $request->user()->partner->id, 403);
        $schedule->delete();

        return back();
    }

    public function storeBlock(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'blocked_date' => ['required', 'date', 'after_or_equal:today'],
            'reason'       => ['nullable', 'string', 'max:255'],
        ]);

        $request->user()->partner->scheduleBlocks()->updateOrCreate(
            ['blocked_date' => $validated['blocked_date']],
            ['reason' => $validated['reason'] ?? null],
        );

        return back();
    }

    public function destroyBlock(Request $request, PartnerScheduleBlock $block): RedirectResponse
    {
        abort_if($block->partner_id !== $request->user()->partner->id, 403);
        $block->delete();

        return back();
    }
}
```

- [ ] **Step 2: ルート追加**

`routes/web.php` の partner グループ（`role:partner`）に追記:

```php
use App\Http\Controllers\Partner\ScheduleController;

Route::post('/partner/schedules', [ScheduleController::class, 'storeSchedule'])->name('partner.schedules.store');
Route::delete('/partner/schedules/{schedule}', [ScheduleController::class, 'destroySchedule'])->name('partner.schedules.destroy');
Route::post('/partner/schedules/blocks', [ScheduleController::class, 'storeBlock'])->name('partner.blocks.store');
Route::delete('/partner/schedules/blocks/{block}', [ScheduleController::class, 'destroyBlock'])->name('partner.blocks.destroy');
```

- [ ] **Step 3: `DashboardController::partner()` にスケジュールデータを渡す**

既存の `partner()` メソッドを変更:

```php
public function partner(): \Inertia\Response
{
    $partner = \Illuminate\Support\Facades\Auth::user()->partner->load(['schedules', 'scheduleBlocks']);

    return \Inertia\Inertia::render('Dashboard/Partner', [
        'partner'   => [
            'display_name' => $partner->display_name,
            'country'      => $partner->country,
            'status'       => $partner->status,
        ],
        'schedules' => $partner->schedules,
        'blocks'    => $partner->scheduleBlocks,
    ]);
}
```

- [ ] **Step 4: `resources/js/Pages/Dashboard/Partner.tsx` を作成**

```tsx
import { Head, router, useForm } from '@inertiajs/react';

type Schedule = { id: number; day_of_week: number; start_time_jst: string; duration_min: number };
type Block = { id: number; blocked_date: string; reason: string | null };

type Props = {
    partner: { display_name: string; country: string; status: string };
    schedules: Schedule[];
    blocks: Block[];
};

const DOW_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

export default function PartnerDashboard({ partner, schedules, blocks }: Props) {
    const scheduleForm = useForm({ day_of_week: 0, start_time_jst: '10:00', duration_min: 45 });
    const blockForm = useForm({ blocked_date: '', reason: '' });

    return (
        <div className="min-h-screen bg-gray-50">
            <Head title="Partner Dashboard" />
            <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
                <div>
                    <h1 className="text-2xl font-bold">{partner.display_name}</h1>
                    <p className="text-gray-500">{partner.country}</p>
                    <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-sm ${
                            partner.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                        }`}
                    >
                        {partner.status === 'approved' ? 'Approved' : 'Under review'}
                    </span>
                </div>

                <div className="rounded-xl bg-white p-6 shadow">
                    <h2 className="mb-4 text-lg font-bold">Weekly slots</h2>
                    <div className="mb-4 flex flex-wrap gap-3">
                        <select
                            value={scheduleForm.data.day_of_week}
                            onChange={(e) => scheduleForm.setData('day_of_week', Number(e.target.value))}
                            className="rounded-lg border px-3 py-2"
                        >
                            {DOW_LABELS.map((label, i) => (
                                <option key={i} value={i}>
                                    {label}曜日
                                </option>
                            ))}
                        </select>
                        <input
                            type="time"
                            value={scheduleForm.data.start_time_jst}
                            onChange={(e) => scheduleForm.setData('start_time_jst', e.target.value)}
                            className="rounded-lg border px-3 py-2"
                        />
                        <select
                            value={scheduleForm.data.duration_min}
                            onChange={(e) => scheduleForm.setData('duration_min', Number(e.target.value))}
                            className="rounded-lg border px-3 py-2"
                        >
                            <option value={45}>45 min</option>
                            <option value={60}>60 min</option>
                        </select>
                        <button
                            onClick={() => scheduleForm.post('/partner/schedules')}
                            disabled={scheduleForm.processing}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            Add
                        </button>
                    </div>
                    {schedules.length === 0 ? (
                        <p className="text-sm text-gray-400">No slots registered.</p>
                    ) : (
                        <ul className="space-y-2">
                            {schedules.map((s) => (
                                <li key={s.id} className="flex items-center justify-between rounded-lg border px-4 py-2">
                                    <span className="text-sm">
                                        毎週{DOW_LABELS[s.day_of_week]}曜 {s.start_time_jst.slice(0, 5)}（{s.duration_min}分）
                                    </span>
                                    <button
                                        onClick={() => router.delete(`/partner/schedules/${s.id}`)}
                                        className="text-sm text-red-500 hover:underline"
                                    >
                                        Delete
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="rounded-xl bg-white p-6 shadow">
                    <h2 className="mb-4 text-lg font-bold">Blocked dates</h2>
                    <div className="mb-4 flex flex-wrap gap-3">
                        <input
                            type="date"
                            value={blockForm.data.blocked_date}
                            onChange={(e) => blockForm.setData('blocked_date', e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="rounded-lg border px-3 py-2"
                        />
                        <input
                            type="text"
                            value={blockForm.data.reason}
                            onChange={(e) => blockForm.setData('reason', e.target.value)}
                            placeholder="Reason (optional)"
                            className="flex-1 rounded-lg border px-3 py-2"
                        />
                        <button
                            onClick={() => blockForm.post('/partner/schedules/blocks')}
                            disabled={blockForm.processing || !blockForm.data.blocked_date}
                            className="rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:opacity-50"
                        >
                            Block
                        </button>
                    </div>
                    {blocks.length === 0 ? (
                        <p className="text-sm text-gray-400">No blocked dates.</p>
                    ) : (
                        <ul className="space-y-2">
                            {blocks.map((b) => (
                                <li key={b.id} className="flex items-center justify-between rounded-lg border px-4 py-2">
                                    <span className="text-sm">
                                        {b.blocked_date}
                                        {b.reason ? `（${b.reason}）` : ''}
                                    </span>
                                    <button
                                        onClick={() => router.delete(`/partner/schedules/blocks/${b.id}`)}
                                        className="text-sm text-red-500 hover:underline"
                                    >
                                        Delete
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 5: ビルド・全テスト・Lint・コミット**

```bash
docker compose exec app npm run build
docker compose exec app php artisan test
docker compose exec app ./vendor/bin/pint
docker compose exec app ./vendor/bin/phpstan analyse --memory-limit=512M
```

Expected: 全PASS

```bash
git add app/Http/Controllers/Partner/ app/Http/Controllers/DashboardController.php resources/js/Pages/Dashboard/Partner.tsx routes/web.php
git commit -m "feat(partner): add schedule management dashboard"
```

---

## セルフレビュー

**スペックカバレッジ:**

| 要件 | 対応Task |
|---|---|
| 週次スロット＋例外ブロック | Task 2, 3, 12 |
| スロット生成（7日後〜42日後・ブロック/予約済み除外） | Task 4 |
| カタログ一覧（国・時間帯フィルタ: 9-12/13-18/土日） | Task 6, 7 |
| カード表示（名前・国・★・直近2週間残枠） | Task 6, 7 |
| 詳細ページ（VTR・テーマ・スロット選択） | Task 6, 7 |
| 予約フォーム（テーマ・ファシリテーター・質問・料金内訳） | Task 8, 9 |
| Stripe Checkout（participant単位・即時キャプチャ） | Task 5, 8 |
| Webhookで確定＋確認メール（member/partner） | Task 10 |
| 決済キャンセル時のpending/draft削除 | Task 8 |
| 放置pendingの自動掃除 | Task 11 |
| スケジュール管理UI | Task 12 |

**セキュリティチェック:**
- 予約POSTのスロット再検証（スケジュール外・締切超過・二重予約） → Task 8 ✅
- `cancel`/`complete` の所有者チェック → Task 8（テストあり） ✅
- Webhook署名検証 fail-closed（bypassはtesting環境限定） → Task 10 ✅
- `support_pool` 非公開 → Task 6（テストあり） ✅
- 金額はサーバー側決定（クライアント改ざん不可） → Task 8 ✅

**Phase 2.5 との接続:**
- `StripeService::createParticipantCheckout` / `refund` は本プランで実装済み（2.5は流用）
- `WebhookController::handleParticipantCompleted` の open 分岐は 2.5 Task 8 で追加
- `ExpirePendingApplicationsJob` はオープンセッションのpendingも掃除する
