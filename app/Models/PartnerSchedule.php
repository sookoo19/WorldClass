<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['partner_id', 'day_of_week', 'start_time_jst', 'duration_min', 'max_sessions'])]
class PartnerSchedule extends Model
{
    protected $casts = [
        'day_of_week' => 'integer',
        'duration_min' => 'integer',
        'max_sessions' => 'integer',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }
}
