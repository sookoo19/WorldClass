<?php

namespace App\UseCases\Auth;

readonly class RegisterMemberInput
{
    public function __construct(
        public string $email,
        public string $password,
        public string $name,
        public string $type,           // MemberType値
        public ?string $orgName,
        public string $prefecture,
        public string $contactName,
        public ?string $gradeRange,
    ) {}
}
