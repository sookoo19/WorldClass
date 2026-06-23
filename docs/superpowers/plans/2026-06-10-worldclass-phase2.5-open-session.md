# WorldClass Phase 2.5: オープンセッション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ご家庭がグループ単位で申込む相乗り型オープンセッション（3グループ成立・即時決済・不成立時自動返金）を実装する。

**Architecture:** クリーンアーキテクチャ（Controller → UseCase → Domain ← Infrastructure）。決済はPhase 2の `StripeService` を拡張して流用。成立判定はLaravel Scheduler＋Queue Job。キャンセル処理は participant 単位で返金する汎用 `ProcessSessionCancellation` Job として実装し、Phase 3 でも流用する。

**Tech Stack:** Laravel 13 / Inertia.js + React (.tsx) / PostgreSQL / Redis Queue / Stripe Checkout / Filament v4 / Pest(PHPUnitスタイル)

**Spec:** `docs/superpowers/specs/2026-06-10-worldclass-phase2.5-open-session-design.md`

**前提:**
- Phase 2 プラン（`2026-05-24-worldclass-phase2-catalog-booking-stripe.md` **2026-06-10改訂版**）完了。流用するコンポーネント: `StripeService::createParticipantCheckout`/`refund`・`WebhookController::handleParticipantCompleted`（participant確定の基盤）・`ExpirePendingApplicationsJob`（オープンの放置pendingも掃除される）
- すべてのコマンドは `docker compose exec app` 内で実行

---

## ファイル構成

```
app/
├── Domain/
│   ├── ValueObjects/
│   │   ├── SessionStatus.php          # 新規: enum
│   │   ├── SessionType.php            # 新規: enum
│   │   └── ParticipantStatus.php      # 新規: enum
│   ├── Repositories/
│   │   └── OpenSessionRepositoryInterface.php  # 新規
│   └── Exceptions/
│       ├── SessionFullException.php             # 新規
│       └── ApplicationDeadlinePassedException.php # 新規
├── UseCases/OpenSession/
│   ├── ListOpenSessionsUseCase.php
│   ├── ApplyToOpenSessionInput.php
│   ├── ApplyToOpenSessionUseCase.php
│   └── JudgeOpenSessionFormationUseCase.php
├── Infrastructure/Repositories/
│   └── EloquentOpenSessionRepository.php
├── Http/Controllers/
│   └── OpenSessionController.php
├── Jobs/
│   ├── ProcessSessionCancellation.php
│   └── JudgeOpenSessionFormationJob.php
├── Mail/
│   ├── OpenSessionApplied.php
│   ├── OpenSessionConfirmed.php
│   ├── SessionCancelled.php
│   └── ParticipantJoined.php
└── Services/StripeService.php          # 変更: participant用Checkout追加
# FEページ（OpenSessions/Index・Show・Complete .tsx）と SessionViewPresenter は
# FEハンズオン計画（2026-06-23）が所有。本phaseはBE（Controller/route/UseCase/Job/Filament）のみ。
routes/web.php                          # 変更
routes/console.php                      # 変更: Scheduler登録
```

---

## Task 1: タイムゾーン設定・ValueObject enum

**Files:**
- Modify: `config/app.php`
- Create: `app/Domain/ValueObjects/SessionStatus.php`
- Create: `app/Domain/ValueObjects/SessionType.php`
- Create: `app/Domain/ValueObjects/ParticipantStatus.php`

- [ ] **Step 1: タイムゾーンをJSTに設定**

`config/app.php` の `'timezone'` を変更（specの締切時刻はすべてJST）:

```php
'timezone' => 'Asia/Tokyo',
```

- [ ] **Step 2: enum 3つを作成**

`app/Domain/ValueObjects/SessionStatus.php`:

```php
<?php

namespace App\Domain\ValueObjects;

enum SessionStatus: string
{
    case Draft = 'draft';
    case Open = 'open';
    case Confirmed = 'confirmed';
    case Ready = 'ready';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
}
```

`app/Domain/ValueObjects/SessionType.php`:

```php
<?php

namespace App\Domain\ValueObjects;

enum SessionType: string
{
    case Private = 'private';
    case Open = 'open';
}
```

`app/Domain/ValueObjects/ParticipantStatus.php`:

```php
<?php

namespace App\Domain\ValueObjects;

enum ParticipantStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Cancelled = 'cancelled';
}
```

- [ ] **Step 3: Larastan・Pint確認**

```bash
docker compose exec app ./vendor/bin/pint
docker compose exec app ./vendor/bin/phpstan analyse --memory-limit=512M
```

Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add config/app.php app/Domain/ValueObjects/
git commit -m "feat(domain): add session/participant status enums and set JST timezone"
```

---

## Task 2: 申込締切のドメインロジック（Session モデル拡張）

締切計算はSessionモデルのヘルパーに集約する（UseCase・Job・Schedulerで共用）。

**Files:**
- Modify: `app/Models/Session.php`
- Test: `tests/Unit/Models/SessionDeadlineTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Unit/Models/SessionDeadlineTest.php`:

```php
<?php

namespace Tests\Unit\Models;

use App\Models\Session;
use Carbon\Carbon;
use Tests\TestCase;

class SessionDeadlineTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_申込締切は3日前の12時(): void
    {
        $session = new Session(['scheduled_at' => '2026-07-10 10:00:00']);

        $this->assertEquals(
            Carbon::parse('2026-07-07 12:00:00'),
            $session->applicationDeadline()
        );
    }

    public function test_直前参加締切は12時間前(): void
    {
        $session = new Session(['scheduled_at' => '2026-07-10 10:00:00']);

        $this->assertEquals(
            Carbon::parse('2026-07-09 22:00:00'),
            $session->lateJoinDeadline()
        );
    }

    public function test_準備完了期限は前日12時(): void
    {
        $session = new Session(['scheduled_at' => '2026-07-10 10:00:00']);

        $this->assertEquals(
            Carbon::parse('2026-07-09 12:00:00'),
            $session->readyDeadline()
        );
    }
}
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
docker compose exec app php artisan test tests/Unit/Models/SessionDeadlineTest.php
```

Expected: FAIL（`applicationDeadline` 未定義）

- [ ] **Step 3: Session モデルにヘルパーを追加**

`app/Models/Session.php` のクラス内に追加:

```php
use Carbon\Carbon;

public function applicationDeadline(): Carbon
{
    return $this->scheduled_at->copy()->subDays(3)->setTime(12, 0);
}

public function lateJoinDeadline(): Carbon
{
    return $this->scheduled_at->copy()->subHours(12);
}

public function readyDeadline(): Carbon
{
    return $this->scheduled_at->copy()->subDay()->setTime(12, 0);
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
docker compose exec app php artisan test tests/Unit/Models/SessionDeadlineTest.php
```

Expected: PASS（3件）

- [ ] **Step 5: コミット**

```bash
git add app/Models/Session.php tests/Unit/Models/SessionDeadlineTest.php
git commit -m "feat(domain): add deadline helpers to Session model"
```

---

## Task 3: OpenSessionRepository（一覧・残枠集計）

**Files:**
- Create: `app/Domain/Repositories/OpenSessionRepositoryInterface.php`
- Create: `app/Infrastructure/Repositories/EloquentOpenSessionRepository.php`
- Modify: `app/Providers/AppServiceProvider.php`
- Test: `tests/Integration/Repositories/EloquentOpenSessionRepositoryTest.php`

- [ ] **Step 1: インターフェース作成**

`app/Domain/Repositories/OpenSessionRepositoryInterface.php`:

```php
<?php

namespace App\Domain\Repositories;

use App\Models\Session;
use Illuminate\Support\Collection;

interface OpenSessionRepositoryInterface
{
    /**
     * 募集中・成立済みで残枠のあるオープンセッション一覧。
     * 各Sessionに active_participants_count（pending+confirmed数）を付与して返す。
     */
    public function listVisible(): Collection;

    /** 申込対象のオープンセッションを取得（存在しなければnull） */
    public function findOpenSession(int $id): ?Session;

    /** pending+confirmed の参加グループ数 */
    public function countActiveParticipants(int $sessionId): int;
}
```

- [ ] **Step 2: 失敗する統合テストを書く**

`tests/Integration/Repositories/EloquentOpenSessionRepositoryTest.php`:

```php
<?php

namespace Tests\Integration\Repositories;

use App\Infrastructure\Repositories\EloquentOpenSessionRepository;
use App\Models\Member;
use App\Models\Partner;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EloquentOpenSessionRepositoryTest extends TestCase
{
    use RefreshDatabase;

    private function makePartner(): Partner
    {
        $user = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => 'x', 'role' => 'partner']);

        return Partner::create([
            'user_id' => $user->id, 'provider_type' => 'overseas_school',
            'display_name' => 'Test School', 'country' => 'Kenya', 'region' => 'Nairobi',
            'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6',
        ]);
    }

    private function makeMember(string $email): Member
    {
        $user = User::create(['name' => 'M', 'email' => $email, 'password' => 'x', 'role' => 'member']);

        return Member::create([
            'user_id' => $user->id, 'type' => 'family',
            'prefecture' => '東京都', 'contact_name' => 'M',
        ]);
    }

    private function makeOpenSession(Partner $partner, string $status = 'open'): Session
    {
        return Session::create([
            'partner_id' => $partner->id, 'session_type' => 'open',
            'scheduled_at' => now()->addDays(14)->setTime(10, 0),
            'duration_min' => 45, 'theme' => 'culture',
            'capacity' => 6, 'min_groups' => 3,
            'with_facilitator' => true, 'price_jpy' => 2500, 'status' => $status,
        ]);
    }

    public function test_公開中のオープンセッションのみ残枠付きで返す(): void
    {
        $partner = $this->makePartner();
        $open = $this->makeOpenSession($partner);
        $this->makeOpenSession($partner, 'draft');     // 非表示
        $this->makeOpenSession($partner, 'cancelled'); // 非表示

        SessionParticipant::create([
            'session_id' => $open->id, 'member_id' => $this->makeMember('a@example.com')->id,
            'status' => 'confirmed', 'price_paid' => 2500, 'support_amount' => 1250,
        ]);

        $repo = new EloquentOpenSessionRepository();
        $list = $repo->listVisible();

        $this->assertCount(1, $list);
        $this->assertEquals(1, $list->first()->active_participants_count);
    }

    public function test_残枠カウントはpendingも含みcancelledは除く(): void
    {
        $partner = $this->makePartner();
        $session = $this->makeOpenSession($partner);

        foreach ([['b@example.com', 'pending'], ['c@example.com', 'confirmed'], ['d@example.com', 'cancelled']] as [$email, $status]) {
            SessionParticipant::create([
                'session_id' => $session->id, 'member_id' => $this->makeMember($email)->id,
                'status' => $status, 'price_paid' => 2500, 'support_amount' => 1250,
            ]);
        }

        $repo = new EloquentOpenSessionRepository();

        $this->assertEquals(2, $repo->countActiveParticipants($session->id));
    }
}
```

- [ ] **Step 3: 失敗確認**

```bash
docker compose exec app php artisan test tests/Integration/Repositories/EloquentOpenSessionRepositoryTest.php
```

Expected: FAIL（クラス未定義）

- [ ] **Step 4: Eloquent実装**

`app/Infrastructure/Repositories/EloquentOpenSessionRepository.php`:

```php
<?php

namespace App\Infrastructure\Repositories;

use App\Domain\Repositories\OpenSessionRepositoryInterface;
use App\Domain\ValueObjects\ParticipantStatus;
use App\Domain\ValueObjects\SessionStatus;
use App\Domain\ValueObjects\SessionType;
use App\Models\Session;
use App\Models\SessionParticipant;
use Illuminate\Support\Collection;

class EloquentOpenSessionRepository implements OpenSessionRepositoryInterface
{
    public function listVisible(): Collection
    {
        return Session::query()
            ->where('session_type', SessionType::Open->value)
            ->whereIn('status', [SessionStatus::Open->value, SessionStatus::Confirmed->value, SessionStatus::Ready->value])
            ->where('scheduled_at', '>', now())
            ->with('partner')
            ->withCount(['participants as active_participants_count' => function ($q) {
                $q->whereIn('status', [ParticipantStatus::Pending->value, ParticipantStatus::Confirmed->value]);
            }])
            ->orderBy('scheduled_at')
            ->get();
    }

    public function findOpenSession(int $id): ?Session
    {
        return Session::query()
            ->where('id', $id)
            ->where('session_type', SessionType::Open->value)
            ->first();
    }

    public function countActiveParticipants(int $sessionId): int
    {
        return SessionParticipant::query()
            ->where('session_id', $sessionId)
            ->whereIn('status', [ParticipantStatus::Pending->value, ParticipantStatus::Confirmed->value])
            ->count();
    }
}
```

- [ ] **Step 5: DIバインディング登録**

`app/Providers/AppServiceProvider.php` の `register()` に追記:

```php
$this->app->bind(
    \App\Domain\Repositories\OpenSessionRepositoryInterface::class,
    \App\Infrastructure\Repositories\EloquentOpenSessionRepository::class,
);
```

- [ ] **Step 6: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Integration/Repositories/EloquentOpenSessionRepositoryTest.php
```

Expected: PASS（2件）

```bash
git add app/Domain/Repositories/OpenSessionRepositoryInterface.php app/Infrastructure/Repositories/EloquentOpenSessionRepository.php app/Providers/AppServiceProvider.php tests/Integration/
git commit -m "feat(infra): add OpenSessionRepository with remaining-slot counting"
```

---

## Task 4: ApplyToOpenSessionUseCase（TDD）

**Files:**
- Create: `app/Domain/Exceptions/SessionFullException.php`
- Create: `app/Domain/Exceptions/ApplicationDeadlinePassedException.php`
- Create: `app/UseCases/OpenSession/ApplyToOpenSessionInput.php`
- Create: `app/UseCases/OpenSession/ApplyToOpenSessionUseCase.php`
- Test: `tests/Unit/UseCases/ApplyToOpenSessionUseCaseTest.php`

- [ ] **Step 1: ドメイン例外を作成**

`app/Domain/Exceptions/SessionFullException.php`:

```php
<?php

namespace App\Domain\Exceptions;

class SessionFullException extends \DomainException
{
    public function __construct()
    {
        parent::__construct('このセッションは満枠です。');
    }
}
```

`app/Domain/Exceptions/ApplicationDeadlinePassedException.php`:

```php
<?php

namespace App\Domain\Exceptions;

class ApplicationDeadlinePassedException extends \DomainException
{
    public function __construct()
    {
        parent::__construct('申込締切を過ぎています。');
    }
}
```

- [ ] **Step 2: StripeService の participant 用 Checkout メソッドを確認**

`StripeService::createParticipantCheckout` は **Phase 2（改訂版）Task 5 で実装済み**（participant単位・metadata `participant_id`・金額は `price_paid`）。存在することを確認するのみ。追加実装は不要。

- [ ] **Step 3: 失敗するユニットテストを書く**

`tests/Unit/UseCases/ApplyToOpenSessionUseCaseTest.php`:

```php
<?php

namespace Tests\Unit\UseCases;

use App\Domain\Exceptions\ApplicationDeadlinePassedException;
use App\Domain\Exceptions\SessionFullException;
use App\Domain\Repositories\OpenSessionRepositoryInterface;
use App\Models\Session;
use App\UseCases\OpenSession\ApplyToOpenSessionInput;
use App\UseCases\OpenSession\ApplyToOpenSessionUseCase;
use Carbon\Carbon;
use Mockery;
use Tests\TestCase;

class ApplyToOpenSessionUseCaseTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Mockery::close();
        parent::tearDown();
    }

    private function makeSession(string $status, string $scheduledAt): Session
    {
        $session = new Session([
            'session_type' => 'open', 'scheduled_at' => $scheduledAt,
            'duration_min' => 45, 'theme' => 'culture',
            'capacity' => 6, 'min_groups' => 3, 'price_jpy' => 2500,
            'status' => $status,
        ]);
        $session->id = 1;

        return $session;
    }

    public function test_募集中セッションは締切前なら検証を通過する(): void
    {
        Carbon::setTestNow('2026-07-01 10:00:00');
        $session = $this->makeSession('open', '2026-07-10 10:00:00');

        $repo = Mockery::mock(OpenSessionRepositoryInterface::class);
        $repo->shouldReceive('findOpenSession')->with(1)->andReturn($session);
        $repo->shouldReceive('countActiveParticipants')->with(1)->andReturn(5);

        $useCase = new ApplyToOpenSessionUseCase($repo);

        // 検証部分のみテスト（participant作成はFeatureテストで担保）
        $validated = $useCase->validateApplication(new ApplyToOpenSessionInput(sessionId: 1, memberId: 10));

        $this->assertSame($session, $validated);
    }

    public function test_募集中セッションは3日前12時を過ぎると申込不可(): void
    {
        Carbon::setTestNow('2026-07-07 12:01:00');
        $session = $this->makeSession('open', '2026-07-10 10:00:00');

        $repo = Mockery::mock(OpenSessionRepositoryInterface::class);
        $repo->shouldReceive('findOpenSession')->with(1)->andReturn($session);

        $this->expectException(ApplicationDeadlinePassedException::class);

        (new ApplyToOpenSessionUseCase($repo))
            ->validateApplication(new ApplyToOpenSessionInput(sessionId: 1, memberId: 10));
    }

    public function test_成立済みセッションは12時間前まで申込可(): void
    {
        Carbon::setTestNow('2026-07-09 21:59:00');
        $session = $this->makeSession('confirmed', '2026-07-10 10:00:00');

        $repo = Mockery::mock(OpenSessionRepositoryInterface::class);
        $repo->shouldReceive('findOpenSession')->with(1)->andReturn($session);
        $repo->shouldReceive('countActiveParticipants')->with(1)->andReturn(3);

        $validated = (new ApplyToOpenSessionUseCase($repo))
            ->validateApplication(new ApplyToOpenSessionInput(sessionId: 1, memberId: 10));

        $this->assertSame($session, $validated);
    }

    public function test_成立済みセッションも12時間前を過ぎると申込不可(): void
    {
        Carbon::setTestNow('2026-07-09 22:01:00');
        $session = $this->makeSession('confirmed', '2026-07-10 10:00:00');

        $repo = Mockery::mock(OpenSessionRepositoryInterface::class);
        $repo->shouldReceive('findOpenSession')->with(1)->andReturn($session);

        $this->expectException(ApplicationDeadlinePassedException::class);

        (new ApplyToOpenSessionUseCase($repo))
            ->validateApplication(new ApplyToOpenSessionInput(sessionId: 1, memberId: 10));
    }

    public function test_満枠なら申込不可_pending込みでカウント(): void
    {
        Carbon::setTestNow('2026-07-01 10:00:00');
        $session = $this->makeSession('open', '2026-07-10 10:00:00');

        $repo = Mockery::mock(OpenSessionRepositoryInterface::class);
        $repo->shouldReceive('findOpenSession')->with(1)->andReturn($session);
        $repo->shouldReceive('countActiveParticipants')->with(1)->andReturn(6);

        $this->expectException(SessionFullException::class);

        (new ApplyToOpenSessionUseCase($repo))
            ->validateApplication(new ApplyToOpenSessionInput(sessionId: 1, memberId: 10));
    }
}
```

- [ ] **Step 4: 失敗確認**

```bash
docker compose exec app php artisan test tests/Unit/UseCases/ApplyToOpenSessionUseCaseTest.php
```

Expected: FAIL（クラス未定義）

- [ ] **Step 5: Input・UseCase実装**

`app/UseCases/OpenSession/ApplyToOpenSessionInput.php`:

```php
<?php

namespace App\UseCases\OpenSession;

class ApplyToOpenSessionInput
{
    public function __construct(
        public readonly int $sessionId,
        public readonly int $memberId,
    ) {}
}
```

`app/UseCases/OpenSession/ApplyToOpenSessionUseCase.php`:

```php
<?php

namespace App\UseCases\OpenSession;

use App\Domain\Exceptions\ApplicationDeadlinePassedException;
use App\Domain\Exceptions\SessionFullException;
use App\Domain\Repositories\OpenSessionRepositoryInterface;
use App\Domain\ValueObjects\ParticipantStatus;
use App\Domain\ValueObjects\SessionStatus;
use App\Models\Session;
use App\Models\SessionParticipant;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

class ApplyToOpenSessionUseCase
{
    public function __construct(
        private OpenSessionRepositoryInterface $repository,
    ) {}

    /**
     * 申込可否を検証してSessionを返す。
     *
     * 募集中(open): 3日前12時まで / 成立済み(confirmed・ready): 12時間前まで（直前参加）
     * 残枠: pending含むactive数 < capacity
     */
    public function validateApplication(ApplyToOpenSessionInput $input): Session
    {
        $session = $this->repository->findOpenSession($input->sessionId);

        if ($session === null) {
            throw new ModelNotFoundException();
        }

        $deadline = match ($session->status) {
            SessionStatus::Open->value => $session->applicationDeadline(),
            SessionStatus::Confirmed->value, SessionStatus::Ready->value => $session->lateJoinDeadline(),
            default => throw new ApplicationDeadlinePassedException(),
        };

        if (now()->greaterThan($deadline)) {
            throw new ApplicationDeadlinePassedException();
        }

        if ($this->repository->countActiveParticipants($session->id) >= $session->capacity) {
            throw new SessionFullException();
        }

        return $session;
    }

    /**
     * 検証→pending participant作成。Checkout起動はController側でStripeServiceを呼ぶ。
     * セッション行をロックしてから残枠を検証することで、同時申込による超過販売を防ぐ。
     */
    public function execute(ApplyToOpenSessionInput $input): SessionParticipant
    {
        return DB::transaction(function () use ($input) {
            // 行ロック: 並行する申込はここで直列化され、残枠カウントが正確になる
            Session::query()->whereKey($input->sessionId)->lockForUpdate()->first();

            $session = $this->validateApplication($input);

            return SessionParticipant::create([
                'session_id' => $session->id,
                'member_id' => $input->memberId,
                'status' => ParticipantStatus::Pending->value,
                'price_paid' => $session->price_jpy,
                'support_amount' => (int) floor($session->price_jpy * 0.5),
            ]);
        });
    }
}
```

- [ ] **Step 6: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Unit/UseCases/ApplyToOpenSessionUseCaseTest.php
```

Expected: PASS（5件）

```bash
git add app/Domain/Exceptions/ app/UseCases/OpenSession/ app/Services/StripeService.php tests/Unit/UseCases/ApplyToOpenSessionUseCaseTest.php
git commit -m "feat(usecase): add ApplyToOpenSessionUseCase with deadline/capacity validation"
```

---

## Task 5: メール（Markdown Mailable 4種）

**Files:**
- Create: `app/Mail/OpenSessionApplied.php` + `resources/views/mail/open-session/applied.blade.php`
- Create: `app/Mail/OpenSessionConfirmed.php` + `resources/views/mail/open-session/confirmed.blade.php`
- Create: `app/Mail/SessionCancelled.php` + `resources/views/mail/session/cancelled.blade.php`
- Create: `app/Mail/ParticipantJoined.php` + `resources/views/mail/open-session/participant-joined.blade.php`

- [ ] **Step 1: Mailable生成**

```bash
docker compose exec app php artisan make:mail OpenSessionApplied --markdown=mail.open-session.applied
docker compose exec app php artisan make:mail OpenSessionConfirmed --markdown=mail.open-session.confirmed
docker compose exec app php artisan make:mail SessionCancelled --markdown=mail.session.cancelled
docker compose exec app php artisan make:mail ParticipantJoined --markdown=mail.open-session.participant-joined
```

- [ ] **Step 2: 各Mailableのコンストラクタとenvelopeを実装**

4ファイル共通パターン。`app/Mail/OpenSessionApplied.php`:

```php
<?php

namespace App\Mail;

use App\Models\SessionParticipant;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OpenSessionApplied extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public SessionParticipant $participant) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: '【WorldClass】オープンセッション申込完了');
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.open-session.applied');
    }
}
```

`OpenSessionConfirmed`（subject: `【WorldClass】セッション成立のお知らせ`・`public SessionParticipant $participant`）、`ParticipantJoined`（subject: `【WorldClass】参加グループが追加されました`・`public SessionParticipant $participant`）も同構造。

`SessionCancelled` のみ Session を受け取る:

```php
public function __construct(public \App\Models\Session $session, public string $reason) {}

public function envelope(): Envelope
{
    return new Envelope(subject: '【WorldClass】セッションキャンセルのお知らせ');
}
```

- [ ] **Step 3: テンプレート実装**

`resources/views/mail/open-session/applied.blade.php`:

```blade
<x-mail::message>
# 申込を受け付けました

- 日時: {{ $participant->session->scheduled_at->format('Y年n月j日 H:i') }}
- パートナー: {{ $participant->session->partner->display_name }}
- 料金: {{ number_format($participant->price_paid) }}円（1グループ）

3グループ以上で成立します。成立しなかった場合は全額返金されます。

{{ config('app.name') }}
</x-mail::message>
```

`confirmed.blade.php`:

```blade
<x-mail::message>
# セッションが成立しました

- 日時: {{ $participant->session->scheduled_at->format('Y年n月j日 H:i') }}
- パートナー: {{ $participant->session->partner->display_name }}

開催前日にZoomのURLをお送りします。質問・リクエストは3日前の12時まで送信できます。

{{ config('app.name') }}
</x-mail::message>
```

`cancelled.blade.php`:

```blade
<x-mail::message>
# セッションがキャンセルされました

- 日時: {{ $session->scheduled_at->format('Y年n月j日 H:i') }}
- 理由: {{ $reason }}

お支払いいただいた料金は全額返金されます。お詫びとして次回利用時に使える10%割引クーポンを発行しました。

{{ config('app.name') }}
</x-mail::message>
```

`participant-joined.blade.php`:

```blade
<x-mail::message>
# A new group has joined your session

- Date: {{ $participant->session->scheduled_at->format('Y-m-d H:i') }} (JST)
- Current groups: {{ $participant->session->participants()->where('status', 'confirmed')->count() }}

No additional preparation is required.

{{ config('app.name') }}
</x-mail::message>
```

- [ ] **Step 4: 送信元アドレスを設定**

`.env` と `.env.example` に（既にある場合は確認のみ）:

```env
MAIL_FROM_ADDRESS="no-reply@example.com"
MAIL_FROM_NAME="WorldClass"
```

- [ ] **Step 5: コミット**

```bash
git add app/Mail/ resources/views/mail/ .env.example
git commit -m "feat(mail): add open session mailables (applied/confirmed/cancelled/joined)"
```

---

## Task 6: ProcessSessionCancellation Job（participant単位返金・汎用）

Phase 3 の自動キャンセルでも流用する汎用Job。

**Files:**
- Create: `app/Jobs/ProcessSessionCancellation.php`
- Test: `tests/Feature/ProcessSessionCancellationTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Feature/ProcessSessionCancellationTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Jobs\ProcessSessionCancellation;
use App\Models\Coupon;
use App\Models\Member;
use App\Models\Partner;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\Models\User;
use App\Services\StripeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Mockery;
use Tests\TestCase;

class ProcessSessionCancellationTest extends TestCase
{
    use RefreshDatabase;

    private function makeSessionWithParticipants(): Session
    {
        $pUser = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => 'x', 'role' => 'partner']);
        $partner = Partner::create([
            'user_id' => $pUser->id, 'provider_type' => 'overseas_school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6',
        ]);
        $session = Session::create([
            'partner_id' => $partner->id, 'session_type' => 'open',
            'scheduled_at' => now()->addDays(2), 'duration_min' => 45, 'theme' => 'culture',
            'capacity' => 6, 'min_groups' => 3, 'price_jpy' => 2500, 'status' => 'open',
        ]);

        foreach ([1, 2] as $i) {
            $mUser = User::create(['name' => "M$i", 'email' => "m$i@example.com", 'password' => 'x', 'role' => 'member']);
            $member = Member::create(['user_id' => $mUser->id, 'type' => 'family', 'prefecture' => '東京都', 'contact_name' => "M$i"]);
            SessionParticipant::create([
                'session_id' => $session->id, 'member_id' => $member->id,
                'status' => 'confirmed', 'stripe_payment_id' => "pi_test_$i",
                'price_paid' => 2500, 'support_amount' => 1250,
            ]);
        }

        return $session;
    }

    public function test_全参加者を返金しクーポンを発行してキャンセルする(): void
    {
        Mail::fake();
        $session = $this->makeSessionWithParticipants();

        $stripe = Mockery::mock(StripeService::class);
        $stripe->shouldReceive('refund')->twice()->with(Mockery::pattern('/^pi_test_/'));
        $this->app->instance(StripeService::class, $stripe);

        (new ProcessSessionCancellation($session, '最低グループ数未達'))->handle($stripe);

        $this->assertEquals('cancelled', $session->fresh()->status);
        $this->assertEquals(2, SessionParticipant::where('status', 'cancelled')->count());
        $this->assertEquals(2, Coupon::where('discount_pct', 10)->where('reason', 'auto_cancel')->count());
        Mail::assertQueued(\App\Mail\SessionCancelled::class, 2);
    }

    public function test_キャンセル済みセッションは何もしない_冪等(): void
    {
        Mail::fake();
        $session = $this->makeSessionWithParticipants();
        $session->update(['status' => 'cancelled']);

        $stripe = Mockery::mock(StripeService::class);
        $stripe->shouldNotReceive('refund');

        (new ProcessSessionCancellation($session, 'x'))->handle($stripe);

        Mail::assertNothingQueued();
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/ProcessSessionCancellationTest.php
```

Expected: FAIL（Job未定義）

- [ ] **Step 3: Job実装**

```bash
docker compose exec app php artisan make:job ProcessSessionCancellation
```

`app/Jobs/ProcessSessionCancellation.php`:

```php
<?php

namespace App\Jobs;

use App\Domain\ValueObjects\ParticipantStatus;
use App\Domain\ValueObjects\SessionStatus;
use App\Mail\SessionCancelled;
use App\Models\Coupon;
use App\Models\Session;
use App\Services\StripeService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class ProcessSessionCancellation implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private readonly Session $session,
        private readonly string $reason,
    ) {}

    public function handle(StripeService $stripeService): void
    {
        if ($this->session->status === SessionStatus::Cancelled->value) {
            return;
        }

        $participants = $this->session->participants()
            ->where('status', '!=', ParticipantStatus::Cancelled->value)
            ->with('member.user')
            ->get();

        foreach ($participants as $participant) {
            if ($participant->stripe_payment_id) {
                $stripeService->refund($participant->stripe_payment_id);
            }

            $participant->update([
                'status' => ParticipantStatus::Cancelled->value,
                'cancelled_at' => now(),
            ]);

            Coupon::create([
                'member_id' => $participant->member_id,
                'discount_pct' => 10,
                'reason' => 'auto_cancel',
                'expires_at' => now()->addMonths(3),
            ]);

            Mail::to($participant->member->user->email)
                ->queue(new SessionCancelled($this->session, $this->reason));
        }

        $this->session->update([
            'status' => SessionStatus::Cancelled->value,
            'cancelled_at' => now(),
        ]);
    }
}
```

- [ ] **Step 4: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/ProcessSessionCancellationTest.php
```

Expected: PASS（2件）

```bash
git add app/Jobs/ProcessSessionCancellation.php tests/Feature/ProcessSessionCancellationTest.php
git commit -m "feat(job): add participant-based ProcessSessionCancellation with refund and coupon"
```

---

## Task 7: 成立判定（UseCase + Scheduler Job）

**Files:**
- Create: `app/UseCases/OpenSession/JudgeOpenSessionFormationUseCase.php`
- Create: `app/Jobs/JudgeOpenSessionFormationJob.php`
- Modify: `routes/console.php`
- Test: `tests/Feature/JudgeOpenSessionFormationTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Feature/JudgeOpenSessionFormationTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Jobs\ProcessSessionCancellation;
use App\Models\Member;
use App\Models\Partner;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\Models\User;
use App\UseCases\OpenSession\JudgeOpenSessionFormationUseCase;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class JudgeOpenSessionFormationTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeSession(int $confirmedCount, string $scheduledAt): Session
    {
        $pUser = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => 'x', 'role' => 'partner']);
        $partner = Partner::create([
            'user_id' => $pUser->id, 'provider_type' => 'overseas_school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6',
        ]);
        $session = Session::create([
            'partner_id' => $partner->id, 'session_type' => 'open',
            'scheduled_at' => $scheduledAt, 'duration_min' => 45, 'theme' => 'culture',
            'capacity' => 6, 'min_groups' => 3, 'price_jpy' => 2500, 'status' => 'open',
        ]);

        for ($i = 1; $i <= $confirmedCount; $i++) {
            $mUser = User::create(['name' => "M$i", 'email' => "m$i@example.com", 'password' => 'x', 'role' => 'member']);
            $member = Member::create(['user_id' => $mUser->id, 'type' => 'family', 'prefecture' => '東京都', 'contact_name' => "M$i"]);
            SessionParticipant::create([
                'session_id' => $session->id, 'member_id' => $member->id,
                'status' => 'confirmed', 'stripe_payment_id' => "pi_$i",
                'price_paid' => 2500, 'support_amount' => 1250,
            ]);
        }

        return $session;
    }

    public function test_締切時点で3グループ以上なら成立する(): void
    {
        Mail::fake();
        Carbon::setTestNow('2026-07-07 12:30:00'); // 締切(7/7 12:00)経過後
        $session = $this->makeSession(3, '2026-07-10 10:00:00');

        app(JudgeOpenSessionFormationUseCase::class)->execute();

        $this->assertEquals('confirmed', $session->fresh()->status);
        Mail::assertQueued(\App\Mail\OpenSessionConfirmed::class, 3);
    }

    public function test_締切時点で未達ならキャンセルJobを投入する(): void
    {
        Queue::fake();
        Carbon::setTestNow('2026-07-07 12:30:00');
        $session = $this->makeSession(2, '2026-07-10 10:00:00');

        app(JudgeOpenSessionFormationUseCase::class)->execute();

        Queue::assertPushed(ProcessSessionCancellation::class);
    }

    public function test_締切前のセッションは判定しない(): void
    {
        Queue::fake();
        Mail::fake();
        Carbon::setTestNow('2026-07-07 11:00:00'); // 締切前
        $session = $this->makeSession(2, '2026-07-10 10:00:00');

        app(JudgeOpenSessionFormationUseCase::class)->execute();

        $this->assertEquals('open', $session->fresh()->status);
        Queue::assertNothingPushed();
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/JudgeOpenSessionFormationTest.php
```

Expected: FAIL（クラス未定義）

- [ ] **Step 3: UseCase実装**

`app/UseCases/OpenSession/JudgeOpenSessionFormationUseCase.php`:

```php
<?php

namespace App\UseCases\OpenSession;

use App\Domain\ValueObjects\ParticipantStatus;
use App\Domain\ValueObjects\SessionStatus;
use App\Domain\ValueObjects\SessionType;
use App\Jobs\ProcessSessionCancellation;
use App\Mail\OpenSessionConfirmed;
use App\Models\Session;
use Illuminate\Support\Facades\Mail;

class JudgeOpenSessionFormationUseCase
{
    /**
     * 締切（3日前12時）を過ぎた募集中オープンセッションを判定する。
     * 冪等: statusがopenのものだけが対象。
     */
    public function execute(): void
    {
        $targets = Session::query()
            ->where('session_type', SessionType::Open->value)
            ->where('status', SessionStatus::Open->value)
            ->where('scheduled_at', '>', now())
            ->get()
            ->filter(fn (Session $s) => now()->greaterThanOrEqualTo($s->applicationDeadline()));

        foreach ($targets as $session) {
            $confirmed = $session->participants()
                ->where('status', ParticipantStatus::Confirmed->value)
                ->with('member.user')
                ->get();

            if ($confirmed->count() >= $session->min_groups) {
                $session->update(['status' => SessionStatus::Confirmed->value]);

                foreach ($confirmed as $participant) {
                    Mail::to($participant->member->user->email)
                        ->queue(new OpenSessionConfirmed($participant));
                }
            } else {
                ProcessSessionCancellation::dispatch($session, '最低グループ数（3グループ）に達しなかったため');
            }
        }
    }
}
```

- [ ] **Step 4: Job作成・Scheduler登録**

```bash
docker compose exec app php artisan make:job JudgeOpenSessionFormationJob
```

`app/Jobs/JudgeOpenSessionFormationJob.php`:

```php
<?php

namespace App\Jobs;

use App\UseCases\OpenSession\JudgeOpenSessionFormationUseCase;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class JudgeOpenSessionFormationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(JudgeOpenSessionFormationUseCase $useCase): void
    {
        $useCase->execute();
    }
}
```

`routes/console.php` に追記:

```php
use Illuminate\Support\Facades\Schedule;

Schedule::job(new \App\Jobs\JudgeOpenSessionFormationJob)->hourly();
```

- [ ] **Step 5: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/JudgeOpenSessionFormationTest.php
```

Expected: PASS（3件）

```bash
git add app/UseCases/OpenSession/JudgeOpenSessionFormationUseCase.php app/Jobs/JudgeOpenSessionFormationJob.php routes/console.php tests/Feature/JudgeOpenSessionFormationTest.php
git commit -m "feat(usecase): add open session formation judgment with hourly scheduler"
```

---

## Task 8: Webhook拡張（オープンセッションの即時成立判定）

Phase 2（改訂版）の `WebhookController::handleParticipantCompleted` は participant確定＋`session_type=private` の処理まで実装済み。本Taskでは **`session_type=open` の分岐**（申込完了メール・min_groups到達での即時成立・直前参加のパートナー通知）を追加する。

**Files:**
- Modify: `app/Http/Controllers/WebhookController.php`
- Test: `tests/Feature/OpenSessionWebhookTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Feature/OpenSessionWebhookTest.php`:

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

class OpenSessionWebhookTest extends TestCase
{
    use RefreshDatabase;

    private Session $session;

    /** Phase 2と同じ方式: testing環境限定の 'bypass' 署名で検証をスキップ */
    private function postWebhook(int $participantId): \Illuminate\Testing\TestResponse
    {
        $payload = json_encode([
            'type' => 'checkout.session.completed',
            'data' => ['object' => [
                'metadata' => ['participant_id' => (string) $participantId],
                'payment_intent' => 'pi_webhook_test',
            ]],
        ]);

        return $this->call('POST', '/stripe/webhook', [], [], [], [
            'HTTP_STRIPE_SIGNATURE' => 'bypass',
            'CONTENT_TYPE' => 'application/json',
        ], $payload);
    }

    private function makePendingParticipant(int $index, int $minGroups = 3): SessionParticipant
    {
        if (! isset($this->session)) {
            $pUser = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => 'x', 'role' => 'partner']);
            $partner = Partner::create([
                'user_id' => $pUser->id, 'provider_type' => 'overseas_school', 'display_name' => 'S',
                'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
                'themes' => ['culture'], 'grade_range' => '1-6',
            ]);
            $this->session = Session::create([
                'partner_id' => $partner->id, 'session_type' => 'open',
                'scheduled_at' => now()->addDays(14), 'duration_min' => 45, 'theme' => 'culture',
                'capacity' => 6, 'min_groups' => $minGroups, 'price_jpy' => 2500, 'status' => 'open',
            ]);
        }

        $mUser = User::create(['name' => "M$index", 'email' => "m$index@example.com", 'password' => 'x', 'role' => 'member']);
        $member = Member::create(['user_id' => $mUser->id, 'type' => 'family', 'prefecture' => '東京都', 'contact_name' => "M$index"]);

        return SessionParticipant::create([
            'session_id' => $this->session->id, 'member_id' => $member->id,
            'status' => 'pending', 'price_paid' => 2500, 'support_amount' => 1250,
        ]);
    }

    public function test_webhookでparticipantが確定し申込完了メールが送られる(): void
    {
        Mail::fake();
        $participant = $this->makePendingParticipant(1);

        $this->postWebhook($participant->id)->assertOk();

        $fresh = $participant->fresh();
        $this->assertEquals('confirmed', $fresh->status);
        $this->assertEquals('pi_webhook_test', $fresh->stripe_payment_id);
        Mail::assertQueued(\App\Mail\OpenSessionApplied::class, 1);
    }

    public function test_min_groups到達で即時成立し全員に成立メール(): void
    {
        Mail::fake();
        $p1 = $this->makePendingParticipant(1);
        $p2 = $this->makePendingParticipant(2);
        $p3 = $this->makePendingParticipant(3);

        $this->postWebhook($p1->id);
        $this->postWebhook($p2->id);
        $this->assertEquals('open', $this->session->fresh()->status);

        $this->postWebhook($p3->id);

        $this->assertEquals('confirmed', $this->session->fresh()->status);
        Mail::assertQueued(\App\Mail\OpenSessionConfirmed::class, 3);
    }

    public function test_成立済みセッションへの直前参加はパートナーに通知される(): void
    {
        Mail::fake();
        $p1 = $this->makePendingParticipant(1, minGroups: 1);
        $this->postWebhook($p1->id); // ここで成立

        $p2 = $this->makePendingParticipant(2);
        $this->postWebhook($p2->id);

        Mail::assertQueued(\App\Mail\ParticipantJoined::class, 1);
    }
}
```

> **注:** 署名検証はPhase 2（改訂版）の実装をそのまま使う — **fail-closed**（非testing環境でsecret未設定なら500）・bypassは `app()->environment('testing')` 限定。本Taskで署名まわりは変更しない。

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/OpenSessionWebhookTest.php
```

Expected: FAIL

- [ ] **Step 3: `handleParticipantCompleted` に open 分岐を追加**

Phase 2（改訂版）の `handleParticipantCompleted` 末尾は以下の形になっている:

```php
$session = $participant->session;

if ($session->session_type === 'private') {
    $session->update(['status' => 'confirmed']);

    Mail::to($participant->member->user->email)->queue(new BookingConfirmed($participant));
    Mail::to($session->partner->user->email)->queue(new BookingReceived($participant));
}
// session_type=open の分岐（成立判定・直前参加通知）は Phase 2.5 で追加する
```

このコメント箇所を **else分岐の実装に置き換える**:

```php
use App\Domain\ValueObjects\ParticipantStatus;
use App\Domain\ValueObjects\SessionStatus;
use App\Mail\OpenSessionApplied;
use App\Mail\OpenSessionConfirmed;
use App\Mail\ParticipantJoined;

$session = $participant->session;

if ($session->session_type === 'private') {
    $session->update(['status' => SessionStatus::Confirmed->value]);

    Mail::to($participant->member->user->email)->queue(new BookingConfirmed($participant));
    Mail::to($session->partner->user->email)->queue(new BookingReceived($participant));
} else {
    // オープンセッション: 申込完了メール
    Mail::to($participant->member->user->email)->queue(new OpenSessionApplied($participant));

    if ($session->status === SessionStatus::Open->value) {
        // 募集中: min_groups到達で即時成立
        $confirmed = $session->participants()
            ->where('status', ParticipantStatus::Confirmed->value)
            ->with('member.user')
            ->get();

        if ($confirmed->count() >= $session->min_groups) {
            $session->update(['status' => SessionStatus::Confirmed->value]);

            foreach ($confirmed as $p) {
                Mail::to($p->member->user->email)->queue(new OpenSessionConfirmed($p));
            }
        }
    } else {
        // 成立済みへの直前参加 → パートナーへ通知
        Mail::to($session->partner->user->email)->queue(new ParticipantJoined($participant));
    }
}
```

- [ ] **Step 4: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/OpenSessionWebhookTest.php
```

Expected: PASS（3件）

```bash
git add app/Http/Controllers/WebhookController.php tests/Feature/OpenSessionWebhookTest.php
git commit -m "feat(webhook): confirm open session participants and trigger instant formation"
```

---

## Task 9: OpenSessionController・ルート・Featureテスト

**Files:**
- Create: `app/Http/Controllers/OpenSessionController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/OpenSessionApplicationTest.php`

> **依存:** `index` / `show` は `App\Http\Presenters\SessionViewPresenter` を使う（**FEハンズオン計画 2026-06-23 Task6 が所有**）。この Task の前に Presenter を実装しておくこと。`show` が render する `OpenSessions/Show` ページ自体は FE 計画 Task7（無くてもテストは props 検証なので通る）。

- [ ] **Step 1: 失敗するテストを書く**

`tests/Feature/OpenSessionApplicationTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\Partner;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\Models\User;
use App\Services\StripeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Mockery;
use Tests\TestCase;

class OpenSessionApplicationTest extends TestCase
{
    use RefreshDatabase;

    private function makeMemberUser(): User
    {
        $user = User::create(['name' => 'M', 'email' => 'm@example.com', 'password' => bcrypt('x'), 'role' => 'member']);
        Member::create(['user_id' => $user->id, 'type' => 'family', 'prefecture' => '東京都', 'contact_name' => 'M']);

        return $user;
    }

    private function makeOpenSession(): Session
    {
        $pUser = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => 'x', 'role' => 'partner']);
        $partner = Partner::create([
            'user_id' => $pUser->id, 'provider_type' => 'overseas_school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6',
        ]);

        return Session::create([
            'partner_id' => $partner->id, 'session_type' => 'open',
            'scheduled_at' => now()->addDays(14)->setTime(10, 0), 'duration_min' => 45,
            'theme' => 'culture', 'capacity' => 6, 'min_groups' => 3,
            'price_jpy' => 2500, 'status' => 'open',
        ]);
    }

    public function test_memberは一覧を閲覧できる(): void
    {
        $this->makeOpenSession();

        $this->actingAs($this->makeMemberUser())
            ->get('/open-sessions')
            ->assertOk();
    }

    public function test_詳細はOpenSessionsShowをhandoff形で返す(): void
    {
        $session = $this->makeOpenSession();

        $this->actingAs($this->makeMemberUser())
            ->get("/open-sessions/{$session->id}")
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('OpenSessions/Show')
                ->where('session.id', $session->id)
                ->where('session.theme', '文化交流')   // SessionViewPresenter で enum→日本語
                ->where('session.country', 'ケニア')   // Kenya→日本語
                ->where('session.maxGroups', 6)        // capacity
                ->where('session.minGroups', 3)
                ->where('session.groups', 0)           // pending+confirmed なし
            );
    }

    public function test_存在しない詳細は404(): void
    {
        $this->actingAs($this->makeMemberUser())
            ->get('/open-sessions/999999')
            ->assertNotFound();
    }

    public function test_オープン以外のセッション詳細は404(): void
    {
        // findOpenSession は session_type='open' のみ返す（SessionType::Private は対象外）
        $session = $this->makeOpenSession();
        $session->update(['session_type' => 'private']);

        $this->actingAs($this->makeMemberUser())
            ->get("/open-sessions/{$session->id}")
            ->assertNotFound();
    }

    public function test_申込でpending作成しCheckoutへリダイレクトする(): void
    {
        $session = $this->makeOpenSession();

        $stripe = Mockery::mock(StripeService::class);
        $stripe->shouldReceive('createParticipantCheckout')->once()->andReturn('https://checkout.stripe.com/test');
        $this->app->instance(StripeService::class, $stripe);

        $this->actingAs($this->makeMemberUser())
            ->post("/open-sessions/{$session->id}/apply")
            ->assertRedirect('https://checkout.stripe.com/test');

        $this->assertEquals(1, SessionParticipant::where('status', 'pending')->count());
    }

    public function test_決済キャンセルでpendingが削除される(): void
    {
        $session = $this->makeOpenSession();
        $user = $this->makeMemberUser();
        $participant = SessionParticipant::create([
            'session_id' => $session->id, 'member_id' => $user->member->id,
            'status' => 'pending', 'price_paid' => 2500, 'support_amount' => 1250,
        ]);

        $this->actingAs($user)
            ->get("/open-sessions/apply/cancel/{$participant->id}")
            ->assertRedirect('/open-sessions');

        $this->assertNull(SessionParticipant::find($participant->id));
    }

    public function test_partnerロールは申込できない(): void
    {
        $session = $this->makeOpenSession();
        $partnerUser = User::where('role', 'partner')->first();

        $this->actingAs($partnerUser)
            ->post("/open-sessions/{$session->id}/apply")
            ->assertForbidden();
    }
}
```

> `User::member` リレーションが未定義の場合は `app/Models/User.php` に `public function member() { return $this->hasOne(Member::class); }` を追加する。

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/OpenSessionApplicationTest.php
```

Expected: FAIL（ルート未定義）

- [ ] **Step 3: Controller実装**

`app/Http/Controllers/OpenSessionController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Domain\Exceptions\ApplicationDeadlinePassedException;
use App\Domain\Exceptions\SessionFullException;
use App\Domain\Repositories\OpenSessionRepositoryInterface;
use App\Domain\ValueObjects\ParticipantStatus;
use App\Models\SessionParticipant;
use App\Http\Presenters\SessionViewPresenter;
use App\Services\StripeService;
use App\UseCases\OpenSession\ApplyToOpenSessionInput;
use App\UseCases\OpenSession\ApplyToOpenSessionUseCase;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OpenSessionController extends Controller
{
    // index / show が render する Page（OpenSessions/Index・OpenSessions/Show）と
    // データ形（SessionSummary）は FE ハンズオン計画（2026-06-23）が所有する。
    // ここでは SessionViewPresenter（同計画 Task6）を使って handoff 形の props を渡すだけ。
    public function index(
        OpenSessionRepositoryInterface $repository,
        SessionViewPresenter $presenter,
    ): Response {
        $sessions = $repository->listVisible()
            ->map(fn ($s) => $presenter->summary($s))
            ->all();

        return Inertia::render('OpenSessions/Index', ['sessions' => $sessions]);
    }

    /** B-2 セッション詳細。FE 計画 Task7 の OpenSessions/Show を render する。 */
    public function show(
        int $id,
        OpenSessionRepositoryInterface $repository,
        SessionViewPresenter $presenter,
    ): Response {
        $session = $repository->findOpenSession($id);
        abort_if($session === null, 404);

        $session->loadCount(['participants as active_participants_count' => fn ($q) => $q->whereIn('status', [
            ParticipantStatus::Pending->value, ParticipantStatus::Confirmed->value,
        ])])->load('partner');

        return Inertia::render('OpenSessions/Show', [
            'session' => $presenter->summary($session),
            // detail（動画・先生・物資・アジェンダ）の供給元が決まるまでは渡さず、Page 側の mockDetail を表示する。
        ]);
    }

    public function apply(
        Request $request,
        int $session,
        ApplyToOpenSessionUseCase $useCase,
        StripeService $stripeService,
    ): RedirectResponse {
        try {
            $participant = $useCase->execute(new ApplyToOpenSessionInput(
                sessionId: $session,
                memberId: $request->user()->member->id,
            ));
        } catch (SessionFullException|ApplicationDeadlinePassedException $e) {
            return redirect()->route('open-sessions.index')->withErrors(['apply' => $e->getMessage()]);
        }

        $checkoutUrl = $stripeService->createParticipantCheckout(
            $participant,
            route('open-sessions.complete', ['participant' => $participant->id]),
            route('open-sessions.apply-cancel', ['participant' => $participant->id]),
        );

        return redirect()->away($checkoutUrl);
    }

    public function complete(Request $request, SessionParticipant $participant): Response
    {
        abort_unless($participant->member->user_id === $request->user()->id, 403);

        return Inertia::render('OpenSessions/Complete', [
            'participantId' => $participant->id,
            'scheduledAt' => $participant->session->scheduled_at->toIso8601String(),
        ]);
    }

    /** Stripe決済キャンセル時の戻り先: pendingレコードを削除して枠を解放 */
    public function applyCancel(Request $request, SessionParticipant $participant): RedirectResponse
    {
        abort_unless($participant->member->user_id === $request->user()->id, 403);

        if ($participant->status === ParticipantStatus::Pending->value) {
            $participant->delete();
        }

        return redirect()->route('open-sessions.index');
    }
}
```

- [ ] **Step 4: ルート追加**

`routes/web.php` に追記（`role` ミドルウェアはPhase 1で実装済みの `EnsureRole`）:

```php
use App\Http\Controllers\OpenSessionController;

Route::middleware(['auth', 'role:member'])->group(function () {
    Route::get('/open-sessions', [OpenSessionController::class, 'index'])->name('open-sessions.index');
    Route::get('/open-sessions/{id}', [OpenSessionController::class, 'show'])->whereNumber('id')->name('open-sessions.show');
    Route::post('/open-sessions/{session}/apply', [OpenSessionController::class, 'apply'])->name('open-sessions.apply');
    Route::get('/open-sessions/complete/{participant}', [OpenSessionController::class, 'complete'])->name('open-sessions.complete');
    Route::get('/open-sessions/apply/cancel/{participant}', [OpenSessionController::class, 'applyCancel'])->name('open-sessions.apply-cancel');
});
```

- [ ] **Step 5: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/OpenSessionApplicationTest.php
```

Expected: PASS（4件）

```bash
git add app/Http/Controllers/OpenSessionController.php routes/web.php app/Models/User.php tests/Feature/OpenSessionApplicationTest.php
git commit -m "feat(http): add open session listing/application endpoints"
```

---

## Task 10: React ページ → **FE ハンズオン計画へ移譲（このTaskは実装しない）**

> **このTaskのFEページ作成は廃止。** `OpenSessions/Index.tsx`（B-1）・`OpenSessions/Show.tsx`（B-2）・`OpenSessions/Complete.tsx`（B-6）は、確定デザイン（Calm Blue / handoff）を取り込む **FEハンズオン計画 `docs/superpowers/plans/2026-06-23-worldclass-frontend-handson.md`（Task5/7/9）** が唯一の正として実装する。

旧版の素 Tailwind ＋ `AuthenticatedLayout` ページは破棄。理由と新しい所有境界:

- **ページ（.tsx）と Presenter は FE 計画が所有。** 本 phase（BE）は Controller・route・UseCase・Job・Filament のみを持つ。
- Task9 の `OpenSessionController` は、FE 計画 Task6 の `SessionViewPresenter` を使って `OpenSessions/Index` / `OpenSessions/Show` を render する（本 phase の Task9 Step3 に反映済み）。`OpenSessions/Complete` は `@complete` が render（props `{ participantId, scheduledAt }`）。
- データ形は **handoff の `SessionSummary`**（camelCase・JST 整形済み）。旧版の snake_case 形（`partner_name` / `remaining` / `is_confirmed` / `can_send_questions`）は使わない。
- 申込ボタンは FE 計画の `OpenSessions/Show` 内で POST `open-sessions.apply` を呼ぶ。

→ 本 Task ではコードを書かない。FE は上記 FE 計画を参照。

---

## Task 11: Filament（オープンセッション作成・手動キャンセル）

**Files:**
- Create: `app/Filament/Resources/SessionResource.php`（＋自動生成されるPages）

- [ ] **Step 1: リソース生成**

```bash
docker compose exec app php artisan make:filament-resource Session
```

- [ ] **Step 2: フォーム・テーブル・キャンセルアクションを実装**

生成された `SessionResource` のメソッドを以下の内容にする（メソッドシグネチャは生成されたものを維持）。

フォーム項目:

```php
Forms\Components\Select::make('partner_id')
    ->relationship('partner', 'display_name')->required(),
Forms\Components\Hidden::make('session_type')->default('open'),
Forms\Components\DateTimePicker::make('scheduled_at')->required(),
Forms\Components\Select::make('duration_min')->options([45 => '45分', 60 => '60分'])->required(),
Forms\Components\Select::make('theme')->options([
    'culture' => '文化交流', 'english' => '英語学習', 'global' => '国際理解',
])->required(), // App\Domain\ValueObjects\ThemeType のcase値と一致させること
Forms\Components\TextInput::make('capacity')->numeric()->default(6)->required(),
Forms\Components\TextInput::make('min_groups')->numeric()->default(3)->required(),
Forms\Components\Hidden::make('with_facilitator')->default(true),
Forms\Components\TextInput::make('price_jpy')->numeric()->default(2500)->required(),
Forms\Components\Select::make('status')->options([
    'draft' => '下書き', 'open' => '公開',
])->default('draft')->required(),
```

> `ThemeType` の実値は `culture` / `english` / `global`（実装時に `ThemeType::cases()` から動的生成してもよい）。

テーブル列: `partner.display_name` / `session_type` / `scheduled_at` / `status` / 参加数（`participants_count` を `->counts('participants')` で表示）

手動キャンセルアクション（テーブル行アクション）:

```php
use Filament\Actions\Action;
use App\Jobs\ProcessSessionCancellation;

Action::make('cancel')
    ->label('キャンセル（全員返金）')
    ->requiresConfirmation()
    ->visible(fn ($record) => ! in_array($record->status, ['completed', 'cancelled']))
    ->action(fn ($record) => ProcessSessionCancellation::dispatch($record, '運営によるキャンセル')),
```

- [ ] **Step 3: 動作確認**

```bash
docker compose exec app php artisan serve --help > /dev/null && echo ok
```

ブラウザで `/admin` にログイン → Sessions からオープンセッションを1件作成 → status=open に変更 → `/open-sessions` に表示されることを確認。

- [ ] **Step 4: Larastan・Pint・全テスト**

```bash
docker compose exec app ./vendor/bin/pint
docker compose exec app ./vendor/bin/phpstan analyse --memory-limit=512M
docker compose exec app php artisan test
```

Expected: 全件PASS

- [ ] **Step 5: コミット**

```bash
git add app/Filament/
git commit -m "feat(admin): add SessionResource for open session creation and manual cancellation"
```

---

## セルフレビュー（スペックカバレッジ）

- 確定パラメータ（料金・min 3 / max 6・締切3日前12時・直前参加12時間前）→ Task 2, 4, 11 ✅
- 申込時即時決済・不成立全額返金 → Task 4, 6, 7 ✅
- pending込み残枠カウント（超過販売防止） → Task 3, 4 ✅
- min_groups到達で即時成立・成立メール → Task 8 ✅
- 3日前12時の成立判定・不成立キャンセル（クーポン） → Task 7 ✅
- 直前参加のパートナー通知 → Task 8 ✅
- 手動キャンセル（運営・Filament） → Task 11 ✅
- メール4種 → Task 5 ✅
- 決済失敗時のpending削除 → Task 9 ✅
- B-1 一覧・B-2 詳細の表示（`index`/`show` を SessionViewPresenter で handoff 形 render・404処理） → Task 9（FEページは FE計画 2026-06-23 Task5/7） ✅
