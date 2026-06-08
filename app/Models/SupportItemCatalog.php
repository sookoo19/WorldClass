<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'category', 'is_active'])]
class SupportItemCatalog extends Model
{
    protected $casts = [
        'is_active' => 'boolean',
    ];
}
