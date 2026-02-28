'use strict';

let csrfToken = '';

// --- DB status ---
fetch('/api/db-status')
  .then(r => r.json())
  .then(data => {
    const el = document.getElementById('db-status');
    if (data.status === 'ok') {
      el.className = 'status-bar ok';
      el.textContent = '✔ ' + data.message;
    } else {
      el.className = 'status-bar error';
      el.textContent = '✘ Datenbankfehler: ' + data.message + (data.detail ? ' (' + data.detail + ')' : '');
    }
  })
  .catch(err => {
    const el = document.getElementById('db-status');
    el.className = 'status-bar error';
    el.textContent = '✘ Verbindung fehlgeschlagen: ' + err.message;
  });

// --- Auth status ---
function checkAuthStatus() {
  fetch('/api/auth/status')
    .then(r => r.json())
    .then(data => {
      const banner = document.getElementById('auth-banner-text');
      const logoutBtn = document.getElementById('logout-btn');
      const forms = document.getElementById('auth-forms');
      if (data.loggedIn) {
        banner.textContent = '✔ Angemeldet als: ' + data.username;
        logoutBtn.style.display = '';
        forms.style.display = 'none';
      } else {
        banner.textContent = 'Nicht angemeldet.';
        logoutBtn.style.display = 'none';
        forms.style.display = '';
      }
    })
    .catch(() => {
      document.getElementById('auth-banner-text').textContent = 'Anmeldestatus unbekannt.';
    });
}

// --- CAPTCHA (also provides csrfToken) ---
function loadCaptcha() {
  fetch('/api/auth/captcha')
    .then(r => r.json())
    .then(data => {
      document.getElementById('captcha-question').textContent = data.question;
      document.getElementById('captcha-answer').value = '';
      if (data.csrfToken) csrfToken = data.csrfToken;
    })
    .catch(() => {
      document.getElementById('captcha-question').textContent = 'Fehler beim Laden.';
    });
}

// --- Load CSRF token (used for login without captcha) ---
function loadCsrfToken() {
  return fetch('/api/auth/csrf-token')
    .then(r => r.json())
    .then(data => { csrfToken = data.csrfToken || ''; });
}

// --- Tabs ---
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  if (tab === 'register') loadCaptcha();
}

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'msg ' + type;
}

// --- Login ---
function doLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value;
  const password = document.getElementById('login-pw').value;
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ username, password }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.status === 'ok') {
        if (data.csrfToken) csrfToken = data.csrfToken;
        showMsg('login-msg', '✔ ' + data.message, 'ok');
        checkAuthStatus();
      } else {
        showMsg('login-msg', '✘ ' + data.message, 'error');
      }
    })
    .catch(() => showMsg('login-msg', '✘ Verbindungsfehler.', 'error'));
}

// --- Register ---
function doRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-user').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-pw').value;
  const captcha = document.getElementById('captcha-answer').value;
  fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ username, email, password, captcha }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.status === 'ok') {
        showMsg('register-msg', '✔ ' + data.message + ' Sie können sich jetzt anmelden.', 'ok');
        loadCaptcha();
      } else {
        showMsg('register-msg', '✘ ' + data.message, 'error');
        loadCaptcha();
      }
    })
    .catch(() => { showMsg('register-msg', '✘ Verbindungsfehler.', 'error'); loadCaptcha(); });
}

// --- Logout ---
function logout() {
  fetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
  })
    .then(r => r.json())
    .then(() => { loadCsrfToken(); checkAuthStatus(); })
    .catch(() => checkAuthStatus());
}

// --- Wire up event listeners ---
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('login-form').addEventListener('submit', doLogin);
  document.getElementById('register-form').addEventListener('submit', doRegister);
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('captcha-reload').addEventListener('click', loadCaptcha);

  checkAuthStatus();
  loadCsrfToken().catch(err => console.error('CSRF token load failed:', err));
});
