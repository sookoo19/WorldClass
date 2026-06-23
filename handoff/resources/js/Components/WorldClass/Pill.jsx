// resources/js/Components/WorldClass/Pill.jsx
// ピル型バッジ：テーマ / 開催ステータス / 汎用

import { WC_THEMES } from '@/Components/WorldClass/theme';

export function Pill({ className = '', style, children }) {
    return (
        <span
            className={
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-extrabold ' +
                className
            }
            style={style}
        >
            {children}
        </span>
    );
}

// テーマ（文化交流・国際理解・英語学習）バッジ
// floating: 写真の上に重ねる白背景バージョン
export function ThemePill({ theme, floating = false }) {
    const t = WC_THEMES[theme];
    if (!t) return null;

    if (floating) {
        return (
            <Pill className="bg-white shadow-[0_2px_8px_rgba(22,41,91,0.12)]" style={{ color: t.color }}>
                {theme}
            </Pill>
        );
    }
    return <Pill className={t.pill}>{theme}</Pill>;
}

// 開催ステータス（確定 / あとn組で成立）バッジ
export function StatusPill({ session, floating = false }) {
    const confirmed = session.status === 'confirmed';
    const label = confirmed ? '● 開催確定' : `あと${session.minGroups - session.groups}組で成立`;
    const tone = confirmed ? 'text-wc-green' : 'text-wc-warn';
    const bg = confirmed ? 'bg-wc-green-bg' : 'bg-wc-warn-bg';

    if (floating) {
        return <Pill className={'bg-white shadow-[0_2px_8px_rgba(22,41,91,0.12)] ' + tone}>{label}</Pill>;
    }
    return <Pill className={bg + ' ' + tone}>{label}</Pill>;
}
