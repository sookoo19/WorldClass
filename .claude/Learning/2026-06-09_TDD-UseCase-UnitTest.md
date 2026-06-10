# TDD と UseCase ユニットテスト

**日付**: 2026-06-09
**会話の概要**: TDDの概念を学び、RegisterMemberUseCase・RegisterPartnerUseCase のユニットテストを PHPUnit で書いた。途中でアーキテクチャの問題を発見し、`UserRepositoryInterface` を導入してクリーンアーキテクチャに整えた。

---

## 今日学んだ概念

### TDD（テスト駆動開発）
- **何か**: テストを先に書いてから実装するコーディングスタイル
- **なぜ必要か**: 仕様を先に確定できる・テストが安全網になりデグレを即検知できる・テストしやすい設計 = 良い設計になる
- **サイクル**:
  1. 🔴 Red: 失敗するテストを先に書く（実装がないので当然失敗）
  2. 🟢 Green: テストが通る最小限のコードを書く
  3. 🔵 Refactor: テストを通したまま、コードを整える

### Mockery（モック）
- **何か**: 本物のクラスの「偽物」を作るライブラリ。DB やメール送信など「外部」を差し替えるために使う
- **なぜ必要か**: Unit テストは「そのクラスだけ」をテストしたい。DB に依存すると遅い・環境依存・テスト範囲が広がりすぎる
- **例え**: 飛行機のシミュレーター。本物の飛行機（DB）を使わず、操縦桿の動き（UseCase の処理）だけを確認する

### UserRepositoryInterface（リポジトリインターフェース）
- **何か**: 「User の保存方法」を定義した契約書。実装（Eloquent）とロジック（UseCase）を切り離す
- **なぜ必要か**: UseCase が `User::create()` を直接呼ぶと、テスト時に DB が必要になる。インターフェース経由にすればモックで差し替えられる
- **例え**: コンセントの形（インターフェース）が決まっていれば、日本製でもアメリカ製でも差し込める

---

## 書いたコード

### UserRepositoryInterface（Domain 層）

```php
// app/Domain/Repositories/UserRepositoryInterface.php
interface UserRepositoryInterface
{
    public function create(array $attributes): User;
}
```

**ポイント解説:**
- `interface`: 「このメソッドを持つこと」だけを約束する。実装は書かない
- Domain 層に置くことで、Laravel（Eloquent）に依存しない

### EloquentUserRepository（Infrastructure 層）

```php
// app/Infrastructure/Repositories/EloquentUserRepository.php
class EloquentUserRepository implements UserRepositoryInterface
{
    public function create(array $attributes): User
    {
        return User::create($attributes);
    }
}
```

**ポイント解説:**
- `implements`: インターフェースの約束を守ることを宣言
- 実際の DB 操作はここだけに閉じ込める。UseCase は知らなくていい

### UseCase でインターフェースを使う

```php
// app/UseCases/Auth/RegisterMemberUseCase.php
class RegisterMemberUseCase
{
    public function __construct(
        private UserRepositoryInterface   $userRepository,   // ← 追加
        private MemberRepositoryInterface $memberRepository,
    ) {}

    public function execute(RegisterMemberInput $input): RegisterMemberOutput
    {
        $user = $this->userRepository->create([  // User::create() から変更
            'name'     => $input->name,
            'email'    => $input->email,
            'password' => Hash::make($input->password),
            'role'     => 'member',
        ]);
        // ...
    }
}
```

**ポイント解説:**
- コンストラクタで `UserRepositoryInterface` を受け取る（依存性注入）
- `User::create()` の直接呼び出しをなくした → テスト時にモックで差し替え可能になる

### ユニットテストの書き方

```php
// tests/Unit/UseCases/RegisterMemberUseCaseTest.php
class RegisterMemberUseCaseTest extends TestCase
{
    public function test_利用者を登録してmemberロールが付与される(): void
    {
        // 1. 偽物（モック）を作る
        $user = new User(['email' => 'family@example.com', 'role' => 'member']);

        $userRepo = Mockery::mock(UserRepositoryInterface::class);
        $userRepo->shouldReceive('create')
            ->once()                          // 1回だけ呼ばれること
            ->with(Mockery::on(fn ($attrs) => // 引数の検証
                $attrs['role'] === 'member'
            ))
            ->andReturn($user);               // 返す値を指定

        $memberRepo = Mockery::mock(MemberRepositoryInterface::class);
        $memberRepo->shouldReceive('create')->once()->andReturn(new Member());

        // 2. UseCase を動かす
        $useCase = new RegisterMemberUseCase($userRepo, $memberRepo);
        $output = $useCase->execute($input);

        // 3. 結果を検証
        $this->assertSame('member', $output->user->role);
        $this->assertSame('family@example.com', $output->user->email);
    }
}
```

**ポイント解説:**
- `Mockery::mock(Interface::class)`: インターフェースの偽物を作成
- `shouldReceive('create')->once()`: `create` が1回呼ばれることを期待。呼ばれなければテスト失敗
- `andReturn($user)`: 呼ばれたときに返す値を指定
- DB は一切使わない → 高速・安定

---

## なぜそう書くか（設計の理由）

- **Pest → PHPUnit に変更した理由**: Pest（`it()` 構文）は `pestphp/pest-plugin-laravel` が Laravel 13 未対応のためインストール不可。PHPUnit クラス形式で代替した
- **`RefreshDatabase` を使わなかった理由**: Unit テストは DB に依存すべきでない。`RefreshDatabase` を使うと「インフラ（DB）が正しいか」もテスト対象になり、Unit テストの目的（UseCase ロジックだけを検証）から外れる
- **`UserRepositoryInterface` を導入した理由**: UseCase が `User::create()` を直接呼ぶのはクリーンアーキテクチャ違反。UseCase（ビジネスロジック層）が Eloquent（インフラ層）に依存してしまう。インターフェースを挟むことで依存の方向を正した

---

## 次回への課題・疑問点

- [x] Task 7: ロール保護ミドルウェア（`EnsureRole`）の実装 ← 完了・下記に整理済み
- [x] Feature テスト（Task 9）は DB を使う → `RefreshDatabase` を使う。Unit と Feature でテスト戦略が違う理由を整理する ← 下記に整理済み
- [ ] Pest が Laravel 13 に対応したら導入し直すか検討する
- [ ] `Mockery::on(fn ($attrs) => ...)` の引数検証の書き方をもっと練習する

---

## 追記: Unit vs Feature テスト戦略の違い

### 目的の違い

- **Unit テスト**: クラス1つのロジックを検証。UseCase が「正しい引数でリポジトリを呼んだか」だけを確認する
- **Feature テスト**: HTTP リクエスト〜DB〜レスポンスの全経路を検証。「登録フロー全体が繋がって動くか」を確認する

### なぜ Unit は DB を使わないか

UseCase の責務は「受け取ったデータを正しく処理すること」。DB が実在するかは関係ない。

```
UseCase が確認すること:
  ✅ userRepository.create() を正しい引数で呼んだか
  ✅ memberRepository.create() に正しい値を渡したか
  ❌ DB にデータが実際に保存されたか（← それはリポジトリの責務）
```

モックで差し替えることで、DB なしで高速・安定したテストが書ける。

### なぜ Feature は DB を使うか

HTTP → Controller → UseCase → Repository → DB → レスポンスの**全経路**が正しく繋がっているか確認するため。

```php
// tests/Feature/Auth/RegisterMemberTest.php
it('利用者（ご家庭）が登録できる', function () {
    $this->post('/register/member', [...]);

    // DB に実際にデータが入ったか確認する → DB が必要
    $user = User::where('email', 'family@example.com')->first();
    expect($user->role)->toBe('member');
    expect(Member::where('user_id', $user->id)->exists())->toBeTrue();
});
```

モックでは「本当に保存されたか」を確認できない。

### RefreshDatabase の役割

```php
use RefreshDatabase; // Feature テストクラスに付ける
```

- テスト実行前にマイグレーションを走らせる（テーブルを作る）
- テスト後にロールバック（前のテストのデータが残らない）
- 毎回クリーンな DB 状態を保証する

### まとめ

```
Unit テスト  → 「部品が正しく動くか」→ モック使用・高速・DB不要
Feature テスト → 「全体が繋がって動くか」→ 実DB使用・RefreshDatabase必須
```

Unit だけでは「部品は正しいが繋いだら壊れる」を検知できない。両方あって初めてテスト戦略が完成する。

---

## 追記: ロール保護ミドルウェア（Task 7）

### ミドルウェアとは

リクエストがコントローラに届く前に実行される「門番」。

```
ブラウザ → [ミドルウェア] → Controller → レスポンス
```

### EnsureRole ミドルウェア

```php
// app/Http/Middleware/EnsureRole.php
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): mixed
    {
        if (! Auth::check()) {
            return redirect()->route('login');  // 未ログイン → ログインページへ
        }

        if (! in_array(Auth::user()->role, $roles, true)) {
            abort(403, 'このページへのアクセス権限がありません。');  // role 不一致 → 403
        }

        return $next($request);  // OK → 次の処理へ
    }
}
```

**ポイント解説:**
- `string ...$roles`: 可変長引数。`'role:member,partner'` のように複数ロールも受け取れる
- `in_array(..., true)`: 厳密比較（型も一致しているか確認）
- `$next($request)`: 問題なければ次の処理（Controller）に渡す

### bootstrap/app.php でエイリアス登録

```php
$middleware->alias([
    'role' => \App\Http\Middleware\EnsureRole::class,
]);
```

- 登録することでルートで `'role:member'` という短縮名が使えるようになる

### routes/web.php でロール別ルート定義

```php
// member だけ入れる
Route::middleware(['auth', 'role:member'])->prefix('member')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'member'])->name('member.dashboard');
});

// partner だけ入れる
Route::middleware(['auth', 'role:partner'])->prefix('partner')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'partner'])->name('partner.dashboard');
});
```

**ポイント解説:**
- `['auth', 'role:member']`: ミドルウェアを配列で複数指定。`auth`（ログイン確認）→ `role:member`（ロール確認）の順に実行
- `prefix('member')`: グループ内の全 URL に `/member` プレフィックスを付ける
- `group(function () {...})`: まとめてミドルウェアを適用できる

### なぜミドルウェアを使うか

Controller に直接 `if ($user->role !== 'member') abort(403)` を書くと、ルートが増えるたびに同じコードを繰り返す。ミドルウェアに一箇所まとめることで DRY（繰り返しを避ける）原則を守れる。

---

## 追記: Task 8（登録フォーム・途中）

### FormRequest とは

バリデーション専用クラス。Controller からバリデーションロジックを分離する。

```php
// app/Http/Requests/RegisterMemberRequest.php
class RegisterMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // 誰でも送信OK（登録フォームは未ログインユーザーが使う）
    }

    public function rules(): array
    {
        return [
            'email'        => ['required', 'email', 'unique:users'],
            'password'     => ['required', 'confirmed', Rules\Password::defaults()],
            'type'         => ['required', 'in:family,cram_school,circle,public_facility,other'],
            'themes.*'     => ['in:culture,english,global'],  // 配列の各要素を検証
            // ...
        ];
    }
}
```

**ポイント解説:**
- `authorize()`: `return true` = 誰でも送信OK。条件付きにすれば権限チェックも可能
- `'unique:users'`: users テーブルに同じメールが存在しないか確認
- `'confirmed'`: `password` と `password_confirmation` が一致するか確認
- `'themes.*'`: 配列フィールドの各要素に対してバリデーションを適用

### コンストラクタインジェクション（依存性注入）

```php
class RegisteredUserController extends Controller
{
    public function __construct(
        private RegisterMemberUseCase  $registerMemberUseCase,
        private RegisterPartnerUseCase $registerPartnerUseCase,
    ) {}
}
```

- `private` をコンストラクタ引数につける → 自動でプロパティに保存される
- Laravel が AppServiceProvider のバインディングを見て UseCase を自動生成・注入
- 直接 `new RegisterMemberUseCase(...)` しないことで、テスト時にモック差し替えが容易になる

### Controller → UseCase の繋ぎ込み

```php
public function storeMember(RegisterMemberRequest $request): RedirectResponse
{
    $output = $this->registerMemberUseCase->execute(
        new RegisterMemberInput(
            email:       $request->email,
            password:    $request->password,
            name:        $request->name,
            // ...
        )
    );

    event(new Registered($output->user));
    Auth::login($output->user);

    return redirect()->route('member.dashboard');
}
```

**ポイント解説:**
- `RegisterMemberRequest` を型宣言するだけでバリデーションが自動実行される
- `event(new Registered($output->user))`: メール認証イベントを発火（Laravel 標準）
- Controller の責務は「受け取る・UseCase に渡す・リダイレクト」だけ。ビジネスロジックは書かない

---

## 次回: Task 8 続き・Task 9

- [ ] `RegisterMember.tsx` / `RegisterPartner.tsx` 作成（フロント登録フォーム）
- [ ] Task 9: Feature テスト（登録フロー）
- [ ] Task 10: AdminUserSeeder
- [ ] Task 11: Filament PartnerResource
