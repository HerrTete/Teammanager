'use strict';

let csrfToken = '';
let currentClubId = null;
let currentSportId = null;
let currentTeamId = null;
let currentEventType = null;
let currentEventId = null;
let clubs = [];
let venuesCache = [];
let notifInterval = null;
let appInitialized = false;

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
        document.getElementById('app-main').style.display = '';
        document.querySelector('.container').classList.add('app-mode');
        initApp();
      } else {
        banner.textContent = 'Nicht angemeldet.';
        logoutBtn.style.display = 'none';
        forms.style.display = '';
        document.getElementById('app-main').style.display = 'none';
        document.querySelector('.container').classList.remove('app-mode');
        stopNotifPolling();
        if (data.pendingVerification) {
          // Activate the register tab without triggering the captcha/reset side-effects of switchTab
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'register'));
          document.getElementById('tab-login').classList.remove('active');
          document.getElementById('tab-register').classList.add('active');
          document.getElementById('register-form').style.display = 'none';
          document.getElementById('verify-msg').className = 'msg hidden';
          showMsg('register-msg', 'Bitte geben Sie den Verifizierungscode aus Ihrer E-Mail ein.', 'ok');
          // Only reveal the verify form after the CSRF token is loaded to prevent 403 on fast submit
          loadCsrfToken().finally(() => {
            document.getElementById('verify-section').style.display = '';
          });
        }
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
  if (tab === 'register') {
    // Reset verification state when switching to register tab
    document.getElementById('register-form').style.display = '';
    document.getElementById('verify-section').style.display = 'none';
    document.getElementById('verify-msg').className = 'msg hidden';
    loadCaptcha();
  }
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
      if (data.status === 'pending') {
        showMsg('register-msg', '✔ ' + data.message, 'ok');
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('verify-section').style.display = '';
        document.getElementById('verify-code').value = '';
        document.getElementById('verify-code').focus();
      } else {
        showMsg('register-msg', '✘ ' + data.message, 'error');
        loadCaptcha();
      }
    })
    .catch(() => { showMsg('register-msg', '✘ Verbindungsfehler.', 'error'); loadCaptcha(); });
}

// --- Verify Email ---
function doVerifyEmail(e) {
  e.preventDefault();
  const code = document.getElementById('verify-code').value.trim();
  fetch('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ code }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.status === 'ok') {
        showMsg('verify-msg', '✔ ' + data.message + ' Sie können sich jetzt anmelden.', 'ok');
        document.getElementById('verify-form').style.display = 'none';
      } else {
        showMsg('verify-msg', '✘ ' + data.message, 'error');
        if (data.errorCode === 'CODE_EXPIRED') {
          // Code expired – go back to registration form
          document.getElementById('verify-section').style.display = 'none';
          document.getElementById('register-form').style.display = '';
          loadCaptcha();
        }
      }
    })
    .catch(() => showMsg('verify-msg', '✘ Verbindungsfehler.', 'error'));
}

// --- Logout ---
function logout() {
  fetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
  })
    .then(r => r.json())
    .then(() => { resetAppState(); loadCsrfToken(); checkAuthStatus(); })
    .catch(() => { resetAppState(); checkAuthStatus(); });
}

// --- SPA Helpers ---
function api(url, opts) {
  opts = opts || {};
  opts.headers = opts.headers || {};
  opts.headers['X-CSRF-Token'] = csrfToken;
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  return fetch(url, opts).then(function(r) {
    if (!r.ok) {
      return r.text().then(function(t) {
        try { return Promise.reject(JSON.parse(t)); } catch(e) { return Promise.reject({message: t}); }
      });
    }
    var ct = r.headers.get('content-type');
    if (ct && ct.includes('json')) return r.json();
    return r;
  });
}

function resetAppState() {
  currentClubId = null; currentSportId = null; currentTeamId = null;
  currentEventType = null; currentEventId = null;
  clubs = []; venuesCache = []; appInitialized = false;
  stopNotifPolling();
}

function stopNotifPolling() {
  if (notifInterval) { clearInterval(notifInterval); notifInterval = null; }
}

function initApp() {
  if (appInitialized) return;
  appInitialized = true;
  loadClubs();
  startNotifPolling();
}

function navigateTo(view) {
  document.querySelectorAll('.app-view').forEach(function(v) { v.classList.remove('active'); });
  var el = document.getElementById('view-' + view);
  if (el) el.classList.add('active');
  document.querySelectorAll('#app-nav .nav-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.view === view);
  });
  if (view === 'messages') {
    document.getElementById('messages-list').style.display = '';
    document.getElementById('message-thread').style.display = 'none';
  }
  switch (view) {
    case 'dashboard': loadDashboard(); break;
    case 'club': loadClubData(); break;
    case 'messages': loadMessages(); break;
    case 'notifications': loadNotifications(); break;
  }
}

function showModal(title, bodyHtml) {
  document.getElementById('modal-content').innerHTML =
    '<div class="section-header"><h3>' + escHtml(title) + '</h3>' +
    '<button class="btn btn-sm btn-secondary" id="modal-close-btn">✕</button></div>' + bodyHtml;
  document.getElementById('modal-overlay').style.display = '';
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function fmtDate(s) {
  if (!s) return '–';
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtTime(s) {
  if (!s) return '';
  return new Date(s).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(s) { return fmtDate(s) + ' ' + fmtTime(s); }

function getId(obj) { return obj.id || obj._id; }

// --- Clubs ---
function loadClubs() {
  api('/api/clubs').then(function(data) {
    clubs = data.clubs || data || [];
    buildClubTabs();
    if (clubs.length > 0 && !currentClubId) {
      selectClub(getId(clubs[0]));
    } else if (currentClubId) {
      selectClub(currentClubId);
    } else {
      document.getElementById('club-tabs').innerHTML =
        '<span style="color:#888;padding:0.5rem">Kein Verein gefunden.</span>';
    }
  }).catch(function() {
    document.getElementById('club-tabs').innerHTML =
      '<span style="color:#c00;padding:0.5rem">Fehler beim Laden der Vereine</span>';
  });
}

function buildClubTabs() {
  var container = document.getElementById('club-tabs');
  container.innerHTML = '';
  clubs.forEach(function(c) {
    var btn = document.createElement('button');
    btn.textContent = c.name;
    btn.dataset.clubId = getId(c);
    if (getId(c) === currentClubId) btn.classList.add('active');
    btn.addEventListener('click', function() { selectClub(getId(c)); });
    container.appendChild(btn);
  });
}

function selectClub(clubId) {
  currentClubId = clubId;
  currentTeamId = null;
  currentSportId = null;
  document.querySelectorAll('#club-tabs button').forEach(function(b) {
    b.classList.toggle('active', b.dataset.clubId == clubId);
  });
  var club = clubs.find(function(c) { return getId(c) == clubId; });
  document.getElementById('nav-club-name').textContent = club ? club.name : '';
  navigateTo('dashboard');
}

// --- Dashboard ---
function loadDashboard() {
  if (!currentClubId) return;
  var evList = document.getElementById('dashboard-events');
  var notifList = document.getElementById('dashboard-notifs');
  var teamList = document.getElementById('dashboard-teams');
  evList.innerHTML = notifList.innerHTML = teamList.innerHTML = '<li>Laden…</li>';

  api('/api/dashboard').then(function(data) {
    var events = data.events || [];
    if (events.length === 0) {
      evList.innerHTML = '<li>Keine kommenden Termine</li>';
    } else {
      evList.innerHTML = '';
      events.forEach(function(ev) {
        var li = document.createElement('li');
        li.innerHTML = '<span>' + fmtDateTime(ev.date || ev.startDate) +
          ' – <strong>' + escHtml(ev.title || ev.opponent || ev.type || 'Termin') + '</strong></span>';
        li.style.cursor = 'pointer';
        li.addEventListener('click', function() {
          var eType = ev.eventType || (ev.opponent ? 'games' : 'trainings');
          currentTeamId = ev.teamId || currentTeamId;
          currentSportId = ev.sportId || currentSportId;
          loadEvent(eType, getId(ev));
        });
        evList.appendChild(li);
      });
    }

    var notifs = data.notifications || [];
    if (notifs.length === 0) {
      notifList.innerHTML = '<li>Keine neuen Benachrichtigungen</li>';
    } else {
      notifList.innerHTML = '';
      notifs.slice(0, 5).forEach(function(n) {
        var li = document.createElement('li');
        li.textContent = n.message || n.text || n.title;
        if (!n.read) li.style.fontWeight = 'bold';
        notifList.appendChild(li);
      });
    }

    var teams = data.teams || [];
    if (teams.length === 0) {
      teamList.innerHTML = '<li>Keine Teams</li>';
    } else {
      teamList.innerHTML = '';
      teams.forEach(function(t) {
        var li = document.createElement('li');
        li.innerHTML = '<span>' + escHtml(t.name) + '</span>' +
          '<button class="btn btn-sm btn-secondary">Anzeigen</button>';
        li.querySelector('button').addEventListener('click', function() {
          loadTeam(t.sportId || t.sport_id, getId(t));
        });
        teamList.appendChild(li);
      });
    }
  }).catch(function() {
    evList.innerHTML = '<li>Fehler beim Laden</li>';
    notifList.innerHTML = teamList.innerHTML = '<li>–</li>';
  });

  loadTeamFilterOptions();
}

function loadTeamFilterOptions() {
  if (!currentClubId) return;
  api('/api/clubs/' + currentClubId + '/sports').then(function(data) {
    var sports = data.sports || data || [];
    var sel = document.getElementById('dashboard-team-filter');
    sel.innerHTML = '<option value="">Alle Teams</option>';

    var teamPromises = [];

    sports.forEach(function(sp) {
      // If teams are already embedded on the sport, use them directly.
      if (sp.teams && sp.teams.length) {
        sp.teams.forEach(function(t) {
          var opt = document.createElement('option');
          opt.value = getId(t);
          opt.textContent = sp.name + ' – ' + t.name;
          sel.appendChild(opt);
        });
        return;
      }

      // Fallback: fetch teams for this sport via dedicated endpoint.
      var sportId = getId(sp);
      if (!sportId) {
        return;
      }

      var p = api('/api/clubs/' + currentClubId + '/sports/' + sportId + '/teams')
        .then(function(teamData) {
          var teams = teamData.teams || teamData || [];
          teams.forEach(function(t) {
            var opt = document.createElement('option');
            opt.value = getId(t);
            opt.textContent = sp.name + ' – ' + t.name;
            sel.appendChild(opt);
          });
        })
        .catch(function() {
          // Ignore errors for individual sports to avoid breaking the whole filter.
        });

      teamPromises.push(p);
    });

    return Promise.all(teamPromises);
  }).catch(function() {});
}

// --- Club Management ---
function loadClubData() {
  if (!currentClubId) return;
  api('/api/clubs/' + currentClubId).then(function(data) {
    var club = data.club || data;
    document.getElementById('club-name').textContent = club.name || 'Verein';
    var isAdmin = club.role === 'VereinsAdmin' || club.isAdmin;
    var isTrainer = club.role === 'Trainer';
    document.getElementById('btn-edit-club').style.display = isAdmin ? '' : 'none';
    document.getElementById('club-logo-upload').style.display = isAdmin ? '' : 'none';
    document.getElementById('btn-add-sport').style.display = isAdmin ? '' : 'none';
    document.getElementById('btn-add-venue').style.display = (isAdmin || isTrainer) ? '' : 'none';
    document.getElementById('invitations-section').style.display = isAdmin ? '' : 'none';
    var logoEl = document.getElementById('club-logo');
    logoEl.src = '/api/clubs/' + currentClubId + '/logo?t=' + Date.now();
    logoEl.style.display = '';
    logoEl.onerror = function() { logoEl.style.display = 'none'; };
  }).catch(function() {});
  loadSports();
  loadVenues();
}

function loadSports() {
  if (!currentClubId) return;
  api('/api/clubs/' + currentClubId + '/sports').then(function(data) {
    var sports = data.sports || data || [];
    var container = document.getElementById('sports-list');
    if (sports.length === 0) {
      container.innerHTML = '<p style="color:#888">Keine Sportarten vorhanden</p>';
      return;
    }
    container.innerHTML = '';
    sports.forEach(function(sp) {
      var div = document.createElement('div');
      div.style.marginBottom = '0.75rem';
      var teams = sp.teams || [];
      var teamHtml = '<ul class="item-list">';
      if (teams.length === 0) {
        teamHtml += '<li style="color:#888">Keine Teams</li>';
      } else {
        teams.forEach(function(t) {
          teamHtml += '<li><span>' + escHtml(t.name) + '</span>' +
            '<button class="btn btn-sm btn-secondary" data-sport="' + getId(sp) + '" data-team="' + getId(t) + '">Öffnen</button></li>';
        });
      }
      teamHtml += '</ul>';
      div.innerHTML = '<div class="section-header" style="margin-bottom:0.25rem">' +
        '<strong>' + escHtml(sp.name) + '</strong>' +
        '<button class="btn btn-sm btn-primary" data-add-team="' + getId(sp) + '">+ Team</button></div>' + teamHtml;
      div.querySelectorAll('[data-team]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          loadTeam(btn.dataset.sport, btn.dataset.team);
        });
      });
      div.querySelector('[data-add-team]').addEventListener('click', function() {
        showAddTeamModal(getId(sp));
      });
      container.appendChild(div);
    });
  }).catch(function() {
    document.getElementById('sports-list').innerHTML = '<p style="color:#c00">Fehler beim Laden</p>';
  });
}

function loadVenues() {
  if (!currentClubId) return;
  api('/api/clubs/' + currentClubId + '/venues').then(function(data) {
    var venues = data.venues || data || [];
    venuesCache = venues;
    var list = document.getElementById('venues-list');
    if (venues.length === 0) {
      list.innerHTML = '<li style="color:#888">Keine Spielstätten</li>';
      return;
    }
    list.innerHTML = '';
    venues.forEach(function(v) {
      var li = document.createElement('li');
      li.innerHTML = '<span>' + escHtml(v.name) + (v.address ? ' – ' + escHtml(v.address) : '') + '</span><div></div>';
      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-secondary';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', function() { showEditVenueModal(getId(v)); });
      var delBtn = document.createElement('button');
      delBtn.className = 'btn btn-sm btn-danger';
      delBtn.textContent = '✕';
      delBtn.style.marginLeft = '0.25rem';
      delBtn.addEventListener('click', function() { deleteVenue(getId(v)); });
      li.querySelector('div').appendChild(editBtn);
      li.querySelector('div').appendChild(delBtn);
      list.appendChild(li);
    });
  }).catch(function() {
    document.getElementById('venues-list').innerHTML = '<li style="color:#c00">Fehler</li>';
  });
}

function uploadLogo() {
  var file = document.getElementById('club-logo-file').files[0];
  if (!file) return;
  var fd = new FormData();
  fd.append('logo', file);
  api('/api/clubs/' + currentClubId + '/logo', { method: 'POST', body: fd }).then(function() {
    var el = document.getElementById('club-logo');
    el.src = '/api/clubs/' + currentClubId + '/logo?t=' + Date.now();
    el.style.display = '';
  }).catch(function(e) { alert('Fehler: ' + (e.message || 'Upload fehlgeschlagen')); });
}

function showEditClubModal() {
  var club = clubs.find(function(c) { return getId(c) == currentClubId; });
  showModal('Verein bearbeiten',
    '<div class="app-form"><div class="form-group"><label>Name</label>' +
    '<input type="text" id="modal-club-name" value="' + escHtml(club ? club.name : '') + '"/></div>' +
    '<button class="btn btn-primary" id="modal-club-submit">Speichern</button></div>');
  document.getElementById('modal-club-submit').addEventListener('click', function() {
    var name = document.getElementById('modal-club-name').value.trim();
    if (!name) return;
    api('/api/clubs/' + currentClubId, { method: 'PUT', body: { name: name } }).then(function() {
      closeModal(); loadClubs();
    }).catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
  });
}

function showAddSportModal() {
  showModal('Sportart hinzufügen',
    '<div class="app-form"><div class="form-group"><label>Name</label>' +
    '<input type="text" id="modal-sport-name"/></div>' +
    '<button class="btn btn-primary" id="modal-sport-submit">Erstellen</button></div>');
  document.getElementById('modal-sport-submit').addEventListener('click', function() {
    var name = document.getElementById('modal-sport-name').value.trim();
    if (!name) return;
    api('/api/clubs/' + currentClubId + '/sports', { method: 'POST', body: { name: name } }).then(function() {
      closeModal(); loadSports();
    }).catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
  });
}

function showAddTeamModal(sportId) {
  showModal('Team hinzufügen',
    '<div class="app-form"><div class="form-group"><label>Name</label>' +
    '<input type="text" id="modal-team-name"/></div>' +
    '<button class="btn btn-primary" id="modal-team-submit">Erstellen</button></div>');
  document.getElementById('modal-team-submit').addEventListener('click', function() {
    var name = document.getElementById('modal-team-name').value.trim();
    if (!name) return;
    api('/api/clubs/' + currentClubId + '/sports/' + sportId + '/teams', { method: 'POST', body: { name: name } }).then(function() {
      closeModal(); loadSports();
    }).catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
  });
}

function showAddVenueModal() {
  showModal('Spielstätte hinzufügen',
    '<div class="app-form"><div class="form-group"><label>Name</label><input type="text" id="modal-venue-name"/></div>' +
    '<div class="form-group"><label>Adresse</label><input type="text" id="modal-venue-address"/></div>' +
    '<button class="btn btn-primary" id="modal-venue-submit">Erstellen</button></div>');
  document.getElementById('modal-venue-submit').addEventListener('click', function() {
    var name = document.getElementById('modal-venue-name').value.trim();
    var address = document.getElementById('modal-venue-address').value.trim();
    if (!name) return;
    api('/api/clubs/' + currentClubId + '/venues', { method: 'POST', body: { name: name, address: address } }).then(function() {
      closeModal(); loadVenues();
    }).catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
  });
}

function showEditVenueModal(venueId) {
  var v = venuesCache.find(function(x) { return getId(x) == venueId; });
  if (!v) return;
  showModal('Spielstätte bearbeiten',
    '<div class="app-form"><div class="form-group"><label>Name</label>' +
    '<input type="text" id="modal-venue-name" value="' + escHtml(v.name) + '"/></div>' +
    '<div class="form-group"><label>Adresse</label>' +
    '<input type="text" id="modal-venue-address" value="' + escHtml(v.address || '') + '"/></div>' +
    '<button class="btn btn-primary" id="modal-venue-submit">Speichern</button></div>');
  document.getElementById('modal-venue-submit').addEventListener('click', function() {
    var name = document.getElementById('modal-venue-name').value.trim();
    var address = document.getElementById('modal-venue-address').value.trim();
    if (!name) return;
    api('/api/clubs/' + currentClubId + '/venues/' + venueId, { method: 'PUT', body: { name: name, address: address } }).then(function() {
      closeModal(); loadVenues();
    }).catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
  });
}

function deleteVenue(venueId) {
  if (!confirm('Spielstätte wirklich löschen?')) return;
  api('/api/clubs/' + currentClubId + '/venues/' + venueId, { method: 'DELETE' }).then(function() {
    loadVenues();
  }).catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
}

function showInvitationModal() {
  showModal('Einladung erstellen',
    '<div class="app-form">' +
    '<div class="form-group"><label>Rolle</label><select id="modal-inv-role">' +
    '<option value="Spieler">Spieler</option><option value="Trainer">Trainer</option>' +
    '<option value="VereinsAdmin">VereinsAdmin</option></select></div>' +
    '<div class="form-group"><label>Max. Nutzungen</label><input type="number" id="modal-inv-max" value="1" min="1"/></div>' +
    '<button class="btn btn-primary" id="modal-inv-submit">Erstellen</button></div>');
  document.getElementById('modal-inv-submit').addEventListener('click', function() {
    var role = document.getElementById('modal-inv-role').value;
    var maxUses = parseInt(document.getElementById('modal-inv-max').value) || 1;
    api('/api/clubs/' + currentClubId + '/invitations', { method: 'POST', body: { role: role, maxUses: maxUses } }).then(function(data) {
      var code = data.code || (data.invitation && data.invitation.code) || '';
      var link = location.origin + '/invite/' + code;
      document.getElementById('invitation-result').innerHTML =
        '<div class="msg ok">Link: <input type="text" value="' + escHtml(link) + '" onclick="this.select()" style="width:100%;margin-top:0.25rem" readonly/></div>';
      closeModal();
    }).catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
  });
}

// --- Team View ---
function loadTeam(sportId, teamId) {
  currentSportId = sportId;
  currentTeamId = teamId;
  document.querySelectorAll('.app-view').forEach(function(v) { v.classList.remove('active'); });
  document.getElementById('view-team').classList.add('active');

  var trainersList = document.getElementById('team-trainers');
  var playersList = document.getElementById('team-players');
  var gamesList = document.getElementById('team-games');
  var trainingsList = document.getElementById('team-trainings');
  trainersList.innerHTML = playersList.innerHTML = gamesList.innerHTML = trainingsList.innerHTML = '<li>Laden…</li>';

  api('/api/clubs/' + currentClubId + '/sports/' + sportId + '/teams/' + teamId).then(function(data) {
    var team = data.team || data;
    document.getElementById('team-name').textContent = team.name || 'Team';
    var canManage = team.isTrainer || team.role === 'Trainer' || team.isAdmin || team.role === 'VereinsAdmin';
    var isAdmin = team.isAdmin || team.role === 'VereinsAdmin';
    document.getElementById('btn-add-player').style.display = canManage ? '' : 'none';
    document.getElementById('btn-add-trainer').style.display = isAdmin ? '' : 'none';
    document.getElementById('btn-add-game').style.display = canManage ? '' : 'none';
    document.getElementById('btn-add-training').style.display = canManage ? '' : 'none';

    var trainers = team.trainers || [];
    trainersList.innerHTML = trainers.length === 0 ? '<li style="color:#888">Keine Trainer</li>' : '';
    trainers.forEach(function(tr) {
      var li = document.createElement('li');
      li.innerHTML = '<span>' + escHtml(tr.username || tr.name) + '</span>';
      if (isAdmin) {
        var btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-danger'; btn.textContent = '✕';
        btn.addEventListener('click', function() { removeTrainer(tr.userId || getId(tr)); });
        li.appendChild(btn);
      }
      trainersList.appendChild(li);
    });

    var players = team.players || [];
    playersList.innerHTML = players.length === 0 ? '<li style="color:#888">Keine Spieler</li>' : '';
    players.forEach(function(pl) {
      var li = document.createElement('li');
      li.innerHTML = '<span>' + escHtml(pl.username || pl.name) +
        (pl.jerseyNumber ? ' (#' + pl.jerseyNumber + ')' : '') + '</span>';
      if (canManage) {
        var btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-danger'; btn.textContent = '✕';
        btn.addEventListener('click', function() { removePlayer(getId(pl)); });
        li.appendChild(btn);
      }
      playersList.appendChild(li);
    });
  }).catch(function() {
    trainersList.innerHTML = playersList.innerHTML = '<li style="color:#c00">Fehler</li>';
  });

  api('/api/clubs/' + currentClubId + '/teams/' + teamId + '/games').then(function(data) {
    var games = data.games || data || [];
    gamesList.innerHTML = games.length === 0 ? '<li style="color:#888">Keine Spiele</li>' : '';
    games.forEach(function(g) {
      var li = document.createElement('li');
      li.innerHTML = '<span>' + fmtDateTime(g.date || g.startDate) + ' – ' +
        escHtml(g.opponent || g.title || 'Spiel') + '</span>';
      var btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-secondary'; btn.textContent = 'Details';
      btn.addEventListener('click', function() { loadEvent('games', getId(g)); });
      li.appendChild(btn);
      gamesList.appendChild(li);
    });
  }).catch(function() { gamesList.innerHTML = '<li style="color:#c00">Fehler</li>'; });

  api('/api/clubs/' + currentClubId + '/teams/' + teamId + '/trainings').then(function(data) {
    var trainings = data.trainings || data || [];
    trainingsList.innerHTML = trainings.length === 0 ? '<li style="color:#888">Keine Trainings</li>' : '';
    trainings.forEach(function(t) {
      var li = document.createElement('li');
      li.innerHTML = '<span>' + fmtDateTime(t.date || t.startDate) + ' – ' +
        escHtml(t.title || 'Training') + '</span>';
      var btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-secondary'; btn.textContent = 'Details';
      btn.addEventListener('click', function() { loadEvent('trainings', getId(t)); });
      li.appendChild(btn);
      trainingsList.appendChild(li);
    });
  }).catch(function() { trainingsList.innerHTML = '<li style="color:#c00">Fehler</li>'; });
}

function showAddPlayerModal() {
  showModal('Spieler hinzufügen',
    '<div class="app-form"><div class="form-group"><label>Benutzername oder E-Mail</label>' +
    '<input type="text" id="modal-player-name"/></div>' +
    '<div class="form-group"><label>Trikotnummer</label><input type="number" id="modal-player-jersey"/></div>' +
    '<button class="btn btn-primary" id="modal-player-submit">Hinzufügen</button></div>');
  document.getElementById('modal-player-submit').addEventListener('click', function() {
    var name = document.getElementById('modal-player-name').value.trim();
    var jersey = document.getElementById('modal-player-jersey').value;
    if (!name) return;
    api('/api/clubs/' + currentClubId + '/sports/' + currentSportId + '/teams/' + currentTeamId + '/players', {
      method: 'POST', body: { username: name, jerseyNumber: jersey ? parseInt(jersey) : undefined }
    }).then(function() { closeModal(); loadTeam(currentSportId, currentTeamId); })
      .catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
  });
}

function removePlayer(playerId) {
  if (!confirm('Spieler wirklich entfernen?')) return;
  api('/api/clubs/' + currentClubId + '/sports/' + currentSportId + '/teams/' + currentTeamId + '/players/' + playerId, { method: 'DELETE' })
    .then(function() { loadTeam(currentSportId, currentTeamId); })
    .catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
}

function showAddTrainerModal() {
  showModal('Trainer hinzufügen',
    '<div class="app-form"><div class="form-group"><label>Benutzername</label>' +
    '<input type="text" id="modal-trainer-name"/></div>' +
    '<button class="btn btn-primary" id="modal-trainer-submit">Hinzufügen</button></div>');
  document.getElementById('modal-trainer-submit').addEventListener('click', function() {
    var name = document.getElementById('modal-trainer-name').value.trim();
    if (!name) return;
    api('/api/clubs/' + currentClubId + '/sports/' + currentSportId + '/teams/' + currentTeamId + '/trainers', {
      method: 'POST', body: { username: name }
    }).then(function() { closeModal(); loadTeam(currentSportId, currentTeamId); })
      .catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
  });
}

function removeTrainer(userId) {
  if (!confirm('Trainer wirklich entfernen?')) return;
  api('/api/clubs/' + currentClubId + '/sports/' + currentSportId + '/teams/' + currentTeamId + '/trainers/' + userId, { method: 'DELETE' })
    .then(function() { loadTeam(currentSportId, currentTeamId); })
    .catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
}

function showAddGameModal() {
  api('/api/clubs/' + currentClubId + '/venues').then(function(data) {
    var venues = data.venues || data || [];
    var venueOpts = '<option value="">– Keine –</option>';
    venues.forEach(function(v) { venueOpts += '<option value="' + getId(v) + '">' + escHtml(v.name) + '</option>'; });
    renderGameForm(venueOpts);
  }).catch(function() { renderGameForm(''); });
}

function renderGameForm(venueOpts) {
  showModal('Spiel hinzufügen',
    '<div class="app-form">' +
    '<div class="form-group"><label>Gegner</label><input type="text" id="modal-game-opponent"/></div>' +
    '<div class="form-group"><label>Datum &amp; Uhrzeit</label><input type="datetime-local" id="modal-game-date"/></div>' +
    (venueOpts ? '<div class="form-group"><label>Spielstätte</label><select id="modal-game-venue">' + venueOpts + '</select></div>' : '') +
    '<div class="form-group"><label>Heim/Auswärts</label><select id="modal-game-location">' +
    '<option value="home">Heim</option><option value="away">Auswärts</option></select></div>' +
    '<button class="btn btn-primary" id="modal-game-submit">Erstellen</button></div>');
  document.getElementById('modal-game-submit').addEventListener('click', function() {
    var opponent = document.getElementById('modal-game-opponent').value.trim();
    var date = document.getElementById('modal-game-date').value;
    if (!opponent || !date) { alert('Bitte Gegner und Datum angeben.'); return; }
    var body = { opponent: opponent, date: date, location: document.getElementById('modal-game-location').value };
    var venueEl = document.getElementById('modal-game-venue');
    if (venueEl && venueEl.value) body.venueId = venueEl.value;
    api('/api/clubs/' + currentClubId + '/teams/' + currentTeamId + '/games', {
      method: 'POST', body: body
    }).then(function() { closeModal(); loadTeam(currentSportId, currentTeamId); })
      .catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
  });
}

function showAddTrainingModal() {
  api('/api/clubs/' + currentClubId + '/venues').then(function(data) {
    var venues = data.venues || data || [];
    var venueOpts = '<option value="">– Keine –</option>';
    venues.forEach(function(v) { venueOpts += '<option value="' + getId(v) + '">' + escHtml(v.name) + '</option>'; });
    renderTrainingForm(venueOpts);
  }).catch(function() { renderTrainingForm(''); });
}

function renderTrainingForm(venueOpts) {
  showModal('Training hinzufügen',
    '<div class="app-form">' +
    '<div class="form-group"><label>Titel</label><input type="text" id="modal-training-title" value="Training"/></div>' +
    '<div class="form-group"><label>Datum &amp; Uhrzeit</label><input type="datetime-local" id="modal-training-date"/></div>' +
    (venueOpts ? '<div class="form-group"><label>Spielstätte</label><select id="modal-training-venue">' + venueOpts + '</select></div>' : '') +
    '<button class="btn btn-primary" id="modal-training-submit">Erstellen</button></div>');
  document.getElementById('modal-training-submit').addEventListener('click', function() {
    var title = document.getElementById('modal-training-title').value.trim() || 'Training';
    var date = document.getElementById('modal-training-date').value;
    if (!date) { alert('Bitte Datum angeben.'); return; }
    var body = { title: title, date: date };
    var venueEl = document.getElementById('modal-training-venue');
    if (venueEl && venueEl.value) body.venueId = venueEl.value;
    api('/api/clubs/' + currentClubId + '/teams/' + currentTeamId + '/trainings', {
      method: 'POST', body: body
    }).then(function() { closeModal(); loadTeam(currentSportId, currentTeamId); })
      .catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
  });
}

// --- Event Detail ---
function loadEvent(type, eventId) {
  currentEventType = type;
  currentEventId = eventId;
  document.querySelectorAll('.app-view').forEach(function(v) { v.classList.remove('active'); });
  document.getElementById('view-event').classList.add('active');

  var url = '/api/clubs/' + currentClubId + '/teams/' + currentTeamId + '/' + currentEventType + '/' + eventId;
  api(url).then(function(data) {
    var ev = data.game || data.training || data;
    document.getElementById('event-title').textContent = ev.title || ev.opponent || (currentEventType === 'games' ? 'Spiel' : 'Training');
    var details = '<p><strong>Datum:</strong> ' + fmtDateTime(ev.date || ev.startDate) + '</p>';
    if (ev.opponent) details += '<p><strong>Gegner:</strong> ' + escHtml(ev.opponent) + '</p>';
    if (ev.location) details += '<p><strong>Ort:</strong> ' + escHtml(typeof ev.location === 'string' ? ev.location : ev.location.name || '') + '</p>';
    if (ev.venue) details += '<p><strong>Spielstätte:</strong> ' + escHtml(typeof ev.venue === 'string' ? ev.venue : ev.venue.name || '') + '</p>';
    document.getElementById('event-details').innerHTML = details;
    document.getElementById('event-result-text').value = ev.result || ev.report || '';
  }).catch(function() {
    document.getElementById('event-details').innerHTML = '<p style="color:#c00">Fehler beim Laden</p>';
  });

  loadAttendance();
  loadEventPhotos();
}

function loadAttendance() {
  var container = document.getElementById('event-attendance');
  container.innerHTML = '<p>Laden…</p>';
  api('/api/clubs/' + currentClubId + '/events/' + currentEventType + '/' + currentEventId + '/attendance').then(function(data) {
    var list = data.attendance || data || [];
    if (list.length === 0) { container.innerHTML = '<p style="color:#888">Keine Anwesenheitsdaten</p>'; return; }
    container.innerHTML = '';
    list.forEach(function(a) {
      var div = document.createElement('div');
      div.className = 'attendance-item';
      var cls = a.status === 'accepted' ? 'attendance-accepted' : a.status === 'declined' ? 'attendance-declined' : 'attendance-pending';
      var txt = a.status === 'accepted' ? '✔ Zugesagt' : a.status === 'declined' ? '✘ Abgesagt' : '? Offen';
      div.innerHTML = '<span>' + escHtml(a.username || a.name || a.user) + '</span><span class="' + cls + '">' + txt + '</span>';
      container.appendChild(div);
    });
  }).catch(function() { container.innerHTML = '<p style="color:#c00">Fehler</p>'; });
}

function submitRSVP(status) {
  api('/api/clubs/' + currentClubId + '/events/' + currentEventType + '/' + currentEventId + '/attendance', {
    method: 'POST', body: { status: status }
  }).then(function() { loadAttendance(); })
    .catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
}

function saveResult() {
  var text = document.getElementById('event-result-text').value;
  api('/api/clubs/' + currentClubId + '/teams/' + currentTeamId + '/' + currentEventType + '/' + currentEventId + '/result', {
    method: 'PUT', body: { result: text }
  }).then(function() { alert('Ergebnis gespeichert.'); })
    .catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
}

function toggleResultPreview() {
  var ta = document.getElementById('event-result-text');
  var prev = document.getElementById('event-result-preview');
  if (prev.style.display === 'none') {
    prev.style.display = '';
    prev.textContent = ta.value;
    ta.parentElement.style.display = 'none';
  } else {
    prev.style.display = 'none';
    ta.parentElement.style.display = '';
  }
}

function uploadEventPhoto() {
  var input = document.getElementById('event-photo-file');
  input.click();
  input.onchange = function() {
    var file = input.files[0];
    if (!file) return;
    var fd = new FormData();
    fd.append('photo', file);
    api('/api/clubs/' + currentClubId + '/events/' + currentEventType + '/' + currentEventId + '/photos', {
      method: 'POST', body: fd
    }).then(function() { loadEventPhotos(); input.value = ''; })
      .catch(function(e) { alert('Fehler: ' + (e.message || 'Upload fehlgeschlagen')); });
  };
}

function loadEventPhotos() {
  var container = document.getElementById('event-photos');
  api('/api/clubs/' + currentClubId + '/events/' + currentEventType + '/' + currentEventId + '/photos').then(function(data) {
    var photos = data.photos || data || [];
    if (photos.length === 0) { container.innerHTML = '<p style="color:#888">Keine Fotos</p>'; return; }
    container.innerHTML = '';
    photos.forEach(function(p) {
      var img = document.createElement('img');
      img.src = '/api/photos/' + getId(p);
      img.alt = 'Foto';
      img.addEventListener('click', function() { window.open(img.src, '_blank'); });
      container.appendChild(img);
    });
  }).catch(function() { container.innerHTML = ''; });
}

function exportICal() {
  if (currentClubId && currentTeamId) window.open('/api/clubs/' + currentClubId + '/teams/' + currentTeamId + '/schedule/ical');
}

function exportPDF() {
  if (currentClubId && currentTeamId) window.open('/api/clubs/' + currentClubId + '/teams/' + currentTeamId + '/schedule/pdf');
}

function exportAttendancePDF() {
  if (currentClubId && currentEventType && currentEventId)
    window.open('/api/clubs/' + currentClubId + '/events/' + currentEventType + '/' + currentEventId + '/attendance/pdf');
}

// --- Messages ---
function loadMessages() {
  if (!currentClubId) return;
  var container = document.getElementById('messages-list');
  container.innerHTML = '<p>Laden…</p>';
  api('/api/clubs/' + currentClubId + '/messages').then(function(data) {
    var msgs = data.messages || data || [];
    if (msgs.length === 0) { container.innerHTML = '<p style="color:#888">Keine Nachrichten</p>'; return; }
    container.innerHTML = '';
    msgs.forEach(function(m) {
      var div = document.createElement('div');
      div.className = 'message-item';
      div.innerHTML = '<div class="msg-subject">' + escHtml(m.subject || m.title || 'Nachricht') + '</div>' +
        '<div class="msg-meta">' + escHtml(m.sender || m.from || '') + ' · ' + fmtDateTime(m.createdAt || m.date) + '</div>';
      div.addEventListener('click', function() { loadThread(getId(m)); });
      container.appendChild(div);
    });
  }).catch(function() { container.innerHTML = '<p style="color:#c00">Fehler beim Laden</p>'; });
}

function loadThread(msgId) {
  document.getElementById('messages-list').style.display = 'none';
  document.getElementById('message-thread').style.display = '';
  var container = document.getElementById('thread-content');
  container.innerHTML = '<p>Laden…</p>';
  api('/api/clubs/' + currentClubId + '/messages/' + msgId).then(function(data) {
    var msg = data.message || data;
    var replies = msg.replies || data.replies || [];
    var html = '<div class="card"><div class="msg-subject">' + escHtml(msg.subject || msg.title || '') + '</div>' +
      '<div class="msg-meta">' + escHtml(msg.sender || msg.from || '') + ' · ' + fmtDateTime(msg.createdAt || msg.date) + '</div>' +
      '<p style="margin-top:0.5rem">' + escHtml(msg.body || msg.content || msg.text || '') + '</p></div>';
    replies.forEach(function(r) {
      html += '<div class="card" style="margin-left:1rem"><div class="msg-meta">' +
        escHtml(r.sender || r.from || '') + ' · ' + fmtDateTime(r.createdAt || r.date) + '</div>' +
        '<p style="margin-top:0.25rem">' + escHtml(r.body || r.content || r.text || '') + '</p></div>';
    });
    container.innerHTML = html;
    document.getElementById('reply-text').value = '';
    document.getElementById('btn-send-reply').onclick = function() { sendReply(msgId); };
  }).catch(function() { container.innerHTML = '<p style="color:#c00">Fehler</p>'; });
}

function showNewMessageModal() {
  showModal('Neue Nachricht',
    '<div class="app-form">' +
    '<div class="form-group"><label>Empfänger (Benutzername, Team oder @alle)</label><input type="text" id="modal-msg-to"/></div>' +
    '<div class="form-group"><label>Betreff</label><input type="text" id="modal-msg-subject"/></div>' +
    '<div class="form-group"><label>Nachricht</label><textarea id="modal-msg-body" rows="4" placeholder="Verwende @Name für Erwähnungen"></textarea></div>' +
    '<button class="btn btn-primary" id="modal-msg-submit">Senden</button></div>');
  document.getElementById('modal-msg-submit').addEventListener('click', function() {
    var to = document.getElementById('modal-msg-to').value.trim();
    var subject = document.getElementById('modal-msg-subject').value.trim();
    var body = document.getElementById('modal-msg-body').value.trim();
    if (!to || !subject || !body) { alert('Bitte alle Felder ausfüllen.'); return; }
    api('/api/clubs/' + currentClubId + '/messages', {
      method: 'POST', body: { to: to, subject: subject, body: body }
    }).then(function() { closeModal(); loadMessages(); })
      .catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
  });
}

function sendReply(msgId) {
  var text = document.getElementById('reply-text').value.trim();
  if (!text) return;
  api('/api/clubs/' + currentClubId + '/messages/' + msgId + '/reply', {
    method: 'POST', body: { body: text }
  }).then(function() { loadThread(msgId); })
    .catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
}

// --- Notifications ---
function loadNotifications() {
  var container = document.getElementById('notifications-list');
  container.innerHTML = '<p>Laden…</p>';
  api('/api/notifications').then(function(data) {
    var notifs = data.notifications || data || [];
    if (notifs.length === 0) { container.innerHTML = '<p style="color:#888">Keine Benachrichtigungen</p>'; return; }
    container.innerHTML = '';
    notifs.forEach(function(n) {
      var div = document.createElement('div');
      div.className = 'notif-item' + (n.read ? '' : ' unread');
      div.innerHTML = '<span>' + escHtml(n.message || n.text || n.title) + '</span>' +
        '<span style="font-size:0.8rem;color:#888;margin-left:0.5rem">' + fmtDateTime(n.createdAt || n.date) + '</span>';
      if (!n.read) {
        div.style.cursor = 'pointer';
        div.addEventListener('click', function() {
          api('/api/notifications/' + getId(n) + '/read', { method: 'PUT' }).then(function() {
            div.classList.remove('unread'); n.read = true; updateNotifBadge();
          }).catch(function() {});
        });
      }
      container.appendChild(div);
    });
    updateNotifBadge();
  }).catch(function() { container.innerHTML = '<p style="color:#c00">Fehler</p>'; });

  api('/api/notifications/settings').then(function(data) {
    var s = data.settings || data;
    document.getElementById('notif-email').checked = !!s.email;
    document.getElementById('notif-push').checked = !!s.push;
    document.getElementById('notif-dashboard').checked = s.dashboard !== false;
  }).catch(function() {});
}

function markAllRead() {
  api('/api/notifications/read-all', { method: 'PUT' }).then(function() {
    loadNotifications();
  }).catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
}

function saveNotifSettings() {
  api('/api/notifications/settings', {
    method: 'PUT', body: {
      email: document.getElementById('notif-email').checked,
      push: document.getElementById('notif-push').checked,
      dashboard: document.getElementById('notif-dashboard').checked
    }
  }).then(function() { alert('Einstellungen gespeichert.'); })
    .catch(function(e) { alert('Fehler: ' + (e.message || 'Fehler')); });
}

function updateNotifBadge() {
  api('/api/notifications').then(function(data) {
    var notifs = data.notifications || data || [];
    var unread = notifs.filter(function(n) { return !n.read; }).length;
    var badge = document.getElementById('notif-badge');
    if (unread > 0) { badge.textContent = unread; badge.classList.remove('hidden'); }
    else { badge.classList.add('hidden'); }
  }).catch(function() {});
}

function startNotifPolling() {
  stopNotifPolling();
  updateNotifBadge();
  notifInterval = setInterval(updateNotifBadge, 60000);
}

// --- Wire up event listeners ---
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('login-form').addEventListener('submit', doLogin);
  document.getElementById('register-form').addEventListener('submit', doRegister);
  document.getElementById('verify-form').addEventListener('submit', doVerifyEmail);
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('captcha-reload').addEventListener('click', loadCaptcha);

  // --- SPA event listeners ---
  document.querySelectorAll('#app-nav .nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { navigateTo(btn.dataset.view); });
  });
  document.getElementById('btn-upload-logo').addEventListener('click', uploadLogo);
  document.getElementById('btn-edit-club').addEventListener('click', showEditClubModal);
  document.getElementById('btn-add-sport').addEventListener('click', showAddSportModal);
  document.getElementById('btn-add-venue').addEventListener('click', showAddVenueModal);
  document.getElementById('btn-create-invitation').addEventListener('click', showInvitationModal);
  document.getElementById('btn-back-club').addEventListener('click', function() { navigateTo('club'); });
  document.getElementById('btn-add-player').addEventListener('click', showAddPlayerModal);
  document.getElementById('btn-add-trainer').addEventListener('click', showAddTrainerModal);
  document.getElementById('btn-add-game').addEventListener('click', showAddGameModal);
  document.getElementById('btn-add-training').addEventListener('click', showAddTrainingModal);
  document.getElementById('btn-export-ical').addEventListener('click', exportICal);
  document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);
  document.getElementById('btn-back-team').addEventListener('click', function() {
    if (currentSportId && currentTeamId) loadTeam(currentSportId, currentTeamId);
    else navigateTo('dashboard');
  });
  document.getElementById('btn-rsvp-accept').addEventListener('click', function() { submitRSVP('accepted'); });
  document.getElementById('btn-rsvp-decline').addEventListener('click', function() { submitRSVP('declined'); });
  document.getElementById('btn-save-result').addEventListener('click', saveResult);
  document.getElementById('btn-toggle-preview').addEventListener('click', toggleResultPreview);
  document.getElementById('btn-upload-photo').addEventListener('click', uploadEventPhoto);
  document.getElementById('btn-export-attendance-pdf').addEventListener('click', exportAttendancePDF);
  document.getElementById('btn-new-message').addEventListener('click', showNewMessageModal);
  document.getElementById('btn-back-messages').addEventListener('click', function() {
    document.getElementById('messages-list').style.display = '';
    document.getElementById('message-thread').style.display = 'none';
  });
  document.getElementById('btn-mark-all-read').addEventListener('click', markAllRead);
  document.getElementById('btn-save-notif-settings').addEventListener('click', saveNotifSettings);
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  checkAuthStatus();
  loadCsrfToken().catch(err => console.error('CSRF token load failed:', err));
});
