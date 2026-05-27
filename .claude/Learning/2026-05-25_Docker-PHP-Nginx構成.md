# Docker構成の理解：PHP-FPM / Nginx / docker-compose.yml

**日付**: 2026-05-25
**会話の概要**: WorldClassプロジェクトのDocker設定ファイル3本（Dockerfile・nginx設定・docker-compose.yml）の役割と仕組みを深掘りした。合わせてDockerfileの根本的な役割と、PHP拡張の追加方法も学んだ。

---

## 今日学んだ概念

### PHP-FPM（FastCGI Process Manager）
- **何か**: PHPをWebサーバーとは別プロセスとして動かす仕組み
- **なぜ必要か**: NginxはHTTPリクエストの受け渡しは得意だが、PHPコードは実行できない。PHP-FPMがPHPの実行を専門に担当し、結果だけNginxに返す
- **例え**: レストランでいう「フロアスタッフ（Nginx）」と「シェフ（PHP-FPM）」の分業。注文を取るのはフロア、料理を作るのはシェフ

### FastCGIプロトコル
- **何か**: WebサーバーとPHPプロセスが通信するための約束ごと（プロトコル）
- **なぜ必要か**: NginxとPHP-FPMは別コンテナ・別プロセスのため、やり取りの形式を統一する必要がある
- **例え**: 電話で注文を伝えるときのフォーマット（「商品名・数量・配送先」という順番で話す）に相当

### Dockerfileの役割（設計図 → Image → Container）
- **何か**: アプリが動く環境の「設計図」
- **なぜ必要か**: 開発者ごとにPHPバージョンや拡張の有無が違うと「自分のPCでは動くのに…」問題が起きる。Dockerfileで環境を固定すれば全員が同じ環境で開発できる
- **例え**: IKEAの家具の組み立て説明書。同じ説明書（Dockerfile）から必ず同じ家具（Image）が作れる

### 名前付きボリューム
- **何か**: Dockerが管理するデータ永続化の仕組み（`pgdata`, `redisdata`）
- **なぜ必要か**: コンテナは停止すると中のデータが消える。ボリュームに保存することでDBのデータを維持できる
- **注意**: `docker compose down -v` を付けるとボリュームごと削除されるため本番では厳禁

### ヘルスチェック（healthcheck）
- **何か**: コンテナが「起動しているか」ではなく「使える状態か」を確認する仕組み
- **なぜ必要か**: PostgreSQLはプロセス起動後も接続を受け付けるまで数秒かかる。`service_healthy` を使うと本当に準備完了してからPHPコンテナが起動する

---

## 設定ファイルの解説

### docker/php/Dockerfile

```dockerfile
FROM php:8.3-fpm                          # ベースイメージ（OS + PHP本体）

RUN apt-get update && apt-get install -y \
    git curl zip unzip libpq-dev libzip-dev \   # OSレベルのCライブラリ
    && docker-php-ext-install pdo pdo_pgsql zip bcmath \  # PHP公式拡張
    && pecl install redis && docker-php-ext-enable redis   # コミュニティ拡張

# Node.js 20 LTS（フロントエンドビルド用）
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Composerバイナリだけを別イメージからコピー（マルチステージビルド）
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
```

**ポイント解説:**
- `libpq-dev`: PostgreSQL接続に必要なCヘッダーファイル。これがないと `pdo_pgsql` のビルドに失敗する
- `bcmath`: 浮動小数点の誤差を防ぐ精度計算拡張。Stripeの金額計算に使う
- `COPY --from=composer:2`: マルチステージビルド。`composer:2` イメージからバイナリだけを借りてくる技法。Image容量を増やさずにComposerを使える

### docker/nginx/default.conf

```nginx
server {
    listen 80;
    root /var/www/html/public;   # Laravelのpublicだけ公開（セキュリティ設計）
    index index.php;

    # ① まずファイルを探す → ② ディレクトリを探す → ③ なければLaravelへ
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # .phpファイルはNginxが実行せず、PHP-FPMに丸投げ
    location ~ \.php$ {
        fastcgi_pass app:9000;   # appコンテナの9000番ポートへ転送
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    }
}
```

**ポイント解説:**
- `try_files`: `/school/dashboard` などのURLを「ファイルがなければindex.phpへ」とルーティングする。これでLaravelのルーター（Router）が全URLを処理できる
- `app:9000`: `app` はdocker-compose.ymlのサービス名。Dockerの内部DNSで自動解決される

### docker-compose.yml（重要部分）

```yaml
services:
  app:
    build:
      context: .
      dockerfile: docker/php/Dockerfile
    volumes:
      - .:/var/www/html          # ホストのファイルをリアルタイムで反映
    depends_on:
      db:
        condition: service_healthy   # DBが本当に使える状態になってから起動

  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"                   # ホスト80番 → コンテナ80番
    volumes:
      - .:/var/www/html
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf

  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 5
    volumes:
      - pgdata:/var/lib/postgresql/data   # データ永続化

volumes:
  pgdata:     # docker compose down しても消えない
  redisdata:
```

---

## なぜそう書くか（設計の理由）

- **appのポートを公開しない**: nginxだけが`:80`を公開し、appはホストに直接ポートを露出しない。外部からPHPに直接アクセスできない構造にすることでセキュリティを高める
- **Laravelのrootをpublicにする**: `app/` や `config/` などの内部ファイルをWebから直接アクセス不可にするLaravelの標準設計。`.env` ファイルが外から見える事故を防ぐ
- **ホストマウント（`.:/var/www/html`）**: ローカルで編集したファイルが即コンテナに反映される。`npm run dev` のホットリロードが機能する理由もこれ

---

## PHP拡張の3種類

| 種類 | コマンド | 例 |
|---|---|---|
| PHP公式拡張 | `docker-php-ext-install` | `pdo`, `zip`, `intl`, `gd` |
| コミュニティ拡張 | `pecl install` + `docker-php-ext-enable` | `redis`, `imagick` |
| OS依存ライブラリ | `apt-get install` | `libpq-dev`, `libicu-dev` |

### このプロジェクトで将来追加を検討できる拡張

| 拡張 | 用途 |
|---|---|
| `intl` | 多言語・日付フォーマット（国際交流PFとして特に有用） |
| `gd` / `imagick` | 画像リサイズ（プロフィール写真） |
| `pcntl` | Laravelキューワーカーのgraceful shutdown |
| `opcache` | PHP実行の高速化（本番環境で必須） |

---

## 次回への課題・疑問点

- [ ] `opcache` を本番Dockerfileに追加するとどれくらい速くなるか試してみる
- [ ] `docker compose exec app bash` で実際にコンテナ内を探索してみる（どのファイルが見えるか）
- [ ] `healthcheck` の `retries: 5` を超えるとどうなるか確認する
- [ ] `WORKDIR` を設定しないとどのディレクトリが初期値になるか
