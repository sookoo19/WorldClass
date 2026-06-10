<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules;

class RegisterPartnerRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'unique:users'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'provider_type' => ['required', 'in:overseas_school,local_japanese'],
            'display_name' => ['required', 'string', 'max:255'],
            'country' => ['required', 'string', 'max:100'],
            'region' => ['required', 'string', 'max:100'],
            'contact_name' => ['required', 'string', 'max:255'],
            'themes' => ['required', 'array', 'min:1'],
            'themes.*' => ['in:culture,english,global'],
            'grade_range' => ['required', 'string', 'max:50'],
        ];
    }
}
