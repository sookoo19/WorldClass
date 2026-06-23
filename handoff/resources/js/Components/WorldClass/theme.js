// resources/js/Components/WorldClass/theme.js
// WorldClass デザイントークン（Tailwindクラスで表現できない動的マップ）
// Tailwind側のトークンは tailwind.config.js の colors.wc を参照

export const WC_THEMES = {
    文化交流: { color: '#FF651E', bg: '#FFE3D2', pill: 'bg-wc-orange-bg text-wc-orange' },
    国際理解: { color: '#0043C3', bg: '#D6E6FF', pill: 'bg-wc-blue-soft text-wc-blue-deep' },
    英語学習: { color: '#A36500', bg: '#FFEFD2', pill: 'bg-wc-cream text-wc-amber' },
};

// セッション画像が用意できるまでのプレースホルダー背景色
export const WC_ART_TONES = {
    kenya: '#9CB9FF',
    bhutan: '#FFD98C',
    morocco: '#F3D9F1',
    timor: '#BFE3D2',
    ghana: '#FFD2BC',
    tunisia: '#CFE0FF',
};
