# DBカセット マネージャー — プロジェクト引継ぎ

## このアプリの目的

八友電工の見積アプリ（estimate-app）で使用する「DBカセット」（材料マスタExcelファイル）を
作成・編集・管理するための独立したWebアプリ。

## 親プロジェクトとの関係

```
db-manager（このアプリ）         estimate-app
  DBカセットを作成・編集  →  Excelエクスポート  →  見積アプリでExcel取り込み
```

- estimate-app のリポジトリ: `c:\Users\pal19\Projects\estimate-app`
- GitHub Pages: https://tomokazu-8.github.io/estimate-app/

## DBカセット運用の背景

estimate-app はもともと内蔵DBを持っていたが、以下の理由で空に変更した：
- 内蔵DBと外部DBが混在して管理が困難
- 工種（新築木造、新築RC、改修、空調、給排水など）によってDBを切り替えたい
- ゲームのカセットのように差し替えて運用する方式に変更

このアプリで作成したDBカセットをExcelエクスポートして estimate-app に取り込む。
estimate-app で「DBなし（クリックで読込）」バッジをクリック→ファイル選択 で装着。

## Excelエクスポート形式（estimate-app互換）

シート名：「資材マスタ」
列順：品目名称 / 規格名称 / 単位 / 基準単価 / 原価単価 / 原価率 / 歩掛1 / 中分類名 / カテゴリ

カテゴリID（英語）とラベル（日本語）の対応：
- cable       → 電線・ケーブル
- conduit     → 電線管
- device      → 配線器具
- box         → ボックス
- panel       → 分電盤
- fixture     → 照明器具
- dimmer      → 調光器
- fire        → 火災報知器
- ground      → 接地
- accessories → 付属品

estimate-app 側は getCol() で列名を柔軟に検索するため、列名の多少の違いは許容される。

## ファイル構成

```
db-manager/
├── index.html          — 画面レイアウト（サイドバー + メインテーブル + モーダル）
├── CLAUDE.md           — この引継ぎファイル
├── AI変換指示書.md     — 元データをAIに変換させるための指示書
├── css/
│   └── style.css       — デザイン（estimate-appと同じデザイントークン使用）
└── js/
    ├── data.js         — 定数・norm()・localStorage操作・ユーティリティ
    └── app.js          — 全UIロジック（レンダリング・イベント・Excel/CSV入出力）
```

## 現在の実装状態（完成済み）

### 機能一覧
1. **新規DB作成** — 名称・メモを入力して空のDBカセットを作成
2. **Excel / CSVインポート** — .xlsx / .xls / .csv を取り込んで新規DBとして登録
3. **Excelエクスポート** — estimate-app互換の.xlsxとしてダウンロード
4. **インライン編集** — テーブルセルを直接クリックして編集
5. **自動カテゴリ検出** — 品名入力時にカテゴリを自動判定
6. **原価自動計算** — 売単価×原価率→原価を自動入力
7. **絞り込み** — カテゴリ・キーワードフィルタ
8. **自動保存** — 編集後500msでlocalStorageに自動保存（Ctrl+Sでも保存）
9. **DB管理** — 名称変更・削除（サイドバーの✏/🗑ボタン）

### インポート仕様（重要）
- **CSV**: SheetJSでパース。文字コードUTF-8を想定
- **Excel**: 「資材マスタ」シートを優先、なければ最初のシートを読み込む
- 列名は柔軟に検索（品目名称/品名/名称/材料名 など複数候補を試みる）
- カテゴリ列（英語ID）があればそれを優先、なければ品名から自動判定

### データ永続化
localStorageを使用：
- `dbm_db_list` — DB一覧メタ情報の配列
- `dbm_db_data_{id}` — 各DBの品目データ

## AI変換フロー（重要）

元データ（メーカーカタログ・仕入先価格表等）は構造がバラバラなため、
直接インポートせずAIに変換させてから取り込む運用とする。

```
元データ（任意の形式）
  ↓ AI変換指示書.md を Claude に渡して変換依頼
  ↓ CSVで出力してもらう
db-manager で「Excel / CSVからDB作成」で読み込み
  ↓ 内容確認・修正（インライン編集）
  ↓ Excelエクスポート（例: 新築木造用DB.xlsx）
estimate-app でDBカセット装着
```

## 技術スタック

- バニラJS（フレームワークなし）
- SheetJS (xlsx.full.min.js 0.18.5) — CDN読み込み
- localStorage — データ永続化

## 未対応・今後の課題

- Gitリポジトリ未作成（必要であれば `git init` して管理）
- GitHub Pages未設定
- 歩掛（ぶかり）マスタの編集機能（現在は材料マスタのみ）
- DBカセットの複製機能
- 印刷・PDF出力

## 動作確認方法

VSコードで `index.html` を右クリック → 「Live Serverで開く」
（Live Server拡張機能が必要）
