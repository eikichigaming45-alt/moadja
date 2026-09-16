// public/js/sport.js
// Module Sport : socle commun — icônes/constantes partagées entre les
// sous-modules, Dashboard, Wake Lock, cartes de récapitulatif de séance,
// changement de section, modales génériques (confirmation/choix/info).
// Dépend de sport-widget.js chargé AVANT (auth, échappement, formatage,
// icônes communes).
// Les sous-modules Mes Routines / Sélecteur d'exercice / Séance en cours
// ont été extraits respectivement dans sportRoutines.js, sportSelecteur.js
// et sportSeance.js (chargés APRÈS ce fichier, voir index.html).

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

const SPORT_MAX_EXERCICES_APERCU = 5;

// Exercices "duree" pour lesquels les champs Distance/Vitesse/Inclinaison
// ont un sens (vrai cardio). Doit correspondre aux entrées `cardio: true`
// de routes/sport-traduction-fr.js (noms FR traduits, tels que stockés en base).
const SPORT_NOMS_EXERCICES_CARDIO = new Set([
    'Cyclisme', 'Jogging', 'Course à pied', 'Course fractionnée', 'Course sur tapis',
    'Course endurance', 'Natation (sprints 50m)', 'Vélo elliptique', 'Rameur',
    'Marche', 'Séance cardio vélo', 'Vélo RPM'
]);

let _sportSectionActive = 'dashboard';

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
        zone.innerHTML = _sportRenderDashboard(d.success ? (d.dernieres_seances || []) : []);
    } catch (err) {
        console.error('[SPORT] chargerDashboardStats :', err.message);
        zone.innerHTML = _sportRenderDashboard([]);
    }

    zone.querySelectorAll('.sport-seance-recap-btn-suppr').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            _sportConfirmerSuppressionSeanceDashboard(parseInt(btn.dataset.sessionId, 10));
        });
    });
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

function _sportRenderDashboard(dernieresSeances) {
    const aDesSeances = dernieresSeances && dernieresSeances.length > 0;

    return `
        <div class="sport-card">
            <div class="sport-empty-state">
                <div class="sport-empty-icon">${SPORT_ICONE_DUMBBELL}</div>
                ${aDesSeances ? `
                    <div class="sport-empty-title">Prêt pour une nouvelle séance ?</div>
                ` : `
                    <div class="sport-empty-title">Aucune séance cette semaine</div>
                    <div class="sport-empty-text">
                        Prêt à commencer ? Créez votre première routine pour suivre vos entraînements
                        et voir votre progression au fil du temps.
                    </div>
                `}
                <button class="sport-cta-btn" onclick="_sportSwitchSection('routines')">
                    ${SPORT_ICONE_DUMBBELL} Commencer une séance
                </button>
            </div>
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

// ── Carte de récapitulatif de séance ──
function _sportRenderCarteSeanceRecap(s) {
    const dateTexte    = _sportFormatDateCourte(s.date_end || s.date_start);
    const exercices    = s.exercices || [];
    const apercu       = exercices.slice(0, SPORT_MAX_EXERCICES_APERCU);
    const reste        = exercices.length - apercu.length;
    const nbRecords    = Number.isInteger(s.nb_records) ? s.nb_records : 0;

    return `
        <div class="sport-card sport-seance-carte-recap" id="sport-seance-carte-${s.id}">
            <div class="sport-seance-recap-header">
                <span class="sport-seance-recap-icone">${SPORT_ICONE_DUMBBELL}</span>
                <div class="sport-seance-recap-header-info">
                    <div class="sport-seance-recap-titre">${_sportEchapper(s.workout_name)}</div>
                    <div class="sport-seance-recap-date">${dateTexte}</div>
                </div>
                <button class="sport-seance-recap-btn-suppr" data-session-id="${s.id}" title="Supprimer la séance">${SPORT_ICONE_POUBELLE}</button>
            </div>

            <div class="sport-seance-recap-stats">
                <div class="sport-seance-recap-stat">
                    <span class="sport-seance-recap-stat-label">Durée</span>
                    <span class="sport-seance-recap-stat-val">${_sportFormatDureeLongue(s.dureeSecondes)}</span>
                </div>
                <div class="sport-seance-recap-stat">
                    <span class="sport-seance-recap-stat-label">Volume</span>
                    <span class="sport-seance-recap-stat-val">${s.volumeKg} kg</span>
                </div>
                <div class="sport-seance-recap-stat">
                    <span class="sport-seance-recap-stat-label">Records</span>
                    <span class="sport-seance-recap-stat-val">
                        ${nbRecords}${nbRecords > 0 ? ` ${SPORT_ICONE_TROPHEE}` : ''}
                    </span>
                </div>
            </div>

            ${apercu.length ? `
                <div class="sport-seance-recap-liste">
                    ${apercu.map(e => `
                        <div class="sport-seance-recap-ligne">
                            <span class="sport-seance-recap-ligne-nb">${e.nb_series}x</span>
                            <span class="sport-seance-recap-ligne-nom">${_sportEchapper(e.exercise_name)}</span>
                        </div>
                    `).join('')}
                    ${reste > 0 ? `<div class="sport-seance-recap-reste">…et ${reste} autre${reste > 1 ? 's' : ''} exercice${reste > 1 ? 's' : ''}</div>` : ''}
                </div>
            ` : ''}
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
