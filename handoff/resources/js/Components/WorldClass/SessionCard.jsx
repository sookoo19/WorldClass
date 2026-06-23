// resources/js/Components/WorldClass/SessionCard.jsx
// セッション一覧用のカード（B-1 グリッドカード）

import { Link } from '@inertiajs/react';
import Placeholder from '@/Components/WorldClass/Placeholder';
import ProgressBar from '@/Components/WorldClass/ProgressBar';
import { Pill, StatusPill, ThemePill } from '@/Components/WorldClass/Pill';
import { WC_ART_TONES } from '@/Components/WorldClass/theme';

export default function SessionCard({ session: s }) {
    return (
        <div className="flex flex-col overflow-hidden rounded-card bg-white shadow-card transition-shadow hover:shadow-card-hover">
            <div className="relative">
                <Placeholder label={s.country + '校の写真'} tone={WC_ART_TONES[s.art]} ratio="16/9" radius={0} />
                <span className="absolute left-3 top-3">
                    <ThemePill theme={s.theme} floating />
                </span>
                <span className="absolute right-3 top-3">
                    <StatusPill session={s} floating />
                </span>
            </div>

            <div className="flex flex-1 flex-col gap-2 px-5 pb-5 pt-[18px]">
                <div className="flex items-baseline gap-2 font-en">
                    <span className="text-xl font-extrabold tracking-tight text-wc-ink">
                        {s.date}
                        <span className="text-[13px]">（{s.dow}）</span>
                    </span>
                    <span className="text-[13px] font-bold text-wc-muted">
                        {s.time}〜 · {s.mins}分
                    </span>
                </div>

                <h3 className="text-[17px] font-black leading-snug tracking-tight text-wc-ink">{s.title}</h3>

                <div className="text-[12.5px] font-semibold text-wc-soft">
                    {s.country} · {s.school}
                </div>

                <div className="flex gap-1.5">
                    <Pill className="bg-[#F0F3FA] text-wc-soft">対象 {s.ages}</Pill>
                    <Pill className="bg-wc-amber-bg text-wc-amber">通訳つき</Pill>
                </div>

                <div className="flex items-center gap-2.5">
                    <ProgressBar value={s.groups} max={s.maxGroups} className="flex-1" />
                    <span className="text-[11.5px] font-bold text-wc-muted">
                        {s.groups}/{s.maxGroups}組
                    </span>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-wc-hair pt-3">
                    <span className="font-en text-lg font-extrabold text-wc-ink">
                        ¥{s.price.toLocaleString()}
                        <small className="font-sans text-[11px] font-semibold text-wc-muted">／グループ</small>
                    </span>
                    <Link
                        href={route('sessions.show', s.id)}
                        className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-xl bg-wc-blue px-[18px] text-[13.5px] font-bold text-white transition hover:bg-wc-blue-deep"
                    >
                        申し込む
                    </Link>
                </div>
            </div>
        </div>
    );
}
