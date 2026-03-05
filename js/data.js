// ===== CONSTANTS =====

// デフォルトカテゴリ（工種マスタ未設定時のフォールバック）
const DEFAULT_CATEGORIES = [
  { id: 'cable',       label: '電線・ケーブル' },
  { id: 'conduit',     label: '電線管' },
  { id: 'device',      label: '配線器具' },
  { id: 'box',         label: 'ボックス' },
  { id: 'panel',       label: '分電盤' },
  { id: 'fixture',     label: '照明器具' },
  { id: 'dimmer',      label: '調光器' },
  { id: 'fire',        label: '火災報知器' },
  { id: 'ground',      label: '接地' },
  { id: 'accessories', label: '付属品' },
];

// 現在有効なカテゴリ（工種マスタから動的に更新される）
let CATEGORIES = [...DEFAULT_CATEGORIES];

let CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

function rebuildCatMap() {
  CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));
}

// Excel列ヘッダー（estimate-app互換 v3.0: 13列）
const EXCEL_HEADERS = ['品目名称','規格名称','単位','基準単価','原価単価','原価率','歩掛1','中分類名','カテゴリ','大分類ID','中分類ID','小分類ID','小分類名'];

// ===== NORM (全角半角統一) =====
function norm(s) { return (s || '').normalize('NFKC').toLowerCase(); }

// ===== ESCAPE HTML =====
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== NUMBER FORMAT =====
function fmtNum(n) {
  const v = parseFloat(n);
  if (isNaN(v)) return '';
  return v.toLocaleString('ja-JP');
}

// ===== LOCAL STORAGE KEYS =====
const LS_LIST = 'dbm_db_list';       // トリッジ一覧メタ情報の配列
const LS_DATA = 'dbm_db_data_';      // トリッジ品目データ（IDごと）
const LS_KOSHU = 'dbm_db_koshu_';    // 工種マスタ（IDごと）
const LS_SETTINGS = 'dbm_db_settings_'; // 設定マスタ（IDごと）
const LS_KEYWORDS = 'dbm_db_keywords_'; // キーワードマスタ（IDごと）
const LS_BUNRUI = 'dbm_db_bunrui_';  // 分類マスタ（IDごと）

// ===== DB LIST (metadata) =====
function loadDbList() {
  try {
    const s = localStorage.getItem(LS_LIST);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function saveDbList(list) {
  localStorage.setItem(LS_LIST, JSON.stringify(list));
}

// ===== DB DATA (items) =====
function loadDbData(id) {
  try {
    const s = localStorage.getItem(LS_DATA + id);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function saveDbData(id, rows) {
  localStorage.setItem(LS_DATA + id, JSON.stringify(rows));
}

function deleteDbData(id) {
  localStorage.removeItem(LS_DATA + id);
  localStorage.removeItem(LS_KOSHU + id);
  localStorage.removeItem(LS_SETTINGS + id);
  localStorage.removeItem(LS_KEYWORDS + id);
  localStorage.removeItem(LS_BUNRUI + id);
}

// ===== 分類マスタ =====
function loadBunruiData(id) {
  try {
    const s = localStorage.getItem(LS_BUNRUI + id);
    return s ? JSON.parse(s) : { rows: [], keywords: [] };
  } catch { return { rows: [], keywords: [] }; }
}

function saveBunruiData(id, data) {
  localStorage.setItem(LS_BUNRUI + id, JSON.stringify(data));
}

// ===== 工種マスタ =====
function loadKoshuData(id) {
  try {
    const s = localStorage.getItem(LS_KOSHU + id);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function saveKoshuData(id, rows) {
  localStorage.setItem(LS_KOSHU + id, JSON.stringify(rows));
}

// ===== 設定マスタ =====
function loadSettingsData(id) {
  try {
    const s = localStorage.getItem(LS_SETTINGS + id);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function saveSettingsData(id, settings) {
  localStorage.setItem(LS_SETTINGS + id, JSON.stringify(settings));
}

function defaultSettings() {
  return {
    copperEnabled: false,
    copperBase: 1000,
    copperFraction: 0.50,
    laborSell: 33000,
    laborCost: 12000,
  };
}

// ===== キーワードマスタ =====
function loadKeywordsData(id) {
  try {
    const s = localStorage.getItem(LS_KEYWORDS + id);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function saveKeywordsData(id, rows) {
  localStorage.setItem(LS_KEYWORDS + id, JSON.stringify(rows));
}

// ===== GENERATE ID =====
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ===== AUTO CATEGORY DETECTION =====
function detectCategory(hinmei, kikaku, chuName) {
  const n = norm((hinmei || '') + ' ' + (kikaku || '') + ' ' + (chuName || ''));
  if (['電線管','pf-','ve ','fep','ねじなし','プルボックス','ダクト','ボックス'].some(k => n.includes(norm(k)))) return 'conduit';
  if (['電線','ケーブル','cv ','cvt','vv-f','iv ','cpev','同軸','utp','ae ','hp ','toev','fcpev'].some(k => n.includes(norm(k)))) return 'cable';
  if (['コンセント','スイッチ','プレート','配線器具'].some(k => n.includes(norm(k)))) return 'device';
  if (['分電盤','開閉器','制御盤'].some(k => n.includes(norm(k)))) return 'panel';
  if (['火災','感知','報知','自火報'].some(k => n.includes(norm(k)))) return 'fire';
  if (['接地'].some(k => n.includes(norm(k)))) return 'ground';
  if (['調光','ディマ'].some(k => n.includes(norm(k)))) return 'dimmer';
  return 'fixture';
}

// ===== GET COL (flexible column name matching for Excel import) =====
function getCol(row, ...names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') return row[name];
  }
  return undefined;
}

// ===== BLANK ROW =====
function newRow() {
  return {
    id: genId(),
    n: '',     // 品目名称
    s: '',     // 規格名称
    u: '',     // 単位
    ep: '',    // 基準単価
    cp: '',    // 原価単価
    r: '',     // 原価率
    b: '',     // 歩掛1
    c: 'fixture', // カテゴリ
    daiId: '', // 大分類ID (v3)
    chuId: '', // 中分類ID (v3)
    shoId: '', // 小分類ID (v3)
    shoName: '', // 小分類名 (v3)
  };
}

// ===== 工種マスタ行 =====
function newKoshuRow(order) {
  return {
    id: '',         // 工種ID
    name: '',       // 工種名
    short: '',      // 略称
    rateMode: false,// 割合モード
    miscRate: 5,    // 雑材料率%
    order: order || 1,  // 順序
    autoRows: '',   // 自動計算行（パイプ区切り: 雑材料消耗品|電工労務費|運搬費）
  };
}

// ===== キーワードマスタ行 =====
function newKeywordRow() {
  return {
    keyword: '',         // キーワード
    laborType: 'fixture',// 分類
    bukariki: 0,         // 歩掛
    copperLinked: false,  // 銅連動
    ceilingOpening: false,// 天井開口
  };
}
