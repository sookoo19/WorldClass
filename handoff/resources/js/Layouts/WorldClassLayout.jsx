// resources/js/Layouts/WorldClassLayout.jsx
// WorldClass 共通レイアウト（Calm Blue）：上部ナビ＋ページ背景

import { Link, usePage } from '@inertiajs/react';
import WCLogoMark from '@/Components/WorldClass/WCLogoMark';

const NAV_ITEMS = [
    { key: 'sessions', label: 'セッションをさがす', route: 'sessions.index' },
    { key: 'mypage', label: 'マイページ', route: 'mypage' },
    { key: 'reports', label: '物資支援レポート', route: null }, // TODO: ルート実装後に差し替え
    { key: 'help', label: '使い方', route: null },
];

export default function WorldClassLayout({ active, children }) {
    const user = usePage().props.auth?.user;

    return (
        <div
            className="min-h-screen bg-wc-bg font-sans text-wc-text antialiased"
            style={{ fontFeatureSettings: '"palt" 1' }}
        >
            <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#E8ECF5] bg-white px-10">
                <Link href="/" className="flex items-center gap-2 text-lg font-extrabold text-wc-navy">
                    <WCLogoMark size={26} />
                    WorldClass
                </Link>

                <nav className="flex items-center gap-1 text-[13.5px] font-bold">
                    {NAV_ITEMS.map((item) => {
                        const cls =
                            'rounded-[10px] px-3.5 py-2 transition ' +
                            (active === item.key
                                ? 'bg-wc-blue-pale text-wc-blue-deep'
                                : 'text-wc-soft hover:text-wc-text');
                        return item.route ? (
                            <Link key={item.key} href={route(item.route)} className={cls}>
                                {item.label}
                            </Link>
                        ) : (
                            <span key={item.key} className={cls + ' cursor-default'}>
                                {item.label}
                            </span>
                        );
                    })}
                </nav>

                {user ? (
                    <div className="flex items-center gap-2 text-[13px] font-bold text-wc-text">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-wc-blue-soft text-[13px] font-extrabold text-wc-blue-deep">
                            {user.name?.charAt(0)}
                        </span>
                        {user.name}
                    </div>
                ) : (
                    <div className="flex items-center gap-2.5">
                        <Link
                            href={route('login')}
                            className="inline-flex h-[38px] items-center rounded-xl border border-wc-border bg-white px-4 text-[13px] font-bold text-wc-text transition hover:bg-wc-bg"
                        >
                            ログイン
                        </Link>
                        <Link
                            href={route('register')}
                            className="inline-flex h-[38px] items-center rounded-xl bg-wc-blue px-4 text-[13px] font-bold text-white transition hover:bg-wc-blue-deep"
                        >
                            新規登録
                        </Link>
                    </div>
                )}
            </header>

            <main>{children}</main>
        </div>
    );
}
