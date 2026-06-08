<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'partner_id', 'session_type', 'scheduled_at', 'duration_min',
    'theme', 'capacity', 'min_groups', 'with_facilitator',
    'price_jpy', 'status', 'ready_checked_at', 'cancelled_at',
])]
class Session extends Model
{
    public function partner()
    {
        return $this->belongsTo(Partner::class);
    }

    public function participants()
    {
        return $this->hasMany(SessionParticipant::class);
    }

    protected $casts = [
        'scheduled_at' => 'datetime',
        'ready_checked_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'with_facilitator' => 'boolean',
    ];
}
