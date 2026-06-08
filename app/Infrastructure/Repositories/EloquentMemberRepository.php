<?php

namespace App\Infrastructure\Repositories;

use App\Domain\Repositories\MemberRepositoryInterface;
use App\Models\Member;

class EloquentMemberRepository implements MemberRepositoryInterface
{
    public function create(array $attributes): Member
    {
        return Member::create($attributes);
    }
}
