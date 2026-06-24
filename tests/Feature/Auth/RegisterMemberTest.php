<?php

namespace Tests\Feature\Auth;

use App\Models\Member;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegisterMemberTest extends TestCase
{
    use RefreshDatabase;

    public function test_利用者の家庭が登録できる(): void
    {
        $response = $this->post('/register/member', [
            'email' => 'family@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'name' => '田中家',
            'type' => 'family',
            'org_name' => null,
            'prefecture' => '東京都',
            'contact_name' => '田中太郎',
            'grade_range' => '小4〜6年',
        ]);

        $response->assertRedirect('/member/dashboard');

        $user = User::where('email', 'family@example.com')->first();
        $this->assertNotNull($user);
        $this->assertSame('member', $user->role);
        $this->assertTrue(
            Member::where('user_id', $user->id)->where('type', 'family')->exists()
        );
    }

    public function test_重複メールで登録するとバリデーションエラー(): void
    {
        User::factory()->create(['email' => 'dup@example.com']);

        $response = $this->post('/register/member', [
            'email' => 'dup@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'name' => 'テスト塾',
            'type' => 'cram_school',
            'org_name' => 'テスト塾',
            'prefecture' => '東京都',
            'contact_name' => '山田',
            'grade_range' => null,
        ]);

        $response->assertSessionHasErrors('email');
    }
}
