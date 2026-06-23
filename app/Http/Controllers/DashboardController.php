<?php

namespace App\Http\Controllers;

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
        return Inertia::render('Dashboard/Partner', [
            'status' => Auth::user()->partner?->status,
        ]);
    }
}
