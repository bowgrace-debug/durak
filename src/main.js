import { supabase } from './supabase.js';

let players = [];
let games = [];
let currentUser = null;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function signInGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) toast('Login fehlgeschlagen: ' + error.message);
}

async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) toast('Logout fehlgeschlagen');
}

function setAuthUI(user) {
  const loginBtn = document.getElementById('loginBtn');
  const userBar = document.getElementById('userBar');
  const userName = document.getElementById('userName');

  if (user) {
    loginBtn.style.display = 'none';
    userBar.style.display = 'flex';
    const meta = user.user_metadata || {};
    userName.textContent = meta.full_name || user.email || 'Angemeldet';
  } else {
    loginBtn.style.display = '';
    userBar.style.display = 'none';
  }
}

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
  setAuthUI(currentUser);
  if (currentUser) {
    loadData();
  }
});

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
async function loadData() {
  const [pRes, gRes] = await Promise.all([
    supabase.from('players').select('*').order('name'),
    supabase.from('games').select(`
      id, played_on, created_at,
      first:players!games_first_id_fkey(id, name),
      second:players!games_second_id_fkey(id, name),
      durak:players!games_durak_id_fkey(id, name)
    `).order('created_at', { ascending: false }),
  ]);

  if (pRes.error) { console.error('loadPlayers:', pRes.error); return; }
  if (gRes.error) { console.error('loadGames:', gRes.error); return; }

  players = pRes.data || [];
  games = gRes.data || [];
  render();
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------
supabase
  .channel('live')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => loadData())
  .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => loadData())
  .subscribe();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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

// ---------------------------------------------------------------------------
// Player management
// ---------------------------------------------------------------------------
async function addPlayer() {
  const inp = document.getElementById('nameInput');
  const name = inp.value.trim();
  if (!name) return;
  if (players.some(p => p.name === name)) { toast('Name bereits vorhanden'); return; }

  const { error } = await supabase.from('players').insert({ name });
  if (error) { toast('Fehler: ' + error.message); return; }

  inp.value = '';
  await loadData();
  toast(`${name} hinzugefügt`);
}

async function removePlayer(name) {
  const player = players.find(p => p.name === name);
  if (!player) return;

  const inUse = games.some(g =>
    g.first?.name === name || g.second?.name === name || g.durak?.name === name
  );
  if (inUse) { toast('Spieler hat Spieleinträge — nicht löschbar'); return; }

  const { error } = await supabase.from('players').delete().eq('id', player.id);
  if (error) { toast('Fehler: ' + error.message); return; }

  await loadData();
  toast(`${name} entfernt`);
}

// ---------------------------------------------------------------------------
// Record game
// ---------------------------------------------------------------------------
async function recordGame() {
  const firstId  = document.getElementById('sel1').value;
  const secondId = document.getElementById('sel2').value;
  const durakId  = document.getElementById('selD').value;
  const date     = document.getElementById('gameDate').value || today();

  if (!firstId || !secondId || !durakId) { toast('Alle drei Plätze auswählen'); return; }
  if (new Set([firstId, secondId, durakId]).size < 3) {
    toast('Jeder Platz braucht einen anderen Spieler');
    return;
  }

  const { error } = await supabase.from('games').insert({
    first_id: firstId,
    second_id: secondId,
    durak_id: durakId,
    played_on: date,
  });
  if (error) { toast('Fehler: ' + error.message); return; }

  document.getElementById('sel1').value = '';
  document.getElementById('sel2').value = '';
  document.getElementById('selD').value = '';
  await loadData();
  toast('Runde gespeichert! 🃏');
}

async function deleteGame(id) {
  const { error } = await supabase.from('games').delete().eq('id', id);
  if (error) { toast('Fehler: ' + error.message); return; }
  await loadData();
  toast('Runde gelöscht');
}

async function confirmClear() {
  if (!games.length) { toast('Keine Spiele vorhanden'); return; }
  document.getElementById('overlay').classList.add('open');
}

function closeDialog() { document.getElementById('overlay').classList.remove('open'); }

async function clearAll() {
  const { error } = await supabase.from('games').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) { toast('Fehler: ' + error.message); closeDialog(); return; }
  closeDialog();
  await loadData();
  toast('Alle Daten gelöscht');
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function computeStats() {
  const s = {};
  players.forEach(p => { s[p.id] = { name: p.name, games: 0, first: 0, second: 0, durak: 0 }; });
  games.forEach(g => {
    const ids = [g.first?.id, g.second?.id, g.durak?.id].filter(Boolean);
    ids.forEach(id => {
      if (!s[id]) return;
      s[id].games++;
    });
    if (g.first?.id && s[g.first.id]) s[g.first.id].first++;
    if (g.second?.id && s[g.second.id]) s[g.second.id].second++;
    if (g.durak?.id && s[g.durak.id]) s[g.durak.id].durak++;
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
  if (!players.length) {
    el.innerHTML = '<div class="empty"><div class="ico">👤</div>Noch keine Spieler</div>';
    return;
  }
  el.innerHTML = players.map(p => `
    <div class="player-chip">
      ${avatar(p.name)}
      <span class="name">${esc(p.name)}</span>
      <button class="btn-icon" onclick="removePlayer('${esc(p.name)}')" title="Entfernen">✕</button>
    </div>
  `).join('');
}

function renderSelects() {
  const opts = players.map(p =>
    `<option value="${p.id}">${esc(p.name)}</option>`
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
  const total = games.length;

  let topFirst = '–', topFirstN = -1;
  let mostDurak = '–', mostDurakN = -1;

  Object.values(s).forEach(p => {
    if (p.first > topFirstN)  { topFirstN = p.first;  topFirst  = p.name; }
    if (p.durak > mostDurakN) { mostDurakN = p.durak; mostDurak = p.name; }
  });

  el.innerHTML = `
    <div class="stat-box"><div class="val">${total}</div><div class="lbl">Runden</div></div>
    <div class="stat-box"><div class="val">${players.length}</div><div class="lbl">Spieler</div></div>
    <div class="stat-box"><div class="val" style="font-size:1rem;color:var(--gold)">${total ? esc(topFirst) : '–'}</div><div class="lbl">Meiste Siege</div></div>
    <div class="stat-box"><div class="val" style="font-size:1rem;color:var(--accent)">${total ? esc(mostDurak) : '–'}</div><div class="lbl">Meistens Durak</div></div>
  `;
}

function renderLeaderboard() {
  const el = document.getElementById('leaderboard');
  const s = computeStats();

  const rows = Object.values(s)
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
  if (!games.length) {
    el.innerHTML = '<div class="empty"><div class="ico">📜</div>Keine Runden aufgezeichnet</div>';
    return;
  }
  el.innerHTML = games.map(g => `
    <div class="hi">
      <div class="hi-date">${fmtDate(g.played_on)}</div>
      <div class="hi-body">
        <div class="hi-place">🥇 <strong>${esc(g.first?.name || '?')}</strong></div>
        <div class="hi-place">🥈 ${esc(g.second?.name || '?')}</div>
        <div class="hi-place" style="color:var(--accent)">🃏 ${esc(g.durak?.name || '?')}</div>
      </div>
      <button class="btn-icon" onclick="deleteGame('${g.id}')" title="Löschen">🗑</button>
    </div>
  `).join('');
}

// ---------------------------------------------------------------------------
// Expose to global scope for onclick handlers
// ---------------------------------------------------------------------------
Object.assign(window, {
  addPlayer, removePlayer, recordGame, deleteGame,
  confirmClear, closeDialog, clearAll,
  signInGoogle, signOutUser,
});

document.getElementById('nameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addPlayer();
});

document.getElementById('gameDate').value = today();

// Initial load (auth state change will also trigger loadData)
supabase.auth.getSession().then(({ data: { session } }) => {
  currentUser = session?.user ?? null;
  setAuthUI(currentUser);
  loadData();
});
