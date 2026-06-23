<?php

namespace App\Http\Controllers;

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
        return Inertia::render('Dashboard/Partner');
    }
}
