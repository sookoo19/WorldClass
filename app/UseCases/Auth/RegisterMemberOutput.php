<?php

namespace App\UseCases\Auth;

use App\Models\User;

readonly class RegisterMemberOutput
{
    public function __construct(
        public User $user,
    ) {}
}
