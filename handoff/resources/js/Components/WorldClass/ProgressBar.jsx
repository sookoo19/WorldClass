// resources/js/Components/WorldClass/ProgressBar.jsx
// 申込グループ数の進捗バー

export default function ProgressBar({ value, max, className = '' }) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    return (
        <span className={'block h-1.5 overflow-hidden rounded-full bg-[#E8EEF9] ' + className}>
            <span
                className="block h-full rounded-full bg-wc-blue"
                style={{ width: pct + '%' }}
            ></span>
        </span>
    );
}
