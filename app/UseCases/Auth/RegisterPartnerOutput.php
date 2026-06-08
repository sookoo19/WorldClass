<?php

namespace App\UseCases\Auth;

use App\Models\User;

readonly class RegisterPartnerOutput
{
    public function __construct(
        public User $user,
    ) {}
}
