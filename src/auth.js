import { supabase } from './supabase.js';

const isLoginPage = !!document.getElementById('loginForm');
const isSignupPage = !!document.getElementById('signupForm');

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.classList.add('visible');
}

function hideError() {
  document.getElementById('errorMsg').classList.remove('visible');
}

function showSuccess(msg) {
  const el = document.getElementById('successMsg');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
}

function setLoading(loading) {
  const btn = document.getElementById('submitBtn');
  btn.disabled = loading;
  btn.textContent = loading
    ? (isLoginPage ? 'Wird angemeldet…' : 'Wird erstellt…')
    : (isLoginPage ? 'Anmelden' : 'Konto erstellen');
}

supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    window.location.href = '/';
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    window.location.href = '/';
  }
});

if (isLoginPage) {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showError('Bitte E-Mail und Passwort eingeben.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      showError(error.message === 'Invalid login credentials'
        ? 'E-Mail oder Passwort falsch.'
        : error.message);
    }
  });
}

if (isSignupPage) {
  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (!email || !password) {
      showError('Bitte alle Felder ausfüllen.');
      return;
    }
    if (password !== confirm) {
      showError('Passwörter stimmen nicht überein.');
      return;
    }
    if (password.length < 6) {
      showError('Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);

    if (error) {
      showError(error.message);
      return;
    }

    showSuccess('Bestätigungs-E-Mail gesendet! Bitte prüfe dein Postfach.');
    document.getElementById('signupForm').reset();
  });
}

document.getElementById('googleBtn').addEventListener('click', async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) showError('Google-Anmeldung fehlgeschlagen: ' + error.message);
});
