# LaravelのセッションDB衝突回避とGitコミット規約

**日付**: 2026-06-06
**会話の概要**: WorldClass Phase 1 Task 4-0として、LaravelのセッションドライバをRedisに切り替え、ビジネス用 `sessions` テーブル名の衝突を解消した。あわせて `sed -i` コマンドとConventional Commitsのtypeについて学んだ。

---

## 今日学んだ概念

### LaravelのSESSION_DRIVERと名前衝突

- **何か**: Laravelは「ログイン中のユーザー情報」を一時保存する仕組み（セッション）を持ち、その保存先を `SESSION_DRIVER` で選ぶ
- **なぜ必要か**: `SESSION_DRIVER=database` にするとLaravelが `sessions` テーブルを使おうとするが、このプロジェクトでは `sessions` テーブルを「交流セッション枠（ビジネスドメイン）」として使いたいため名前が衝突する
- **解決策**: `SESSION_DRIVER=redis` にしてLaravelの認証セッションをRedisに保存させる → `sessions` テーブルをビジネス用途に自由に使える

| ドライバ | 保存先 |
|---|---|
| `database` | DBの `sessions` テーブル |
| `redis` | Redisのメモリ |
| `file` | サーバーのファイル |

### sed -i（インプレース編集）

- **何か**: `sed` コマンドでファイルを直接書き換えるオプション
- **なぜ必要か**: 通常の `sed` は結果を標準出力に出すだけでファイルを変更しない。`-i` をつけるとファイル自体を書き換える

```bash
sed 's/old/new/' file.txt        # ファイルは変わらず、結果が出力される
sed -i '' 's/old/new/' file.txt  # ファイル自体を書き換える（macOS）
```

- **macOSの注意点**: `-i ''` と空文字が必須。`-i '.bak'` にすると変更前のバックアップが `.bak` ファイルとして残る

---

## 書いたコード

### .env.example / .env の SESSION_DRIVER を redis に変更

```bash
sed -i '' 's/SESSION_DRIVER=database/SESSION_DRIVER=redis/' ".env.example"
sed -i '' 's/SESSION_DRIVER=database/SESSION_DRIVER=redis/' ".env"
```

**ポイント解説:**
- `'s/database/redis/'`: `s` は substitute（置換）。`s/検索/置換/` の形式
- `-i ''`: macOSでファイルを直接書き換える（空文字はバックアップなしの意味）

### users マイグレーションから sessions テーブル定義を削除

`database/migrations/0001_01_01_000000_create_users_table.php` の `up()` から以下を削除：

```php
// 削除した箇所（Laravelデフォルトのセッションテーブル定義）
Schema::create('sessions', function (Blueprint $table) {
    $table->string('id')->primary();
    $table->foreignId('user_id')->nullable()->index();
    $table->string('ip_address', 45)->nullable();
    $table->text('user_agent')->nullable();
    $table->longText('payload');
    $table->integer('last_activity')->index();
});
```

`down()` の `Schema::dropIfExists('sessions');` も削除。

---

## なぜそう書くか（設計の理由）

- **SESSION_DRIVER=redisを選んだ理由**: このプロジェクトはもともとRedisをキャッシュ・Queue用に使う構成。セッションもRedisに乗せることは自然な選択であり、`sessions` テーブル名をビジネスロジックに解放できる
- **マイグレーションからsessionsを削除した理由**: Laravelデフォルトのマイグレーションにはセッションテーブルが含まれているが、`SESSION_DRIVER=redis` に変えたことで不要になった。残したままにするとDBに使われないテーブルが作られてしまう

---

## Conventional Commits の type 一覧

Gitのコミットメッセージのルール。`type(scope): 説明` の形式で書く。

| type | 使いどころ |
|---|---|
| `feat` | 新機能の追加 |
| `fix` | バグ修正 |
| `refactor` | 動作を変えないコード整理 |
| `test` | テストの追加・修正 |
| `docs` | ドキュメントのみの変更 |
| `perf` | パフォーマンス改善 |
| `chore` | ビルド設定・依存関係・環境設定など、プロダクトコードに影響しない作業 |

今回は「セッションドライバの設定変更」でユーザー向け機能は何も増えていないため `chore` を使った。

---

## 次回への課題・疑問点

- [ ] Redisのセッション管理とDBのセッション管理でパフォーマンス・信頼性の違いは何か

---

# 追記：DB接続切り替えとLaravelのcasts

**追記時刻**: 2026-06-06（同日）
**内容**: SQLite→PostgreSQL切り替え、`casts()` の理解、`grep -A` オプション、`role` カラム追加

---

## 今日学んだ概念（追記）

### Laravelの casts()（型変換）

- **何か**: Eloquentモデルで、DBから取得した値を自動的に指定の型に変換する設定
- **なぜ必要か**: DBから取得した値は基本的に全て文字列で返ってくる。castがないと日付を文字列として扱うことになり、日付計算などができない

```php
protected function casts(): array
{
    return [
        'email_verified_at' => 'datetime',  // 文字列 → Carbonオブジェクト（日付型）
        'password'          => 'hashed',    // セット時に自動でHash::make()される
    ];
}
```

**castがあると：**
```php
$user->email_verified_at->format('Y年m月d日');  // "2026年06月06日"
$user->email_verified_at->diffForHumans();       // "3時間前"
```

**castがないと：** 文字列のままなのでメソッドが使えない

### grep の -A / -B / -C オプション

- **何か**: マッチした行の周辺行も一緒に表示するオプション

| オプション | 意味 |
|---|---|
| `-A n` | マッチ行の**後** n 行も表示（After） |
| `-B n` | マッチ行の**前** n 行も表示（Before） |
| `-C n` | 前後 n 行両方表示（Context） |

```bash
grep -A 20 "postgres\|pgsql\|db:" docker-compose.yml
# → "postgres" または "pgsql" または "db:" にマッチした行と、その後20行を表示
# \| は grep の OR 演算子
```

---

## 書いたコード（追記）

### .env の DB接続を SQLite → PostgreSQL に切り替え

```
DB_CONNECTION=pgsql
DB_HOST=db
DB_PORT=5432
DB_DATABASE=worldclass
DB_USERNAME=postgres
DB_PASSWORD=secret
```

**ポイント解説:**
- `DB_HOST=db`: docker-compose.yml でのサービス名が `db` なのでそのまま使える（Docker内部DNSで解決される）
- `migrate:fresh`: 全テーブルをDROPして最初からマイグレーションをやり直すコマンド。開発中にDB設定を変えたときに使う

### users テーブルへ role カラム追加マイグレーション

```php
public function up(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->enum('role', ['member', 'partner', 'admin'])
              ->default('member')
              ->after('email');
    });
}

public function down(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->dropColumn('role');
    });
}
```

**ポイント解説:**
- `enum`: 決まった値しか入れられない型。`'member'`, `'partner'`, `'admin'` 以外はDB側で弾かれる
- `->default('member')`: カラム追加時のデフォルト値。既存ユーザーや指定なし時は自動で `member` になる
- `->after('email')`: PostgreSQLでは効果なし（MySQLのみ有効）だが、可読性のために書く慣習がある

### User モデルの更新（Laravel 13 属性スタイル）

```php
#[Fillable(['name', 'email', 'password', 'role'])]  // role を追加

public function canAccessPanel(Panel $panel): bool
{
    return $this->role === 'admin';  // admin のみ管理画面へアクセス可
}

public function member()
{
    return $this->hasOne(Member::class);
}

public function partner()
{
    return $this->hasOne(Partner::class);
}
```

---

## なぜそう書くか（設計の理由）（追記）

- **DB_HOST=db にした理由**: Docker Compose では同じネットワーク内のサービスをサービス名で名前解決できる。`db` は docker-compose.yml で定義したPostgreSQLサービスの名前
- **canAccessPanel を admin のみにした理由**: Filament管理画面はシステム管理者だけが使うもの。member/partner が誰でもアクセスできると情報漏洩のリスクがある

---

## 次回への課題・疑問点（追記）

- [ ] Task 4-2: `members` テーブルのマイグレーション作成

---

# 追記2：RedisとDBのセッション比較・make:model フラグ

**追記時刻**: 2026-06-06（同日）

---

## 今日学んだ概念（追記2）

### Redis vs DB セッション管理

| | Redis | Database |
|---|---|---|
| 保存先 | メモリ（RAM） | ディスク（HDD/SSD） |
| 読み書き速度 | マイクロ秒単位（圧倒的に速い） | ミリ秒単位 |
| 再起動時 | データが消える（デフォルト） | 残る |
| 永続化 | 設定すれば可能 | デフォルトで永続 |

**なぜセッションはRedisで十分か：**

```
セッション = 「今ログイン中ですよ」という一時的な情報
→ 消えてもログアウトになるだけ（大きな問題ではない）
→ 永続性より速さが重要
→ Redis が向いている
```

ショッピングカートの中身・決済情報など「消えたら困るデータ」はDBへ。セッションはそういった用途ではないのでRedisで十分。

### make:model の各フラグ

`-m` は `--migration` の短縮形。モデル生成時に関連ファイルをまとめて作れる。

| フラグ | 意味 |
|---|---|
| `-m` | マイグレーションも生成 |
| `-c` | コントローラも生成 |
| `-r` | リソースコントローラも生成 |
| `-f` | ファクトリも生成 |
| `-s` | シーダーも生成 |
| `--all` | 全部まとめて生成 |

```bash
php artisan make:model Member        # app/Models/Member.php のみ
php artisan make:model Member -m     # モデル + マイグレーションを生成
```

---

## 次回への課題・疑問点（追記2）

- [ ] Task 4-2: `members` マイグレーションの中身を書く

---

# 追記3：Redisの永続化設定（RDB / AOF）

**追記時刻**: 2026-06-06（同日）

---

## 今日学んだ概念（追記3）

### RDB（Redis Database Snapshot）

定期的にメモリの全データをファイルに保存する方式。

```
メモリ → [5分ごと] → dump.rdb（ファイル）
```

- 軽くて高速
- 再起動すると最大5分分のデータが消える可能性あり
- バックアップ用途に向いている

### AOF（Append Only File）

書き込み命令を全てログとして記録する方式。

```
SET user:1 "田中"  →  appendonly.aof に追記
SET user:2 "山田"  →  appendonly.aof に追記
```

- 書くたびに記録するのでほぼデータロスなし
- ファイルが大きくなりやすい
- 本番DBに近い信頼性

### 比較まとめ

| | RDB | AOF |
|---|---|---|
| データロスの可能性 | 数分分 | ほぼなし |
| パフォーマンス | 速い | やや遅い |
| ファイルサイズ | 小さい | 大きくなりやすい |
| 用途 | キャッシュ・セッション | 重要データの永続化 |

### このプロジェクトでは？

セッション・キャッシュ用途なので**どちらも不要**。再起動でセッションが消えてもログアウトになるだけで問題ない。本番でも `appendonly no`（AOF無効）のままで十分。

---

## 次回への課題・疑問点（追記3）

- [ ] Task 4-2: `members` マイグレーションの中身を書く
- [ ] RDBとAOFを**両方有効**にすることもできるのか調べる
