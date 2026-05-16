import { supabase } from './supabase.js'
import { requireAuth, signOut, initTheme, toggleTheme, themeIcon } from './auth.js'

// ── State ──────────────────────────────────────────────────────────────────
let session = null          // supabase auth session
let allPlayers = []         // all player records
let activeSession = null    // active game session
let sessionPlayers = []     // players in active session
let sessionGames = []       // games in active session
let playerStats = {}        // playerId → {games, wins, duraks}

let selectedNewSessionPlayers = new Set()
let selectedDurak = null
let selectedWinner = null
let pendingDeletePlayerId = null
let npSelectedColor = '#f59e0b'

const COLORS = ['#f59e0b','#ef4444','#22c55e','#3b82f6','#a855f7','#ec4899','#06b6d4','#f97316']

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
  initTheme()
  session = await requireAuth()
  if (!session) return

  updateUserInfo()
  wireNav()
  wireModals()
  wireTheme()
  wireSidebarButtons()

  await Promise.all([loadPlayers(), loadPlayerStats()])
  await loadActiveSession()

  showView('overview')
}

// ── Auth helpers ───────────────────────────────────────────────────────────
function updateUserInfo() {
  const email = session.user.email || ''
  const initials = email.slice(0, 2).toUpperCase()
  document.getElementById('user-avatar').textContent = initials
  document.getElementById('user-email').textContent = email
}

// ── Navigation ─────────────────────────────────────────────────────────────
function wireNav() {
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault()
      showView(el.dataset.view)
    })
  })
}

function showView(name) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === name))
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === `view-${name}`))

  if (name === 'overview')    renderOverview()
  if (name === 'session')     renderSession()
  if (name === 'players')     renderPlayers()
  if (name === 'leaderboard') renderLeaderboard()
}

// ── Theme ──────────────────────────────────────────────────────────────────
function wireTheme() {
  const btn = document.getElementById('theme-btn')
  btn.textContent = themeIcon()
  btn.addEventListener('click', () => {
    toggleTheme()
    btn.textContent = themeIcon()
  })
}

// ── Modal helpers ──────────────────────────────────────────────────────────
function wireModals() {
  document.querySelectorAll('[data-modal]').forEach(el => {
    el.addEventListener('click', () => closeModal(el.dataset.modal))
  })
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id)
    })
  })
}

function openModal(id) { document.getElementById(id).classList.add('open') }
function closeModal(id) { document.getElementById(id).classList.remove('open') }

// ── Sidebar buttons ────────────────────────────────────────────────────────
function wireSidebarButtons() {
  document.getElementById('logout-btn').addEventListener('click', signOut)

  const openNewSession = () => openNewSessionModal()
  document.getElementById('ov-new-session-btn').addEventListener('click', openNewSession)
  document.getElementById('sess-new-btn').addEventListener('click', openNewSession)
  document.getElementById('sess-empty-btn')?.addEventListener('click', openNewSession)

  document.getElementById('pl-new-btn').addEventListener('click', openNewPlayerModal)
}

// ── Data loading ───────────────────────────────────────────────────────────
async function loadPlayers() {
  const { data, error } = await supabase.from('players').select('*').order('name')
  if (error) return toast('Fehler beim Laden der Spieler', 'error')
  allPlayers = data || []
}

async function loadPlayerStats() {
  const { data, error } = await supabase.from('games').select('durak_id, winner_id')
  if (error) return

  playerStats = {}
  for (const p of allPlayers) {
    playerStats[p.id] = { games: 0, wins: 0, duraks: 0 }
  }
  for (const g of (data || [])) {
    if (g.durak_id && playerStats[g.durak_id]) {
      playerStats[g.durak_id].games++
      playerStats[g.durak_id].duraks++
    }
    if (g.winner_id && playerStats[g.winner_id]) {
      if (!g.durak_id || g.winner_id !== g.durak_id) {
        playerStats[g.winner_id].games++
        playerStats[g.winner_id].wins++
      }
    }
  }
}

async function loadActiveSession() {
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)

  activeSession = sessions?.[0] || null

  if (activeSession) {
    const { data: sp } = await supabase
      .from('session_players')
      .select('player_id')
      .eq('session_id', activeSession.id)

    const ids = (sp || []).map(r => r.player_id)
    sessionPlayers = allPlayers.filter(p => ids.includes(p.id))

    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('session_id', activeSession.id)
      .order('created_at')

    sessionGames = games || []
  } else {
    sessionPlayers = []
    sessionGames = []
  }
}

// ── Overview ───────────────────────────────────────────────────────────────
async function renderOverview() {
  renderOverviewBanner()
  renderOverviewStats()
  await renderRecentGames()
}

function renderOverviewBanner() {
  const el = document.getElementById('ov-session-banner')
  if (!activeSession) { el.innerHTML = ''; return }

  const name = activeSession.name || 'Session'
  el.innerHTML = `
    <div class="session-banner">
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="session-banner-dot"></div>
        <strong>${esc(name)}</strong>
        <span class="badge badge-gold">${sessionPlayers.length} Spieler · ${sessionGames.length} Spiele</span>
      </div>
      <a class="btn btn-primary btn-sm" onclick="window._showSession()">Zur Session →</a>
    </div>`

  window._showSession = () => showView('session')
}

function renderOverviewStats() {
  const el = document.getElementById('ov-stats')
  const totalGames = Object.values(playerStats).reduce((s, p) => s + p.wins, 0)
  const totalPlayers = allPlayers.length

  const topWinner = [...allPlayers].sort((a, b) => (playerStats[b.id]?.wins || 0) - (playerStats[a.id]?.wins || 0))[0]
  const topDurak = [...allPlayers].sort((a, b) => (playerStats[b.id]?.duraks || 0) - (playerStats[a.id]?.duraks || 0))[0]

  el.innerHTML = `
    <div class="glass stat-card">
      <div class="stat-label">Spieler</div>
      <div class="stat-value">${totalPlayers}</div>
      <div class="stat-sub">Registriert</div>
    </div>
    <div class="glass stat-card">
      <div class="stat-label">Gespielte Runden</div>
      <div class="stat-value">${totalGames}</div>
      <div class="stat-sub">Insgesamt</div>
    </div>
    <div class="glass stat-card">
      <div class="stat-label">Bester Sieger</div>
      <div class="stat-value text-accent" style="font-size:1.4rem;">${topWinner ? esc(topWinner.name) : '–'}</div>
      <div class="stat-sub">${topWinner ? `${playerStats[topWinner.id].wins} Siege` : ''}</div>
    </div>
    <div class="glass stat-card">
      <div class="stat-label">Meiste Duraks</div>
      <div class="stat-value" style="font-size:1.4rem;color:var(--danger);">${topDurak ? esc(topDurak.name) : '–'}</div>
      <div class="stat-sub">${topDurak ? `${playerStats[topDurak.id].duraks}× Durak` : ''}</div>
    </div>`
}

async function renderRecentGames() {
  const tbody = document.getElementById('ov-recent-body')

  const { data: games } = await supabase
    .from('games')
    .select('*, sessions(name, date)')
    .order('created_at', { ascending: false })
    .limit(15)

  if (!games?.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:32px;">Noch keine Spiele aufgezeichnet.</td></tr>'
    return
  }

  tbody.innerHTML = games.map(g => {
    const winner = g.winner_id ? allPlayers.find(p => p.id === g.winner_id) : null
    const durak = g.durak_id ? allPlayers.find(p => p.id === g.durak_id) : null
    const sessionName = g.sessions?.name || 'Session'
    const date = g.sessions?.date ? new Date(g.sessions.date).toLocaleDateString('de-DE') : '–'
    return `<tr>
      <td>${esc(sessionName)}</td>
      <td>${date}</td>
      <td>${winner ? playerChip(winner) : '<span class="text-dim">–</span>'}</td>
      <td>${durak ? playerChip(durak, 'danger') : '<span class="text-dim">–</span>'}</td>
    </tr>`
  }).join('')
}

// ── Session View ───────────────────────────────────────────────────────────
function renderSession() {
  const el = document.getElementById('sess-content')

  if (!activeSession) {
    el.innerHTML = `
      <div class="glass" style="padding:48px;text-align:center;color:var(--text-2);">
        <div style="font-size:3rem;margin-bottom:16px;">🃏</div>
        <h2>Keine aktive Session</h2>
        <p style="margin:8px 0 24px;">Starte eine neue Session und wähle die Spieler aus.</p>
        <button class="btn btn-primary" onclick="window._newSess()">+ Neue Session starten</button>
      </div>`
    window._newSess = openNewSessionModal
    return
  }

  const name = activeSession.name || 'Session'
  const date = new Date(activeSession.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  // Count session stats per player
  const sessStats = {}
  for (const p of sessionPlayers) sessStats[p.id] = { wins: 0, duraks: 0 }
  for (const g of sessionGames) {
    if (g.winner_id && sessStats[g.winner_id]) sessStats[g.winner_id].wins++
    if (g.durak_id && sessStats[g.durak_id])   sessStats[g.durak_id].duraks++
  }

  el.innerHTML = `
    <div class="glass" style="padding:24px;margin-bottom:20px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
            <div class="session-banner-dot"></div>
            <h2>${esc(name)}</h2>
          </div>
          <div class="text-muted" style="font-size:0.85rem;">${date} · ${sessionGames.length} Runden gespielt</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" id="record-game-btn">+ Runde eintragen</button>
          <button class="btn btn-danger btn-sm" id="end-session-btn">Session beenden</button>
        </div>
      </div>

      <div class="glass-strong" style="padding:0;overflow:hidden;">
        <table class="data-table">
          <thead>
            <tr><th>Spieler</th><th>Siege</th><th>Duraks</th><th>Punkte</th></tr>
          </thead>
          <tbody>
            ${sessionPlayers
              .sort((a, b) => (sessStats[b.id].wins - sessStats[b.id].duraks) - (sessStats[a.id].wins - sessStats[a.id].duraks))
              .map(p => {
                const s = sessStats[p.id]
                const pts = s.wins - s.duraks
                return `<tr>
                  <td>${playerChip(p)}</td>
                  <td><span class="badge badge-green">${s.wins}</span></td>
                  <td><span class="badge badge-red">${s.duraks}</span></td>
                  <td><strong style="color:${pts >= 0 ? 'var(--success)' : 'var(--danger)'};">${pts >= 0 ? '+' : ''}${pts}</strong></td>
                </tr>`
              }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ${sessionGames.length > 0 ? `
    <div class="glass" style="padding:20px;">
      <h3 style="margin-bottom:14px;">Rundenhistorie</h3>
      <div id="game-history-list">
        ${[...sessionGames].reverse().map((g, i) => {
          const n = sessionGames.length - i
          const winner = g.winner_id ? allPlayers.find(p => p.id === g.winner_id) : null
          const durak  = g.durak_id  ? allPlayers.find(p => p.id === g.durak_id)  : null
          return `<div class="game-history-item">
            <span class="game-num">#${n}</span>
            ${winner ? `<span class="badge badge-green">🏆 ${esc(winner.name)}</span>` : ''}
            ${durak  ? `<span class="badge badge-red">💀 ${esc(durak.name)}</span>`   : ''}
            <span class="text-dim" style="margin-left:auto;font-size:0.75rem;">${new Date(g.created_at).toLocaleTimeString('de-DE', {hour:'2-digit',minute:'2-digit'})}</span>
          </div>`
        }).join('')}
      </div>
    </div>` : ''}
  `

  document.getElementById('record-game-btn').addEventListener('click', openGameModal)
  document.getElementById('end-session-btn').addEventListener('click', endSession)
}

// ── Players View ───────────────────────────────────────────────────────────
function renderPlayers() {
  const tbody = document.getElementById('players-body')

  if (!allPlayers.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:32px;">Noch keine Spieler angelegt.</td></tr>'
    return
  }

  const sorted = [...allPlayers].sort((a, b) => {
    const pa = playerStats[a.id] || {}
    const pb = playerStats[b.id] || {}
    return ((pb.wins || 0) - (pb.duraks || 0)) - ((pa.wins || 0) - (pa.duraks || 0))
  })

  tbody.innerHTML = sorted.map(p => {
    const s = playerStats[p.id] || { games: 0, wins: 0, duraks: 0 }
    const pts = s.wins - s.duraks
    return `<tr>
      <td>${playerChip(p)}</td>
      <td>${s.games}</td>
      <td><span class="badge badge-green">${s.wins}</span></td>
      <td><span class="badge badge-red">${s.duraks}</span></td>
      <td><strong style="color:${pts >= 0 ? 'var(--success)' : 'var(--danger)'};">${pts >= 0 ? '+' : ''}${pts}</strong></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="window._deletePlayer('${p.id}')">🗑</button>
      </td>
    </tr>`
  }).join('')

  window._deletePlayer = (id) => {
    pendingDeletePlayerId = id
    openModal('modal-delete-player')
  }

  const confirmBtn = document.getElementById('dp-confirm-btn')
  confirmBtn.onclick = async () => {
    if (!pendingDeletePlayerId) return
    const { error } = await supabase.from('players').delete().eq('id', pendingDeletePlayerId)
    if (error) return toast('Fehler beim Löschen', 'error')
    closeModal('modal-delete-player')
    toast('Spieler gelöscht', 'success')
    await Promise.all([loadPlayers(), loadPlayerStats()])
    renderPlayers()
  }
}

// ── Leaderboard ────────────────────────────────────────────────────────────
function renderLeaderboard() {
  const sorted = [...allPlayers]
    .map(p => ({ ...p, ...playerStats[p.id] || { games: 0, wins: 0, duraks: 0 } }))
    .sort((a, b) => {
      const ptsA = a.wins - a.duraks
      const ptsB = b.wins - b.duraks
      if (ptsB !== ptsA) return ptsB - ptsA
      return b.wins - a.wins
    })

  const lbStats = document.getElementById('lb-stats')
  const totalGames = sorted.reduce((s, p) => s + p.wins, 0)
  const totalDuraks = sorted.reduce((s, p) => s + p.duraks, 0)
  const mvp = sorted[0]

  lbStats.innerHTML = `
    <div class="glass stat-card">
      <div class="stat-label">Gesamtrunden</div>
      <div class="stat-value">${totalGames}</div>
    </div>
    <div class="glass stat-card">
      <div class="stat-label">Total Duraks</div>
      <div class="stat-value" style="color:var(--danger);">${totalDuraks}</div>
    </div>
    <div class="glass stat-card">
      <div class="stat-label">MVP</div>
      <div class="stat-value text-accent" style="font-size:1.4rem;">${mvp ? esc(mvp.name) : '–'}</div>
      <div class="stat-sub">${mvp ? `${mvp.wins - mvp.duraks} Punkte` : ''}</div>
    </div>`

  const tbody = document.getElementById('lb-body')
  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:32px;">Noch keine Daten.</td></tr>'
    return
  }

  tbody.innerHTML = sorted.map((p, i) => {
    const rank = i + 1
    const winRate = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0
    const pts = p.wins - p.duraks
    const rankClass = rank <= 3 ? `rank-${rank}` : ''
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank
    return `<tr>
      <td class="${rankClass}" style="font-size:1rem;">${medal}</td>
      <td>${playerChip(p)}</td>
      <td>${p.games}</td>
      <td><span class="badge badge-green">${p.wins}</span></td>
      <td><span class="badge badge-red">${p.duraks}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="progress-bar" style="width:60px;">
            <div class="progress-fill" style="width:${winRate}%;"></div>
          </div>
          <span style="font-size:0.8rem;color:var(--text-2);">${winRate}%</span>
        </div>
      </td>
      <td><strong style="color:${pts >= 0 ? 'var(--success)' : 'var(--danger)'};">${pts >= 0 ? '+' : ''}${pts}</strong></td>
    </tr>`
  }).join('')
}

// ── New Session Modal ──────────────────────────────────────────────────────
function openNewSessionModal() {
  selectedNewSessionPlayers.clear()
  document.getElementById('ns-name').value = ''

  const grid = document.getElementById('ns-player-grid')
  if (!allPlayers.length) {
    grid.innerHTML = '<div style="color:var(--text-3);font-size:0.85rem;padding:8px;">Keine Spieler angelegt. Erstelle zuerst Spieler.</div>'
  } else {
    grid.innerHTML = allPlayers.map(p => `
      <button class="player-select-btn" data-pid="${p.id}">
        <div class="player-avatar" style="background:${p.color};">${initials(p.name)}</div>
        ${esc(p.name)}
      </button>`).join('')

    grid.querySelectorAll('.player-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.pid
        if (selectedNewSessionPlayers.has(id)) {
          selectedNewSessionPlayers.delete(id)
          btn.classList.remove('selected')
        } else {
          selectedNewSessionPlayers.add(id)
          btn.classList.add('selected')
        }
      })
    })
  }

  document.getElementById('ns-confirm-btn').onclick = createSession
  openModal('modal-new-session')
}

async function createSession() {
  if (selectedNewSessionPlayers.size < 2) {
    toast('Bitte mind. 2 Spieler auswählen', 'error')
    return
  }

  if (activeSession) {
    const { error } = await supabase.from('sessions').update({ is_active: false }).eq('id', activeSession.id)
    if (error) return toast('Fehler', 'error')
  }

  const name = document.getElementById('ns-name').value.trim() || null

  const { data: sess, error } = await supabase
    .from('sessions')
    .insert({ name, created_by: session.user.id })
    .select()
    .single()

  if (error) return toast('Session konnte nicht erstellt werden', 'error')

  const rows = [...selectedNewSessionPlayers].map(pid => ({ session_id: sess.id, player_id: pid }))
  await supabase.from('session_players').insert(rows)

  closeModal('modal-new-session')
  toast('Session gestartet!', 'success')
  await loadActiveSession()
  showView('session')
}

// ── End Session ────────────────────────────────────────────────────────────
async function endSession() {
  if (!activeSession) return
  const ok = confirm('Session wirklich beenden?')
  if (!ok) return

  await supabase.from('sessions').update({ is_active: false }).eq('id', activeSession.id)
  activeSession = null
  sessionPlayers = []
  sessionGames = []
  toast('Session beendet', 'info')
  renderSession()
  renderOverview()
}

// ── Game Modal ─────────────────────────────────────────────────────────────
function openGameModal() {
  selectedDurak = null
  selectedWinner = null

  const makeGrid = (id, type) => {
    const el = document.getElementById(id)
    el.innerHTML = sessionPlayers.map(p => `
      <button class="result-player-btn" data-pid="${p.id}" data-type="${type}">
        <div class="player-avatar" style="background:${p.color};width:32px;height:32px;font-size:0.8rem;">${initials(p.name)}</div>
        ${esc(p.name)}
      </button>`).join('')

    el.querySelectorAll('.result-player-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.result-player-btn').forEach(b => {
          b.classList.remove('selected-durak', 'selected-winner')
        })
        if (type === 'durak') {
          selectedDurak = btn.dataset.pid === selectedDurak ? null : btn.dataset.pid
          if (selectedDurak) btn.classList.add('selected-durak')
        } else {
          selectedWinner = btn.dataset.pid === selectedWinner ? null : btn.dataset.pid
          if (selectedWinner) btn.classList.add('selected-winner')
        }
      })
    })
  }

  makeGrid('game-durak-grid', 'durak')
  makeGrid('game-winner-grid', 'winner')

  document.getElementById('game-confirm-btn').onclick = recordGame
  openModal('modal-game')
}

async function recordGame() {
  if (!selectedDurak) {
    toast('Bitte Durak auswählen', 'error')
    return
  }

  const payload = {
    session_id: activeSession.id,
    durak_id: selectedDurak,
    winner_id: selectedWinner || null,
  }

  const { data, error } = await supabase.from('games').insert(payload).select().single()
  if (error) return toast('Fehler beim Eintragen', 'error')

  sessionGames.push(data)

  // Update local stats
  if (!playerStats[selectedDurak]) playerStats[selectedDurak] = { games: 0, wins: 0, duraks: 0 }
  playerStats[selectedDurak].games++
  playerStats[selectedDurak].duraks++

  if (selectedWinner) {
    if (!playerStats[selectedWinner]) playerStats[selectedWinner] = { games: 0, wins: 0, duraks: 0 }
    playerStats[selectedWinner].games++
    playerStats[selectedWinner].wins++
  }

  closeModal('modal-game')
  toast('Runde eingetragen!', 'success')
  renderSession()
}

// ── New Player Modal ───────────────────────────────────────────────────────
function openNewPlayerModal() {
  document.getElementById('np-name').value = ''
  npSelectedColor = COLORS[0]

  const colorsEl = document.getElementById('np-colors')
  colorsEl.innerHTML = COLORS.map(c => `
    <div class="color-opt${c === npSelectedColor ? ' selected' : ''}"
         style="background:${c};" data-color="${c}"></div>`).join('')

  colorsEl.querySelectorAll('.color-opt').forEach(el => {
    el.addEventListener('click', () => {
      colorsEl.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'))
      el.classList.add('selected')
      npSelectedColor = el.dataset.color
    })
  })

  document.getElementById('np-confirm-btn').onclick = createPlayer
  openModal('modal-new-player')
}

async function createPlayer() {
  const name = document.getElementById('np-name').value.trim()
  if (!name) return toast('Bitte einen Namen eingeben', 'error')

  const { data, error } = await supabase
    .from('players')
    .insert({ name, color: npSelectedColor, created_by: session.user.id })
    .select()
    .single()

  if (error) {
    toast(error.code === '23505' ? 'Name bereits vergeben' : 'Fehler beim Anlegen', 'error')
    return
  }

  allPlayers.push(data)
  allPlayers.sort((a, b) => a.name.localeCompare(b.name))
  playerStats[data.id] = { games: 0, wins: 0, duraks: 0 }

  closeModal('modal-new-player')
  toast(`${name} angelegt!`, 'success')
  renderPlayers()
}

// ── Helpers ────────────────────────────────────────────────────────────────
function playerChip(p, variant) {
  const cls = variant === 'danger' ? 'badge-red' : ''
  return `<span class="player-chip">
    <span class="player-avatar" style="background:${p.color};">${initials(p.name)}</span>
    ${esc(p.name)}
  </span>`
}

function initials(name) {
  return name.slice(0, 2).toUpperCase()
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function toast(msg, type = 'info') {
  const el = document.getElementById('toast')
  const item = document.createElement('div')
  item.className = `toast-item toast-${type}`
  item.textContent = msg
  el.appendChild(item)
  setTimeout(() => item.remove(), 3200)
}

// ── Start ──────────────────────────────────────────────────────────────────
boot()
