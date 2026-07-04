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
        $tz = 'Asia/Tokyo';
        $startDate = Carbon::today($tz)->addDays(7); // 予約締切＝1週間前
        $endDate = Carbon::today($tz)->addDays(42);

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
                    $key = "{$dateStr}_{$timeStr}";

                    if (! isset($blockedDates[$dateStr]) && ! isset($bookedKeys[$key])) {
                        $slots[] = [
                            'date' => $dateStr,
                            'start_time' => $timeStr,
                            'duration_min' => $schedule->duration_min,
                            'schedule_id' => $schedule->id,
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
        $tz = 'Asia/Tokyo';
        $start = Carbon::today($tz)->addDays(7)->toDateString();
        $end = Carbon::today($tz)->addDays(20)->toDateString();

        return collect($this->getAvailableSlots($partner))
            ->filter(fn ($s) => $s['date'] >= $start && $s['date'] <= $end)
            ->count();
    }
}
