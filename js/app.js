// ===== STATE =====
let dbList = [];         // [{id, name, memo, rowCount, updatedAt}]
let currentDbId = null;  // 選択中のトリッジ ID
let currentRows = [];    // 現在の品目データ
let filteredRows = [];   // フィルタ後の表示行
let isDirty = false;     // 未保存変更フラグ

// マスタデータ（トリッジごと）
let currentKoshu = [];     // 工種マスタ
let currentSettings = null; // 設定マスタ
let currentKeywords = [];  // キーワードマスタ
let currentBunrui = { rows: [], keywords: [] }; // 分類マスタ（v3）
let currentTab = 'material';

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  dbList = loadDbList();
  renderSidebar();
  if (dbList.length > 0) {
    selectDb(dbList[0].id);
  }
});

// ===== TAB SWITCHING =====
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === 'tab-' + tab);
  });
  // タブ切り替え時にツールバーの行追加・フィルタの表示を切り替え
  const materialControls = document.getElementById('toolbarRight');
  if (tab === 'material') {
    materialControls.style.display = 'flex';
  } else {
    materialControls.style.display = 'none';
  }
}

// ===== SIDEBAR =====
function renderSidebar() {
  const el = document.getElementById('dbList');
  if (dbList.length === 0) {
    el.innerHTML = '<div style="color:#64748b;font-size:11px;padding:8px 4px;text-align:center;">トリッジがありません</div>';
    return;
  }
  el.innerHTML = dbList.map(db => `
    <div class="db-item ${db.id === currentDbId ? 'selected' : ''}" onclick="selectDb('${db.id}')">
      <span class="db-item-icon">📦</span>
      <div class="db-item-info">
        <div class="db-item-name">${esc(db.name)}</div>
        <div class="db-item-meta">${db.rowCount}品目${db.memo ? ' · ' + esc(db.memo) : ''}</div>
      </div>
      <div class="db-item-menu">
        <button class="db-menu-btn" title="編集" onclick="event.stopPropagation(); showRenameModal('${db.id}')">✏</button>
        <button class="db-menu-btn" title="削除" onclick="event.stopPropagation(); showDeleteModal('${db.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

// ===== SELECT DB =====
function selectDb(id) {
  if (isDirty && currentDbId) {
    if (!confirm('保存していない変更があります。切り替えますか？')) return;
  }
  currentDbId = id;
  currentRows = loadDbData(id);
  currentKoshu = loadKoshuData(id);
  currentSettings = loadSettingsData(id) || defaultSettings();
  currentKeywords = loadKeywordsData(id);
  currentBunrui = loadBunruiData(id);
  isDirty = false;

  // 工種マスタからカテゴリを更新
  updateCategoriesFromKoshu();

  applyFilter();
  renderSidebar();
  updateToolbar();
  updateUnsavedBadge();
  renderKoshuTable();
  renderSettingsPanel();
  renderKeywordTable();
  renderBunruiPanel();
  updateCatFilterOptions();
}

function updateCategoriesFromKoshu() {
  if (currentKoshu.length > 0) {
    CATEGORIES = currentKoshu.map(k => ({ id: k.id, label: k.name }));
  } else {
    CATEGORIES = [...DEFAULT_CATEGORIES];
  }
  rebuildCatMap();
}

function updateCatFilterOptions() {
  const sel = document.getElementById('catFilter');
  sel.innerHTML = '<option value="">全カテゴリ</option>' +
    CATEGORIES.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join('');
}

function updateToolbar() {
  const db = dbList.find(d => d.id === currentDbId);
  document.getElementById('currentDbName').textContent = db ? db.name : 'トリッジを選択してください';
  document.getElementById('btnExport').disabled = !currentDbId;
  const table = document.getElementById('mainTable');
  const empty = document.getElementById('emptyState');
  if (currentDbId) {
    table.style.display = '';
    empty.style.display = 'none';
  } else {
    table.style.display = 'none';
    empty.style.display = 'flex';
  }
}

// ===== FILTER & RENDER TABLE =====
function applyFilter() {
  const query = norm(document.getElementById('searchInput').value).trim();
  const cat = document.getElementById('catFilter').value;

  filteredRows = currentRows.filter(row => {
    if (cat && row.c !== cat) return false;
    if (query.length >= 1) {
      const terms = query.split(/\s+/);
      const text = norm((row.n || '') + ' ' + (row.s || ''));
      if (!terms.every(t => text.includes(t))) return false;
    }
    return true;
  });

  renderTable();
  updateRowCount();
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  if (filteredRows.length === 0 && currentDbId) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-sub);">データがありません。「＋ 行追加」から追加してください。</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredRows.map((row, idx) => `
    <tr data-id="${row.id}">
      <td class="row-num">${idx + 1}</td>
      <td><input class="cell-input" value="${esc(row.n)}" placeholder="品目名称"
        onchange="onCellChange('${row.id}', 'n', this.value)"
        oninput="onNameInput('${row.id}', this.value)"></td>
      <td><input class="cell-input" value="${esc(row.s)}" placeholder="規格名称"
        onchange="onCellChange('${row.id}', 's', this.value)"></td>
      <td><input class="cell-input" value="${esc(row.u)}" placeholder="本" style="width:44px;"
        onchange="onCellChange('${row.id}', 'u', this.value)"></td>
      <td><input class="cell-input num" type="number" step="1" min="0" value="${row.ep !== '' ? row.ep : ''}" placeholder="0"
        onchange="onPriceChange('${row.id}', this.value)"></td>
      <td><input class="cell-input num" type="number" step="1" min="0" value="${row.cp !== '' ? row.cp : ''}" placeholder="0"
        onchange="onCellChange('${row.id}', 'cp', this.value)"></td>
      <td><input class="cell-input num" type="number" step="1" min="0" max="100" value="${row.r !== '' ? Math.round(row.r * 100) : ''}" placeholder="75"
        onchange="onRateChange('${row.id}', this.value)"></td>
      <td><input class="cell-input num" type="number" step="0.001" min="0" value="${row.b !== '' ? row.b : ''}" placeholder="0"
        onchange="onCellChange('${row.id}', 'b', this.value)"></td>
      <td>
        <select class="cell-select" onchange="onCellChange('${row.id}', 'c', this.value)">
          ${CATEGORIES.map(c => `<option value="${c.id}" ${row.c === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
      </td>
      <td><button class="btn-del-row" title="行を削除" onclick="deleteRow('${row.id}')">×</button></td>
    </tr>
  `).join('');
}

function updateRowCount() {
  const total = currentRows.length;
  const shown = filteredRows.length;
  document.getElementById('rowCount').textContent =
    total === shown ? `${total}品目` : `${shown}件表示（全${total}品目）`;
}

// ===== CELL CHANGE HANDLERS =====
function onCellChange(id, field, value) {
  const row = currentRows.find(r => r.id === id);
  if (!row) return;
  row[field] = value;
  markDirty();
}

function onPriceChange(id, value) {
  const row = currentRows.find(r => r.id === id);
  if (!row) return;
  const ep = parseFloat(value) || 0;
  row.ep = ep;
  if (row.r !== '' && row.r !== undefined) {
    const rate = parseFloat(row.r) || 0;
    row.cp = Math.round(ep * rate);
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (tr) {
      const inputs = tr.querySelectorAll('input');
      if (inputs[4]) inputs[4].value = row.cp;
    }
  }
  markDirty();
}

function onRateChange(id, value) {
  const row = currentRows.find(r => r.id === id);
  if (!row) return;
  const pct = parseFloat(value);
  if (isNaN(pct)) { row.r = ''; return; }
  row.r = pct / 100;
  const ep = parseFloat(row.ep) || 0;
  if (ep > 0) {
    row.cp = Math.round(ep * row.r);
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (tr) {
      const inputs = tr.querySelectorAll('input');
      if (inputs[4]) inputs[4].value = row.cp;
    }
  }
  markDirty();
}

function onNameInput(id, value) {
  const row = currentRows.find(r => r.id === id);
  if (!row) return;
  row.n = value;
  const detected = detectCategory(value, row.s, '');
  if (!row.c || row.c === 'fixture') {
    row.c = detected;
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (tr) {
      const sel = tr.querySelector('select.cell-select');
      if (sel) sel.value = row.c;
    }
  }
  markDirty();
}

// ===== ADD / DELETE ROW =====
function addRow() {
  if (!currentDbId) { showToast('先にトリッジを選択してください'); return; }
  const row = newRow();
  currentRows.push(row);
  markDirty();
  applyFilter();
  setTimeout(() => {
    const wrap = document.getElementById('tableWrap');
    wrap.scrollTop = wrap.scrollHeight;
  }, 50);
}

function deleteRow(id) {
  const idx = currentRows.findIndex(r => r.id === id);
  if (idx === -1) return;
  currentRows.splice(idx, 1);
  markDirty();
  applyFilter();
}

// ===== DIRTY / SAVE =====
function markDirty() {
  isDirty = true;
  updateUnsavedBadge();
  clearTimeout(markDirty._timer);
  markDirty._timer = setTimeout(autoSave, 500);
}

function autoSave() {
  if (!currentDbId || !isDirty) return;
  saveDbData(currentDbId, currentRows);
  saveKoshuData(currentDbId, currentKoshu);
  saveSettingsData(currentDbId, currentSettings);
  saveKeywordsData(currentDbId, currentKeywords);
  saveBunruiData(currentDbId, currentBunrui);
  const db = dbList.find(d => d.id === currentDbId);
  if (db) {
    db.rowCount = currentRows.length;
    db.updatedAt = new Date().toISOString();
    saveDbList(dbList);
  }
  isDirty = false;
  updateUnsavedBadge();
  setStatus('保存しました');
  renderSidebar();
}

function updateUnsavedBadge() {
  document.getElementById('unsavedBadge').style.display = isDirty ? 'inline' : 'none';
}

function setStatus(msg) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3000);
}

// ===== 工種マスタ編集 =====
function renderKoshuTable() {
  const tbody = document.getElementById('koshuBody');
  const empty = document.getElementById('koshuEmpty');
  if (!currentDbId || currentKoshu.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = currentDbId ? 'block' : 'block';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = currentKoshu.map((k, idx) => `
    <tr>
      <td><input class="cell-input num" type="number" min="1" value="${k.order}" style="width:44px;"
        onchange="onKoshuChange(${idx}, 'order', this.value)"></td>
      <td><input class="cell-input" value="${esc(k.id)}" placeholder="trunk"
        onchange="onKoshuChange(${idx}, 'id', this.value)"></td>
      <td><input class="cell-input" value="${esc(k.name)}" placeholder="幹線・分電盤工事"
        onchange="onKoshuChange(${idx}, 'name', this.value)"></td>
      <td><input class="cell-input" value="${esc(k.short)}" placeholder="幹線・分電盤"
        onchange="onKoshuChange(${idx}, 'short', this.value)"></td>
      <td style="text-align:center;">
        <input type="checkbox" ${k.rateMode ? 'checked' : ''}
          onchange="onKoshuChange(${idx}, 'rateMode', this.checked)">
      </td>
      <td><input class="cell-input num" type="number" min="0" max="100" value="${k.miscRate}" style="width:60px;"
        onchange="onKoshuChange(${idx}, 'miscRate', this.value)"></td>
      <td><input class="cell-input" value="${esc(k.autoRows || '')}" placeholder="雑材料消耗品|電工労務費|運搬費"
        onchange="onKoshuChange(${idx}, 'autoRows', this.value)"></td>
      <td><button class="btn-del-row" title="削除" onclick="deleteKoshuRow(${idx})">×</button></td>
    </tr>
  `).join('');
}

function addKoshuRow() {
  if (!currentDbId) { showToast('先にトリッジを選択してください'); return; }
  const order = currentKoshu.length > 0 ? Math.max(...currentKoshu.map(k => k.order)) + 1 : 1;
  currentKoshu.push(newKoshuRow(order));
  markDirty();
  renderKoshuTable();
}

function deleteKoshuRow(idx) {
  currentKoshu.splice(idx, 1);
  updateCategoriesFromKoshu();
  markDirty();
  renderKoshuTable();
  updateCatFilterOptions();
  renderTable();
}

function onKoshuChange(idx, field, value) {
  if (field === 'order' || field === 'miscRate') {
    currentKoshu[idx][field] = parseFloat(value) || 0;
  } else if (field === 'rateMode') {
    currentKoshu[idx][field] = value;
  } else {
    currentKoshu[idx][field] = value;
  }
  updateCategoriesFromKoshu();
  markDirty();
  // カテゴリが変わった場合は資材テーブルも更新
  if (field === 'id' || field === 'name') {
    updateCatFilterOptions();
    renderTable();
  }
}

// ===== 設定マスタ編集 =====
function renderSettingsPanel() {
  if (!currentSettings) currentSettings = defaultSettings();
  document.getElementById('settCopperEnabled').value = currentSettings.copperEnabled ? '1' : '0';
  document.getElementById('settCopperBase').value = currentSettings.copperBase;
  document.getElementById('settCopperFraction').value = currentSettings.copperFraction;
  document.getElementById('settLaborSell').value = currentSettings.laborSell;
  document.getElementById('settLaborCost').value = currentSettings.laborCost;
}

function onSettingsChange() {
  if (!currentDbId) return;
  currentSettings = {
    copperEnabled: document.getElementById('settCopperEnabled').value === '1',
    copperBase: parseFloat(document.getElementById('settCopperBase').value) || 1000,
    copperFraction: parseFloat(document.getElementById('settCopperFraction').value) || 0.50,
    laborSell: parseFloat(document.getElementById('settLaborSell').value) || 33000,
    laborCost: parseFloat(document.getElementById('settLaborCost').value) || 12000,
  };
  markDirty();
}

// ===== キーワードマスタ編集 =====
function renderKeywordTable() {
  const tbody = document.getElementById('keywordBody');
  const empty = document.getElementById('keywordEmpty');
  if (!currentDbId || currentKeywords.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = currentDbId ? 'block' : 'block';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = currentKeywords.map((k, idx) => `
    <tr>
      <td class="row-num">${idx + 1}</td>
      <td><input class="cell-input" value="${esc(k.keyword)}" placeholder="ケーブル"
        onchange="onKeywordChange(${idx}, 'keyword', this.value)"></td>
      <td>
        <select class="cell-select" onchange="onKeywordChange(${idx}, 'laborType', this.value)">
          <option value="wiring" ${k.laborType === 'wiring' ? 'selected' : ''}>wiring</option>
          <option value="fixture" ${k.laborType === 'fixture' ? 'selected' : ''}>fixture</option>
          <option value="equipment" ${k.laborType === 'equipment' ? 'selected' : ''}>equipment</option>
        </select>
      </td>
      <td><input class="cell-input num" type="number" step="0.001" min="0" value="${k.bukariki}" style="width:60px;"
        onchange="onKeywordChange(${idx}, 'bukariki', this.value)"></td>
      <td style="text-align:center;">
        <input type="checkbox" ${k.copperLinked ? 'checked' : ''}
          onchange="onKeywordChange(${idx}, 'copperLinked', this.checked)">
      </td>
      <td style="text-align:center;">
        <input type="checkbox" ${k.ceilingOpening ? 'checked' : ''}
          onchange="onKeywordChange(${idx}, 'ceilingOpening', this.checked)">
      </td>
      <td><button class="btn-del-row" title="削除" onclick="deleteKeywordRow(${idx})">×</button></td>
    </tr>
  `).join('');
}

function addKeywordRow() {
  if (!currentDbId) { showToast('先にトリッジを選択してください'); return; }
  currentKeywords.push(newKeywordRow());
  markDirty();
  renderKeywordTable();
}

function deleteKeywordRow(idx) {
  currentKeywords.splice(idx, 1);
  markDirty();
  renderKeywordTable();
}

function onKeywordChange(idx, field, value) {
  if (field === 'bukariki') {
    currentKeywords[idx][field] = parseFloat(value) || 0;
  } else if (field === 'copperLinked' || field === 'ceilingOpening') {
    currentKeywords[idx][field] = value;
  } else {
    currentKeywords[idx][field] = value;
  }
  markDirty();
}

// ===== 分類マスタ表示 =====
let _bunruiFiltered = [];

function renderBunruiPanel() {
  const rows = currentBunrui?.rows || [];
  const kwCount = currentBunrui?.keywords?.length || 0;
  const summary = document.getElementById('bunruiSummary');
  const empty = document.getElementById('bunruiEmpty');
  const table = document.getElementById('bunruiTable');

  if (rows.length === 0) {
    if (summary) summary.textContent = '';
    if (empty) empty.style.display = 'block';
    if (table) table.style.display = 'none';
    return;
  }

  // サマリー
  const daiSet = new Set(rows.map(r => r.daiId));
  const chuSet = new Set(rows.map(r => r.chuId));
  if (summary) summary.textContent = `大分類: ${daiSet.size}件 / 中分類: ${chuSet.size}件 / 小分類: ${rows.length}件 / キーワード: ${kwCount}件`;
  if (empty) empty.style.display = 'none';
  if (table) table.style.display = '';

  _bunruiFiltered = rows;
  renderBunruiTable(_bunruiFiltered);
}

function filterBunrui() {
  const q = norm(document.getElementById('bunruiSearch').value).trim();
  const rows = currentBunrui?.rows || [];
  if (!q) {
    _bunruiFiltered = rows;
  } else {
    _bunruiFiltered = rows.filter(r =>
      norm(r.chuName).includes(q) || norm(r.shoName).includes(q) ||
      norm(r.daiName).includes(q)
    );
  }
  renderBunruiTable(_bunruiFiltered);
}

function renderBunruiTable(rows) {
  const tbody = document.getElementById('bunruiBody');
  if (!tbody) return;
  const display = rows.slice(0, 200); // 最大200件表示
  tbody.innerHTML = display.map(r => `
    <tr>
      <td style="font-size:11px;color:var(--text-sub);">${esc(r.daiId)}</td>
      <td style="font-size:11px;">${esc(r.daiName)}</td>
      <td style="font-size:11px;color:var(--text-sub);">${esc(r.chuId)}</td>
      <td style="font-size:11px;">${esc(r.chuName)}</td>
      <td style="font-size:11px;color:var(--text-sub);">${esc(r.shoId)}</td>
      <td style="font-size:11px;">${esc(r.shoName)}</td>
      <td style="font-size:11px;text-align:right;">${r.count || 0}</td>
    </tr>
  `).join('');
  if (rows.length > 200) {
    tbody.innerHTML += `<tr><td colspan="7" style="text-align:center;color:var(--text-sub);font-size:11px;">...他 ${rows.length - 200}件（検索で絞り込んでください）</td></tr>`;
  }
}

// ===== CREATE DB MODAL =====
function showCreateModal() {
  document.getElementById('newDbName').value = '';
  document.getElementById('newDbMemo').value = '';
  document.getElementById('createModal').style.display = 'flex';
  setTimeout(() => document.getElementById('newDbName').focus(), 100);
}

function closeCreateModal() {
  document.getElementById('createModal').style.display = 'none';
}

function confirmCreateDb() {
  const name = document.getElementById('newDbName').value.trim();
  if (!name) { alert('トリッジ名称を入力してください'); return; }
  const memo = document.getElementById('newDbMemo').value.trim();
  const id = genId();
  const db = { id, name, memo, rowCount: 0, updatedAt: new Date().toISOString() };
  dbList.push(db);
  saveDbList(dbList);
  saveDbData(id, []);
  saveKoshuData(id, []);
  saveSettingsData(id, defaultSettings());
  saveKeywordsData(id, []);
  saveBunruiData(id, { rows: [], keywords: [] });
  closeCreateModal();
  selectDb(id);
  showToast(`「${name}」を作成しました`);
}

// ===== RENAME MODAL =====
let renameTargetId = null;

function showRenameModal(id) {
  renameTargetId = id;
  const db = dbList.find(d => d.id === id);
  if (!db) return;
  document.getElementById('renameDbName').value = db.name;
  document.getElementById('renameDbMemo').value = db.memo || '';
  document.getElementById('renameModal').style.display = 'flex';
  setTimeout(() => document.getElementById('renameDbName').focus(), 100);
}

function closeRenameModal() {
  document.getElementById('renameModal').style.display = 'none';
  renameTargetId = null;
}

function confirmRenameDb() {
  const name = document.getElementById('renameDbName').value.trim();
  if (!name) { alert('トリッジ名称を入力してください'); return; }
  const db = dbList.find(d => d.id === renameTargetId);
  if (!db) return;
  db.name = name;
  db.memo = document.getElementById('renameDbMemo').value.trim();
  saveDbList(dbList);
  closeRenameModal();
  renderSidebar();
  if (currentDbId === db.id) {
    document.getElementById('currentDbName').textContent = db.name;
  }
  showToast('トリッジ名称を変更しました');
}

// ===== DELETE MODAL =====
let deleteTargetId = null;

function showDeleteModal(id) {
  deleteTargetId = id;
  const db = dbList.find(d => d.id === id);
  if (!db) return;
  document.getElementById('deleteModalMsg').textContent =
    `「${db.name}」（${db.rowCount}品目）を削除します。この操作は元に戻せません。`;
  document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
  deleteTargetId = null;
}

function confirmDeleteDb() {
  const id = deleteTargetId;
  if (!id) return;
  deleteDbData(id);
  dbList = dbList.filter(d => d.id !== id);
  saveDbList(dbList);
  closeDeleteModal();
  if (currentDbId === id) {
    currentDbId = null;
    currentRows = [];
    filteredRows = [];
    currentKoshu = [];
    currentSettings = defaultSettings();
    currentKeywords = [];
    currentBunrui = { rows: [], keywords: [] };
    isDirty = false;
    CATEGORIES = [...DEFAULT_CATEGORIES];
    rebuildCatMap();
    updateToolbar();
    updateUnsavedBadge();
    updateCatFilterOptions();
    document.getElementById('tableBody').innerHTML = '';
    document.getElementById('rowCount').textContent = '';
    renderKoshuTable();
    renderSettingsPanel();
    renderKeywordTable();
    renderBunruiPanel();
  }
  renderSidebar();
  showToast('トリッジを削除しました');
}

// ===== EXCEL EXPORT (Tridge形式: 5シート) =====
function exportCurrentDb() {
  if (!currentDbId || !window.XLSX) return;
  autoSave();

  const db = dbList.find(d => d.id === currentDbId);
  const rows = loadDbData(currentDbId);

  const wb = XLSX.utils.book_new();

  // === Sheet 1: 資材マスタ（v3.0: 13列）===
  const sheetRows = [EXCEL_HEADERS];
  rows.forEach(r => {
    sheetRows.push([
      r.n || '',
      r.s || '',
      r.u || '',
      r.ep !== '' ? parseFloat(r.ep) || 0 : '',
      r.cp !== '' ? parseFloat(r.cp) || 0 : '',
      r.r  !== '' ? parseFloat(r.r)  || 0 : '',
      r.b  !== '' ? parseFloat(r.b)  || 0 : '',
      CAT_MAP[r.c] || r.c || '',
      r.c || '',
      r.daiId || '',
      r.chuId || '',
      r.shoId || '',
      r.shoName || '',
    ]);
  });
  const ws1 = XLSX.utils.aoa_to_sheet(sheetRows);
  ws1['!cols'] = [
    {wch:30},{wch:28},{wch:6},{wch:10},{wch:10},{wch:7},{wch:7},{wch:16},{wch:12},
    {wch:8},{wch:8},{wch:8},{wch:24}
  ];
  XLSX.utils.book_append_sheet(wb, ws1, '資材マスタ');

  // === Sheet 2: 工種マスタ ===
  const koshuHeaders = ['工種ID','工種名','略称','割合モード','雑材料率%','順序','自動計算行'];
  const koshuRows = [koshuHeaders];
  const koshu = loadKoshuData(currentDbId);
  koshu.forEach(k => {
    koshuRows.push([
      k.id || '',
      k.name || '',
      k.short || '',
      k.rateMode ? '1' : '0',
      k.miscRate || 0,
      k.order || 0,
      k.autoRows || '',
    ]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(koshuRows);
  ws2['!cols'] = [{wch:14},{wch:20},{wch:16},{wch:10},{wch:10},{wch:6},{wch:36}];
  XLSX.utils.book_append_sheet(wb, ws2, '工種マスタ');

  // === Sheet 3: 設定マスタ ===
  const settings = loadSettingsData(currentDbId) || defaultSettings();
  const settingsHeaders = ['パラメーター名','値'];
  const settingsRows = [settingsHeaders,
    ['銅建値補正', settings.copperEnabled ? '有効' : '無効'],
    ['銅建値基準（円/kg）', settings.copperBase],
    ['銅連動率', settings.copperFraction],
    ['労務売単価（円/人工）', settings.laborSell],
    ['労務原価単価（円/人工）', settings.laborCost],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(settingsRows);
  ws3['!cols'] = [{wch:24},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws3, '設定マスタ');

  // === Sheet 4: キーワードマスタ ===
  const kwHeaders = ['キーワード','分類','歩掛','銅連動','天井開口'];
  const kwRows = [kwHeaders];
  const keywords = loadKeywordsData(currentDbId);
  keywords.forEach(k => {
    kwRows.push([
      k.keyword || '',
      k.laborType || 'fixture',
      k.bukariki || 0,
      k.copperLinked ? '○' : '',
      k.ceilingOpening ? '○' : '',
    ]);
  });
  const ws4 = XLSX.utils.aoa_to_sheet(kwRows);
  ws4['!cols'] = [{wch:20},{wch:12},{wch:8},{wch:8},{wch:8}];
  XLSX.utils.book_append_sheet(wb, ws4, 'キーワードマスタ');

  // === Sheet 5: 労務単価マスタ（空テンプレート） ===
  const laborRows = [
    ['労務区分','見積単価（円/人工）','原価単価（円/人工）'],
    ['001', settings.laborSell || '', settings.laborCost || ''],
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(laborRows);
  ws5['!cols'] = [{wch:12},{wch:20},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws5, '労務単価マスタ');

  // === Sheet 6: 分類マスタ ===
  const bunrui = loadBunruiData(currentDbId);
  if (bunrui.rows.length > 0) {
    const bunruiHeaders = ['大分類ID','大分類名','中分類ID','中分類名','小分類ID','小分類名','品目数'];
    const bunruiRows = [bunruiHeaders];
    bunrui.rows.forEach(r => {
      bunruiRows.push([r.daiId||'', r.daiName||'', r.chuId||'', r.chuName||'', r.shoId||'', r.shoName||'', r.count||0]);
    });
    const ws6 = XLSX.utils.aoa_to_sheet(bunruiRows);
    ws6['!cols'] = [{wch:8},{wch:14},{wch:8},{wch:24},{wch:8},{wch:32},{wch:6}];
    XLSX.utils.book_append_sheet(wb, ws6, '分類マスタ');

    // キーワードマスタ(v3)も出力
    if (bunrui.keywords.length > 0) {
      // v3キーワードを上書きエクスポート（既存ws4を置き換え）
      const kwV3Headers = ['キーワードID','キーワード','種別','大分類ID','大分類名','中分類ID','中分類名','小分類ID'];
      const kwV3Rows = [kwV3Headers];
      bunrui.keywords.forEach(k => {
        kwV3Rows.push([k.kwId||'', k.keyword||'', k.type||'', k.daiId||'', k.daiName||'', k.chuId||'', k.chuName||'', k.shoId||'']);
      });
      // キーワードマスタシートをv3で上書き
      wb.SheetNames = wb.SheetNames.filter(n => n !== 'キーワードマスタ');
      delete wb.Sheets['キーワードマスタ'];
      const wsKwV3 = XLSX.utils.aoa_to_sheet(kwV3Rows);
      wsKwV3['!cols'] = [{wch:8},{wch:32},{wch:8},{wch:8},{wch:14},{wch:8},{wch:24},{wch:8}];
      XLSX.utils.book_append_sheet(wb, wsKwV3, 'キーワードマスタ');
    }
  }

  const filename = (db ? db.name : 'Tridge') + '.xlsx';
  XLSX.writeFile(wb, filename);
  const bunruiInfo = bunrui.rows.length > 0 ? ` / 分類${bunrui.rows.length}件` : '';
  showToast(`「${filename}」をエクスポートしました（${rows.length}品目 / ${koshu.length}工種${bunruiInfo}）`);
}

// ===== EXCEL IMPORT (新規トリッジとして取り込み) =====
function importExcelAsNewDb() {
  document.getElementById('importFileInput').click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file || !window.XLSX) return;

  if (/\.zip$/i.test(file.name)) {
    handleZipImport(file);
    return;
  }

  const isCsv = /\.csv$/i.test(file.name);

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      let wb;
      if (isCsv) {
        wb = XLSX.read(e.target.result, { type: 'string', codepage: 65001 });
      } else {
        wb = XLSX.read(e.target.result, { type: 'array' });
      }

      // === 資材マスタ読み込み ===
      const sheetName = wb.SheetNames.includes('資材マスタ') ? '資材マスタ' : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws);

      if (!data || data.length === 0) {
        alert('データが見つかりませんでした。ファイルの内容を確認してください。');
        return;
      }

      console.log('[Import] 列名:', Object.keys(data[0]));

      const rows = [];
      let skipped = 0;
      for (const row of data) {
        const hinmei = String(getCol(row, '品目名称','品名','名称','材料名','品目') || '').trim();
        if (!hinmei) { skipped++; continue; }
        const kikaku  = String(getCol(row, '規格名称','規格','仕様','型番','規格・型番') || '').trim();
        const unit    = String(getCol(row, '単位') || '').trim();
        const ep      = parseFloat(getCol(row, '基準単価','単価','見積単価','仕切単価','仕切価格','定価') || 0);
        const cp      = parseFloat(getCol(row, '原価単価','原価') || 0);
        const rRaw    = parseFloat(getCol(row, '原価率') || 0);
        const r       = rRaw > 1 ? rRaw / 100 : rRaw;
        const buk     = parseFloat(getCol(row, '歩掛1','歩掛','人工','取付人工') || 0);
        const chuName = String(getCol(row, '中分類名','分類名','分類') || '').trim();
        const catRaw  = String(getCol(row, 'カテゴリ') || '').trim();
        const daiId   = String(getCol(row, '大分類ID') || '').trim();
        const chuId   = String(getCol(row, '中分類ID') || '').trim();
        const shoId   = String(getCol(row, '小分類ID') || '').trim();
        const shoName = String(getCol(row, '小分類名') || '').trim();

        let cat = catRaw || detectCategory(hinmei, kikaku, chuName);

        rows.push({
          id: genId(),
          n: hinmei, s: kikaku, u: unit,
          ep: ep || '', cp: cp || '', r: r || '',
          b: buk || '', c: cat,
          daiId, chuId, shoId, shoName,
        });
      }

      if (rows.length === 0) {
        alert('取り込める品目がありませんでした。\n検出列: ' + Object.keys(data[0]).join(', '));
        return;
      }

      // === 工種マスタ読み込み ===
      let importedKoshu = [];
      const wsKoshu = wb.Sheets['工種マスタ'];
      if (wsKoshu) {
        const dataKoshu = XLSX.utils.sheet_to_json(wsKoshu);
        const yn = v => ['true','1','yes','割合','はい','○'].includes(String(v || '').trim());
        importedKoshu = dataKoshu.map(r => ({
          id:       String(getCol(r, '工種ID') || '').trim(),
          name:     String(getCol(r, '工種名') || '').trim(),
          short:    String(getCol(r, '略称') || '').trim(),
          rateMode: yn(getCol(r, '割合モード')),
          miscRate: parseFloat(getCol(r, '雑材料率%', '雑材料率') || 0),
          order:    parseInt(getCol(r, '順序') || 0),
          autoRows: String(getCol(r, '自動計算行') || '').trim(),
        })).filter(k => k.id && k.name);
        console.log('[Import] 工種マスタ:', importedKoshu.length, '件');
      }

      // === 設定マスタ読み込み ===
      let importedSettings = defaultSettings();
      const wsSettings = wb.Sheets['設定マスタ'];
      if (wsSettings) {
        const dataSettings = XLSX.utils.sheet_to_json(wsSettings);
        const map = {};
        dataSettings.forEach(r => {
          const key = String(getCol(r, 'パラメーター名', 'パラメータ', '設定名') || '').trim();
          const val = getCol(r, '値', 'value');
          if (key) map[key] = val;
        });
        const yn = v => ['true','1','yes','有効','○','はい'].includes(String(v || '').trim());
        if (map['銅建値補正']          !== undefined) importedSettings.copperEnabled  = yn(map['銅建値補正']);
        if (map['銅建値基準（円/kg）'] !== undefined) importedSettings.copperBase     = parseFloat(map['銅建値基準（円/kg）']) || 1000;
        if (map['銅連動率']            !== undefined) importedSettings.copperFraction = parseFloat(map['銅連動率']) || 0.50;
        if (map['労務売単価（円/人工）']!== undefined) importedSettings.laborSell     = parseFloat(map['労務売単価（円/人工）']) || 33000;
        if (map['労務原価単価（円/人工）']!==undefined) importedSettings.laborCost    = parseFloat(map['労務原価単価（円/人工）']) || 12000;
        console.log('[Import] 設定マスタ:', importedSettings);
      }

      // === キーワードマスタ読み込み（v2: 5列 or v3: 8列を自動判定）===
      let importedKeywords = [];
      let importedBunruiKeywords = [];
      const wsKw = wb.Sheets['キーワードマスタ'];
      if (wsKw) {
        const dataKw = XLSX.utils.sheet_to_json(wsKw);
        const yn = v => ['true','1','yes','○','はい'].includes(String(v || '').trim());
        // v3判定: キーワードID列が存在する場合
        const isV3 = dataKw.length > 0 && getCol(dataKw[0], 'キーワードID') !== undefined;
        if (isV3) {
          // v3形式: 分類マスタ連動キーワード → bunruiに格納
          importedBunruiKeywords = dataKw.map(r => ({
            kwId:    String(getCol(r, 'キーワードID') || '').trim(),
            keyword: String(getCol(r, 'キーワード') || '').trim(),
            type:    String(getCol(r, '種別') || '').trim(),
            daiId:   String(getCol(r, '大分類ID') || '').trim(),
            daiName: String(getCol(r, '大分類名') || '').trim(),
            chuId:   String(getCol(r, '中分類ID') || '').trim(),
            chuName: String(getCol(r, '中分類名') || '').trim(),
            shoId:   String(getCol(r, '小分類ID') || '').trim(),
          })).filter(k => k.keyword);
          console.log('[Import] キーワードマスタ(v3):', importedBunruiKeywords.length, '件');
        } else {
          // v2形式: 労務費計算用キーワード
          importedKeywords = dataKw.map(r => ({
            keyword:       String(getCol(r, 'キーワード') || '').trim(),
            laborType:     String(getCol(r, '分類', '労務分類') || 'fixture').trim(),
            bukariki:      parseFloat(getCol(r, '歩掛', '歩掛値') || 0),
            copperLinked:  yn(getCol(r, '銅連動', '銅連動フラグ')),
            ceilingOpening: yn(getCol(r, '天井開口', '天井開口フラグ')),
          })).filter(k => k.keyword);
          console.log('[Import] キーワードマスタ(v2):', importedKeywords.length, '件');
        }
      }

      // === 分類マスタ読み込み ===
      let importedBunrui = { rows: [], keywords: importedBunruiKeywords };
      const wsBunrui = wb.Sheets['分類マスタ'];
      if (wsBunrui) {
        const dataBunrui = XLSX.utils.sheet_to_json(wsBunrui);
        importedBunrui.rows = dataBunrui.map(r => ({
          daiId:   String(getCol(r, '大分類ID') || '').trim(),
          daiName: String(getCol(r, '大分類名') || '').trim(),
          chuId:   String(getCol(r, '中分類ID') || '').trim(),
          chuName: String(getCol(r, '中分類名') || '').trim(),
          shoId:   String(getCol(r, '小分類ID') || '').trim(),
          shoName: String(getCol(r, '小分類名') || '').trim(),
          count:   parseInt(getCol(r, '品目数') || 0),
        })).filter(r => r.shoId);
        importedBunrui.keywords = importedBunruiKeywords;
        console.log('[Import] 分類マスタ:', importedBunrui.rows.length, '件');
      }

      // === トリッジとして保存 ===
      const dbName = file.name.replace(/\.(xlsx?|csv)$/i, '');
      const id = genId();
      const db = { id, name: dbName, memo: `インポート (${rows.length}品目)`, rowCount: rows.length, updatedAt: new Date().toISOString() };
      dbList.push(db);
      saveDbList(dbList);
      saveDbData(id, rows);
      saveKoshuData(id, importedKoshu);
      saveSettingsData(id, importedSettings);
      saveKeywordsData(id, importedKeywords);
      saveBunruiData(id, importedBunrui);

      selectDb(id);

      const parts = [`${rows.length}品目`];
      if (importedKoshu.length > 0) parts.push(`${importedKoshu.length}工種`);
      if (importedKeywords.length > 0) parts.push(`${importedKeywords.length}キーワード`);
      if (importedBunrui.rows.length > 0) parts.push(`分類${importedBunrui.rows.length}件`);
      showToast(`「${dbName}」をインポートしました（${parts.join(' / ')}、${skipped}件スキップ）`);

    } catch(err) {
      alert('読み込みエラー: ' + err.message);
      console.error(err);
    }
  };

  if (isCsv) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
}

// ===== ZIP IMPORT =====
async function handleZipImport(file) {
  if (!window.JSZip) { alert('JSZipが読み込まれていません。ページを再読み込みしてください。'); return; }

  try {
    showToast('ZIPを読み込み中...');
    const zip = await JSZip.loadAsync(file.arrayBuffer());

    // ZIPの各CSVをシート名→WorksheetObjectに変換
    const sheets = {};
    const entries = Object.entries(zip.files).filter(([, e]) => !e.dir && /\.csv$/i.test(e.name));
    for (const [path, entry] of entries) {
      const raw = await entry.async('text');
      const text = raw.replace(/^\uFEFF/, ''); // BOM除去
      const sheetName = path.replace(/.*\//, '').replace(/\.csv$/i, ''); // パスとextを除去
      const wb = XLSX.read(text, { type: 'string', codepage: 65001 });
      sheets[sheetName] = wb.Sheets[wb.SheetNames[0]];
    }

    if (!sheets['資材マスタ']) {
      alert('ZIPに「資材マスタ.csv」が見つかりません。\n含まれているファイル: ' + Object.keys(sheets).join(', ') + '\n\nファイル名が正確に「資材マスタ.csv」である必要があります。');
      return;
    }

    // === 資材マスタ ===
    const data1 = XLSX.utils.sheet_to_json(sheets['資材マスタ']);
    const rows = [];
    let skipped = 0;
    for (const row of data1) {
      const hinmei  = String(getCol(row, '品目名称','品名','名称','材料名','品目') || '').trim();
      if (!hinmei) { skipped++; continue; }
      const kikaku  = String(getCol(row, '規格名称','規格','仕様','型番','規格・型番') || '').trim();
      const unit    = String(getCol(row, '単位') || '').trim();
      const ep      = parseFloat(getCol(row, '基準単価','単価','見積単価','仕切単価','定価') || 0);
      const cp      = parseFloat(getCol(row, '原価単価','原価') || 0);
      const rRaw    = parseFloat(getCol(row, '原価率') || 0);
      const r       = rRaw > 1 ? rRaw / 100 : rRaw;
      const buk     = parseFloat(getCol(row, '歩掛1','歩掛','人工') || 0);
      const chuName = String(getCol(row, '中分類名','分類名','分類') || '').trim();
      const catRaw  = String(getCol(row, 'カテゴリ') || '').trim();
      const daiId   = String(getCol(row, '大分類ID') || '').trim();
      const chuId   = String(getCol(row, '中分類ID') || '').trim();
      const shoId   = String(getCol(row, '小分類ID') || '').trim();
      const shoName = String(getCol(row, '小分類名') || '').trim();
      rows.push({
        id: genId(), n: hinmei, s: kikaku, u: unit,
        ep: ep||'', cp: cp||'', r: r||'', b: buk||'',
        c: catRaw || detectCategory(hinmei, kikaku, chuName),
        daiId, chuId, shoId, shoName,
      });
    }

    // === 工種マスタ ===
    let importedKoshu = [];
    if (sheets['工種マスタ']) {
      const yn = v => ['true','1','yes','割合','はい','○'].includes(String(v||'').trim());
      importedKoshu = XLSX.utils.sheet_to_json(sheets['工種マスタ']).map(r => ({
        id:       String(getCol(r,'工種ID')||'').trim(),
        name:     String(getCol(r,'工種名')||'').trim(),
        short:    String(getCol(r,'略称')||'').trim(),
        rateMode: yn(getCol(r,'割合モード')),
        miscRate: parseFloat(getCol(r,'雑材料率%','雑材料率')||0),
        order:    parseInt(getCol(r,'順序')||0),
        autoRows: String(getCol(r,'自動計算行')||'').trim(),
      })).filter(k => k.id && k.name);
    }

    // === 設定マスタ ===
    let importedSettings = defaultSettings();
    if (sheets['設定マスタ']) {
      const map = {};
      XLSX.utils.sheet_to_json(sheets['設定マスタ']).forEach(r => {
        const key = String(getCol(r,'パラメーター名','パラメータ','設定名')||'').trim();
        const val = getCol(r,'値','value');
        if (key) map[key] = val;
      });
      const yn = v => ['true','1','yes','有効','○','はい'].includes(String(v||'').trim());
      if (map['銅建値補正']           !== undefined) importedSettings.copperEnabled  = yn(map['銅建値補正']);
      if (map['銅建値基準（円/kg）']  !== undefined) importedSettings.copperBase     = parseFloat(map['銅建値基準（円/kg）'])||1000;
      if (map['銅連動率']             !== undefined) importedSettings.copperFraction = parseFloat(map['銅連動率'])||0.50;
      if (map['労務売単価（円/人工）'] !== undefined) importedSettings.laborSell     = parseFloat(map['労務売単価（円/人工）'])||33000;
      if (map['労務原価単価（円/人工）']!== undefined) importedSettings.laborCost   = parseFloat(map['労務原価単価（円/人工）'])||12000;
    }

    // === キーワードマスタ（v2/v3自動判定）===
    let importedKeywords = [];
    let importedBunruiKeywords = [];
    if (sheets['キーワードマスタ']) {
      const dataKw = XLSX.utils.sheet_to_json(sheets['キーワードマスタ']);
      const yn = v => ['true','1','yes','○','はい'].includes(String(v||'').trim());
      const isV3 = dataKw.length > 0 && getCol(dataKw[0],'キーワードID') !== undefined;
      if (isV3) {
        importedBunruiKeywords = dataKw.map(r => ({
          kwId: String(getCol(r,'キーワードID')||'').trim(),
          keyword: String(getCol(r,'キーワード')||'').trim(),
          type:    String(getCol(r,'種別')||'').trim(),
          daiId:   String(getCol(r,'大分類ID')||'').trim(),
          daiName: String(getCol(r,'大分類名')||'').trim(),
          chuId:   String(getCol(r,'中分類ID')||'').trim(),
          chuName: String(getCol(r,'中分類名')||'').trim(),
          shoId:   String(getCol(r,'小分類ID')||'').trim(),
        })).filter(k => k.keyword);
      } else {
        importedKeywords = dataKw.map(r => ({
          keyword:        String(getCol(r,'キーワード')||'').trim(),
          laborType:      String(getCol(r,'分類','労務分類')||'fixture').trim(),
          bukariki:       parseFloat(getCol(r,'歩掛','歩掛値')||0),
          copperLinked:   yn(getCol(r,'銅連動','銅連動フラグ')),
          ceilingOpening: yn(getCol(r,'天井開口','天井開口フラグ')),
        })).filter(k => k.keyword);
      }
    }

    // === 分類マスタ ===
    let importedBunrui = { rows: [], keywords: importedBunruiKeywords };
    if (sheets['分類マスタ']) {
      importedBunrui.rows = XLSX.utils.sheet_to_json(sheets['分類マスタ']).map(r => ({
        daiId:   String(getCol(r,'大分類ID')||'').trim(),
        daiName: String(getCol(r,'大分類名')||'').trim(),
        chuId:   String(getCol(r,'中分類ID')||'').trim(),
        chuName: String(getCol(r,'中分類名')||'').trim(),
        shoId:   String(getCol(r,'小分類ID')||'').trim(),
        shoName: String(getCol(r,'小分類名')||'').trim(),
        count:   parseInt(getCol(r,'品目数')||0),
      })).filter(r => r.shoId);
    }

    if (rows.length === 0) {
      alert('資材マスタに取り込める品目がありませんでした。');
      return;
    }

    // === トリッジとして保存 ===
    const dbName = file.name.replace(/\.zip$/i, '');
    const id = genId();
    const db = { id, name: dbName, memo: `ZIPインポート (${rows.length}品目)`, rowCount: rows.length, updatedAt: new Date().toISOString() };
    dbList.push(db);
    saveDbList(dbList);
    saveDbData(id, rows);
    saveKoshuData(id, importedKoshu);
    saveSettingsData(id, importedSettings);
    saveKeywordsData(id, importedKeywords);
    saveBunruiData(id, importedBunrui);

    selectDb(id);

    const parts = [`${rows.length}品目`];
    if (importedKoshu.length > 0)      parts.push(`${importedKoshu.length}工種`);
    if (importedKeywords.length > 0)   parts.push(`${importedKeywords.length}キーワード`);
    if (importedBunrui.rows.length > 0) parts.push(`分類${importedBunrui.rows.length}件`);
    showToast(`「${dbName}」をZIPから作成しました（${parts.join(' / ')}、${skipped}件スキップ）`);

  } catch(err) {
    alert('ZIPインポートエラー: ' + err.message);
    console.error(err);
  }
}

// ===== TOAST =====
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (isDirty) { autoSave(); showToast('保存しました'); }
  }
  if (e.key === 'Escape') {
    closeCreateModal();
    closeRenameModal();
    closeDeleteModal();
  }
});
