<?php

namespace App\Infrastructure\Repositories;

use App\Domain\Repositories\PartnerRepositoryInterface;
use App\Models\Partner;

class EloquentPartnerRepository implements PartnerRepositoryInterface
{
    public function create(array $attributes): Partner
    {
        return Partner::create($attributes);
    }
}
