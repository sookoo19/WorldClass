<?php

namespace Tests\Feature\Auth;

use App\Models\Partner;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegisterPartnerTest extends TestCase
{
    use RefreshDatabase;

    public function test_海外パートナーがpendingステータスで登録される(): void
    {
        $response = $this->post('/register/partner', [
            'email' => 'partner@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'provider_type' => 'overseas_school',
            'display_name' => 'Sunshine Elementary',
            'country' => 'ケニア',
            'region' => 'Nairobi',
            'contact_name' => 'Maria Santos',
            'themes' => ['culture', 'global'],
            'grade_range' => 'Grade 4-6',
        ]);

        $response->assertRedirect('/partner/dashboard');

        $user = User::where('email', 'partner@example.com')->first();
        $this->assertSame('partner', $user->role);

        $partner = Partner::where('user_id', $user->id)->first();
        $this->assertSame('pending', $partner->status->value);
        $this->assertContains('culture', $partner->themes);
    }

    public function test_テーマ未選択だとバリデーションエラー(): void
    {
        $response = $this->post('/register/partner', [
            'email' => 'notheme@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'provider_type' => 'overseas_school',
            'display_name' => 'Sunshine Elementary',
            'country' => 'ケニア',
            'region' => 'Nairobi',
            'contact_name' => 'Maria Santos',
            'themes' => [],          // ← min:1 違反
            'grade_range' => 'Grade 4-6',
        ]);

        $response->assertSessionHasErrors('themes');
    }
}
