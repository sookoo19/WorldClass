<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'partner_id', 'item_list', 'claimed_amount_jpy', 'receipt_photo_url',
    'status', 'approved_amount_jpy', 'rejection_reason', 'reviewed_at',
    'paid_at',
])]
class SupportRequest extends Model
{
    public function partner()
    {
        return $this->belongsTo(Partner::class);
    }

    protected $casts = [
        'item_list' => 'array',
        'reviewed_at' => 'datetime',
        'paid_at' => 'datetime',
    ];
}
