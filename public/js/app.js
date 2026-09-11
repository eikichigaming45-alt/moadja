// ============================================================
// public/js/app.js
// Point d'entrée front : état global, login, logout, init app,
// navigation onglets, utilitaires date/version, refresh widgets.
// ============================================================

// ── State global ──────────────────────────────────────────────
let meteoData       = null;
let priere          = null;
let profilCache     = null;
let dragSrc         = null;
let longPressTimer  = null;
let dragActif       = false;
let cropperInstance = null;
let _appInitialisee = false;
let _ongletActif    = 'accueil';

// ── Définition des widgets ────────────────────────────────────
const WIDGETS_DEF = [
    { id:'agenda',            label:'Agenda',              icon:'📅', cls:'w-agenda',            desc:'Chargement...',  foot:'Cliquez pour gérer',                refresh:true },
    { id:'meteo',             label:'Météo du jour',       icon:'🌤️', cls:'w-meteo',             desc:'Chargement...',  foot:'Cliquez pour les détails',          refresh:true },
    { id:'priere',            label:'Prière du jour',      icon:'🙏',  cls:'w-priere',            desc:'Chargement...',  foot:'Cliquez pour la version complète',  refresh:true },
    { id:'islam',             label:'Prières & Hadiths',   icon:'🌙',  cls:'w-islam',             desc:'Chargement...',  foot:'Cliquez pour la version complète',  refresh:true },
    { id:'taches',            label:'Tâches du jour',      icon:'✅',  cls:'w-taches',            desc:'Chargement...',  foot:'Cliquez pour gérer' },
    { id:'cycle',             label:'Suivi du cycle',      icon:'🌸',  cls:'w-cycle',             desc:'Chargement...',  foot:'Cliquez pour gérer',                refresh:true },
    { id:'anniversaires',     label:'Anniversaires',       icon:'🎂',  cls:'w-anniversaires',     desc:'Chargement...',  foot:'Cliquez pour gérer' },
    { id:'astrologie',        label:'Astrologie',          icon:'✨',  cls:'w-astrologie',        desc:'Chargement...',  foot:'Cliquez pour votre horoscope',      refresh:true },
    { id:'theme-astral',      label:'Thème Astral',        icon:'🔮',  cls:'w-theme-astral',      desc:'Chargement...',  foot:'Cliquez pour votre thème natal',    refresh:true },
    { id:'pierre-naissance',  label:'Pierre de naissance', icon:'💎',  cls:'w-pierre-naissance',  desc:'Chargement...',  foot:'' },
    { id:'social',            label:'Social',              icon:'🤝',  cls:'w-social',            desc:'Chargement...',  foot:'Ce que mes proches partagent avec moi' },
    { id:'profil',            label:'Mon Profil',          icon:'👤',  cls:'w-profil',            desc:'',               foot:'Cliquez pour gérer' },
    { id:'sante',             label:'Santé',               icon:'🥗',  cls:'w-sante',             desc:'Chargement...',  foot:'Calculs & plan nutritionnel' },
];

const TOUS_WIDGETS = [
    { slug:'agenda',        label:'Agenda',            icon:'📅' },
    { slug:'anniversaires', label:'Anniversaires',     icon:'🎂' },
    { slug:'astrologie',    label:'Astrologie',        icon:'✨' },
    { slug:'cycle',         label:'Suivi du cycle',    icon:'🌸' },
    { slug:'islam',         label:'Prières & Hadiths', icon:'🌙' },
    { slug:'priere',        label:'Prière du jour',    icon:'🙏' },
    { slug:'sante',         label:'Santé',             icon:'🥗' },
    { slug:'social',        label:'Social',            icon:'🤝' },
    { slug:'taches',        label:'Tâches',            icon:'✅' },
    { slug:'theme-astral',  label:'Thème Astral',      icon:'🔮' },
];

// ── Codes météo ───────────────────────────────────────────────
const codes = {
    0:'Ciel dégagé ☀️', 1:'Principalement dégagé 🌤️', 2:'Partiellement nuageux ⛅',
    3:'Couvert ☁️', 45:'Brouillard 🌫️', 48:'Brouillard givrant 🌫️',
    51:'Bruine légère 🌦️', 61:'Pluie légère 🌧️', 63:'Pluie modérée 🌧️',
    65:'Forte pluie 🌧️', 71:'Neige légère 🌨️', 80:'Averses 🌦️',
    95:'Orage ⛈️', 99:'Orage avec grêle ⛈️'
};

// ── Utilitaire session ────────────────────────────────────────
function getUser() {
    try {
        return JSON.parse(localStorage.getItem('moadja_user')) || null;
    } catch { return null; }
}

// ── Menu utilisateur header ───────────────────────────────────
function toggleUserMenu(e) {
    e.stopPropagation();
    const menu      = document.getElementById('user-menu');
    const isVisible = menu.style.display === 'block';
    if (!isVisible) _fermerTousPanneaux();
    menu.style.display = isVisible ? 'none' : 'block';
}

function ouvrirMonProfil() {
    fermerUserMenu();
    openModal('profil');
}

function fermerUserMenu() {
    const menu = document.getElementById('user-menu');
    if (menu) menu.style.display = 'none';
}

document.addEventListener('click', function(e) {
    const menu = document.getElementById('user-menu');
    const btn  = document.getElementById('btn-profil-header');
    if (!menu || !btn) return;
    if (!menu.contains(e.target) && e.target !== btn) {
        menu.style.display = 'none';
    }
});

// ── Affichage rapide ──────────────────────────────────────────
(function() {
    const user = getUser();
    if (user?.token) {
        const loginPage = document.getElementById('login-page');
        const app       = document.getElementById('app');
        if (loginPage) loginPage.style.display = 'none';
        if (app) {
            app.style.display              = 'flex';
            document.body.style.background = '#f3f4f6';
            document.body.style.alignItems = 'stretch';
        }
        try {
            const cached = JSON.parse(localStorage.getItem('moadja_profil'));
            const btn    = document.getElementById('btn-profil-header');
            if (btn && cached?.photo) {
                btn.innerHTML        = `<img src="${cached.photo}" alt="profil">`;
                btn.style.fontSize   = '';
                btn.style.fontWeight = '';
                btn.style.background = '';
            }
        } catch { /* silencieux */ }
    }
})();

// ── Init au chargement ────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    const user = getUser();
    if (user?.token) {
        showApp();
    } else {
        localStorage.removeItem('moadja_user');
    }
});

// ── Login ─────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errEl    = document.getElementById('error-msg');
    if (errEl) errEl.textContent = '';
    try {
        const r = await fetch('/api/login', {
            method  : 'POST',
            headers : { 'Content-Type': 'application/json' },
            body    : JSON.stringify({ username, password })
        });
        const d = await r.json();
        if (d.success) {
            localStorage.setItem('moadja_user', JSON.stringify({
                username : d.username,
                role     : d.role,
                userId   : d.userId,
                token    : d.token
            }));
            if (d.mustChangePassword) {
                afficherModaleChangementMdpObligatoire(d.userId);
            } else {
                showApp();
            }
        } else {
            if (errEl) errEl.textContent = d.message || 'Identifiants incorrects.';
        }
    } catch {
        if (errEl) errEl.textContent = 'Erreur réseau.';
    }
});

// ── Show app ──────────────────────────────────────────────────
async function showApp() {
    if (_appInitialisee) return;
    _appInitialisee = true;

    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display        = 'flex';
    document.body.style.background                      = '#f3f4f6';
    document.body.style.alignItems                      = 'stretch';

    afficherDate();
    afficherVersion();

    // ── Lecture onglet depuis URL (push natif) ────────────────
    const params       = new URLSearchParams(window.location.search);
    const ongletPush   = params.get('onglet');
    const saved        = ongletPush || localStorage.getItem('moadja_onglet') || 'accueil';
    if (ongletPush) {
        history.replaceState(null, '', '/');
    }

    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const paneImmediat = document.getElementById(`tab-${saved}`);
    if (paneImmediat) paneImmediat.classList.add('active');

    await buildGrid();
    switchTab(saved, true);

    chargerPriere();
    if (typeof window.chargerIslam     === 'function') window.chargerIslam();
    chargerMeteoAuto();
    if (typeof initFeed                === 'function') initFeed();
    if (typeof chargerAstrologie       === 'function') chargerAstrologie();
    if (typeof chargerWidgetSocial     === 'function') chargerWidgetSocial();
    if (typeof chargerWidgetSante      === 'function') chargerWidgetSante();
    if (typeof chargerThemeAstral      === 'function') chargerThemeAstral();
    if (typeof chargerPierreNaissance  === 'function') chargerPierreNaissance();
    setTimeout(() => {
        if (typeof chargerWidgetTaches === 'function') chargerWidgetTaches();
    }, 300);
    chargerWidgetAnniversaires();

    const user = getUser();
    if (user?.role === 'admin') chargerWidgetAdmin();

    enregistrerServiceWorker();
    initPush();

    if (typeof chargerBadgeNotifs === 'function') chargerBadgeNotifs();

    // ── Init Tchat ────────────────────────────────────────────
    if (typeof Tchat !== 'undefined') Tchat.init();
}

// ── Navigation onglets ────────────────────────────────────────

const ONGLET_TITRES = {
    accueil  : 'MoaDja',
    quotidien: 'Mon Quotidien',
    bienetre : 'Bien-être',
    astral   : 'Astral',
    profil   : 'Profil'
};

function switchTab(onglet, silent = false) {
    _ongletActif = onglet;
    if (!silent) localStorage.setItem('moadja_onglet', onglet);

    fermerUserMenu();

    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const pane = document.getElementById(`tab-${onglet}`);
    if (pane) pane.classList.add('active');

    document.querySelectorAll('.bn-item').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === onglet);
    });

    const titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.textContent = ONGLET_TITRES[onglet] || 'MoaDja';

    if (onglet === 'accueil' && !silent) {
        const u = getUser();
        if (u?.token && typeof chargerFeed === 'function') chargerFeed();
    }

    if (onglet === 'profil' && !silent) {
        const u = getUser();
        if (u?.role === 'admin' && typeof chargerWidgetAdmin === 'function') chargerWidgetAdmin();
    }
}

// ── Logout ────────────────────────────────────────────────────
function logout() {
    fermerUserMenu();

    localStorage.removeItem('moadja_user');
    localStorage.removeItem('moadja_profil');

    _appInitialisee = false;
    gridConstruit   = false;
    profilCache     = null;
    meteoData       = null;
    priere          = null;
    _ongletActif    = 'accueil';

    document.getElementById('app').style.display        = 'none';
    document.body.style.background                      = '';
    document.body.style.alignItems                      = '';
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('username').value           = '';
    document.getElementById('password').value           = '';

    ['quotidien','bienetre','astral','profil'].forEach(o => {
        const g = document.getElementById(`grid-${o}`);
        if (g) g.innerHTML = '';
    });

    const accueilMeteo = document.getElementById('accueil-meteo');
    if (accueilMeteo) accueilMeteo.innerHTML = '';
    const accueilFeed  = document.getElementById('accueil-feed');
    if (accueilFeed)   accueilFeed.innerHTML = '';

    const errEl = document.getElementById('error-msg');
    if (errEl) errEl.textContent = '';

    const panel = document.getElementById('panel-notifs');
    if (panel) panel.style.display = 'none';
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'none';

    switchTab('accueil', true);
}

// ── Actualiser ────────────────────────────────────────────────
function actualiser() {
    afficherDate();
    chargerPriere();
    if (typeof window.chargerIslam     === 'function') window.chargerIslam();
    chargerMeteoAuto();
    if (typeof initFeed                === 'function') initFeed();
    if (typeof chargerAstrologie       === 'function') chargerAstrologie();
    if (typeof chargerProfilHeader     === 'function') chargerProfilHeader();
    if (typeof chargerWidgetTaches     === 'function') chargerWidgetTaches();
    if (typeof chargerWidgetSocial     === 'function') chargerWidgetSocial();
    if (typeof chargerWidgetSante      === 'function') chargerWidgetSante();
    if (typeof chargerThemeAstral      === 'function') chargerThemeAstral();
    if (typeof chargerPierreNaissance  === 'function') chargerPierreNaissance();
    chargerWidgetAnniversaires();
    if (typeof Agenda !== 'undefined') Agenda.charger();
    if (typeof Cycle  !== 'undefined') Cycle.charger();
    if (typeof chargerBadgeNotifs === 'function') chargerBadgeNotifs();
    if (typeof Tchat  !== 'undefined') Tchat.rafraichirBadge();
    const user = getUser();
    if (user?.role === 'admin') chargerWidgetAdmin();
}

// ── Changement MDP obligatoire ────────────────────────────────
function afficherModaleChangementMdpObligatoire(userId) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display        = 'flex';
    document.body.style.background                      = '#f3f4f6';
    document.body.style.alignItems                      = 'stretch';
    document.getElementById('overlay').classList.add('on');
    document.getElementById('modal-title').textContent  = '🔒 Changement de mot de passe requis';
    document.getElementById('modal-body').innerHTML = `
        <div style="background:#fff7ed;border-radius:12px;padding:16px;margin-bottom:20px;
                    border-left:4px solid #f59e0b;font-size:13px;color:#92400e">
            Votre mot de passe actuel ne respecte pas les règles de sécurité.
            Vous devez le changer avant de continuer.
        </div>
        <div style="font-size:12px;color:#9ca3af;margin-bottom:16px;text-align:center">
            8 car. min · majuscule · minuscule · chiffre · caractère spécial
        </div>
        <div style="margin-bottom:10px">
            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Ancien mot de passe</label>
            <input type="password" id="force-mdp-ancien" placeholder="••••••••"
                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
        </div>
        <div style="margin-bottom:10px">
            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Nouveau mot de passe</label>
            <input type="password" id="force-mdp-nouveau" placeholder="••••••••"
                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
        </div>
        <div style="margin-bottom:20px">
            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Confirmer le mot de passe</label>
            <input type="password" id="force-mdp-confirm" placeholder="••••••••"
                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
        </div>
        <button onclick="validerChangementMdpObligatoire(${userId})"
            style="width:100%;padding:13px;background:linear-gradient(135deg,#f59e0b,#d97706);
                   color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;
                   cursor:pointer;box-shadow:0 4px 10px rgba(245,158,11,0.3)">
            🔒 Changer le mot de passe
        </button>
        <div id="force-mdp-msg" style="text-align:center;margin-top:12px;font-size:13px;min-height:18px"></div>
    `;
    document.getElementById('overlay').onclick     = null;
    document.querySelector('.mclos').style.display = 'none';
}

async function validerChangementMdpObligatoire(userId) {
    const ancien  = document.getElementById('force-mdp-ancien').value;
    const nouveau = document.getElementById('force-mdp-nouveau').value;
    const confirm = document.getElementById('force-mdp-confirm').value;
    const msg     = document.getElementById('force-mdp-msg');
    if (nouveau !== confirm) {
        msg.style.color = '#ef4444';
        msg.textContent = '❌ Les mots de passe ne correspondent pas.';
        return;
    }
    try {
        const user = getUser();
        const r = await fetch('/api/profil/changer-mdp', {
            method  : 'POST',
            headers : {
                'Content-Type'  : 'application/json',
                'Authorization' : `Bearer ${user?.token}`
            },
            body: JSON.stringify({ ancienMdp: ancien, nouveauMdp: nouveau })
        });
        const d = await r.json();
        if (d.success) {
            msg.style.color = '#10b981';
            msg.textContent = '✅ Mot de passe changé !';
            document.querySelector('.mclos').style.display = '';
            document.getElementById('overlay').onclick     = closeOutside;
            setTimeout(() => {
                document.getElementById('overlay').classList.remove('on');
                showApp();
            }, 1000);
        } else {
            msg.style.color = '#ef4444';
            msg.textContent = '❌ ' + (d.message || 'Erreur.');
        }
    } catch {
        msg.style.color = '#ef4444';
        msg.textContent = '❌ Erreur réseau.';
    }
}

// ── Date & version ────────────────────────────────────────────
function afficherDate() {
    const now = new Date();
    const el  = document.getElementById('date-display');
    if (el) el.textContent = now.toLocaleDateString('fr-FR', {
        weekday:'long', year:'numeric', month:'long', day:'numeric'
    });
}

async function afficherVersion() {
    try {
        const r     = await fetch('/sw.js');
        const txt   = await r.text();
        const match = txt.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
        if (match) {
            const el = document.getElementById('topbar-version');
            if (el) el.textContent = match[1];
        }
    } catch { /* silencieux */ }
}

// ── Refresh widget ────────────────────────────────────────────
function refreshWidget(id) {
    switch (id) {
        case 'meteo'             : chargerMeteoAuto();                                                     break;
        case 'priere'            : chargerPriere();                                                        break;
        case 'islam'             : if (typeof window.chargerIslam    === 'function') window.chargerIslam();    break;
        case 'astrologie'        : if (typeof chargerAstrologie      === 'function') chargerAstrologie();      break;
        case 'theme-astral'      : if (typeof chargerThemeAstral     === 'function') chargerThemeAstral();     break;
        case 'pierre-naissance'  : if (typeof chargerPierreNaissance === 'function') chargerPierreNaissance(); break;
        case 'cycle'             : if (typeof Cycle  !== 'undefined') Cycle.charger();                     break;
        case 'agenda'            : if (typeof Agenda !== 'undefined') Agenda.charger();                    break;
        case 'social'            : if (typeof chargerWidgetSocial    === 'function') chargerWidgetSocial();    break;
        case 'sante'             : if (typeof chargerWidgetSante     === 'function') chargerWidgetSante();     break;
    }
}

// ── Service worker ────────────────────────────────────────────
function enregistrerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
}
