<?php

namespace App\Domain\Repositories;

use App\Models\User;

interface UserRepositoryInterface
{
    public function create(array $attributes): User;
}
