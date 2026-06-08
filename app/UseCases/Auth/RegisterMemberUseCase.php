<?php

namespace App\UseCases\Auth;

use App\Domain\Repositories\MemberRepositoryInterface;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class RegisterMemberUseCase
{
    public function __construct(
        private MemberRepositoryInterface $memberRepository,
    ) {}

    public function execute(RegisterMemberInput $input): RegisterMemberOutput
    {
        $user = User::create([
            'name' => $input->name,
            'email' => $input->email,
            'password' => Hash::make($input->password),
            'role' => 'member',
        ]);

        $this->memberRepository->create([
            'user_id' => $user->id,
            'type' => $input->type,
            'org_name' => $input->orgName,
            'prefecture' => $input->prefecture,
            'contact_name' => $input->contactName,
            'grade_range' => $input->gradeRange,
        ]);

        return new RegisterMemberOutput($user);
    }
}
