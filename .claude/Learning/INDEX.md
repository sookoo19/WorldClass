# Learning Index

※ファイル名から自動生成した初期索引。各行の概念キーワードは次回の学習記録時に本文を参照して補完する。

- [00_CORE ジュニア核心まとめ](./00_CORE_ジュニア核心まとめ.md) — 【常設・横断の総まとめ】設計/テスト/型/整合性/環境/セキュリティ/デバッグ/プロセスの本質原則。迷ったらまずここ。learning-recorder実行ごとに更新

- [2026-05-25 Docker-PHP-Nginx構成](./2026-05-25_Docker-PHP-Nginx構成.md) — Docker・PHP・Nginx構成
- [2026-05-27 Meta広告LP実装](./2026-05-27_Meta広告LP実装.md) — Meta広告・LP実装
- [2026-05-29 npm依存解決-TypeScript導入](./2026-05-29_npm依存解決-TypeScript導入.md) — npm依存解決・TypeScript導入
- [2026-06-06 Laravelセッション衝突回避とGit規約](./2026-06-06_Laravelセッション衝突回避とGit規約.md) — Laravelセッション・Git規約
- [2026-06-08 マイグレーション型とテスト環境変数デバッグ](./2026-06-08_マイグレーション型とテスト環境変数デバッグ.md) — マイグレーション・テスト環境変数デバッグ
- [2026-06-09 TDD-UseCase-UnitTest](./2026-06-09_TDD-UseCase-UnitTest.md) — TDD・UseCase・UnitTest
- [2026-06-10 セキュリティレビュー観点](./2026-06-10_セキュリティレビュー観点.md) — セキュリティレビュー観点
- [2026-06-23 Inertia登録フォームTSX化と周辺設定の罠](./2026-06-23_Inertia登録フォームTSX化と周辺設定の罠.md) — Inertia/Ziggy分離・route()型宣言(global.d.ts)・jsx→tsx型付き移行・import.meta.glob・Laravel i18n(lang/ja)。【追記Task8.5】DB::transaction原子性・throttle・unique制約・Facadeモック・中立dashboardルート。躓き: tsxからjsx部品importの型エラー・REDIS_HOST=service名・npm #4828・route('dashboard')不在で全テスト赤
- [2026-06-25 Stripe設定とスロット管理マイグレーション](./2026-06-25_Stripe設定とスロット管理マイグレーション.md) — Phase2着手。設定外部化(env→config→app・config:cache罠)・Stripe Checkout(participant単位確定/Webhook)・週次パターン+例外ブロックの2テーブル設計・複合unique・cascadeOnDelete・unsignedTinyInteger/time列。躓き: なし(設定中心)、深掘り=本番でenv直読みがnullになる理由。【追記Task3】Eloquentリレーション(belongsTo⇄hasMany対)・戻り型注釈(:HasMany)・#[Fillable]属性記法・既存/新規の不統一はスコープ絞り許容。躓き: phpstan "Child process error exit 255"=並列ワーカーがDocker制約で死亡、--debugで並列オフ→真因(No errors)切り分け
- [2026-06-30 SlotService-TDDとテスト分類](./2026-06-30_SlotService-TDDとテスト分類.md) — Phase2 Task4。TDD Red=正しい理由で落ちる確認・スロット計算(7〜42日窓/締切1週間前)・flip()でO(1)判定・dayOfWeekIso-1(月=1問題)・UTC保存JST比較・BLOCKING_STATUSESで超過販売防止。躓き: tests/Unitなのに RefreshDatabase使う矛盾→Eloquent依存で割り切り(継承元Tests\TestCaseがDB可否を決める)・Eloquent直叩きServiceはクリーンアーキ的にグレーだがクエリが本体の計算系は意図的妥協でService採用
- [2026-07-01 設計書セルフレビューとFE-BE契約](./2026-07-01_設計書セルフレビューとFE-BE契約.md) — 設計書の自己矛盾レビュー（宣言した制約vs掲載コード）・silent fallback（default propsのmock）の罠→プレビュー専用ページ・死に値を型に含めない・テストは固定日時で肝心の変換をassert・props命名camelCase統一（変換はBE責務）・決めないことを決めて書く（当面全件）・toLocaleStringはブラウザTZ依存を仕様として採用。躓き: mock既定値がBE渡し忘れをtscでも実行時でも検知不能にする
- [2026-06-24 enum→string化とbacked-enum-cast](./2026-06-24_enum→string化とbacked-enum-cast.md) — enum()=Postgresでは CHECK制約・多層防御(入口/cast/DB)のトレードオフ・backed enum cast(DB文字列⇄PHP enum自動変換)・role を cast すると文字列比較が壊れる。躓き: phpstan.phar欠落(reinstall)・Auth::user()=Authenticatable型(@var必要)・larastanはリレーション戻り型(: HasOne)が無いとmagicプロパティ未認識。【同日追記Task9】Featureテスト(全経路/RefreshDatabase)・characterizationテスト(既存コードは初回緑)・共有ルールは重複させず固有ロジックを突くテスト設計・whereは生文字列/取得属性はenum。躓き: extends→extendのtypoで expecting "{"。【同日追記Task10/11・Phase1完了】env必須シーダー(fail-safe/冪等updateOrCreate)・Filament v4リソース構造(Schema基盤/分割)・日本語ラベルは表示層に置きDomain enumにHasLabelを実装しない(クリーンアーキ)・cast列のbadgeはfn(PartnerStatus $state)=>match。躓き: cast列に末尾スペース値→ValueError(castが不正値を書込時に弾く)
