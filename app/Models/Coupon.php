<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['member_id', 'discount_pct', 'reason', 'code', 'used_at',
    'expires_at'])]
class Coupon extends Model
{
    public function member()
    {
        return $this->belongsTo(Member::class);
    }

    protected $casts = [
        'used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];
}
