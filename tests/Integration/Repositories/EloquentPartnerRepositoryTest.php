<?php

namespace Tests\Integration\Repositories;

use App\Infrastructure\Repositories\EloquentPartnerRepository;
use App\Models\Partner;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EloquentPartnerRepositoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_persists_partner_to_database(): void
    {
        $user = User::factory()->create();
        $repository = new EloquentPartnerRepository;

        $partner = $repository->create([
            'user_id' => $user->id,
            'provider_type' => 'overseas_school',
            'display_name' => 'Example School',
            'country' => 'ケニア',
            'region' => 'ナイロビ',
            'contact_name' => 'John Doe',
            'themes' => ['culture', 'english'],
            'grade_range' => '中学生',
            'status' => 'pending',
        ]);

        $this->assertInstanceOf(Partner::class, $partner);
        $this->assertDatabaseHas('partners', [
            'user_id' => $user->id,
            'display_name' => 'Example School',
        ]);
    }
}
