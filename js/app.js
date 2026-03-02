// ===== STATE =====
let dbList = [];         // [{id, name, memo, rowCount, updatedAt}]
let currentDbId = null;  // 選択中のDB ID
let currentRows = [];    // 現在のDB品目データ
let filteredRows = [];   // フィルタ後の表示行
let isDirty = false;     // 未保存変更フラグ

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  dbList = loadDbList();
  renderSidebar();
  if (dbList.length > 0) {
    selectDb(dbList[0].id);
  }
});

// ===== SIDEBAR =====
function renderSidebar() {
  const el = document.getElementById('dbList');
  if (dbList.length === 0) {
    el.innerHTML = '<div style="color:#64748b;font-size:11px;padding:8px 4px;text-align:center;">DBカセットがありません</div>';
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
  isDirty = false;
  applyFilter();
  renderSidebar();
  updateToolbar();
  updateUnsavedBadge();
}

function updateToolbar() {
  const db = dbList.find(d => d.id === currentDbId);
  document.getElementById('currentDbName').textContent = db ? db.name : 'DBを選択してください';
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

// 売単価変更→原価率から原価を自動計算
function onPriceChange(id, value) {
  const row = currentRows.find(r => r.id === id);
  if (!row) return;
  const ep = parseFloat(value) || 0;
  row.ep = ep;
  // 原価率が設定済みなら原価を再計算
  if (row.r !== '' && row.r !== undefined) {
    const rate = parseFloat(row.r) || 0;
    row.cp = Math.round(ep * rate);
    // DOMの原価フィールドを更新
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (tr) {
      const inputs = tr.querySelectorAll('input');
      if (inputs[4]) inputs[4].value = row.cp;
    }
  }
  markDirty();
}

// 原価率変更→原価を自動計算
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

// 品名変更→カテゴリ自動検出
function onNameInput(id, value) {
  const row = currentRows.find(r => r.id === id);
  if (!row) return;
  row.n = value;
  // カテゴリが未設定 or fixture（デフォルト）の場合は自動判定
  const detected = detectCategory(value, row.s, '');
  if (!row.c || row.c === 'fixture') {
    row.c = detected;
    // セレクト更新
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
  if (!currentDbId) { showToast('先にDBを選択してください'); return; }
  const row = newRow();
  currentRows.push(row);
  markDirty();
  applyFilter();
  // 最下部にスクロール
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
  // 自動保存（500msデバウンス）
  clearTimeout(markDirty._timer);
  markDirty._timer = setTimeout(autoSave, 500);
}

function autoSave() {
  if (!currentDbId || !isDirty) return;
  saveDbData(currentDbId, currentRows);
  // メタ情報更新
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
  if (!name) { alert('DB名称を入力してください'); return; }
  const memo = document.getElementById('newDbMemo').value.trim();
  const id = genId();
  const db = { id, name, memo, rowCount: 0, updatedAt: new Date().toISOString() };
  dbList.push(db);
  saveDbList(dbList);
  saveDbData(id, []);
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
  if (!name) { alert('DB名称を入力してください'); return; }
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
  showToast('DB名称を変更しました');
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
    isDirty = false;
    updateToolbar();
    updateUnsavedBadge();
    document.getElementById('tableBody').innerHTML = '';
    document.getElementById('rowCount').textContent = '';
  }
  renderSidebar();
  showToast('DBを削除しました');
}

// ===== EXCEL EXPORT =====
function exportCurrentDb() {
  if (!currentDbId || !window.XLSX) return;
  autoSave();

  const db = dbList.find(d => d.id === currentDbId);
  const rows = loadDbData(currentDbId);

  // 資材マスタシート
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
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(sheetRows);
  ws1['!cols'] = [
    {wch:30},{wch:28},{wch:6},{wch:10},{wch:10},{wch:7},{wch:7},{wch:16},{wch:12}
  ];
  XLSX.utils.book_append_sheet(wb, ws1, '資材マスタ');

  // 労務単価マスタシート（空テンプレート）
  const laborRows = [
    ['労務区分','見積単価（円/人工）','原価単価（円/人工）'],
    ['001', '', ''],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(laborRows);
  ws3['!cols'] = [{wch:12},{wch:20},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws3, '労務単価マスタ');

  const filename = (db ? db.name : 'DB') + '.xlsx';
  XLSX.writeFile(wb, filename);
  showToast(`「${filename}」をダウンロードしました（${rows.length}品目）`);
}

// ===== EXCEL IMPORT (新規DBとして取り込み) =====
function importExcelAsNewDb() {
  document.getElementById('importFileInput').click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file || !window.XLSX) return;

  const isCsv = /\.csv$/i.test(file.name);

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      let data;
      if (isCsv) {
        // CSV読み込み（SheetJSでパース）
        const wb = XLSX.read(e.target.result, { type: 'string', codepage: 65001 });
        const ws = wb.Sheets[wb.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(ws);
      } else {
        // Excel読み込み：「資材マスタ」シートを優先、なければ最初のシート
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sheetName = wb.SheetNames.includes('資材マスタ') ? '資材マスタ' : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(ws);
      }

      if (!data || data.length === 0) {
        alert('データが見つかりませんでした。ファイルの内容を確認してください。');
        return;
      }

      // 列名確認（デバッグ）
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

        // カテゴリはExcel/CSV記載があればそれを優先、なければ自動判定
        let cat = catRaw && CATEGORIES.some(c => c.id === catRaw) ? catRaw
                : detectCategory(hinmei, kikaku, chuName);

        rows.push({
          id: genId(),
          n: hinmei, s: kikaku, u: unit,
          ep: ep || '', cp: cp || '', r: r || '',
          b: buk || '', c: cat,
        });
      }

      if (rows.length === 0) {
        alert('取り込める品目がありませんでした。\n検出列: ' + Object.keys(data[0]).join(', '));
        return;
      }

      // DB名はファイル名から
      const dbName = file.name.replace(/\.(xlsx?|csv)$/i, '');
      const id = genId();
      const db = { id, name: dbName, memo: `Excelインポート (${rows.length}品目)`, rowCount: rows.length, updatedAt: new Date().toISOString() };
      dbList.push(db);
      saveDbList(dbList);
      saveDbData(id, rows);

      selectDb(id);
      showToast(`「${dbName}」をインポートしました（${rows.length}品目、${skipped}件スキップ）`);

    } catch(err) {
      alert('読み込みエラー: ' + err.message);
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
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
  // Ctrl+S: 保存
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (isDirty) { autoSave(); showToast('保存しました'); }
  }
  // Escape: モーダルを閉じる
  if (e.key === 'Escape') {
    closeCreateModal();
    closeRenameModal();
    closeDeleteModal();
  }
});
