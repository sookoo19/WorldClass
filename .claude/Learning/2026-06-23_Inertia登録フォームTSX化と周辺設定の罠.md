# Inertia 登録フォームの TSX 化と、周辺設定で踏んだ罠まとめ

**日付**: 2026-06-23
**会話の概要**: Phase1 Task8 の続きで、利用者/パートナー登録フォーム（RegisterMember.tsx / RegisterPartner.tsx）を作成。フォーム本体は正しかったが、表示までに「型・ビルド・Docker・ロケール」の周辺設定エラーを次々潰した。最終的に member/partner 両方の登録フローが実機で完走。

---

## 今日学んだ概念

### Inertia と Ziggy は別物
- **何か**: Inertia = Laravel(サーバ)と React をつなぐ仕組み（`useForm` `<Link>` `<Head>` を提供）。Ziggy = Laravel の名前付きルートを JS で使えるようにする別ライブラリ（`route('login')` → `/login`）。
- **なぜ必要か**: Breeze が両方まとめて入れるのでセットに見えるが、責務が違う。`route()` を呼んでるのは Inertia ではなく Ziggy。
- **例え**: Inertia は「画面とデータの配達係」、Ziggy は「住所→番地の変換辞書」。別々の道具。

### グローバル関数の型宣言（ambient declaration）
- **何か**: `route()` は `import` せず使えるグローバル関数。実体は Blade の `@routes` ディレクティブが `window.route` を注入している。
- **なぜ必要か**: 実体（JS）は注入済みでも、TypeScript は「そんな名前知らない（TS2304）」と言う。`declare global { const route: ... }` で「型情報だけ」を後付けする。
- **例え**: モノは届いてるのに、伝票（型）が無いから受付（TS）が受け取れない。伝票だけ書いて渡すのが d.ts。

### Laravel の i18n（バリデーションメッセージ日本語化）
- **何か**: `APP_LOCALE=ja` ＋ `lang/ja/validation.php` を置くと、検証エラーが日本語になる。`attributes` 配列でフィールド名も日本語化（`themes` → テーマ）。
- **なぜ必要か**: Laravel 11+ は lang ファイルを同梱しない。デフォルトは英語（"The themes field is required."）。
- **例え**: 翻訳辞書を自分で本棚（lang/ja/）に置いて、言語設定（APP_LOCALE）でその棚を見るよう指示する。

---

## 書いたコード

### 1. 型なし .jsx 部品を型付き .tsx 化（TextInput）

```tsx
import { forwardRef, InputHTMLAttributes, useEffect, useImperativeHandle, useRef } from 'react';

export default forwardRef(function TextInput(
    {
        type = 'text',
        className = '',
        isFocused = false,
        ...props
    }: InputHTMLAttributes<HTMLInputElement> & { isFocused?: boolean },
    ref,
) {
    const localRef = useRef<HTMLInputElement>(null);
    // ...
});
```

**ポイント解説:**
- `...props: InputHTMLAttributes<HTMLInputElement>`: `id/name/value/onChange/required` 等の input 標準属性を全部「許可された prop」として型付け。これが無いと TS は `...props` を空 `{}` と推論し、`id` を「存在しないprop」と拒否する。
- `& { isFocused?: boolean }`: 標準属性に無い独自 prop を交差型で足す。
- onChange が型付くと、呼び出し側の `(e) => ...` の `e` も自動で `ChangeEvent` 推論 → 暗黙any（TS7006）が消える。

### 2. Inertia のページ解決を jsx/tsx 両対応に（app.jsx）

```js
resolve: (name) =>
    resolvePageComponent(
        [`./Pages/${name}.tsx`, `./Pages/${name}.jsx`],
        import.meta.glob('./Pages/**/*.{jsx,tsx}'),
    ),
```

**ポイント解説:**
- `import.meta.glob('./Pages/**/*.{jsx,tsx}')`: ビルド対象に tsx も含める。元は `*.jsx` のみ → tsx ページがバンドルされず「Page not found」。
- パス配列 `[.tsx, .jsx]`: `resolvePageComponent` は先頭から探す → 同名なら tsx 優先、無ければ jsx。**漸進移行（移行済みtsx・未移行jsx混在）と両立**。

### 3. lang/ja/validation.php（抜粋）

```php
return [
    'required' => ':attribute は必ず指定してください。',
    'confirmed' => ':attribute が確認用の値と一致しません。',
    'unique'   => ':attribute はすでに使用されています。',
    // ...
    'attributes' => [
        'themes'       => 'テーマ',
        'display_name' => '表示名',
        'email'        => 'メールアドレス',
        // ...
    ],
];
```

**ポイント解説:**
- `:attribute` がプレースホルダ。`attributes` 配列で日本語名に置換される。
- 結果: "The themes field is required." → "テーマは必ず指定してください。"

---

## なぜそう書くか（設計の理由）

- **ページ別 `@vite` を削除した（blade）**: 元の `@vite([..., "resources/js/Pages/{$page['component']}.jsx"])` は拡張子 .jsx 決め打ちで、tsx ページが manifest に無く ViteException。第2引数は「初回表示のプリロード最適化」にすぎず、実際の読込は app.jsx の `import.meta.glob` が遅延ロードで担う。→ 削除して拡張子問題を根絶。失うのは僅かなプリロードのみ。
- **dev サーバではなく build を選んだ**: Docker内 Vite dev(HMR) は `0.0.0.0` bind＋5173公開＋hmr.host 設定が必要で罠が多い。今は「編集→`npm run build`→リロード」の方が確実。HMR は後で別途セットアップ可。
- **共通部品を tsx 化（漸進移行）**: tsconfig が strict なので、tsx から import した .jsx 部品の「壊れた型推論」が表面化。部品自体を型付けすると全ページで恩恵。プロジェクト方針「.tsx 漸進移行」とも一致。

---

## 躓きポイント深掘り

### 躓き1: tsx から .jsx 部品を import したら大量の型エラー
- **何に躓いたか**: `InputLabel`(children必須エラー TS2741)、`TextInput`(id不可 TS2322＋e暗黙any TS7006)。.jsx の時は無かったのに tsx にした途端噴出。
- **根本の仕組み**: `allowJs:true` でも `checkJs` 無し → .js/.jsx は型チェックされず素通り。tsx は strict チェック対象。TS は .jsx を import する際 **JSソースから型を推論**するが、`{ children, ...props }`（デフォルト値なし children → 必須と推論）や `forwardRef(fn(..., ...props))`（`...props` を空 `{}` と推論）のように、推論結果が実際の使い方と食い違う。
- **関連技術マップ**:
  - **rest props（`...props`）**: 残りの props をまとめる構文。型が無いと TS は中身を知れず空扱い。
  - **forwardRef**: ref を子に渡す HOC。props 型を明示しないと ref だけのコンポーネント扱いになる。
  - **交差型（`A & B`）**: 標準属性＋独自propを「両方持つ」型を作る。今回の `InputHTMLAttributes & { isFocused? }`。
- **理解チェック**: なぜ同じファイルが .jsx では無エラー、.tsx ではエラーになる？（答: jsx は checkJs 無しで型チェックされず素通りするから。tsx は strict 対象）

### 躓き2: 新しい tsx ページがビルド出力に出てこない / 編集が画面に反映されない
- **何に躓いたか**: RegisterMember/Partner を作ったのに build 出力に無い。後で email欄を足したのに画面は古いまま。
- **根本の仕組み**: 2段階の別問題。(a) `import.meta.glob('./Pages/**/*.jsx')` が jsx 限定 → tsx が対象外。(b) `npm run build` は**実行した瞬間のソースを固める**方式。ソース変更後に再ビルドしないと、Laravel は manifest 経由で古い成果物を配信。dev(HMR)なら自動反映だが、build 運用では都度ビルドが要る。
- **関連技術マップ**:
  - **import.meta.glob**: Vite のファイル一括 import。バンドル対象を決める。
  - **manifest.json / @vite**: 本番ビルドの成果物カタログ。Blade はこれを見て配信。
  - **HMR（Hot Module Replacement）**: dev サーバの即時反映。build には無い。
- **理解チェック**: build 運用でソースを直したのに画面が変わらない。最初に疑うことは？（答: 再ビルドしたか。build は瞬間を固める方式）

### 躓き3: 500 連発（Redis拒否 → Vite manifest → 戻り値型 → ローカル英語）
- **何に躓いたか**: フォームを開くだけで毎回違う 500。混乱した。
- **根本の仕組み**: どれも**フォームのコードではなく周辺設定**。
  - Redis: `.env` の `REDIS_HOST=127.0.0.1` → app コンテナ内で自分自身を指し接続拒否。正は service名 `redis`（コンテナ間は service 名で通信。`127.0.0.1` はそのコンテナ自身）。
  - 戻り値型: `DashboardController::member(): Reaponse` のタイポ＋`use Inertia\Response;` 漏れ → PHP が未知クラスを同名前空間と解釈し型不一致。
  - 英語エラー: `APP_LOCALE=en` 既定＋lang/ja 無し。
- **関連技術マップ**:
  - **Docker のサービス名解決**: compose のサービス名がコンテナ内DNS名になる（`redis`/`db`）。`localhost` は各コンテナ自身。
  - **PHP の名前空間解決**: import されてない型名は「現在の名前空間にあるもの」と解釈される。
  - **設定キャッシュ**: `config:clear` しないと .env 変更が効かない場合がある。
- **理解チェック**: app コンテナから redis に繋ぐとき `127.0.0.1` がダメで `redis` が正しい理由は？（答: コンテナ内の 127.0.0.1 は自分自身。他コンテナへは compose のサービス名で解決する）

### 躓き4: npm のネイティブバインディング欠落（rolldown）
- **何に躓いたか**: `npm install` が "up to date" なのに build が `Cannot find @rolldown/binding-linux-x64-gnu` で死ぬ。
- **根本の仕組み**: compose が `- .:/var/www/html` でプロジェクト丸ごとマウント → **host(macOS)の node_modules が container(linux)に漏れる**。lockfile が macOS で生成され linux 用 optional 依存が記録されない（npm #4828）。Vite8 の rolldown はプラットフォーム別ネイティブ必須。→ `rm -rf node_modules package-lock.json && npm install`（container内）で linux 基準に再解決。恒久対策は node_modules を匿名ボリュームで分離。
- **関連技術マップ**:
  - **optional dependencies**: プラットフォーム別バイナリを optional で配布する仕組み。lockfile 生成環境に依存。
  - **bind mount vs named volume**: ホスト共有か、コンテナ専用か。node_modules はプラットフォーム差があるので分離が安全。
- **理解チェック**: なぜ host で入れた node_modules が container で動かない？（答: ネイティブバイナリが OS/アーキ依存。macOS用バイナリは linux で実行不可）

---

## 関連ノート

- [2026-05-29 npm依存解決-TypeScript導入](./2026-05-29_npm依存解決-TypeScript導入.md) — TS 導入・jsx/tsx の話の続き。今日の「.jsx を tsx に型付き移行」「glob を {jsx,tsx} 対応」はこの延長。
- [2026-05-25 Docker-PHP-Nginx構成](./2026-05-25_Docker-PHP-Nginx構成.md) — compose のサービス構成。今日の REDIS_HOST=service名・node_modules マウント漏れの背景。
- [2026-06-08 マイグレーション型とテスト環境変数デバッグ](./2026-06-08_マイグレーション型とテスト環境変数デバッグ.md) — 「.env 注入・config キャッシュ」系のデバッグ。今日の Redis/locale も同じ「設定が効かない」族。

---

## 次回への課題・疑問点

- [ ] `.env.example` が diff で「65行削除」と出た件の確認（中身が壊れていないか）と、`APP_LOCALE=ja`＋Redis変数の追記・コミット。
- [ ] Vite dev サーバ(HMR)を Docker で正しく動かす設定（vite.config の `server.host='0.0.0.0'` / `hmr.host` ＋ compose の 5173 公開）。build 運用から HMR へ移行したくなったら。
- [ ] node_modules を匿名ボリュームで分離する恒久対策を compose に入れるか（host↔container のバイナリ衝突防止）。
- [x] Task 8.5（死にルート除去・throttle・トランザクション・unique・旧テスト清算・審査中バナー）→ 同日に実施。下の【追記】参照。

---
---

# 【追記】Task 8.5: 登録まわりのセキュリティ・整合性強化

**会話の概要（追記分）**: Task8 完了後、登録フローを堅牢化（Task8.5）。死にルート除去・レート制限・DBトランザクション・unique制約・審査中バナーを実装。テスト実行で Task7 由来の既存破綻（`route('dashboard')` 不在による500）を発見し、中立 dashboard ルートで一括解消。全27テスト緑。

---

## 今日学んだ概念（追記分）

### DB トランザクションと原子性（atomicity）
- **何か**: 複数のDB操作を「全部成功 or 全部巻き戻し（ロールバック）」の1単位にまとめる仕組み。`DB::transaction(fn)` で囲む。
- **なぜ必要か**: 登録は users→members の2回INSERT。途中で失敗すると「users だけ残る孤児ユーザー」ができ、`unique:users` でそのメールが再登録不能になり詰む。
- **例え**: 銀行振込の「引き落とし」と「入金」。片方だけ成立したら大事故。両方まとめて成立 or 両方無かったことにする。

### レート制限（throttle）
- **何か**: 一定時間内のリクエスト回数に上限を設けるミドルウェア。`throttle:5,1` = 1分間に5回まで。
- **なぜ必要か**: bot による大量アカウント自動作成を防ぐ。登録POSTのような「副作用が重い」入口に付ける。
- **例え**: 1人が窓口に何百回も並び直すのを「1分5回まで」と整理券で制限する。

### 一意制約（unique constraint）と1:1の担保
- **何か**: DBカラムに重複を許さない制約。`$table->unique('user_id')`。
- **なぜ必要か**: `members.user_id` が plain FK だとDB上は1ユーザーに複数プロフィールを許す。Eloquent の `hasOne`(1:1前提)と不整合。DB層でも1:1を強制する。
- **例え**: 「1人1枚」の会員証。同じ人に2枚目を発行できないよう受付台帳側でロックする。

### Facade のモック（テストの皮剥がし）
- **何か**: `DB::shouldReceive('transaction')` で本物のDBファサードを偽物に差し替え、振る舞いを指定する。
- **なぜ必要か**: Unitテストは「DB未接続でロジックだけ高速検証」が方針。`DB::transaction` を入れると実DBに繋ぎに行って落ちる。皮だけ剥がして中身ロジックは本番どおり動かす。
- **例え**: 舞台のリハで「本物の扉」の代わりに書き割りを置く。役者の動き（ロジック）は本番と同じに確認できる。

---

## 書いたコード（追記分）

### 1. UseCase のトランザクション化

```php
public function execute(RegisterMemberInput $input): RegisterMemberOutput
{
    return DB::transaction(function () use ($input) {
        $user = $this->userRepository->create([...]);     // 1
        $this->memberRepository->create([...]);            // 2 ← 失敗すれば1もロールバック
        return new RegisterMemberOutput($user);
    });
}
```

**ポイント解説:**
- `DB::transaction(fn)`: 中のクロージャ全体が1単位。例外が飛べば自動でロールバック、最後まで通れば自動コミット。
- `use ($input)`: クロージャの外の変数を中に持ち込む構文。

### 2. Unit テストの DB モック

```php
DB::shouldReceive('transaction')
    ->once()
    ->andReturnUsing(fn (callable $callback) => $callback());
```

**ポイント解説:**
- `shouldReceive('transaction')`: 「`DB::transaction` が呼ばれるはず」と宣言し、実DB接続を回避。
- `andReturnUsing(fn ($cb) => $cb())`: 受け取ったクロージャを**その場で実行**。本番同様に中の create 2本が走り、ロジックを検証できる。
- `->once()`: ちょうど1回呼ばれることも併せて検証。

### 3. 中立 dashboard ルート（roleで振り分け）

```php
Route::middleware('auth')->get('/dashboard', function () {
    return match (Auth::user()->role) {
        'partner' => redirect()->route('partner.dashboard'),
        default   => redirect()->route('member.dashboard'),
    };
})->name('dashboard');
```

**ポイント解説:**
- `match`: PHP の値分岐（switch の厳格版）。role に応じて専用ダッシュボードへ302リダイレクト。
- これ1本で、`route('dashboard')` を参照する Breeze標準コントローラ5本が一斉に動くようになる。

### 4. レート制限と unique

```php
Route::post('register/member', [...'storeMember'])->middleware('throttle:5,1');
```
```php
Schema::table('members', fn (Blueprint $t) => $t->unique('user_id'));
```

---

## なぜそう書くか（設計の理由・追記分）

- **トランザクションは Facade 直書きを許容（MVP判断）**: クリーンアーキ的には Transaction インターフェースを注入するのが純粋だが、MVPでは過剰。`DB::transaction` 直書きで割り切り（2026-06-12判断）。
- **コントローラ5本を直さず dashboard ルート1本で解決**: `route('dashboard')` 参照箇所（login/verify/confirm 等）を個別修正すると5ファイル変更＋漏れリスク。中立ルートを1本足す方が変更最小・将来の参照にも自動対応。
- **`/` を 200 期待から redirect 期待にテスト修正**: `/` がログインへ飛ぶのは意図的仕様。テストを現実（仕様）に合わせる。仕様変更時はテストも追従させるのが正しい向き（テストを通すために仕様を歪めない）。

---

## 躓きポイント深掘り（追記分）

### 躓き: テスト4本が `Route [dashboard] not defined` / 500 で落ちた
- **何に躓いたか**: 自分の追加変更（Task8.5）のテストは緑なのに、無関係に見える AuthenticationTest・EmailVerificationTest・PasswordConfirmationTest・ExampleTest が落ちた。原因が自分の変更か分からず混乱。
- **根本の仕組み**: Task7 でダッシュボードを member/partner に分割した際、`dashboard` という名前のルートが消えた。しかし Breeze 標準の認証コントローラ群は今も `route('dashboard')` を参照しており、ログイン・メール認証・パスワード確認の後にそのルートを解決しようとして `RouteNotFoundException`（実害は500）。**今日の変更が原因ではなく、Task7時点から潜在していた負債が、テスト全体実行で初めて顕在化した**。
- **関連技術マップ**:
  - **名前付きルート（named route）**: `->name('x')` で付けた名前を `route('x')` で逆引き。名前が消えると参照側が全滅する。
  - **回帰テスト（regression）**: 一部を変えたら別の場所が壊れていないか全体テストで気づく。今回まさにこれが機能した。
  - **スコープ判断**: 「自分のタスク範囲外だが実害あり」を見つけたとき、直すか先送りか。今回は実バグ（500）なので範囲を広げて修正した。
- **理解チェック**: 自分の変更と無関係なテストが急に落ちたとき、まず疑うべきことは？（答: そのテストが前提にする名前付きルート/仕様が、別の変更で消えていないか。エラーの文言＝`Route [...] not defined` が直接の手がかり）

---

## 関連ノート（追記分）

- [2026-06-09 TDD-UseCase-UnitTest](./2026-06-09_TDD-UseCase-UnitTest.md) — UseCase の Unit テスト（Repositoryモック）の続き。今日の「DB Facadeモックでトランザクションの皮を剥がす」はこの延長。
- [2026-06-10 セキュリティレビュー観点](./2026-06-10_セキュリティレビュー観点.md) — 死にルート・throttle・孤児ユーザー等の指摘元。今日の Task8.5 はこのレビュー結果の実装。

---

## 次回への課題・疑問点（追記分）

- [ ] Task 8.6（`$table->enum()` → `string` ＋ backed enum cast、`migrate:fresh` で作り直し）。
- [ ] admin ロールが web ログインで `/dashboard` に来た場合の扱い（現状 default で member へ。本来は Filament パネル）。Phase2 で要整理。
- [ ] トランザクションの「純粋な」設計（Transactionインターフェース注入）を将来導入するか。MVPでは Facade 直書きで割り切り中。
