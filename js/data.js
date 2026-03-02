// ===== CONSTANTS =====

const CATEGORIES = [
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

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

// Excel列ヘッダー（estimate-app互換）
const EXCEL_HEADERS = ['品目名称','規格名称','単位','基準単価','原価単価','原価率','歩掛1','中分類名','カテゴリ'];

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
const LS_LIST = 'dbm_db_list';   // DB一覧メタ情報の配列
const LS_DATA = 'dbm_db_data_';  // DB品目データ（IDごと）

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
  };
}
