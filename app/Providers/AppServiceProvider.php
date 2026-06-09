<?php

namespace App\Providers;

use App\Domain\Repositories\MemberRepositoryInterface;
use App\Domain\Repositories\PartnerRepositoryInterface;
use App\Domain\Repositories\UserRepositoryInterface;
use App\Infrastructure\Repositories\EloquentMemberRepository;
use App\Infrastructure\Repositories\EloquentPartnerRepository;
use App\Infrastructure\Repositories\EloquentUserRepository;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(UserRepositoryInterface::class, EloquentUserRepository::class);
        $this->app->bind(MemberRepositoryInterface::class, EloquentMemberRepository::class);
        $this->app->bind(PartnerRepositoryInterface::class, EloquentPartnerRepository::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);
    }
}
