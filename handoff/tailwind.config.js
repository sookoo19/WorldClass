import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.{jsx,tsx}',
    ],

    theme: {
        extend: {
            colors: {
                // WorldClass「Calm Blue」デザイントークン
                wc: {
                    bg: '#F5F7FB', // ページ背景
                    ink: '#0E2156', // 見出し
                    navy: '#002D7A', // ロゴ・最濃色
                    text: '#16295B', // 本文（濃）
                    body: '#3D4F7E', // 本文（標準）
                    soft: '#5A6B92', // 補足テキスト
                    muted: '#8A97B8', // ラベル・最薄テキスト
                    line: '#E3E9F4', // 罫線
                    border: '#DDE5F2', // ボタン枠線
                    hair: '#EEF2F9', // カード内ヘアライン
                    blue: '#0059FF', // プライマリ
                    'blue-deep': '#0043C3', // プライマリ濃
                    'blue-soft': '#D6E6FF', // ブルー背景（濃）
                    'blue-pale': '#EEF4FF', // ブルー背景（淡）
                    'blue-mist': '#EAF1FF', // バナー背景
                    green: '#2E7458', // 成功・確定
                    'green-bg': '#EAF6F0',
                    warn: '#E2541B', // 注意・成立待ち
                    'warn-bg': '#FFF1E8',
                    amber: '#A36500', // 英語学習・通訳タグ
                    'amber-bg': '#FFF6E3',
                    orange: '#FF651E', // 文化交流
                    'orange-bg': '#FFE3D2',
                    yellow: '#FFA801', // 星評価
                    cream: '#FFEFD2',
                },
            },
            fontFamily: {
                sans: ['"Zen Kaku Gothic New"', '"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans],
                en: ['"Plus Jakarta Sans"', 'sans-serif'],
            },
            boxShadow: {
                card: '0 1px 2px rgba(22,41,91,0.04), 0 10px 28px -16px rgba(22,41,91,0.14)',
                'card-hover': '0 2px 4px rgba(22,41,91,0.05), 0 18px 40px -16px rgba(22,41,91,0.22)',
                chip: '0 1px 2px rgba(22,41,91,0.06), 0 4px 12px -8px rgba(22,41,91,0.12)',
                'chip-on': '0 6px 16px -8px rgba(0,89,255,0.5)',
            },
            borderRadius: {
                card: '18px',
            },
        },
    },

    plugins: [forms],
};
