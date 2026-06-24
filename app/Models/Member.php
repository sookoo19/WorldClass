<?php

namespace App\Models;

use App\Domain\ValueObjects\MemberType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['user_id', 'type', 'org_name', 'prefecture', 'contact_name', 'grade_range'])]
class Member extends Model
{
    protected $casts = [
        'type' => MemberType::class,
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function participations()
    {
        return $this->hasMany(SessionParticipant::class);
    }

    public function coupons()
    {
        return $this->hasMany(Coupon::class);
    }
}
