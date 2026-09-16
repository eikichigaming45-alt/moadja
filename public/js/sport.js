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

const SPORT_ICONE_POUBELLE = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
        <path d="M10 11v6"></path>
        <path d="M14 11v6"></path>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
    </svg>
`;

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
// ── SÉLECTEUR D'EXERCICE (catalogue) ──
// ══════════════════════════════════════════════════════════════

let _sportCatalogueExercices = null;

async function _sportOuvrirSelecteurExercice() {
    document.getElementById('overlay').classList.add('on');
    document.body.classList.add('modal-open');
    history.pushState({ modalOpen: true }, '', '');

    document.getElementById('modal-title').textContent = 'Ajouter un exercice';
    document.getElementById('modal-body').innerHTML = `
        <input type="text" id="sport-catalogue-search" class="sport-catalogue-search"
               placeholder="Rechercher un exercice…" autocomplete="off">
        <div id="sport-catalogue-liste" class="sport-catalogue-liste">
            <p class="sport-catalogue-loading">Chargement…</p>
        </div>
    `;

    document.getElementById('sport-catalogue-search').addEventListener('input', (e) => {
        _sportRenderCatalogueFiltre(e.target.value);
    });

    if (_sportCatalogueExercices === null) {
        try {
            const r = await fetch('/api/sport/exercises-catalogue', { headers: _sportAuthHeaders() });
            const d = await r.json();
            _sportCatalogueExercices = d.success ? d.exercises : [];
        } catch (err) {
            console.error('[SPORT] chargerCatalogue :', err.message);
            _sportCatalogueExercices = [];
        }
    }
    _sportRenderCatalogueFiltre('');
}

function _sportRenderCatalogueFiltre(recherche) {
    const zone = document.getElementById('sport-catalogue-liste');
    if (!zone) return;

    const r = recherche.trim().toLowerCase();
    const filtres = !r ? _sportCatalogueExercices
        : _sportCatalogueExercices.filter(ex => ex.name.toLowerCase().includes(r));

    if (!filtres.length) {
        zone.innerHTML = `<p class="sport-catalogue-loading">Aucun exercice trouvé.</p>`;
        return;
    }

    zone.innerHTML = filtres.map(ex => `
        <div class="sport-catalogue-item" data-exercice-id="${ex.id}" data-exercice-nom="${_sportEchapper(ex.name)}" data-est-duree="${ex.is_duration_based ? '1' : '0'}">
            <span class="sport-catalogue-item-nom">${_sportEchapper(ex.name)}</span>
            <span class="sport-catalogue-item-muscle">${_sportEchapper(ex.muscle_group || '')}</span>
        </div>
    `).join('');

    zone.querySelectorAll('.sport-catalogue-item').forEach(item => {
        item.addEventListener('click', () => {
            _sportOuvrirFormulaireAjoutExercice(
                parseInt(item.dataset.exerciceId, 10),
                item.dataset.exerciceNom,
                item.dataset.estDuree === '1'
            );
        });
    });
}

function _sportOuvrirFormulaireAjoutExercice(exerciceId, nom, estDuree) {
    document.getElementById('modal-title').textContent = _sportEchapper(nom);
    document.getElementById('modal-body').innerHTML = `
        <div class="sport-ajout-exercice-form">
            <label>Nombre de séries</label>
            <input type="number" id="sport-ajout-sets" min="1" value="3">

            ${estDuree ? `
                <label>Durée cible</label>
                <div class="sport-routine-exercice-edit-champs">
                    <input type="number" id="sport-ajout-duree-m" min="0" value="0" placeholder="min">
                    <span>min</span>
                    <input type="number" id="sport-ajout-duree-s" min="0" max="59" value="30" placeholder="sec">
                    <span>sec</span>
                </div>
            ` : `
                <label>Répétitions par série</label>
                <input type="number" id="sport-ajout-reps" min="1" value="10">

                <label>Poids cible (kg) — optionnel</label>
                <input type="number" step="0.5" id="sport-ajout-poids" min="0" placeholder="Ex: 20">
            `}

            <label>Repos entre séries (sec)</label>
            <input type="number" id="sport-ajout-repos" min="0" value="60">

            <div class="modal-actions" style="margin-top:20px">
                <button class="btn-save" id="sport-ajout-confirmer">Ajouter</button>
                <button class="btn-cancel" id="sport-ajout-annuler">Annuler</button>
            </div>
        </div>
    `;

    document.getElementById('sport-ajout-annuler').addEventListener('click', () => closeModal());

    document.getElementById('sport-ajout-confirmer').addEventListener('click', async () => {
        const body = {
            exercise_id : exerciceId,
            target_sets : parseInt(document.getElementById('sport-ajout-sets').value, 10) || 1,
            target_rest_seconds: parseInt(document.getElementById('sport-ajout-repos').value, 10) || 60
        };

        if (estDuree) {
            const m = parseInt(document.getElementById('sport-ajout-duree-m').value, 10) || 0;
            const s = parseInt(document.getElementById('sport-ajout-duree-s').value, 10) || 0;
            body.target_duration_seconds = (m * 60) + s;
        } else {
            body.target_reps = parseInt(document.getElementById('sport-ajout-reps').value, 10) || 1;
            const poidsInput = document.getElementById('sport-ajout-poids').value;
            body.target_weight_kg = poidsInput !== '' ? parseFloat(poidsInput) : null;
        }

               try {
            await fetch(`/api/sport/days/${_sportRoutineDetailActive.dayId}/exercises`, {
                method: 'POST', headers: _sportAuthHeaders(), body: JSON.stringify(body)
            });
            closeModal();
            _sportOuvrirDetailRoutine(_sportRoutineDetailActive.workoutId);
        } catch (err) {
            console.error('[SPORT] ajouterExerciceRoutine :', err.message);
        }
    });
}

// ══════════════════════════════════════════════════════════════
// ── SÉANCE EN COURS ──
// ══════════════════════════════════════════════════════════════

let _sportSeanceActive       = null;   // { sessionId, workoutName, exercices: [...], chronoDebut }
let _sportSeanceChronoInterval = null;
let _sportReposInterval        = null;
let _sportTimerActifInterval   = null; // timer play/stop d'un exercice de durée
let _sportTimerActifState      = null; // { exerciceId, serieIndex, cible, ecoule, audioCtx }

async function _sportDemarrerSeance(workoutId) {
    try {
        const r = await fetch(`/api/sport/workouts/${workoutId}/start`, {
            method: 'POST', headers: _sportAuthHeaders()
        });
        const d = await r.json();
        if (!d.success) {
            _sportOuvrirConfirmationInfo(d.message || "Impossible de démarrer la séance.");
            return;
        }

        _sportSeanceActive = {
            sessionId  : d.session.id,
            workoutName: d.session.workout_name,
            chronoDebut: Date.now(),
            exercices  : d.session.exercices.map(ex => ({
                ...ex,
                series: ex.series.map(s => ({ ...s, valide: false }))
            }))
        };

        await _sportDemanderWakeLock();
        _sportAfficherEcranSeance();
    } catch (err) {
        console.error('[SPORT] demarrerSeance :', err.message);
        _sportOuvrirConfirmationInfo("Erreur de connexion au serveur.");
    }
}

function _sportAfficherEcranSeance() {
    const zone = document.getElementById('grid-sport');
    if (!zone) return;

    zone.innerHTML = `<div id="sport-seance-ecran"></div>`;
    _sportRenderEcranSeance();
    _sportDemarrerChronoSeance();
}

function _sportDemarrerChronoSeance() {
    if (_sportSeanceChronoInterval) clearInterval(_sportSeanceChronoInterval);
    _sportSeanceChronoInterval = setInterval(() => {
        const chronoEl = document.getElementById('sport-seance-chrono');
        if (!chronoEl || !_sportSeanceActive) return;
        const secondes = Math.floor((Date.now() - _sportSeanceActive.chronoDebut) / 1000);
        chronoEl.textContent = _sportFormatChrono(secondes);
    }, 1000);
}

function _sportFormatChrono(totalSecondes) {
    const h = Math.floor(totalSecondes / 3600);
    const m = Math.floor((totalSecondes % 3600) / 60);
    const s = totalSecondes % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// ── Rendu principal de l'écran de séance ──
// FIX : la zone de repos (#sport-seance-repos-zone) est désormais placée
// juste après le header (chrono + Terminer), AVANT #sport-seance-contenu,
// afin de rester visible en haut de page (sticky en CSS) quel que soit
// l'exercice en cours de validation, peu importe le scroll.
function _sportRenderEcranSeance() {
    const ecran = document.getElementById('sport-seance-ecran');
    if (!ecran || !_sportSeanceActive) return;

    const secondesEcoulees = Math.floor((Date.now() - _sportSeanceActive.chronoDebut) / 1000);

    ecran.innerHTML = `
        <div class="sport-seance-header">
            <span id="sport-seance-chrono" class="sport-seance-chrono">${_sportFormatChrono(secondesEcoulees)}</span>
            <button class="sport-seance-btn-terminer" onclick="_sportConfirmerFinSeance()">Terminer</button>
        </div>

        <div id="sport-seance-repos-zone"></div>

        <div id="sport-seance-contenu">
            ${_sportSeanceActive.exercices.map(ex => _sportRenderExerciceSeance(ex)).join('')}
        </div>
    `;

    _sportAttacherEcoutesSeance();
}

function _sportRenderExerciceSeance(ex) {
    const estDuree = Number.isInteger(ex.target_duration_seconds);

    return `
        <div class="sport-seance-exercice" id="sport-seance-exercice-${ex.id}">
            <div class="sport-seance-exercice-nom">${_sportEchapper(ex.exercise_name)}</div>
            <div class="sport-seance-exercice-entetes">
                <span>SÉRIE</span>
                ${estDuree ? `<span>TEMPS (M:S)</span>` : `<span>POIDS (KG)</span><span>REPS</span>`}
            </div>
            ${ex.series.map((s, idx) => _sportRenderLigneSerie(ex, s, idx, estDuree)).join('')}
            ${estDuree ? `
                <div class="sport-seance-exercice-champs-extra">
                    <input type="text" class="sport-seance-champ-lecture-seul" placeholder="Dist. (km)" disabled>
                    <input type="text" class="sport-seance-champ-lecture-seul" placeholder="Vit. (km/h)" disabled>
                    <input type="text" class="sport-seance-champ-lecture-seul" placeholder="Incl. (%)" disabled>
                </div>
            ` : ''}
        </div>
    `;
}

function _sportRenderLigneSerie(ex, s, idx, estDuree) {
    const numeroSerie = idx + 1;
    const classeValide = s.valide ? 'sport-seance-serie-validee' : '';

    if (estDuree) {
        const cible = ex.target_duration_seconds;
        const min = Number.isInteger(s.duration_seconds) ? Math.floor(s.duration_seconds / 60) : Math.floor(cible / 60);
        const sec = Number.isInteger(s.duration_seconds) ? s.duration_seconds % 60 : cible % 60;

        return `
            <div class="sport-seance-serie-ligne ${classeValide}" data-exercice-id="${ex.id}" data-serie-index="${idx}">
                <span class="sport-seance-serie-numero">${numeroSerie}</span>
                <input type="number" class="sport-seance-input-min" value="${min}" min="0" ${s.valide ? 'disabled' : ''}>
                <input type="number" class="sport-seance-input-sec" value="${sec}" min="0" max="59" ${s.valide ? 'disabled' : ''}>
                ${!s.valide ? `
                    <button class="sport-seance-btn-timer" data-action="play" title="Démarrer le chrono">▶</button>
                ` : ''}
                <button class="sport-seance-btn-valider ${s.valide ? 'valide' : ''}" data-action="valider" ${s.valide ? 'disabled' : ''}>
                    ${SPORT_ICONE_CHECK}
                </button>
            </div>
        `;
    }

    return `
        <div class="sport-seance-serie-ligne ${classeValide}" data-exercice-id="${ex.id}" data-serie-index="${idx}">
            <span class="sport-seance-serie-numero">${numeroSerie}</span>
            <input type="number" class="sport-seance-input-poids" step="0.5" value="${s.weight_kg ?? ''}" placeholder="kg" ${s.valide ? 'disabled' : ''}>
            <input type="number" class="sport-seance-input-reps" value="${s.reps ?? ex.target_reps ?? ''}" placeholder="reps" ${s.valide ? 'disabled' : ''}>
            <button class="sport-seance-btn-valider ${s.valide ? 'valide' : ''}" data-action="valider" ${s.valide ? 'disabled' : ''}>
                ${SPORT_ICONE_CHECK}
            </button>
        </div>
    `;
}

function _sportAttacherEcoutesSeance() {
    document.querySelectorAll('.sport-seance-btn-valider').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ligne = e.target.closest('.sport-seance-serie-ligne');
            _sportValiderSerie(
                parseInt(ligne.dataset.exerciceId, 10),
                parseInt(ligne.dataset.serieIndex, 10)
            );
        });
    });

    document.querySelectorAll('.sport-seance-btn-timer').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ligne = e.target.closest('.sport-seance-serie-ligne');
            _sportDemarrerTimerActif(
                parseInt(ligne.dataset.exerciceId, 10),
                parseInt(ligne.dataset.serieIndex, 10)
            );
        });
    });
}

// ── Timer actif (Play/Stop) pour exercices basés sur la durée ──
function _sportDemarrerTimerActif(exerciceId, serieIndex) {
    if (_sportTimerActifInterval) {
        _sportOuvrirConfirmationInfo("Un chrono est déjà en cours. Arrêtez-le avant d'en démarrer un autre.");
        return;
    }

    const ex = _sportSeanceActive.exercices.find(e => e.id === exerciceId);
    if (!ex) return;

    const ligne = document.querySelector(`.sport-seance-serie-ligne[data-exercice-id="${exerciceId}"][data-serie-index="${serieIndex}"]`);
    const btn   = ligne?.querySelector('.sport-seance-btn-timer');
    if (btn) { btn.textContent = '■'; btn.dataset.action = 'stop'; btn.title = 'Arrêter le chrono'; }

    let audioCtx = null;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }

    _sportTimerActifState = {
        exerciceId, serieIndex,
        cible : ex.target_duration_seconds,
        ecoule: 0,
        audioCtx,
        aBeepe: false
    };

    btn.removeEventListener('click', _sportGererClicTimer);
    btn.addEventListener('click', _sportGererClicTimer);

    _sportTimerActifInterval = setInterval(() => {
        _sportTimerActifState.ecoule += 1;
        const minInput = ligne.querySelector('.sport-seance-input-min');
        const secInput = ligne.querySelector('.sport-seance-input-sec');
        if (minInput && secInput) {
            minInput.value = Math.floor(_sportTimerActifState.ecoule / 60);
            secInput.value = _sportTimerActifState.ecoule % 60;
        }

        if (!_sportTimerActifState.aBeepe && _sportTimerActifState.ecoule >= _sportTimerActifState.cible) {
            _sportTimerActifState.aBeepe = true;
            _sportJouerBeep(_sportTimerActifState.audioCtx);
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
    }, 1000);
}

function _sportGererClicTimer(e) {
    const btn = e.target;
    if (btn.dataset.action === 'stop') _sportArreterTimerActif();
}

function _sportArreterTimerActif() {
    if (_sportTimerActifInterval) { clearInterval(_sportTimerActifInterval); _sportTimerActifInterval = null; }
    if (_sportTimerActifState?.audioCtx) {
        try { _sportTimerActifState.audioCtx.close(); } catch (e) { /* ignore */ }
    }
    _sportTimerActifState = null;
}

function _sportJouerBeep(audioCtx) {
    if (!audioCtx) return;
    try {
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.2;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) { console.error('[SPORT] beep :', e.message); }
}

// ── Validation d'une série ──
async function _sportValiderSerie(exerciceId, serieIndex) {
    const ex = _sportSeanceActive.exercices.find(e => e.id === exerciceId);
    if (!ex) return;
    const s = ex.series[serieIndex];
    if (!s || s.valide) return;

    const ligne = document.querySelector(`.sport-seance-serie-ligne[data-exercice-id="${exerciceId}"][data-serie-index="${serieIndex}"]`);
    const estDuree = Number.isInteger(ex.target_duration_seconds);

    let body = {};
    if (estDuree) {
        if (_sportTimerActifState?.exerciceId === exerciceId && _sportTimerActifState?.serieIndex === serieIndex) {
            _sportArreterTimerActif();
        }
        const m = parseInt(ligne.querySelector('.sport-seance-input-min').value, 10) || 0;
        const sec = parseInt(ligne.querySelector('.sport-seance-input-sec').value, 10) || 0;
        body.duration_seconds = (m * 60) + sec;
    } else {
        body.weight_kg = parseFloat(ligne.querySelector('.sport-seance-input-poids').value) || 0;
        body.reps      = parseInt(ligne.querySelector('.sport-seance-input-reps').value, 10) || 0;
    }

    try {
        await fetch(`/api/sport/sessions/${_sportSeanceActive.sessionId}/exercises/${exerciceId}/series/${serieIndex}`, {
            method: 'PUT', headers: _sportAuthHeaders(), body: JSON.stringify(body)
        });

        s.valide = true;
        Object.assign(s, body);
        ligne.classList.add('sport-seance-serie-validee');
        ligne.querySelectorAll('input').forEach(i => i.disabled = true);
        const btnValider = ligne.querySelector('.sport-seance-btn-valider');
        btnValider.classList.add('valide');
        btnValider.disabled = true;
        const btnTimer = ligne.querySelector('.sport-seance-btn-timer');
        if (btnTimer) btnTimer.remove();

        // Repos entre séries : uniquement s'il reste une série suivante non validée sur cet exercice.
        const ilResteUneSerieSuivante = idx => ex.series[idx + 1] !== undefined;
        if (ilResteUneSerieSuivante(serieIndex) && Number.isInteger(ex.target_rest_seconds) && ex.target_rest_seconds > 0) {
            _sportLancerReposEntreSeries(ex.target_rest_seconds, ex.exercise_name);
        }
    } catch (err) {
        console.error('[SPORT] validerSerie :', err.message);
    }
}

// ── Repos entre séries (bandeau désormais collé en haut, cf. CSS sticky) ──
function _sportLancerReposEntreSeries(dureeSecondes, nomExercice) {
    const zone = document.getElementById('sport-seance-repos-zone');
    if (!zone) return;

    if (_sportReposInterval) clearInterval(_sportReposInterval);

    let restant = dureeSecondes;

    const render = () => {
        zone.innerHTML = `
            <div class="sport-seance-repos-banniere">
                <span class="sport-seance-repos-label">Repos — ${_sportEchapper(nomExercice)}</span>
                <span class="sport-seance-repos-chrono">${_sportFormatChrono(restant)}</span>
                <button class="sport-seance-repos-btn-passer" onclick="_sportPasserRepos()">Passer</button>
            </div>
        `;
    };
    render();

    _sportReposInterval = setInterval(() => {
        restant -= 1;
        if (restant <= 0) {
            clearInterval(_sportReposInterval);
            _sportReposInterval = null;
            if (navigator.vibrate) navigator.vibrate([300]);
            zone.innerHTML = '';
            return;
        }
        render();
    }, 1000);
}

function _sportPasserRepos() {
    if (_sportReposInterval) { clearInterval(_sportReposInterval); _sportReposInterval = null; }
    const zone = document.getElementById('sport-seance-repos-zone');
    if (zone) zone.innerHTML = '';
}

// ── Fin de séance ──
function _sportConfirmerFinSeance() {
    _sportOuvrirModalChoix(
        'Terminer la séance',
        'Voulez-vous vraiment terminer cette séance ?',
        'Terminer', 'Annuler',
        async () => { await _sportTerminerSeance(); }
    );
}

async function _sportTerminerSeance() {
    if (_sportSeanceChronoInterval) { clearInterval(_sportSeanceChronoInterval); _sportSeanceChronoInterval = null; }
    if (_sportReposInterval)        { clearInterval(_sportReposInterval); _sportReposInterval = null; }
    _sportArreterTimerActif();
    _sportRelacherWakeLock();

    try {
        await fetch(`/api/sport/sessions/${_sportSeanceActive.sessionId}/end`, {
            method: 'POST', headers: _sportAuthHeaders()
        });
    } catch (err) {
        console.error('[SPORT] terminerSeance :', err.message);
    }

    _sportSeanceActive = null;
    chargerSportDashboard();
    if (typeof chargerSportStatsWidget === 'function') chargerSportStatsWidget();
}

async function _sportInitVerifSeanceActive() {
    try {
        const r = await fetch('/api/sport/sessions/active', { headers: _sportAuthHeaders() });
        const d = await r.json();
        if (d.success && d.session) {
            _sportSeanceActive = {
                sessionId  : d.session.id,
                workoutName: d.session.workout_name,
                chronoDebut: new Date(d.session.date_start).getTime(),
                exercices  : d.session.exercices.map(ex => ({
                    ...ex,
                    series: ex.series.map(s => ({ ...s, valide: !!s.valide }))
                }))
            };
            await _sportDemanderWakeLock();
            _sportAfficherEcranSeance();
        }
    } catch (err) {
        console.error('[SPORT] initVerifSeanceActive :', err.message);
    }
}
