<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterMemberRequest;
use App\Http\Requests\RegisterPartnerRequest;
use App\UseCases\Auth\RegisterMemberInput;
use App\UseCases\Auth\RegisterMemberUseCase;
use App\UseCases\Auth\RegisterPartnerInput;
use App\UseCases\Auth\RegisterPartnerUseCase;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    public function __construct(
        private RegisterMemberUseCase $registerMemberUseCase,
        private RegisterPartnerUseCase $registerPartnerUseCase,
    ) {}

    public function createMember(): Response
    {
        return Inertia::render('Auth/RegisterMember');
    }

    public function createPartner(): Response
    {
        return Inertia::render('Auth/RegisterPartner');
    }

    public function storeMember(RegisterMemberRequest $request): RedirectResponse
    {
        $output = $this->registerMemberUseCase->execute(
            new RegisterMemberInput(
                email: $request->email,
                password: $request->password,
                name: $request->name,
                type: $request->type,
                orgName: $request->org_name,
                prefecture: $request->prefecture,
                contactName: $request->contact_name,
                gradeRange: $request->grade_range,
            ));

        event(new Registered($output->user));
        Auth::login($output->user);

        return redirect()->route('member.dashboard');
    }

    public function storePartner(RegisterPartnerRequest $request): RedirectResponse
    {
        $output = $this->registerPartnerUseCase->execute(
            new RegisterPartnerInput(
                email: $request->email,
                password: $request->password,
                providerType: $request->provider_type,
                displayName: $request->display_name,
                country: $request->country,
                region: $request->region,
                contactName: $request->contact_name,
                themes: $request->themes,
                gradeRange: $request->grade_range,
            )
        );

        event(new Registered($output->user));
        Auth::login($output->user);

        return redirect()->route('partner.dashboard');
    }
}
