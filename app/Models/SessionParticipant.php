<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'session_id', 'member_id', 'status', 'stripe_payment_id',
    'price_paid', 'support_amount', 'question_list',
    'question_list_sent_at', 'rating_score', 'rating_comment', 'cancelled_at',
])]
class SessionParticipant extends Model
{
    public function session()
    {
        return $this->belongsTo(Session::class);
    }

    public function member()
    {
        return $this->belongsTo(Member::class);
    }

    protected $casts = [
        'question_list_sent_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];
}
