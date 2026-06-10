# WorldClass Phase 3: 準備フロー・評価 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 予約確定〜事後評価までの準備フロー（質問リスト・readyチェック・催促・自動キャンセル・リマインド・完了判定・評価・品質管理）を実装する。

**Architecture:** 時刻駆動の処理はすべてLaravel Scheduler（毎時）＋Queue Jobで冪等に実装。送信済み判定は専用日時カラムで行う。キャンセルはPhase 2.5の `ProcessSessionCancellation` を流用。締切計算は `Session` モデルのヘルパー（Phase 2.5 Task 2）を流用。

**Tech Stack:** Laravel 13 / Inertia.js + React (.tsx) / Redis Queue / Filament v4

**Spec:** `docs/superpowers/specs/2026-06-10-worldclass-phase3-preparation-flow-design.md`

**前提:** Phase 2.5 プラン完了（`SessionStatus` enum・`Session::applicationDeadline()/readyDeadline()`・`ProcessSessionCancellation`・`SessionCancelled` Mailable が存在すること）

---

## ファイル構成

```
app/
├── UseCases/Preparation/
│   ├── SubmitQuestionListUseCase.php
│   ├── MarkSessionReadyUseCase.php
│   └── SubmitRatingUseCase.php
├── Http/Controllers/
│   ├── QuestionListController.php
│   ├── SessionReadyController.php
│   └── RatingController.php
├── Jobs/
│   ├── RemindUnreadySessionsJob.php
│   ├── AutoCancelUnreadySessionsJob.php
│   ├── SendSessionRemindersJob.php
│   ├── CompleteFinishedSessionsJob.php
│   └── SendRatingRequestsJob.php
├── Mail/
│   ├── PartnerPrepReminder.php
│   ├── AdminUnreadyAlert.php
│   ├── SessionReminder.php
│   └── RatingRequest.php
└── Domain/
    ├── ValueObjects/PartnerStatus.php   # 変更: Hidden追加
    └── Exceptions/QuestionDeadlinePassedException.php
database/migrations/  # sessions・session_participants へのカラム追加
resources/js/Pages/
├── Sessions/Checklist.tsx               # 静的当日チェックリスト
└── Ratings/Create.tsx                   # 評価フォーム
routes/web.php, routes/console.php
```

---

## Task 1: マイグレーション・モデル拡張・PartnerStatus::Hidden

**Files:**
- Create: `database/migrations/xxxx_add_preparation_columns_to_sessions_table.php`
- Create: `database/migrations/xxxx_add_rating_columns_to_session_participants_table.php`
- Modify: `app/Models/Session.php` / `app/Models/SessionParticipant.php`
- Modify: `app/Domain/ValueObjects/PartnerStatus.php`

- [ ] **Step 1: マイグレーション作成**

```bash
docker compose exec app php artisan make:migration add_preparation_columns_to_sessions_table
docker compose exec app php artisan make:migration add_rating_columns_to_session_participants_table
```

sessions側 `up()`:

```php
Schema::table('sessions', function (Blueprint $table) {
    $table->string('meeting_url')->nullable();          // Zoom URL（運営がFilamentで設定）
    $table->dateTime('unready_reminded_at')->nullable(); // 催促メール送信済み判定
    $table->dateTime('reminded_at')->nullable();         // 前日リマインド送信済み判定
});
```

`down()` は `dropColumn(['meeting_url', 'unready_reminded_at', 'reminded_at'])`。

session_participants側 `up()`:

```php
Schema::table('session_participants', function (Blueprint $table) {
    $table->dateTime('rating_requested_at')->nullable(); // 評価依頼送信済み判定
    $table->dateTime('rating_reminded_at')->nullable();  // 評価リマインド送信済み判定
    $table->dateTime('rated_at')->nullable();            // 評価提出日時（連続低評価判定の並び順に使用。updated_atは通知処理でも動くため不可）
});
```

`down()` は `dropColumn(['rating_requested_at', 'rating_reminded_at', 'rated_at'])`。

- [ ] **Step 2: マイグレーション実行**

```bash
docker compose exec app php artisan migrate
```

Expected: 2件 Migrated

- [ ] **Step 3: モデルのfillable・castsに追加**

`app/Models/Session.php` の `#[Fillable]` に `'meeting_url', 'unready_reminded_at', 'reminded_at'` を、`$casts` に:

```php
'unready_reminded_at' => 'datetime',
'reminded_at' => 'datetime',
```

`app/Models/SessionParticipant.php` の `#[Fillable]` に `'rating_requested_at', 'rating_reminded_at', 'rated_at'` を、`$casts` に:

```php
'rating_requested_at' => 'datetime',
'rating_reminded_at' => 'datetime',
'rated_at' => 'datetime',
```

- [ ] **Step 4: PartnerStatus に Hidden を追加**

`app/Domain/ValueObjects/PartnerStatus.php`:

```php
enum PartnerStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Hidden = 'hidden';      // ★2以下×3連続でカタログ非表示
    case Suspended = 'suspended';
    case Rejected = 'rejected';
}
```

> `partners.status` カラムがenum型制約で作られている場合は `hidden` を許容するマイグレーションも追加する（string型なら不要。`database/migrations/2026_06_06_195717_create_partners_table.php` を確認）。

- [ ] **Step 5: 全テスト・コミット**

```bash
docker compose exec app php artisan test
```

Expected: 既存テスト全PASS

```bash
git add database/migrations/ app/Models/ app/Domain/ValueObjects/PartnerStatus.php
git commit -m "feat(db): add preparation flow columns and hidden partner status"
```

---

## Task 2: SubmitQuestionListUseCase（TDD）

**Files:**
- Create: `app/Domain/Exceptions/QuestionDeadlinePassedException.php`
- Create: `app/UseCases/Preparation/SubmitQuestionListUseCase.php`
- Test: `tests/Unit/UseCases/SubmitQuestionListUseCaseTest.php`

- [ ] **Step 1: 例外作成**

`app/Domain/Exceptions/QuestionDeadlinePassedException.php`:

```php
<?php

namespace App\Domain\Exceptions;

class QuestionDeadlinePassedException extends \DomainException
{
    public function __construct()
    {
        parent::__construct('質問リストの送信期限（3日前12時）を過ぎています。');
    }
}
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/Unit/UseCases/SubmitQuestionListUseCaseTest.php`:

```php
<?php

namespace Tests\Unit\UseCases;

use App\Domain\Exceptions\QuestionDeadlinePassedException;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\UseCases\Preparation\SubmitQuestionListUseCase;
use Carbon\Carbon;
use Tests\TestCase;

class SubmitQuestionListUseCaseTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeParticipant(string $scheduledAt): SessionParticipant
    {
        $session = new Session(['scheduled_at' => $scheduledAt, 'status' => 'confirmed']);
        $participant = new SessionParticipant(['status' => 'confirmed']);
        $participant->setRelation('session', $session);

        return $participant;
    }

    public function test_締切前は質問を保存できる(): void
    {
        Carbon::setTestNow('2026-07-07 11:59:00');
        $participant = $this->makeParticipant('2026-07-10 10:00:00');

        $useCase = new SubmitQuestionListUseCase();
        $useCase->validate($participant);

        $this->assertTrue(true); // 例外が出ないこと
    }

    public function test_3日前12時を過ぎると送信不可(): void
    {
        Carbon::setTestNow('2026-07-07 12:01:00');
        $participant = $this->makeParticipant('2026-07-10 10:00:00');

        $this->expectException(QuestionDeadlinePassedException::class);

        (new SubmitQuestionListUseCase())->validate($participant);
    }
}
```

- [ ] **Step 3: 失敗確認**

```bash
docker compose exec app php artisan test tests/Unit/UseCases/SubmitQuestionListUseCaseTest.php
```

Expected: FAIL

- [ ] **Step 4: UseCase実装**

`app/UseCases/Preparation/SubmitQuestionListUseCase.php`:

```php
<?php

namespace App\UseCases\Preparation;

use App\Domain\Exceptions\QuestionDeadlinePassedException;
use App\Models\SessionParticipant;

class SubmitQuestionListUseCase
{
    /** 締切（3日前12時 = applicationDeadlineと同時刻）の検証 */
    public function validate(SessionParticipant $participant): void
    {
        if (now()->greaterThan($participant->session->applicationDeadline())) {
            throw new QuestionDeadlinePassedException();
        }
    }

    public function execute(SessionParticipant $participant, string $questionList): void
    {
        $this->validate($participant);

        $participant->update([
            'question_list' => $questionList,
            'question_list_sent_at' => now(),
        ]);
    }
}
```

- [ ] **Step 5: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Unit/UseCases/SubmitQuestionListUseCaseTest.php
```

Expected: PASS（2件）

```bash
git add app/Domain/Exceptions/QuestionDeadlinePassedException.php app/UseCases/Preparation/ tests/Unit/UseCases/SubmitQuestionListUseCaseTest.php
git commit -m "feat(usecase): add SubmitQuestionListUseCase with 3-days-prior deadline"
```

---

## Task 3: 質問送信・readyチェックのHTTP層

**Files:**
- Create: `app/Http/Controllers/QuestionListController.php`
- Create: `app/Http/Controllers/SessionReadyController.php`
- Create: `app/UseCases/Preparation/MarkSessionReadyUseCase.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/PreparationFlowTest.php`

- [ ] **Step 1: 失敗するFeatureテストを書く**

`tests/Feature/PreparationFlowTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\Partner;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PreparationFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $memberUser;
    private User $partnerUser;
    private Session $session;
    private SessionParticipant $participant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->partnerUser = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => bcrypt('x'), 'role' => 'partner']);
        $partner = Partner::create([
            'user_id' => $this->partnerUser->id, 'provider_type' => 'overseas_school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6',
        ]);
        $this->memberUser = User::create(['name' => 'M', 'email' => 'm@example.com', 'password' => bcrypt('x'), 'role' => 'member']);
        $member = Member::create(['user_id' => $this->memberUser->id, 'type' => 'family', 'prefecture' => '東京都', 'contact_name' => 'M']);

        $this->session = Session::create([
            'partner_id' => $partner->id, 'session_type' => 'open',
            'scheduled_at' => now()->addDays(10), 'duration_min' => 45, 'theme' => 'culture',
            'capacity' => 6, 'min_groups' => 3, 'price_jpy' => 2500, 'status' => 'confirmed',
        ]);
        $this->participant = SessionParticipant::create([
            'session_id' => $this->session->id, 'member_id' => $member->id,
            'status' => 'confirmed', 'price_paid' => 2500, 'support_amount' => 1250,
        ]);
    }

    public function test_memberは締切前に質問を送信できる(): void
    {
        $this->actingAs($this->memberUser)
            ->post("/participants/{$this->participant->id}/questions", ['question_list' => '好きな食べ物は？'])
            ->assertRedirect();

        $this->assertEquals('好きな食べ物は？', $this->participant->fresh()->question_list);
        $this->assertNotNull($this->participant->fresh()->question_list_sent_at);
    }

    public function test_他人のparticipantには送信できない(): void
    {
        $other = User::create(['name' => 'O', 'email' => 'o@example.com', 'password' => bcrypt('x'), 'role' => 'member']);
        Member::create(['user_id' => $other->id, 'type' => 'family', 'prefecture' => '東京都', 'contact_name' => 'O']);

        $this->actingAs($other)
            ->post("/participants/{$this->participant->id}/questions", ['question_list' => 'x'])
            ->assertForbidden();
    }

    public function test_partnerは自セッションをreadyにできる(): void
    {
        $this->actingAs($this->partnerUser)
            ->post("/partner/sessions/{$this->session->id}/ready")
            ->assertRedirect();

        $fresh = $this->session->fresh();
        $this->assertEquals('ready', $fresh->status);
        $this->assertNotNull($fresh->ready_checked_at);
    }

    public function test_confirmed以外のセッションはreadyにできない(): void
    {
        $this->session->update(['status' => 'open']);

        $this->actingAs($this->partnerUser)
            ->post("/partner/sessions/{$this->session->id}/ready")
            ->assertSessionHasErrors();

        $this->assertEquals('open', $this->session->fresh()->status);
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/PreparationFlowTest.php
```

Expected: FAIL（ルート未定義）

- [ ] **Step 3: MarkSessionReadyUseCase 実装**

`app/UseCases/Preparation/MarkSessionReadyUseCase.php`:

```php
<?php

namespace App\UseCases\Preparation;

use App\Domain\ValueObjects\SessionStatus;
use App\Models\Session;

class MarkSessionReadyUseCase
{
    /** @throws \DomainException confirmed以外からは遷移不可 */
    public function execute(Session $session): void
    {
        if ($session->status !== SessionStatus::Confirmed->value) {
            throw new \DomainException('このセッションは準備完了にできる状態ではありません。');
        }

        $session->update([
            'status' => SessionStatus::Ready->value,
            'ready_checked_at' => now(),
        ]);
    }
}
```

- [ ] **Step 4: Controller・ルート実装**

`app/Http/Controllers/QuestionListController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Domain\Exceptions\QuestionDeadlinePassedException;
use App\Models\SessionParticipant;
use App\UseCases\Preparation\SubmitQuestionListUseCase;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class QuestionListController extends Controller
{
    public function store(
        Request $request,
        SessionParticipant $participant,
        SubmitQuestionListUseCase $useCase,
    ): RedirectResponse {
        abort_unless($participant->member->user_id === $request->user()->id, 403);

        $validated = $request->validate(['question_list' => ['required', 'string', 'max:5000']]);

        try {
            $useCase->execute($participant, $validated['question_list']);
        } catch (QuestionDeadlinePassedException $e) {
            return back()->withErrors(['question_list' => $e->getMessage()]);
        }

        return back()->with('status', '質問リストを送信しました。');
    }
}
```

`app/Http/Controllers/SessionReadyController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Session;
use App\UseCases\Preparation\MarkSessionReadyUseCase;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class SessionReadyController extends Controller
{
    public function store(
        Request $request,
        Session $session,
        MarkSessionReadyUseCase $useCase,
    ): RedirectResponse {
        abort_unless($session->partner->user_id === $request->user()->id, 403);

        try {
            $useCase->execute($session);
        } catch (\DomainException $e) {
            return back()->withErrors(['ready' => $e->getMessage()]);
        }

        return back()->with('status', '準備完了をマークしました。');
    }
}
```

`routes/web.php` に追記:

```php
use App\Http\Controllers\QuestionListController;
use App\Http\Controllers\SessionReadyController;

Route::middleware(['auth', 'role:member'])->group(function () {
    Route::post('/participants/{participant}/questions', [QuestionListController::class, 'store'])
        ->name('participants.questions.store');
});

Route::middleware(['auth', 'role:partner'])->group(function () {
    Route::post('/partner/sessions/{session}/ready', [SessionReadyController::class, 'store'])
        ->name('partner.sessions.ready');
});
```

- [ ] **Step 5: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/PreparationFlowTest.php
```

Expected: PASS（4件）

```bash
git add app/Http/Controllers/QuestionListController.php app/Http/Controllers/SessionReadyController.php app/UseCases/Preparation/MarkSessionReadyUseCase.php routes/web.php tests/Feature/PreparationFlowTest.php
git commit -m "feat(http): add question list submission and session ready endpoints"
```

---

## Task 4: メール4種

**Files:**
- Create: `app/Mail/PartnerPrepReminder.php` + `resources/views/mail/preparation/prep-reminder.blade.php`
- Create: `app/Mail/AdminUnreadyAlert.php` + `resources/views/mail/preparation/admin-unready.blade.php`
- Create: `app/Mail/SessionReminder.php` + `resources/views/mail/preparation/session-reminder.blade.php`
- Create: `app/Mail/RatingRequest.php` + `resources/views/mail/preparation/rating-request.blade.php`
- Modify: `config/mail.php` / `.env.example`

- [ ] **Step 1: 運営アラート宛先を設定**

`.env` と `.env.example` に:

```env
ADMIN_ALERT_EMAIL="admin@example.com"
```

`config/mail.php` に追記:

```php
'admin_alert_address' => env('ADMIN_ALERT_EMAIL'),
```

- [ ] **Step 2: Mailable生成・実装**

```bash
docker compose exec app php artisan make:mail PartnerPrepReminder --markdown=mail.preparation.prep-reminder
docker compose exec app php artisan make:mail AdminUnreadyAlert --markdown=mail.preparation.admin-unready
docker compose exec app php artisan make:mail SessionReminder --markdown=mail.preparation.session-reminder
docker compose exec app php artisan make:mail RatingRequest --markdown=mail.preparation.rating-request
```

すべて Phase 2.5 Task 5 の `OpenSessionApplied` と同じ構造（`Queueable, SerializesModels`・envelope/contentメソッド）。コンストラクタとsubject:

| クラス | コンストラクタ | subject |
|---|---|---|
| `PartnerPrepReminder` | `public Session $session` | `[WorldClass] Please confirm your session preparation` |
| `AdminUnreadyAlert` | `public Session $session` | `【WorldClass運営】未準備セッションあり（3日前経過）` |
| `SessionReminder` | `public Session $session` | `【WorldClass】明日セッションが開催されます` |
| `RatingRequest` | `public SessionParticipant $participant` | `【WorldClass】セッションの評価をお願いします` |

テンプレート（要点のみ・各blade）:

`prep-reminder.blade.php`:

```blade
<x-mail::message>
# Preparation check needed

Your session on {{ $session->scheduled_at->format('Y-m-d H:i') }} (JST) is not marked as ready yet.
Please review the question lists and press the "Ready" button on your dashboard **by 12:00 JST on the day before**, or the session will be cancelled automatically.

{{ config('app.name') }}
</x-mail::message>
```

`admin-unready.blade.php`:

```blade
<x-mail::message>
# 未準備セッション

- セッションID: {{ $session->id }}
- 開催: {{ $session->scheduled_at->format('Y年n月j日 H:i') }}
- パートナー: {{ $session->partner->display_name }}

3日前12時を過ぎても準備完了チェックがありません。前日12時に自動キャンセルされます。
</x-mail::message>
```

`session-reminder.blade.php`:

```blade
<x-mail::message>
# 明日のセッションのご案内

- 日時: {{ $session->scheduled_at->format('Y年n月j日 H:i') }}
- 参加URL: {{ $session->meeting_url ?? '（後ほどお知らせします）' }}

[当日チェックリスト]({{ url('/session-checklist') }}) を事前にご確認ください。

{{ config('app.name') }}
</x-mail::message>
```

`rating-request.blade.php`:

```blade
<x-mail::message>
# セッションの評価をお願いします

{{ $participant->session->scheduled_at->format('Y年n月j日') }} のセッションはいかがでしたか。
パートナーの準備について評価（★1〜5）をお寄せください。

<x-mail::button :url="route('ratings.create', ['participant' => $participant->id])">
評価する
</x-mail::button>

{{ config('app.name') }}
</x-mail::message>
```

- [ ] **Step 3: コミット**

```bash
git add app/Mail/ resources/views/mail/preparation/ config/mail.php .env.example
git commit -m "feat(mail): add preparation flow mailables"
```

---

## Task 5: RemindUnreadySessionsJob（TDD）

**Files:**
- Create: `app/Jobs/RemindUnreadySessionsJob.php`
- Test: `tests/Feature/Jobs/RemindUnreadySessionsJobTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Feature/Jobs/RemindUnreadySessionsJobTest.php`:

```php
<?php

namespace Tests\Feature\Jobs;

use App\Jobs\RemindUnreadySessionsJob;
use App\Models\Partner;
use App\Models\Session;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class RemindUnreadySessionsJobTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeSession(string $status, string $scheduledAt): Session
    {
        $user = User::create(['name' => 'P', 'email' => uniqid().'@example.com', 'password' => 'x', 'role' => 'partner']);
        $partner = Partner::create([
            'user_id' => $user->id, 'provider_type' => 'overseas_school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6',
        ]);

        return Session::create([
            'partner_id' => $partner->id, 'session_type' => 'private',
            'scheduled_at' => $scheduledAt, 'duration_min' => 45, 'theme' => 'culture',
            'capacity' => 1, 'min_groups' => 1, 'price_jpy' => 8000, 'status' => $status,
        ]);
    }

    public function test_3日前12時を過ぎた未readyセッションに催促を送る(): void
    {
        Mail::fake();
        config(['mail.admin_alert_address' => 'admin@example.com']);
        Carbon::setTestNow('2026-07-07 13:00:00');
        $session = $this->makeSession('confirmed', '2026-07-10 10:00:00');

        (new RemindUnreadySessionsJob())->handle();

        Mail::assertQueued(\App\Mail\PartnerPrepReminder::class, 1);
        Mail::assertQueued(\App\Mail\AdminUnreadyAlert::class, 1);
        $this->assertNotNull($session->fresh()->unready_reminded_at);
    }

    public function test_2回実行しても重複送信しない_冪等(): void
    {
        Mail::fake();
        Carbon::setTestNow('2026-07-07 13:00:00');
        $this->makeSession('confirmed', '2026-07-10 10:00:00');

        (new RemindUnreadySessionsJob())->handle();
        (new RemindUnreadySessionsJob())->handle();

        Mail::assertQueued(\App\Mail\PartnerPrepReminder::class, 1);
    }

    public function test_ready済み・締切前のセッションには送らない(): void
    {
        Mail::fake();
        Carbon::setTestNow('2026-07-07 13:00:00');
        $this->makeSession('ready', '2026-07-10 10:00:00');     // ready済み
        $this->makeSession('confirmed', '2026-07-20 10:00:00'); // 締切前

        (new RemindUnreadySessionsJob())->handle();

        Mail::assertNothingQueued();
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/Jobs/RemindUnreadySessionsJobTest.php
```

Expected: FAIL

- [ ] **Step 3: Job実装**

```bash
docker compose exec app php artisan make:job RemindUnreadySessionsJob
```

`app/Jobs/RemindUnreadySessionsJob.php`:

```php
<?php

namespace App\Jobs;

use App\Domain\ValueObjects\SessionStatus;
use App\Mail\AdminUnreadyAlert;
use App\Mail\PartnerPrepReminder;
use App\Models\Session;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class RemindUnreadySessionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $targets = Session::query()
            ->where('status', SessionStatus::Confirmed->value)
            ->whereNull('unready_reminded_at')
            ->where('scheduled_at', '>', now())
            ->with('partner.user')
            ->get()
            ->filter(fn (Session $s) => now()->greaterThanOrEqualTo($s->applicationDeadline()));

        foreach ($targets as $session) {
            Mail::to($session->partner->user->email)->queue(new PartnerPrepReminder($session));

            // ADMIN_ALERT_EMAIL未設定でMail::to(null)が例外にならないようガード
            if ($adminAddress = config('mail.admin_alert_address')) {
                Mail::to($adminAddress)->queue(new AdminUnreadyAlert($session));
            } else {
                logger()->warning('ADMIN_ALERT_EMAIL is not configured; unready alert skipped.', ['session_id' => $session->id]);
            }

            $session->update(['unready_reminded_at' => now()]);
        }
    }
}
```

- [ ] **Step 4: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/Jobs/RemindUnreadySessionsJobTest.php
```

Expected: PASS（3件）

```bash
git add app/Jobs/RemindUnreadySessionsJob.php tests/Feature/Jobs/RemindUnreadySessionsJobTest.php
git commit -m "feat(job): add idempotent unready session reminder job"
```

---

## Task 6: AutoCancelUnreadySessionsJob（TDD）

**Files:**
- Create: `app/Jobs/AutoCancelUnreadySessionsJob.php`
- Test: `tests/Feature/Jobs/AutoCancelUnreadySessionsJobTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Feature/Jobs/AutoCancelUnreadySessionsJobTest.php`:

```php
<?php

namespace Tests\Feature\Jobs;

use App\Jobs\AutoCancelUnreadySessionsJob;
use App\Jobs\ProcessSessionCancellation;
use App\Models\Partner;
use App\Models\Session;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class AutoCancelUnreadySessionsJobTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeSession(string $status, string $scheduledAt): Session
    {
        $user = User::create(['name' => 'P', 'email' => uniqid().'@example.com', 'password' => 'x', 'role' => 'partner']);
        $partner = Partner::create([
            'user_id' => $user->id, 'provider_type' => 'overseas_school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6',
        ]);

        return Session::create([
            'partner_id' => $partner->id, 'session_type' => 'private',
            'scheduled_at' => $scheduledAt, 'duration_min' => 45, 'theme' => 'culture',
            'capacity' => 1, 'min_groups' => 1, 'price_jpy' => 8000, 'status' => $status,
        ]);
    }

    public function test_前日12時を過ぎた未readyセッションはキャンセルJob投入(): void
    {
        Queue::fake();
        Carbon::setTestNow('2026-07-09 12:30:00');
        $this->makeSession('confirmed', '2026-07-10 10:00:00');

        (new AutoCancelUnreadySessionsJob())->handle();

        Queue::assertPushed(ProcessSessionCancellation::class, 1);
    }

    public function test_ready済み・期限前は対象外(): void
    {
        Queue::fake();
        Carbon::setTestNow('2026-07-09 12:30:00');
        $this->makeSession('ready', '2026-07-10 10:00:00');      // ready済み
        $this->makeSession('confirmed', '2026-07-11 10:00:00');  // 期限前

        (new AutoCancelUnreadySessionsJob())->handle();

        Queue::assertNothingPushed();
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/Jobs/AutoCancelUnreadySessionsJobTest.php
```

Expected: FAIL

- [ ] **Step 3: Job実装**

```bash
docker compose exec app php artisan make:job AutoCancelUnreadySessionsJob
```

`app/Jobs/AutoCancelUnreadySessionsJob.php`:

```php
<?php

namespace App\Jobs;

use App\Domain\ValueObjects\SessionStatus;
use App\Models\Session;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class AutoCancelUnreadySessionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $targets = Session::query()
            ->where('status', SessionStatus::Confirmed->value)
            ->where('scheduled_at', '>', now())
            ->get()
            ->filter(fn (Session $s) => now()->greaterThanOrEqualTo($s->readyDeadline()));

        foreach ($targets as $session) {
            ProcessSessionCancellation::dispatch($session, 'パートナーの準備確認が取れなかったため');
        }
    }
}
```

> 冪等性は `ProcessSessionCancellation` 側のstatusガード（cancelled なら何もしない）と、本Jobの対象抽出が `confirmed` のみであることで担保（キャンセル処理後は対象から外れる）。

- [ ] **Step 4: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/Jobs/AutoCancelUnreadySessionsJobTest.php
```

Expected: PASS（2件）

```bash
git add app/Jobs/AutoCancelUnreadySessionsJob.php tests/Feature/Jobs/AutoCancelUnreadySessionsJobTest.php
git commit -m "feat(job): auto-cancel unready sessions at noon the day before"
```

---

## Task 7: SendSessionRemindersJob・CompleteFinishedSessionsJob（TDD）

**Files:**
- Create: `app/Jobs/SendSessionRemindersJob.php`
- Create: `app/Jobs/CompleteFinishedSessionsJob.php`
- Test: `tests/Feature/Jobs/SessionLifecycleJobsTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Feature/Jobs/SessionLifecycleJobsTest.php`:

```php
<?php

namespace Tests\Feature\Jobs;

use App\Jobs\CompleteFinishedSessionsJob;
use App\Jobs\SendSessionRemindersJob;
use App\Models\Member;
use App\Models\Partner;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class SessionLifecycleJobsTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeReadySession(string $scheduledAt): Session
    {
        $pUser = User::create(['name' => 'P', 'email' => uniqid().'@example.com', 'password' => 'x', 'role' => 'partner']);
        $partner = Partner::create([
            'user_id' => $pUser->id, 'provider_type' => 'overseas_school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6',
        ]);
        $session = Session::create([
            'partner_id' => $partner->id, 'session_type' => 'open',
            'scheduled_at' => $scheduledAt, 'duration_min' => 45, 'theme' => 'culture',
            'capacity' => 6, 'min_groups' => 3, 'price_jpy' => 2500, 'status' => 'ready',
            'meeting_url' => 'https://zoom.example.com/j/123',
        ]);

        $mUser = User::create(['name' => 'M', 'email' => uniqid().'@example.com', 'password' => 'x', 'role' => 'member']);
        $member = Member::create(['user_id' => $mUser->id, 'type' => 'family', 'prefecture' => '東京都', 'contact_name' => 'M']);
        SessionParticipant::create([
            'session_id' => $session->id, 'member_id' => $member->id,
            'status' => 'confirmed', 'price_paid' => 2500, 'support_amount' => 1250,
        ]);

        return $session;
    }

    public function test_前日9時以降にreadyセッションへリマインドを送る(): void
    {
        Mail::fake();
        Carbon::setTestNow('2026-07-09 09:30:00');
        $session = $this->makeReadySession('2026-07-10 10:00:00');

        (new SendSessionRemindersJob())->handle();

        // 参加member 1名 + パートナー1名 = 2通
        Mail::assertQueued(\App\Mail\SessionReminder::class, 2);
        $this->assertNotNull($session->fresh()->reminded_at);

        // 冪等
        (new SendSessionRemindersJob())->handle();
        Mail::assertQueued(\App\Mail\SessionReminder::class, 2);
    }

    public function test_終了時刻を過ぎたreadyセッションはcompletedになる(): void
    {
        Carbon::setTestNow('2026-07-10 11:00:00'); // 10:00開始+45分 < 11:00
        $session = $this->makeReadySession('2026-07-10 10:00:00');

        (new CompleteFinishedSessionsJob())->handle();

        $this->assertEquals('completed', $session->fresh()->status);
    }

    public function test_実施中のセッションはcompletedにしない(): void
    {
        Carbon::setTestNow('2026-07-10 10:30:00'); // まだ実施中
        $session = $this->makeReadySession('2026-07-10 10:00:00');

        (new CompleteFinishedSessionsJob())->handle();

        $this->assertEquals('ready', $session->fresh()->status);
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/Jobs/SessionLifecycleJobsTest.php
```

Expected: FAIL

- [ ] **Step 3: 2つのJobを実装**

```bash
docker compose exec app php artisan make:job SendSessionRemindersJob
docker compose exec app php artisan make:job CompleteFinishedSessionsJob
```

`app/Jobs/SendSessionRemindersJob.php`:

```php
<?php

namespace App\Jobs;

use App\Domain\ValueObjects\ParticipantStatus;
use App\Domain\ValueObjects\SessionStatus;
use App\Mail\SessionReminder;
use App\Models\Session;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendSessionRemindersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $targets = Session::query()
            ->where('status', SessionStatus::Ready->value)
            ->whereNull('reminded_at')
            ->where('scheduled_at', '>', now())
            ->with(['partner.user', 'participants.member.user'])
            ->get()
            ->filter(fn (Session $s) => now()->greaterThanOrEqualTo(
                $s->scheduled_at->copy()->subDay()->setTime(9, 0)
            ));

        foreach ($targets as $session) {
            foreach ($session->participants->where('status', ParticipantStatus::Confirmed->value) as $participant) {
                Mail::to($participant->member->user->email)->queue(new SessionReminder($session));
            }
            Mail::to($session->partner->user->email)->queue(new SessionReminder($session));

            $session->update(['reminded_at' => now()]);
        }
    }
}
```

`app/Jobs/CompleteFinishedSessionsJob.php`:

```php
<?php

namespace App\Jobs;

use App\Domain\ValueObjects\SessionStatus;
use App\Models\Session;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class CompleteFinishedSessionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $targets = Session::query()
            ->where('status', SessionStatus::Ready->value)
            ->get()
            ->filter(fn (Session $s) => now()->greaterThanOrEqualTo(
                $s->scheduled_at->copy()->addMinutes($s->duration_min)
            ));

        foreach ($targets as $session) {
            $session->update(['status' => SessionStatus::Completed->value]);
            // Phase 4: ここで AccrueSupportPoolUseCase を呼ぶ（Phase 4プラン Task 2 で追記）
        }
    }
}
```

- [ ] **Step 4: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/Jobs/SessionLifecycleJobsTest.php
```

Expected: PASS（3件）

```bash
git add app/Jobs/SendSessionRemindersJob.php app/Jobs/CompleteFinishedSessionsJob.php tests/Feature/Jobs/SessionLifecycleJobsTest.php
git commit -m "feat(job): add session reminder and completion jobs"
```

---

## Task 8: 評価（SendRatingRequestsJob + SubmitRatingUseCase + Controller）

**Files:**
- Create: `app/Jobs/SendRatingRequestsJob.php`
- Create: `app/UseCases/Preparation/SubmitRatingUseCase.php`
- Create: `app/Http/Controllers/RatingController.php`
- Create: `resources/js/Pages/Ratings/Create.tsx`
- Modify: `routes/web.php`
- Test: `tests/Feature/RatingTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Feature/RatingTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Jobs\SendRatingRequestsJob;
use App\Models\Member;
use App\Models\Partner;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class RatingTest extends TestCase
{
    use RefreshDatabase;

    private Partner $partner;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeCompletedParticipant(string $scheduledAt, ?int $rating = null): SessionParticipant
    {
        if (! isset($this->partner)) {
            $pUser = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => 'x', 'role' => 'partner']);
            $this->partner = Partner::create([
                'user_id' => $pUser->id, 'provider_type' => 'overseas_school', 'display_name' => 'S',
                'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
                'themes' => ['culture'], 'grade_range' => '1-6',
            ]);
        }

        $session = Session::create([
            'partner_id' => $this->partner->id, 'session_type' => 'open',
            'scheduled_at' => $scheduledAt, 'duration_min' => 45, 'theme' => 'culture',
            'capacity' => 6, 'min_groups' => 3, 'price_jpy' => 2500, 'status' => 'completed',
        ]);
        $mUser = User::create(['name' => 'M', 'email' => uniqid().'@example.com', 'password' => bcrypt('x'), 'role' => 'member']);
        $member = Member::create(['user_id' => $mUser->id, 'type' => 'family', 'prefecture' => '東京都', 'contact_name' => 'M']);

        return SessionParticipant::create([
            'session_id' => $session->id, 'member_id' => $member->id,
            'status' => 'confirmed', 'price_paid' => 2500, 'support_amount' => 1250,
            'rating_score' => $rating,
            'rated_at' => $rating !== null ? now() : null, // 連続低評価判定はrated_at順
        ]);
    }

    public function test_完了翌日に評価依頼を送り冪等(): void
    {
        Mail::fake();
        Carbon::setTestNow('2026-07-11 10:00:00');
        $p = $this->makeCompletedParticipant('2026-07-10 10:00:00');

        (new SendRatingRequestsJob())->handle();
        (new SendRatingRequestsJob())->handle();

        Mail::assertQueued(\App\Mail\RatingRequest::class, 1);
        $this->assertNotNull($p->fresh()->rating_requested_at);
    }

    public function test_依頼3日後に未提出ならリマインド1回のみ(): void
    {
        Mail::fake();
        Carbon::setTestNow('2026-07-11 10:00:00');
        $p = $this->makeCompletedParticipant('2026-07-10 10:00:00');
        (new SendRatingRequestsJob())->handle(); // 依頼

        Carbon::setTestNow('2026-07-14 11:00:00');
        (new SendRatingRequestsJob())->handle(); // リマインド
        (new SendRatingRequestsJob())->handle(); // 2回目は送らない

        Mail::assertQueued(\App\Mail\RatingRequest::class, 2);
        $this->assertNotNull($p->fresh()->rating_reminded_at);
    }

    public function test_評価提出でパートナー平均が更新される(): void
    {
        $p1 = $this->makeCompletedParticipant('2026-07-01 10:00:00', rating: 5);
        $p2 = $this->makeCompletedParticipant('2026-07-05 10:00:00');

        $this->actingAs($p2->member->user)
            ->post("/participants/{$p2->id}/rating", ['rating_score' => 3, 'rating_comment' => 'good'])
            ->assertRedirect();

        $this->assertEquals(3, $p2->fresh()->rating_score);
        $this->assertEquals(4.0, (float) $this->partner->fresh()->rating_score); // (5+3)/2
    }

    public function test_星2以下が3連続でパートナーがhiddenになる(): void
    {
        $this->makeCompletedParticipant('2026-07-01 10:00:00', rating: 2);
        $this->makeCompletedParticipant('2026-07-02 10:00:00', rating: 1);
        $p3 = $this->makeCompletedParticipant('2026-07-03 10:00:00');

        $this->actingAs($p3->member->user)
            ->post("/participants/{$p3->id}/rating", ['rating_score' => 2])
            ->assertRedirect();

        $this->assertEquals('hidden', $this->partner->fresh()->status);
    }

    public function test_評価済みは再提出できない_平均の操作防止(): void
    {
        $p = $this->makeCompletedParticipant('2026-07-01 10:00:00', rating: 5);

        $this->actingAs($p->member->user)
            ->post("/participants/{$p->id}/rating", ['rating_score' => 1])
            ->assertSessionHasErrors();

        $this->assertEquals(5, $p->fresh()->rating_score);
    }

    public function test_キャンセルした参加者は評価できない(): void
    {
        $p = $this->makeCompletedParticipant('2026-07-01 10:00:00');
        $p->update(['status' => 'cancelled']);

        $this->actingAs($p->member->user)
            ->post("/participants/{$p->id}/rating", ['rating_score' => 1])
            ->assertSessionHasErrors();

        $this->assertNull($p->fresh()->rating_score);
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/RatingTest.php
```

Expected: FAIL

- [ ] **Step 3: SendRatingRequestsJob 実装**

```bash
docker compose exec app php artisan make:job SendRatingRequestsJob
```

`app/Jobs/SendRatingRequestsJob.php`:

```php
<?php

namespace App\Jobs;

use App\Domain\ValueObjects\ParticipantStatus;
use App\Domain\ValueObjects\SessionStatus;
use App\Mail\RatingRequest;
use App\Models\SessionParticipant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendRatingRequestsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        // 初回依頼: completedセッションの翌日以降・未依頼・未評価
        $requests = SessionParticipant::query()
            ->where('status', ParticipantStatus::Confirmed->value)
            ->whereNull('rating_score')
            ->whereNull('rating_requested_at')
            ->whereHas('session', fn ($q) => $q->where('status', SessionStatus::Completed->value))
            ->with('session', 'member.user')
            ->get()
            ->filter(fn ($p) => now()->greaterThanOrEqualTo($p->session->scheduled_at->copy()->addDay()->startOfDay()));

        foreach ($requests as $participant) {
            Mail::to($participant->member->user->email)->queue(new RatingRequest($participant));
            $participant->update(['rating_requested_at' => now()]);
        }

        // リマインド: 依頼から3日経過・未評価・未リマインド（1回のみ）
        $reminders = SessionParticipant::query()
            ->where('status', ParticipantStatus::Confirmed->value)
            ->whereNull('rating_score')
            ->whereNotNull('rating_requested_at')
            ->whereNull('rating_reminded_at')
            ->where('rating_requested_at', '<=', now()->subDays(3))
            ->with('session', 'member.user')
            ->get();

        foreach ($reminders as $participant) {
            Mail::to($participant->member->user->email)->queue(new RatingRequest($participant));
            $participant->update(['rating_reminded_at' => now()]);
        }
    }
}
```

- [ ] **Step 4: SubmitRatingUseCase 実装**

`app/UseCases/Preparation/SubmitRatingUseCase.php`:

```php
<?php

namespace App\UseCases\Preparation;

use App\Domain\ValueObjects\ParticipantStatus;
use App\Domain\ValueObjects\PartnerStatus;
use App\Domain\ValueObjects\SessionStatus;
use App\Models\SessionParticipant;

class SubmitRatingUseCase
{
    public function execute(SessionParticipant $participant, int $score, ?string $comment): void
    {
        if ($participant->session->status !== SessionStatus::Completed->value) {
            throw new \DomainException('完了していないセッションは評価できません。');
        }

        if ($participant->status !== ParticipantStatus::Confirmed->value) {
            throw new \DomainException('参加していないセッションは評価できません。');
        }

        if ($participant->rating_score !== null) {
            throw new \DomainException('このセッションは評価済みです。');
        }

        $participant->update([
            'rating_score' => $score,
            'rating_comment' => $comment,
            'rated_at' => now(),
        ]);

        $partner = $participant->session->partner;

        // 平均再計算
        $avg = SessionParticipant::query()
            ->whereNotNull('rating_score')
            ->whereHas('session', fn ($q) => $q->where('partner_id', $partner->id))
            ->avg('rating_score');

        $partner->update(['rating_score' => round((float) $avg, 2)]);

        // ★2以下×3連続 → カタログ非表示（並びは評価提出日時。updated_atは通知処理でも動くため使わない）
        $lastThree = SessionParticipant::query()
            ->whereNotNull('rating_score')
            ->whereHas('session', fn ($q) => $q->where('partner_id', $partner->id))
            ->latest('rated_at')
            ->limit(3)
            ->pluck('rating_score');

        if ($lastThree->count() === 3 && $lastThree->every(fn ($s) => $s <= 2)) {
            $partner->update(['status' => PartnerStatus::Hidden->value]);
        }
    }
}
```

- [ ] **Step 5: Controller・ルート・評価フォーム**

`app/Http/Controllers/RatingController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\SessionParticipant;
use App\UseCases\Preparation\SubmitRatingUseCase;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RatingController extends Controller
{
    public function create(Request $request, SessionParticipant $participant): Response
    {
        abort_unless($participant->member->user_id === $request->user()->id, 403);

        return Inertia::render('Ratings/Create', [
            'participantId' => $participant->id,
            'scheduledAt' => $participant->session->scheduled_at->toIso8601String(),
            'partnerName' => $participant->session->partner->display_name,
        ]);
    }

    public function store(
        Request $request,
        SessionParticipant $participant,
        SubmitRatingUseCase $useCase,
    ): RedirectResponse {
        abort_unless($participant->member->user_id === $request->user()->id, 403);

        $validated = $request->validate([
            'rating_score' => ['required', 'integer', 'between:1,5'],
            'rating_comment' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $useCase->execute($participant, (int) $validated['rating_score'], $validated['rating_comment'] ?? null);
        } catch (\DomainException $e) {
            return back()->withErrors(['rating_score' => $e->getMessage()]);
        }

        return redirect()->route('member.dashboard')->with('status', '評価を送信しました。ありがとうございました。');
    }
}
```

`routes/web.php` の member グループに追記:

```php
use App\Http\Controllers\RatingController;

Route::get('/participants/{participant}/rating', [RatingController::class, 'create'])->name('ratings.create');
Route::post('/participants/{participant}/rating', [RatingController::class, 'store'])->name('ratings.store');
```

`resources/js/Pages/Ratings/Create.tsx`:

```tsx
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';

export default function Create({
    participantId,
    scheduledAt,
    partnerName,
}: {
    participantId: number;
    scheduledAt: string;
    partnerName: string;
}) {
    const { data, setData, post, errors } = useForm({ rating_score: 5, rating_comment: '' });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/participants/${participantId}/rating`);
    };

    return (
        <AuthenticatedLayout>
            <Head title="セッション評価" />
            <form onSubmit={submit} className="mx-auto max-w-xl space-y-4 p-6">
                <h1 className="text-2xl font-bold">セッションの評価</h1>
                <p>
                    {new Date(scheduledAt).toLocaleDateString('ja-JP')}・{partnerName}
                </p>
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button
                            type="button"
                            key={n}
                            onClick={() => setData('rating_score', n)}
                            className={`text-3xl ${n <= data.rating_score ? 'text-yellow-500' : 'text-gray-300'}`}
                            aria-label={`星${n}`}
                        >
                            ★
                        </button>
                    ))}
                </div>
                {errors.rating_score && <p className="text-red-600">{errors.rating_score}</p>}
                <textarea
                    value={data.rating_comment}
                    onChange={(e) => setData('rating_comment', e.target.value)}
                    placeholder="コメント（任意）"
                    className="w-full rounded border p-2"
                    rows={4}
                />
                <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
                    送信する
                </button>
            </form>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 6: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/RatingTest.php
docker compose exec app npm run build
```

Expected: PASS（6件）・ビルド成功

```bash
git add app/Jobs/SendRatingRequestsJob.php app/UseCases/Preparation/SubmitRatingUseCase.php app/Http/Controllers/RatingController.php resources/js/Pages/Ratings/ routes/web.php tests/Feature/RatingTest.php
git commit -m "feat(rating): add rating request job, submission flow and partner quality rules"
```

---

## Task 9: Scheduler登録・チェックリスト・パートナー質問閲覧・Filament

**Files:**
- Modify: `routes/console.php` / `routes/web.php`
- Create: `resources/js/Pages/Sessions/Checklist.tsx`
- Modify: `app/Filament/Resources/SessionResource.php`（meeting_url）
- Modify: PartnerResource（penalty加算アクション）

- [ ] **Step 1: Scheduler登録**

`routes/console.php` に追記（Phase 2.5の `JudgeOpenSessionFormationJob` の下）:

```php
Schedule::job(new \App\Jobs\RemindUnreadySessionsJob)->hourly();
Schedule::job(new \App\Jobs\AutoCancelUnreadySessionsJob)->hourly();
Schedule::job(new \App\Jobs\SendSessionRemindersJob)->hourly();
Schedule::job(new \App\Jobs\CompleteFinishedSessionsJob)->hourly();
Schedule::job(new \App\Jobs\SendRatingRequestsJob)->hourly();
```

- [ ] **Step 2: 当日チェックリスト静的ページ**

`resources/js/Pages/Sessions/Checklist.tsx`:

```tsx
import { Head } from '@inertiajs/react';

const items = [
    'カメラ・マイクの動作を確認した',
    '安定したネット回線（有線または良好なWi-Fi）を用意した',
    'Zoomアプリを最新版に更新した',
    '開始10分前に入室できるよう準備した',
    '送信した質問リストを手元に用意した',
];

export default function Checklist() {
    return (
        <>
            <Head title="当日チェックリスト" />
            <div className="mx-auto max-w-xl space-y-4 p-6">
                <h1 className="text-2xl font-bold">セッション当日チェックリスト</h1>
                <ul className="list-disc space-y-2 pl-6">
                    {items.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </div>
        </>
    );
}
```

`routes/web.php`（認証不要）:

```php
Route::get('/session-checklist', fn () => \Inertia\Inertia::render('Sessions/Checklist'))
    ->name('session-checklist');
```

- [ ] **Step 3: パートナーの質問一覧閲覧**

パートナーダッシュボードのセッション詳細に質問リストを表示する。`SessionReadyController` に show を追加:

```php
public function show(Request $request, Session $session): \Inertia\Response
{
    abort_unless($session->partner->user_id === $request->user()->id, 403);

    return \Inertia\Inertia::render('Partner/SessionDetail', [
        'session' => [
            'id' => $session->id,
            'scheduled_at' => $session->scheduled_at->toIso8601String(),
            'status' => $session->status,
            'questions' => $session->participants()
                ->whereNotNull('question_list')
                ->get()
                ->map(fn ($p) => ['id' => $p->id, 'question_list' => $p->question_list]),
        ],
    ]);
}
```

ルート（partnerグループ）:

```php
Route::get('/partner/sessions/{session}', [SessionReadyController::class, 'show'])->name('partner.sessions.show');
```

`resources/js/Pages/Partner/SessionDetail.tsx`:

```tsx
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';

type Props = {
    session: {
        id: number;
        scheduled_at: string;
        status: string;
        questions: { id: number; question_list: string }[];
    };
};

export default function SessionDetail({ session }: Props) {
    const markReady = () => router.post(`/partner/sessions/${session.id}/ready`);

    return (
        <AuthenticatedLayout>
            <Head title="Session detail" />
            <div className="mx-auto max-w-2xl space-y-4 p-6">
                <h1 className="text-2xl font-bold">Session: {new Date(session.scheduled_at).toLocaleString()}</h1>
                <h2 className="font-bold">Questions from participants</h2>
                {session.questions.length === 0 && <p>No questions yet.</p>}
                {session.questions.map((q) => (
                    <div key={q.id} className="whitespace-pre-wrap rounded border p-3">
                        {q.question_list}
                    </div>
                ))}
                {session.status === 'confirmed' && (
                    <button onClick={markReady} className="rounded bg-green-600 px-4 py-2 text-white">
                        Mark as Ready
                    </button>
                )}
                {session.status === 'ready' && <p className="text-green-700">Ready ✓</p>}
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 4: Filament拡張**

`SessionResource` フォームに追加:

```php
Forms\Components\TextInput::make('meeting_url')->url()->label('Zoom URL'),
```

PartnerResource（Phase 1 Task 11で作成済み）のテーブル行アクションにペナルティ加算を追加:

```php
use Filament\Actions\Action;
use App\Domain\ValueObjects\PartnerStatus;

Action::make('addPenalty')
    ->label('ペナルティ+1')
    ->requiresConfirmation()
    ->action(function ($record) {
        $record->increment('penalty_count');

        if ($record->penalty_count >= 3) {
            $record->update(['status' => PartnerStatus::Suspended->value]);
        }
    }),
```

- [ ] **Step 5: 非アクティブパートナーのアクセス遮断ミドルウェア**

`suspended` / `rejected` のパートナーがダッシュボード・スケジュール登録・readyチェックを使い続けられないようにする（`hidden` はカタログ非表示のみで、ダッシュボード利用は許可する）。

`app/Http/Middleware/EnsurePartnerActive.php`:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsurePartnerActive
{
    public function handle(Request $request, Closure $next): mixed
    {
        $partner = $request->user()?->partner;

        if ($partner && in_array($partner->status, ['suspended', 'rejected'], true)) {
            abort(403, 'このアカウントは現在利用できません。運営にお問い合わせください。');
        }

        return $next($request);
    }
}
```

`bootstrap/app.php` でエイリアス登録:

```php
$middleware->alias([
    'role' => \App\Http\Middleware\EnsureRole::class,
    'partner.active' => \App\Http\Middleware\EnsurePartnerActive::class,
]);
```

`routes/web.php` のpartnerグループに適用:

```php
Route::middleware(['auth', 'role:partner', 'partner.active'])->prefix('partner')->group(function () {
    // 既存のpartnerルート
});
```

Featureテスト（`tests/Feature/PreparationFlowTest.php` に追加）:

```php
public function test_suspendedパートナーはダッシュボード系にアクセスできない(): void
{
    $this->session->partner->update(['status' => 'suspended']);

    $this->actingAs($this->partnerUser)
        ->post("/partner/sessions/{$this->session->id}/ready")
        ->assertForbidden();
}
```

- [ ] **Step 6: 全テスト・Lint・コミット**

```bash
docker compose exec app php artisan test
docker compose exec app ./vendor/bin/pint
docker compose exec app ./vendor/bin/phpstan analyse --memory-limit=512M
docker compose exec app npm run build
```

Expected: 全PASS

```bash
git add routes/ resources/js/Pages/ app/Filament/ app/Http/Controllers/SessionReadyController.php
git commit -m "feat(preparation): wire scheduler, checklist page, partner question view and admin actions"
```

---

## セルフレビュー（スペックカバレッジ）

- 質問送信・3日前12時締切・期限後ロック → Task 2, 3（ロックはUseCase検証＋フロントは`can_send_questions`） ✅
- readyチェック（confirmed→ready） → Task 3 ✅
- 3日前催促＋運営アラート → Task 5 ✅
- 前日12時自動キャンセル（返金・クーポン） → Task 6（ProcessSessionCancellation流用） ✅
- 前日リマインド（Zoom URL・チェックリスト） → Task 7, 9 ✅
- 完了判定（プール積算フックはPhase 4で接続） → Task 7 ✅
- 評価依頼翌日・リマインド1回・任意 → Task 8 ✅
- 平均再計算・★2×3連続hidden・ペナルティ手動加算3回でsuspended → Task 8, 9 ✅
- メール5種（催促・アラート・キャンセル・リマインド・評価依頼） → Task 4＋SessionCancelled流用 ✅
- 全Job冪等性テスト → Task 5, 6, 7, 8 ✅
