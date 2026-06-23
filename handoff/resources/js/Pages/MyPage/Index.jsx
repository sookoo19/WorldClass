// resources/js/Pages/MyPage/Index.jsx
// B-3 マイページ：次のセッションの準備フロー＋実績

import { Head } from '@inertiajs/react';
import WorldClassLayout from '@/Layouts/WorldClassLayout';
import Placeholder from '@/Components/WorldClass/Placeholder';
import Stars from '@/Components/WorldClass/Stars';
import { Pill, StatusPill, ThemePill } from '@/Components/WorldClass/Pill';
import { WC_ART_TONES } from '@/Components/WorldClass/theme';
import { mockMyPage, mockSessions } from '@/data/mockSessions';

const STEP_STYLES = {
    done: 'bg-wc-green-bg text-wc-green',
    now: 'bg-wc-warn-bg text-wc-warn',
    todo: 'bg-[#F0F3FA] text-wc-muted',
};

function CardLabel({ children }) {
    return <div className="mb-3 text-[11.5px] font-extrabold tracking-wider text-wc-muted">{children}</div>;
}

export default function Index({ mypage = mockMyPage, nextSession = mockSessions[0] }) {
    const m = mypage;
    const s = nextSession;

    return (
        <WorldClassLayout active="mypage">
            <Head title="マイページ" />

            <div className="mx-auto max-w-[1160px] px-10 pb-16 pt-8">
                <h1 className="text-[26px] font-black tracking-tight text-wc-ink">マイページ</h1>
                <p className="mt-1 text-[13.5px] font-medium text-wc-soft">
                    {m.user} · つぎのセッションまであと{m.next.daysLeft}日
                </p>

                {/* 実績サマリー */}
                <div className="mb-6 mt-5 grid grid-cols-3 gap-4">
                    <div className="rounded-card bg-white px-[22px] py-5 shadow-card">
                        <div className="font-en text-[26px] font-extrabold tracking-tight text-wc-ink">
                            {m.support.sessions}
                            <span className="text-sm">回</span>
                        </div>
                        <div className="mt-0.5 text-xs font-bold text-wc-muted">これまでの参加</div>
                    </div>
                    <div className="rounded-card bg-white px-[22px] py-5 shadow-card">
                        <div className="font-en text-[26px] font-extrabold tracking-tight text-wc-ink">
                            ¥{m.support.total.toLocaleString()}
                        </div>
                        <div className="mt-0.5 text-xs font-bold text-wc-muted">物資支援になった金額（累計）</div>
                    </div>
                    <div className="rounded-card bg-white px-[22px] py-5 shadow-card">
                        <div className="font-en text-[26px] font-extrabold tracking-tight text-wc-ink">
                            2<span className="text-sm">か国</span>
                        </div>
                        <div className="mt-0.5 text-xs font-bold text-wc-muted">交流した国（ケニア・モロッコ）</div>
                    </div>
                </div>

                <div className="grid grid-cols-[1fr_400px] items-start gap-6">
                    {/* 左カラム：次のセッション */}
                    <div className="flex flex-col gap-4">
                        <div className="overflow-hidden rounded-card bg-white shadow-card">
                            <div className="flex items-center gap-[18px] border-b border-wc-hair p-[22px]">
                                <Placeholder
                                    label={s.country + '校'}
                                    tone={WC_ART_TONES[s.art]}
                                    radius={12}
                                    className="h-[88px] w-[132px] flex-shrink-0"
                                />
                                <div className="flex-1">
                                    <div className="mb-1.5 flex gap-1.5">
                                        <ThemePill theme={s.theme} />
                                        <StatusPill session={s} />
                                    </div>
                                    <div className="text-[16.5px] font-black tracking-tight text-wc-ink">{s.title}</div>
                                    <div className="text-[12.5px] font-semibold text-wc-soft">
                                        {s.date}（{s.dow}）{s.time}〜 · {s.mins}分 · 通訳つき
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        type="button"
                                        className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-xl bg-wc-blue px-[18px] text-[13.5px] font-bold text-white transition hover:bg-wc-blue-deep"
                                    >
                                        Zoomを開く
                                    </button>
                                    <button
                                        type="button"
                                        className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-xl border border-wc-border bg-white px-[18px] text-[13.5px] font-bold text-wc-text transition hover:bg-wc-bg"
                                    >
                                        詳細を見る
                                    </button>
                                </div>
                            </div>

                            <div className="px-6 pb-[22px] pt-[18px]">
                                <CardLabel>準備の進みぐあい</CardLabel>
                                <div className="flex flex-col">
                                    {m.next.steps.map((st, i) => (
                                        <div
                                            key={i}
                                            className={
                                                'flex items-start gap-3.5 py-3 ' +
                                                (i < m.next.steps.length - 1 ? 'border-b border-wc-hair' : '')
                                            }
                                        >
                                            <span
                                                className={
                                                    'mt-px flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ' +
                                                    STEP_STYLES[st.state]
                                                }
                                            >
                                                {st.state === 'done' ? '✓' : i + 1}
                                            </span>
                                            <div className="flex-1">
                                                <div className="text-[13.5px] font-extrabold text-wc-ink">{st.label}</div>
                                                <div className="text-xs font-semibold text-wc-muted">{st.note}</div>
                                            </div>
                                            {st.state === 'now' ? (
                                                <Pill className="self-center bg-wc-warn-bg text-wc-warn">
                                                    パートナーの確認待ち
                                                </Pill>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-wc-green-bg px-3.5 py-2.5 text-[12.5px] font-bold text-wc-green">
                                    前日12:00までに確認がない場合は自動キャンセル・全額返金のうえ、10%割引クーポンをお渡しします。
                                </div>
                            </div>
                        </div>

                        <div className="rounded-card bg-white p-6 shadow-card">
                            <div className="flex items-baseline justify-between">
                                <CardLabel>送った質問リスト</CardLabel>
                                <span className="cursor-pointer text-xs font-bold text-wc-blue">編集する</span>
                            </div>
                            {m.next.questions.map((q, i) => (
                                <div
                                    key={i}
                                    className={
                                        'flex items-center py-2.5 text-[13.5px] font-semibold ' +
                                        (i < m.next.questions.length - 1 ? 'border-b border-wc-hair' : '')
                                    }
                                >
                                    <span className="flex gap-2.5">
                                        <b className="font-en text-xs text-wc-blue">Q{i + 1}</b>
                                        <span className="text-wc-text">{q}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 右カラム：レポート・履歴 */}
                    <div className="flex flex-col gap-4">
                        <div className="rounded-card bg-white p-6 shadow-card">
                            <CardLabel>最新の物資支援レポート</CardLabel>
                            <Placeholder label={m.support.latest.ph} tone="#FFD98C" ratio="16/8" radius={12} />
                            <div className="mb-1 mt-3 font-en text-[11px] font-bold text-wc-muted">
                                {m.support.latest.date} · {m.support.latest.school}
                            </div>
                            <div className="text-[13px] font-bold leading-relaxed text-wc-text">
                                {m.support.latest.body}
                            </div>
                            <button
                                type="button"
                                className="mt-3.5 inline-flex h-10 w-full items-center justify-center rounded-xl bg-wc-blue-pale text-[13.5px] font-bold text-wc-blue-deep transition hover:bg-wc-blue-soft"
                            >
                                レポート一覧を見る
                            </button>
                        </div>

                        <div className="rounded-card bg-white p-6 shadow-card">
                            <CardLabel>これまでのセッション</CardLabel>
                            {m.history.map((h, i) => (
                                <div
                                    key={i}
                                    className={'flex items-center gap-3 py-[11px] ' + (i ? 'border-t border-wc-hair' : '')}
                                >
                                    <div className="flex-1">
                                        <div className="text-[13px] font-extrabold leading-snug text-wc-ink">{h.title}</div>
                                        <div className="text-[11.5px] font-semibold text-wc-muted">
                                            {h.date} · {h.country}
                                        </div>
                                    </div>
                                    <Stars value={h.rated} size={11} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </WorldClassLayout>
    );
}
