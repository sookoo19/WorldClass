<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        // パスワードのハードコード禁止: env から必須で受け取る
        $password = env('ADMIN_SEED_PASSWORD');

        if (! $password) {
            $this->command->warn('ADMIN_SEED_PASSWORD 
  が未設定のため管理者ユーザーを作成しません。');

            return;
        }

        $email = env('ADMIN_SEED_EMAIL', 'admin@worldclass.jp');

        User::updateOrCreate(
            ['email' => $email],
            [
                'name' => 'WorldClass Admin',
                'password' => Hash::make($password),
                'role' => 'admin',
            ]
        );

        $this->command->info("Admin user created: {$email}");
    }
}
