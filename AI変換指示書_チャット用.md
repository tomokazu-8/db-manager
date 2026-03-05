# TRIDGE CONVERSION INSTRUCTION v3.1 — CHAT VERSION

## TASK
Convert the material data provided below into Tridge format (6 CSV blocks).
Output ALL 6 blocks in a single response.

---

## OUTPUT FORMAT

Output exactly 6 labeled CSV blocks as follows.
Each block becomes a separate CSV file for import.

```
## 資材マスタ.csv
[CSV content]

## 工種マスタ.csv
[CSV content]

## 設定マスタ.csv
[CSV content]

## キーワードマスタ.csv
[CSV content]

## 分類マスタ.csv
[CSV content]

## 労務単価マスタ.csv
[CSV content]
```

Rules: UTF-8, integer prices, wrap comma-containing values in double quotes.

---

## SHEET SCHEMAS

### 資材マスタ.csv (REQUIRED — one row per item)
```
品目名称,規格名称,単位,基準単価,原価単価,原価率,歩掛1,中分類名,カテゴリ,大分類ID,中分類ID,小分類ID,小分類名
```

| column | rule |
|--------|------|
| 品目名称 | Generic name. Strip manufacturer names. Move model numbers to 規格名称. |
| 規格名称 | Size / spec / model. Empty if none. |
| 単位 | m / 本 / 個 / 台 / 枚 / 組 / 式 / kg |
| 基準単価 | Integer. Selling price excl. tax. If tax-included: floor(price/1.1). |
| 原価単価 | Integer. Cost price. Empty if unknown. |
| 原価率 | Float 2dp. 原価単価/基準単価. Empty if unknown. Do NOT default. |
| 歩掛1 | Float 4dp. Install labor per unit. Empty if unknown. |
| 中分類名 | From source data classification. Use original name if available. |
| カテゴリ | English ID from CAT_MAP below. |
| 大分類ID | L01 or L02 (from 分類マスタ). Empty if no classification data. |
| 中分類ID | M001–M999 (from 分類マスタ). Empty if no classification data. |
| 小分類ID | S0001–S9999 (from 分類マスタ). Empty if no classification data. |
| 小分類名 | Small category name (from 分類マスタ). Empty if no classification data. |

**CAT_MAP** (check top-to-bottom, first match wins):
```
conduit     : 電線管|PF管|VE管|FEP管|ねじなし管|プルボックス|ダクト|ケーブルラック|ボックス
cable       : ケーブル|電線|CV|CVT|VVF|VVR|IV線|CPEV|同軸|UTP|AE線|光ファイバ
device      : コンセント|スイッチ|プレート|配線器具
panel       : 分電盤|開閉器|制御盤|配電盤
fire        : 感知器|発信機|受信機|音響|自火報|火災報知
ground      : 接地|アース|避雷
dimmer      : 調光|ディマ
accessories : サドル|バインド|コネクタ|ブッシング|テープ|キャップ|副材
fixture     : (default)
```
Treat full-width/half-width as equivalent.
Skip rows where 品目名称 is empty.

---

### 工種マスタ.csv
```
工種ID,工種名,略称,割合モード,雑材料率%,順序,自動計算行
```
- 割合モード: 0=通常, 1=割合（諸経費等のみ）
- 自動計算行: pipe-separated row names e.g. `雑材料消耗品|電工労務費|運搬費`
- Available auto-row names: 雑材料消耗品/電工労務費/器具取付費/機器取付費/機器取付け及び試験調整費/埋込器具用天井材開口費/UTPケーブル試験費/運搬費

Standard patterns (use as base, adjust to source data):
```
trunk,幹線・分電盤工事,幹線・分電盤,0,5,1,雑材料消耗品|電工労務費|運搬費
lighting_fix,照明器具工事,照明,0,5,2,雑材料消耗品|器具取付費|埋込器具用天井材開口費|運搬費
outlet,コンセント工事,コンセント,0,5,3,雑材料消耗品|電工労務費|運搬費
weak,弱電工事,弱電,0,3,4,雑材料消耗品|電工労務費|UTPケーブル試験費|運搬費
fire,自動火災報知設備工事,自火報,0,5,5,雑材料消耗品|機器取付け及び試験調整費|運搬費
```

---

### 設定マスタ.csv (ALWAYS output all 5 rows)
```
パラメーター名,値
銅建値補正,[○ or ×]
銅建値基準（円/kg）,[integer]
銅連動率,[0.00–1.00]
労務売単価（円/人工）,[integer]
労務原価単価（円/人工）,[integer]
```
- 銅建値補正: `○` for 電気/空調, `×` otherwise
- Defaults if unknown: 銅建値基準=1000, 銅連動率=0.50, 労務売単価=33000, 労務原価単価=12000

---

### キーワードマスタ.csv (v3 format — 8 columns)
```
キーワードID,キーワード,種別,大分類ID,大分類名,中分類ID,中分類名,小分類ID
```
- 種別: 中分類 or 小分類
- キーワードID: same as 中分類ID (for 中分類 rows) or 小分類ID (for 小分類 rows)
- Derive from 分類マスタ: output one row per 中分類 + one row per 小分類
- 小分類行の小分類ID: filled. 中分類行の小分類ID: empty.

---

### 分類マスタ.csv (7 columns)
```
大分類ID,大分類名,中分類ID,中分類名,小分類ID,小分類名,品目数
```
- One row per small category (小分類)
- 品目数: count of 資材マスタ items belonging to this 小分類
- ID format: L01/L02 → M001–M999 → S0001–S9999

---

### 労務単価マスタ.csv
```
労務区分,見積単価（円/人工）,原価単価（円/人工）
電工,[value],[value]
```

---

## AMBIGUITY RULES

| Situation | Action |
|-----------|--------|
| Only selling price available | Set 基準単価=price, leave 原価単価/原価率 empty |
| Only cost price available | 基準単価=floor(cost/0.75), 原価単価=cost, 原価率=0.75 |
| Tax-included price | floor(price/1.1) |
| Per-box price (e.g. 100本入) | Divide to get per-unit price |
| No classification hierarchy in source | Leave 大分類ID/中分類ID/小分類ID/小分類名 empty; omit 分類マスタ and キーワードマスタ |
| Unknown trade type | Set 銅建値補正=×; omit 工種マスタ |

---

## IMPORT INSTRUCTIONS

After receiving the 6 CSV blocks:
1. Save each block as a `.csv` file with the exact filename shown (e.g. `資材マスタ.csv`)
2. Select all 6 files → compress to a single ZIP file
3. In db-manager: click「Excel / CSV / ZIPからトリッジ作成」→ select the ZIP
4. All masters are imported at once → check each tab → export as Tridge (.xlsx)
5. Load the Tridge in estimate-app

---

## DATA TO CONVERT

[ここに変換したいデータを貼り付けてください]
