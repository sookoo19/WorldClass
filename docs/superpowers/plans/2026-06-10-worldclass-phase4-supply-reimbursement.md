# WorldClass Phase 4: 物資支援（リインバース） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** セッション完了時の支援プール積算と、パートナーの立替購入→領収書申請→運営審査→Wise手動送金記録のリインバースフローを実装する。

**Architecture:** プール積算はPhase 3の `CompleteFinishedSessionsJob` から呼ぶUseCase。申請〜送金はステータス機械（pending→approved→paid / pending→rejected）をUseCase群で守り、プール減算はDBトランザクション＋行ロックで整合させる。領収書はprivate storage、閲覧は認可付きルート経由。

**Tech Stack:** Laravel 13 / Inertia.js + React (.tsx) / Filament v4 / private file storage

**Spec:** `docs/superpowers/specs/2026-06-10-worldclass-phase4-supply-reimbursement-design.md`

**前提:** Phase 3 プラン完了（`CompleteFinishedSessionsJob`・`SessionStatus`/`ParticipantStatus` enum が存在すること）

---

## ファイル構成

```
app/
├── Domain/
│   ├── ValueObjects/SupportRequestStatus.php
│   └── Exceptions/
│       ├── InsufficientSupportPoolException.php
│       └── InvalidSupportRequestStateException.php
├── UseCases/Support/
│   ├── AccrueSupportPoolUseCase.php
│   ├── SubmitSupportRequestInput.php
│   ├── SubmitSupportRequestUseCase.php
│   ├── ApproveSupportRequestUseCase.php
│   ├── RejectSupportRequestUseCase.php
│   └── MarkSupportRequestPaidUseCase.php
├── Http/Controllers/
│   ├── SupportRequestController.php   # パートナー: 残高・申請・履歴
│   └── ReceiptController.php          # 領収書閲覧（認可付き）
├── Jobs/CompleteFinishedSessionsJob.php  # 変更: 積算呼び出し
├── Mail/
│   ├── SupportRequestSubmitted.php
│   ├── SupportRequestApproved.php
│   ├── SupportRequestRejected.php
│   └── SupportRequestPaid.php
└── Filament/Resources/SupportRequestResource.php
database/migrations/  # transfer_reference, usage_photo_url 追加
resources/js/Pages/Partner/Support/
├── Index.tsx
└── Create.tsx
```

---

## Task 1: マイグレーション・enum・モデル整備

**Files:**
- Create: `database/migrations/xxxx_add_reimbursement_columns_to_support_requests_table.php`
- Create: `app/Domain/ValueObjects/SupportRequestStatus.php`
- Modify: `app/Models/SupportRequest.php`

- [ ] **Step 1: マイグレーション作成・実行**

```bash
docker compose exec app php artisan make:migration add_reimbursement_columns_to_support_requests_table
```

`up()`:

```php
Schema::table('support_requests', function (Blueprint $table) {
    $table->string('transfer_reference')->nullable(); // Wise送金参照ID
    $table->string('usage_photo_url')->nullable();    // 物資活用写真（任意・公開用）
});
```

`down()` は `dropColumn(['transfer_reference', 'usage_photo_url'])`。

```bash
docker compose exec app php artisan migrate
```

Expected: Migrated

- [ ] **Step 2: enum作成**

`app/Domain/ValueObjects/SupportRequestStatus.php`:

```php
<?php

namespace App\Domain\ValueObjects;

enum SupportRequestStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Paid = 'paid';
}
```

- [ ] **Step 3: SupportRequestモデルのfillable・casts確認**

`app/Models/SupportRequest.php` の `#[Fillable]` を以下に揃える（不足分を追加）:

```php
#[Fillable([
    'partner_id', 'item_list', 'claimed_amount_jpy', 'receipt_photo_url',
    'status', 'approved_amount_jpy', 'rejection_reason',
    'reviewed_at', 'paid_at', 'transfer_reference', 'usage_photo_url',
])]
```

`$casts`:

```php
protected $casts = [
    'item_list' => 'array',
    'reviewed_at' => 'datetime',
    'paid_at' => 'datetime',
];
```

`partner()` リレーション（`belongsTo(Partner::class)`）が無ければ追加。

- [ ] **Step 4: テスト・コミット**

```bash
docker compose exec app php artisan test
```

Expected: 既存テスト全PASS

```bash
git add database/migrations/ app/Domain/ValueObjects/SupportRequestStatus.php app/Models/SupportRequest.php
git commit -m "feat(db): add reimbursement columns and SupportRequestStatus enum"
```

---

## Task 2: メール4種

**Files:**
- Create: `app/Mail/SupportRequestSubmitted.php` ほか3クラス + bladeテンプレート

- [ ] **Step 1: Mailable生成**

```bash
docker compose exec app php artisan make:mail SupportRequestSubmitted --markdown=mail.support.submitted
docker compose exec app php artisan make:mail SupportRequestApproved --markdown=mail.support.approved
docker compose exec app php artisan make:mail SupportRequestRejected --markdown=mail.support.rejected
docker compose exec app php artisan make:mail SupportRequestPaid --markdown=mail.support.paid
```

- [ ] **Step 2: 実装**

4クラスとも `public function __construct(public \App\Models\SupportRequest $supportRequest) {}`。パートナー宛なので英語。subject:

| クラス | subject |
|---|---|
| `SupportRequestSubmitted` | `[WorldClass] Support request received` |
| `SupportRequestApproved` | `[WorldClass] Support request approved` |
| `SupportRequestRejected` | `[WorldClass] Support request rejected` |
| `SupportRequestPaid` | `[WorldClass] Reimbursement sent` |

テンプレート:

`submitted.blade.php`:

```blade
<x-mail::message>
# We received your support request

- Claimed amount: ¥{{ number_format($supportRequest->claimed_amount_jpy) }}

We will review your receipt and notify you of the result.

{{ config('app.name') }}
</x-mail::message>
```

`approved.blade.php`:

```blade
<x-mail::message>
# Your support request was approved

- Approved amount: ¥{{ number_format($supportRequest->approved_amount_jpy) }}

The reimbursement will be sent to your account via Wise shortly.

{{ config('app.name') }}
</x-mail::message>
```

`rejected.blade.php`:

```blade
<x-mail::message>
# Your support request was rejected

- Reason: {{ $supportRequest->rejection_reason }}

Your support pool balance is unchanged. Please contact us if you have questions.

{{ config('app.name') }}
</x-mail::message>
```

`paid.blade.php`:

```blade
<x-mail::message>
# Reimbursement sent

- Amount: ¥{{ number_format($supportRequest->approved_amount_jpy) }}
- Reference: {{ $supportRequest->transfer_reference }}

Thank you for supporting your students!

{{ config('app.name') }}
</x-mail::message>
```

- [ ] **Step 3: コミット**

```bash
git add app/Mail/ resources/views/mail/support/
git commit -m "feat(mail): add support request mailables"
```

---

## Task 3: AccrueSupportPoolUseCase（TDD）＋完了Jobへの接続

**Files:**
- Create: `app/UseCases/Support/AccrueSupportPoolUseCase.php`
- Modify: `app/Jobs/CompleteFinishedSessionsJob.php`
- Test: `tests/Feature/AccrueSupportPoolTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Feature/AccrueSupportPoolTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Jobs\CompleteFinishedSessionsJob;
use App\Models\Member;
use App\Models\Partner;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccrueSupportPoolTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makePartner(): Partner
    {
        $user = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => 'x', 'role' => 'partner']);

        return Partner::create([
            'user_id' => $user->id, 'provider_type' => 'school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6', 'support_pool' => 0,
        ]);
    }

    private function addParticipant(Session $session, string $status, int $supportAmount): void
    {
        $user = User::create(['name' => 'M', 'email' => uniqid().'@example.com', 'password' => 'x', 'role' => 'member']);
        $member = Member::create(['user_id' => $user->id, 'type' => 'family', 'prefecture' => '東京都', 'contact_name' => 'M']);
        SessionParticipant::create([
            'session_id' => $session->id, 'member_id' => $member->id,
            'status' => $status, 'price_paid' => $supportAmount * 2, 'support_amount' => $supportAmount,
        ]);
    }

    public function test_セッション完了時にconfirmed参加者分だけプールに積算される(): void
    {
        Carbon::setTestNow('2026-07-10 11:00:00');
        $partner = $this->makePartner();
        $session = Session::create([
            'partner_id' => $partner->id, 'session_type' => 'open',
            'scheduled_at' => '2026-07-10 10:00:00', 'duration_min' => 45, 'theme' => 'culture',
            'capacity' => 6, 'min_groups' => 3, 'price_jpy' => 2500, 'status' => 'ready',
        ]);
        $this->addParticipant($session, 'confirmed', 1250);
        $this->addParticipant($session, 'confirmed', 1250);
        $this->addParticipant($session, 'cancelled', 1250); // 積算対象外

        (new CompleteFinishedSessionsJob())->handle();

        $this->assertEquals('completed', $session->fresh()->status);
        $this->assertEquals(2500, $partner->fresh()->support_pool);
    }

    public function test_2回実行しても二重積算しない(): void
    {
        Carbon::setTestNow('2026-07-10 11:00:00');
        $partner = $this->makePartner();
        $session = Session::create([
            'partner_id' => $partner->id, 'session_type' => 'open',
            'scheduled_at' => '2026-07-10 10:00:00', 'duration_min' => 45, 'theme' => 'culture',
            'capacity' => 6, 'min_groups' => 3, 'price_jpy' => 2500, 'status' => 'ready',
        ]);
        $this->addParticipant($session, 'confirmed', 1250);

        (new CompleteFinishedSessionsJob())->handle();
        (new CompleteFinishedSessionsJob())->handle(); // completed済みなので対象外

        $this->assertEquals(1250, $partner->fresh()->support_pool);
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/AccrueSupportPoolTest.php
```

Expected: FAIL（積算されない）

- [ ] **Step 3: UseCase実装・Job接続**

`app/UseCases/Support/AccrueSupportPoolUseCase.php`:

```php
<?php

namespace App\UseCases\Support;

use App\Domain\ValueObjects\ParticipantStatus;
use App\Models\Session;

class AccrueSupportPoolUseCase
{
    /**
     * confirmed参加者のsupport_amount合計をパートナーのプールへ加算する。
     * 呼び出し元（CompleteFinishedSessionsJob）がready→completedの一度きりの遷移で
     * 呼ぶため二重積算は発生しない。
     */
    public function execute(Session $session): void
    {
        $total = (int) $session->participants()
            ->where('status', ParticipantStatus::Confirmed->value)
            ->sum('support_amount');

        if ($total > 0) {
            $session->partner->increment('support_pool', $total);
        }
    }
}
```

`app/Jobs/CompleteFinishedSessionsJob.php` の `handle()` を変更（Phase 3 Task 7のコメント箇所）:

```php
use App\UseCases\Support\AccrueSupportPoolUseCase;

public function handle(AccrueSupportPoolUseCase $accrueSupportPool): void
{
    $targets = Session::query()
        ->where('status', SessionStatus::Ready->value)
        ->get()
        ->filter(fn (Session $s) => now()->greaterThanOrEqualTo(
            $s->scheduled_at->copy()->addMinutes($s->duration_min)
        ));

    foreach ($targets as $session) {
        $session->update(['status' => SessionStatus::Completed->value]);
        $accrueSupportPool->execute($session);
    }
}
```

- [ ] **Step 4: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/AccrueSupportPoolTest.php tests/Feature/Jobs/SessionLifecycleJobsTest.php
```

Expected: 全PASS（既存の完了判定テストも壊れていないこと）

```bash
git add app/UseCases/Support/AccrueSupportPoolUseCase.php app/Jobs/CompleteFinishedSessionsJob.php tests/Feature/AccrueSupportPoolTest.php
git commit -m "feat(support): accrue 50% support pool on session completion"
```

---

## Task 4: SubmitSupportRequestUseCase（TDD）

**Files:**
- Create: `app/Domain/Exceptions/InsufficientSupportPoolException.php`
- Create: `app/UseCases/Support/SubmitSupportRequestInput.php`
- Create: `app/UseCases/Support/SubmitSupportRequestUseCase.php`
- Test: `tests/Feature/SubmitSupportRequestTest.php`

- [ ] **Step 1: 例外作成**

`app/Domain/Exceptions/InsufficientSupportPoolException.php`:

```php
<?php

namespace App\Domain\Exceptions;

class InsufficientSupportPoolException extends \DomainException
{
    public function __construct()
    {
        parent::__construct('Claimed amount exceeds your support pool balance.');
    }
}
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/Feature/SubmitSupportRequestTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Domain\Exceptions\InsufficientSupportPoolException;
use App\Models\Partner;
use App\Models\User;
use App\UseCases\Support\SubmitSupportRequestInput;
use App\UseCases\Support\SubmitSupportRequestUseCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class SubmitSupportRequestTest extends TestCase
{
    use RefreshDatabase;

    private function makePartner(int $pool): Partner
    {
        $user = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => 'x', 'role' => 'partner']);

        return Partner::create([
            'user_id' => $user->id, 'provider_type' => 'school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6', 'support_pool' => $pool,
        ]);
    }

    public function test_残高内の申請はpendingで作成されメールが送られる(): void
    {
        Mail::fake();
        $partner = $this->makePartner(10000);

        $request = app(SubmitSupportRequestUseCase::class)->execute(new SubmitSupportRequestInput(
            partnerId: $partner->id,
            itemList: [['name' => 'Notebook', 'quantity' => 30, 'unit_price' => 100]],
            claimedAmountJpy: 3000,
            receiptPhotoPath: 'receipts/test.jpg',
        ));

        $this->assertEquals('pending', $request->status);
        $this->assertEquals(3000, $request->claimed_amount_jpy);
        $this->assertEquals(10000, $partner->fresh()->support_pool); // 申請時点では減算しない
        Mail::assertQueued(\App\Mail\SupportRequestSubmitted::class, 1);
    }

    public function test_残高超過の申請は拒否される(): void
    {
        $partner = $this->makePartner(2000);

        $this->expectException(InsufficientSupportPoolException::class);

        app(SubmitSupportRequestUseCase::class)->execute(new SubmitSupportRequestInput(
            partnerId: $partner->id,
            itemList: [['name' => 'PC', 'quantity' => 1, 'unit_price' => 50000]],
            claimedAmountJpy: 50000,
            receiptPhotoPath: 'receipts/test.jpg',
        ));
    }
}
```

- [ ] **Step 3: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/SubmitSupportRequestTest.php
```

Expected: FAIL

- [ ] **Step 4: Input・UseCase実装**

`app/UseCases/Support/SubmitSupportRequestInput.php`:

```php
<?php

namespace App\UseCases\Support;

class SubmitSupportRequestInput
{
    /** @param array<array{name: string, quantity: int, unit_price: int}> $itemList */
    public function __construct(
        public readonly int $partnerId,
        public readonly array $itemList,
        public readonly int $claimedAmountJpy,
        public readonly string $receiptPhotoPath,
    ) {}
}
```

`app/UseCases/Support/SubmitSupportRequestUseCase.php`:

```php
<?php

namespace App\UseCases\Support;

use App\Domain\Exceptions\InsufficientSupportPoolException;
use App\Domain\ValueObjects\SupportRequestStatus;
use App\Mail\SupportRequestSubmitted;
use App\Models\Partner;
use App\Models\SupportRequest;
use Illuminate\Support\Facades\Mail;

class SubmitSupportRequestUseCase
{
    public function execute(SubmitSupportRequestInput $input): SupportRequest
    {
        $partner = Partner::with('user')->findOrFail($input->partnerId);

        if ($input->claimedAmountJpy > $partner->support_pool) {
            throw new InsufficientSupportPoolException();
        }

        $request = SupportRequest::create([
            'partner_id' => $partner->id,
            'item_list' => $input->itemList,
            'claimed_amount_jpy' => $input->claimedAmountJpy,
            'receipt_photo_url' => $input->receiptPhotoPath,
            'status' => SupportRequestStatus::Pending->value,
        ]);

        Mail::to($partner->user->email)->queue(new SupportRequestSubmitted($request));

        return $request;
    }
}
```

- [ ] **Step 5: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/SubmitSupportRequestTest.php
```

Expected: PASS（2件）

```bash
git add app/Domain/Exceptions/InsufficientSupportPoolException.php app/UseCases/Support/ tests/Feature/SubmitSupportRequestTest.php
git commit -m "feat(support): add SubmitSupportRequestUseCase with pool balance validation"
```

---

## Task 5: 審査・送金UseCase 3種（TDD）

**Files:**
- Create: `app/Domain/Exceptions/InvalidSupportRequestStateException.php`
- Create: `app/UseCases/Support/ApproveSupportRequestUseCase.php`
- Create: `app/UseCases/Support/RejectSupportRequestUseCase.php`
- Create: `app/UseCases/Support/MarkSupportRequestPaidUseCase.php`
- Test: `tests/Feature/ReviewSupportRequestTest.php`

- [ ] **Step 1: 例外作成**

`app/Domain/Exceptions/InvalidSupportRequestStateException.php`:

```php
<?php

namespace App\Domain\Exceptions;

class InvalidSupportRequestStateException extends \DomainException
{
    public function __construct(string $expected, string $actual)
    {
        parent::__construct("この申請は {$expected} 状態ではありません（現在: {$actual}）。");
    }
}
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/Feature/ReviewSupportRequestTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Domain\Exceptions\InvalidSupportRequestStateException;
use App\Models\Partner;
use App\Models\SupportRequest;
use App\Models\User;
use App\UseCases\Support\ApproveSupportRequestUseCase;
use App\UseCases\Support\MarkSupportRequestPaidUseCase;
use App\UseCases\Support\RejectSupportRequestUseCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ReviewSupportRequestTest extends TestCase
{
    use RefreshDatabase;

    private Partner $partner;

    private function makeRequest(int $pool = 10000, int $claimed = 5000): SupportRequest
    {
        $user = User::create(['name' => 'P', 'email' => uniqid().'@example.com', 'password' => 'x', 'role' => 'partner']);
        $this->partner = Partner::create([
            'user_id' => $user->id, 'provider_type' => 'school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6', 'support_pool' => $pool,
        ]);

        return SupportRequest::create([
            'partner_id' => $this->partner->id,
            'item_list' => [['name' => 'Notebook', 'quantity' => 50, 'unit_price' => 100]],
            'claimed_amount_jpy' => $claimed,
            'receipt_photo_url' => 'receipts/test.jpg',
            'status' => 'pending',
        ]);
    }

    public function test_承認で部分承認額がプールから減算される(): void
    {
        Mail::fake();
        $request = $this->makeRequest(pool: 10000, claimed: 5000);

        app(ApproveSupportRequestUseCase::class)->execute($request, approvedAmountJpy: 4500);

        $fresh = $request->fresh();
        $this->assertEquals('approved', $fresh->status);
        $this->assertEquals(4500, $fresh->approved_amount_jpy);
        $this->assertNotNull($fresh->reviewed_at);
        $this->assertEquals(5500, $this->partner->fresh()->support_pool);
        Mail::assertQueued(\App\Mail\SupportRequestApproved::class, 1);
    }

    public function test_承認済み申請は再承認できない(): void
    {
        Mail::fake();
        $request = $this->makeRequest();
        app(ApproveSupportRequestUseCase::class)->execute($request, approvedAmountJpy: 4500);

        $this->expectException(InvalidSupportRequestStateException::class);

        app(ApproveSupportRequestUseCase::class)->execute($request->fresh(), approvedAmountJpy: 4500);
    }

    public function test_却下でプールは変動しない(): void
    {
        Mail::fake();
        $request = $this->makeRequest(pool: 10000);

        app(RejectSupportRequestUseCase::class)->execute($request, reason: 'Receipt unreadable');

        $fresh = $request->fresh();
        $this->assertEquals('rejected', $fresh->status);
        $this->assertEquals('Receipt unreadable', $fresh->rejection_reason);
        $this->assertEquals(10000, $this->partner->fresh()->support_pool);
        Mail::assertQueued(\App\Mail\SupportRequestRejected::class, 1);
    }

    public function test_送金記録はapproved状態のみ可能(): void
    {
        Mail::fake();
        $request = $this->makeRequest();

        // pending のままでは記録不可
        try {
            app(MarkSupportRequestPaidUseCase::class)->execute($request, transferReference: 'WISE-123');
            $this->fail('例外が発生すべき');
        } catch (InvalidSupportRequestStateException) {
        }

        app(ApproveSupportRequestUseCase::class)->execute($request, approvedAmountJpy: 5000);
        app(MarkSupportRequestPaidUseCase::class)->execute($request->fresh(), transferReference: 'WISE-123');

        $fresh = $request->fresh();
        $this->assertEquals('paid', $fresh->status);
        $this->assertEquals('WISE-123', $fresh->transfer_reference);
        $this->assertNotNull($fresh->paid_at);
        Mail::assertQueued(\App\Mail\SupportRequestPaid::class, 1);
    }
}
```

- [ ] **Step 3: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/ReviewSupportRequestTest.php
```

Expected: FAIL

- [ ] **Step 4: UseCase 3種を実装**

`app/UseCases/Support/ApproveSupportRequestUseCase.php`:

```php
<?php

namespace App\UseCases\Support;

use App\Domain\Exceptions\InsufficientSupportPoolException;
use App\Domain\Exceptions\InvalidSupportRequestStateException;
use App\Domain\ValueObjects\SupportRequestStatus;
use App\Mail\SupportRequestApproved;
use App\Models\Partner;
use App\Models\SupportRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class ApproveSupportRequestUseCase
{
    public function execute(SupportRequest $request, int $approvedAmountJpy): void
    {
        DB::transaction(function () use ($request, $approvedAmountJpy) {
            // 行ロックで残高の同時更新（積算・他申請の承認）と整合させる
            $partner = Partner::lockForUpdate()->findOrFail($request->partner_id);

            if ($request->status !== SupportRequestStatus::Pending->value) {
                throw new InvalidSupportRequestStateException('pending', $request->status);
            }

            if ($approvedAmountJpy > $partner->support_pool) {
                throw new InsufficientSupportPoolException();
            }

            $partner->decrement('support_pool', $approvedAmountJpy);

            $request->update([
                'status' => SupportRequestStatus::Approved->value,
                'approved_amount_jpy' => $approvedAmountJpy,
                'reviewed_at' => now(),
            ]);
        });

        Mail::to($request->partner->user->email)->queue(new SupportRequestApproved($request->fresh()));
    }
}
```

`app/UseCases/Support/RejectSupportRequestUseCase.php`:

```php
<?php

namespace App\UseCases\Support;

use App\Domain\Exceptions\InvalidSupportRequestStateException;
use App\Domain\ValueObjects\SupportRequestStatus;
use App\Mail\SupportRequestRejected;
use App\Models\SupportRequest;
use Illuminate\Support\Facades\Mail;

class RejectSupportRequestUseCase
{
    public function execute(SupportRequest $request, string $reason): void
    {
        if ($request->status !== SupportRequestStatus::Pending->value) {
            throw new InvalidSupportRequestStateException('pending', $request->status);
        }

        $request->update([
            'status' => SupportRequestStatus::Rejected->value,
            'rejection_reason' => $reason,
            'reviewed_at' => now(),
        ]);

        Mail::to($request->partner->user->email)->queue(new SupportRequestRejected($request));
    }
}
```

`app/UseCases/Support/MarkSupportRequestPaidUseCase.php`:

```php
<?php

namespace App\UseCases\Support;

use App\Domain\Exceptions\InvalidSupportRequestStateException;
use App\Domain\ValueObjects\SupportRequestStatus;
use App\Mail\SupportRequestPaid;
use App\Models\SupportRequest;
use Illuminate\Support\Facades\Mail;

class MarkSupportRequestPaidUseCase
{
    public function execute(SupportRequest $request, string $transferReference): void
    {
        if ($request->status !== SupportRequestStatus::Approved->value) {
            throw new InvalidSupportRequestStateException('approved', $request->status);
        }

        $request->update([
            'status' => SupportRequestStatus::Paid->value,
            'transfer_reference' => $transferReference,
            'paid_at' => now(),
        ]);

        Mail::to($request->partner->user->email)->queue(new SupportRequestPaid($request));
    }
}
```

- [ ] **Step 5: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/ReviewSupportRequestTest.php
```

Expected: PASS（4件）

```bash
git add app/Domain/Exceptions/InvalidSupportRequestStateException.php app/UseCases/Support/ tests/Feature/ReviewSupportRequestTest.php
git commit -m "feat(support): add approve/reject/paid use cases with locked pool decrement"
```

---

## Task 6: パートナー側HTTP・React（残高・申請・履歴・領収書閲覧）

**Files:**
- Create: `app/Http/Controllers/SupportRequestController.php`
- Create: `app/Http/Controllers/ReceiptController.php`
- Create: `resources/js/Pages/Partner/Support/Index.tsx`
- Create: `resources/js/Pages/Partner/Support/Create.tsx`
- Modify: `routes/web.php`
- Test: `tests/Feature/SupportRequestHttpTest.php`

- [ ] **Step 1: 失敗するテストを書く**

`tests/Feature/SupportRequestHttpTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Partner;
use App\Models\SupportRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SupportRequestHttpTest extends TestCase
{
    use RefreshDatabase;

    private User $partnerUser;
    private Partner $partner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->partnerUser = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => bcrypt('x'), 'role' => 'partner']);
        $this->partner = Partner::create([
            'user_id' => $this->partnerUser->id, 'provider_type' => 'school', 'display_name' => 'S',
            'country' => 'Kenya', 'region' => 'N', 'contact_name' => 'T', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6', 'support_pool' => 10000,
        ]);
    }

    public function test_申請フォームから領収書付きで申請できる(): void
    {
        Storage::fake('local');

        $this->actingAs($this->partnerUser)
            ->post('/partner/support-requests', [
                'items' => [['name' => 'Notebook', 'quantity' => 30, 'unit_price' => 100]],
                'claimed_amount_jpy' => 3000,
                'receipt' => UploadedFile::fake()->image('receipt.jpg'),
            ])
            ->assertRedirect('/partner/support-requests');

        $request = SupportRequest::first();
        $this->assertEquals(3000, $request->claimed_amount_jpy);
        Storage::disk('local')->assertExists($request->receipt_photo_url);
    }

    public function test_残高超過はバリデーションエラー(): void
    {
        Storage::fake('local');

        $this->actingAs($this->partnerUser)
            ->post('/partner/support-requests', [
                'items' => [['name' => 'PC', 'quantity' => 1, 'unit_price' => 99999]],
                'claimed_amount_jpy' => 99999,
                'receipt' => UploadedFile::fake()->image('receipt.jpg'),
            ])
            ->assertSessionHasErrors();

        $this->assertEquals(0, SupportRequest::count());
    }

    public function test_自分の領収書は閲覧できる(): void
    {
        Storage::fake('local');
        $path = UploadedFile::fake()->image('r.jpg')->store('receipts', 'local');
        $request = SupportRequest::create([
            'partner_id' => $this->partner->id, 'item_list' => [],
            'claimed_amount_jpy' => 100, 'receipt_photo_url' => $path, 'status' => 'pending',
        ]);

        $this->actingAs($this->partnerUser)
            ->get("/receipts/{$request->id}")
            ->assertOk();
    }

    public function test_他partnerの領収書は閲覧できない(): void
    {
        Storage::fake('local');
        $path = UploadedFile::fake()->image('r.jpg')->store('receipts', 'local');
        $request = SupportRequest::create([
            'partner_id' => $this->partner->id, 'item_list' => [],
            'claimed_amount_jpy' => 100, 'receipt_photo_url' => $path, 'status' => 'pending',
        ]);

        $otherUser = User::create(['name' => 'O', 'email' => 'o@example.com', 'password' => bcrypt('x'), 'role' => 'partner']);
        Partner::create([
            'user_id' => $otherUser->id, 'provider_type' => 'school', 'display_name' => 'O',
            'country' => 'Ghana', 'region' => 'A', 'contact_name' => 'O', 'status' => 'approved',
            'themes' => ['culture'], 'grade_range' => '1-6',
        ]);

        $this->actingAs($otherUser)
            ->get("/receipts/{$request->id}")
            ->assertForbidden();
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Feature/SupportRequestHttpTest.php
```

Expected: FAIL（ルート未定義）

- [ ] **Step 3: Controller実装**

`app/Http/Controllers/SupportRequestController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Domain\Exceptions\InsufficientSupportPoolException;
use App\Models\SupportItemCatalog;
use App\UseCases\Support\SubmitSupportRequestInput;
use App\UseCases\Support\SubmitSupportRequestUseCase;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SupportRequestController extends Controller
{
    public function index(Request $request): Response
    {
        $partner = $request->user()->partner;

        return Inertia::render('Partner/Support/Index', [
            'pool' => $partner->support_pool,
            'requests' => $partner->supportRequests()->latest()->get()->map(fn ($r) => [
                'id' => $r->id,
                'claimed_amount_jpy' => $r->claimed_amount_jpy,
                'approved_amount_jpy' => $r->approved_amount_jpy,
                'status' => $r->status,
                'rejection_reason' => $r->rejection_reason,
                'created_at' => $r->created_at->toIso8601String(),
            ]),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('Partner/Support/Create', [
            'pool' => $request->user()->partner->support_pool,
            'catalog' => SupportItemCatalog::where('is_active', true)->get(['name', 'category']),
        ]);
    }

    public function store(Request $request, SubmitSupportRequestUseCase $useCase): RedirectResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.name' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'integer', 'min:0'],
            'claimed_amount_jpy' => ['required', 'integer', 'min:1'],
            'receipt' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:10240'],
        ]);

        $path = $request->file('receipt')->store('receipts', 'local');

        try {
            $useCase->execute(new SubmitSupportRequestInput(
                partnerId: $request->user()->partner->id,
                itemList: $validated['items'],
                claimedAmountJpy: (int) $validated['claimed_amount_jpy'],
                receiptPhotoPath: $path,
            ));
        } catch (InsufficientSupportPoolException $e) {
            return back()->withErrors(['claimed_amount_jpy' => $e->getMessage()]);
        }

        return redirect()->route('partner.support-requests.index')
            ->with('status', 'Support request submitted.');
    }
}
```

> `User::partner` / `Partner::supportRequests` リレーションが未定義なら追加する:
> `User`: `public function partner() { return $this->hasOne(Partner::class); }`
> `Partner`: `public function supportRequests() { return $this->hasMany(SupportRequest::class); }`

`app/Http/Controllers/ReceiptController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\SupportRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReceiptController extends Controller
{
    /** 領収書はprivate storage。本人パートナー or 管理者のみ閲覧可 */
    public function show(Request $request, SupportRequest $supportRequest): StreamedResponse
    {
        $user = $request->user();
        $isOwner = $user->role === 'partner' && $user->partner?->id === $supportRequest->partner_id;
        $isAdmin = $user->role === 'admin';

        abort_unless($isOwner || $isAdmin, 403);

        return Storage::disk('local')->response($supportRequest->receipt_photo_url);
    }
}
```

- [ ] **Step 4: ルート追加**

`routes/web.php`:

```php
use App\Http\Controllers\ReceiptController;
use App\Http\Controllers\SupportRequestController;

Route::middleware(['auth', 'role:partner'])->group(function () {
    Route::get('/partner/support-requests', [SupportRequestController::class, 'index'])->name('partner.support-requests.index');
    Route::get('/partner/support-requests/create', [SupportRequestController::class, 'create'])->name('partner.support-requests.create');
    Route::post('/partner/support-requests', [SupportRequestController::class, 'store'])->name('partner.support-requests.store');
});

Route::middleware('auth')->get('/receipts/{supportRequest}', [ReceiptController::class, 'show'])->name('receipts.show');
```

- [ ] **Step 5: React ページ作成**

`resources/js/Pages/Partner/Support/Index.tsx`:

```tsx
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

type SupportRequestRow = {
    id: number;
    claimed_amount_jpy: number;
    approved_amount_jpy: number | null;
    status: string;
    rejection_reason: string | null;
    created_at: string;
};

export default function Index({ pool, requests }: { pool: number; requests: SupportRequestRow[] }) {
    return (
        <AuthenticatedLayout>
            <Head title="Support Pool" />
            <div className="mx-auto max-w-3xl space-y-4 p-6">
                <h1 className="text-2xl font-bold">Support Pool</h1>
                <p className="text-3xl">¥{pool.toLocaleString()}</p>
                <Link
                    href="/partner/support-requests/create"
                    className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
                >
                    New reimbursement request
                </Link>
                <h2 className="font-bold">History</h2>
                {requests.map((r) => (
                    <div key={r.id} className="rounded border p-3">
                        <div>
                            {new Date(r.created_at).toLocaleDateString()} — Claimed ¥
                            {r.claimed_amount_jpy.toLocaleString()}
                            {r.approved_amount_jpy != null && <> / Approved ¥{r.approved_amount_jpy.toLocaleString()}</>}
                        </div>
                        <div className="font-bold uppercase">{r.status}</div>
                        {r.rejection_reason && <div className="text-red-600">{r.rejection_reason}</div>}
                    </div>
                ))}
            </div>
        </AuthenticatedLayout>
    );
}
```

`resources/js/Pages/Partner/Support/Create.tsx`:

```tsx
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';

type Item = { name: string; quantity: number; unit_price: number };
type CatalogItem = { name: string; category: string | null };

export default function Create({ pool, catalog }: { pool: number; catalog: CatalogItem[] }) {
    const { data, setData, post, errors } = useForm<{
        items: Item[];
        claimed_amount_jpy: number;
        receipt: File | null;
    }>({
        items: [{ name: '', quantity: 1, unit_price: 0 }],
        claimed_amount_jpy: 0,
        receipt: null,
    });

    const updateItem = (i: number, patch: Partial<Item>) => {
        const items = data.items.map((item, idx) => (idx === i ? { ...item, ...patch } : item));
        setData('items', items);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/partner/support-requests');
    };

    return (
        <AuthenticatedLayout>
            <Head title="New reimbursement request" />
            <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4 p-6">
                <h1 className="text-2xl font-bold">Reimbursement request</h1>
                <p>Available balance: ¥{pool.toLocaleString()}</p>

                <div className="rounded border p-3 text-sm">
                    <p className="font-bold">Eligible items (educational use only):</p>
                    <p>{catalog.map((c) => c.name).join(' / ')}</p>
                </div>

                {data.items.map((item, i) => (
                    <div key={i} className="flex gap-2">
                        <input
                            placeholder="Item name"
                            value={item.name}
                            onChange={(e) => updateItem(i, { name: e.target.value })}
                            className="flex-1 rounded border p-2"
                        />
                        <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                            className="w-20 rounded border p-2"
                        />
                        <input
                            type="number"
                            min={0}
                            placeholder="Unit price (JPY)"
                            value={item.unit_price}
                            onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })}
                            className="w-32 rounded border p-2"
                        />
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => setData('items', [...data.items, { name: '', quantity: 1, unit_price: 0 }])}
                    className="text-blue-600 underline"
                >
                    + Add item
                </button>

                <div>
                    <label className="block font-bold">Total claimed amount (JPY equivalent)</label>
                    <input
                        type="number"
                        min={1}
                        value={data.claimed_amount_jpy}
                        onChange={(e) => setData('claimed_amount_jpy', Number(e.target.value))}
                        className="rounded border p-2"
                    />
                    {errors.claimed_amount_jpy && <p className="text-red-600">{errors.claimed_amount_jpy}</p>}
                </div>

                <div>
                    <label className="block font-bold">Receipt photo (jpg/png/pdf)</label>
                    <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={(e) => setData('receipt', e.target.files?.[0] ?? null)}
                    />
                    {errors.receipt && <p className="text-red-600">{errors.receipt}</p>}
                </div>

                <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
                    Submit
                </button>
            </form>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 6: テスト通過確認・コミット**

```bash
docker compose exec app php artisan test tests/Feature/SupportRequestHttpTest.php
docker compose exec app npm run build
```

Expected: PASS（4件）・ビルド成功

```bash
git add app/Http/Controllers/SupportRequestController.php app/Http/Controllers/ReceiptController.php resources/js/Pages/Partner/Support/ routes/web.php app/Models/ tests/Feature/SupportRequestHttpTest.php
git commit -m "feat(http): add partner support request pages with private receipt storage"
```

---

## Task 7: Filament SupportRequestResource（審査・送金記録）

**Files:**
- Create: `app/Filament/Resources/SupportRequestResource.php`（＋自動生成Pages）

- [ ] **Step 1: リソース生成**

```bash
docker compose exec app php artisan make:filament-resource SupportRequest
```

- [ ] **Step 2: テーブル・アクション実装**

生成されたリソースに実装（シグネチャは生成物を維持）。

テーブル列: `partner.display_name` / `claimed_amount_jpy` / `approved_amount_jpy` / `status`（badge） / `created_at`。デフォルトで `status=pending` を先頭にソート。

行アクション3つ:

```php
use App\UseCases\Support\ApproveSupportRequestUseCase;
use App\UseCases\Support\MarkSupportRequestPaidUseCase;
use App\UseCases\Support\RejectSupportRequestUseCase;
use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;

Action::make('viewReceipt')
    ->label('領収書')
    ->url(fn ($record) => route('receipts.show', $record), shouldOpenInNewTab: true),

Action::make('approve')
    ->label('承認')
    ->visible(fn ($record) => $record->status === 'pending')
    ->form([
        TextInput::make('approved_amount_jpy')
            ->label('承認額（円・部分承認可）')
            ->numeric()->required()
            ->default(fn ($record) => $record->claimed_amount_jpy),
    ])
    ->requiresConfirmation()
    ->action(function ($record, array $data) {
        app(ApproveSupportRequestUseCase::class)
            ->execute($record, (int) $data['approved_amount_jpy']);
    }),

Action::make('reject')
    ->label('却下')
    ->visible(fn ($record) => $record->status === 'pending')
    ->form([
        Textarea::make('rejection_reason')->label('却下理由')->required(),
    ])
    ->requiresConfirmation()
    ->action(function ($record, array $data) {
        app(RejectSupportRequestUseCase::class)
            ->execute($record, $data['rejection_reason']);
    }),

Action::make('markPaid')
    ->label('送金済みにする')
    ->visible(fn ($record) => $record->status === 'approved')
    ->form([
        TextInput::make('transfer_reference')->label('Wise送金参照ID')->required(),
    ])
    ->requiresConfirmation()
    ->action(function ($record, array $data) {
        app(MarkSupportRequestPaidUseCase::class)
            ->execute($record, $data['transfer_reference']);
    }),
```

> 申請内容（item_list）と領収書はビューページ or テーブル展開で確認できるようにする。`ReceiptController` のルートは admin ロールにも許可済み（Task 6）。

- [ ] **Step 3: 手動確認**

`/admin` → Support Requests でpending申請に対し承認（額変更）→却下→送金済みの操作ができること、領収書リンクが開くことを確認。

- [ ] **Step 4: コミット**

```bash
git add app/Filament/
git commit -m "feat(admin): add SupportRequestResource with approve/reject/paid actions"
```

---

## Task 8: パートナー詳細ページの支援実績表示・最終チェック

**Files:**
- Modify: カタログのパートナー詳細表示（Phase 2 Task 6 の `CatalogController@show` ＋ 対応Reactページ）

- [ ] **Step 1: パートナー詳細に支援実績を追加**

`CatalogController@show` のレスポンスに追加（金額・領収書は非公開、品目・時期・活用写真のみ）:

```php
'support_history' => $partner->supportRequests()
    ->whereIn('status', ['approved', 'paid'])
    ->latest('reviewed_at')
    ->get()
    ->map(fn ($r) => [
        'items' => collect($r->item_list)->pluck('name'),
        'date' => $r->reviewed_at?->format('Y-m'),
        'usage_photo_url' => $r->usage_photo_url,
    ]),
```

対応するReactページ（カタログ詳細）に表示ブロックを追加:

```tsx
<h2 className="font-bold">物資支援実績</h2>
{supportHistory.length === 0 && <p>まだ実績はありません。</p>}
{supportHistory.map((h, i) => (
    <div key={i} className="rounded border p-3">
        <div>{h.date}</div>
        <div>{h.items.join('、')}</div>
        {h.usage_photo_url && <img src={h.usage_photo_url} alt="活用写真" className="mt-2 max-w-xs" />}
    </div>
))}
```

> 活用写真のアップロードUI（パートナーが後日追加）はFilamentの編集フォームに `usage_photo_url` のFileUploadを置く最小実装でよい（公開画像なので `public` ディスク）。

- [ ] **Step 2: 全テスト・Lint・ビルド**

```bash
docker compose exec app php artisan test
docker compose exec app ./vendor/bin/pint
docker compose exec app ./vendor/bin/phpstan analyse --memory-limit=512M
docker compose exec app npm run build
```

Expected: 全PASS

- [ ] **Step 3: コミット**

```bash
git add app/Http/Controllers/CatalogController.php resources/js/Pages/ app/Filament/
git commit -m "feat(catalog): show approved support history on partner detail page"
```

---

## セルフレビュー（スペックカバレッジ）

- 完了時プール積算（confirmed のみ・冪等） → Task 3 ✅
- 残高表示・随時申請・残高超過拒否・領収書必須 → Task 4, 6 ✅
- private storage・本人/管理者のみ閲覧 → Task 6 ✅
- 部分承認・承認時減算（行ロック）・却下理由必須・プール不変 → Task 5 ✅
- Wise手動送金＋transfer_reference記録 → Task 5, 7 ✅
- ステータス遷移ガード（pending→approved→paid / pending→rejected） → Task 5 ✅
- メール4種 → Task 2 ✅
- 支援実績のカタログ表示（金額非公開・活用写真任意） → Task 8 ✅
- カタログ参照表示（厳密一致なし） → Task 6（Create.tsx） ✅
