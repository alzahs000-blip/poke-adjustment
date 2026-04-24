
// ===== Supabase設定 =====
const SUPABASE_URL = 'https://wumxbysayrwnrimvyvhe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1bXhieXNheXJ3bnJpbXZ5dmhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTEyOTgsImV4cCI6MjA5MjU4NzI5OH0.dzzWMy2w09lfkSqAW1KneIStgovxmiEivf_2yDm6MnA';
let sbClient = null;
let isOwner = false;

function initSupabase() {
  if (typeof supabase === 'undefined') return;
  sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function loadFromSupabase() {
  if (!sbClient) return false;
  try {
    const { data, error } = await sbClient.from('app_data').select('payload').eq('id', 1).single();
    if (error || !data) return false;
    const saved = data.payload;
    if (saved && saved.datasets && Object.keys(saved.datasets).length > 0) {
      DS = saved;
      if (!DS.datasets[DS.currentId]) DS.currentId = Object.keys(DS.datasets)[0];
      applyData(DS.datasets[DS.currentId].data);
      return true;
    }
  } catch(e) {}
  return false;
}

async function saveSupabase() {
  if (!sbClient || !isOwner) return;
  try {
    await sbClient.from('app_data').upsert({ id: 1, payload: DS, updated_at: new Date().toISOString() });
  } catch(e) {}
}

function openLoginModal() {
  document.getElementById('login-modal').classList.add('open');
  setTimeout(() => document.getElementById('login-email').focus(), 50);
}
function closeLoginModal() {
  document.getElementById('login-modal').classList.remove('open');
}

async function login() {
  if (!sbClient) return;
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const { error } = await sbClient.auth.signInWithPassword({ email, password });
  if (error) { alert('ログイン失敗: ' + error.message); return; }
  document.getElementById('login-password').value = '';
  closeLoginModal();
}

async function logout() {
  if (!sbClient) return;
  await sbClient.auth.signOut();
}

function updateOwnerUI() {
  const btn = document.getElementById('owner-btn');
  if (!btn) return;
  if (isOwner) {
    btn.textContent = 'ログアウト';
    btn.style.color = '#4ade80';
    btn.style.borderColor = '#4ade80';
    btn.style.background = '#1a2e1a';
    btn.onclick = logout;
  } else {
    btn.textContent = '🔑 管理';
    btn.style.color = 'var(--text-muted)';
    btn.style.borderColor = 'var(--border)';
    btn.style.background = 'var(--surface2)';
    btn.onclick = openLoginModal;
  }
}

// ===== 数式評価 =====
function safeEval(expr) {
  if (!expr || expr.trim() === '') return 0;
  // 数字・演算子・括弧・小数点のみ許可
  const sanitized = expr.replace(/[^0-9+\-*/(). ]/g, '');
  try {
    const result = Function('"use strict"; return (' + sanitized + ')')();
    return isFinite(result) ? Math.round(result * 1000) / 1000 : 0;
  } catch(e) { return 0; }
}

function prvPow(t) {
  const raw = document.getElementById(`atk${t}-pow1`)?.value.trim() || '';
  const prv = document.getElementById(`atk${t}-pow1-prv`);
  if (!prv) return;
  // 純粋な数値のみなら非表示
  if (!raw || /^[0-9.]+$/.test(raw)) { prv.innerHTML = ''; return; }

  const result = safeEval(raw);
  if (!result) { prv.innerHTML = '<span style="color:#f87171">構文エラー</span>'; return; }

  // 途中式: カッコ内の各グループを個別に評価して "A+B+..." の形に展開
  // 表示用に * → × 変換
  const display = raw.replace(/\*/g, '×');

  // トップレベルの加算・減算で分割してそれぞれ評価
  // 例: (90*1.5)+(40*1.5*2) → ["(90*1.5)", "(40*1.5*2)"]
  const terms = splitTopLevel(raw);
  let midStr = '';
  if (terms.length > 1) {
    const termVals = terms.map(t => {
      const v = safeEval(t);
      return v % 1 === 0 ? v : Math.round(v * 100) / 100;
    });
    midStr = termVals.join('+') + ' = ';
  }

  const finalVal = result % 1 === 0 ? result : Math.round(result * 100) / 100;
  prv.innerHTML = `<span style="color:var(--text-muted)">${display}</span> = ${midStr}<span style="color:var(--text);font-weight:bold">${finalVal}</span>`;
}

// トップレベル（括弧の外）の + - で分割
function splitTopLevel(expr) {
  const terms = [];
  let depth = 0, cur = '', i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth--; cur += ch; }
    else if ((ch === '+' || ch === '-') && depth === 0 && cur.trim()) {
      terms.push(cur.trim());
      cur = ch === '-' ? '-' : '';
    } else { cur += ch; }
    i++;
  }
  if (cur.trim()) terms.push(cur.trim());
  return terms.filter(Boolean);
}

// ===== ラインカラーパレット =====
const LINE_COLORS = [
  '#f87171', // 赤
  '#60a5fa', // 青
  '#fb923c', // オレンジ
  '#a78bfa', // 紫
  '#34d399', // 緑
  '#f472b6', // ピンク
  '#facc15', // 黄
  '#22d3ee', // シアン
];
function getLineColor(type, pairIdx) {
  // defBとdefDで同じpairIdxなら同じ色
  return LINE_COLORS[pairIdx % LINE_COLORS.length];
}

// ===== 状態 =====
const S = {
  atkA: { entries: [], lines: [], editMode: false },
  atkC: { entries: [], lines: [], editMode: false },
  defB: { entries: [], lines: [], editMode: false },
  defD: { entries: [], lines: [], editMode: false },
};

// 共有プリセット（物理・特殊で同じリストを使う）
let presets = [
  { label: '1.5', val: 1.5 },
  { label: '2',   val: 2.0 },
  { label: '1.2', val: 1.2 },
  { label: '1.3', val: 1.3 },
];

// ===== プリセット描画 =====
function renderPresets() {
  // 耐久ラインのプリセットチップ
  ['B','D'].forEach(t => {
    const el = document.getElementById(`def${t}-preset-chips`);
    if (!el) return;
    el.innerHTML = '';
    presets.forEach((p, i) => {
      const chip = document.createElement('div');
      chip.className = 'preset-chip';
      const valSpan = document.createElement('span');
      valSpan.className = 'preset-chip-val';
      valSpan.textContent = `×${p.label}`;
      chip.appendChild(valSpan);
      const addBtn = document.createElement('button');
      addBtn.className = 'preset-chip-add';
      addBtn.title = '倍率に追加';
      addBtn.textContent = '＋';
      addBtn.addEventListener('click', () => applyDefLinePreset(t, i));
      chip.appendChild(addBtn);
      el.appendChild(chip);
    });
  });
  ['A','C'].forEach(t => {
    const el = document.getElementById(`preset-chips-${t}`);
    el.innerHTML = '';
    presets.forEach((p, i) => {
      const chip = document.createElement('div');
      chip.className = 'preset-chip';
      const isDeletable = i >= 4;

      const valSpan = document.createElement('span');
      valSpan.className = 'preset-chip-val';
      valSpan.textContent = `×${p.label}`;
      chip.appendChild(valSpan);

      const addBtn = document.createElement('button');
      addBtn.className = 'preset-chip-add';
      addBtn.title = '倍率に追加';
      addBtn.textContent = '＋';
      addBtn.addEventListener('click', () => applyPreset(t, i));
      chip.appendChild(addBtn);

      if (isDeletable) {
        const delBtn = document.createElement('button');
        delBtn.className = 'preset-chip-del';
        delBtn.title = 'プリセット削除';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', () => deletePreset(i));
        chip.appendChild(delBtn);
      }

      el.appendChild(chip);
    });
  });
}

function togglePresetAdd(t) {
  const row = document.getElementById(`preset-add-row-${t}`);
  row.style.display = row.style.display === 'none' ? 'flex' : 'none';
}

function addPreset(t) {
  const val = parseFloat(document.getElementById(`preset-add-val-${t}`).value);
  if (isNaN(val) || val <= 0) { alert('倍率を入力してください'); return; }
  const label = String(val);
  presets.push({ label, val });
  // 大きい順にソート
  presets.sort((a, b) => b.val - a.val);
  document.getElementById(`preset-add-val-${t}`).value = '';
  document.getElementById(`preset-add-row-${t}`).style.display = 'none';
  renderPresets();
  saveAll();
}

function deletePreset(i) {
  presets.splice(i, 1);
  renderPresets();
  saveAll();
}

// ===== 技ブロック管理 =====
function makeMoveBlock(t) {
  const wrap = document.createElement('div');
  wrap.className = 'move-block';
  wrap.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:5px;padding:7px 8px;display:flex;flex-direction:column;gap:5px;';
  wrap.innerHTML = `
    <div style="display:flex;gap:5px;align-items:center;">
      <input type="text" placeholder="技名" style="flex:1;font-size:12px;" oninput="prvAtk('${t}')"
        onkeydown="if(event.key==='Enter'){event.preventDefault();this.closest('.move-block').querySelector('input[type=number]').focus();}">
      <input type="number" placeholder="威力" min="1" style="width:58px;font-size:12px;font-family:var(--mono);" oninput="prvAtk('${t}')"
        onkeydown="if(event.key==='Enter'){event.preventDefault();const ml=this.closest('.move-block').querySelector('.mult-list');const ni=ml.querySelector('input[type=number]');if(ni)ni.focus();}">
      <button class="del-btn" onclick="this.closest('.move-block').remove();prvAtk('${t}')">✕</button>
    </div>
    <div class="mult-list" style="gap:3px;">
      <div class="mult-row">
        <input type="text" placeholder="倍率説明" style="font-size:11px;">
        <input type="number" placeholder="1.5" step="0.01" min="0.01" style="font-size:11px;" oninput="prvAtk('${t}')"
          onkeydown="if(event.key==='Enter'){event.preventDefault();regAtk('${t}');}">
        <button class="del-btn" onclick="this.parentElement.remove();prvAtk('${t}')">✕</button>
      </div>
    </div>
    <button class="btn-neutral" style="font-size:10px;padding:2px 8px;align-self:flex-start;" onclick="addMultToBlock(this,'${t}')">＋ 倍率追加</button>`;
  return wrap;
}

function addMoveBlock(t) {
  const container = document.getElementById(`atk${t}-moves`);
  const block = makeMoveBlock(t);
  container.appendChild(block);
  block.querySelector('input[type=text]').focus();
  prvAtk(t);
}

function addMultToBlock(btn, t) {
  const ml = btn.closest('.move-block').querySelector('.mult-list');
  const row = document.createElement('div');
  row.className = 'mult-row';
  row.innerHTML = `
    <input type="text" placeholder="倍率説明" style="font-size:11px;">
    <input type="number" placeholder="1.0" step="0.01" min="0.01" style="font-size:11px;" oninput="prvAtk('${t}')"
      onkeydown="if(event.key==='Enter'){event.preventDefault();regAtk('${t}');}">
    <button class="del-btn" onclick="this.parentElement.remove();prvAtk('${t}')">✕</button>`;
  ml.appendChild(row);
}

// プリセット → 技1の倍率欄に追加
function applyPreset(t, i) {
  const p = presets[i];
  const ml = document.getElementById(`atk${t}-mults1`);
  if (!ml) return;
  const row = document.createElement('div');
  row.className = 'mult-row';
  row.innerHTML = `
    <input type="text" value="${p.label}" style="font-size:11px;">
    <input type="number" value="${p.val}" step="0.01" min="0.01" style="font-size:11px;" oninput="prvAtk('${t}')"
      onkeydown="if(event.key==='Enter'){event.preventDefault();regAtk('${t}');}">
    <button class="del-btn" onclick="this.parentElement.remove();prvAtk('${t}')">✕</button>`;
  ml.appendChild(row);
  prvAtk(t);
}

// ===== 技ブロックから計算 =====
function getMoveData(t) {
  const stat = parseFloat(document.getElementById(`atk${t}-stat`).value) || 0;
  const moves = [];
  // 技1（固定）
  const move1 = document.getElementById(`atk${t}-move1`)?.value.trim() || '';
  const pow1  = safeEval(document.getElementById(`atk${t}-pow1`)?.value || '0');
  let mp1 = 1, md1 = [];
  document.querySelectorAll(`#atk${t}-mults1 .mult-row`).forEach(r => {
    const ri = r.querySelectorAll('input');
    const label = ri[0].value.trim();
    const v = parseFloat(ri[1].value);
    if (!isNaN(v) && v > 0) { mp1 *= v; md1.push({ label: label || '倍率', val: v }); }
  });
  moves.push({ moveName: move1, pow: pow1, mp: mp1, mDetails: md1 });
  // 技は1つのみ（複数技機能削除済み）
  return { stat, moves };
}

function calcMoveBlocks(t) {
  const { stat, moves } = getMoveData(t);
  let total = 0;
  const parts = moves.filter(m => m.pow > 0).map(m => {
    const val = Math.round(m.pow * stat * m.mp);
    total += val;
    return { ...m, stat, val };
  });
  return { stat, total, parts };
}

function addMultToFixed(t, n) {
  const ml = document.getElementById(`atk${t}-mults${n}`);
  const row = document.createElement('div');
  row.className = 'mult-row';
  row.innerHTML = `
    <input type="text" placeholder="倍率説明" style="font-size:11px;">
    <input type="number" placeholder="1.0" step="0.01" min="0.01" style="font-size:11px;" oninput="prvAtk('${t}')"
      onkeydown="if(event.key==='Enter'){event.preventDefault();regAtk('${t}');}">
    <button class="del-btn" onclick="this.parentElement.remove();prvAtk('${t}')">✕</button>`;
  ml.appendChild(row);
}

function focusFirstMultA(idx, t) {
  // 技1の最後の倍率数値欄にフォーカス
  const rows = document.querySelectorAll(`#atk${t}-mults1 .mult-row`);
  if (rows.length > 0) rows[rows.length-1].querySelectorAll('input')[1]?.focus();
}

// ===== プレビュー =====
function prvAtk(t) {
  const { stat, total, parts } = calcMoveBlocks(t);
  const cls = `atk${t}`;
  const str = parts.map(p => {
    const mStr = p.mDetails.map(d => `×${d.val}`).join('');
    return `${p.pow}×${stat}${mStr}`;
  }).join(' + ');
  document.getElementById(`atk${t}-prv`).innerHTML =
    `<span class="v">${str || '—'}</span> = <span class="r ${cls}">${total ? total.toLocaleString() : '—'}</span>`;
}


function prvDef(t) {
  const H  = parseFloat(document.getElementById(`def${t}-H`).value) || 0;
  const D2 = parseFloat(document.getElementById(`def${t}-${t}`).value) || 0;
  const res = H * D2;
  document.getElementById(`def${t}-prv`).innerHTML =
    `計算式: <span class="v">${H||'?'} × ${D2||'?'}</span> = <span class="r def${t}">${res ? res.toLocaleString() : '—'}</span>`;
}

// ===== 登録 =====
function regAtk(t) {
  const stat    = parseFloat(document.getElementById(`atk${t}-stat`).value);
  const species = document.getElementById(`atk${t}-species`).value.trim();
  if (!stat) { alert('実数値を入力してください'); return; }
  const { total, parts } = calcMoveBlocks(t);
  if (parts.length === 0 || total === 0) { alert('技威力を入力してください'); return; }
  const moveNames = parts.map(p => p.moveName).filter(Boolean).join('+');
  const name = [stat, species, moveNames].filter(Boolean).join(' ') || '名称なし';
  const statStr = parts.map(p => `${p.pow}-${stat}`).join('+');
  const key = `atk${t}`;
  S[key].entries.push({ name, value: total, statStr, stat, parts });
  S[key].entries.sort((a, b) => b.value - a.value);
  // リセット
  document.getElementById(`atk${t}-species`).value = '';
  document.getElementById(`atk${t}-stat`).value = '';
  document.getElementById(`atk${t}-move1`).value = '';
  document.getElementById(`atk${t}-pow1`).value = '';
  document.getElementById(`atk${t}-mults1`).innerHTML = `<div class="mult-row">
    <input type="text" placeholder="倍率説明" style="font-size:11px;">
    <input type="number" placeholder="1.5" step="0.01" min="0.01" style="font-size:11px;" oninput="prvAtk('${t}')"
      onkeydown="if(event.key==='Enter'){event.preventDefault();regAtk('${t}');}">
    <button class="del-btn" onclick="this.parentElement.remove();prvAtk('${t}')">✕</button>
  </div>`;
  document.getElementById(`atk${t}-prv`).innerHTML = '計算式: <span class="v">—</span>';
  render(key);
  saveAll();
}

function prvDefUnified() {
  const H = parseFloat(document.getElementById('def-H').value) || 0;
  const B = parseFloat(document.getElementById('def-B').value) || 0;
  const D = parseFloat(document.getElementById('def-D').value) || 0;
  const hb = H * B, hd = H * D;
  document.getElementById('def-prv-B').innerHTML =
    `HB: <span class="v">${H||'?'} × ${B||'?'}</span> = <span class="r defB">${hb ? hb.toLocaleString() : '—'}</span>`;
  document.getElementById('def-prv-D').innerHTML =
    `HD: <span class="v">${H||'?'} × ${D||'?'}</span> = <span class="r defD">${hd ? hd.toLocaleString() : '—'}</span>`;
}

function regDefUnified() {
  const H    = parseFloat(document.getElementById('def-H').value);
  const B    = parseFloat(document.getElementById('def-B').value);
  const D    = parseFloat(document.getElementById('def-D').value);
  const label = document.getElementById('def-name').value.trim();
  if (!H || !B || !D) { alert('H・B・D すべて入力してください'); return; }

  const nameB = `${H}-${B}${label ? ' ' + label : ''}`;
  const nameD = `${H}-${D}${label ? ' ' + label : ''}`;

  // HBに登録
  S.defB.entries.push({ name: nameB, value: H * B, statStr: `${H}-${B}` });
  S.defB.entries.sort((a, b) => b.value - a.value);
  // HDに登録
  S.defD.entries.push({ name: nameD, value: H * D, statStr: `${H}-${D}` });
  S.defD.entries.sort((a, b) => b.value - a.value);

  // リセット
  ['def-name','def-H','def-B','def-D'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('def-prv-B').innerHTML = 'HB: <span class="v">—</span>';
  document.getElementById('def-prv-D').innerHTML = 'HD: <span class="v">—</span>';

  render('defB'); render('defD');
  saveAll();
}

function regDef(t) {
  const H  = parseFloat(document.getElementById(`def${t}-H`).value);
  const D2 = parseFloat(document.getElementById(`def${t}-${t}`).value);
  const name = document.getElementById(`def${t}-name`).value.trim() || '名称なし';
  if (!H || !D2) { alert('実数値を入力してください'); return; }
  const value = H * D2;
  const statStr = `${H}-${D2}`;
  const key = `def${t}`;
  S[key].entries.push({ name, value, statStr });
  S[key].entries.sort((a, b) => b.value - a.value);
  [`def${t}-name`, `def${t}-H`, `def${t}-${t}`].forEach(id => document.getElementById(id).value = '');
  document.getElementById(`def${t}-prv`).innerHTML = '計算式: <span class="v">—</span>';
  render(key);
  saveAll();
}

// ===== ライン =====
function addLine(type) {
  const val  = parseFloat(document.getElementById(`${type}-lv`).value);
  if (isNaN(val)) { alert('指数値を入力してください'); return; }
  const name = `ライン${S[type].lines.length + 1}`;
  S[type].lines.push({ name, value: val });
  S[type].lines.sort((a, b) => b.value - a.value);
  document.getElementById(`${type}-lv`).value = '';
  render(type); renderLL(type);
  saveAll();
}

function switchAtkLineTab(mode) {
  document.getElementById('atk-inputs-hb').style.display  = mode === 'hb'  ? 'flex' : 'none';
  document.getElementById('atk-inputs-idx').style.display = mode === 'idx' ? 'flex' : 'none';
  document.getElementById('atk-tab-hb').classList.toggle('active',  mode === 'hb');
  document.getElementById('atk-tab-idx').classList.toggle('active', mode === 'idx');
}

function addLineAtkIdx() {
  const vA = parseFloat(document.getElementById('atkA-lv').value);
  const vC = parseFloat(document.getElementById('atkC-lv').value);
  if (isNaN(vA) && isNaN(vC)) { alert('少なくとも一方の指数値を入力してください'); return; }
  if (!isNaN(vA)) {
    S.atkA.lines.push({ name: `ライン${S.atkA.lines.length + 1}`, value: vA });
    S.atkA.lines.sort((a, b) => b.value - a.value);
    render('atkA'); renderLL('atkA');
  }
  if (!isNaN(vC)) {
    S.atkC.lines.push({ name: `ライン${S.atkC.lines.length + 1}`, value: vC });
    S.atkC.lines.sort((a, b) => b.value - a.value);
    render('atkC'); renderLL('atkC');
  }
  document.getElementById('atkA-lv').value = '';
  document.getElementById('atkC-lv').value = '';
  saveAll();
}

function addLineAtkUnified() {
  const H = parseFloat(document.getElementById('atk-line-H').value);
  const B = parseFloat(document.getElementById('atk-line-B').value);
  const D = parseFloat(document.getElementById('atk-line-D').value);
  if (isNaN(H) || isNaN(B) || isNaN(D)) { alert('H・B・D すべて入力してください'); return; }

  const nameA = `ライン${S.atkA.lines.length + 1}`;
  const nameC = `ライン${S.atkC.lines.length + 1}`;

  S.atkA.lines.push({ name: nameA, value: H * B, statStr: `${H}×${B}` });
  S.atkA.lines.sort((a, b) => b.value - a.value);
  S.atkC.lines.push({ name: nameC, value: H * D, statStr: `${H}×${D}` });
  S.atkC.lines.sort((a, b) => b.value - a.value);

  document.getElementById('atk-line-H').value = '';
  document.getElementById('atk-line-B').value = '';
  document.getElementById('atk-line-D').value = '';

  render('atkA'); renderLL('atkA');
  render('atkC'); renderLL('atkC');
  saveAll();
}

function addLineHB(type) {
  const H = parseFloat(document.getElementById(`${type}-lv-H`).value);
  const B = parseFloat(document.getElementById(`${type}-lv-B`).value);
  if (isNaN(H) || isNaN(B)) { alert('HP と 防御/特防を入力してください'); return; }
  const val  = H * B;
  const name = `ライン${S[type].lines.length + 1}`;
  S[type].lines.push({ name, value: val, statStr: `${H}×${B}` });
  S[type].lines.sort((a, b) => b.value - a.value);
  document.getElementById(`${type}-lv-H`).value = '';
  document.getElementById(`${type}-lv-B`).value = '';
  render(type); renderLL(type);
  saveAll();
}

function switchLineTab(type, mode) {
  document.getElementById(`${type}-inputs-idx`).style.display = mode === 'idx' ? 'flex' : 'none';
  document.getElementById(`${type}-inputs-hb`).style.display  = mode === 'hb'  ? 'flex' : 'none';
  document.getElementById(`${type}-tab-idx`).classList.toggle('active', mode === 'idx');
  document.getElementById(`${type}-tab-hb`).classList.toggle('active',  mode === 'hb');
}
function removeLine(type, i) {
  S[type].lines.splice(i, 1);
  render(type); renderLL(type);
  saveAll();
}

// ===== 編集モード =====
function toggleEdit(type) {
  S[type].editMode = !S[type].editMode;
  const btn = document.getElementById(`${type}-edit-btn`);
  btn.textContent = S[type].editMode ? '完了' : '編集';
  btn.classList.toggle('active', S[type].editMode);
  render(type);
}
function removeEntry(type, i) {
  S[type].entries.splice(i, 1);
  render(type);
  saveAll();
}

// ===== データ保存（JSONエクスポート）=====
// ===== データセット管理 =====
// ストレージ構造: { currentId, datasets: { id: { name, data } } }
const STORAGE_KEY = 'pokemon-index-tool-v6';

let DS = {
  currentId: null,
  datasets: {}
};

function genId() { return 'ds_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

function buildData() {
  return {
    version: 1,
    atkA: { entries: S.atkA.entries, lines: S.atkA.lines },
    atkC: { entries: S.atkC.entries, lines: S.atkC.lines },
    defB: { entries: S.defB.entries, lines: S.defB.lines },
    defD: { entries: S.defD.entries, lines: S.defD.lines },
  };
}

function applyData(data) {
  if (!data) return false;
  ['atkA','atkC','defB','defD'].forEach(t => {
    S[t].entries = (data[t] && data[t].entries) || [];
    S[t].lines   = (data[t] && data[t].lines)   || [];
  });
  return true;
}

// 現在のデータセットを保存してlocalStorageに書き込む
function saveAll() {
  if (DS.currentId && DS.datasets[DS.currentId]) {
    DS.datasets[DS.currentId].data = buildData();
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DS)); } catch(e) {}
  if (isOwner) saveSupabase();
}

// ドロップダウン再描画
function renderDatasetSelect() {
  const sel = document.getElementById('dataset-select');
  sel.innerHTML = '';
  Object.entries(DS.datasets).forEach(([id, ds]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = ds.name;
    if (id === DS.currentId) opt.selected = true;
    sel.appendChild(opt);
  });
}

// データセット切り替え
function switchDataset(id) {
  // 現在のデータを保存してから切り替え
  if (DS.currentId && DS.datasets[DS.currentId]) {
    DS.datasets[DS.currentId].data = buildData();
  }
  DS.currentId = id;
  applyData(DS.datasets[id] ? DS.datasets[id].data : null);
  saveAll();
  renderPresets();
  ['atkA','atkC','defB','defD'].forEach(t => { render(t); renderLL(t); });
}

// ===== データセット入力モーダル =====
let _dsModalCallback = null;

function openDsModal(title, defaultVal, callback) {
  document.getElementById('ds-modal-title').textContent = title;
  const input = document.getElementById('ds-modal-input');
  input.value = defaultVal || '';
  _dsModalCallback = callback;
  document.getElementById('ds-modal').classList.add('open');
  setTimeout(() => { input.focus(); input.select(); }, 50);
}

function dsModalOk() {
  const val = document.getElementById('ds-modal-input').value.trim();
  document.getElementById('ds-modal').classList.remove('open');
  if (val && _dsModalCallback) _dsModalCallback(val);
  _dsModalCallback = null;
}

function dsModalCancel() {
  document.getElementById('ds-modal').classList.remove('open');
  _dsModalCallback = null;
}

// 新規データセット作成
function newDataset() {
  openDsModal('新規データセット名', 'レギュレーション', (name) => {
    if (DS.currentId && DS.datasets[DS.currentId]) {
      DS.datasets[DS.currentId].data = buildData();
    }
    const id = genId();
    DS.datasets[id] = { name, data: { version:1, atkA:{entries:[],lines:[]}, atkC:{entries:[],lines:[]}, defB:{entries:[],lines:[]}, defD:{entries:[],lines:[]} } };
    DS.currentId = id;
    applyData(DS.datasets[id].data);
    saveAll(); renderDatasetSelect(); renderPresets();
    ['atkA','atkC','defB','defD'].forEach(t => { render(t); renderLL(t); });
  });
}

// 現在のデータセットを複製
function duplicateDataset() {
  if (!DS.currentId) return;
  DS.datasets[DS.currentId].data = buildData();
  const srcName = DS.datasets[DS.currentId].name;
  openDsModal('複製後の名前', srcName + ' (コピー)', (name) => {
    const id = genId();
    DS.datasets[id] = { name, data: JSON.parse(JSON.stringify(DS.datasets[DS.currentId].data)) };
    DS.currentId = id;
    applyData(DS.datasets[id].data);
    saveAll(); renderDatasetSelect(); renderPresets();
    ['atkA','atkC','defB','defD'].forEach(t => { render(t); renderLL(t); });
  });
}

// 名前変更
function renameDataset() {
  if (!DS.currentId) return;
  const name = DS.datasets[DS.currentId].name;
  openDsModal('データセット名を変更', name, (newName) => {
    DS.datasets[DS.currentId].name = newName;
    saveAll(); renderDatasetSelect();
  });
}

// 削除
function deleteDataset() {
  if (!DS.currentId) return;
  const ids = Object.keys(DS.datasets);
  if (ids.length <= 1) { alert('最後のデータセットは削除できません'); return; }
  if (!confirm(`「${DS.datasets[DS.currentId].name}」を削除しますか？`)) return;
  delete DS.datasets[DS.currentId];
  const remaining = Object.keys(DS.datasets);
  DS.currentId = remaining[0];
  applyData(DS.datasets[DS.currentId].data);
  saveAll();
  renderDatasetSelect();
  renderPresets();
  ['atkA','atkC','defB','defD'].forEach(t => { render(t); renderLL(t); });
}

// 初回ロード
function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.datasets && Object.keys(saved.datasets).length > 0) {
        DS = saved;
        // currentIdが存在しない場合は最初のIDに
        if (!DS.datasets[DS.currentId]) DS.currentId = Object.keys(DS.datasets)[0];
        applyData(DS.datasets[DS.currentId].data);
        return true;
      }
    }
  } catch(e) {}
  // 初回: デフォルトデータセットを作成
  const id = genId();
  DS.datasets[id] = { name: 'デフォルト', data: { version:1, atkA:{entries:[],lines:[]}, atkC:{entries:[],lines:[]}, defB:{entries:[],lines:[]}, defD:{entries:[],lines:[]} } };
  DS.currentId = id;

  // 旧バージョン(v5)のデータがあれば移行
  try {
    const oldRaw = localStorage.getItem('pokemon-index-tool-v5');
    if (oldRaw) {
      const oldData = JSON.parse(oldRaw);
      DS.datasets[id].data = oldData;
      DS.datasets[id].name = 'デフォルト（移行済み）';
      applyData(oldData);
    }
  } catch(e) {}
  return false;
}

function exportData() {
  const json = JSON.stringify(buildData(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const ts   = new Date().toISOString().slice(0,10);
  a.href = url; a.download = `pokemon-index-${ts}.json`;
  a.click(); URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      applyData(data);
      saveAll();
      renderPresets();
      ['atkA','atkC','defB','defD'].forEach(t => { render(t); renderLL(t); });
      alert('データを読み込みました');
    } catch(err) { alert('読み込みに失敗しました'); }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ===== データリセット（現在のデータセットのみ）=====
function resetAll() {
  if (!confirm('現在のデータセットのデータをすべて削除しますか？')) return;
  ['atkA','atkC','defB','defD'].forEach(t => { S[t].entries = []; S[t].lines = []; });
  presets = [
    { label: '1.5', val: 1.5 },
    { label: '2',   val: 2.0 },
    { label: '1.2', val: 1.2 },
    { label: '1.3', val: 1.3 },
  ];
  saveAll();
  renderPresets();
  ['atkA','atkC','defB','defD'].forEach(t => { render(t); renderLL(t); });
}


// ===== 使い方モーダル =====
function openHelpModal() {
  document.getElementById('help-modal').classList.add('open');
}
function closeHelpModal() {
  document.getElementById('help-modal').classList.remove('open');
}

// ===== 共有モーダル =====
function openShareModal() {
  // 現在のデータを保存してから全データセットをエクスポート
  if (DS.currentId && DS.datasets[DS.currentId]) {
    DS.datasets[DS.currentId].data = buildData();
  }
  const json = JSON.stringify(DS);
  document.getElementById('share-export-text').value = json;
  document.getElementById('share-import-text').value = '';
  document.getElementById('copy-btn').textContent = 'クリップボードにコピー';
  document.getElementById('share-modal').classList.add('open');
}

function closeShareModal() {
  document.getElementById('share-modal').classList.remove('open');
}

function copyShareText() {
  const txt = document.getElementById('share-export-text').value;
  navigator.clipboard.writeText(txt).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = 'コピーしました ✓';
    btn.style.color = '#4ade80'; btn.style.borderColor = '#4ade80';
    setTimeout(() => {
      btn.textContent = 'クリップボードにコピー';
      btn.style.color = '#c084fc'; btn.style.borderColor = '#c084fc';
    }, 2000);
  }).catch(() => {
    // clipboard API非対応時はselect
    const ta = document.getElementById('share-export-text');
    ta.select(); document.execCommand('copy');
  });
}

function pasteImport() {
  const txt = document.getElementById('share-import-text').value.trim();
  if (!txt) { alert('データを貼り付けてください'); return; }
  try {
    const data = JSON.parse(txt);
    // 複数データセット形式かどうか判定
    if (data.datasets && data.currentId) {
      if (!confirm('すべてのデータセットを上書きインポートします。よろしいですか？')) return;
      DS = data;
      if (!DS.datasets[DS.currentId]) DS.currentId = Object.keys(DS.datasets)[0];
      applyData(DS.datasets[DS.currentId].data);
      saveAll();
      renderDatasetSelect();
    } else {
      // 旧形式（単一データセット）→ 現在のデータセットに適用
      applyData(data);
      saveAll();
    }
    renderPresets();
    ['atkA','atkC','defB','defD'].forEach(t => { render(t); renderLL(t); });
    closeShareModal();
    alert('データを読み込みました');
  } catch(e) { alert('データの形式が正しくありません'); }
}

// モーダル外クリックで閉じる
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('share-modal').addEventListener('click', function(e) {
    if (e.target === this) closeShareModal();
  });
  document.getElementById('help-modal').addEventListener('click', function(e) {
    if (e.target === this) closeHelpModal();
  });
  document.getElementById('login-modal').addEventListener('click', function(e) {
    if (e.target === this) closeLoginModal();
  });
  // データセットバーの初期化（DOMContentLoaded後に確実に実行）
  renderDatasetSelect();
});

// ===== 名前保存（編集モード中のinputからblur/Enterで確定）=====
function renameSave(type, idx, input) {
  const v = input.value.trim();
  if (v) S[type].entries[idx].name = v;
  else input.value = S[type].entries[idx].name;
  saveAll();
}

// ===== 描画 =====
function render(type) {
  const area     = document.getElementById(`${type}-list`);
  const entries  = S[type].entries;
  const lines    = S[type].lines;
  const editMode = S[type].editMode;

  if (!entries.length && !lines.length) {
    area.innerHTML = '<div class="empty-hint">登録データがありません</div>';
    area.classList.remove('edit-mode');
    return;
  }
  const isAtk = type === 'atkA' || type === 'atkC';

  // 火力側: sortKeyは相性変更込みの実効値(×mult×0.44)
  const entrySortKey = e => {
    const mult = e.multiplier || 1;
    if (isAtk) return Math.round(e.value * mult * 0.44);
    return Math.round(e.value / mult);
  };
  const lineSortKey = l => isAtk ? l.value : l.value;

  const maxVal = Math.max(
    ...entries.map(e => entrySortKey(e)),
    ...lines.map(l => lineSortKey(l)),
    1
  );

  const items = [
    ...entries.map((e, i) => ({ ...e, kind: 'entry', idx: i, sortKey: entrySortKey(e) })),
    ...lines.map(l => ({ ...l, kind: 'line', sortKey: lineSortKey(l) })),
  ].sort((a, b) => b.sortKey - a.sortKey);

  area.innerHTML = '';
  editMode ? area.classList.add('edit-mode') : area.classList.remove('edit-mode');

  items.forEach(item => {
    const pct = Math.max(2, Math.round(item.value / maxVal * 100));
    if (item.kind === 'entry') {
      const d = document.createElement('div');
      d.className = 'bar-row';
      const mult = item.multiplier || 1;
      // 耐久側は逆数を適用（×2選択→÷2）
      const dispVal = isAtk
        ? Math.round(item.value * mult)
        : Math.round(item.value / mult);
      const dispEff = isAtk ? Math.round(dispVal * 0.44) : null;
      const dispEffHtml = isAtk
        ? `<div class="bar-effective" title="実効値 (×0.44)">≈${dispEff.toLocaleString()}</div>`
        : '';
      const multLabel = mult !== 1
        ? (isAtk ? `×${mult}` : `÷${mult}`)
        : '';
      const dispIndex = mult !== 1
        ? `<span style="color:#fb923c;font-size:10px;font-family:var(--mono);flex-shrink:0;">${multLabel}</span>`
        : '';
      const dispIndexEl = isAtk
        ? `<button class="bar-index-btn" onclick="toggleMultPopup(event,'${type}',${item.idx})" title="クリックで倍率を確認">${dispVal.toLocaleString()}</button>`
        : `<div class="bar-index">${dispVal.toLocaleString()}</div>`;
      const affinityId = `affinity-${type}-${item.idx}`;
      const affinityBtnActive = mult !== 1 ? ' active' : '';
      d.innerHTML = `
        <button class="entry-del-btn" onclick="removeEntry('${type}',${item.idx})">✕</button>
        <div class="bar-name" title="${item.name}">${item.name}</div>
        <input class="bar-name-input" value="${item.name}"
          onblur="renameSave('${type}',${item.idx},this)"
          onkeydown="if(event.key==='Enter'){this.blur()}else if(event.key==='Escape'){this.value=S['${type}'].entries[${item.idx}].name;this.blur()}">
        ${dispIndex}
        ${dispIndexEl}
        ${dispEffHtml}
        <button class="affinity-btn${affinityBtnActive}" onclick="toggleAffinity(event,'${type}',${item.idx},'${affinityId}')">相性変更</button>`;
      // 相性パネル（折りたたみ）
      const panel = document.createElement('div');
      panel.id = affinityId;
      panel.className = 'affinity-panel';
      panel.style.display = 'none';
      panel.innerHTML = `
        <button class="affinity-mult-btn" onclick="applyAffinity('${type}',${item.idx},2)">×2</button>
        <button class="affinity-mult-btn" onclick="applyAffinity('${type}',${item.idx},4)">×4</button>
        <button class="affinity-mult-btn" onclick="applyAffinity('${type}',${item.idx},0.5)">×1/2</button>
        <button class="affinity-mult-btn" onclick="applyAffinity('${type}',${item.idx},0.25)">×1/4</button>
        <button class="affinity-mult-btn" onclick="applyAffinity('${type}',${item.idx},1.5)">×1.5</button>
        <button class="affinity-reset-btn" onclick="resetAffinity('${type}',${item.idx})">元に戻す</button>`;
      d.appendChild(panel);
      area.appendChild(d);
    } else {
      const d = document.createElement('div');
      d.className = 'line-row';
      const lc = item.lineColor || '#facc15';
      const labelText = isAtk
        ? item.value.toLocaleString()
        : `${item.name} ${item.value.toLocaleString()}`;
      d.innerHTML = `
        <div class="lm-label" style="color:${lc}">${labelText}</div>
        <div class="lm-line" style="background:${lc};opacity:0.7"></div>`;
      area.appendChild(d);
    }
  });
}

// ===== 耐久パネルのライン（火力実効値から算出）=====
function getDefLineMult(t) {
  let mp = 1, parts = [];
  document.querySelectorAll(`#def${t}-line-mults .mult-row`).forEach(r => {
    const v = parseFloat(r.querySelectorAll('input')[1].value);
    if (!isNaN(v) && v > 0) { mp *= v; parts.push(v); }
  });
  return { mp, parts };
}

function prvDefLine(t) {
  const stat = parseFloat(document.getElementById(`def${t}-line-stat`).value) || 0;
  const pow  = safeEval(document.getElementById(`def${t}-line-pow`).value || '0');
  const { mp } = getDefLineMult(t);
  const eff   = Math.round(pow * stat * mp * 0.44);
  const eff85 = Math.floor(eff * 0.85);
  const prv   = document.getElementById(`def${t}-line-prv`);
  prv.innerHTML = eff
    ? `<span style="color:#f87171">${eff.toLocaleString()}</span> / <span style="color:#4ade80">${eff85.toLocaleString()}(85%)</span>`
    : '';
}

function addDefLineMult(t) {
  const list = document.getElementById(`def${t}-line-mults`);
  const row = document.createElement('div');
  row.className = 'mult-row';
  row.innerHTML = `
    <input type="text" placeholder="倍率説明" style="font-size:11px;">
    <input type="number" placeholder="1.0" step="0.01" min="0.01" style="font-size:11px;" oninput="prvDefLine('${t}')"
      onkeydown="if(event.key==='Enter'){event.preventDefault();addLineFromAtk('${t}');}">
    <button class="del-btn" onclick="this.parentElement.remove();prvDefLine('${t}')">✕</button>`;
  list.appendChild(row);
}

function focusFirstDefLineMult(t) {
  const rows = document.querySelectorAll(`#def${t}-line-mults .mult-row`);
  if (rows.length > 0) {
    rows[rows.length - 1].querySelectorAll('input')[1]?.focus();
  }
}

function applyDefLinePreset(t, i) {
  const p = presets[i];
  const list = document.getElementById(`def${t}-line-mults`);
  const row = document.createElement('div');
  row.className = 'mult-row';
  row.innerHTML = `
    <input type="text" value="${p.label}" style="font-size:11px;">
    <input type="number" value="${p.val}" step="0.01" min="0.01" style="font-size:11px;" oninput="prvDefLine('${t}')"
      onkeydown="if(event.key==='Enter'){event.preventDefault();addLineFromAtk('${t}');}">
    <button class="del-btn" onclick="this.parentElement.remove();prvDefLine('${t}')">✕</button>`;
  list.appendChild(row);
  prvDefLine(t);
}

function switchDefLineMode(t, mode) {
  document.getElementById(`def${t}-mode-calc`).style.display = mode === 'calc' ? '' : 'none';
  document.getElementById(`def${t}-mode-eff`).style.display  = mode === 'eff'  ? '' : 'none';
  document.getElementById(`def${t}-tab-calc`).classList.toggle('active', mode === 'calc');
  document.getElementById(`def${t}-tab-eff`).classList.toggle('active',  mode === 'eff');
}

function addLineFromEff(t) {
  const eff = parseFloat(document.getElementById(`def${t}-line-eff`).value);
  if (isNaN(eff) || eff <= 0) { alert('実効値を入力してください'); return; }
  const eff85 = Math.floor(eff * 0.85);
  const type = t === 'B' ? 'defB' : 'defD';
  const color = LINE_COLORS[window._defLinePairCount[t] % LINE_COLORS.length];
  window._defLinePairCount[t]++;
  S[type].lines.push({ name: `${eff}(最高乱)`,  value: eff,   lineColor: color });
  S[type].lines.push({ name: `${eff}(最低乱)`, value: eff85, lineColor: color });
  S[type].lines.sort((a, b) => b.value - a.value);
  document.getElementById(`def${t}-line-eff`).value = '';
  render(type); renderLL(type); saveAll();
}

// ペア登録カウンター（色の割り当て用）
if (!window._defLinePairCount) window._defLinePairCount = { B: 0, D: 0 };

function addLineFromAtk(t) {
  const stat = parseFloat(document.getElementById(`def${t}-line-stat`).value);
  const pow  = safeEval(document.getElementById(`def${t}-line-pow`).value || '0');
  if (!stat || !pow) { alert('実数値と技威力を入力してください'); return; }
  const { mp, parts } = getDefLineMult(t);
  const eff     = Math.round(pow * stat * mp * 0.44);
  const eff85   = Math.floor(eff * 0.85);
  const multStr = parts.length ? `×${parts.join('×')}` : '';
  const type    = t === 'B' ? 'defB' : 'defD';
  const rawName = parts.length
    ? `${pow}*${stat}*${parts.join('*')}`
    : `${pow}*${stat}`;
  const color   = LINE_COLORS[window._defLinePairCount[t] % LINE_COLORS.length];
  window._defLinePairCount[t]++;
  // 最高乱ライン
  S[type].lines.push({ name: `${rawName}(最高乱)`, value: eff,   statStr: `${pow}×${stat}${multStr}×0.44`,     lineColor: color });
  // 最低乱ライン（×0.85）
  S[type].lines.push({ name: `${rawName}(最低乱)`, value: eff85, statStr: `${pow}×${stat}${multStr}×0.44×0.85`, lineColor: color });
  S[type].lines.sort((a, b) => b.value - a.value);
  // リセット
  document.getElementById(`def${t}-line-stat`).value = '';
  document.getElementById(`def${t}-line-pow`).value  = '';
  document.getElementById(`def${t}-line-mults`).innerHTML = `<div class="mult-row">
    <input type="text" placeholder="倍率説明" style="font-size:11px;">
    <input type="number" placeholder="1.5" step="0.01" min="0.01" style="font-size:11px;" oninput="prvDefLine('${t}')"
      onkeydown="if(event.key==='Enter'){event.preventDefault();addLineFromAtk('${t}');}">
    <button class="del-btn" onclick="this.parentElement.remove();prvDefLine('${t}')">✕</button>
  </div>`;
  document.getElementById(`def${t}-line-prv`).innerHTML = '';
  render(type); renderLL(type);
  saveAll();
}

// ===== 相性変更 =====
function toggleAffinity(e, type, idx, panelId) {
  e.stopPropagation();
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  // 他の相性パネルを閉じる
  document.querySelectorAll('.affinity-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.affinity-btn').forEach(b => b.classList.remove('open'));
  panel.style.display = isOpen ? 'none' : 'flex';
}

function applyAffinity(type, idx, mult) {
  S[type].entries[idx].multiplier = mult;
  render(type);
}

function resetAffinity(type, idx) {
  delete S[type].entries[idx].multiplier;
  render(type);
}

function clearAllLines(type) {
  S[type].lines = [];
  // defBとdefDのカウンターをリセット
  if (type === 'defB') window._defLinePairCount['B'] = 0;
  if (type === 'defD') window._defLinePairCount['D'] = 0;
  render(type); renderLL(type);
  saveAll();
}

function resetAllAffinity(type) {
  S[type].entries.forEach(e => delete e.multiplier);
  render(type);
}

// ===== 倍率ポップアップ =====
function toggleMultPopup(e, type, idx) {
  e.stopPropagation();
  // 既存のポップアップを閉じる
  document.querySelectorAll('.mult-popup').forEach(p => p.remove());

  const entry = S[type].entries[idx];
  const btn = e.currentTarget;

  // 既にこのボタンのポップアップが開いていた場合は閉じるだけ
  if (btn._popupOpen) { btn._popupOpen = false; return; }

  const parts = entry.parts || (entry.pow ? [{ moveName: '', pow: entry.pow, stat: entry.stat, mDetails: entry.mDetails || [] }] : []);
  const popup = document.createElement('div');
  popup.className = 'mult-popup';

  let rows = `<div class="mult-popup-title">内訳　攻撃実数値: ${entry.stat ?? '—'}</div>`;
  parts.forEach((p, i) => {
    if (parts.length > 1) rows += `<div class="mult-popup-row" style="color:var(--text-dim);font-size:10px;margin-top:4px;">技${i+1}: ${p.moveName || '—'}</div>`;
    rows += `<div class="mult-popup-row"><span class="mult-popup-label">技威力</span><span class="mult-popup-val">${p.pow}</span></div>`;
    if (p.mDetails && p.mDetails.length) {
      p.mDetails.forEach(d => {
        rows += `<div class="mult-popup-row"><span class="mult-popup-label">${d.label}</span><span class="mult-popup-val">×${d.val}</span></div>`;
      });
    }
    rows += `<div class="mult-popup-row"><span class="mult-popup-label">小計</span><span class="mult-popup-val">${p.val ? p.val.toLocaleString() : Math.round(p.pow * (entry.stat||0) * (p.mp||1)).toLocaleString()}</span></div>`;
  });
  rows += `<div class="mult-popup-row" style="border-top:1px solid var(--border);margin-top:2px;padding-top:4px;"><span class="mult-popup-label">合計指数</span><span class="mult-popup-val">${entry.value.toLocaleString()}</span></div>`;
  popup.innerHTML = rows;

  btn.style.position = 'relative';
  btn.appendChild(popup);
  btn._popupOpen = true;

  // 外クリックで閉じる
  setTimeout(() => {
    document.addEventListener('click', function closePopup() {
      popup.remove(); btn._popupOpen = false;
      document.removeEventListener('click', closePopup);
    }, { once: true });
  }, 0);
}

function renderLL(type) {
  const el = document.getElementById(`${type}-ll`);
  el.innerHTML = '';
  S[type].lines.forEach((l, i) => {
    const d = document.createElement('div');
    d.className = 'line-item';
    const lcHex = l.lineColor || '#facc15';
    d.innerHTML = `<div class="li-bar" style="background:${lcHex}"></div>
      <div class="li-name" style="color:${lcHex}">${l.name}</div>
      <div class="li-val" style="color:${lcHex}">${l.value.toLocaleString()}</div>
      <button class="del-btn" onclick="removeLine('${type}',${i})">✕</button>`;
    el.appendChild(d);
  });
}

// ===== 初期化 =====
async function initApp() {
  initSupabase();

  if (sbClient) {
    sbClient.auth.onAuthStateChange((event, session) => {
      isOwner = !!session;
      updateOwnerUI();
    });
  }

  const loaded = await loadFromSupabase();
  if (!loaded) loadAll();

  renderDatasetSelect();
  renderPresets();
  ['atkA','atkC','defB','defD'].forEach(t => { render(t); renderLL(t); });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
