# SlotService の TDD実装 と「Unitテスト」の正体

**日付**: 2026-06-30
**会話の概要**: Phase2 Task4。予約可能スロット計算（SlotService）をTDD（🔴Red→🟢Green）で実装。途中、「なぜUnitテストなのにDBを使うのか」「クリーンアーキ的にOKか」を深掘りした。

---

## 今日学んだ概念

### TDDの 🔴Red は「正しい理由で落ちる」ことを確認する工程
- **何か**: 実装を書く前にテストを書き、まず失敗させる。
- **なぜ必要か**: テスト自身が正しく動くことの保証。最初から緑だと「テストが何も検証していない」可能性がある。
- **例え**: 火災報知器を設置したら、まずわざと煙を当てて鳴るか確かめる。鳴らない報知器は付いていないのと同じ。
- 今日の Red は全7本が `Class "App\Services\SlotService" not found`。これは「クラスが無いから落ちた」＝**意図どおりの理由**。アサーション失敗（ロジック誤り）で落ちたのではない、という切り分けが重要。

### tests/Unit に置いても「純粋な単体テスト」とは限らない
- **何か**: Laravelの `tests/Unit` / `tests/Feature` は単なるフォルダ慣習。厳密な単体/結合の線引きではない。
- **なぜ必要か**: 「Unitフォルダ＝DB禁止」と思い込むと、今回のような違和感に振り回される。
- このプロジェクトの実際の定義（CLAUDE.md）:
  - `tests/Unit/UseCases/` … UseCase（**モック**使用＝真の単体）
  - `tests/Feature/` … HTTPエンドポイント（DB使用）
  - `tests/Integration/` … Repository（DB使用）
- SlotServiceTest は DB を使うので**定義上は Integration 寄り**。だが「HTTPを経由せず1クラスだけ直接叩く」緩い意味で Unit に置いている。

### Tests\TestCase と PHPUnit\Framework\TestCase の違い（RefreshDatabaseが動く条件）
- **何か**: テストの継承元で「Laravelアプリが起動するか」が決まる。
- `Tests\TestCase` を継承 → Laravelアプリ起動 → DB接続・コンテナ・`RefreshDatabase` が使える。
- `PHPUnit\Framework\TestCase` を継承 → Laravel起動せず → `RefreshDatabase` は**動かない**。
- 「tests/Unit に置きつつ DB を使える」のは、このファイルが `Tests\TestCase` を継承しているから。フォルダ名ではなく**継承元**が実態を決める。

---

## 書いたコード

### SlotService（予約可能スロット計算）

```php
class SlotService
{
    private const BLOCKING_STATUSES = ['draft', 'open', 'confirmed', 'ready'];

    public function getAvailableSlots(Partner $partner): array
    {
        $tz        = 'Asia/Tokyo';
        $startDate = Carbon::today($tz)->addDays(7);  // 予約締切=1週間前
        $endDate   = Carbon::today($tz)->addDays(42);
        // ... blockedDates / bookedKeys を flip() で連想配列化 ...
        foreach ($schedules as $schedule) {
            // 窓内を1日ずつ走査し、曜日一致＆未ブロック＆未予約のみ slots に積む
            $dow = $current->dayOfWeekIso - 1; // 0=Mon…6=Sun
        }
    }
}
```

**ポイント解説:**
- `BLOCKING_STATUSES = ['draft', ...]`: 決済中の `draft` 枠も「埋まっている」扱い。これで**超過販売（同じ枠を二重に売る）を防ぐ**。`cancelled` は含めない＝キャンセル枠は再販可能。
- `->flip()`: `['2026-06-08' => 0, ...]` のように値とキーを反転。判定が `isset($blocked[$date])` の **O(1)** になる。`in_array`（O(n)）の繰り返しより速い。
- `dayOfWeekIso - 1`: Carbonの ISO曜日は 月=1…日=7。DBは 0=Mon…6=Sun。`-1` で揃える。**ここがズレると全テストが崩れる急所**。
- `$s->scheduled_at->setTimezone('Asia/Tokyo')->format('Y-m-d_H:i')`: DBはUTC保存・比較はJST。**保存UTC / 表示・比較JST** の往復。

---

## なぜそう書くか（設計の理由）

- **窓を「7日後〜42日後」に固定**: 予約締切が1週間前なので、今日・明日の枠を出すと締切を破れてしまう。下限7日・上限42日（6週間先）でビジネスルールをコードに落とす。
- **isAvailable() を別メソッドで用意**: 予約POST時にサーバー側で「そのスロットが本当に空いているか」を再検証するため。フロントの表示を信用せず、`getAvailableSlots` に実在するかで判定（スケジュール外・締切超過・二重予約を一括で弾く）。

---

## 躓きポイント深掘り

### 「Unitテストなのに RefreshDatabase（DB）を使うのは矛盾では？」
- **何に躓いたか**: `tests/Unit` 配下なのに `use RefreshDatabase;` でDBを触っている違和感。
- **根本の仕組み**: SlotService が `$partner->schedules` 等の **Eloquentにべったり依存**しているため、DB無しで testするには大量のクエリビルダのモックが要り、壊れやすく読みにくい。それなら本物のDBに1行INSERTする方がテストの意図が素直に書ける、という割り切り。フォルダ名は慣習にすぎず、継承元が `Tests\TestCase` だからDBが使える。
- **関連技術マップ**:
  - **テストダブル（モック/スタブ）**: 依存を偽物に差し替える技。UseCaseテストでは使うが、Eloquentクエリのモックは高コストなので今回は実DBを選んだ。
  - **RefreshDatabase**: 各テスト前にDBをまっさらに戻すトレイト。テスト間の汚染を防ぐ。
  - **テストピラミッド**: 単体(多)→結合→E2E(少)。フォルダ名より「何を検証しているか」で考える。
- **理解チェック**: なぜこのテストは `PHPUnit\Framework\TestCase` ではなく `Tests\TestCase` を継承する必要があるのか？（答: 後者でないとLaravelが起動せず RefreshDatabase もDB接続も動かないから）

### 「Eloquentを直接触るService はクリーンアーキ的にOKか？」
- **何に躓いたか**: クリーンアーキ採用プロジェクトで、SlotServiceがビジネスルール（窓・締切・塞ぐ判定）とインフラ（Eloquentクエリ）を1クラスに混ぜている点。
- **根本の仕組み**: 厳密な定義では NG寄り。純粋にするなら「Domain層に SlotPolicy（ルールだけ・Eloquent知らない）／ Repositoryインターフェース＋Eloquent実装（DB取得だけ）／ UseCaseで組み合わせ」と3〜4層に分解できる。だが今回のロジックは `whereIn('status', BLOCKING_STATUSES)` のような**クエリ条件そのものがロジックの核**で、Repositoryに切り出すと逆に追いづらい。この規模では Service 層が現実的な落としどころ、という**意図的な妥協**。
- **関連技術マップ**:
  - **依存性逆転（DIP）**: 内側がインターフェース、外側が実装。純粋版ではRepositoryインターフェースで実現する。
  - **オーバーエンジニアリング**: 小規模で層を増やしすぎると保守コストが利点を上回る。妥協の判断軸。
  - **Service層 vs UseCase層**: フレームワーク非依存にしたいならUseCase＋Domain、クエリが本体の計算系はServiceで割り切る、という使い分け。
- **理解チェック**: 「クリーンアーキだから全部Domain/UseCaseに置く」は正しいか？（答: No。Eloquentのクエリ条件がロジックの本体になる計算系はServiceに置くのが現実的、という線引きをこのプロジェクトは採用している）

---

## 関連ノート

- [2026-06-25 Stripe設定とスロット管理マイグレーション](./2026-06-25_Stripe設定とスロット管理マイグレーション.md) — 今日のSlotServiceが読む `partner_schedules`（週次パターン）/`partner_schedule_blocks`（例外）の2テーブルを作った回。本日はそのデータを使う計算ロジック。
- [2026-06-09 TDD-UseCase-UnitTest](./2026-06-09_TDD-UseCase-UnitTest.md) — TDDの基本とモックを使う"真の"単体テスト。今日はその対比（DBを使う割り切り）を理解した。
- [2026-06-24 enum→string化とbacked-enum-cast](./2026-06-24_enum→string化とbacked-enum-cast.md) — 「日本語ラベルはDomainに置かない」等のクリーンアーキ判断。今日の「Eloquent依存ServiceはOKか」と同じ"層の線引き"の話。

---

## 次回への課題・疑問点

- [ ] 🟢 Green（7件PASS）を確認してコミットする（Task4 Step4）。
- [ ] 純粋版（SlotPolicy + Repository + UseCase）に分解する練習を、余裕があればやってみる。
- [ ] 次は Task5 StripeService（participant単位Checkout）。
