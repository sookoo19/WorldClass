<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function member(): Response
    {
        return Inertia::render('Dashboard/Member');
    }

    public function partner(): Response
    {
        /** @var User $user */
        $user = Auth::user();

        return Inertia::render('Dashboard/Partner', [
            'status' => $user->partner?->status,
        ]);
    }
}
