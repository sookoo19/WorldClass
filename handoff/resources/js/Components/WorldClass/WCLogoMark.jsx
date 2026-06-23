// resources/js/Components/WorldClass/WCLogoMark.jsx
// WorldClass ロゴマーク（地球儀＋太陽）

export default function WCLogoMark({ size = 28 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="14" fill="#0059FF"></circle>
            <ellipse cx="16" cy="16" rx="6.5" ry="14" fill="none" stroke="#fff" strokeWidth="2"></ellipse>
            <line x1="2" y1="16" x2="30" y2="16" stroke="#fff" strokeWidth="2"></line>
            <circle cx="23" cy="9" r="4.5" fill="#FFA801" stroke="#FBF8F2" strokeWidth="1.5"></circle>
        </svg>
    );
}
