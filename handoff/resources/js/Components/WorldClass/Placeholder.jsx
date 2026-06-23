// resources/js/Components/WorldClass/Placeholder.jsx
// 写真・動画の差し込み位置を示すプレースホルダー。
// 実画像が用意でき次第 <img> に置き換えてください。

import { useId } from 'react';

export default function Placeholder({
    label,
    tone = '#D6E6FF',
    ratio,
    radius = 16,
    icon,
    className = '',
    style,
}) {
    const patternId = 'ph' + useId().replace(/[^a-zA-Z0-9]/g, '');

    return (
        <div
            className={'relative overflow-hidden ' + className}
            style={{
                background: tone,
                borderRadius: radius,
                ...(ratio ? { aspectRatio: ratio } : {}),
                ...style,
            }}
        >
            <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
                <defs>
                    <pattern
                        id={patternId}
                        width="14"
                        height="14"
                        patternUnits="userSpaceOnUse"
                        patternTransform="rotate(45)"
                    >
                        <rect width="14" height="14" fill="transparent"></rect>
                        <rect width="7" height="14" fill="rgba(255,255,255,0.35)"></rect>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill={'url(#' + patternId + ')'}></rect>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                {icon === 'play' ? (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(0,45,122,0.75)]">
                        <div className="ml-[3px] h-0 w-0 border-y-8 border-l-[12px] border-y-transparent border-l-white"></div>
                    </div>
                ) : null}
                <span className="rounded-md bg-white/70 px-2 py-[3px] font-mono text-[11px] font-semibold tracking-wide text-[rgba(0,45,122,0.65)]">
                    {label}
                </span>
            </div>
        </div>
    );
}
