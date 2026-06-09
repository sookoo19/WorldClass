<?php

namespace Tests\Unit\UseCases;

use App\Domain\Repositories\MemberRepositoryInterface;
use App\Domain\Repositories\UserRepositoryInterface;
use App\Models\Member;
use App\Models\User;
use App\UseCases\Auth\RegisterMemberInput;
use App\UseCases\Auth\RegisterMemberUseCase;
use Mockery;
use Tests\TestCase;

class RegisterMemberUseCaseTest extends TestCase
{
    public function test_利用者を登録してmemberロールが付与される(): void
    {
        $user = new User(['name' => '田中家', 'email' => 'family@example.com', 'role' => 'member']);

        $userRepo = Mockery::mock(UserRepositoryInterface::class);
        $userRepo->shouldReceive('create')
            ->once()
            ->with(Mockery::on(fn ($attrs) => $attrs['role'] === 'member' &&
                $attrs['email'] === 'family@example.com'
            ))
            ->andReturn($user);

        $memberRepo = Mockery::mock(MemberRepositoryInterface::class);
        $memberRepo->shouldReceive('create')
            ->once()
            ->with(Mockery::on(fn ($attrs) => $attrs['type'] === 'family' &&
                $attrs['prefecture'] === '東京都'
            ))
            ->andReturn(new Member(['type' => 'family']));

        $useCase = new RegisterMemberUseCase($userRepo, $memberRepo);

        $input = new RegisterMemberInput(
            email: 'family@example.com',
            password: 'password123',
            name: '田中家',
            type: 'family',
            orgName: null,
            prefecture: '東京都',
            contactName: '田中太郎',
            gradeRange: '小4〜6年',
        );

        $output = $useCase->execute($input);

        $this->assertSame('member', $output->user->role);
        $this->assertSame('family@example.com', $output->user->email);
    }
}
