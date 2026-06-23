# WorldClass フロントエンド ハンドオフ

デザインプロトタイプ（Calm Blue / Direction B）を、`sookoo19/WorldClass` リポジトリの
**Laravel Breeze + Inertia.js + React** 構成に合わせて変換したものです。

## 📦 含まれるもの

```
handoff/
├── tailwind.config.js                          ← リポジトリのものと置き換え（wcトークン追加）
├── resources/
│   ├── views/
│   │   └── app.blade.php                       ← フォントを WorldClass 用に変更
│   └── js/
│       ├── Layouts/
│       │   └── WorldClassLayout.jsx            ← 共通レイアウト（ナビ＋背景）
│       ├── Components/WorldClass/
│       │   ├── theme.js                        ← テーマ色・プレースホルダー色
│       │   ├── WCLogoMark.jsx                  ← ロゴ
│       │   ├── Pill.jsx                        ← テーマ/ステータスバッジ
│       │   ├── Placeholder.jsx                 ← 画像プレースホルダー
│       │   ├── ProgressBar.jsx                 ← 申込進捗バー
│       │   ├── Stars.jsx                       ← 星評価
│       │   └── SessionCard.jsx                 ← 一覧カード
│       ├── Pages/
│       │   ├── Sessions/
│       │   │   ├── Index.jsx                   ← B-1 オープンセッション一覧
│       │   │   └── Show.jsx                    ← B-2 セッション詳細・申込
│       │   └── MyPage/
│       │       └── Index.jsx                   ← B-3 マイページ
│       └── data/
│           └── mockSessions.js                 ← 仮データ（API実装まで）
└── README.md
```

## 🚀 導入手順

### 1. ファイルをコピー

リポジトリのルートで、`handoff/` の中身をそのままの階層でコピーします。

- `tailwind.config.js` → **上書き**（既存の content 設定は維持済み、`colors.wc` 等を追加）
- `resources/views/app.blade.php` → **上書き**（フォントを Figtree → Zen Kaku Gothic New + Plus Jakarta Sans に変更）
- `resources/js/` 配下 → **追加**（既存ファイルとの競合なし）

> 注意: `fontFamily.sans` を Zen Kaku Gothic New に変更しているため、
> Breeze の認証画面のフォントも変わります（トーン統一のため推奨）。

### 2. ルートを追加（routes/web.php）

```php
use App\Http\Controllers\SessionController;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    Route::get('/sessions', [SessionController::class, 'index'])->name('sessions.index');
    Route::get('/sessions/{id}', [SessionController::class, 'show'])->name('sessions.show');
    Route::get('/mypage', fn () => Inertia::render('MyPage/Index'))->name('mypage');
});
```

ログイン必須にしない場合は `middleware('auth')` を外してください
（レイアウトは未ログイン時にログイン/新規登録ボタンを表示します）。

### 3. コントローラーを作成

```bash
php artisan make:controller SessionController
```

```php
<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

class SessionController extends Controller
{
    public function index()
    {
        // propsを渡さない間は、Page側の mockSessions が表示されます。
        // DB実装後: return Inertia::render('Sessions/Index', ['sessions' => Session::upcoming()->get()]);
        return Inertia::render('Sessions/Index');
    }

    public function show(string $id)
    {
        return Inertia::render('Sessions/Show');
        // DB実装後: ['session' => ..., 'detail' => ...] を渡す
    }
}
```

### 4. 起動して確認

```bash
npm install        # 依存は既存のままでOK（追加パッケージなし）
npm run dev
php artisan serve  # または docker compose up
```

`/sessions` にアクセスして一覧が表示されれば成功です。

## 🔌 バックエンド接続のポイント

- 各 Page はpropsのデフォルト値として `@/data/mockSessions` を使っています。
  コントローラーから同じ形のデータを渡せば、**コード変更なしで実データに切り替わります**。
- セッションの形（最低限）:
  `{ id, country, school, theme, title, date, dow, time, mins, price, ages, groups, minGroups, maxGroups, status, rating, art, desc }`
  - `theme`: `文化交流 | 国際理解 | 英語学習`
  - `status`: `confirmed | needs1 | needs2`
- 写真が用意でき次第、`<Placeholder />` を `<img>` に置き換えてください。

## 🗺️ 未実装の画面（プロトタイプ参照）

以下はプロトタイプ（WorldClass Prototype.html）にデザイン済みです。必要になったら同じ手順で変換できます：

- B-4〜B-6: 会員登録 → 申込確認 → 完了（Stripe Checkout 前提）
- B-7〜B-9: 質問リスト作成 / 物資支援レポート / セッション後評価
- 団体（org）向け画面・海外パートナーダッシュボード

## 🎨 デザイントークン早見表

| 用途 | クラス | 値 |
|------|--------|-----|
| ページ背景 | `bg-wc-bg` | #F5F7FB |
| 見出し | `text-wc-ink` | #0E2156 |
| 本文 | `text-wc-body` | #3D4F7E |
| 補足 | `text-wc-soft` / `text-wc-muted` | #5A6B92 / #8A97B8 |
| プライマリ | `bg-wc-blue` | #0059FF |
| 確定・成功 | `text-wc-green` + `bg-wc-green-bg` | #2E7458 / #EAF6F0 |
| 成立待ち | `text-wc-warn` + `bg-wc-warn-bg` | #E2541B / #FFF1E8 |
| カード | `rounded-card shadow-card` | 18px / ソフトシャドウ |
| 数字・英字 | `font-en` | Plus Jakarta Sans |
