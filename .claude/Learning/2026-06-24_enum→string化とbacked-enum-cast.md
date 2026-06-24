# enum列のstring化とbacked enum cast / phpstan型の躓き

**日付**: 2026-06-24
**会話の概要**: Phase 1 Task 8.6。DBの `enum()` 列を `string` に変えてPHPの backed enum cast を付ける作業。「なぜ堅固なenumを捨てるのか」という設計議論と、phpstan を緑にするまでの型の詰まりを深掘りした。

---

## 今日学んだ概念

### Laravel の `$table->enum()` は DB ごとに姿が違う
- **何か**: マイグレーションで許容値を限定する列の書き方。
- **なぜ必要か**: 「pending/approved/...」のような決まった値だけを DB に入れさせたい。
- **例え**: 受付の「記入できる選択肢リスト」。リスト外を書くと弾かれる。
- **重要な事実**: MySQL では native な `ENUM` 型になるが、**PostgreSQL では `varchar + CHECK制約`** に落ちる。つまり「`status in ('pending','approved',...)` を満たさないと保存不可」という制約が付く。native enum型（`CREATE TYPE`）ではない。

### backed enum cast
- **何か**: Eloquent の `$casts` に PHP の backed enum を指定し、**DBの文字列 ⇄ PHP の enumオブジェクト**を読み書きのたびに自動変換する仕組み。
- **なぜ必要か**: DB から来る値はただの文字列。そのままだとタイプミス比較（`=== 'aproved'`）に気づけない。enum オブジェクトに変換しておけば、存在しない値は「書いた瞬間」にエラーになる。
- **例え**: 税関の翻訳官。DB（外国語＝文字列）とアプリ（母国語＝enum）の間で、出入りのたびに自動で訳してくれる。

### backed enum（裏打ち付き列挙）
- **何か**: `enum PartnerStatus: string { case Pending = 'pending'; ... }` の `: string` 部分。各 case に文字列値が紐づく。
- **なぜ必要か**: `PartnerStatus::Pending->value` で `'pending'` が取れ、DB値との相互変換ができる。

---

## 書いたコード

### Step 1: マイグレーションの `enum()` → `string()`（6ファイル8列）

```php
// 変更前（PostgresではCHECK制約になる）
$table->enum('status', ['pending', 'approved', 'suspended', 'rejected'])->default('pending');
// 変更後（default はそのまま維持）
$table->string('status')->default('pending');
```

**ポイント解説:**
- 第2引数（許容値の配列）を消すだけ。`->default()` `->after()` などの修飾は維持する。
- 対象列: `users.role` / `members.type` / `partners.provider_type,status` / `sessions.session_type,status` / `support_requests.status` / `session_participants.status`。
- プランにあった `coupons.reason` は**実在しなかった**（`coupons.code` が string で既存）。計画書の記載ミス。実物を grep で確認してから作業するのが大事。

### Step 2: モデルに backed enum cast を付ける

```php
// app/Models/Partner.php
use App\Domain\ValueObjects\PartnerStatus;
use App\Domain\ValueObjects\ProviderType;

protected $casts = [
    'themes' => 'array',
    'rating_score' => 'float',
    'provider_type' => ProviderType::class,
    'status' => PartnerStatus::class,
];
```

**ポイント解説:**
- cast を付けると `$partner->status` は文字列 `'pending'` ではなく `PartnerStatus::Pending`（enumオブジェクト）を返すようになる。
- **書き込みは双方向**: `'status' => 'pending'`（文字列）でも `PartnerStatus::Approved`（enum）でも渡せ、DBには文字列で保存される。
- **JSON化（Inertia含む）は自動で `.value` に戻る** → フロントは今まで通り `'pending'` を受け取る。だからフロントを壊さずに入れられる。
- `Member.type`=MemberType、`Partner.provider_type`=ProviderType も同様に付与。

### phpstan を緑にするための型修正（別コミット）

```php
// DashboardController: Auth::user() は Authenticatable 型なので User と明示
/** @var \App\Models\User $user */
$user = Auth::user();
return Inertia::render('Dashboard/Partner', ['status' => $user->partner?->status]);
```

```php
// User.php: リレーションに戻り型＋ジェネリクスを付与
use Illuminate\Database\Eloquent\Relations\HasOne;

/** @return HasOne<Partner, $this> */
public function partner(): HasOne
{
    return $this->hasOne(Partner::class);
}
```

---

## なぜそう書くか（設計の理由）

- **なぜ堅固な enum(CHECK) を捨てて string にしたのか**: 許容値を守る防御は「多層」で考える。①入口=FormRequest の `Rule::enum()`、②アプリ型=backed enum cast、③DB=CHECK制約。string化で失うのは③だけで、①②は維持・むしろ②は今回追加した。③（DBの最後の砦）を捨てるコストは「状態を増やすたびにCHECK制約の作り直しマイグレーションが要る」こと。`sessions.status` は既に6状態あり Phase 3+でさらに増える設計＝③の維持コストが重い列。**本番データが無い今が変更最安**なので string に倒した。
- **なぜ全列ではなく折衷も検討したか**: `members.type`（family等）のように**状態がほぼ増えない**列は③維持コストがゼロに近く、enumのままでも合理的。今回はプラン通り全string化を選んだが、「育つ列はstring・安定列はenum」という列ごとの使い分けもあり得る。
- **なぜ `User.role` だけ cast しないのか**（最重要）: `routes/web.php` の `match (Auth::user()->role) { 'partner' => ... }` と `EnsureRole` の `in_array(Auth::user()->role, $roles, true)` が **role を文字列で厳密比較**している。cast すると `->role` が enumオブジェクトを返し、文字列との比較が全て false 化 → `match` は default に落ち（パートナーが member 画面へ）、`in_array(...,true)` は常に false で認可が全崩壊する。しかもエラーが出ず黙ってバグる。cast するなら比較箇所の修正とセットでなければならない。MVPでは role は string のままが安全。

---

## 躓きポイント深掘り

### 躓き1: phpstan が `unable to open phar` で起動すらしない

- **何に躓いたか**: `./vendor/bin/phpstan analyse` 実行で `PharException: unable to open phar ... phpstan.phar`。
- **根本の仕組み**: `vendor/phpstan/phpstan/phpstan` は本体を読み込む**スタブ（156バイト）**で、実体は同ディレクトリの `phpstan.phar`。この phar だけが欠落していた＝composer のインストールが不完全な状態。`composer reinstall phpstan/phpstan` で phar を取り直して解消。
- **関連技術マップ**:
  - **phar**: PHPのアーカイブ形式（1ファイルにまとめた実行可能パッケージ）。Javaの jar に近い。
  - **composer のvendor構成**: パッケージごとに `vendor/ベンダー名/パッケージ名/`。壊れたら個別 `reinstall` できる。
- **理解チェック**: 「phpstan の実体ファイル名は？ それが無いとどう壊れる？」→ `phpstan.phar`。スタブが読みに行く本体が無く起動失敗。

### 躓き2: `Auth::user()->partner` が property.notFound（型注釈を入れても消えない）

- **何に躓いたか**: phpstan が `Access to an undefined property App\Models\User::$partner`。`/** @var User */` を付けても**同じエラーが次の行に残った**。
- **根本の仕組み**: 原因は2層あった。
  1. `Auth::user()` の戻り型は `Illuminate\Contracts\Auth\Authenticatable`（インターフェース）で、`partner` プロパティを持たない。→ `@var \App\Models\User $user` で「これは User だ」と教える必要がある。
  2. それでも残ったのは、**larastan が User の `partner()` をリレーションと認識できていなかった**から。larastan はリレーションメソッドの**戻り型**を見て `$user->partner` という magic プロパティを生成する。元コードは戻り型無し（`public function partner()`）だったため拾えなかった。→ `: HasOne` ＋ `@return HasOne<Partner, $this>` を付けて解決。
- **学び**: `@var`（変数の型）と リレーションの戻り型（プロパティの存在と返る型）は**別レイヤーの型情報**。両方揃って初めて `$user->partner?->status` が静的に追える。1つ目の修正で消えなかったとき「注釈が効いていない」と早合点せず、エラーが次の行に移った＝1層目は効いた、と切り分けられたのがポイント。
- **関連技術マップ**:
  - **larastan のモデルプロパティ拡張**: Eloquentの「メソッド名でリレーションにアクセスできる魔法」を phpstan に教えるアドオン。`phpstan.neon` の `includes: vendor/larastan/larastan/extension.neon` で有効化。
  - **ジェネリクス `HasOne<Partner, $this>`**: 「Partnerを1件返す、所有者は自分自身」という型の中身。これで `->partner` が `Partner|null` と分かる。
  - **`?->`（nullsafe演算子）**: 左がnullなら呼ばずnullを返す。`partner` が無いユーザーでも安全。
- **理解チェック**: 「`@var User` を付けたのに `->partner` が未定義と言われた。残る原因は？」→ リレーションメソッドに戻り型が無く、larastanが magic プロパティを生成できないから。

---

## 関連ノート

- [2026-06-08 マイグレーション型とテスト環境変数デバッグ](./2026-06-08_マイグレーション型とテスト環境変数デバッグ.md) — ValueObject(enum)導入・`casts()`・enumとDB制約の二層ガードの初出。今日はその「DB層(③)をあえて外す」判断と cast の実装。
- [2026-06-09 TDD-UseCase-UnitTest](./2026-06-09_TDD-UseCase-UnitTest.md) — PartnerStatus 等の backed enum を UseCase で使った回。今日その enum をモデル cast に流用した。
- [2026-06-23 Inertia登録フォームTSX化と周辺設定の罠](./2026-06-23_Inertia登録フォームTSX化と周辺設定の罠.md) — `EnsureRole`・中立 dashboard ルート・登録UseCaseの実装回。今日の「role を cast すると EnsureRole が壊れる」はこの実装が前提。

---

## 次回への課題・疑問点

- [ ] sessions/session_participants/support_requests の status はまだ ValueObject が無く cast 未適用。Phase 2で enum化＋cast する余地。
- [ ] role を enum化したい場合の正攻法（RoleType作成→web.php/EnsureRoleをenum比較に書換→テスト）を1タスクとして整理。
- [ ] 次は Task 9（登録フローの Feature Test・PHPUnitクラス形式）。TDDのRedから。

---
---

# 【同日 追記】Task 9: 登録フローの Feature テスト（TDD）

**会話の概要**: Task 8/8.5 で実装済みの登録機能に Feature テストを4本追加し、全31緑にした。「既存コードへのテスト追加」という TDD のグレーゾーンと、テストの取捨選択（何をテストし、何を重複させないか）を深掘りした。

## 今日学んだ概念（Task 9）

### Feature テスト
- **何か**: HTTP リクエストを実際に投げ、ルート→FormRequest→Controller→UseCase→DB→レスポンスの**全経路**を実DBで通すテスト。
- **なぜ必要か**: Unit テスト（Task 6）は依存をモックで飛ばすので「部品単体」しか見ない。配線（ルート登録・リダイレクト先・バリデーション連携）が正しいかは Feature でしか分からない。
- **例え**: Unit は「エンジン単体の動作確認」、Feature は「車を実際に走らせる試運転」。

### `RefreshDatabase`
- **何か**: テストごとに DB をまっさらに巻き戻すトレイト（`use RefreshDatabase;`）。
- **なぜ必要か**: 前のテストが作ったデータが残ると、次のテストが汚染され「単体では通るのに連続実行で落ちる」不安定テストになる。各テストを独立・再現可能にする。

### 「既存コードへのテスト追加」＝ characterization（特性化）テスト
- **何か**: 既に動いている実装の振る舞いを後からテストで固定すること。
- **なぜ必要か**: 純粋な TDD（Red→実装）と違い実装が先にあるので happy path は**初回から緑**になる。これは正常。狙いは「将来の変更で壊れたら即気づく回帰の安全網」。
- **重要な判断**: それでも「書く→実行して観察」は省かない。もし初回で**赤**が出たら、それは配線バグの本物の発見。緑は「配線が正しい」証明、赤は「バグ発見」── どちらも価値がある。

## 書いたコード（Task 9）

```php
class RegisterMemberTest extends TestCase
{
    use RefreshDatabase;

    public function test_利用者の家庭が登録できる(): void
    {
        $response = $this->post('/register/member', [/* 入力一式 */]);

        $response->assertRedirect('/member/dashboard');        // 配線: redirect先
        $user = User::where('email', 'family@example.com')->first();
        $this->assertSame('member', $user->role);
        $this->assertTrue(
            Member::where('user_id', $user->id)->where('type', 'family')->exists()
        );
    }
}
```

**ポイント解説:**
- `$this->post(...)`: 実HTTPで全経路を通す。`assertRedirect` で成功時の遷移先、`assertSessionHasErrors('email')` でバリデーション失敗を検証。
- `->where('type', 'family')`: モデルに `MemberType` cast を付けたが、**クエリビルダの where は生の文字列値で比較**する（enumインスタンスではない）。DB保存値と照合するのでこれで正しい。
- `$partner->status->value`: 一方こちらは**取得したモデルの属性**なので cast が効き enumオブジェクト。`->value` で文字列化して比較。同じ status でも「whereの引数」と「取得後の属性」で型が違う点に注意。

## なぜそう書くか（テスト設計の理由）

- **重複メール検証を Member に1本だけ置き、Partner には置かない**: `'email' => ['required','email','unique:users']` は両 FormRequest で**完全に同一**。同じ仕組みを2回テストするのは冗長。共有ロジックは1回テストすれば担保される。
- **代わりに Partner には固有ルールのテストを足す**: Partner だけが持つ `themes => ['required','array','min:1']`＋`themes.* => in:...` は他でテストされていない穴。`themes => []`（min:1違反）で `assertSessionHasErrors('themes')` を検証。→ **「共有ルールは重複させず、未検証の固有ロジックを突く」**のがテスト設計の勘所。カバレッジは「テスト本数」ではなく「検証された分岐の種類」で考える。

## 躓きポイント深掘り（Task 9）

### 躓き: `class X extend TestCase` → `unexpected identifier "extend", expecting "{"`
- **何に躓いたか**: 継承キーワードを `extend`（s抜き）と書いてパースエラー。
- **根本の仕組み**: PHPの継承は `extends`（s付き）が予約語。`extend` は予約語ではない**ただの識別子**と解釈され、パーサは「`class 名前` の次は `extends 親` か `{` のはず」と期待しているのに識別子が来たので `expecting "{"` と報告した。エラー文の「expecting "{"」がクラス宣言行の構文崩れを指すヒント。
- **関連技術マップ**:
  - **予約語 vs 識別子**: `class`/`extends`/`implements` は予約語。綴り違いは「未定義の名前」扱いになり、文法エラーの位置が実際の原因の少し先にズレて出ることがある。
  - **パーサのエラー位置**: 構文エラーは「壊れた瞬間」ではなく「期待と違うトークンに出会った地点」で出る。報告位置の少し手前を疑う。
- **理解チェック**: 「`expecting "{"` と出たら、まずどこを疑う？」→ その直前のクラス/関数宣言行の綴り・記号崩れ。

## 関連ノート（Task 9 追記分）

- [2026-06-09 TDD-UseCase-UnitTest](./2026-06-09_TDD-UseCase-UnitTest.md) — Unit テスト（モックで部品単体）の回。今日はその対になる Feature（全経路・実DB）を実装。Unit と Feature の役割分担が腹落ちする。
- [2026-06-23 Inertia登録フォームTSX化と周辺設定の罠](./2026-06-23_Inertia登録フォームTSX化と周辺設定の罠.md) — 今日テストした登録機能（UseCase/Controller/route/redirect先）の実装回。旧 RegistrationTest を Task 8.5 で削除した経緯もここ。

## 次回への課題・疑問点（Task 9 追記分）

- [ ] provider_type の不正値テストはまだ無い（themes は埋めた）。固有ルールの穴を完全に塞ぐなら追加余地。
- [ ] 次は Task 10（管理者シード AdminUserSeeder・`ADMIN_SEED_PASSWORD` env必須方式）。`.env` 設定の宿題が絡む。

---
---

# 【同日 追記】Task 10/11: 管理者シード と Filament 審査リソース（Phase 1 完了）

**会話の概要**: env必須の管理者シーダーを作り、Filament v4 でパートナー審査画面を生成・カスタマイズして Phase 1 を完了した。「秘密はコードに書かない」「日本語ラベルをどの層に置くか（クリーンアーキ）」「cast が不正値を弾く」を学んだ。

## 今日学んだ概念（Task 10/11）

### Seeder（シーダー）
- **何か**: DB に初期データを投入するクラス。`php artisan db:seed` で実行。
- **なぜ必要か**: 管理者アカウントのような「最初から必要なデータ」をコードで再現可能に用意する。手で INSERT しない。
- **冪等（idempotent）**: 何度実行しても結果が同じになる性質。`updateOrCreate(['email'=>...], [...])` は「いれば更新・なければ作成」なので再 seed しても重複しない。

### 環境変数からの秘密の受け取り（fail-safe）
- **何か**: パスワード等を `env('ADMIN_SEED_PASSWORD')` で受け取り、未設定なら**作らずに警告で止める**。
- **なぜ必要か**: リポジトリは公開され得る。コードに弱いパスワードを書くと、本番 seed で既知パスワードの管理者（Filament 全権）が作られる事故になる。「動く」より「安全に止まる」を優先。

### Filament リソース（v4）
- **何か**: 管理画面の CRUD を1モデル分まとめて提供する単位。`make:filament-resource Partner --generate` で生成。
- **v4 の構造**: `app/Filament/Resources/Partners/` に `PartnerResource.php`（本体）＋ `Schemas/PartnerForm.php`（フォーム）＋ `Tables/PartnersTable.php`（一覧）＋ `Pages/` に分割。フォームは v3 の `Form` から **`Schema` ベース**に変わった。
- **`recordTitleAttribute`**: そのレコードを1文字列で代表させる属性（パンくず・検索表示）。Partner では `display_name`。

## 書いたコード（Task 10/11）

### 管理者シーダー（fail-safe ＋ 冪等）
```php
public function run(): void
{
    $password = env('ADMIN_SEED_PASSWORD');
    if (! $password) {
        $this->command->warn('ADMIN_SEED_PASSWORD が未設定のため管理者ユーザーを作成しません。');
        return;                                  // 安全に止まる
    }
    $email = env('ADMIN_SEED_EMAIL', 'admin@worldclass.jp');
    User::updateOrCreate(
        ['email' => $email],                     // 検索キー → 冪等
        ['name' => 'WorldClass Admin', 'password' => Hash::make($password), 'role' => 'admin'],
    );
}
```

### Filament: status バッジ（cast 済み列の扱い）
```php
TextColumn::make('status')
    ->badge()
    ->formatStateUsing(fn (PartnerStatus $state): string => match ($state) {
        PartnerStatus::Pending => '審査中',
        PartnerStatus::Approved => '承認',
        PartnerStatus::Suspended => '停止',
        PartnerStatus::Rejected => '不承認',
    })
    ->color(fn (PartnerStatus $state): string => match ($state) {
        PartnerStatus::Pending => 'warning',
        PartnerStatus::Approved => 'success',
        PartnerStatus::Suspended, PartnerStatus::Rejected => 'danger',
    });
```
**ポイント解説:**
- `status` は Task 8.6 で `PartnerStatus` に cast 済み → 閉じ関数の**引数 `$state` は enum オブジェクト**。だから `match ($state)` で型安全に分岐できる。
- Select のオプションは `['pending' => '審査中', ...]` のように **enum の `->value`（文字列）をキー**にした日本語の明示配列。

## なぜそう書くか（設計の理由）

- **日本語ラベルを Domain の enum ではなく Filament（表示層）に置いた**: ラベルを enum に持たせるには Filament の `HasLabel` インターフェースを Domain の `PartnerStatus` に実装する必要がある。それは **Domain 層が Filament（フレームワーク）に依存する**ことになり、「内側は外側を知らない」クリーンアーキ原則に反する。ラベル（見た目の都合）は表示層の責務なので、Filament 側に明示配列で持たせるのが正しい層分け。
- **`--generate` が cast を自動活用**: 生成時にモデルの cast を読み、`provider_type`/`status` を自動で Select 化してくれた。Task 8.6 の cast 投資がここで回収された。

## 躓きポイント深掘り（Task 10/11）

### 躓き: tinker で `"overseas_school " is not a valid backing value for enum ProviderType`
- **何に躓いたか**: 動作確認データを作る tinker コマンドで、`'provider_type' => 'overseas_school '`（末尾に半角スペース）と打ち、`ValueError` で弾かれた。
- **根本の仕組み**: `provider_type` は `ProviderType` enum に cast されている。Eloquent は値を代入する瞬間に `ProviderType::from('overseas_school ')` 相当を試み、有効な backing value（`'overseas_school'`）に一致しないと **ValueError を投げる**。**cast が無い素の string 列なら、末尾スペース付きの不正値が黙って保存され**、後で「一覧に出ない」等の地味なバグになっていた。型が書き込み時点で安全側に倒してくれた好例。
- **関連技術マップ**:
  - **`BackedEnum::from()` vs `tryFrom()`**: `from` は不一致で例外、`tryFrom` は null を返す。Eloquent の enum cast は `from` 系で厳格。
  - **多層防御の②（アプリ型）の実演**: 入口(FormRequest)を通らない経路（tinker/直接代入）でも、cast が最後にもう一段守ってくれる。
- **理解チェック**: 「cast 済み列に不正な文字列を代入するといつ気づける？」→ 代入/保存の瞬間に ValueError。string 列なら気づけず保存される。

## 関連ノート（Task 10/11 追記分）

- [2026-06-10 セキュリティレビュー観点](./2026-06-10_セキュリティレビュー観点.md) — 「秘密はコードに書かずenv／未設定なら止める」の原則。今日の AdminUserSeeder はその実装。
- [2026-06-08 マイグレーション型とテスト環境変数デバッグ](./2026-06-08_マイグレーション型とテスト環境変数デバッグ.md) — ValueObject(enum) の初出。今日その enum が Filament の Select 自動生成・cast の値検証で効いた。

## 次回への課題・疑問点（Task 10/11 追記分）

- [ ] Filament の Create ページは user_id をフォームから外したため、Filament 経由の新規作成は実質非対応（パートナーは自己登録が正規フロー）。Phase 2 以降で Create を無効化 or 調整するか検討。
- [ ] **Phase 1 完了。次は Phase 2（カタログ・予約・Stripe）**。計画書 `docs/superpowers/plans/2026-05-24-worldclass-phase2-catalog-booking-stripe.md`。
