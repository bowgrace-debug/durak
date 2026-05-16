import { supabase } from './supabase.js';

const isLoginPage   = !!document.getElementById('loginForm');
const isSignupPage  = !!document.getElementById('signupForm');
const isForgotPage  = !!document.getElementById('forgotForm');
const isResetPage   = !!document.getElementById('resetForm');

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function showError(msg) {
  const el = document.getElementById('errorMsg');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
}

function hideError() {
  const el = document.getElementById('errorMsg');
  if (el) el.classList.remove('visible');
}

function showSuccess(msg) {
  const el = document.getElementById('successMsg');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
}

function hideSuccess() {
  const el = document.getElementById('successMsg');
  if (el) el.classList.remove('visible');
}

function setLoading(loading, labels) {
  const btn = document.getElementById('submitBtn');
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? labels.loading : labels.idle;
}

// ---------------------------------------------------------------------------
// Auto-redirect logged-in users away from auth pages
// (skip on reset page — user lands there with a recovery session)
// ---------------------------------------------------------------------------
if (!isResetPage) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) window.location.href = '/';
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) window.location.href = '/';
  });
}

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------
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

    setLoading(true, { loading: 'Wird angemeldet…', idle: 'Anmelden' });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false, { loading: 'Wird angemeldet…', idle: 'Anmelden' });

    if (error) {
      showError(error.message === 'Invalid login credentials'
        ? 'E-Mail oder Passwort falsch.'
        : error.message);
    }
  });
}

// ---------------------------------------------------------------------------
// SIGNUP
// ---------------------------------------------------------------------------
if (isSignupPage) {
  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    hideSuccess();
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

    setLoading(true, { loading: 'Wird erstellt…', idle: 'Konto erstellen' });
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false, { loading: 'Wird erstellt…', idle: 'Konto erstellen' });

    if (error) {
      showError(error.message);
      return;
    }

    showSuccess('Bestätigungs-E-Mail gesendet! Bitte prüfe dein Postfach.');
    document.getElementById('signupForm').reset();
  });
}

// ---------------------------------------------------------------------------
// FORGOT PASSWORD — send reset email
// ---------------------------------------------------------------------------
if (isForgotPage) {
  document.getElementById('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    hideSuccess();
    const email = document.getElementById('email').value.trim();

    if (!email) {
      showError('Bitte E-Mail eingeben.');
      return;
    }

    setLoading(true, { loading: 'Wird gesendet…', idle: 'Reset-Link senden' });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password.html',
    });
    setLoading(false, { loading: 'Wird gesendet…', idle: 'Reset-Link senden' });

    if (error) {
      showError(error.message);
      return;
    }

    showSuccess('Wenn ein Konto existiert, ist eine E-Mail unterwegs. Bitte prüfe dein Postfach.');
    document.getElementById('forgotForm').reset();
  });
}

// ---------------------------------------------------------------------------
// RESET PASSWORD — user landed here from the email link.
// Supabase auto-creates a recovery session from the URL fragment.
// ---------------------------------------------------------------------------
if (isResetPage) {
  let hasRecoverySession = false;

  // Listen for the PASSWORD_RECOVERY event that fires when the link is processed.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
      hasRecoverySession = true;
    }
  });

  // Also check immediately — if user reloads the page after recovery, session is already there.
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) hasRecoverySession = true;
  });

  document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    hideSuccess();

    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (password.length < 6) {
      showError('Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (password !== confirm) {
      showError('Passwörter stimmen nicht überein.');
      return;
    }
    if (!hasRecoverySession) {
      showError('Reset-Link ungültig oder abgelaufen. Bitte fordere einen neuen an.');
      return;
    }

    setLoading(true, { loading: 'Wird gespeichert…', idle: 'Passwort speichern' });
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false, { loading: 'Wird gespeichert…', idle: 'Passwort speichern' });

    if (error) {
      showError(error.message);
      return;
    }

    showSuccess('Passwort aktualisiert! Du wirst weitergeleitet…');
    setTimeout(() => { window.location.href = '/'; }, 1500);
  });
}
