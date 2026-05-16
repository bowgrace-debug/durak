import { supabase } from './supabase.js'

const BASE = import.meta.env.BASE_URL || '/durak/'

export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.location.href = BASE + 'login.html'
    return null
  }
  return session
}

export async function redirectIfLoggedIn() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) window.location.href = BASE + 'app.html'
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = BASE + 'login.html'
}

export function getTheme() {
  return localStorage.getItem('zwunit-theme') || 'dark'
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('zwunit-theme', theme)
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}

export function initTheme() {
  applyTheme(getTheme())
}

export function themeIcon() {
  return getTheme() === 'dark' ? '☀️' : '🌙'
}
