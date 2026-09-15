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

// ── Conversion durée min ↔ sec (conservé pour compatibilité éventuelle) ──
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

// ── Création d'une routine (+ jour caché) ──
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

// ── Détail d'une routine ──
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

// Meta affichée par exercice : séries/reps ou séries/durée, + poids cible et repos si renseignés.
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
                            <div class="sport-routine-exercice-actions">
                                <button class="sport-routine-exercice-btn-edit" data-exercice-id="${ex.id}" title="Modifier">
                                    ${SPORT_ICONE_CRAYON}
                                </button>
                                <button class="sport-routine-exercice-btn-suppr" data-exercice-id="${ex.id}" title="Supprimer">
                                    ${SPORT_ICONE_POUBELLE}
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
            <button class="sport-cta-btn sport-btn-ajouter-exercice" onclick="_sportOuvrirModalAjoutExercice()">
                + Ajouter un exercice
            </button>
        </div>
    `;

    zone.querySelector('.sport-routine-btn-suppr-routine')?.addEventListener('click', () => {
        _sportOuvrirConfirmationSuppression(async () => {
            await fetch(`/api/sport/workouts/${workout.id}`, { method: 'DELETE', headers: _sportAuthHeaders() });
            _sportChargerListeRoutines();
        });
    });

    zone.querySelectorAll('.sport-routine-exercice-btn-edit').forEach(btn => {
        btn.addEventListener('click', () => _sportOuvrirEditionExercice(parseInt(btn.dataset.exerciceId, 10), exercices));
    });
    zone.querySelectorAll('.sport-routine-exercice-btn-suppr').forEach(btn => {
        btn.addEventListener('click', () => {
            const exId = parseInt(btn.dataset.exerciceId, 10);
            _sportOuvrirConfirmationSuppression(async () => {
                await fetch(`/api/sport/exercises/${exId}`, { method: 'DELETE', headers: _sportAuthHeaders() });
                _sportOuvrirDetailRoutine(workout.id);
            });
        });
    });

    _sportInitDragAndDropExercices(zone, workout.id);
}

// ── Drag-and-drop des exercices d'une routine ──
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

            const rect        = item.getBoundingClientRect();
            const apresMilieu = e.clientY > rect.top + rect.height / 2;

            if (apresMilieu) {
                item.after(elementGlisse);
            } else {
                item.before(elementGlisse);
            }
        });

        // Support tactile (mobile) : réordonnancement au toucher via la poignée.
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

        const rect        = item.getBoundingClientRect();
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

// Envoie le nouvel ordre au serveur (liste des IDs dans l'ordre DOM courant).
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

// ── Édition inline d'un exercice (min/sec pour durée, poids/reps sinon) ──
function _sportOuvrirEditionExercice(exerciceId, exercices) {
    const ex   = exercices.find(e => e.id === exerciceId);
    const item = document.getElementById(`sport-exercice-${exerciceId}`);
    if (!ex || !item) return;

    const estDuree     = Number.isInteger(ex.target_duration_seconds);
    const minutesInit  = estDuree ? Math.floor(ex.target_duration_seconds / 60) : 0;
    const secondesInit = estDuree ? ex.target_duration_seconds % 60 : 0;

    item.outerHTML = `
        <div class="sport-routine-exercice-item sport-routine-exercice-edition" id="sport-exercice-${ex.id}">
            <div class="sport-routine-exercice-edition-nom">${_sportEchapper(ex.exercise_name)}</div>

            ${estDuree ? `
                <div class="sport-edition-champ-groupe">
                    <input type="number" min="0" id="sport-edit-sets-${ex.id}" value="${ex.target_sets || 1}" class="sport-edition-input-court">
                    <span class="sport-edition-x">×</span>
                    <input type="number" min="0" id="sport-edit-min-${ex.id}" value="${minutesInit}" class="sport-edition-input-court">
                    <span class="sport-edition-label">min</span>
                    <input type="number" min="0" max="59" id="sport-edit-sec-${ex.id}" value="${secondesInit}" class="sport-edition-input-court">
                    <span class="sport-edition-label">sec</span>
                </div>
            ` : `
                <div class="sport-edition-champ-groupe">
                    <input type="number" min="0" id="sport-edit-sets-${ex.id}" value="${ex.target_sets}" class="sport-edition-input-court">
                    <span class="sport-edition-label">séries ×</span>
                    <input type="number" min="0" id="sport-edit-reps-${ex.id}" value="${ex.target_reps}" class="sport-edition-input-court">
                    <span class="sport-edition-label">reps</span>
                </div>
            `}

            <div class="sport-edition-champ-groupe">
                <input type="number" min="0" id="sport-edit-repos-${ex.id}" value="${ex.target_rest_seconds ?? 30}" class="sport-edition-input-court">
                <span class="sport-edition-label">sec de repos</span>
            </div>

            <div class="sport-edition-actions">
                <button class="sport-cta-btn" id="sport-edit-save-${ex.id}">Sauvegarder</button>
                <button class="sport-btn-annuler-edition" id="sport-edit-cancel-${ex.id}">Annuler</button>
            </div>
        </div>
    `;

    document.getElementById(`sport-edit-save-${ex.id}`).addEventListener('click', () => _sportSauvegarderEditionExercice(ex, estDuree));
    document.getElementById(`sport-edit-cancel-${ex.id}`).addEventListener('click', () => _sportOuvrirDetailRoutineDepuisCache());
}

async function _sportSauvegarderEditionExercice(ex, estDuree) {
    const targetSets = parseInt(document.getElementById(`sport-edit-sets-${ex.id}`).value, 10) || 1;
    const targetRest = parseInt(document.getElementById(`sport-edit-repos-${ex.id}`).value, 10) || 0;

    const payload = { target_sets: targetSets, target_rest_seconds: targetRest };

    if (estDuree) {
        const min = parseInt(document.getElementById(`sport-edit-min-${ex.id}`).value, 10) || 0;
        const sec = parseInt(document.getElementById(`sport-edit-sec-${ex.id}`).value, 10) || 0;
        payload.target_duration_seconds = (min * 60) + sec;
        payload.target_reps = null;
    } else {
        payload.target_reps = parseInt(document.getElementById(`sport-edit-reps-${ex.id}`).value, 10) || 0;
        payload.target_duration_seconds = null;
    }

    try {
        await fetch(`/api/sport/exercises/${ex.id}`, {
            method : 'PUT',
            headers: _sportAuthHeaders(),
            body   : JSON.stringify(payload)
        });
    } catch (err) {
        console.error('[SPORT] sauvegarderEditionExercice :', err.message);
    }

    _sportOuvrirDetailRoutineDepuisCache();
}

function _sportOuvrirDetailRoutineDepuisCache() {
    if (_sportRoutineDetailActive?.workoutId) {
        _sportOuvrirDetailRoutine(_sportRoutineDetailActive.workoutId);
    }
}

// ══════════════════════════════════════════════════════════════
// ── AJOUT D'EXERCICE (catalogue WGER) ──
// ══════════════════════════════════════════════════════════════

let _sportCatalogueOffset  = 0;
let _sportCatalogueTermine = false;
let _sportCatalogueEnCours = false;
let _sportCatalogueFiltres = { search: '', category: '', equipment: '' };

function _sportOuvrirModalAjoutExercice() {
    document.getElementById('overlay').classList.add('on');
    document.body.classList.add('modal-open');
    history.pushState({ modalOpen: true }, '', '');

    document.getElementById('modal-title').textContent = 'Ajouter un exercice';
    document.getElementById('modal-body').innerHTML = `
        <input type="text" id="sport-catalogue-search" class="sport-catalogue-search"
               placeholder="Rechercher un exercice…" autocomplete="off">
        <div class="sport-catalogue-filtres">
            <select id="sport-catalogue-categorie"><option value="">Toutes catégories</option></select>
            <select id="sport-catalogue-equipement"><option value="">Tout équipement</option></select>
        </div>
        <div id="sport-catalogue-liste" class="sport-catalogue-liste">
            <p class="sport-catalogue-loading">Chargement du catalogue…</p>
        </div>
        <button class="sport-cta-btn sport-catalogue-btn-plus" id="sport-catalogue-btn-plus" style="display:none">
            Afficher plus
        </button>
    `;

    _sportCatalogueOffset  = 0;
    _sportCatalogueTermine = false;
    _sportCatalogueFiltres = { search: '', category: '', equipment: '' };

    _sportChargerFiltresCatalogue();
    _sportRechercherCatalogue(true);

    let debounce = null;
    document.getElementById('sport-catalogue-search').addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            _sportCatalogueFiltres.search = e.target.value.trim();
            _sportRechercherCatalogue(true);
        }, 350);
    });
    document.getElementById('sport-catalogue-categorie').addEventListener('change', (e) => {
        _sportCatalogueFiltres.category = e.target.value;
        _sportRechercherCatalogue(true);
    });
    document.getElementById('sport-catalogue-equipement').addEventListener('change', (e) => {
        _sportCatalogueFiltres.equipment = e.target.value;
        _sportRechercherCatalogue(true);
    });
    document.getElementById('sport-catalogue-btn-plus').addEventListener('click', () => _sportRechercherCatalogue(false));
}

async function _sportChargerFiltresCatalogue() {
    try {
        const [rCat, rEqu] = await Promise.all([
            fetch('/api/sport/wger/categories', { headers: _sportAuthHeaders() }),
            fetch('/api/sport/wger/equipment', { headers: _sportAuthHeaders() })
        ]);
        const dCat = await rCat.json();
        const dEqu = await rEqu.json();

        const selCat = document.getElementById('sport-catalogue-categorie');
        const selEqu = document.getElementById('sport-catalogue-equipement');
        if (selCat && dCat.success) {
            dCat.categories.forEach(c => selCat.insertAdjacentHTML('beforeend', `<option value="${c.id}">${_sportEchapper(c.name)}</option>`));
        }
        if (selEqu && dEqu.success) {
            dEqu.equipment.forEach(e => selEqu.insertAdjacentHTML('beforeend', `<option value="${e.id}">${_sportEchapper(e.name)}</option>`));
        }
    } catch (err) {
        console.error('[SPORT] chargerFiltresCatalogue :', err.message);
    }
}

async function _sportRechercherCatalogue(reinit) {
    if (_sportCatalogueEnCours) return;
    _sportCatalogueEnCours = true;

    if (reinit) {
        _sportCatalogueOffset  = 0;
        _sportCatalogueTermine = false;
        document.getElementById('sport-catalogue-liste').innerHTML = `<p class="sport-catalogue-loading">Recherche…</p>`;
    }

    const btnPlus = document.getElementById('sport-catalogue-btn-plus');
    if (btnPlus) btnPlus.style.display = 'none';

    try {
        const params = new URLSearchParams({
            limit : '20',
            offset: String(_sportCatalogueOffset),
            search: _sportCatalogueFiltres.search,
            category : _sportCatalogueFiltres.category,
            equipment: _sportCatalogueFiltres.equipment
        });
        const r = await fetch(`/api/sport/wger/exercises?${params.toString()}`, { headers: _sportAuthHeaders() });
        const d = await r.json();

        const zone = document.getElementById('sport-catalogue-liste');
        if (!d.success) {
            zone.innerHTML = `<p class="sport-catalogue-loading">Erreur lors de la recherche.</p>`;
            return;
        }

        if (reinit) zone.innerHTML = '';
        if (!d.exercises.length && reinit) {
            zone.innerHTML = `<p class="sport-catalogue-loading">Aucun exercice trouvé.</p>`;
        } else {
            d.exercises.forEach(ex => {
                zone.insertAdjacentHTML('beforeend', `
                    <div class="sport-catalogue-item" data-wger-id="${ex.wger_exercise_id}" data-type-suivi="${ex.type_suivi || ''}" data-nom="${_sportEchapper(ex.name)}">
                        <div class="sport-catalogue-item-image">
                            ${ex.image ? `<img src="${ex.image}" alt="">` : SPORT_ICONE_PAS_IMAGE}
                        </div>
                        <div class="sport-catalogue-item-nom">${_sportEchapper(ex.name)}</div>
                    </div>
                `);
            });
        }

        _sportCatalogueOffset += d.exercises.length;
        _sportCatalogueTermine = !d.has_more;

        if (btnPlus) btnPlus.style.display = _sportCatalogueTermine ? 'none' : 'block';

        zone.querySelectorAll('.sport-catalogue-item').forEach(item => {
            item.addEventListener('click', () => _sportOuvrirFormulaireAjoutExercice(
                parseInt(item.dataset.wgerId, 10), item.dataset.nom, item.dataset.typeSuivi || null
            ));
        });
    } catch (err) {
        console.error('[SPORT] rechercherCatalogue :', err.message);
    } finally {
        _sportCatalogueEnCours = false;
    }
}

// ── Formulaire d'ajout : type de suivi (séries/reps vs séries/durée) ──
function _sportOuvrirFormulaireAjoutExercice(wgerId, nom, typeSuivi) {
    const estDuree = typeSuivi === 'duree';

    document.getElementById('modal-title').textContent = 'Ajouter : ' + nom;
    document.getElementById('modal-body').innerHTML = `
        <div class="sport-ajout-form">
            ${estDuree ? `
                <div class="sport-edition-champ-groupe">
                    <input type="number" min="1" id="sport-ajout-sets" value="1" class="sport-edition-input-court">
                    <span class="sport-edition-label">séries ×</span>
                    <input type="number" min="0" id="sport-ajout-min" value="0" class="sport-edition-input-court">
                    <span class="sport-edition-label">min</span>
                    <input type="number" min="0" max="59" id="sport-ajout-sec" value="30" class="sport-edition-input-court">
                    <span class="sport-edition-label">sec</span>
                </div>
            ` : `
                <div class="sport-edition-champ-groupe">
                    <input type="number" min="1" id="sport-ajout-sets" value="3" class="sport-edition-input-court">
                    <span class="sport-edition-label">séries ×</span>
                    <input type="number" min="1" id="sport-ajout-reps" value="10" class="sport-edition-input-court">
                    <span class="sport-edition-label">reps</span>
                </div>
            `}
            <div class="sport-edition-champ-groupe">
                <input type="number" min="0" id="sport-ajout-repos" value="30" class="sport-edition-input-court">
                <span class="sport-edition-label">sec de repos</span>
            </div>
        </div>
        <div class="modal-actions">
            <button class="btn-save" id="sport-ajout-confirmer">Ajouter</button>
            <button class="btn-cancel" id="sport-ajout-annuler">Annuler</button>
        </div>
    `;

    document.getElementById('sport-ajout-annuler').onclick = () => closeModal();
    document.getElementById('sport-ajout-confirmer').onclick = () => _sportConfirmerAjoutExercice(wgerId, nom, estDuree);
}

async function _sportConfirmerAjoutExercice(wgerId, nom, estDuree) {
    if (!_sportRoutineDetailActive?.dayId) return;

    const targetSets = parseInt(document.getElementById('sport-ajout-sets').value, 10) || 1;
    const targetRest = parseInt(document.getElementById('sport-ajout-repos').value, 10) || 0;

    const payload = {
        wger_exercise_id   : wgerId,
        exercise_name      : nom,
        target_sets        : targetSets,
        target_rest_seconds: targetRest
    };

    if (estDuree) {
        const min = parseInt(document.getElementById('sport-ajout-min').value, 10) || 0;
        const sec = parseInt(document.getElementById('sport-ajout-sec').value, 10) || 0;
        payload.target_duration_seconds = (min * 60) + sec;
        payload.target_reps = null;
    } else {
        payload.target_reps = parseInt(document.getElementById('sport-ajout-reps').value, 10) || 10;
        payload.target_duration_seconds = null;
    }

    try {
        await fetch(`/api/sport/days/${_sportRoutineDetailActive.dayId}/exercises`, {
            method : 'POST',
            headers: _sportAuthHeaders(),
            body   : JSON.stringify(payload)
        });
        closeModal();
        _sportOuvrirDetailRoutineDepuisCache();
    } catch (err) {
        console.error('[SPORT] confirmerAjoutExercice :', err.message);
        _sportOuvrirConfirmationInfo("Erreur lors de l'ajout de l'exercice.");
    }
}

// ══════════════════════════════════════════════════════════════
// ── SÉANCE EN COURS ──
// ══════════════════════════════════════════════════════════════

let _sportSeanceActive      = null; // { sessionId, workoutId, exercices, startedAt }
let _sportSeanceTimerHandle = null;

async function _sportInitVerifSeanceActive() {
    try {
        const r = await fetch('/api/sport/sessions/active', { headers: _sportAuthHeaders() });
        const d = await r.json();
        if (d.success && d.session) {
            _sportSeanceActive = d.session;
            _sportRenderSeanceEnCours();
        }
    } catch (err) {
        console.error('[SPORT] initVerifSeanceActive :', err.message);
    }
}

async function _sportDemarrerSeance(workoutId) {
    try {
        const r = await fetch('/api/sport/sessions', {
            method : 'POST',
            headers: _sportAuthHeaders(),
            body   : JSON.stringify({ workout_id: workoutId })
        });
                const d = await r.json();
        if (!d.success) {
            _sportOuvrirConfirmationInfo('Erreur lors du démarrage de la séance.');
            return;
        }
        _sportSeanceActive = d.session;
        _sportRenderSeanceEnCours();
    } catch (err) {
        console.error('[SPORT] demarrerSeance :', err.message);
    }
}

function _sportRenderSeanceEnCours() {
    const zone = document.getElementById('grid-sport');
    if (!zone || !_sportSeanceActive) return;

    const exercices = _sportSeanceActive.exercices || [];

    zone.innerHTML = `
        <div class="sport-wrap">
            <div class="sport-card sport-seance-header">
                <div class="sport-seance-chrono" id="sport-seance-chrono">00:00</div>
                <button class="sport-seance-btn-terminer" id="sport-seance-btn-terminer">Terminer</button>
            </div>

            <div class="sport-seance-exercices-liste">
                ${exercices.map(ex => _sportRenderExerciceSeance(ex)).join('')}
            </div>
        </div>
    `;

    document.getElementById('sport-seance-btn-terminer').addEventListener('click', _sportConfirmerFinSeance);

    exercices.forEach(ex => _sportBindExerciceSeance(ex));

    _sportDemarrerChronoSeance();
}

function _sportRenderExerciceSeance(ex) {
    const estDuree = Number.isInteger(ex.target_duration_seconds);
    const nbSeries = ex.target_sets || 1;
    const series   = ex.series_completees || [];

    const estCardio = ['Marche', 'Course', 'Vélo', 'Tapis'].some(mot => ex.exercise_name?.includes(mot)) || estDuree;

    return `
        <div class="sport-card sport-seance-exercice-card" id="sport-seance-ex-${ex.id}">
            <div class="sport-seance-exercice-titre">${_sportEchapper(ex.exercise_name)}</div>
            <div class="sport-seance-exercice-entete">
                <span>SÉRIE</span>
                ${estDuree ? `<span>MIN</span><span>SEC</span>` : `<span>POIDS (KG)</span><span>REPS</span>`}
            </div>
            ${Array.from({ length: nbSeries }).map((_, i) => {
                const num  = i + 1;
                const fait = series.find(s => s.serie === num);
                const min  = estDuree ? Math.floor((fait?.duree_secondes ?? ex.target_duration_seconds ?? 0) / 60) : null;
                const sec  = estDuree ? (fait?.duree_secondes ?? ex.target_duration_seconds ?? 0) % 60 : null;

                return `
                    <div class="sport-seance-serie-ligne ${fait ? 'sport-serie-validee' : ''}" data-exercice-id="${ex.id}" data-serie="${num}">
                        <span class="sport-seance-serie-num">${num}</span>
                        ${estDuree ? `
                            <input type="number" min="0" class="sport-seance-input-min" value="${min}" ${fait ? 'disabled' : ''}>
                            <input type="number" min="0" max="59" class="sport-seance-input-sec" value="${sec}" ${fait ? 'disabled' : ''}>
                        ` : `
                            <input type="number" min="0" class="sport-seance-input-poids" placeholder="kg" value="${fait?.poids_kg ?? ex.target_weight_kg ?? ''}" ${fait ? 'disabled' : ''}>
                            <input type="number" min="0" class="sport-seance-input-reps" value="${fait?.reps ?? ex.target_reps ?? ''}" ${fait ? 'disabled' : ''}>
                        `}
                        <button class="sport-seance-btn-check ${fait ? 'sport-check-actif' : ''}" title="Valider la série">
                            ${SPORT_ICONE_CHECK}
                        </button>
                    </div>
                `;
            }).join('')}
            ${estCardio ? `
                <div class="sport-seance-cardio-champs">
                    <input type="number" min="0" step="0.01" class="sport-seance-input-dist" placeholder="Dist. (km)" value="${ex.distance_km ?? ''}">
                    <input type="number" min="0" step="0.1" class="sport-seance-input-vit" placeholder="Vit. (km/h)" value="${ex.vitesse_kmh ?? ''}">
                    <input type="number" min="0" class="sport-seance-input-incl" placeholder="Incl. (%)" value="${ex.inclinaison_pct ?? ''}">
                </div>
            ` : ''}
        </div>
    `;
}

function _sportBindExerciceSeance(ex) {
    const card = document.getElementById(`sport-seance-ex-${ex.id}`);
    if (!card) return;

    card.querySelectorAll('.sport-seance-serie-ligne').forEach(ligne => {
        const btn = ligne.querySelector('.sport-seance-btn-check');
        btn?.addEventListener('click', () => _sportValiderSerie(ex, ligne));
    });

    ['dist', 'vit', 'incl'].forEach(champ => {
        const input = card.querySelector(`.sport-seance-input-${champ}`);
        input?.addEventListener('change', () => _sportSauvegarderCardioExercice(ex, card));
    });
}

async function _sportValiderSerie(ex, ligne) {
    if (ligne.classList.contains('sport-serie-validee')) return;

    const numSerie = parseInt(ligne.dataset.serie, 10);
    const estDuree = Number.isInteger(ex.target_duration_seconds);

    const payload = { serie: numSerie };
    if (estDuree) {
        payload.duree_secondes = (parseInt(ligne.querySelector('.sport-seance-input-min').value, 10) || 0) * 60
                                + (parseInt(ligne.querySelector('.sport-seance-input-sec').value, 10) || 0);
    } else {
        payload.poids_kg = parseFloat(ligne.querySelector('.sport-seance-input-poids').value) || 0;
        payload.reps     = parseInt(ligne.querySelector('.sport-seance-input-reps').value, 10) || 0;
    }

    try {
        await fetch(`/api/sport/sessions/${_sportSeanceActive.sessionId}/exercises/${ex.id}/series`, {
            method : 'POST',
            headers: _sportAuthHeaders(),
            body   : JSON.stringify(payload)
        });

        ligne.classList.add('sport-serie-validee');
        ligne.querySelector('.sport-seance-btn-check').classList.add('sport-check-actif');
        ligne.querySelectorAll('input').forEach(i => i.disabled = true);
    } catch (err) {
        console.error('[SPORT] validerSerie :', err.message);
    }
}

async function _sportSauvegarderCardioExercice(ex, card) {
    const payload = {
        distance_km    : parseFloat(card.querySelector('.sport-seance-input-dist')?.value) || null,
        vitesse_kmh    : parseFloat(card.querySelector('.sport-seance-input-vit')?.value) || null,
        inclinaison_pct: parseFloat(card.querySelector('.sport-seance-input-incl')?.value) || null
    };

    try {
        await fetch(`/api/sport/sessions/${_sportSeanceActive.sessionId}/exercises/${ex.id}/cardio`, {
            method : 'PUT',
            headers: _sportAuthHeaders(),
            body   : JSON.stringify(payload)
        });
    } catch (err) {
        console.error('[SPORT] sauvegarderCardioExercice :', err.message);
    }
}

// ── Chrono de séance ──
function _sportDemarrerChronoSeance() {
    if (_sportSeanceTimerHandle) clearInterval(_sportSeanceTimerHandle);

    const debut = new Date(_sportSeanceActive.startedAt).getTime();

    const majAffichage = () => {
        const el = document.getElementById('sport-seance-chrono');
        if (!el) { clearInterval(_sportSeanceTimerHandle); return; }
        const ecoule = Math.floor((Date.now() - debut) / 1000);
        const m = String(Math.floor(ecoule / 60)).padStart(2, '0');
        const s = String(ecoule % 60).padStart(2, '0');
        el.textContent = `${m}:${s}`;
    };

    majAffichage();
    _sportSeanceTimerHandle = setInterval(majAffichage, 1000);
}

// ── Fin de séance ──
function _sportConfirmerFinSeance() {
    _sportOuvrirModalChoix(
        'Terminer la séance',
        'Voulez-vous vraiment terminer et enregistrer cette séance ?',
        'Terminer',
        'Annuler',
        _sportTerminerSeance
    );
}

async function _sportTerminerSeance() {
    if (_sportSeanceTimerHandle) clearInterval(_sportSeanceTimerHandle);

    try {
        await fetch(`/api/sport/sessions/${_sportSeanceActive.sessionId}/finish`, {
            method : 'POST',
            headers: _sportAuthHeaders()
        });
    } catch (err) {
        console.error('[SPORT] terminerSeance :', err.message);
    }

    _sportSeanceActive = null;
    chargerSportDashboard();
}
