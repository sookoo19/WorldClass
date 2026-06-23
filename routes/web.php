<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect()->route('login'));

// 認証後の中立ランディング。ロールに応じて専用ダッシュボードへ振り分ける。
// Breeze標準コントローラ（login/verify/confirm）が route('dashboard') を参照するため必要。
Route::middleware('auth')->get('/dashboard', function () {
    return match (Auth::user()->role) {
        'partner' => redirect()->route('partner.dashboard'),
        default => redirect()->route('member.dashboard'),
    };
})->name('dashboard');

Route::middleware(['auth', 'role:member'])->prefix('member')->group(function () {
    Route::get('/dashboard', [DashboardController::class,
        'member'])->name('member.dashboard');
});

Route::middleware(['auth', 'role:partner'])->prefix('partner')->group(function () {
    Route::get('/dashboard', [DashboardController::class,
        'partner'])->name('partner.dashboard');
});

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class,
        'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class,
        'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class,
        'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
