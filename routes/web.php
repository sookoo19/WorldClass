<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect()->route('login'));

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
