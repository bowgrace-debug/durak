import { supabase } from './supabase.js';

let state = { players: [], games: [] };

async function save() {
  await supabase
    .from('game_state')
    .upsert({ id: 'main', players: state.players, games: state.games });
}

async function init() {
  const { data } = await supabase
    .from('game_state')
    .select('players, games')
    .eq('id', 'main')
    .single();

  if (data) state = data;
  render();

  supabase
    .channel('game_state')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'game_state', filter: 'id=eq.main' },
      (payload) => {
        state = { players: payload.new.players, games: payload.new.games };
        render();
      }
    )
    .subscribe();
}

const COLORS = ['#e63946','#457b9d','#f4a261','#2a9d8f','#a786df','#e9c46a','#06d6a0','#ef476f','#118ab2','#ffd166'];

function colorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffffff;
  return COLORS[h % COLORS.length];
}

function initials(name) {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function avatar(name, sm = false) {
  const c = colorFor(name);
  const cls = sm ? 'av av-sm' : 'av';
  return `<div class="${cls}" style="background:${c}22;color:${c}">${initials(name)}</div>`;
}

async function addPlayer() {
  const inp = document.getElementById('nameInput');
  const name = inp.value.trim();
  if (!name) return;
  if (state.players.includes(name)) { toast('Name bereits vorhanden'); return; }
  state.players.push(name);
  await save();
  inp.value = '';
  render();
  toast(`${name} hinzugefügt`);
}

async function removePlayer(name) {
  const inUse = state.games.some(g => g.first === name || g.second === name || g.durak === name);
  if (inUse) { toast('Spieler hat Spieleinträge — nicht löschbar'); return; }
  state.players = state.players.filter(p => p !== name);
  await save();
  render();
  toast(`${name} entfernt`);
}

async function recordGame() {
  const first  = document.getElementById('sel1').value;
  const second = document.getElementById('sel2').value;
  const durak  = document.getElementById('selD').value;
  const date   = document.getElementById('gameDate').value || today();

  if (!first || !second || !durak) { toast('Alle drei Plätze auswählen'); return; }
  const chosen = [first, second, durak];
  if (new Set(chosen).size < 3) { toast('Jeder Platz braucht einen anderen Spieler'); return; }

  state.games.push({ id: Date.now(), first, second, durak, date });
  await save();
  document.getElementById('sel1').value = '';
  document.getElementById('sel2').value = '';
  document.getElementById('selD').value = '';
  render();
  toast('Runde gespeichert! 🃏');
}

function computeStats() {
  const s = {};
  state.players.forEach(p => { s[p] = { games: 0, first: 0, second: 0, durak: 0 }; });
  state.games.forEach(g => {
    [g.first, g.second, g.durak].forEach(p => {
      if (!s[p]) s[p] = { games: 0, first: 0, second: 0, durak: 0 };
      s[p].games++;
    });
    s[g.first].first++;
    s[g.second].second++;
    s[g.durak].durak++;
  });
  return s;
}

function render() {
  renderPlayers();
  renderSelects();
  renderStats();
  renderLeaderboard();
  renderHistory();
}

function renderPlayers() {
  const el = document.getElementById('playerList');
  if (!state.players.length) {
    el.innerHTML = '<div class="empty"><div class="ico">👤</div>Noch keine Spieler</div>';
    return;
  }
  el.innerHTML = state.players.map(p => `
    <div class="player-chip">
      ${avatar(p)}
      <span class="name">${esc(p)}</span>
      <button class="btn-icon" onclick="removePlayer('${esc(p)}')" title="Entfernen">✕</button>
    </div>
  `).join('');
}

function renderSelects() {
  const opts = state.players.map(p =>
    `<option value="${esc(p)}">${esc(p)}</option>`
  ).join('');
  const base = '<option value="">–</option>' + opts;
  ['sel1','sel2','selD'].forEach(id => {
    const sel = document.getElementById(id);
    const prev = sel.value;
    sel.innerHTML = base;
    if (prev) sel.value = prev;
  });
}

function renderStats() {
  const el = document.getElementById('statsRow');
  const s = computeStats();
  const total = state.games.length;

  let topFirst = '–', topFirstN = -1;
  let mostDurak = '–', mostDurakN = -1;

  state.players.forEach(p => {
    if (s[p].first > topFirstN)  { topFirstN = s[p].first;  topFirst  = p; }
    if (s[p].durak > mostDurakN) { mostDurakN = s[p].durak; mostDurak = p; }
  });

  el.innerHTML = `
    <div class="stat-box"><div class="val">${total}</div><div class="lbl">Runden</div></div>
    <div class="stat-box"><div class="val">${state.players.length}</div><div class="lbl">Spieler</div></div>
    <div class="stat-box"><div class="val" style="font-size:1rem;color:var(--gold)">${total ? esc(topFirst) : '–'}</div><div class="lbl">Meiste Siege</div></div>
    <div class="stat-box"><div class="val" style="font-size:1rem;color:var(--accent)">${total ? esc(mostDurak) : '–'}</div><div class="lbl">Meistens Durak</div></div>
  `;
}

function renderLeaderboard() {
  const el = document.getElementById('leaderboard');
  const s = computeStats();

  const rows = state.players
    .map(p => ({ name: p, ...s[p] }))
    .filter(r => r.games > 0)
    .sort((a, b) =>
      b.first - a.first ||
      b.second - a.second ||
      a.durak - b.durak
    );

  if (!rows.length) {
    el.innerHTML = '<div class="empty"><div class="ico">🏆</div>Noch keine Runden gespielt</div>';
    return;
  }

  const medal = i => ['🥇','🥈','🥉'][i] ?? (i + 1);

  el.innerHTML = `
    <table class="board">
      <thead><tr>
        <th>#</th>
        <th>Spieler</th>
        <th>🥇</th>
        <th>🥈</th>
        <th>🃏 Durak</th>
        <th class="hide-xs">Spiele</th>
      </tr></thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr>
            <td style="font-weight:700;font-size:0.95rem">${medal(i)}</td>
            <td>
              <div style="display:flex;align-items:center;gap:0.5rem">
                ${avatar(r.name, true)}
                <span>${esc(r.name)}</span>
              </div>
            </td>
            <td><span class="badge badge-gold">${r.first}</span></td>
            <td><span class="badge badge-silver">${r.second}</span></td>
            <td><span class="badge badge-durak">${r.durak}</span></td>
            <td class="hide-xs" style="color:var(--muted)">${r.games}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderHistory() {
  const el = document.getElementById('historyList');
  if (!state.games.length) {
    el.innerHTML = '<div class="empty"><div class="ico">📜</div>Keine Runden aufgezeichnet</div>';
    return;
  }
  el.innerHTML = [...state.games].reverse().map(g => `
    <div class="hi">
      <div class="hi-date">${fmtDate(g.date)}</div>
      <div class="hi-body">
        <div class="hi-place">🥇 <strong>${esc(g.first)}</strong></div>
        <div class="hi-place">🥈 ${esc(g.second)}</div>
        <div class="hi-place" style="color:var(--accent)">🃏 ${esc(g.durak)}</div>
      </div>
      <button class="btn-icon" onclick="deleteGame(${g.id})" title="Löschen">🗑</button>
    </div>
  `).join('');
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

async function deleteGame(id) {
  state.games = state.games.filter(g => g.id !== id);
  await save();
  render();
  toast('Runde gelöscht');
}

async function confirmClear() {
  if (!state.games.length) { toast('Keine Spiele vorhanden'); return; }
  document.getElementById('overlay').classList.add('open');
}
function closeDialog() { document.getElementById('overlay').classList.remove('open'); }
async function clearAll() {
  state.games = [];
  await save();
  closeDialog();
  render();
  toast('Alle Daten gelöscht');
}

Object.assign(window, { addPlayer, removePlayer, recordGame, deleteGame, confirmClear, closeDialog, clearAll });

document.getElementById('nameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addPlayer();
});

document.getElementById('gameDate').value = today();

init();
