// resources/js/Pages/Sessions/Index.jsx
// B-1 オープンセッション一覧：チップフィルター＋3列カードグリッド

import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import WorldClassLayout from '@/Layouts/WorldClassLayout';
import SessionCard from '@/Components/WorldClass/SessionCard';
import { mockSessions } from '@/data/mockSessions';

const THEME_CHIPS = ['文化交流', '国際理解', '英語学習'];

function Chip({ on, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                'inline-flex h-10 items-center gap-1.5 rounded-full px-[18px] text-[13px] font-bold transition ' +
                (on
                    ? 'bg-wc-blue text-white shadow-chip-on'
                    : 'bg-white text-wc-body shadow-chip hover:text-wc-ink')
            }
        >
            {children}
        </button>
    );
}

export default function Index({ sessions = mockSessions }) {
    const [theme, setTheme] = useState(null);

    const filtered = useMemo(
        () => (theme ? sessions.filter((s) => s.theme === theme) : sessions),
        [sessions, theme],
    );

    return (
        <WorldClassLayout active="sessions">
            <Head title="オープンセッションをさがす" />

            <div className="px-12 pb-16 pt-9">
                <h1 className="text-3xl font-black tracking-tight text-wc-ink">オープンセッションをさがす</h1>
                <p className="mt-1 text-[13.5px] font-medium text-wc-soft">
                    ご家庭から参加できる国際交流。3組以上の申込で開催が確定します。すべて通訳・進行スタッフつき。
                </p>

                {/* テーマチップ */}
                <div className="mb-2.5 mt-5 flex flex-wrap gap-2">
                    <Chip on={theme === null} onClick={() => setTheme(null)}>
                        すべて
                        <span className="rounded-full bg-white/25 px-1.5 py-px font-en text-[11px]">
                            {sessions.length}
                        </span>
                    </Chip>
                    {THEME_CHIPS.map((t) => (
                        <Chip key={t} on={theme === t} onClick={() => setTheme(theme === t ? null : t)}>
                            {t}
                        </Chip>
                    ))}
                </div>

                {/* 絞り込み行（バックエンド実装後に有効化） */}
                <div className="mb-5 flex items-center gap-2 text-[12.5px] font-semibold text-wc-muted">
                    <span>絞り込み：</span>
                    <span className="rounded-full border border-wc-line bg-white px-3 py-1.5 text-wc-body">国：すべて ▾</span>
                    <span className="rounded-full border border-wc-line bg-white px-3 py-1.5 text-wc-body">対象年齢：すべて ▾</span>
                    <span className="rounded-full border border-wc-line bg-white px-3 py-1.5 text-wc-body">時間：45分・60分 ▾</span>
                    <span className="ml-auto">並び順：開催日が近い順 ▾</span>
                </div>

                {/* 物資支援バナー */}
                <div className="mb-6 flex items-center gap-3.5 rounded-[14px] bg-wc-blue-mist px-5 py-3 text-[13px] font-bold text-wc-text">
                    <span className="font-en text-[21px] font-extrabold text-wc-blue">50%</span>
                    <span>参加費の半分は、現地の学校への物資支援（文具・教材・機材）に使われます。</span>
                    <span className="ml-auto text-[12.5px] font-bold text-wc-blue">しくみを見る →</span>
                </div>

                {/* カードグリッド */}
                <div className="grid grid-cols-3 gap-[22px]">
                    {filtered.map((s) => (
                        <SessionCard key={s.id} session={s} />
                    ))}
                </div>
            </div>
        </WorldClassLayout>
    );
}
