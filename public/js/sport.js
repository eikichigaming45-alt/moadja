// public/js/sport.js
// Module Sport : Dashboard, Mes Routines, Séance en cours.
// Dépend de sport-widget.js chargé AVANT (auth, échappement, formatage, icônes partagées).

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

// ══════════════════════════════════════════════════════════════
// ── MES ROUTINES ──
// ══════════════════════════════════════════════════════════════

let _sportRoutineDetailActive = null; // { workoutId, dayId }

async function _sportChargerListeRoutines() {
    const zone = document.getElementById('sport-routines-zone');
    if (!zone) return;

    zone.innerHTML = `<p class="sport-catalogue-loading">Chargement des routines…</p>`;

    try {
        const r = await fetch('/api/sport/workouts', { headers: _sportAuthHeaders() });
        const d = await r.json();
        if (!d.success) {
            zone.innerHTML = `<p class="sport-catalogue-loading">Erreur lors du chargement des routines.</p>`;
            return;
        }
        _sportRenderListeRoutines(d.workouts);
    } catch (err) {
        console.error('[SPORT] chargerListeRoutines :', err.message);
        zone.innerHTML = `<p class="sport-catalogue-loading">Erreur de connexion au serveur.</p>`;
    }
}

function _sportRenderListeRoutines(routines) {
    const zone = document.getElementById('sport-routines-zone');
    if (!zone) return;

    zone.innerHTML = `
        <div class="sport-card">
            <div class="sport-routine-creation">
                <input type="text" id="sport-routine-nouveau-nom" class="sport-catalogue-search"
                       placeholder="Nom de la nouvelle routine…" autocomplete="off">
                <button class="sport-cta-btn" onclick="_sportCreerRoutine()">+ Créer une routine</button>
            </div>
            <div id="sport-routine-creation-msg" class="sport-routine-msg-erreur"></div>
        </div>

        ${!routines.length ? `
            <div class="sport-card">
                <p class="sport-empty-note">Aucune routine créée pour l'instant.</p>
            </div>
        ` : `
            <div class="sport-routine-liste">
                ${routines.map(w => `
                    <div class="sport-routine-carte" onclick="_sportOuvrirDetailRoutine(${w.id})">
                        <div class="sport-routine-carte-icone">${SPORT_ICONE_DUMBBELL}</div>
                        <div class="sport-routine-carte-info">
                            <div class="sport-routine-carte-nom">${_sportEchapper(w.name)}</div>
                            <div class="sport-routine-carte-meta">Voir les exercices</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `}
    `;

    document.getElementById('sport-routine-nouveau-nom').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _sportCreerRoutine();
    });
}

async function _sportCreerRoutine() {
    const input = document.getElementById('sport-routine-nouveau-nom');
    const msg   = document.getElementById('sport-routine-creation-msg');
    const nom   = input?.value.trim();

    if (!nom) {
        if (msg) msg.textContent = 'Le nom de la routine est obligatoire.';
        return;
    }
    if (msg) msg.textContent = '';

    try {
        const rWorkout = await fetch('/api/sport/workouts', {
            method: 'POST', headers: _sportAuthHeaders(), body: JSON.stringify({ name: nom })
        });
        const dWorkout = await rWorkout.json();
        if (!dWorkout.success) {
            if (msg) msg.textContent = 'Erreur : ' + (dWorkout.message || 'création impossible.');
            return;
        }

        const workoutId = dWorkout.workout.id;
        const rDay = await fetch(`/api/sport/workouts/${workoutId}/days`, {
            method: 'POST', headers: _sportAuthHeaders(),
            body: JSON.stringify({ description: 'Exercices', day_order: 1 })
        });
        const dDay = await rDay.json();
        if (!dDay.success) {
            if (msg) msg.textContent = 'Routine créée, mais erreur d\'initialisation. Contactez le support.';
            return;
        }

        _sportChargerListeRoutines();
    } catch (err) {
        console.error('[SPORT] creerRoutine :', err.message);
        if (msg) msg.textContent = 'Erreur de connexion au serveur.';
    }
}

async function _sportOuvrirDetailRoutine(workoutId) {
    const zone = document.getElementById('sport-routines-zone');
    if (!zone) return;

    zone.innerHTML = `<p class="sport-catalogue-loading">Chargement de la routine…</p>`;

    try {
        const r = await fetch(`/api/sport/workouts/${workoutId}`, { headers: _sportAuthHeaders() });
        const d = await r.json();
        if (!d.success) {
            zone.innerHTML = `<p class="sport-catalogue-loading">Erreur : routine introuvable.</p>`;
            return;
        }

        const workout = d.workout;
        const jour    = workout.days?.[0] || null;
        _sportRoutineDetailActive = { workoutId, dayId: jour?.id || null };
        _sportRenderDetailRoutine(workout, jour);
    } catch (err) {
        console.error('[SPORT] ouvrirDetailRoutine :', err.message);
        zone.innerHTML = `<p class="sport-catalogue-loading">Erreur de connexion au serveur.</p>`;
    }
}

function _sportFormaterMetaExercice(ex) {
    const estDuree = Number.isInteger(ex.target_duration_seconds);
    let base = "";
    if (estDuree) {
        const m = Math.floor(ex.target_duration_seconds / 60);
        const s = ex.target_duration_seconds % 60;
        let temps = "";
        if (m > 0 && s > 0) temps = `${m} min ${s} sec`;
        else if (m > 0) temps = `${m} min`;
        else temps = `${s} sec`;
        base = `${ex.target_sets || 1} séries × ${temps}`;
    } else {
        base = `${ex.target_sets} séries × ${ex.target_reps} reps`;
    }

    if (!estDuree && ex.target_weight_kg != null) base += ` · ${ex.target_weight_kg} kg`;
    if (Number.isInteger(ex.target_rest_seconds)) base += ` · repos ${ex.target_rest_seconds}s`;
    return base;
}

function _sportRenderDetailRoutine(workout, jour) {
    const zone      = document.getElementById('sport-routines-zone');
    const exercices = jour?.exercises || [];

    zone.innerHTML = `
        <div class="sport-card">
            <div class="sport-routine-detail-header">
                <button class="sport-routine-btn-retour" onclick="_sportChargerListeRoutines()">‹ Retour</button>
                <button class="sport-routine-btn-suppr-routine" data-workout-id="${workout.id}">${SPORT_ICONE_POUBELLE} Supprimer la routine</button>
            </div>
            <div class="sport-routine-detail-nom">${_sportEchapper(workout.name)}</div>
            <button class="sport-cta-btn" onclick="_sportDemarrerSeance(${workout.id})">
                                                               ${SPORT_ICONE_DUMBBELL} Commencer la routine
            </button>
        </div>

        <div class="sport-card">
            <div class="sport-section-title">Exercices</div>
            ${!exercices.length ? `
                <p class="sport-empty-note">Aucun exercice dans cette routine pour l'instant.</p>
            ` : `
                <div class="sport-routine-exercices-liste">
                    ${exercices.map(ex => `
                        <div class="sport-routine-exercice-item" id="sport-exercice-${ex.id}" data-exercice-id="${ex.id}" draggable="true">
                            <span class="sport-routine-exercice-drag-handle" title="Glisser pour réordonner">${SPORT_ICONE_POIGNEE}</span>
                            <div class="sport-routine-exercice-info">
                                <div class="sport-routine-exercice-nom">${_sportEchapper(ex.exercise_name)}</div>
                                <div class="sport-routine-exercice-meta">${_sportFormaterMetaExercice(ex)}</div>
                            </div>
                            <button class="sport-routine-exercice-btn-edit" data-exercice-id="${ex.id}"
                                    data-sets="${ex.target_sets || ''}" data-reps="${ex.target_reps || ''}"
                                    data-duree="${Number.isInteger(ex.target_duration_seconds) ? ex.target_duration_seconds : ''}"
                                    data-poids="${ex.target_weight_kg != null ? ex.target_weight_kg : ''}"
                                    data-repos="${Number.isInteger(ex.target_rest_seconds) ? ex.target_rest_seconds : ''}"
                                    data-nom="${_sportEchapper(ex.exercise_name)}" title="Modifier">✏️</button>
                            <button class="sport-routine-exercice-btn-del" data-exercice-id="${ex.id}" title="Supprimer">${SPORT_ICONE_POUBELLE}</button>
                        </div>
                    `).join('')}
                </div>
            `}
            <button class="sport-cta-btn" style="margin-top:16px" onclick="_sportOuvrirSelecteurExercice()">
                + Ajouter un exercice
            </button>
        </div>
    `;

    document.querySelector('.sport-routine-btn-suppr-routine').addEventListener('click', () => {
        _sportConfirmerSuppressionRoutineDetail(workout.id);
    });
    zone.querySelectorAll('.sport-routine-exercice-btn-del').forEach(btn => {
        btn.addEventListener('click', () => {
            _sportConfirmerSuppressionExercice(parseInt(btn.dataset.exerciceId, 10));
        });
    });

    zone.querySelectorAll('.sport-routine-exercice-btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            _sportEditerExercice(
                parseInt(btn.dataset.exerciceId, 10),
                btn.dataset.nom,
                parseInt(btn.dataset.sets, 10),
                parseInt(btn.dataset.reps, 10),
                btn.dataset.duree !== '' ? parseInt(btn.dataset.duree, 10) : null,
                btn.dataset.poids !== '' ? parseFloat(btn.dataset.poids) : null,
                btn.dataset.repos !== '' ? parseInt(btn.dataset.repos, 10) : null
            );
        });
    });

    _sportInitDragAndDropExercices(zone, workout.id);
}

function _sportInitDragAndDropExercices(zone, workoutId) {
    const liste = zone.querySelector('.sport-routine-exercices-liste');
    if (!liste) return;

    let elementGlisse = null;

    liste.querySelectorAll('.sport-routine-exercice-item').forEach(item => {
        item.addEventListener('dragstart', () => {
            elementGlisse = item;
            item.classList.add('sport-exercice-en-glissement');
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('sport-exercice-en-glissement');
            elementGlisse = null;
            _sportSauvegarderOrdreExercices(liste, workoutId);
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!elementGlisse || elementGlisse === item) return;

            const rect = item.getBoundingClientRect();
            const apresMilieu = e.clientY > rect.top + rect.height / 2;

            if (apresMilieu) {
                item.after(elementGlisse);
            } else {
                item.before(elementGlisse);
            }
        });

        const poignee = item.querySelector('.sport-routine-exercice-drag-handle');
        if (poignee) {
            poignee.addEventListener('touchstart', (e) => {
                elementGlisse = item;
                item.classList.add('sport-exercice-en-glissement');
                e.preventDefault();
            }, { passive: false });
        }
    });

    liste.addEventListener('touchmove', (e) => {
        if (!elementGlisse) return;
        e.preventDefault();
        const touch  = e.touches[0];
        const cible  = document.elementFromPoint(touch.clientX, touch.clientY);
        const item   = cible?.closest('.sport-routine-exercice-item');
        if (!item || item === elementGlisse) return;

        const rect = item.getBoundingClientRect();
        const apresMilieu = touch.clientY > rect.top + rect.height / 2;

        if (apresMilieu) {
            item.after(elementGlisse);
        } else {
            item.before(elementGlisse);
        }
    }, { passive: false });

    liste.addEventListener('touchend', () => {
        if (!elementGlisse) return;
        elementGlisse.classList.remove('sport-exercice-en-glissement');
        _sportSauvegarderOrdreExercices(liste, workoutId);
        elementGlisse = null;
    });
}

async function _sportSauvegarderOrdreExercices(liste, workoutId) {
    const ordre = Array.from(liste.querySelectorAll('.sport-routine-exercice-item'))
        .map(item => parseInt(item.dataset.exerciceId, 10));

    if (!_sportRoutineDetailActive?.dayId) return;

    try {
        await fetch(`/api/sport/days/${_sportRoutineDetailActive.dayId}/exercises/reorder`, {
            method : 'PUT',
            headers: _sportAuthHeaders(),
            body   : JSON.stringify({ ordre })
        });
    } catch (err) {
        console.error('[SPORT] sauvegarderOrdreExercices :', err.message);
        _sportOuvrirDetailRoutine(workoutId);
    }
}

function _sportConfirmerSuppressionRoutineDetail(workoutId) {
    _sportOuvrirConfirmationSuppression(async () => {
        try {
            await fetch(`/api/sport/workouts/${workoutId}`, { method: 'DELETE', headers: _sportAuthHeaders() });
            _sportChargerListeRoutines();
        } catch (err) {
            console.error('[SPORT] supprimerRoutineDetail :', err.message);
        }
    });
}

function _sportConfirmerSuppressionExercice(exerciceId) {
    _sportOuvrirConfirmationSuppression(async () => {
        try {
            await fetch(`/api/sport/exercises/${exerciceId}`, { method: 'DELETE', headers: _sportAuthHeaders() });
            _sportOuvrirDetailRoutine(_sportRoutineDetailActive.workoutId);
        } catch (err) {
            console.error('[SPORT] supprimerExercice :', err.message);
        }
    });
}

function _sportEditerExercice(exerciceId, nom, setsActuel, repsActuel, dureeActuelleSecondes, poidsActuel, reposActuelSecondes) {
    const itemEl = document.getElementById(`sport-exercice-${exerciceId}`);
    if (!itemEl) return;

    const estDuree = Number.isInteger(dureeActuelleSecondes);

    itemEl.innerHTML = `
        <div class="sport-routine-exercice-edit">
            <span class="sport-routine-exercice-edit-nom">${_sportEchapper(nom)}</span>
            <div class="sport-routine-exercice-edit-champs">
                <input type="number" id="sport-edit-sets-${exerciceId}" value="${setsActuel || ''}" min="1" placeholder="Séries" style="width: 60px;">
                <span class="sport-edit-icone-x">${SPORT_ICONE_X}</span>
                ${estDuree ? `
                    <input type="number" id="sport-edit-duree-m-${exerciceId}" value="${dureeActuelleSecondes ? Math.floor(dureeActuelleSecondes / 60) : ''}" min="0" placeholder="min" style="width: 60px;">
                    <span>min</span>
                    <input type="number" id="sport-edit-duree-s-${exerciceId}" value="${dureeActuelleSecondes ? dureeActuelleSecondes % 60 : ''}" min="0" max="59" placeholder="sec" style="width: 60px;">
                    <span>sec</span>
                ` : `
                    <input type="number" id="sport-edit-reps-${exerciceId}" value="${repsActuel || ''}" min="1" placeholder="Reps">
                `}
            </div>
            ${!estDuree ? `
            <div class="sport-routine-exercice-edit-champs">
                <input type="number" step="0.5" id="sport-edit-poids-${exerciceId}" value="${poidsActuel ?? ''}" min="0" placeholder="Poids cible">
                <span>kg</span>
            </div>` : ''}
            <div class="sport-routine-exercice-edit-champs">
                <input type="number" id="sport-edit-repos-${exerciceId}" value="${reposActuelSecondes ?? ''}" min="0" placeholder="Repos">
                <span>sec de repos</span>
            </div>
            <div class="sport-routine-exercice-edit-actions">
                <button class="btn-save" id="sport-edit-save-${exerciceId}">Sauvegarder</button>
                <button class="btn-cancel" id="sport-edit-cancel-${exerciceId}">Annuler</button>
            </div>
        </div>`;

    document.getElementById(`sport-edit-cancel-${exerciceId}`).addEventListener('click', () => {
        _sportOuvrirDetailRoutine(_sportRoutineDetailActive.workoutId);
    });

    document.getElementById(`sport-edit-save-${exerciceId}`).addEventListener('click', async () => {
        const body = {};
        body.target_sets = parseInt(document.getElementById(`sport-edit-sets-${exerciceId}`).value, 10) || 1;

        if (estDuree) {
            const m = parseInt(document.getElementById(`sport-edit-duree-m-${exerciceId}`).value, 10) || 0;
            const s = parseInt(document.getElementById(`sport-edit-duree-s-${exerciceId}`).value, 10) || 0;
            body.target_duration_seconds = (m * 60) + s;
        } else {
            body.target_reps = parseInt(document.getElementById(`sport-edit-reps-${exerciceId}`).value, 10) || 1;
            const poidsInput = document.getElementById(`sport-edit-poids-${exerciceId}`).value;
            body.target_weight_kg = poidsInput !== '' ? parseFloat(poidsInput) : null;
        }

        const reposInput = document.getElementById(`sport-edit-repos-${exerciceId}`).value;
        body.target_rest_seconds = reposInput !== '' ? parseInt(reposInput, 10) : 60;

                try {
            await fetch(`/api/sport/exercises/${exerciceId}`, {
                method: 'PUT', headers: _sportAuthHeaders(), body: JSON.stringify(body)
            });
            _sportOuvrirDetailRoutine(_sportRoutineDetailActive.workoutId);
        } catch (err) {
            console.error('[SPORT] editerExercice :', err.message);
        }
    });
}

// ══════════════════════════════════════════════════════════════
// ── SÉLECTEUR D'EXERCICE ──
// ══════════════════════════════════════════════════════════════

let _sportSelecteurOffset       = 0;
let _sportSelecteurPageActuelle = 1;
let _sportSelecteurSearchTimer  = null;
const SPORT_SELECTEUR_LIMIT     = 20;

function _sportOuvrirSelecteurExercice() {
    const zone = document.getElementById('sport-routines-zone');
    if (!zone || !_sportRoutineDetailActive) return;

    _sportSelecteurOffset       = 0;
    _sportSelecteurPageActuelle = 1;

    zone.innerHTML = `
        <div class="sport-card">
            <div class="sport-routine-detail-header">
                <button class="sport-routine-btn-retour" onclick="_sportOuvrirDetailRoutine(${_sportRoutineDetailActive.workoutId})">‹ Retour</button>
            </div>
            <div class="sport-routine-detail-nom">Ajouter un exercice</div>
            <div class="sport-catalogue-toolbar">
                <input type="text" id="sport-selecteur-search" class="sport-catalogue-search"
                       placeholder="Rechercher un exercice…" autocomplete="off">
                <select id="sport-selecteur-filtre-categorie" class="sport-catalogue-select">
                    <option value="">Toutes catégories</option>
                </select>
                <select id="sport-selecteur-filtre-equipement" class="sport-catalogue-select">
                    <option value="">Tout équipement</option>
                </select>
            </div>
            <div id="sport-selecteur-resultats">
                <p class="sport-catalogue-loading">Chargement…</p>
            </div>
            <div id="sport-selecteur-pagination" class="sport-catalogue-pagination" style="display:none">
                <button id="sport-selecteur-prev" class="sport-catalogue-page-btn">Précédent</button>
                <span id="sport-selecteur-page-info" class="sport-catalogue-page-info"></span>
                <button id="sport-selecteur-next" class="sport-catalogue-page-btn">Suivant</button>
            </div>
        </div>
    `;

    document.getElementById('sport-selecteur-search').addEventListener('input', () => {
        clearTimeout(_sportSelecteurSearchTimer);
        _sportSelecteurSearchTimer = setTimeout(() => {
            _sportSelecteurOffset = 0;
            _sportSelecteurPageActuelle = 1;
            _sportRechercherExercicesSelecteur();
        }, 400);
    });

    document.getElementById('sport-selecteur-filtre-categorie').addEventListener('change', () => {
        _sportSelecteurOffset = 0;
        _sportSelecteurPageActuelle = 1;
        _sportRechercherExercicesSelecteur();
    });

    document.getElementById('sport-selecteur-filtre-equipement').addEventListener('change', () => {
        _sportSelecteurOffset = 0;
        _sportSelecteurPageActuelle = 1;
        _sportRechercherExercicesSelecteur();
    });

    document.getElementById('sport-selecteur-prev').addEventListener('click', () => {
        if (_sportSelecteurOffset >= SPORT_SELECTEUR_LIMIT) {
            _sportSelecteurOffset -= SPORT_SELECTEUR_LIMIT;
            _sportSelecteurPageActuelle -= 1;
            _sportRechercherExercicesSelecteur();
        }
    });

    document.getElementById('sport-selecteur-next').addEventListener('click', () => {
        _sportSelecteurOffset += SPORT_SELECTEUR_LIMIT;
        _sportSelecteurPageActuelle += 1;
        _sportRechercherExercicesSelecteur();
    });

    _sportChargerFiltresSelecteur();
    _sportRechercherExercicesSelecteur();
}

async function _sportChargerFiltresSelecteur() {
    try {
        const [rCat, rEqu] = await Promise.all([
            fetch('/api/sport/wger/categories', { headers: _sportAuthHeaders() }),
            fetch('/api/sport/wger/equipment',  { headers: _sportAuthHeaders() })
        ]);
        const dCat = await rCat.json();
        const dEqu = await rEqu.json();

        if (dCat.success) {
            const selCat = document.getElementById('sport-selecteur-filtre-categorie');
            dCat.categories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                selCat.appendChild(opt);
            });
        }
        if (dEqu.success) {
            const selEqu = document.getElementById('sport-selecteur-filtre-equipement');
            dEqu.equipment.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = e.name;
                selEqu.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('[SPORT] chargerFiltresSelecteur :', err.message);
    }
}

async function _sportRechercherExercicesSelecteur() {
    const zone = document.getElementById('sport-selecteur-resultats');
    if (!zone) return;

    const search     = document.getElementById('sport-selecteur-search')?.value.trim() || '';
    const categorie  = document.getElementById('sport-selecteur-filtre-categorie')?.value || '';
    const equipement = document.getElementById('sport-selecteur-filtre-equipement')?.value || '';

    zone.innerHTML = `<p class="sport-catalogue-loading">Recherche en cours…</p>`;

    try {
        const params = new URLSearchParams({
            limit: String(SPORT_SELECTEUR_LIMIT),
            offset: String(_sportSelecteurOffset)
        });
        if (search) params.set('search', search);
        if (categorie) params.set('category', categorie);
        if (equipement) params.set('equipment', equipement);

        const r = await fetch(`/api/sport/wger/exercises?${params.toString()}`, { headers: _sportAuthHeaders() });
        const d = await r.json();

        if (!d.success) {
            zone.innerHTML = `<p class="sport-catalogue-loading">Erreur lors de la récupération des exercices.</p>`;
            return;
        }
        _sportRenderResultatsSelecteur(d.exercises, d.has_more);
    } catch (err) {
        console.error('[SPORT] rechercherExercicesSelecteur :', err.message);
        zone.innerHTML = `<p class="sport-catalogue-loading">Erreur de connexion au serveur.</p>`;
    }
}

function _sportRenderResultatsSelecteur(exercices, hasMore) {
    const zone       = document.getElementById('sport-selecteur-resultats');
    const pagination = document.getElementById('sport-selecteur-pagination');
    if (!zone) return;

    if (!exercices.length) {
        zone.innerHTML = `<p class="sport-catalogue-loading">Aucun exercice trouvé.</p>`;
        if (pagination) pagination.style.display = 'none';
        return;
    }

    zone.innerHTML = `
        <div class="sport-catalogue-grid">
            ${exercices.map((ex, i) => `
                <div class="sport-catalogue-exercise sport-catalogue-exercise-selectionnable" data-index="${i}">
                    ${ex.image
                        ? `<img src="${ex.image}" alt="${_sportEchapper(ex.name)}" class="sport-catalogue-exercise-img">`
                        : `<div class="sport-catalogue-exercise-noimg">${SPORT_ICONE_PAS_IMAGE}</div>`
                    }
                    <div class="sport-catalogue-exercise-name">${_sportEchapper(ex.name)}</div>
                </div>
            `).join('')}
        </div>
    `;

    zone.querySelectorAll('.sport-catalogue-exercise-selectionnable').forEach(el => {
        el.addEventListener('click', () => {
            const ex = exercices[parseInt(el.dataset.index, 10)];
            _sportOuvrirFormulaireAjoutExercice(ex);
        });
    });

    if (pagination) {
        pagination.style.display = 'flex';
        document.getElementById('sport-selecteur-page-info').textContent = `Page ${_sportSelecteurPageActuelle}`;
        document.getElementById('sport-selecteur-prev').disabled = _sportSelecteurOffset === 0;
        document.getElementById('sport-selecteur-next').disabled = !hasMore;
    }
}

function _sportOuvrirFormulaireAjoutExercice(exercice) {
    const zone = document.getElementById('sport-routines-zone');
    if (!zone || !_sportRoutineDetailActive) return;

    const estDuree = exercice.type_suivi === 'duree';

    zone.innerHTML = `
        <div class="sport-card">
            <div class="sport-routine-detail-header">
                <button class="sport-routine-btn-retour" onclick="_sportOuvrirSelecteurExercice()">‹ Retour</button>
            </div>
            <div class="sport-routine-detail-nom">${_sportEchapper(exercice.name)}</div>
            
            <div class="sport-routine-exercice-edit-champs" style="margin:16px 0">
                <input type="number" id="sport-ajout-sets" value="" min="1" placeholder="Séries" style="width: 60px;">
                <span class="sport-edit-icone-x">${SPORT_ICONE_X}</span>
                ${estDuree ? `
                    <input type="number" id="sport-ajout-duree-m" value="" min="0" placeholder="min" style="width: 60px;">
                    <span>min</span>
                    <input type="number" id="sport-ajout-duree-s" value="" min="0" max="59" placeholder="sec" style="width: 60px;">
                    <span>sec</span>
                ` : `
                    <input type="number" id="sport-ajout-reps" value="" min="1" placeholder="Reps">
                `}
            </div>

            ${!estDuree ? `
            <div class="sport-routine-exercice-edit-champs" style="margin:0 0 16px">
                <input type="number" step="0.5" id="sport-ajout-poids" min="0" placeholder="Poids cible (optionnel)">
                <span>kg</span>
            </div>` : ''}

            <div class="sport-routine-exercice-edit-champs" style="margin:0 0 16px">
                <input type="number" id="sport-ajout-repos" value="" min="0" placeholder="Repos">
                <span>sec de repos</span>
            </div>
            <div id="sport-ajout-msg" class="sport-routine-msg-erreur"></div>
            <button class="sport-cta-btn" onclick="_sportValiderAjoutExercice(${exercice.wger_exercise_id}, '${_sportEchapperJs(exercice.name)}', ${estDuree})">
                Ajouter à la routine
            </button>
        </div>
    `;
}

function _sportEchapperJs(str) {
    return (str || '').replace(/'/g, "\\'");
}

async function _sportValiderAjoutExercice(wgerExerciseId, exerciseName, estDuree) {
    const msg = document.getElementById('sport-ajout-msg');

    if (!_sportRoutineDetailActive?.dayId) {
        if (msg) msg.textContent = 'Erreur : routine mal initialisée.';
        return;
    }

    const body = { wger_exercise_id: wgerExerciseId, exercise_name: exerciseName };
    body.target_sets = parseInt(document.getElementById('sport-ajout-sets').value, 10) || 1;

    if (estDuree) {
        const m = parseInt(document.getElementById('sport-ajout-duree-m').value, 10) || 0;
        const s = parseInt(document.getElementById('sport-ajout-duree-s').value, 10) || 0;
        body.target_duration_seconds = (m * 60) + s;
    } else {
        body.target_reps = parseInt(document.getElementById('sport-ajout-reps').value, 10) || 1;
        const poidsInput = document.getElementById('sport-ajout-poids').value;
        body.target_weight_kg = poidsInput !== '' ? parseFloat(poidsInput) : null;
    }

    const reposInput = document.getElementById('sport-ajout-repos').value;
    body.target_rest_seconds = reposInput !== '' ? parseInt(reposInput, 10) : 60;

    try {
        const r = await fetch(`/api/sport/days/${_sportRoutineDetailActive.dayId}/exercises`, {
            method: 'POST', headers: _sportAuthHeaders(), body: JSON.stringify(body)
        });
                const d = await r.json();

        if (!d.success) {
            if (msg) msg.textContent = 'Erreur : ' + (d.message || 'ajout impossible.');
            return;
        }
        _sportOuvrirDetailRoutine(_sportRoutineDetailActive.workoutId);
    } catch (err) {
        console.error('[SPORT] validerAjoutExercice :', err.message);
        if (msg) msg.textContent = 'Erreur de connexion au serveur.';
    }
}

// ══════════════════════════════════════════════════════════════
// ── SÉANCE EN COURS ──
// ══════════════════════════════════════════════════════════════

let _sportSeanceActive         = null; // { id, workout_id, logs: [...] }
let _sportSeanceExercices      = [];   // liste des exercices de la routine
let _sportSeanceChronoInterval = null;
let _sportSeanceReposInterval  = null;
let _sportSeryTimers           = {};   // Stockage des chronos individuels (exercices en durée)

async function _sportInitVerifSeanceActive() {
    try {
        const r = await fetch('/api/sport/sessions/active', { headers: _sportAuthHeaders() });
        const d = await r.json();
        if (d.success && d.session) {
            _sportAfficherBandeauReprise(d.session);
        }
    } catch (err) {
        console.error('[SPORT] initVerifSeanceActive :', err.message);
    }
}

function _sportAfficherBandeauReprise(session) {
    const zone = document.getElementById('sport-section-dashboard');
    if (!zone) return;

    const bandeau = document.createElement('div');
    bandeau.className = 'sport-card sport-bandeau-reprise';
    bandeau.innerHTML = `
        <div class="sport-bandeau-reprise-texte">Une séance est en cours depuis ${_sportFormatDateCourte(session.date_start)}.</div>
        <button class="sport-cta-btn" id="sport-btn-reprendre-seance">Reprendre la séance</button>
    `;
    zone.prepend(bandeau);

    document.getElementById('sport-btn-reprendre-seance').addEventListener('click', () => {
        _sportReprendreSeance(session);
    });
}

async function _sportReprendreSeance(session) {
    if (!session.workout_id) {
        _sportOuvrirConfirmationInfo('Cette séance n\'est pas liée à une routine, reprise impossible.');
        return;
    }
    try {
        const r = await fetch(`/api/sport/workouts/${session.workout_id}`, { headers: _sportAuthHeaders() });
        const d = await r.json();
        if (!d.success) {
            _sportOuvrirConfirmationInfo('Routine introuvable pour cette séance.');
            return;
        }

        const jour = d.workout.days?.[0];
        _sportSeanceExercices = jour?.exercises || [];
        _sportSeanceActive    = session;

        await _sportDemanderWakeLock();
        _sportRenderEcranSeance();
    } catch (err) {
        console.error('[SPORT] reprendreSeance :', err.message);
    }
}

async function _sportDemarrerSeance(workoutId) {
    try {
        const r = await fetch('/api/sport/sessions', {
            method: 'POST', headers: _sportAuthHeaders(), body: JSON.stringify({ workout_id: workoutId })
        });
        const d = await r.json();
        if (!d.success) {
            _sportOuvrirConfirmationInfo('Erreur : impossible de démarrer la séance.');
            return;
        }

        const rWorkout = await fetch(`/api/sport/workouts/${workoutId}`, { headers: _sportAuthHeaders() });
        const dWorkout = await rWorkout.json();
        if (!dWorkout.success) {
            _sportOuvrirConfirmationInfo('Erreur : routine introuvable.');
            return;
        }

        const jour = dWorkout.workout.days?.[0];
        _sportSeanceExercices    = jour?.exercises || [];
        _sportSeanceActive       = { ...d.session, logs: [] };

        if (!_sportSeanceExercices.length) {
            _sportOuvrirConfirmationInfo('Cette routine ne contient aucun exercice.');
            return;
        }

        await _sportDemanderWakeLock();
        _sportRenderEcranSeance();
    } catch (err) {
        console.error('[SPORT] demarrerSeance :', err.message);
    }
}

function _sportRenderEcranSeance() {
    const zoneGlobale = document.getElementById('grid-sport');
    if (!zoneGlobale || !_sportSeanceExercices.length) return;

    clearInterval(_sportSeanceChronoInterval);
    _sportSeryTimers = {};
    _sportSeanceChronoInterval = setInterval(_sportMettreAJourChronoSeance, 1000);

    zoneGlobale.innerHTML = `
        <div class="sport-wrap">
            <div class="sport-card">
                <div class="sport-seance-header-top">
                    <span id="sport-seance-chrono" class="sport-seance-nom">00:00</span>
                    <button class="sport-seance-btn-abandon" id="sport-seance-btn-terminer">Terminer</button>
                </div>
                <div id="sport-seance-repos-zone"></div>
                <div id="sport-seance-contenu"></div>
            </div>
        </div>
    `;

    document.getElementById('sport-seance-btn-terminer').addEventListener('click', _sportConfirmerFinSeance);

    _sportRenderTousLesExercices();
}

function _sportMettreAJourChronoSeance() {
    const el = document.getElementById('sport-seance-chrono');
    if (!el || !_sportSeanceActive) return;
    const secondes = Math.max(0, Math.round((Date.now() - new Date(_sportSeanceActive.date_start).getTime()) / 1000));
    el.textContent = _sportFormatChrono(secondes);
}

function _sportFormatChrono(secondes) {
    const absSec = Math.abs(secondes);
    const h = Math.floor(absSec / 3600);
    const m = Math.floor((absSec % 3600) / 60);
    const s = absSec % 60;
    const pad = n => String(n).padStart(2, '0');
    const prefix = secondes < 0 ? '+' : '';
    return h > 0 ? `${prefix}${h}:${pad(m)}:${pad(s)}` : `${prefix}${pad(m)}:${pad(s)}`;
}

function _sportRenderTousLesExercices() {
    const zone = document.getElementById('sport-seance-contenu');
    if (!zone) return;

    let html = '';

    _sportSeanceExercices.forEach((ex, index) => {
        const estDuree = Number.isInteger(ex.target_duration_seconds);
        const logsExerciceExistants = (_sportSeanceActive.logs || []).filter(l => l.wger_exercise_id === ex.wger_exercise_id);

        html += `
            <div class="sport-seance-exercice-bloc" style="margin-top: 24px; padding-bottom: 16px; border-bottom: 1px solid #f0f0f0;">
                <div class="sport-seance-exercice-nom" style="margin-bottom: 12px; font-size: 16px;">${_sportEchapper(ex.exercise_name)}</div>
                ${estDuree ? _sportRenderFormulaireDuree(ex, logsExerciceExistants, index) : _sportRenderFormulaireSeries(ex, logsExerciceExistants, index)}
            </div>
        `;
    });

    zone.innerHTML = html;
    _sportBrancherValidationTousExercices();
}

function _sportRenderFormulaireSeries(ex, logsExistants, exIndex) {
    const lignes = [];
    for (let i = 1; i <= ex.target_sets; i++) {
        const logExistant = logsExistants.find(l => l.set_number === i);
        lignes.push({ numero: i, log: logExistant || null });
    }

    return `
        <div class="sport-seance-table">
            <div class="sport-seance-table-header" style="grid-template-columns: 40px 1fr 1fr 40px">
                <span>Série</span><span>Poids (kg)</span><span>Reps</span><span></span>
            </div>
            ${lignes.map(l => `
                <div class="sport-seance-table-row ${l.log?.completed ? 'sport-seance-row-validee' : ''}" style="grid-template-columns: 40px 1fr 1fr 40px">
                    <span class="sport-seance-serie-numero">${l.numero}</span>
                    <input type="number" step="0.5" class="sport-seance-input" id="sport-serie-poids-${exIndex}-${l.numero}"
                           value="${l.log?.weight_kg ?? ex.target_weight_kg ?? ''}" placeholder="kg" ${l.log?.completed ? 'disabled' : ''}>
                    <input type="number" class="sport-seance-input" id="sport-serie-reps-${exIndex}-${l.numero}"
                           value="${l.log?.reps ?? ex.target_reps ?? ''}" placeholder="reps" ${l.log?.completed ? 'disabled' : ''}>
                    <button class="sport-seance-check-btn ${l.log?.completed ? 'active' : ''}"
                            id="sport-serie-check-${exIndex}-${l.numero}" ${l.log?.completed ? 'disabled' : ''}>${SPORT_ICONE_CHECK}</button>
                </div>
            `).join('')}
        </div>
    `;
}

function _sportJouerAlerteObjectif() {
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
    }
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
        console.error("[SPORT] Erreur WebAudio:", e);
    }
}

function _sportToggleTimerSerie(exIndex, setNumber, targetSeconds) {
    const key = `${exIndex}-${setNumber}`;
    const btnPlayStop = document.getElementById(`sport-duree-playstop-${key}`);
    const inputsZone  = document.getElementById(`sport-duree-inputs-${key}`);
    const chronoZone  = document.getElementById(`sport-duree-chronotext-${key}`);

    if (_sportSeryTimers[key] && _sportSeryTimers[key].active) {
        clearInterval(_sportSeryTimers[key].interval);
        _sportSeryTimers[key].active = false;

        const elapsedSecs = Math.floor((Date.now() - _sportSeryTimers[key].startTime) / 1000);

        document.getElementById(`sport-duree-m-${exIndex}-${setNumber}`).value = Math.floor(elapsedSecs / 60);
        document.getElementById(`sport-duree-s-${exIndex}-${setNumber}`).value = elapsedSecs % 60;

        chronoZone.style.display = 'none';
        inputsZone.style.display = 'flex';
        btnPlayStop.innerHTML = '▶️';
        btnPlayStop.style.background = '';
        btnPlayStop.style.color = '';
    } else {
        const now = Date.now();
        _sportSeryTimers[key] = {
            active: true,
            startTime: now,
            targetSeconds: targetSeconds,
            alertPlayed: false,
            interval: setInterval(() => {
                const elapsed = Math.floor((Date.now() - _sportSeryTimers[key].startTime) / 1000);
                const remaining = targetSeconds - elapsed;

                if (remaining <= 0 && !_sportSeryTimers[key].alertPlayed) {
                    _sportJouerAlerteObjectif();
                    _sportSeryTimers[key].alertPlayed = true;
                }

                chronoZone.textContent = _sportFormatChrono(remaining);
                chronoZone.style.color = remaining < 0 ? '#ef4444' : 'var(--text-main)';
            }, 500)
        };

        inputsZone.style.display = 'none';
        chronoZone.style.display = 'block';
        chronoZone.textContent = _sportFormatChrono(targetSeconds);
        chronoZone.style.color = 'var(--text-main)';

                btnPlayStop.innerHTML = '⏹️';
        btnPlayStop.style.background = 'rgba(239, 68, 68, 0.1)';
        btnPlayStop.style.color = '#ef4444';
        btnPlayStop.style.borderRadius = '50%';
        btnPlayStop.style.border = '1px solid rgba(239, 68, 68, 0.4)';
    }
}

function _sportRenderFormulaireDuree(ex, logsExistants, exIndex) {
    const lignes = [];
    const nbSets = ex.target_sets || 1;

    for (let i = 1; i <= nbSets; i++) {
        const logExistant = logsExistants.find(l => l.set_number === i);
        lignes.push({ numero: i, log: logExistant || null });
    }

    return `
        <div class="sport-seance-table">
            <div class="sport-seance-table-header" style="grid-template-columns: 40px 1fr 34px 40px">
                <span>Série</span><span style="text-align:center">Temps (m:s)</span><span></span><span></span>
            </div>
            ${lignes.map(l => {
                const totalSec = l.log ? l.log.duration_seconds : ex.target_duration_seconds;
                const m = Math.floor(totalSec / 60);
                const s = totalSec % 60;
                const isCompleted = !!l.log?.completed;

                return `
                <div class="sport-seance-table-row ${isCompleted ? 'sport-seance-row-validee' : ''}" style="grid-template-columns: 40px 1fr 34px 40px; align-items:center;">
                    <span class="sport-seance-serie-numero">${l.numero}</span>

                    <div style="display:flex; justify-content:center; align-items:center; width:100%; position:relative; min-height: 28px;">
                        <div id="sport-duree-inputs-${exIndex}-${l.numero}" style="display:flex; gap:4px; width:100%;">
                            <input type="number" class="sport-seance-input" id="sport-duree-m-${exIndex}-${l.numero}"
                                   value="${totalSec > 0 ? m : ''}" placeholder="m" ${isCompleted ? 'disabled' : ''}>
                            <input type="number" class="sport-seance-input" id="sport-duree-s-${exIndex}-${l.numero}"
                                   value="${totalSec > 0 ? s : ''}" placeholder="s" ${isCompleted ? 'disabled' : ''}>
                        </div>
                        <div id="sport-duree-chronotext-${exIndex}-${l.numero}" style="display:none; font-size:15px; font-weight:800; font-variant-numeric: tabular-nums;">
                            00:00
                        </div>
                    </div>

                    <button class="sport-seance-check-btn" style="border-radius:8px; font-size:14px; width:28px; height:28px;"
                            id="sport-duree-playstop-${exIndex}-${l.numero}" ${isCompleted ? 'disabled style="opacity:0.3"' : ''}>▶️</button>

                    <button class="sport-seance-check-btn ${isCompleted ? 'active' : ''}"
                            id="sport-duree-check-${exIndex}-${l.numero}" ${isCompleted ? 'disabled' : ''}>${SPORT_ICONE_CHECK}</button>
                </div>
                `;
            }).join('')}
        </div>

        <div style="display: flex; gap: 8px; margin-top: 12px;">
            <input type="number" step="0.1" class="sport-seance-input" id="sport-duree-distance-${exIndex}" value="${logsExistants[0]?.distance_km || ''}" placeholder="Dist. (km)">
            <input type="number" step="0.1" class="sport-seance-input" id="sport-duree-vitesse-${exIndex}" value="${logsExistants[0]?.speed_kmh || ''}" placeholder="Vit. (km/h)">
            <input type="number" step="0.1" class="sport-seance-input" id="sport-duree-inclinaison-${exIndex}" value="${logsExistants[0]?.incline_percent || ''}" placeholder="Incl. (%)">
        </div>
    `;
}

function _sportBrancherValidationTousExercices() {
    _sportSeanceExercices.forEach((ex, index) => {
        const nbSets = ex.target_sets || 1;

        if (Number.isInteger(ex.target_duration_seconds)) {
            for (let i = 1; i <= nbSets; i++) {
                document.getElementById(`sport-duree-playstop-${index}-${i}`)?.addEventListener('click', () => {
                    _sportToggleTimerSerie(index, i, ex.target_duration_seconds);
                });
                document.getElementById(`sport-duree-check-${index}-${i}`)?.addEventListener('click', () => _sportValiderLogDuree(ex, i, index));
            }
        } else {
            for (let i = 1; i <= nbSets; i++) {
                document.getElementById(`sport-serie-check-${index}-${i}`)?.addEventListener('click', () => _sportValiderLogSerie(ex, i, index));
            }
        }
    });
}

async function _sportValiderLogSerie(ex, setNumber, exIndex) {
    const poids = parseFloat(document.getElementById(`sport-serie-poids-${exIndex}-${setNumber}`).value) || null;
    const reps  = parseInt(document.getElementById(`sport-serie-reps-${exIndex}-${setNumber}`).value, 10) || null;

    try {
        const r = await fetch(`/api/sport/sessions/${_sportSeanceActive.id}/logs`, {
            method: 'POST', headers: _sportAuthHeaders(),
            body: JSON.stringify({
                wger_exercise_id: ex.wger_exercise_id, exercise_name: ex.exercise_name,
                set_number: setNumber, reps, weight_kg: poids, completed: true,
                rest_seconds: ex.target_rest_seconds || 60
            })
        });
        const d = await r.json();
        if (d.success) {
            _sportSeanceActive.logs.push(d.log);
            _sportLancerReposEntreSeries(ex.target_rest_seconds || 60);
            _sportRenderTousLesExercices();
        }
    } catch (err) {
        console.error('[SPORT] validerLogSerie :', err.message);
    }
}

async function _sportValiderLogDuree(ex, setNumber, exIndex) {
    const key = `${exIndex}-${setNumber}`;
    if (_sportSeryTimers[key] && _sportSeryTimers[key].active) {
        _sportToggleTimerSerie(exIndex, setNumber, ex.target_duration_seconds);
    }

    const m = parseInt(document.getElementById(`sport-duree-m-${exIndex}-${setNumber}`).value, 10) || 0;
    const s = parseInt(document.getElementById(`sport-duree-s-${exIndex}-${setNumber}`).value, 10) || 0;

    const distance = document.getElementById(`sport-duree-distance-${exIndex}`)?.value;
    const vitesse = document.getElementById(`sport-duree-vitesse-${exIndex}`)?.value;
    const inclinaison = document.getElementById(`sport-duree-inclinaison-${exIndex}`)?.value;

    try {
        const r = await fetch(`/api/sport/sessions/${_sportSeanceActive.id}/logs`, {
            method: 'POST', headers: _sportAuthHeaders(),
            body: JSON.stringify({
                wger_exercise_id: ex.wger_exercise_id, exercise_name: ex.exercise_name,
                set_number: setNumber, completed: true,
                duration_seconds: (m * 60) + s,
                                distance_km: distance !== '' && distance !== undefined ? parseFloat(distance) : null,
                speed_kmh: vitesse !== '' && vitesse !== undefined ? parseFloat(vitesse) : null,
                incline_percent: inclinaison !== '' && inclinaison !== undefined ? parseFloat(inclinaison) : null,
                rest_seconds: ex.target_rest_seconds || 60
            })
        });
        const d = await r.json();
        if (d.success) {
            _sportSeanceActive.logs.push(d.log);
            _sportLancerReposEntreSeries(ex.target_rest_seconds || 60);
            _sportRenderTousLesExercices();
        }
    } catch (err) {
        console.error('[SPORT] validerLogDuree :', err.message);
    }
}

function _sportLancerReposEntreSeries(secondesRepos) {
    const zone = document.getElementById('sport-seance-repos-zone');
    if (!zone || !secondesRepos) return;

    clearInterval(_sportSeanceReposInterval);
    let restant = secondesRepos;

    zone.innerHTML = `
        <div class="sport-seance-repos-ligne" style="margin-top: 16px; padding: 12px; background: #eef2ff; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span class="sport-seance-repos-label" style="font-weight: 600; color: #4f46e5;">Temps de repos</span>
            <span class="sport-seance-repos-chrono" id="sport-repos-badge" style="font-size: 18px; font-weight: 700; color: #4f46e5;">${_sportFormatChrono(restant)}</span>
        </div>
    `;

    _sportSeanceReposInterval = setInterval(() => {
        restant--;
        const badge = document.getElementById('sport-repos-badge');
        if (!badge) { clearInterval(_sportSeanceReposInterval); return; }
        if (restant <= 0) {
            clearInterval(_sportSeanceReposInterval);
            zone.innerHTML = '';
            return;
        }
        badge.textContent = _sportFormatChrono(restant);
    }, 1000);
}

function _sportConfirmerFinSeance() {
    _sportOuvrirModalChoix(
        'Terminer la séance',
        'Voulez-vous terminer cette séance (elle sera enregistrée) ou l\'abandonner (elle ne sera pas enregistrée) ?',
        'Terminer',
        'Abandonner',
        () => _sportCloturerSeance('completed'),
        () => _sportCloturerSeance('abandoned')
    );
}

async function _sportCloturerSeance(status) {
    clearInterval(_sportSeanceChronoInterval);
    clearInterval(_sportSeanceReposInterval);

    Object.values(_sportSeryTimers).forEach(timer => clearInterval(timer.interval));
    _sportSeryTimers = {};

    try {
        if (status === 'abandoned') {
            await fetch(`/api/sport/sessions/${_sportSeanceActive.id}`, {
                method: 'DELETE', headers: _sportAuthHeaders()
            });
        } else {
            await fetch(`/api/sport/sessions/${_sportSeanceActive.id}`, {
                method: 'PUT', headers: _sportAuthHeaders(), body: JSON.stringify({ status })
            });
        }
    } catch (err) {
        console.error('[SPORT] cloturerSeance :', err.message);
    }

    _sportSeanceActive       = null;
    _sportSeanceExercices    = [];

    _sportRelacherWakeLock();

    chargerSportDashboard();
    if (typeof chargerSportStatsWidget === 'function') chargerSportStatsWidget();
}
