# WorldClass フロントエンド・ハンズオン実装計画（Calm Blue / handoff統合）

> **進め方（ハンズオン）:** コードは**あなた自身**がエディタ／端末で書きます。各 Step に完全なコードを載せてあるので、写経しながら理解してください。各 Task の最後に「動作確認」と「コミット」があります。Claude は説明と差分提示のみ行い、ファイルは自動編集しません。

**Goal:** Claude Design が作成した handoff（`handoff/`）の確定デザイン（Calm Blue / Direction B）を、プロジェクト方針である **Inertia.js + React + TypeScript (.tsx)** に変換しながら取り込み、B-1 セッション一覧 / B-2 セッション詳細 / B-3 マイページの3画面と共通基盤（デザイントークン・部品ライブラリ）を実装する。

**Architecture:** handoff は presentation 層のみ（クリーンアーキの内側には触れない）。実データ接続は **Controller で DB → handoff のデータ形へ整形する Presenter** を境界に置く（コントローラは薄く保つ）。各 Page の props は**必須**とし、mock はプレビュー専用ページ（`*Preview.tsx`・接続後に削除）から明示的に渡す。Presenter が同形の props を渡せば Page 本体はコード変更なしで実データへ切り替わる。

**Tech Stack:** Laravel 13 / Inertia.js + React **(.tsx)** / Tailwind CSS + `@tailwindcss/forms` / Ziggy (`@routes` / `route()`) / Pest（PHPUnitスタイル, Presenter のみ）

## Global Constraints

- **言語は TSX。** handoff は全 `.jsx`。プロジェクト方針は `.tsx`（`resources/js/Pages/Dashboard/Member.tsx` 等が実在）。取り込み時に **props interface を付与して TSX 化**する。元 `.jsx` は `handoff/` に参照用として残し、本体は `resources/js/` 配下に作る。
- **パス命名は `OpenSessions/` に統一（phase2.5 準拠）。** handoff の `Pages/Sessions/*` は **`Pages/OpenSessions/*`** にリネームして取り込む。ルート名は `open-sessions.index` / `open-sessions.show`。「open」を冠することで将来の非オープン（団体/group）セッションと区別する。
- **所有境界（重要・二重実装の防止）:**
  - **この FE 計画が所有:** すべての `.tsx` ページ、FE 基盤（トークン/型/部品/Layout）、`SessionViewPresenter`（DB→handoff形のデータ契約。PHP だが handoff の形に従うため FE 計画側で定義しテストする）。
  - **phase 計画（BE）が所有:** Controller・route・UseCase・Repository・Job・Filament・Mailable。Controller は **本 FE 計画が定義した component 名＋ Presenter が返す props 形**で `Inertia::render` する。
  - 各ページ Task に「**BE 接続契約**」ブロックを置き、`route名 / controller@method（所属phase） / component / props` を明示する。phase2.5/3 側の該当 Task は **FE ページ作成 Step を持たず、本計画を参照する**（重複実装しない）。
- **UI 文言・通貨はすべて日本語 / 円（`¥` + `toLocaleString()`）。** handoff の文言をそのまま維持。
- **日時は UTC 保存 → 表示時に `Asia/Tokyo` へ変換。** `date` / `dow` / `time` は Presenter で JST 整形して文字列で渡す（フロントで再計算しない）。**例外:** ISO8601 を props で受けてフロントで `toLocaleString('ja-JP')` する画面（B-6 Complete / B-9 Ratings / Partner 詳細）は**閲覧者のローカル時刻**で表示する（海外パートナーが現地時刻で見えるのは意図どおり）。
- **デザイントークンは2系統。** Tailwind 静的クラス = `tailwind.config.js` の `colors.wc`。動的マップ（テーマ色・プレースホルダー色）= `theme.ts`。新規の色は必ずこの2箇所のどちらかに足す（マジックHEXをJSXに直書きしない）。
- **追加 npm パッケージなし。** 既存依存（`@inertiajs/react` ^2 / `react` ^18 / `typescript` ^5.4 / `@tailwindcss/forms`）のみで完結。

---

## 前提チェック（実装開始前に確認）

mock 表示（Task 1〜5, 8）は DB 不要で進められる。**実データ接続（Task 6, 7）** に入る前に、以下が backend 側（phase2.5 / phase3）に存在するか確認すること。無ければ当該 backend 計画側で先に用意する（この FE 計画では実装しない）。

- `sessions` テーブルに `title`（string）と `description`（text）カラム — handoff の `title` / `desc` の供給元。phase2.5 Task3 の `Session::create` 例には含まれていないため要確認。
- `partners` に `rating`（数値・平均評価）— handoff の `rating` の供給元。phase3 Task8 で平均再計算が入る予定。無ければ Presenter 側で `0` 既定にする。
- `partners.country` は英語表記（例 `Kenya`）。handoff は日本語（`ケニア`）。Presenter 内の国名マップで変換する（Task 6 で実装。網羅されない国は英語のままフォールバック）。
- `art`（プレースホルダー配色キー）に対応する DB カラムは**無い**。写真導入までは Presenter で国から推定 or 既定トーンを返す（Task 6）。

---

## ファイル構成

```
resources/
├── views/
│   └── app.blade.php                      # Modify: フォント差替 + vite glob を .tsx 対応に
├── js/
│   ├── types/
│   │   └── session.ts                     # Create: 共有型（SessionSummary 等）
│   ├── data/
│   │   └── mockSessions.ts                # Create: handoff の mock を TSX 用に型付きで移植
│   ├── Components/WorldClass/
│   │   ├── theme.ts                       # Create: WC_THEMES / WC_ART_TONES（型付き）
│   │   ├── WCLogoMark.tsx                 # Create
│   │   ├── Placeholder.tsx                # Create
│   │   ├── ProgressBar.tsx                # Create
│   │   ├── Stars.tsx                      # Create
│   │   ├── Pill.tsx                       # Create: Pill / ThemePill / StatusPill
│   │   └── SessionCard.tsx                # Create
│   ├── Layouts/
│   │   └── WorldClassLayout.tsx           # Create
│   └── Pages/
│       ├── OpenSessions/
│       │   ├── Index.tsx                  # Create: B-1 一覧（handoff Sessions/Index 由来）
│       │   ├── IndexPreview.tsx           # Create: mock プレビュー専用（phase2.5 接続後に削除）
│       │   ├── Show.tsx                   # Create: B-2 詳細・申込（handoff Sessions/Show 由来）
│       │   ├── ShowPreview.tsx            # Create: mock プレビュー専用（phase2.5 接続後に削除）
│       │   └── Complete.tsx               # Create: B-6 申込完了（Calm Blue で新規design）
│       ├── MyPage/
│       │   ├── Index.tsx                  # Create: B-3 マイページ
│       │   └── IndexPreview.tsx           # Create: mock プレビュー専用（phase3 接続後に削除）
│       ├── Ratings/
│       │   └── Create.tsx                 # Create: B-9 評価フォーム（Calm Blue で新規design）
│       ├── Sessions/
│       │   └── Checklist.tsx              # Create: 当日チェックリスト（静的・Calm Blue）
│       └── Partner/
│           └── SessionDetail.tsx          # Create: パートナー質問閲覧・ready（Calm Blue・日本語化）
tailwind.config.js                         # Modify: colors.wc / fontFamily / shadow / radius 追加
app/Http/
└── Presenters/SessionViewPresenter.php     # Create: DB Session → handoff 形 への整形（データ契約）
```

> **Controller / route は本計画では作らない。** phase2.5（`OpenSessionController`）・phase3（`RatingController` 等）が所有する。本計画は各ページの「BE 接続契約」で **どの component を・どの props 形で render すべきか** を指定し、phase 側がそれに従う。
>
> **参照元:** B-1/B-2/B-3 の「本文」は `handoff/resources/...` に `.jsx` で既にある。本計画は **TSX 化の差分（型シグネチャ・import・型注釈）** を完全に示し、長い JSX 本文は「handoff の該当ファイルから貼り付け」と指示する。Complete / Ratings / Checklist / Partner/SessionDetail は handoff に無いため、基盤の部品・トークンを使って **Calm Blue で新規にデザインしたコード**を本計画に全文掲載する。

---

## Task 1: FE 基盤① — Tailwind トークン / フォント / vite の .tsx 対応

**Files:**
- Modify: `tailwind.config.js`
- Modify: `resources/views/app.blade.php`

**Interfaces:**
- Produces: Tailwind クラス `bg-wc-bg` `text-wc-ink` `bg-wc-blue` `shadow-card` `rounded-card` `font-en` 等／`@vite` が `.tsx` と `.jsx` の両方を解決できる状態。以降の全 Task がこれに依存。

- [ ] **Step 1: `tailwind.config.js` に WC トークンを追加**

`handoff/tailwind.config.js` の内容で既存の `tailwind.config.js` を**置き換える**（`content` 配列は handoff 側に `./resources/js/**/*.{jsx,tsx}` が入っており既存と同等。`colors.wc` / `fontFamily.sans` / `fontFamily.en` / `boxShadow.card` 系 / `borderRadius.card` が追加される）。

差分の要点（handoff 版が持つもの）:

```js
// theme.extend に以下が入る
colors: { wc: { bg:'#F5F7FB', ink:'#0E2156', navy:'#002D7A', /* ...handoff 参照... */ } },
fontFamily: {
    sans: ['"Zen Kaku Gothic New"', '"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans],
    en: ['"Plus Jakarta Sans"', 'sans-serif'],
},
boxShadow: { card:'...', 'card-hover':'...', chip:'...', 'chip-on':'...' },
borderRadius: { card: '18px' },
```

> 注意: `fontFamily.sans` が Zen Kaku Gothic New になるため、Breeze 認証画面のフォントも変わる（トーン統一のため意図どおり）。

- [ ] **Step 2: `app.blade.php` のフォントを差し替え**

`<head>` のフォント `<link>` を handoff 版に置き換える:

```html
<link rel="preconnect" href="https://fonts.bunny.net">
<link href="https://fonts.bunny.net/css?family=plus-jakarta-sans:400,600,700,800|zen-kaku-gothic-new:400,500,700,900&display=swap" rel="stylesheet" />
```

- [ ] **Step 3: `@vite` の glob を `.tsx` 対応にする（重要）**

handoff 版 `app.blade.php` は `.jsx` 固定（`...{$page['component']}.jsx`）。本プロジェクトは `.tsx` ページを使うため、**page コンポーネントの拡張子指定を削除**し、`app.jsx` 側の `resolvePageComponent` に解決を任せる。`@vite` 行を次に変更:

```php
@routes
@viteReactRefresh
@vite('resources/js/app.jsx')
@inertiaHead
```

そのうえで `resources/js/app.jsx` の `resolvePageComponent` が `.tsx` を含む glob になっているか確認する。なっていなければ次のように修正:

```js
resolvePageComponent(
    [`./Pages/${name}.tsx`, `./Pages/${name}.jsx`],
    import.meta.glob('./Pages/**/*.{jsx,tsx}'),
),
```

> Breeze 既定は `./Pages/${name}.jsx` と `*.jsx` glob のことが多い。`.tsx` ページ（`Dashboard/Member.tsx` 等）が読めていない場合はここが原因。上の配列指定で `.tsx` を先に試し、無ければ `.jsx`（Breeze 認証画面等の既存ページ）にフォールバックする。

- [ ] **Step 4: 動作確認**

```bash
docker compose exec app npm run dev
# 別シェルで
docker compose exec app npm run build
```

Expected: ビルドがエラーなく完了（トークン未使用のためこの時点では見た目変化なし。tailwind のクラス解決エラーが出ないことを確認）。

- [ ] **Step 5: コミット**

```bash
git add tailwind.config.js resources/views/app.blade.php resources/js/app.jsx
git commit -m "feat(frontend): add WorldClass design tokens, fonts, and tsx vite resolution"
```

---

## Task 2: FE 基盤② — 共有型と動的トークン（TSX 化の起点）

**Files:**
- Create: `resources/js/types/session.ts`
- Create: `resources/js/Components/WorldClass/theme.ts`

**Interfaces:**
- Produces:
  - `SessionSummary`（B-1/B-2/B-3 カードで使う1セッションの型）
  - `SessionDetail` / `MyPageData`（B-2 / B-3 付帯情報の型）
  - `SessionTheme = '文化交流' | '国際理解' | '英語学習'`
  - `WC_THEMES: Record<SessionTheme, ThemeToken>` / `WC_ART_TONES: Record<string, string>`
- これ以降の全 `.tsx` がこの型を import する。

- [ ] **Step 1: 共有型を作成**

`resources/js/types/session.ts`:

```ts
export type SessionTheme = '文化交流' | '国際理解' | '英語学習';

// Presenter が返す実契約に合わせた2値。成立までの残数は groups / minGroups から導出する。
// StatusPill は 'confirmed' のみを判定し、'open' は「あとn組で成立」を描画する。
export type SessionStatus = 'confirmed' | 'open';

export interface SessionSummary {
    id: number | string;
    country: string;       // 日本語表記（例: 'ケニア'）
    school: string;
    theme: SessionTheme;
    title: string;
    date: string;          // JST 整形済み '6/13'
    dow: string;           // '土'
    time: string;          // '10:00'
    mins: number;
    price: number;
    ages: string;          // '小1〜小6'
    groups: number;        // 申込済グループ数（pending+confirmed）
    minGroups: number;
    maxGroups: number;
    status: SessionStatus;
    rating: number;
    art: string;           // WC_ART_TONES のキー
    desc: string;
}

export interface AgendaItem { t: string; label: string; note: string }
export interface SupplyItem { date: string; body: string; ph: string }

export interface SessionDetail {
    sessionId: string | number;
    video: string;
    teacher: string;
    facilitator: string;
    supplies: SupplyItem[];
    agenda: AgendaItem[];
}

export type StepState = 'done' | 'now' | 'todo';
export interface PrepStep { label: string; note: string; state: StepState }
export interface HistoryItem { country: string; title: string; date: string; rated: number }

export interface MyPageData {
    user: string;
    next: { sessionId: string | number; daysLeft: number; steps: PrepStep[]; questions: string[] };
    history: HistoryItem[];
    support: {
        total: number; sessions: number;
        latest: { school: string; body: string; date: string; ph: string };
    };
}
```

- [ ] **Step 2: 動的トークンを TSX 化**

`resources/js/Components/WorldClass/theme.ts`（`handoff/.../theme.js` を型付きで移植）:

```ts
import type { SessionTheme } from '@/types/session';

interface ThemeToken { color: string; bg: string; pill: string }

export const WC_THEMES: Record<SessionTheme, ThemeToken> = {
    文化交流: { color: '#FF651E', bg: '#FFE3D2', pill: 'bg-wc-orange-bg text-wc-orange' },
    国際理解: { color: '#0043C3', bg: '#D6E6FF', pill: 'bg-wc-blue-soft text-wc-blue-deep' },
    英語学習: { color: '#A36500', bg: '#FFEFD2', pill: 'bg-wc-cream text-wc-amber' },
};

export const WC_ART_TONES: Record<string, string> = {
    kenya: '#9CB9FF', bhutan: '#FFD98C', morocco: '#F3D9F1',
    timor: '#BFE3D2', ghana: '#FFD2BC', tunisia: '#CFE0FF',
};
```

- [ ] **Step 3: 型チェック**

```bash
docker compose exec app npx tsc --noEmit
```

Expected: エラーなし（`@/types/...` のパスエイリアスが解決できること。解決しない場合は `tsconfig.json` の `paths` に `"@/*": ["resources/js/*"]` があるか確認）。

- [ ] **Step 4: コミット**

```bash
git add resources/js/types/session.ts resources/js/Components/WorldClass/theme.ts
git commit -m "feat(frontend): add shared session types and themed design tokens (tsx)"
```

---

## Task 3: FE 基盤③ — 原子部品の TSX 化（Logo / Placeholder / ProgressBar / Stars / Pill）

**Files:**
- Create: `resources/js/Components/WorldClass/WCLogoMark.tsx`
- Create: `resources/js/Components/WorldClass/Placeholder.tsx`
- Create: `resources/js/Components/WorldClass/ProgressBar.tsx`
- Create: `resources/js/Components/WorldClass/Stars.tsx`
- Create: `resources/js/Components/WorldClass/Pill.tsx`

**Interfaces:**
- Produces:
  - `WCLogoMark({ size?: number })`
  - `Placeholder({ label, tone?, ratio?, radius?, icon?, className?, style? })`
  - `ProgressBar({ value: number, max: number, className?: string })`
  - `Stars({ value: number, size?: number, color?: string })`
  - `Pill({ className?, style?, children })` / `ThemePill({ theme, floating? })` / `StatusPill({ session, floating? })`

- [ ] **Step 1: `WCLogoMark.tsx`**

`handoff/.../WCLogoMark.jsx` の本文をそのまま使い、シグネチャに型を付ける:

```tsx
export default function WCLogoMark({ size = 28 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="14" fill="#0059FF" />
            <ellipse cx="16" cy="16" rx="6.5" ry="14" fill="none" stroke="#fff" strokeWidth="2" />
            <line x1="2" y1="16" x2="30" y2="16" stroke="#fff" strokeWidth="2" />
            <circle cx="23" cy="9" r="4.5" fill="#FFA801" stroke="#FBF8F2" strokeWidth="1.5" />
        </svg>
    );
}
```

- [ ] **Step 2: `ProgressBar.tsx`**

```tsx
interface Props { value: number; max: number; className?: string }

export default function ProgressBar({ value, max, className = '' }: Props) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    return (
        <span className={'block h-1.5 overflow-hidden rounded-full bg-[#E8EEF9] ' + className}>
            <span className="block h-full rounded-full bg-wc-blue" style={{ width: pct + '%' }} />
        </span>
    );
}
```

- [ ] **Step 3: `Stars.tsx`**

```tsx
interface Props { value: number; size?: number; color?: string }

export default function Stars({ value, size = 13, color = '#FFA801' }: Props) {
    return (
        <span className="inline-flex items-center gap-px">
            {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} width={size} height={size} viewBox="0 0 20 20">
                    <path
                        d="M10 1.6l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L10 14.2 4.9 17l1.1-5.6L1.8 7.5l5.7-.7z"
                        fill={i <= Math.round(value) ? color : '#E7E2D6'}
                    />
                </svg>
            ))}
        </span>
    );
}
```

- [ ] **Step 4: `Placeholder.tsx`**

`handoff/.../Placeholder.jsx` の本文をそのまま使い、型付き Props にする:

```tsx
import { useId, type CSSProperties } from 'react';

interface Props {
    label: string;
    tone?: string;
    ratio?: string;
    radius?: number;
    icon?: 'play';
    className?: string;
    style?: CSSProperties;
}

export default function Placeholder({
    label, tone = '#D6E6FF', ratio, radius = 16, icon, className = '', style,
}: Props) {
    const patternId = 'ph' + useId().replace(/[^a-zA-Z0-9]/g, '');
    // 以降の return（svg パターン + ラベル描画）は handoff/.../Placeholder.jsx の 13〜57 行を貼り付け
    // （JSX 本文は型変更不要。そのままコピーで動く）
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
            {/* handoff の <svg>...</svg> と <div className="absolute inset-0 ...">...</div> をそのまま貼る */}
        </div>
    );
}
```

- [ ] **Step 5: `Pill.tsx`（Pill / ThemePill / StatusPill）**

`StatusPill` は `SessionSummary` の `status` / `minGroups` / `groups` のみ使う。型を付ける:

```tsx
import { type CSSProperties, type ReactNode } from 'react';
import type { SessionSummary, SessionTheme } from '@/types/session';
import { WC_THEMES } from '@/Components/WorldClass/theme';

export function Pill({ className = '', style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
    return (
        <span
            className={'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-extrabold ' + className}
            style={style}
        >
            {children}
        </span>
    );
}

export function ThemePill({ theme, floating = false }: { theme: SessionTheme; floating?: boolean }) {
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

export function StatusPill({ session, floating = false }: { session: Pick<SessionSummary, 'status' | 'minGroups' | 'groups'>; floating?: boolean }) {
    const confirmed = session.status === 'confirmed';
    const label = confirmed ? '● 開催確定' : `あと${session.minGroups - session.groups}組で成立`;
    const tone = confirmed ? 'text-wc-green' : 'text-wc-warn';
    const bg = confirmed ? 'bg-wc-green-bg' : 'bg-wc-warn-bg';
    if (floating) {
        return <Pill className={'bg-white shadow-[0_2px_8px_rgba(22,41,91,0.12)] ' + tone}>{label}</Pill>;
    }
    return <Pill className={bg + ' ' + tone}>{label}</Pill>;
}
```

- [ ] **Step 6: 型チェック + コミット**

```bash
docker compose exec app npx tsc --noEmit
```

Expected: エラーなし。

```bash
git add resources/js/Components/WorldClass/{WCLogoMark,Placeholder,ProgressBar,Stars,Pill}.tsx
git commit -m "feat(frontend): port atomic WorldClass components to tsx"
```

---

## Task 4: FE 基盤④ — レイアウトとカード（WorldClassLayout / SessionCard）

**Files:**
- Create: `resources/js/Layouts/WorldClassLayout.tsx`
- Create: `resources/js/Components/WorldClass/SessionCard.tsx`

**Interfaces:**
- Consumes: Task 3 の部品、Task 2 の型・トークン
- Produces:
  - `WorldClassLayout({ active?, children })`（`active: 'sessions' | 'mypage' | ...`）
  - `SessionCard({ session: SessionSummary })`

- [ ] **Step 1: `WorldClassLayout.tsx`**

`handoff/.../WorldClassLayout.jsx` を移植。`usePage` の props 型と `children` 型を付ける:

```tsx
import { Link, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import WCLogoMark from '@/Components/WorldClass/WCLogoMark';

interface NavItem { key: string; label: string; route: string | null }

const NAV_ITEMS: NavItem[] = [
    { key: 'sessions', label: 'セッションをさがす', route: 'open-sessions.index' },
    { key: 'mypage', label: 'マイページ', route: 'mypage' },
    { key: 'reports', label: '物資支援レポート', route: null }, // TODO: ルート実装後に差し替え
    { key: 'help', label: '使い方', route: null },
];

interface PageProps { auth?: { user?: { name?: string } } }

export default function WorldClassLayout({ active, children }: { active?: string; children: ReactNode }) {
    const user = usePage<PageProps>().props.auth?.user;
    // 以降の return（header / nav / user ブロック / <main>）は handoff/.../WorldClassLayout.jsx の 17〜74 行をそのまま貼り付け。
    // route()・Link はそのまま動く（Ziggy の @routes が app.blade.php に必要 → Task 1 で確認済み）。
    return (
        <div className="min-h-screen bg-wc-bg font-sans text-wc-text antialiased" style={{ fontFeatureSettings: '"palt" 1' }}>
            {/* handoff 本文を貼る */}
            <main>{children}</main>
        </div>
    );
}
```

> `route()` は Ziggy のグローバル関数。TS で未定義エラーが出る場合は、`resources/js/` に型宣言を1つ用意する（次 Step）。

- [ ] **Step 2: `route()` のグローバル型を宣言（TS エラー回避）**

Breeze + Ziggy 環境で `route is not defined`（型）になる場合、`resources/js/types/global.d.ts` を作成:

```ts
import { route as routeFn } from 'ziggy-js';

declare global {
    // eslint-disable-next-line no-var
    const route: typeof routeFn;
}
export {};
```

> `ziggy-js` が devDependencies に無い場合は、最小限 `declare const route: (name: string, params?: unknown) => string;` でも可（追加パッケージ無しの制約を守る）。

- [ ] **Step 3: `SessionCard.tsx`**

```tsx
import { Link } from '@inertiajs/react';
import type { SessionSummary } from '@/types/session';
import Placeholder from '@/Components/WorldClass/Placeholder';
import ProgressBar from '@/Components/WorldClass/ProgressBar';
import { Pill, StatusPill, ThemePill } from '@/Components/WorldClass/Pill';
import { WC_ART_TONES } from '@/Components/WorldClass/theme';

export default function SessionCard({ session: s }: { session: SessionSummary }) {
    // return 本文は handoff/.../SessionCard.jsx の 11〜66 行をそのまま貼り付け（型変更不要）。
    return null; // ← handoff の JSX に置き換える
}
```

- [ ] **Step 4: 型チェック + コミット**

```bash
docker compose exec app npx tsc --noEmit
```

Expected: エラーなし。

```bash
git add resources/js/Layouts/WorldClassLayout.tsx resources/js/Components/WorldClass/SessionCard.tsx resources/js/types/global.d.ts
git commit -m "feat(frontend): port WorldClassLayout and SessionCard to tsx"
```

---

## Task 5: B-1 オープンセッション一覧（mock 表示でルートまで通す）

**Files:**
- Create: `resources/js/data/mockSessions.ts`
- Create: `resources/js/Pages/OpenSessions/Index.tsx`
- Create: `resources/js/Pages/OpenSessions/IndexPreview.tsx`（プレビュー専用・phase2.5 接続後に削除）
- Modify: `routes/web.php`（**暫定プレビュー用**ルート。phase2.5 Task9 の `OpenSessionController@index` が本実装で置き換える）

**BE 接続契約:**
- route: `open-sessions.index`（GET `/open-sessions`）
- controller: `OpenSessionController@index`（**phase2.5 Task9 が所有**）
- component: `OpenSessions/Index`
- props: `{ sessions: SessionSummary[] }`（Task 6 の `SessionViewPresenter::summary()` 配列）

**Interfaces:**
- Consumes: Task 2〜4 の型・部品・レイアウト
- Produces: `Index({ sessions: SessionSummary[] })`（props 必須）／`IndexPreview`（mock を明示的に渡すプレビュー専用ページ）。

- [ ] **Step 1: mock を TSX 用に移植**

`resources/js/data/mockSessions.ts`（`handoff/.../mockSessions.js` の3エクスポートを型付きで移植）:

```ts
import type { SessionSummary, SessionDetail, MyPageData } from '@/types/session';

export const mockSessions: SessionSummary[] = [
    // handoff/.../mockSessions.js の mockSessions 配列（6件）を貼り付け。
    // ※ status は 'confirmed' | 'open' の2値に直す。handoff の 'needs1' / 'needs2' は
    //    status: 'open' にし、groups / minGroups の値で「あとn組」を表現する（StatusPill の見た目は不変）。
];

export const mockDetail: SessionDetail = {
    // handoff の mockDetail をそのまま貼り付け
};

export const mockMyPage: MyPageData = {
    // handoff の mockMyPage をそのまま貼り付け
};
```

- [ ] **Step 2: `OpenSessions/Index.tsx`**

`handoff/.../Pages/Sessions/Index.jsx` を **`resources/js/Pages/OpenSessions/Index.tsx`** として移植（handoff のファイル名は `Sessions` だが、本プロジェクトでは `OpenSessions/` に置く）。`Chip` の props と Page props に型を付ける:

```tsx
import { Head } from '@inertiajs/react';
import { useMemo, useState, type ReactNode } from 'react';
import type { SessionSummary, SessionTheme } from '@/types/session';
import WorldClassLayout from '@/Layouts/WorldClassLayout';
import SessionCard from '@/Components/WorldClass/SessionCard';

const THEME_CHIPS: SessionTheme[] = ['文化交流', '国際理解', '英語学習'];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
    // handoff の Chip 本文（button）をそのまま貼り付け
    return null;
}

export default function Index({ sessions }: { sessions: SessionSummary[] }) {
    const [theme, setTheme] = useState<SessionTheme | null>(null);
    const filtered = useMemo(
        () => (theme ? sessions.filter((s) => s.theme === theme) : sessions),
        [sessions, theme],
    );
    // 以降の return（見出し / チップ / 絞り込み行 / 物資支援バナー / カードグリッド）は
    // handoff/.../Sessions/Index.jsx の 37〜86 行をそのまま貼り付け。
    return null;
}
```

- [ ] **Step 3: `OpenSessions/IndexPreview.tsx`（プレビュー専用・接続後に削除）**

Page 本体の props は必須なので、mock はプレビュー専用ページから明示的に渡す（BE の props 渡し忘れは即エラーで見える。code splitting により mock は Index 本体のチャンクに混ざらない）:

```tsx
import Index from './Index';
import { mockSessions } from '@/data/mockSessions';

export default function IndexPreview() {
    return <Index sessions={mockSessions} />;
}
```

- [ ] **Step 4: 暫定プレビュー用ルート（Controller は作らない）**

Controller は phase2.5 が所有する（[所有境界](#global-constraints) 参照）。FE 単体で見た目を確認するため、`routes/web.php` に**暫定の**クロージャルートだけ足し、プレビューページを render する:

```php
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    // 暫定プレビュー。phase2.5 Task9 の OpenSessionController@index が本実装で置き換える
    //（その際に IndexPreview.tsx とこのルートを削除する）。
    Route::get('/open-sessions', fn () => Inertia::render('OpenSessions/IndexPreview'))->name('open-sessions.index');
});
```

> phase2.5 Task9 を先に実装済みなら本 Step は不要（既にルート・Controller がある）。その場合は Task 6 へ進む。

- [ ] **Step 5: 動作確認**

```bash
docker compose exec app npm run dev
docker compose exec app php artisan serve   # or docker compose up
```

ブラウザで `/open-sessions` を開き、3列カードグリッドに6件・チップで絞り込みが効くことを確認。

- [ ] **Step 6: コミット**

```bash
git add resources/js/data/mockSessions.ts resources/js/Pages/OpenSessions/{Index,IndexPreview}.tsx routes/web.php
git commit -m "feat(open-sessions): add B-1 list page (tsx, mock data)"
```

---

## Task 6: データ整形層（Presenter）— B-1 を実データに接続

**Files:**
- Create: `app/Http/Presenters/SessionViewPresenter.php`
- Test: `tests/Integration/Presenters/SessionViewPresenterTest.php`

**Interfaces:**
- Consumes: `App\Models\Session`（`partner` ロード済み・`active_participants_count` 付き。phase2.5 Task3 の `OpenSessionRepositoryInterface::listVisible()` が返す形）
- Produces: `SessionViewPresenter::summary(Session $s): array`（handoff の `SessionSummary` と同形の連想配列）。phase2.5 `OpenSessionController@index`／phase3 のコントローラがこれを使って props を渡す。

> **所有境界:** Presenter は handoff の形に従う**データ契約**なので本 FE 計画が所有・テストする。これを使う Controller の差し替えは **phase2.5 側で行う**（本 Task Step 5 に契約として明記）。
>
> **前提:** `前提チェック` 節の `sessions.title` / `sessions.description` / `partners.rating` が存在すること。`art` 用カラムは無いため国名から推定する。

- [ ] **Step 1: 失敗する Presenter テストを書く（HTTP を介さず直接）**

`tests/Integration/Presenters/SessionViewPresenterTest.php`:

```php
<?php

namespace Tests\Integration\Presenters;

use App\Http\Presenters\SessionViewPresenter;
use App\Models\Member;
use App\Models\Partner;
use App\Models\Session;
use App\Models\SessionParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class SessionViewPresenterTest extends TestCase
{
    use RefreshDatabase;

    public function test_DBのSessionをhandoff形に整形する(): void
    {
        $partner = Partner::create([
            'user_id' => User::create(['name' => 'P', 'email' => 'p@example.com', 'password' => 'x', 'role' => 'partner'])->id,
            'provider_type' => 'overseas_school', 'display_name' => 'ナイロビ校',
            'country' => 'Kenya', 'region' => 'Nairobi', 'contact_name' => 'T',
            'status' => 'approved', 'themes' => ['culture'], 'grade_range' => '小1〜小6',
            'rating' => 4.8,
        ]);
        $session = Session::create([
            'partner_id' => $partner->id, 'session_type' => 'open',
            'scheduled_at' => Carbon::parse('2026-07-18 01:00:00', 'UTC'), // JST 2026-07-18(土) 10:00
            'duration_min' => 45, 'theme' => 'culture', 'title' => 'ケニアの学校生活',
            'description' => '朝の登校から…', 'capacity' => 6, 'min_groups' => 3,
            'with_facilitator' => true, 'price_jpy' => 2500, 'status' => 'open',
        ]);
        $member = Member::create([
            'user_id' => User::create(['name' => 'M', 'email' => 'm@example.com', 'password' => 'x', 'role' => 'member'])->id,
            'type' => 'family', 'prefecture' => '東京都', 'contact_name' => 'M',
        ]);
        SessionParticipant::create([
            'session_id' => $session->id, 'member_id' => $member->id,
            'status' => 'confirmed', 'price_paid' => 2500, 'support_amount' => 1250,
        ]);

        // listVisible() と同じく partner ロード＋残枠カウントを付与
        $session->loadCount(['participants as active_participants_count' => fn ($q) => $q->whereIn('status', ['pending', 'confirmed'])]);
        $session->load('partner');

        $out = (new SessionViewPresenter())->summary($session);

        $this->assertSame('ケニア', $out['country']);
        $this->assertSame('ナイロビ校', $out['school']);
        $this->assertSame('文化交流', $out['theme']);
        $this->assertSame('ケニアの学校生活', $out['title']);
        $this->assertSame(45, $out['mins']);
        $this->assertSame(2500, $out['price']);
        $this->assertSame(3, $out['minGroups']);
        $this->assertSame(6, $out['maxGroups']);
        $this->assertSame(1, $out['groups']);
        $this->assertSame('小1〜小6', $out['ages']);
        $this->assertSame('open', $out['status']);
        $this->assertSame('kenya', $out['art']);
        $this->assertSame('7/18', $out['date']);   // UTC 01:00 → JST で日付・曜日・時刻を固定検証
        $this->assertSame('土', $out['dow']);
        $this->assertSame('10:00', $out['time']);
    }
}
```

- [ ] **Step 2: 失敗確認**

```bash
docker compose exec app php artisan test tests/Integration/Presenters/SessionViewPresenterTest.php
```

Expected: FAIL（`SessionViewPresenter` 未定義）。

- [ ] **Step 3: Presenter を実装**

`app/Http/Presenters/SessionViewPresenter.php`:

```php
<?php

namespace App\Http\Presenters;

use App\Models\Session;

class SessionViewPresenter
{
    private const THEME_JA = [
        'culture' => '文化交流',
        'understanding' => '国際理解',
        'english' => '英語学習',
    ];

    private const COUNTRY_JA = [
        'Kenya' => 'ケニア', 'Bhutan' => 'ブータン', 'Morocco' => 'モロッコ',
        'Timor-Leste' => '東ティモール', 'Ghana' => 'ガーナ', 'Tunisia' => 'チュニジア',
    ];

    private const ART_TONE = [
        'Kenya' => 'kenya', 'Bhutan' => 'bhutan', 'Morocco' => 'morocco',
        'Timor-Leste' => 'timor', 'Ghana' => 'ghana', 'Tunisia' => 'tunisia',
    ];

    private const DOW_JA = ['日', '月', '火', '水', '木', '金', '土'];

    /** DB の Session を handoff（SessionSummary）形に整形する */
    public function summary(Session $s): array
    {
        $jst = $s->scheduled_at->copy()->setTimezone('Asia/Tokyo');
        $groups = (int) ($s->active_participants_count ?? 0);
        $confirmed = $groups >= $s->min_groups
            || in_array($s->status, ['confirmed', 'ready'], true);

        return [
            'id' => $s->id,
            'country' => self::COUNTRY_JA[$s->partner->country] ?? $s->partner->country,
            'school' => $s->partner->display_name,
            'theme' => self::THEME_JA[$s->theme] ?? $s->theme,
            'title' => $s->title,
            'date' => $jst->format('n/j'),
            'dow' => self::DOW_JA[(int) $jst->dayOfWeek],
            'time' => $jst->format('H:i'),
            'mins' => (int) $s->duration_min,
            'price' => (int) $s->price_jpy,
            'ages' => $s->partner->grade_range,
            'groups' => $groups,
            'minGroups' => (int) $s->min_groups,
            'maxGroups' => (int) $s->capacity,
            'status' => $confirmed ? 'confirmed' : 'open',
            'rating' => (float) ($s->partner->rating ?? 0),
            'art' => self::ART_TONE[$s->partner->country] ?? 'kenya',
            'desc' => (string) $s->description,
        ];
    }
}
```

- [ ] **Step 4: テスト通過確認**

```bash
docker compose exec app php artisan test tests/Integration/Presenters/SessionViewPresenterTest.php
```

Expected: PASS。

- [ ] **Step 5: phase2.5 コントローラへの接続（BE 接続契約）**

実データ表示は **phase2.5 `OpenSessionController@index`** が Presenter を使う形に変わることで実現する。phase2.5 計画 Task9（後述の差し替え）でこの import を行う。FE 計画側で実装するコードではないが、契約として記す:

```php
use App\Http\Presenters\SessionViewPresenter;

public function index(
    OpenSessionRepositoryInterface $repository,
    SessionViewPresenter $presenter,
): Response {
    $sessions = $repository->listVisible()
        ->map(fn ($s) => $presenter->summary($s))
        ->all();

    return Inertia::render('OpenSessions/Index', ['sessions' => $sessions]); // 暫定ルートと IndexPreview.tsx は削除
}
```

> phase2.5 が未実装の段階では、Task 5 の暫定プレビュールート（mock 表示）のままでよい。phase2.5 Task9 実装時に上記へ差し替え、暫定ルートと `IndexPreview.tsx` を削除する。
>
> **一覧は当面ページネーションなしの全件表示とする**（ローンチ初期はセッション数が少ないため）。件数が増えた時点で `{ sessions, pagination }` 契約への拡張を別途検討する。

- [ ] **Step 6: コミット**

```bash
git add app/Http/Presenters/SessionViewPresenter.php tests/Integration/Presenters/SessionViewPresenterTest.php
git commit -m "feat(presenter): add SessionViewPresenter (DB session → handoff shape contract)"
```

---

## Task 7: B-2 オープンセッション詳細・申込（Show）

**Files:**
- Create: `resources/js/Pages/OpenSessions/Show.tsx`
- Create: `resources/js/Pages/OpenSessions/ShowPreview.tsx`（プレビュー専用・phase2.5 接続後に削除）
- Modify: `routes/web.php`（**暫定プレビュー用**。phase2.5 の `OpenSessionController@show` が本実装で置き換える）

**BE 接続契約:**
- route: `open-sessions.show`（GET `/open-sessions/{id}`）
- controller: `OpenSessionController@show`（**phase2.5 が所有**。新規追加メソッド。`findOpenSession($id)` → 404 / `SessionViewPresenter::summary()` で `session` props・`detail` は当面省略＝mock）
- component: `OpenSessions/Show`
- props: `{ session: SessionSummary; detail?: SessionDetail }`
- 申込ボタン: POST `open-sessions.apply`（**phase2.5 Task9 が所有**）へ送る。`router.post(route('open-sessions.apply', s.id))`。

> **申込ボタンの遷移先（B-4〜B-6 / 決済）は phase2.5 の `apply` が担う。** phase2.5 未実装の間は handoff どおり `type="button"`（遷移なし）のまま置き、TODO コメントを残す。実装後に `router.post` に差し替える。

- [ ] **Step 1: `OpenSessions/Show.tsx`**

`handoff/.../Pages/Sessions/Show.jsx` を **`resources/js/Pages/OpenSessions/Show.tsx`** として移植。props と `tab` state に型を付ける:

```tsx
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import type { SessionSummary, SessionDetail } from '@/types/session';
import WorldClassLayout from '@/Layouts/WorldClassLayout';
import Placeholder from '@/Components/WorldClass/Placeholder';
import ProgressBar from '@/Components/WorldClass/ProgressBar';
import Stars from '@/Components/WorldClass/Stars';
import { Pill, StatusPill, ThemePill } from '@/Components/WorldClass/Pill';
import { WC_ART_TONES } from '@/Components/WorldClass/theme';
import { mockDetail } from '@/data/mockSessions';

const TABS = ['セッション内容', 'パートナー紹介', '物資支援の実績', 'よくある質問'];

// session は必須。detail は供給元未定のため当面 mock 既定のまま（BE 接続契約参照）
export default function Show({ session, detail = mockDetail }: { session: SessionSummary; detail?: SessionDetail }) {
    const s = session;
    const d = detail;
    const [tab, setTab] = useState<number>(0);
    const supportAmount = Math.round(s.price / 2);
    // 以降の return は handoff/.../Sessions/Show.jsx の 22〜184 行をそのまま貼り付け。
    return null;
}
```

- [ ] **Step 2: `OpenSessions/ShowPreview.tsx`（プレビュー専用・接続後に削除）**

```tsx
import Show from './Show';
import { mockSessions } from '@/data/mockSessions';

export default function ShowPreview() {
    return <Show session={mockSessions[0]} />;
}
```

- [ ] **Step 3: 暫定プレビュー用ルート（Controller は作らない）**

Controller（`OpenSessionController@show`）は phase2.5 が所有・実装する。FE 単体確認用に、`routes/web.php` に暫定クロージャだけ足し、プレビューページを render する:

```php
Route::middleware('auth')->group(function () {
    // 暫定プレビュー。phase2.5 の OpenSessionController@show が本実装で置き換える
    //（その際に ShowPreview.tsx とこのルートを削除する）。
    Route::get('/open-sessions/{id}', fn () => Inertia::render('OpenSessions/ShowPreview'))
        ->whereNumber('id')->name('open-sessions.show');
});
```

> 実データ接続（`findOpenSession($id)` → 404 / Presenter で `session` props）と Feature テストは **phase2.5 の `OpenSessionController@show`** 側で行う（本 Task の「BE 接続契約」に従う）。`detail`（動画・先生・物資・アジェンダ）は供給元未定のため当面 mock 表示のまま。

- [ ] **Step 4: ブラウザ確認 + コミット**

`/open-sessions/1` を開き、左カラム（プレースホルダー動画・タブ・アジェンダ）と右カラム（申込カード・先生・物資）が mock で出ることを確認。

```bash
git add resources/js/Pages/OpenSessions/{Show,ShowPreview}.tsx routes/web.php
git commit -m "feat(open-sessions): add B-2 detail page (tsx, mock data)"
```

---

## Task 8: B-3 マイページ（mock 表示）

**Files:**
- Create: `resources/js/Pages/MyPage/Index.tsx`
- Create: `resources/js/Pages/MyPage/IndexPreview.tsx`（プレビュー専用・phase3 接続後に削除）
- Modify: `routes/web.php`

**Interfaces:**
- Consumes: Task 2〜4 の型・部品・レイアウト、`mockMyPage` / `mockSessions`
- Produces: `route('mypage')`。`Index({ mypage: MyPageData; nextSession: SessionSummary })`（props 必須）／`IndexPreview`（mock を明示的に渡すプレビュー専用ページ）。

> マイページの実データ化は **phase3（準備フロー）** の範囲。ここでは mock 表示までを作り、phase3 で `MyPageData` を返す Presenter/Controller を実装する（その際もこの Page はコード変更不要）。

- [ ] **Step 1: `MyPage/Index.tsx`**

`handoff/.../Pages/MyPage/Index.jsx` を移植。`STEP_STYLES` のキーを `StepState` に、props に型を付ける:

```tsx
import { Head } from '@inertiajs/react';
import type { ReactNode } from 'react';
import type { MyPageData, SessionSummary, StepState } from '@/types/session';
import WorldClassLayout from '@/Layouts/WorldClassLayout';
import Placeholder from '@/Components/WorldClass/Placeholder';
import Stars from '@/Components/WorldClass/Stars';
import { Pill, StatusPill, ThemePill } from '@/Components/WorldClass/Pill';
import { WC_ART_TONES } from '@/Components/WorldClass/theme';

const STEP_STYLES: Record<StepState, string> = {
    done: 'bg-wc-green-bg text-wc-green',
    now: 'bg-wc-warn-bg text-wc-warn',
    todo: 'bg-[#F0F3FA] text-wc-muted',
};

function CardLabel({ children }: { children: ReactNode }) {
    return <div className="mb-3 text-[11.5px] font-extrabold tracking-wider text-wc-muted">{children}</div>;
}

export default function Index({ mypage, nextSession }: { mypage: MyPageData; nextSession: SessionSummary }) {
    const m = mypage;
    const s = nextSession;
    // 以降の return は handoff/.../MyPage/Index.jsx の 26〜194 行をそのまま貼り付け。
    return null;
}
```

- [ ] **Step 2: `MyPage/IndexPreview.tsx`（プレビュー専用・接続後に削除）**

```tsx
import Index from './Index';
import { mockMyPage, mockSessions } from '@/data/mockSessions';

export default function IndexPreview() {
    return <Index mypage={mockMyPage} nextSession={mockSessions[0]} />;
}
```

- [ ] **Step 3: ルート**

`routes/web.php`（auth グループ内）。phase3 で実データの Presenter/Controller を実装する際に、`MyPage/Index` の render へ差し替えて `IndexPreview.tsx` を削除する:

```php
use Inertia\Inertia;

Route::get('/mypage', fn () => Inertia::render('MyPage/IndexPreview'))->name('mypage');
```

- [ ] **Step 4: ブラウザ確認 + コミット**

`/mypage` を開き、実績サマリー3枚・準備ステップ（done/now/todo の色分け）・質問リスト・物資レポート・履歴が出ることを確認。

```bash
git add resources/js/Pages/MyPage/{Index,IndexPreview}.tsx routes/web.php
git commit -m "feat(mypage): add B-3 my page (tsx, mock data)"
```

---

## Task 9: B-6 申込完了（OpenSessions/Complete.tsx・Calm Blue 新規design）

handoff に無いため、基盤の部品・トークンで新規にデザインする。phase2.5 の `OpenSessionController@complete` から render される。

**Files:**
- Create: `resources/js/Pages/OpenSessions/Complete.tsx`

**BE 接続契約:**
- route: `open-sessions.complete`（**phase2.5 Task9 が所有**。Stripe 決済成功後の戻り先）
- component: `OpenSessions/Complete`
- props: `{ participantId: number; scheduledAt: string }`（ISO8601。表示時に JST 整形）

- [ ] **Step 1: `Complete.tsx`**

```tsx
import { Head, Link } from '@inertiajs/react';
import WorldClassLayout from '@/Layouts/WorldClassLayout';

export default function Complete({ participantId, scheduledAt }: { participantId: number; scheduledAt: string }) {
    const dt = new Date(scheduledAt).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
    return (
        <WorldClassLayout active="mypage">
            <Head title="申込が完了しました" />
            <div className="mx-auto max-w-[560px] px-5 pb-16 pt-12 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-wc-green-bg text-2xl font-extrabold text-wc-green">✓</div>
                <h1 className="text-[26px] font-black tracking-tight text-wc-ink">申込が完了しました</h1>
                <p className="mt-2 text-[13.5px] font-medium text-wc-soft">3グループ以上で開催が確定し、メールでお知らせします。</p>
                <div className="mt-6 rounded-card bg-white p-6 text-left shadow-card">
                    <div className="flex items-center justify-between border-b border-wc-hair py-2.5 text-[13.5px] font-semibold text-wc-body">
                        <span>申込番号</span>
                        <span className="font-en font-extrabold text-wc-ink">#{participantId}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5 text-[13.5px] font-semibold text-wc-body">
                        <span>開催日時</span>
                        <span className="font-extrabold text-wc-ink">{dt}</span>
                    </div>
                </div>
                <Link href={route('mypage')} className="mt-6 inline-flex h-[50px] items-center justify-center rounded-xl bg-wc-blue px-8 text-[15px] font-bold text-white transition hover:bg-wc-blue-deep">
                    マイページへ
                </Link>
            </div>
        </WorldClassLayout>
    );
}
```

- [ ] **Step 2: 確認 + コミット**

phase2.5 未実装の間は暫定ルート（`Inertia::render('OpenSessions/Complete', ['participantId' => 1, 'scheduledAt' => now()->toIso8601String()])`）で見た目を確認。

```bash
docker compose exec app npx tsc --noEmit
git add resources/js/Pages/OpenSessions/Complete.tsx
git commit -m "feat(open-sessions): add B-6 application complete page (tsx, calm blue)"
```

---

## Task 10: B-9 評価フォーム（Ratings/Create.tsx・Calm Blue 新規design）

phase3 の `RatingController@create` から render。星はクリック可能な inline 実装（表示専用の `Stars` とは別物）。

**Files:**
- Create: `resources/js/Pages/Ratings/Create.tsx`

**BE 接続契約:**
- route: 表示 `ratings.create`（GET）／送信 `ratings.store`（POST `/participants/{participant}/rating`）。**phase3 Task8 が所有**。
- component: `Ratings/Create`
- props: `{ participantId: number; scheduledAt: string; partnerName: string }`
- 送信フィールド: `{ rating_score: number(1-5); rating_comment: string }`

- [ ] **Step 1: `Create.tsx`**

```tsx
import { Head, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import WorldClassLayout from '@/Layouts/WorldClassLayout';

interface Props { participantId: number; scheduledAt: string; partnerName: string }

export default function Create({ participantId, scheduledAt, partnerName }: Props) {
    const { data, setData, post, processing, errors } = useForm({ rating_score: 5, rating_comment: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('ratings.store', participantId));
    };

    return (
        <WorldClassLayout active="mypage">
            <Head title="セッションの評価" />
            <div className="mx-auto max-w-[560px] px-5 pb-16 pt-10">
                <h1 className="text-[26px] font-black tracking-tight text-wc-ink">セッションの評価</h1>
                <p className="mt-1 text-[13.5px] font-medium text-wc-soft">
                    {partnerName} · {new Date(scheduledAt).toLocaleDateString('ja-JP')}
                </p>
                <form onSubmit={submit} className="mt-6 rounded-card bg-white p-6 shadow-card">
                    <div className="mb-2 text-[11.5px] font-extrabold tracking-wider text-wc-muted">準備の満足度</div>
                    <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setData('rating_score', n)}
                                aria-label={`${n}つ星`}
                                className="text-3xl leading-none transition"
                                style={{ color: n <= data.rating_score ? '#FFA801' : '#E7E2D6' }}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                    {errors.rating_score && <p className="mt-1 text-xs font-bold text-wc-warn">{errors.rating_score}</p>}

                    <div className="mb-2 mt-5 text-[11.5px] font-extrabold tracking-wider text-wc-muted">コメント（任意）</div>
                    <textarea
                        value={data.rating_comment}
                        onChange={(e) => setData('rating_comment', e.target.value)}
                        rows={4}
                        className="w-full rounded-xl border border-wc-border px-3.5 py-2.5 text-[14px] text-wc-text focus:border-wc-blue focus:ring-wc-blue"
                    />
                    {errors.rating_comment && <p className="mt-1 text-xs font-bold text-wc-warn">{errors.rating_comment}</p>}

                    <button
                        type="submit"
                        disabled={processing}
                        className="mt-5 inline-flex h-[50px] w-full items-center justify-center rounded-xl bg-wc-blue text-[15px] font-bold text-white transition hover:bg-wc-blue-deep disabled:opacity-50"
                    >
                        評価を送信する
                    </button>
                </form>
            </div>
        </WorldClassLayout>
    );
}
```

- [ ] **Step 2: 型チェック + コミット**

```bash
docker compose exec app npx tsc --noEmit
git add resources/js/Pages/Ratings/Create.tsx
git commit -m "feat(ratings): add B-9 rating form page (tsx, calm blue)"
```

---

## Task 11: 当日チェックリスト（Sessions/Checklist.tsx・静的・Calm Blue）

静的ページ。phase3 の `session-checklist` ルート（`Inertia::render('Sessions/Checklist')`）から render。**`OpenSessions/` ではなく `Sessions/` 配下に置くのは意図的**（チェックリストは将来の団体（group）セッションでも共用する汎用ページのため。Global Constraints のリネーム規則の例外）。

**Files:**
- Create: `resources/js/Pages/Sessions/Checklist.tsx`

**BE 接続契約:**
- route: `session-checklist`（GET・**phase3 Task9 が所有**）
- component: `Sessions/Checklist`
- props: なし（静的）

- [ ] **Step 1: `Checklist.tsx`**

```tsx
import { Head } from '@inertiajs/react';
import WorldClassLayout from '@/Layouts/WorldClassLayout';

const ITEMS = [
    'カメラ・マイクの動作を確認した',
    'Zoom アプリを最新版に更新した',
    '静かで明るい場所を用意した',
    '質問リストを手元に準備した',
    '開始5分前にはオンラインで待機する',
];

export default function Checklist() {
    return (
        <WorldClassLayout active="mypage">
            <Head title="当日のチェックリスト" />
            <div className="mx-auto max-w-[640px] px-5 pb-16 pt-10">
                <h1 className="text-[26px] font-black tracking-tight text-wc-ink">当日のチェックリスト</h1>
                <p className="mt-1 text-[13.5px] font-medium text-wc-soft">セッション前にこの項目を確認してください。</p>
                <div className="mt-6 rounded-card bg-white px-6 shadow-card">
                    {ITEMS.map((it, i) => (
                        <div
                            key={i}
                            className={'flex items-center gap-3 py-3.5 text-[14px] font-semibold text-wc-text ' + (i < ITEMS.length - 1 ? 'border-b border-wc-hair' : '')}
                        >
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-wc-blue-pale text-[11px] font-extrabold text-wc-blue-deep">
                                {i + 1}
                            </span>
                            {it}
                        </div>
                    ))}
                </div>
            </div>
        </WorldClassLayout>
    );
}
```

- [ ] **Step 2: 型チェック + コミット**

```bash
docker compose exec app npx tsc --noEmit
git add resources/js/Pages/Sessions/Checklist.tsx
git commit -m "feat(sessions): add day-of checklist page (tsx, calm blue)"
```

---

## Task 12: パートナー質問閲覧・ready（Partner/SessionDetail.tsx・Calm Blue・日本語化）

phase3 の素実装は **UI 文言が英語**（全日本語ルール違反）。Calm Blue ＋日本語で作り直す。phase3 の `SessionReadyController@show` から render。

**Files:**
- Create: `resources/js/Pages/Partner/SessionDetail.tsx`

**BE 接続契約:**
- route: 表示 `partner.sessions.show`（GET `/partner/sessions/{session}`）／ready 送信は POST `/partner/sessions/{session}/ready`。**phase3 Task9 が所有**。
- component: `Partner/SessionDetail`
- props: `{ session: { id: number; scheduledAt: string; status: string; questions: { id: number; questionList: string }[] } }`（DB の snake_case → camelCase 変換は phase3 の Controller 側の責務。props 命名は全ページ camelCase に統一）

- [ ] **Step 1: `SessionDetail.tsx`**

```tsx
import { Head, router } from '@inertiajs/react';
import WorldClassLayout from '@/Layouts/WorldClassLayout';

interface Props {
    session: {
        id: number;
        scheduledAt: string;
        status: string;
        questions: { id: number; questionList: string }[];
    };
}

export default function SessionDetail({ session }: Props) {
    const markReady = () => router.post(`/partner/sessions/${session.id}/ready`);
    const dt = new Date(session.scheduledAt).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });

    return (
        <WorldClassLayout>
            <Head title="セッション詳細（パートナー）" />
            <div className="mx-auto max-w-[640px] px-5 pb-16 pt-10">
                <h1 className="text-[22px] font-black tracking-tight text-wc-ink">セッション詳細</h1>
                <p className="mt-1 text-[13.5px] font-medium text-wc-soft">{dt}</p>

                <div className="mt-6 text-[11.5px] font-extrabold tracking-wider text-wc-muted">参加者からの質問</div>
                {session.questions.length === 0 && (
                    <p className="mt-3 text-[13.5px] font-semibold text-wc-muted">まだ質問はありません。</p>
                )}
                <div className="mt-3 flex flex-col gap-2.5">
                    {session.questions.map((q) => (
                        <div key={q.id} className="whitespace-pre-wrap rounded-card bg-white p-4 text-[13.5px] font-semibold leading-relaxed text-wc-text shadow-card">
                            {q.questionList}
                        </div>
                    ))}
                </div>

                {session.status === 'confirmed' && (
                    <button
                        onClick={markReady}
                        className="mt-6 inline-flex h-[50px] items-center justify-center rounded-xl bg-wc-green px-8 text-[15px] font-bold text-white transition hover:opacity-90"
                    >
                        準備完了にする
                    </button>
                )}
                {session.status === 'ready' && (
                    <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-wc-green-bg px-4 py-2.5 text-[13.5px] font-bold text-wc-green">
                        ✓ 準備完了済み
                    </div>
                )}
            </div>
        </WorldClassLayout>
    );
}
```

- [ ] **Step 2: 型チェック + コミット**

```bash
docker compose exec app npx tsc --noEmit
git add resources/js/Pages/Partner/SessionDetail.tsx
git commit -m "feat(partner): add session detail page (tsx, calm blue, ja)"
```

---

## Task 13: レスポンシブ対応・仕上げ

**Files:**
- Modify: `resources/js/Pages/OpenSessions/Index.tsx`
- Modify: `resources/js/Pages/OpenSessions/Show.tsx`
- Modify: `resources/js/Pages/MyPage/Index.tsx`
- Modify: `resources/js/Layouts/WorldClassLayout.tsx`

**Interfaces:**
- Consumes: Task 5/7/8 の3ページ（Complete/Rating/Checklist/PartnerDetail は単一カラムのため追加対応不要）
- Produces: モバイル（〜640px）で1列・タブレットで2列・デスクトップで3列になる一覧、縦積みになる詳細／マイページの2カラム、横スクロールしないヘッダー。

> handoff はデスクトップ固定（`grid-cols-3`・`grid-cols-[1fr_400px]`・`px-12`・固定幅ナビ）。スマホ閲覧を考慮し Tailwind の breakpoint を足す。**ロジックは変えず className のみ変更**。

- [ ] **Step 1: 一覧グリッドをレスポンシブ化**

`OpenSessions/Index.tsx` のカードグリッド:

```tsx
// before: <div className="grid grid-cols-3 gap-[22px]">
<div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
```

ページ左右パディングも `px-12` → `px-5 md:px-12` に。絞り込み行（`絞り込み：…`）は `flex-wrap` を付けて折り返す。

- [ ] **Step 2: 詳細・マイページの2カラムを縦積み対応に**

`OpenSessions/Show.tsx` / `MyPage/Index.tsx` の `grid-cols-[1fr_400px]` を:

```tsx
<div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[1fr_400px]">
```

外側コンテナの `px-10` → `px-5 md:px-10` に。

- [ ] **Step 3: ヘッダーをモバイル対応に**

`WorldClassLayout.tsx` の `<header>` の `px-10` → `px-5 md:px-10`。中央ナビ（`<nav>`）は狭幅で隠す:

```tsx
// <nav className="flex items-center gap-1 ...">
<nav className="hidden items-center gap-1 text-[13.5px] font-bold md:flex">
```

> モバイル用ハンバーガーメニューは YAGNI（今は非表示で可）。必要になったら別途。

- [ ] **Step 4: 動作確認**

```bash
docker compose exec app npm run build
```

ブラウザの DevTools でビューポートを 375px / 768px / 1280px に変え、`/open-sessions` `/open-sessions/{id}` `/mypage` がそれぞれ1列 / 2列 / 3列・縦積み・横スクロールなしになることを確認。

- [ ] **Step 5: 型チェック + Pint + コミット**

```bash
docker compose exec app npx tsc --noEmit
docker compose exec app ./vendor/bin/pint
git add resources/js
git commit -m "feat(frontend): add responsive breakpoints to session and mypage screens"
```

---

## 未実装の画面（この計画の範囲外）

- B-4〜B-5: 会員登録 → 申込確認（Stripe Checkout 前段）。**phase2.5 の申込フロー**で扱う（B-6 完了は Task 9 で実装済み）。
- B-7〜B-8: 質問リスト作成 / 物資支援レポート。**phase3 / phase4** と接続。
- 団体（org）向け画面・海外パートナーダッシュボード一覧。

---

## phase 計画側で必要な対応（FE 計画が「正」になることに伴う差し替え）

本計画が member/partner 向け `.tsx` の唯一の正になったため、既存 phase 計画の FE ページ作成 Step は削除し、本計画を参照する形に差し替える（別途編集済み／要編集）:

- **phase2.5 Task10（旧 `OpenSessions/Index.tsx` / `Complete.tsx` 作成）→ 削除**。本計画 Task5/9 を参照。
- **phase2.5 Task9 `OpenSessionController@index`** → 素の snake_case map をやめ `SessionViewPresenter` で `OpenSessions/Index` を render（本計画 Task6 Step5 の契約）。`@show`（B-2 詳細）を新規追加。
- **phase3 Task8（`Ratings/Create.tsx` 作成）→ 削除**。本計画 Task10 を参照。Controller は据置。
- **phase3 Task9（`Sessions/Checklist.tsx` / `Partner/SessionDetail.tsx` 作成）→ 削除**。本計画 Task11/12 を参照。また `SessionReadyController@show` は props を camelCase（`scheduledAt` / `questionList`）へ変換して渡す（本計画 Task12 の BE 接続契約）。

---

## セルフレビュー（スペックカバレッジ）

- handoff 全15ファイル → TSX 取り込み: トークン/フォント(Task1)・型/動的トークン(Task2)・原子部品5種(Task3)・Layout/Card(Task4)・3ページ(Task5,7,8) ✅
- 言語ズレ（JSX→TSX）解消 → 各 Task で型シグネチャ付与・`tsc --noEmit` 検証 ✅
- パス命名 `OpenSessions/` 統一・ルート名 `open-sessions.index/show/complete`・`mypage`（phase2.5 準拠） ✅
- 二重実装の解消 → 所有境界（FE=ページ＋Presenter / BE=Controller・route）を Global Constraints に明記、各ページに「BE 接続契約」、phase 側差し替えを上節に列挙 ✅
- 計画に無かった部品ライブラリ/トークンを基盤 Task として新設 ✅
- データ契約ズレ → `SessionViewPresenter`（UTC→JST・theme/country/status マッピング・残枠 groups）で吸収、Presenter 直接テストで形を固定 ✅
- 散在 FE の統一 → Complete(Task9)・Rating(Task10)・Checklist(Task11)・PartnerDetail(Task12) を Calm Blue で本計画に集約、PartnerDetail の英語 UI を日本語化 ✅
- `app.blade.php` の `.jsx` 固定 → `.tsx` 解決へ修正（Task1 Step3）・Ziggy `route()` 型(Task4 Step2) ✅
- レスポンシブ未対応 → Task 13 で breakpoint 追加 ✅
- backend 前提（title/description/rating カラム）→ 「前提チェック」節で明示、FE 計画では実装しない境界を明確化 ✅

---

## 実装の進め方

本計画は**ハンズオン学習**用です（[[feedback-handson]]）。各 Task の Step を上から順に、**あなた自身がコードを書いて**進めてください。Claude は質問対応・差分提示・つまずきのデバッグ補助を行います。サブエージェントによる自動実行はしません。詰まったら「Task N の Step M を詳しく」と聞いてください。
