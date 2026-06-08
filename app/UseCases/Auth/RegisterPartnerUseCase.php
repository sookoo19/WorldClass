<?php

namespace App\UseCases\Auth;

use App\Domain\Repositories\PartnerRepositoryInterface;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class RegisterPartnerUseCase
{
    public function __construct(
        private PartnerRepositoryInterface $partnerRepository,
    ) {}

    public function execute(RegisterPartnerInput $input): RegisterPartnerOutput
    {
        $user = User::create([
            'name'     => $input->contactName,
            'email'    => $input->email,
            'password' => Hash::make($input->password),
            'role'     => 'partner',
        ]);

        $this->partnerRepository->create([
            'user_id'       => $user->id,
            'provider_type' => $input->providerType,
            'display_name'  => $input->displayName,
            'country'       => $input->country,
            'region'        => $input->region,
            'contact_name'  => $input->contactName,
            'themes'        => $input->themes,
            'grade_range'   => $input->gradeRange,
            'status'        => 'pending',
        ]);

        return new RegisterPartnerOutput($user);
    }
}
