<?php

namespace Tests\Unit\UseCases;

use App\Domain\Repositories\PartnerRepositoryInterface;
use App\Domain\Repositories\UserRepositoryInterface;
use App\Models\Partner;
use App\Models\User;
use App\UseCases\Auth\RegisterPartnerInput;
use App\UseCases\Auth\RegisterPartnerUseCase;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\TestCase;

class RegisterPartnerUseCaseTest extends TestCase
{
    public function test_海外パートナーをpendingステータスで登録する(): void
    {
        DB::shouldReceive('transaction')
            ->once()
            ->andReturnUsing(fn (callable $callback) => $callback());

        $user = new User(['name' => 'Maria Santos', 'email' => 'partner@example.com', 'role' => 'partner']);

        $userRepo = Mockery::mock(UserRepositoryInterface::class);
        $userRepo->shouldReceive('create')
            ->once()
            ->with(Mockery::on(fn ($attrs) => $attrs['role'] === 'partner' &&
                $attrs['email'] === 'partner@example.com'
            ))
            ->andReturn($user);

        $partnerRepo = Mockery::mock(PartnerRepositoryInterface::class);
        $partnerRepo->shouldReceive('create')
            ->once()
            ->with(Mockery::on(fn ($attrs) => $attrs['status'] === 'pending' &&
                $attrs['provider_type'] === 'overseas_school' &&
                $attrs['display_name'] === 'Sunshine Elementary'
            ))
            ->andReturn(new Partner(['display_name' => 'Sunshine Elementary']));

        $useCase = new RegisterPartnerUseCase($userRepo, $partnerRepo);

        $input = new RegisterPartnerInput(
            email: 'partner@example.com',
            password: 'password123',
            providerType: 'overseas_school',
            displayName: 'Sunshine Elementary',
            country: 'ケニア',
            region: 'Nairobi',
            contactName: 'Maria Santos',
            themes: ['culture', 'global'],
            gradeRange: 'Grade 4-6',
        );

        $output = $useCase->execute($input);

        $this->assertSame('partner', $output->user->role);
    }
}
