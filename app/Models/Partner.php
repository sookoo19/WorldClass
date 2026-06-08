<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'user_id', 'provider_type', 'display_name', 'country', 'region', 'contact_name', 'video_url', 'status', 'rating_score', 'penalty_count', 'support_pool', 'themes', 'grade_range',
])]
class Partner extends Model
{
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function sessions()
    {
        return $this->hasMany(Session::class);
    }

    public function supportRequests()
    {
        return $this->hasMany(SupportRequest::class);
    }

    protected $casts = [
        'themes' => 'array',
        'rating_score' => 'float',
    ];
}
