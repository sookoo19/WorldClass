// resources/js/Pages/Sessions/Show.jsx
// B-2 セッション詳細・申込

import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import WorldClassLayout from '@/Layouts/WorldClassLayout';
import Placeholder from '@/Components/WorldClass/Placeholder';
import ProgressBar from '@/Components/WorldClass/ProgressBar';
import Stars from '@/Components/WorldClass/Stars';
import { Pill, StatusPill, ThemePill } from '@/Components/WorldClass/Pill';
import { WC_ART_TONES } from '@/Components/WorldClass/theme';
import { mockDetail, mockSessions } from '@/data/mockSessions';

const TABS = ['セッション内容', 'パートナー紹介', '物資支援の実績', 'よくある質問'];

export default function Show({ session = mockSessions[0], detail = mockDetail }) {
    const s = session;
    const d = detail;
    const [tab, setTab] = useState(0);
    const supportAmount = Math.round(s.price / 2);

    return (
        <WorldClassLayout active="sessions">
            <Head title={s.title} />

            <div className="mx-auto max-w-[1160px] px-10 pb-16 pt-7">
                {/* パンくず */}
                <div className="mb-4 text-[12.5px] font-semibold text-wc-muted">
                    <Link href={route('sessions.index')} className="hover:text-wc-blue">
                        セッションをさがす
                    </Link>
                    　›　<b className="text-wc-text">{s.title}</b>
                </div>

                <div className="grid grid-cols-[1fr_400px] items-start gap-7">
                    {/* 左カラム：内容 */}
                    <div>
                        <Placeholder label={d.video} tone={WC_ART_TONES[s.art]} ratio="16/8" radius={18} icon="play" />

                        <div className="mb-2 mt-[18px] flex gap-1.5">
                            <ThemePill theme={s.theme} />
                            <StatusPill session={s} />
                            <Pill className="bg-wc-amber-bg text-wc-amber">通訳・進行つき</Pill>
                        </div>

                        <h1 className="text-[28px] font-black tracking-tight text-wc-ink">{s.title}</h1>
                        <div className="mt-1 text-[13.5px] font-medium text-wc-soft">
                            {s.country} · {s.school}　<Stars value={s.rating} size={12} />{' '}
                            <b className="text-wc-text">{s.rating}</b>（準備評価・直近20回）
                        </div>

                        {/* タブ */}
                        <div className="mb-6 mt-5 flex gap-6 border-b border-wc-line">
                            {TABS.map((t, i) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTab(i)}
                                    className={
                                        'pb-3 text-sm font-bold transition ' +
                                        (tab === i
                                            ? 'border-b-[2.5px] border-wc-blue text-wc-blue-deep'
                                            : 'text-wc-muted hover:text-wc-soft')
                                    }
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        <p className="mb-6 text-[14.5px] leading-[1.9] text-wc-body">{s.desc}</p>

                        {/* 当日の流れ */}
                        <div className="mb-5 rounded-card bg-white px-6 py-2.5 shadow-card">
                            {d.agenda.map((a, i) => (
                                <div
                                    key={i}
                                    className={
                                        'flex items-center justify-between py-2.5 text-[13.5px] font-semibold ' +
                                        (i < d.agenda.length - 1 ? 'border-b border-wc-hair' : '')
                                    }
                                >
                                    <span className="flex items-baseline gap-3">
                                        <b className="w-[38px] font-en text-xs text-wc-blue">{a.t}</b>
                                        <span className="font-extrabold text-wc-ink">{a.label}</span>
                                    </span>
                                    <span className="text-xs text-wc-muted">{a.note}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-2.5 rounded-xl bg-wc-green-bg px-3.5 py-2.5 text-[12.5px] font-bold text-wc-green">
                            ✓ 質問リストは申込後、開催1週間前まで送れます。テンプレートを用意しているので初めてでも安心です。
                        </div>
                    </div>

                    {/* 右カラム：申込カード */}
                    <div className="flex flex-col gap-4">
                        <div className="rounded-card bg-white p-6 shadow-card">
                            <div className="flex items-baseline gap-2">
                                <span className="font-en text-[26px] font-extrabold text-wc-ink">{s.date}</span>
                                <span className="text-sm font-extrabold">
                                    （{s.dow}）{s.time}〜
                                </span>
                            </div>
                            <div className="mb-2.5 text-[13.5px] font-medium text-wc-soft">
                                Zoomで開催 · {s.mins}分 · 対象 {s.ages}
                            </div>

                            <div className="mb-3.5 mt-1.5 flex items-center gap-2.5">
                                <ProgressBar value={s.groups} max={s.maxGroups} className="flex-1" />
                                <span className="text-[11.5px] font-bold text-wc-muted">残り{s.maxGroups - s.groups}組</span>
                            </div>

                            <div className="flex items-center justify-between border-b border-wc-hair py-2.5 text-[13.5px] font-semibold text-wc-body">
                                <span>参加費（1グループ）</span>
                                <span className="font-en text-[17px] font-extrabold text-wc-ink">
                                    ¥{s.price.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center justify-between border-b border-wc-hair py-2.5 text-[13.5px] font-semibold text-wc-body">
                                <span>うち物資支援にあてられる額</span>
                                <span className="font-extrabold text-wc-green">
                                    ¥{supportAmount.toLocaleString()}（50%）
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2.5 text-[13.5px] font-semibold text-wc-body">
                                <span>ファシリテーター（通訳・進行）</span>
                                <span className="font-extrabold text-wc-ink">込み</span>
                            </div>

                            {/* TODO: 申込フロー（B-4〜B-6）実装後に route を差し替え */}
                            <button
                                type="button"
                                className="mt-3 inline-flex h-[50px] w-full items-center justify-center rounded-xl bg-wc-blue text-[15px] font-bold text-white transition hover:bg-wc-blue-deep"
                            >
                                申し込みにすすむ
                            </button>
                            <div className="mt-2.5 text-center text-[11.5px] font-semibold leading-relaxed text-wc-muted">
                                開催確定済み · 不成立時は全額返金 · Stripeで安全に決済
                            </div>
                        </div>

                        <div className="rounded-card bg-white p-6 shadow-card">
                            <div className="mb-3 text-[11.5px] font-extrabold tracking-wider text-wc-muted">担当の先生</div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-wc-blue-soft font-extrabold text-wc-blue-deep">
                                    J
                                </div>
                                <div>
                                    <div className="text-sm font-extrabold">{d.teacher}</div>
                                    <div className="text-xs font-semibold text-wc-muted">
                                        英語でのやりとり · 日本語通訳が同席
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-card bg-white p-6 shadow-card">
                            <div className="mb-3 text-[11.5px] font-extrabold tracking-wider text-wc-muted">
                                この学校への物資支援
                            </div>
                            {d.supplies.map((sp, i) => (
                                <div
                                    key={i}
                                    className={'flex items-center gap-3 py-2.5 ' + (i ? 'border-t border-wc-hair' : '')}
                                >
                                    <Placeholder
                                        label={sp.ph}
                                        tone="#FFD98C"
                                        radius={10}
                                        className="h-[54px] w-[72px] flex-shrink-0"
                                    />
                                    <div>
                                        <div className="font-en text-[11px] font-bold text-wc-muted">{sp.date}</div>
                                        <div className="text-[12.5px] font-bold leading-normal text-wc-text">{sp.body}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </WorldClassLayout>
    );
}
