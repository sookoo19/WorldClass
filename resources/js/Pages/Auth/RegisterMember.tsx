import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

const MEMBER_TYPES = [
    { value: 'family', label: 'ご家族' },
    { value: 'cram_school', label: '個人塾' },
    { value: 'circle', label: 'サークル団体' },
    { value: 'public_facility', label: '公民館・図書館等' },
    { value: 'other', label: 'その他' },
] as const;

export default function RegisterMember() {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        password_confirmation: '',
        name: '',
        type: 'family',
        org_name: '',
        prefecture: '',
        contact_name: '',
        grade_range: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('register.member'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <GuestLayout>
            <Head title='利用者登録' />

            <form onSubmit={submit}>
                <div>
                    <InputLabel htmlFor='name' value='お名前' />
                    <TextInput
                        id='name'
                        name='name'
                        value={data.name}
                        className='mt-1 block w-full'
                        autoComplete='name'
                        isFocused
                        onChange={(e) => setData('name', e.target.value)}
                        required
                    />
                    <InputError message={errors.name} className='mt-2' />
                </div>

                <div className='mt-4'>
                    <InputLabel htmlFor='type' value='ご利用区分' />
                    <select
                        id='type'
                        name='type'
                        value={data.type}
                        onChange={(e) => setData('type', e.target.value)}
                        className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500'
                        required
                    >
                        {MEMBER_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                    <InputError message={errors.type} className='mt-2' />
                </div>

                <div className='mt-4'>
                    <InputLabel htmlFor='org_name' value='団体名（任意）' />
                    <TextInput
                        id='org_name'
                        name='org_name'
                        value={data.org_name}
                        className='mt-1 block w-full'
                        onChange={(e) => setData('org_name', e.target.value)}
                    />
                    <InputError message={errors.org_name} className='mt-2' />
                </div>

                <div className='mt-4'>
                    <InputLabel htmlFor='prefecture' value='都道府県' />
                    <TextInput
                        id='prefecture'
                        name='prefecture'
                        value={data.prefecture}
                        className='mt-1 block w-full'
                        onChange={(e) => setData('prefecture', e.target.value)}
                        required
                    />
                    <InputError message={errors.prefecture} className='mt-2' />
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
                    <InputLabel htmlFor='grade_range' value='対象学年（任意）' />
                    <TextInput
                        id='grade_range'
                        name='grade_range'
                        value={data.grade_range}
                        className='mt-1 block w-full'
                        onChange={(e) => setData('grade_range', e.target.value)}
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
