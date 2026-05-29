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

- [x] Task 2: Filament v4 インストール完了（v3 は Laravel 13 非対応だったため v4 を採用）
- [ ] `tsconfig.json` の `@/*` エイリアスが vite でも動くか確認（`vite.config.js` の `resolve.alias` と合わせる必要あり）
- [x] Larastan level 5 導入完了（Task 3 CI 構築時）
- [ ] `http://localhost` でページが表示されるか確認（管理画面 `/admin` は表示確認済み）

---

# Filament v4 インストール・GitHub Actions CI・Larastan

**日付**: 2026-05-29
**会話の概要**: Filament のインストールで複数のエラーを解決しながら v4 を導入し、GitHub Actions CI と Larastan level 5 による静的解析を設定した。

---

## 今日学んだ概念

### Composer の セキュリティ advisory ブロック
- **何か**: Composer が「脆弱性が報告されているパッケージバージョン」のインストールを自動で拒否する機能
- **なぜ必要か**: 既知のセキュリティ問題があるバージョンを誤って使うのを防ぐ
- **今回の例**: `filament/actions` の古いバージョン（v3.2.0〜v3.2.122）に脆弱性 `PKSA-1ds2-yqqr-64g1` が報告されており、Composer がインストールを拒否した

### Filament v3 と Laravel 13 の非互換
- **何か**: Filament v3 は Laravel 10/11 にしか対応していない。Laravel 13 には Filament v4 が必要
- **なぜ問題か**: Filament v3 の内部は `illuminate/view ^10.45|^11.0` を要求しており、Laravel 13 の `illuminate/view ^13.x` と共存できない
- **教訓**: パッケージを選ぶとき「どの Laravel バージョンに対応しているか」を必ず確認する。対応表は各パッケージの README や packagist.org で確認できる

### PHP 拡張（ext-intl）
- **何か**: PHP の国際化（多言語対応）機能を提供する拡張モジュール。文字列の並び替え・通貨フォーマット・ロケール処理などに使われる
- **なぜ必要か**: Filament v4 が内部で使用している。Docker コンテナの PHP イメージにはデフォルトで入っていないため、Dockerfile に追加してリビルドが必要だった
- **インストール方法**: `libicu-dev`（ICU ライブラリ）を apt でインストール後、`docker-php-ext-install intl` で有効化

### GitHub Actions CI（継続的インテグレーション）
- **何か**: コードを push するたびに「テスト・静的解析・コードスタイルチェック」を自動で実行するしくみ
- **なぜ必要か**: 人間が手動でチェックを忘れてもコンピュータが自動で検知してくれる。チーム開発で「壊れたコードを main に入れてしまう」リスクを減らす
- **例え**: 工場の品質検査ライン。製品（コード）が出荷（main マージ）される前に自動で検査される

### PHPStan / Larastan の level
- **何か**: 静的解析の厳しさを 0〜10 の数値で指定する設定
- **level 5 の意味**: `null` かもしれない値を無検査で使うとエラー。例: `User::find(1)` は `User|null` を返すので、null チェックなしに `->name` を使うと怒られる
- **なぜ level 5 か**: 0〜4 は緩すぎて実用的なバグを検出できない。6〜10 は Laravel/Filament の内部コードで偽陽性（誤検知）が大量に出る。5 がバランスの良い出発点

### PHPDoc 型アサーション（`@var`）
- **何か**: PHPDoc コメントで「この変数はこの型だ」と静的解析ツールに教える記法
- **なぜ必要か**: PHPStan は `$request->user()` が `User|null` を返すと判断する。しかし `EmailVerificationRequest` は認証済みユーザーしかアクセスできないため、実際には null にならない。この「実装上の保証」を PHPDoc で明示することで誤検知を解消する

---

## 書いたコード

### Dockerfile への ext-intl 追加

```dockerfile
RUN apt-get update && apt-get install -y \
    git curl zip unzip libpq-dev libzip-dev libicu-dev \
    && docker-php-ext-install pdo pdo_pgsql zip bcmath intl \
    && pecl install redis && docker-php-ext-enable redis
```

**ポイント解説:**
- `libicu-dev`: ICU ライブラリのヘッダファイル。intl 拡張のコンパイルに必要
- `docker-php-ext-install intl`: PHP の intl 拡張を有効化する公式ヘルパーコマンド
- Dockerfile を変更したら `DOCKER_BUILDKIT=0 docker compose build app` でリビルド必要

### phpstan.neon（Larastan 設定）

```neon
includes:
    - vendor/larastan/larastan/extension.neon

parameters:
    level: 5
    paths:
        - app

    excludePaths:
        - app/Providers/Filament/AdminPanelProvider.php
```

**ポイント解説:**
- `includes`: Larastan の Laravel 専用ルールを読み込む（Eloquent や Facade を理解させる）
- `level: 5`: null 安全チェックを含む中程度の厳しさ
- `excludePaths`: Filament が自動生成したファイルは解析対象から除外（自動生成コードは型が不完全なことがある）

### GitHub Actions ワークフロー（抜粋）

```yaml
jobs:
  larastan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
          extensions: pdo, pdo_pgsql, zip, bcmath, intl
      - name: Install Composer dependencies
        run: composer install --no-interaction --prefer-dist
      - name: Run Larastan
        run: ./vendor/bin/phpstan analyse --no-progress
```

**ポイント解説:**
- `runs-on: ubuntu-latest`: GitHub のサーバー（Linux）でジョブを実行
- `uses: shivammathur/setup-php@v2`: PHP のセットアップを簡単にやってくれる公式アクション
- `--no-progress`: CI では進捗バーを出力しない（ログが見やすくなる）

### PHPDoc 型アサーション（VerifyEmailController）

```php
/** @var \App\Models\User&\Illuminate\Contracts\Auth\MustVerifyEmail $user */
$user = $request->user();
```

**ポイント解説:**
- `User&MustVerifyEmail`: 「User であり、かつ MustVerifyEmail インターフェースも実装している」という交差型（intersection type）を PHPDoc で表現
- 実行時の動作は変わらない。あくまで静的解析ツールへの「ヒント」
- `$request->user()` は認証済みリクエストなので実際に null にはならないが、型定義上は `User|null` のため明示が必要

---

## なぜそう書くか（設計の理由）

- **Filament v4 を選んだ理由**: v3 は Laravel 10/11 のみ対応。このプロジェクトは Laravel 13 なので v4 一択。v4 は v3 と同じコンセプト（Panel, Resource）を持つため移行コストは低い

- **CI に 3 つのジョブを分けた理由**: test・larastan・pint を独立したジョブにすることで、どこで失敗したか一目でわかる。また並列実行されるため全体の所要時間が短縮される

- **AdminPanelProvider を excludePaths にした理由**: Filament が自動生成するコードは型アノテーションが不完全で偽陽性が出やすい。自分たちが書いたコードの品質向上が目的なので、フレームワーク生成コードは除外が合理的

---

## 次回への課題・疑問点

- [ ] Task 4: DB マイグレーション（schools, partners, sessions, support_requests テーブル作成）
- [ ] Task 5: クリーンアーキテクチャ骨格（Domain / UseCase / Infrastructure ディレクトリ）
- [ ] GitHub Actions で CI が実際に動くか確認（push してみる）
- [ ] `phpstan.neon` の `--memory-limit=512M` を CI の `phpstan analyse` コマンドにも追加すべきか検討
