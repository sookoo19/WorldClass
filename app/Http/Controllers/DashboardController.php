<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

class DashboardController extends Controller
{
    public function member(): Reaponse
    {
        return Inertia::render('Dashboard/Member');
    }

    public function partner(): Response
    {
        return Inertia::render('Dashboard/Partner');
    }
}
