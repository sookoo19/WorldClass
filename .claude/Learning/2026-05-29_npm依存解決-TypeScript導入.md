# npm 依存関係の解決と TypeScript 導入

**日付**: 2026-05-29  
**会話の概要**: プランの見直し（Laravel バージョン表記ズレ修正）、npm の依存関係エラーを複数解決しながら TypeScript の開発環境を整えた。

---

## 今日学んだ概念

### npm の依存関係（peer dependency）エラー
- **何か**: パッケージ同士の「対応バージョン」が合わない状態
- **なぜ必要か**: ライブラリは「自分が動くには○○のバージョンが必要」と宣言している。そのバージョンが揃っていないとエラーになる
- **例え**: テレビのリモコン（plugin-react）は「テレビ（vite）の型番5〜7まで対応」と書いてある。型番8のテレビを買ってきたら使えない、というイメージ

### node_modules と package-lock.json の役割
- **何か**:
  - `node_modules/` = 実際にインストールされたパッケージの実体（大量のファイル）
  - `package-lock.json` = 「このバージョンをインストールした」という記録ファイル
- **なぜ削除してから再インストールするか**: `package.json` を手動で書き換えても、古い実体と記録が残ったままだとズレが起きる。一旦全部消してゼロから入れ直すことで確実に新しい設定が反映される
- **例え**: レシピ（package.json）を書き換えたのに古い食材（node_modules）が冷蔵庫に残ってる。全部捨てて買い直す

### Docker コンテナとホスト（Mac）の環境の違い
- **何か**: Docker コンテナは Linux 環境。Mac（ホスト）は macOS 環境
- **なぜ問題か**: `rolldown` などのネイティブバイナリ（.node ファイル）は OS ごとに別ファイルが必要。コンテナ内で `npm install` すると Linux 用が入る。Mac 上で `npm run build` を実行すると macOS 用バイナリがなくてエラーになる
- **解決策**: `npm install` も `npm run build` も同じ環境（コンテナ内）で揃えて実行する

```bash
docker compose exec app npm install
docker compose exec app npm run build   # ← コンテナ内で実行
```

### Tailwind CSS v3 と v4 の違い（混在問題）
- **何か**: Tailwind CSS はバージョン 3 と 4 で設定方法が全く違う
  - v3: `tailwind.config.js` でカスタマイズ（今回のプロジェクト）
  - v4: CSS ファイル内に直接設定を書く（`@tailwindcss/vite` プラグイン使用）
- **なぜ問題か**: v4 用プラグイン（`@tailwindcss/vite`）と v3 用設定ファイルが混在するとビルドが壊れる
- **解決策**: v3 に統一。`@tailwindcss/vite` を削除して `tailwindcss: ^3.2.1` だけ使う

### TypeScript の `allowJs` オプション
- **何か**: TypeScript プロジェクトで `.js` / `.jsx` ファイルも一緒に使えるようにする設定
- **なぜ必要か**: 一気に全ファイルを `.tsx` に変換するのは大変。`allowJs: true` にすると既存の `.jsx` はそのまま残し、新しいファイルから少しずつ `.tsx` で書ける（漸進移行）
- **例え**: 英語の本に少しずつ日本語のページを混ぜて増やしていくイメージ

### Larastan とは
- **何か**: PHPStan（PHP の静的解析ツール）を Laravel 向けに拡張したもの
- **なぜ必要か**: コードを実行する前に「型のズレ」「null 安全でない書き方」「存在しないメソッド呼び出し」などのバグを検出できる
- **Laravel 特有の強み**: `User::find()` が `User|null` を返すのに null チェックなしで使っていたらエラーにしてくれる。素の PHPStan は Eloquent（Laravel の DB 操作）を理解できない
- **デメリット**: 導入時の設定コスト・Filament などの一部パッケージで偽陽性が出ることがある

---

## 書いたコード

### tsconfig.json（TypeScript 設定ファイル）

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "lib": ["ES2020", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "moduleResolution": "bundler",
        "jsx": "react-jsx",
        "strict": true,
        "allowJs": true,
        "skipLibCheck": true,
        "noEmit": true,
        "baseUrl": ".",
        "paths": {
            "@/*": ["resources/js/*"]
        }
    },
    "include": ["resources/js/**/*"],
    "exclude": ["node_modules", "vendor", "public"]
}
```

**ポイント解説:**
- `"jsx": "react-jsx"`: React の JSX 構文（`<div>` など）を JS に変換する設定。React 17 以降の新形式
- `"allowJs": true`: 既存の `.jsx` ファイルもそのまま使える（漸進移行のため）
- `"strict": true`: 型チェックを厳格モードに。バグを早期発見しやすくなる
- `"noEmit": true`: TypeScript は型チェックのみ行い、JS ファイルを生成しない（ビルドは Vite に任せる）
- `"paths": {"@/*": [...]}`: `@/Components/Button` のように絶対パスで import できるエイリアス

### package.json（修正後）

```json
{
    "dependencies": {
        "axios": "^1.6.0"
    },
    "devDependencies": {
        "@vitejs/plugin-react": "^5.0.0",
        "typescript": "^5.4.0",
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "vite": "^8.0.0",
        "tailwindcss": "^3.2.1"
    }
}
```

**ポイント解説:**
- `@vitejs/plugin-react` を v4 → v5 に上げた: vite 8 に対応したバージョン
- `@tailwindcss/vite` を削除: v4 用プラグインで v3 と混在していたため
- `typescript`, `@types/react`, `@types/react-dom`: TypeScript と React の型定義。型定義があることで「このコンポーネントにはこの props が必要」などを IDE が教えてくれる

---

## なぜそう書くか（設計の理由）

- **vite 8 + plugin-react v5 の組み合わせ**: `laravel-vite-plugin@3.1` が vite 8 必須のため、vite は 8 に固定。plugin-react は vite 8 に対応した v5 に合わせる。バージョンは「依存関係の連鎖」があるので、一つ変えると他も影響する

- **TypeScript は一括変換せず漸進移行**: 既存の Breeze スキャフォールド（27 ファイル）を一気に `.tsx` に変換するとコストが高い。`allowJs: true` で `.jsx` を残したまま、新規ページ（RegisterSchool.tsx 等）から `.tsx` で書いていく方針

- **Tailwind v3 を選んだ理由**: `tailwind.config.js` がすでに v3 構文で書かれていた。v4 への移行は設定方法が根本的に変わるため、今は v3 に統一してシンプルに保つ

---

## 次回への課題・疑問点

- [ ] Task 2: Filament v3 インストール（`composer require filament/filament:"^3.2" -W`）
- [ ] `tsconfig.json` の `@/*` エイリアスが vite でも動くか確認（`vite.config.js` の `resolve.alias` と合わせる必要あり）
- [ ] Larastan は Task 3（CI 構築時）に level 5 で導入予定
- [ ] `npm run build` 成功は確認済み。`http://localhost` でページが表示されるか確認
