<?php

namespace App\UseCases\Auth;

readonly class RegisterPartnerInput
{
    public function __construct(
        public string $email,
        public string $password,
        public string $providerType,   // ProviderType値
        public string $displayName,
        public string $country,
        public string $region,
        public string $contactName,
        public array  $themes,         // ThemeType値の配列
        public string $gradeRange,
    ) {}
}
