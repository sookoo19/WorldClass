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
- [2026-06-24 enum→string化とbacked-enum-cast](./2026-06-24_enum→string化とbacked-enum-cast.md) — enum()=Postgresでは CHECK制約・多層防御(入口/cast/DB)のトレードオフ・backed enum cast(DB文字列⇄PHP enum自動変換)・role を cast すると文字列比較が壊れる。躓き: phpstan.phar欠落(reinstall)・Auth::user()=Authenticatable型(@var必要)・larastanはリレーション戻り型(: HasOne)が無いとmagicプロパティ未認識。【同日追記Task9】Featureテスト(全経路/RefreshDatabase)・characterizationテスト(既存コードは初回緑)・共有ルールは重複させず固有ロジックを突くテスト設計・whereは生文字列/取得属性はenum。躓き: extends→extendのtypoで expecting "{"。【同日追記Task10/11・Phase1完了】env必須シーダー(fail-safe/冪等updateOrCreate)・Filament v4リソース構造(Schema基盤/分割)・日本語ラベルは表示層に置きDomain enumにHasLabelを実装しない(クリーンアーキ)・cast列のbadgeはfn(PartnerStatus $state)=>match。躓き: cast列に末尾スペース値→ValueError(castが不正値を書込時に弾く)
