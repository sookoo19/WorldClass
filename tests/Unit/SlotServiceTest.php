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
        $this->service = new SlotService;
        // 「今日」を2026-06-01(月) JST に固定
        Carbon::setTestNow(Carbon::parse('2026-06-01 00:00:00', 'Asia/Tokyo'));

        $user = User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => 'x', 'role' => 'partner']);
        $this->partner = Partner::create([
            'user_id' => $user->id, 'provider_type' => 'overseas_school', 'display_name' => 'S',
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

    public function test_is_availableでスロット実在性を検証できる(): void
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
