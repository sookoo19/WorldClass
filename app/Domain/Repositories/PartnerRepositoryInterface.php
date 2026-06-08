<?php

namespace App\Domain\Repositories;

use App\Models\Partner;

interface PartnerRepositoryInterface
{
    public function create(array $attributes): Partner;
}
