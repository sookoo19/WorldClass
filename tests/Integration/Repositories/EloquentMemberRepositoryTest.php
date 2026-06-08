<?php

namespace Tests\Integration\Repositories;

use App\Infrastructure\Repositories\EloquentMemberRepository;
use App\Models\Member;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EloquentMemberRepositoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_persists_member_to_database(): void
    {
        $user = User::factory()->create();
        $repository = new EloquentMemberRepository;

        $member = $repository->create([
            'user_id' => $user->id,
            'type' => 'family',
            'org_name' => null,
            'prefecture' => '東京都',
            'contact_name' => '山田太郎',
            'grade_range' => '小学生',
        ]);

        $this->assertInstanceOf(Member::class, $member);
        $this->assertDatabaseHas('members', [
            'user_id' => $user->id,
            'type' => 'family',
        ]);
    }
}
