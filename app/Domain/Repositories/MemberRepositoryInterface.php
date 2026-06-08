<?php

namespace App\Domain\Repositories;

use App\Models\Member;

interface MemberRepositoryInterface
{
    public function create(array $attributes): Member;
}
