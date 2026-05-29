# WorldClass — CLAUDE.md

AIエージェント向けのプロジェクト規約。実装前に必ず読むこと。

---

## プロジェクト概要

日本国内のご家庭・個人塾・サークル団体・公民館・図書館等と、発展途上国の学校や現地で活動する日本人をつなぐ、オンライン国際交流マッチングプラットフォーム。文化交流・英語学習・国際理解を1セッションで実現し、料金の50%を現地の教育施設へ物資支援として還元する。

**設計書:** `docs/superpowers/specs/2026-05-23-worldclass-design.md`  
**DB設計:** `docs/superpowers/specs/2026-05-29-worldclass-db-design.md`（ER図: `2026-05-29-worldclass-db-er.drawio`）  
**技術方針:** `docs/superpowers/specs/2026-05-25-worldclass-engineering-principles.md`

---

## 技術スタック

| 区分 | 技術 |
|---|---|
| バックエンド | Laravel 13 |
| 管理画面 | Filament v4 |
| フロントエンド | Inertia.js + React + TypeScript |
| DB | PostgreSQL 16 |
| キャッシュ/Queue | Redis 7 |
| 決済 | Stripe Checkout |
| 環境 | Docker Compose（カスタム） |
| テスト | Pest |
| CI | GitHub Actions |

---

## アーキテクチャ原則

**クリーンアーキテクチャ**を採用。依存の方向は 外側→内側のみ。

```
Http/Controllers → UseCases → Domain（Entities / Repositories Interface）
                                   ↑
                Infrastructure/Repositories（Eloquent実装）
```

### ディレクトリの役割

| ディレクトリ | 役割 |
|---|---|
| `app/Domain/` | ビジネスルール。Laravelに依存しない |
| `app/UseCases/` | ユースケース。フレームワーク非依存 |
| `app/Infrastructure/` | Eloquentリポジトリ・外部サービス実装 |
| `app/Http/Controllers/` | リクエスト受取・UseCase呼び出し・レスポンス返却のみ |
| `app/Models/` | Eloquentモデル（インフラ層扱い） |
| `app/Providers/AppServiceProvider.php` | DIバインディング |

### コントローラは薄く保つ

```php
// ✅ Good
public function store(RegisterMemberRequest $request): RedirectResponse
{
    $output = $this->registerMemberUseCase->execute(
        new RegisterMemberInput(/* $request から詰める */)
    );
    Auth::login($output->user);
    return redirect()->route('member.dashboard');
}

// ❌ Bad（ビジネスロジックをControllerに書かない）
public function store(Request $request): RedirectResponse
{
    $user = User::create([...]);
    $user->member()->create([...]);
    ...
}
```

---

## コーディング規約

### TDD（テスト駆動開発）

UseCase・Repository・Service は **テストファースト**。

```
🔴 Red   → 失敗するテストを書く
🟢 Green → 最小限のコードでテストを通す
🔵 Refactor → SOLIDに整える
```

テスト配置：
```
tests/Unit/UseCases/     # UseCase（モック使用）
tests/Feature/           # HTTP エンドポイント（DB使用）
tests/Integration/       # Repository（DB使用）
```

テスト実行：
```bash
docker compose exec app php artisan test
docker compose exec app php artisan test tests/Unit/
docker compose exec app php artisan test --filter=RegisterSchool
```

### コードスタイル

Laravel Pint（`pint.json` で設定済み）。

```bash
docker compose exec app ./vendor/bin/pint          # 自動修正
docker compose exec app ./vendor/bin/pint --test   # チェックのみ（CI用）
```

### Gitコミット（Conventional Commits）

```
feat(booking): add slot selection UI
fix(stripe): handle webhook signature mismatch
refactor(session): extract status to ValueObject
test(usecase): add CreateBookingUseCase unit tests
chore(docker): update PHP Dockerfile
docs(plan): update Phase 2 implementation plan
```

**type一覧:** `feat` `fix` `refactor` `test` `chore` `docs` `perf`

---

## よく使うコマンド

```bash
# Docker
docker compose up -d
docker compose exec app bash
docker compose down

# Laravel（コンテナ内で実行）
docker compose exec app php artisan migrate
docker compose exec app php artisan migrate:fresh --seed
docker compose exec app php artisan test
docker compose exec app php artisan make:model Foo -m
docker compose exec app php artisan make:usecase Foo   # ※手動作成
docker compose exec app ./vendor/bin/pint

# フロント
docker compose exec app npm run dev
docker compose exec app npm run build
```

---

## env管理

- `.env` → gitに含めない（`.gitignore` 対象）
- `.env.example` → テンプレとしてコミット済み
- 新しい環境変数を追加したら **必ず `.env.example` も更新する**

---

## 未実装フェーズ

| フェーズ | 内容 | 計画書 |
|---|---|---|
| Phase 1 | 認証・DB基盤・クリーンアーキ骨格 | `docs/superpowers/plans/2026-05-23-worldclass-plan1-foundation-laravel.md` |
| Phase 2 | カタログ・予約・Stripe | `docs/superpowers/plans/2026-05-24-worldclass-phase2-catalog-booking-stripe.md` |
| Phase 3〜5 | 準備フロー・物資支援・自治体 | 設計書参照 |
