// resources/js/Components/WorldClass/Stars.jsx
// 5段階の星評価表示

export default function Stars({ value, size = 13, color = '#FFA801' }) {
    return (
        <span className="inline-flex items-center gap-px">
            {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} width={size} height={size} viewBox="0 0 20 20">
                    <path
                        d="M10 1.6l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L10 14.2 4.9 17l1.1-5.6L1.8 7.5l5.7-.7z"
                        fill={i <= Math.round(value) ? color : '#E7E2D6'}
                    ></path>
                </svg>
            ))}
        </span>
    );
}
