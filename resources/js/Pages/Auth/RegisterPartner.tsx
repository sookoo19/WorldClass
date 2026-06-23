import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

const PROVIDER_TYPES = [
    { value: 'overseas_school', label: '海外の学校' },
    { value: 'local_japanese', label: '現地で活動する日本人' },
] as const;

const THEMES = [
    { value: 'culture', label: '文化交流' },
    { value: 'english', label: '英語学習' },
    { value: 'global', label: '国際理解' },
] as const;

export default function RegisterPartner() {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        password_confirmation: '',
        provider_type: 'overseas_school',
        display_name: '',
        country: '',
        region: '',
        contact_name: '',
        themes: [] as string[],
        grade_range: '',
    });

    const toggleTheme = (value: string) => {
        setData(
            'themes',
            data.themes.includes(value)
                ? data.themes.filter((t) => t !== value)
                : [...data.themes, value],
        );
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('register.partner'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <GuestLayout>
            <Head title='パートナー登録' />

            <form onSubmit={submit}>
                <div>
                    <InputLabel htmlFor='provider_type' value='提供者区分' />
                    <select
                        id='provider_type'
                        name='provider_type'
                        value={data.provider_type}
                        onChange={(e) => setData('provider_type', e.target.value)}
                        className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500'
                        required
                    >
                        {PROVIDER_TYPES.map((p) => (
                            <option key={p.value} value={p.value}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                    <InputError message={errors.provider_type} className='mt-2' />
                </div>

                <div className='mt-4'>
                    <InputLabel htmlFor='display_name' value='表示名' />
                    <TextInput
                        id='display_name'
                        name='display_name'
                        value={data.display_name}
                        className='mt-1 block w-full'
                        isFocused
                        onChange={(e) => setData('display_name', e.target.value)}
                        required
                    />
                    <InputError message={errors.display_name} className='mt-2' />
                </div>

                <div className='mt-4'>
                    <InputLabel htmlFor='country' value='国' />
                    <TextInput
                        id='country'
                        name='country'
                        value={data.country}
                        className='mt-1 block w-full'
                        onChange={(e) => setData('country', e.target.value)}
                        required
                    />
                    <InputError message={errors.country} className='mt-2' />
                </div>

                <div className='mt-4'>
                    <InputLabel htmlFor='region' value='地域' />
                    <TextInput
                        id='region'
                        name='region'
                        value={data.region}
                        className='mt-1 block w-full'
                        onChange={(e) => setData('region', e.target.value)}
                        required
                    />
                    <InputError message={errors.region} className='mt-2' />
                </div>

                <div className='mt-4'>
                    <InputLabel htmlFor='contact_name' value='連絡担当者名' />
                    <TextInput
                        id='contact_name'
                        name='contact_name'
                        value={data.contact_name}
                        className='mt-1 block w-full'
                        onChange={(e) => setData('contact_name', e.target.value)}
                        required
                    />
                    <InputError message={errors.contact_name} className='mt-2' />
                </div>

                <div className='mt-4'>
                    <InputLabel value='提供テーマ（1つ以上）' />
                    <div className='mt-2 space-y-2'>
                        {THEMES.map((t) => (
                            <label key={t.value} className='flex items-center'>
                                <input
                                    type='checkbox'
                                    checked={data.themes.includes(t.value)}
                                    onChange={() => toggleTheme(t.value)}
                                    className='rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500'
                                />
                                <span className='ms-2 text-sm text-gray-600'>{t.label}</span>
                            </label>
                        ))}
                    </div>
                    <InputError message={errors.themes} className='mt-2' />
                </div>

                <div className='mt-4'>
                    <InputLabel htmlFor='grade_range' value='対象学年' />
                    <TextInput
                        id='grade_range'
                        name='grade_range'
                        value={data.grade_range}
                        className='mt-1 block w-full'
                        onChange={(e) => setData('grade_range', e.target.value)}
                        required
                    />
                    <InputError message={errors.grade_range} className='mt-2' />
                </div>

                <div className='mt-4'>
                    <InputLabel htmlFor='email' value='メールアドレス' />
                    <TextInput
                        id='email'
                        type='email'
                        name='email'
                        value={data.email}
                        className='mt-1 block w-full'
                        autoComplete='username'
                        onChange={(e) => setData('email', e.target.value)}
                        required
                    />
                    <InputError message={errors.email} className='mt-2' />
                </div>

                <div className='mt-4'>
                    <InputLabel htmlFor='password' value='パスワード' />
                    <TextInput
                        id='password'
                        type='password'
                        name='password'
                        value={data.password}
                        className='mt-1 block w-full'
                        autoComplete='new-password'
                        onChange={(e) => setData('password', e.target.value)}
                        required
                    />
                    <InputError message={errors.password} className='mt-2' />
                </div>

                <div className='mt-4'>
                    <InputLabel htmlFor='password_confirmation' value='パスワード（確認）' />
                    <TextInput
                        id='password_confirmation'
                        type='password'
                        name='password_confirmation'
                        value={data.password_confirmation}
                        className='mt-1 block w-full'
                        autoComplete='new-password'
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        required
                    />
                    <InputError message={errors.password_confirmation} className='mt-2' />
                </div>

                <div className='mt-4 flex items-center justify-end'>
                    <Link
                        href={route('login')}
                        className='rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                    >
                        登録済みの方
                    </Link>
                    <PrimaryButton className='ms-4' disabled={processing}>
                        登録
                    </PrimaryButton>
                </div>
            </form>
        </GuestLayout>
    );
}
