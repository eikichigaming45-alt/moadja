// ============================================================
// public/js/sport.js
// ============================================================
// Module Sport : socle commun — icônes/constantes partagées entre les
// sous-modules, Dashboard, Wake Lock, cartes de récapitulatif de séance,
// changement de section, modales génériques (confirmation/choix/info).
// Dépend de sport-widget.js chargé AVANT (auth, échappement, formatage,
// icônes communes, détail par série).
// Les sous-modules Mes Routines / Sélecteur d'exercice / Séance en cours
// ont été extraits respectivement dans sportRoutines.js, sportSelecteur.js
// et sportSeance.js (chargés APRÈS ce fichier, voir index.html).
// Le bouton "Activité libre" (icône + comportement) est géré dans le
// fichier dédié sport-activite-libre.js, chargé APRÈS ce fichier.

const SPORT_ICONE_PAS_IMAGE = `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
`;

const SPORT_ICONE_X = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
        <line x1="4" y1="4" x2="20" y2="20"></line>
        <line x1="20" y1="4" x2="4" y2="20"></line>
    </svg>
`;

const SPORT_ICONE_CHECK = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
`;

// Icône poubelle épurée (remplace l'emoji 🗑️ sur la carte de récapitulatif de séance).
const SPORT_ICONE_POUBELLE = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
        <path d="M10 11v6"></path>
        <path d="M14 11v6"></path>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
    </svg>
`;

// Icône poignée de glissement (drag-and-drop des exercices d'une routine).
const SPORT_ICONE_POIGNEE = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="6" r="1.5"></circle>
        <circle cx="15" cy="6" r="1.5"></circle>
        <circle cx="9" cy="12" r="1.5"></circle>
        <circle cx="15" cy="12" r="1.5"></circle>
        <circle cx="9" cy="18" r="1.5"></circle>
        <circle cx="15" cy="18" r="1.5"></circle>
    </svg>
`;

// Icône géolocalisation (bouton "Activité libre" — voir sport-activite-libre.js).
const SPORT_ICONE_GPS = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
    </svg>
`;

const SPORT_MAX_EXERCICES_APERCU = 5;

// Exercices "duree" pour lesquels les champs Distance/Vitesse/Inclinaison
// ont un sens (vrai cardio). Doit correspondre aux entrées cardio: true
// de routes/sport-traduction-fr.js (noms FR traduits, tels que stockés en base).
const SPORT_NOMS_EXERCICES_CARDIO = new Set([
    'Cyclisme', 'Jogging', 'Course à pied', 'Course fractionnée', 'Course sur tapis',
    'Course endurance', 'Natation (sprints 50m)', 'Vélo elliptique', 'Rameur',
    'Marche', 'Séance cardio vélo', 'Vélo RPM'
]);

let _sportSectionActive = 'dashboard';

// Cache local des dernières séances affichées dans le Dashboard (issu du
// dernier appel à /api/sport/dashboard-stats). Permet d'ouvrir la modale
// de stats pour UNE séance précise cliquée, sans requête réseau supplémentaire.
let _sportDashboardSeancesCache = [];

// ── Gestion Wake Lock (Écran allumé pendant la séance) ──
let _sportWakeLock = null;

async function _sportDemanderWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            _sportWakeLock = await navigator.wakeLock.request('screen');
            _sportWakeLock.addEventListener('release', () => {
                console.log('[SPORT] Wake Lock relâché.');
            });
        } catch (err) {
            console.error('[SPORT] Erreur Wake Lock:', err.message);
        }
    }
}

function _sportRelacherWakeLock() {
    if (_sportWakeLock !== null) {
        _sportWakeLock.release()
            .catch(err => console.error('[SPORT] Erreur release Wake Lock:', err.message))
            .finally(() => { _sportWakeLock = null; });
    }
}

// Relancer le Wake Lock si on revient sur l'application en cours de séance
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && _sportSeanceActive) {
        await _sportDemanderWakeLock();
    }
});


// ── Construction initiale ──
function chargerSportDashboard() {
    const zone = document.getElementById('grid-sport');
    if (!zone) return;

    zone.innerHTML = `
        <div class="sport-wrap">
            <div class="sport-pills">
                <button class="sport-pill active" data-section="dashboard" onclick="_sportSwitchSection('dashboard')">Dashboard</button>
                <button class="sport-pill" data-section="routines" onclick="_sportSwitchSection('routines')">Mes Routines</button>
            </div>
            <div id="sport-section-dashboard" class="sport-section">
                <p class="sport-catalogue-loading">Chargement…</p>
            </div>
            <div id="sport-section-routines" class="sport-section" style="display:none">
                <div id="sport-routines-zone">
                    <p class="sport-catalogue-loading">Chargement…</p>
                </div>
            </div>
        </div>
    `;

    _sportChargerDashboardStats();
    _sportInitVerifSeanceActive();
}

// ── Stats réelles du dashboard (5 dernières séances) ──
async function _sportChargerDashboardStats() {
    const zone = document.getElementById('sport-section-dashboard');
    if (!zone) return;

    try {
        const r = await fetch('/api/sport/dashboard-stats', { headers: _sportAuthHeaders() });
        const d = await r.json();
        const seances = d.success ? (d.dernieres_seances || []) : [];

        // Mise en cache locale : permet d'ouvrir la modale de stats pour
        // la séance exacte cliquée, sans refaire d'appel réseau.
        _sportDashboardSeancesCache = seances;

        zone.innerHTML = _sportRenderDashboard(seances);
    } catch (err) {
        console.error('[SPORT] chargerDashboardStats :', err.message);
        _sportDashboardSeancesCache = [];
        zone.innerHTML = _sportRenderDashboard([]);
    }

    zone.querySelectorAll('.sport-seance-recap-btn-suppr').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            _sportConfirmerSuppressionSeanceDashboard(parseInt(btn.dataset.sessionId, 10));
        });
    });
}

// ── Ouverture de la modale de stats pour UNE séance précise du dashboard ──
function _sportOuvrirStatsSeance(sessionId) {
    const seance = _sportDashboardSeancesCache.find(s => s.id === sessionId);
    if (!seance) {
        console.error('[SPORT] _sportOuvrirStatsSeance : séance introuvable pour id', sessionId);
        return;
    }
    window._sportSeanceStatsCourante = seance;
    openModal('sport-stats');
}

// ── Suppression d'une séance depuis le dashboard ──
function _sportConfirmerSuppressionSeanceDashboard(sessionId) {
    _sportOuvrirConfirmationSuppression(async () => {
        try {
            await fetch(`/api/sport/sessions/${sessionId}`, { method: 'DELETE', headers: _sportAuthHeaders() });
            _sportChargerDashboardStats();
            if (typeof chargerSportStatsWidget === 'function') chargerSportStatsWidget();
        } catch (err) {
            console.error('[SPORT] supprimerSeanceDashboard :', err.message);
        }
    });
}

// ── Rendu du Dashboard ──
// Correctif v1.92.61 : dès qu'au moins une séance existe, la carte "Prêt
// pour une nouvelle séance ?" bascule sur un layout horizontal compact
// (.sport-ready-state, icône à gauche / titre+CTA à droite, verticalement
// centrés) au lieu de l'ancien format en colonne (icône seule au milieu,
// bouton tout en bas), qui créait un grand vide visuel déséquilibré.
// Le cas "aucune séance" (état vide complet, avec texte d'accroche) garde
// son ancien format en colonne (.sport-empty-state), inchangé.
// Correctif v1.97 : ajout du 2e bouton "Activité libre" (icône GPS,
// style ghost — voir sport-activite-libre.css/js) à côté du bouton
// "Démarrer une séance", dans les deux états (prêt / aucune séance).
function _sportRenderDashboard(dernieresSeances) {
    const aDesSeances = dernieresSeances && dernieresSeances.length > 0;

    const boutonsHtml = `
        <div class="sport-ready-btns">
            <button class="sport-cta-btn" onclick="_sportSwitchSection('routines')">
                ${SPORT_ICONE_DUMBBELL} Démarrer une séance
            </button>
            <button class="sport-cta-btn-secondary" onclick="_sportActiviteLibreOuvrir()">
                ${SPORT_ICONE_GPS} Activité libre
            </button>
        </div>
    `;

    return `
        <div class="sport-card">
            ${aDesSeances ? `
                <div class="sport-ready-state">
                    <div class="sport-ready-icon">${SPORT_ICONE_DUMBBELL}</div>
                    <div class="sport-ready-info">
                        <div class="sport-ready-title">Prêt pour une nouvelle activité ?</div>
                        ${boutonsHtml}
                    </div>
                </div>
            ` : `
                <div class="sport-empty-state">
                    <div class="sport-empty-icon">${SPORT_ICONE_DUMBBELL}</div>
                    <div class="sport-empty-title">Aucune séance cette semaine</div>
                    <div class="sport-empty-text">
                        Prêt à commencer ? Créez votre première routine pour suivre vos entraînements
                        et voir votre progression au fil du temps.
                    </div>
                    ${boutonsHtml}
                </div>
            `}
        </div>

        <div class="sport-section-title" style="padding:0 4px">Dernières séances</div>
        ${aDesSeances ? `
            ${dernieresSeances.map(s => _sportRenderCarteSeanceRecap(s)).join('')}
        ` : `
            <div class="sport-card">
                <p class="sport-empty-note">Aucune séance enregistrée pour l'instant.</p>
            </div>
        `}
    `;
}

// ── Carte de récapitulatif de séance (Dashboard) ──
// Strictement ISO avec le widget colonne droite (utilisation de _sportRenderSeanceIso).
// Le bouton supprimer est transmis en 3e paramètre pour être intégré DANS la
// ligne de titre (flexbox, à côté de la date), et non plus en position
// absolue (ce qui provoquait un chevauchement visuel avec la date).
function _sportRenderCarteSeanceRecap(s) {
    const btnSupprHtml = `
        <button class="sport-seance-recap-btn-suppr" data-session-id="${s.id}" title="Supprimer la séance">
            ${SPORT_ICONE_POUBELLE}
        </button>
    `;

    const isoHtml = _sportRenderSeanceIso(s, 'dashboard', btnSupprHtml);
    
    // Le clic est de nouveau actif pour TOUTES les séances
    return `
        <div class="sport-card sport-seance-carte-recap sport-seance-carte-recap-clickable" id="sport-seance-carte-${s.id}" onclick="_sportOuvrirStatsSeance(${s.id})" role="button" tabindex="0">
            ${isoHtml}
        </div>
    `;
}

// ── Changement de section ──
function _sportSwitchSection(section) {
    _sportSectionActive = section;

    document.querySelectorAll('.sport-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.section === section);
    });
    document.querySelectorAll('.sport-section').forEach(s => { s.style.display = 'none'; });

    const cible = document.getElementById(`sport-section-${section}`);
    if (cible) cible.style.display = 'block';

    if (section === 'routines') _sportChargerListeRoutines();
}

function _sportSecondesVersMinutes(secondes) {
    if (!Number.isInteger(secondes)) return 0;
    return Math.round(secondes / 60);
}
function _sportMinutesVersSecondes(minutes) {
    if (!Number.isInteger(minutes)) return null;
    return minutes * 60;
}

// ── Modals génériques (réutilisent overlay/modal global) ──
function _sportOuvrirConfirmationSuppression(onConfirm) {
    document.getElementById('overlay').classList.add('on');
    document.body.classList.add('modal-open');
    history.pushState({ modalOpen: true }, '', '');

    document.getElementById('modal-title').textContent = 'Confirmation';
    document.getElementById('modal-body').innerHTML = `
        <p style="color:#333;font-size:15px;margin-bottom:20px;text-align:center">Confirmer la suppression ?</p>
        <div class="modal-actions" style="justify-content:center">
            <button class="btn-delete" id="sport-modal-suppr-oui">Confirmer</button>
            <button class="btn-cancel" id="sport-modal-suppr-non">Annuler</button>
        </div>`;

    document.getElementById('sport-modal-suppr-oui').onclick = async () => { closeModal(); await onConfirm(); };
    document.getElementById('sport-modal-suppr-non').onclick = () => closeModal();
}

function _sportOuvrirModalChoix(titre, texte, libelleOui, libelleNon, onOui, onNon) {
    document.getElementById('overlay').classList.add('on');
    document.body.classList.add('modal-open');
    history.pushState({ modalOpen: true }, '', '');

    document.getElementById('modal-title').textContent = titre;
    document.getElementById('modal-body').innerHTML = `
        <p style="color:#333;font-size:15px;margin-bottom:20px">${texte}</p>
        <div class="modal-actions">
            <button class="btn-save" id="sport-modal-choix-oui">${libelleOui}</button>
            <button class="btn-cancel" id="sport-modal-choix-non">${libelleNon}</button>
        </div>`;

    document.getElementById('sport-modal-choix-oui').onclick = async () => { closeModal(); await onOui(); };
    document.getElementById('sport-modal-choix-non').onclick = async () => { closeModal(); if (onNon) await onNon(); };
}

function _sportOuvrirConfirmationInfo(texte) {
    document.getElementById('overlay').classList.add('on');
    document.body.classList.add('modal-open');
    history.pushState({ modalOpen: true }, '', '');

    document.getElementById('modal-title').textContent = 'Information';
    document.getElementById('modal-body').innerHTML = `
        <p style="color:#333;font-size:15px;margin-bottom:20px">${_sportEchapper(texte)}</p>
        <div class="modal-actions">
            <button class="btn-save" id="sport-modal-info-ok">OK</button>
        </div>`;
    document.getElementById('sport-modal-info-ok').onclick = () => closeModal();
}
