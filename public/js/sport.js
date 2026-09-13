// public/js/sport.js
// Module Sport (WGER) : Dashboard, Mes Routines.
// Auth : token Bearer dans localStorage['moadja_user'].token (cf. tchat.js).
// Une routine = nom libre + liste d'exercices. Le schéma impose un "jour"
// (sport_workout_days) créé automatiquement et invisible à la création.
// Durée : saisie/affichage en minutes, stockage en secondes (target_duration_seconds).
// target_duration_seconds non-null => exercice "à durée", sinon "séries × reps".
// Suppression : réutilise le modal global (overlay, #modal-title, #modal-body,
// closeModal() de modal.js) — même mécanisme que taches.js. Jamais de confirm().

const SPORT_ICONE_DUMBBELL = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="2.5"  y1="7" x2="2.5"  y2="17"></line>
        <line x1="5.5"  y1="9" x2="5.5"  y2="15"></line>
        <line x1="18.5" y1="9" x2="18.5" y2="15"></line>
        <line x1="21.5" y1="7" x2="21.5" y2="17"></line>
        <line x1="5.5" y1="12" x2="18.5" y2="12"></line>
    </svg>
`;

const SPORT_ICONE_FLECHE = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14"></path>
        <path d="M12 5l7 7-7 7"></path>
    </svg>
`;

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
                ${_sportRenderDashboard()}
            </div>

            <div id="sport-section-routines" class="sport-section" style="display:none">
                <div id="sport-routines-zone">
                    <p class="sport-catalogue-loading">Chargement…</p>
                </div>
            </div>

        </div>
    `;
}

// ── Dashboard (état "aucune activité") ──
function _sportRenderDashboard() {
    return `
        <div class="sport-card">
            <div class="sport-empty-state">
                <div class="sport-empty-icon">${SPORT_ICONE_DUMBBELL}</div>
                <div class="sport-empty-title">Aucune séance cette semaine</div>
                <div class="sport-empty-text">
                    Prêt à commencer ? Créez votre première routine pour suivre vos entraînements
                    et voir votre progression au fil du temps.
                </div>
                <button class="sport-cta-btn" onclick="_sportSwitchSection('routines')">
                    ${SPORT_ICONE_DUMBBELL} Commencer une séance
                </button>
            </div>
        </div>

        <div class="sport-card">
            <div class="sport-section-title">Dernières séances</div>
            <p class="sport-empty-note">
                Aucune séance enregistrée pour l'instant.
            </p>
        </div>
    `;
}

// ── Changement de section ──
function _sportSwitchSection(section) {
    _sportSectionActive = section;

    document.querySelectorAll('.sport-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.section === section);
    });

    document.querySelectorAll('.sport-section').forEach(s => {
        s.style.display = 'none';
    });
    const cible = document.getElementById(`sport-section-${section}`);
    if (cible) cible.style.display = 'block';

    if (section === 'routines') {
        _sportChargerListeRoutines();
    }
}

// ── AUTH ──

function _sportToken() {
    try { return JSON.parse(localStorage.getItem('moadja_user'))?.token || ''; }
    catch { return ''; }
}

function _sportAuthHeaders() {
    return {
        'Content-Type' : 'application/json',
        'Authorization': `Bearer ${_sportToken()}`
    };
}

// ── Conversion durée min ↔ sec ──

function _sportSecondesVersMinutes(secondes) {
    if (!Number.isInteger(secondes)) return 0;
    return Math.round(secondes / 60);
}

function _sportMinutesVersSecondes(minutes) {
    if (!Number.isInteger(minutes)) return null;
    return minutes * 60;
}

// ── Confirmation de suppression via le modal global (esprit taches.js) ──
// Ouvre l'overlay/modal déjà utilisés partout ailleurs sur le site
// (#overlay, #modal-title, #modal-body) plutôt qu'une confirmation
// inline. onConfirm est appelé après fermeture du modal si l'utilisateur
// valide ; rien ne se passe s'il annule, ferme via Échap ou retour Android
// (mécanismes déjà gérés globalement dans modal.js).
function _sportOuvrirConfirmationSuppression(onConfirm) {
    document.getElementById('overlay').classList.add('on');
    document.body.classList.add('modal-open');
    history.pushState({ modalOpen: true }, '', '');

    document.getElementById('modal-title').textContent = 'Confirmation';
    document.getElementById('modal-body').innerHTML = `
        <p style="color:#333;font-size:15px;margin-bottom:20px">Confirmer la suppression ?</p>
        <div class="modal-actions">
            <button class="btn-delete" id="sport-modal-suppr-oui">Confirmer</button>
            <button class="btn-cancel" id="sport-modal-suppr-non">Annuler</button>
        </div>`;

    document.getElementById('sport-modal-suppr-oui').onclick = async () => {
        closeModal();
        await onConfirm();
    };
    document.getElementById('sport-modal-suppr-non').onclick = () => closeModal();
}

// ── MES ROUTINES ──

let _sportRoutineDetailActive = null; // { workoutId, dayId }

// ── Liste des routines ──
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
                <input type="text"
                       id="sport-routine-nouveau-nom"
                       class="sport-catalogue-search"
                       placeholder="Nom de la nouvelle routine…"
                       autocomplete="off">
                <button class="sport-cta-btn" onclick="_sportCreerRoutine()">
                    + Créer une routine
                </button>
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

function _sportEchapper(str) {
    return (str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
            method : 'POST',
            headers: _sportAuthHeaders(),
            body   : JSON.stringify({ name: nom })
        });
        const dWorkout = await rWorkout.json();

        if (!dWorkout.success) {
            if (msg) msg.textContent = 'Erreur : ' + (dWorkout.message || 'création impossible.');
            return;
        }

        const workoutId = dWorkout.workout.id;

        const rDay = await fetch(`/api/sport/workouts/${workoutId}/days`, {
            method : 'POST',
            headers: _sportAuthHeaders(),
            body   : JSON.stringify({ description: 'Exercices', day_order: 1 })
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

// ── Suppression d'une routine (liste) — via modal global ──
function _sportConfirmerSuppressionRoutine(workoutId) {
    _sportOuvrirConfirmationSuppression(async () => {
        try {
            await fetch(`/api/sport/workouts/${workoutId}`, {
                method : 'DELETE',
                headers: _sportAuthHeaders()
            });
            _sportChargerListeRoutines();
        } catch (err) {
            console.error('[SPORT] supprimerRoutine :', err.message);
        }
    });
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

function _sportRenderDetailRoutine(workout, jour) {
    const zone      = document.getElementById('sport-routines-zone');
    const exercices = jour?.exercises || [];

    zone.innerHTML = `
        <div class="sport-card">
            <div class="sport-routine-detail-header">
                <button class="sport-routine-btn-retour" onclick="_sportChargerListeRoutines()">‹ Retour</button>
                <button class="sport-routine-btn-suppr-routine" data-workout-id="${workout.id}">🗑️ Supprimer la routine</button>
            </div>
            <div class="sport-routine-detail-nom">${_sportEchapper(workout.name)}</div>

            <button class="sport-cta-btn sport-btn-commencer-disabled" disabled title="Bientôt disponible">
                ${SPORT_ICONE_DUMBBELL} Commencer la routine
            </button>
        </div>

        <div class="sport-card">
            <div class="sport-section-title">Exercices</div>
            ${!exercices.length ? `
                <p class="sport-empty-note">Aucun exercice dans cette routine pour l'instant.</p>
            ` : `
                <div class="sport-routine-exercices-liste">
                    ${exercices.map(ex => {
                        const estDuree = Number.isInteger(ex.target_duration_seconds);
                        const meta     = estDuree
                            ? `${_sportSecondesVersMinutes(ex.target_duration_seconds)} min`
                            : `${ex.target_sets} séries × ${ex.target_reps} reps`;
                        return `
                                                <div class="sport-routine-exercice-item" id="sport-exercice-${ex.id}">
                            <div class="sport-routine-exercice-info">
                                <div class="sport-routine-exercice-nom">${_sportEchapper(ex.exercise_name)}</div>
                                <div class="sport-routine-exercice-meta">${meta}</div>
                            </div>
                            <button class="sport-routine-exercice-btn-edit" data-exercice-id="${ex.id}"
                                    data-sets="${ex.target_sets}" data-reps="${ex.target_reps}"
                                    data-duree="${Number.isInteger(ex.target_duration_seconds) ? ex.target_duration_seconds : ''}"
                                    data-nom="${_sportEchapper(ex.exercise_name)}" title="Modifier">✏️</button>
                            <button class="sport-routine-exercice-btn-del" data-exercice-id="${ex.id}" title="Supprimer">🗑️</button>
                        </div>
                    `;}).join('')}
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
                btn.dataset.duree !== '' ? parseInt(btn.dataset.duree, 10) : null
            );
        });
    });
}

// ── Suppression routine (depuis détail) — via modal global ──
function _sportConfirmerSuppressionRoutineDetail(workoutId) {
    _sportOuvrirConfirmationSuppression(async () => {
        try {
            await fetch(`/api/sport/workouts/${workoutId}`, {
                method : 'DELETE',
                headers: _sportAuthHeaders()
            });
            _sportChargerListeRoutines();
        } catch (err) {
            console.error('[SPORT] supprimerRoutineDetail :', err.message);
        }
    });
}

// ── Suppression d'un exercice — via modal global ──
function _sportConfirmerSuppressionExercice(exerciceId) {
    _sportOuvrirConfirmationSuppression(async () => {
        try {
            await fetch(`/api/sport/exercises/${exerciceId}`, {
                method : 'DELETE',
                headers: _sportAuthHeaders()
            });
            _sportOuvrirDetailRoutine(_sportRoutineDetailActive.workoutId);
        } catch (err) {
            console.error('[SPORT] supprimerExercice :', err.message);
        }
    });
}

// ── Édition séries/reps ou durée ──
function _sportEditerExercice(exerciceId, nom, setsActuel, repsActuel, dureeActuelleSecondes) {
    const itemEl = document.getElementById(`sport-exercice-${exerciceId}`);
    if (!itemEl) return;

    const estDuree = Number.isInteger(dureeActuelleSecondes);

    itemEl.innerHTML = estDuree ? `
        <div class="sport-routine-exercice-edit">
            <span class="sport-routine-exercice-edit-nom">${_sportEchapper(nom)}</span>
            <div class="sport-routine-exercice-edit-champs">
                <input type="number" id="sport-edit-duree-${exerciceId}"
                       value="${_sportSecondesVersMinutes(dureeActuelleSecondes)}" min="1" placeholder="Durée (min)">
                <span>min</span>
            </div>
            <div class="sport-routine-exercice-edit-actions">
                <button class="btn-save" id="sport-edit-save-${exerciceId}">Sauvegarder</button>
                <button class="btn-cancel" id="sport-edit-cancel-${exerciceId}">Annuler</button>
            </div>
        </div>` : `
        <div class="sport-routine-exercice-edit">
            <span class="sport-routine-exercice-edit-nom">${_sportEchapper(nom)}</span>
            <div class="sport-routine-exercice-edit-champs">
                <input type="number" id="sport-edit-sets-${exerciceId}" value="${setsActuel}" min="1" placeholder="Séries">
                <span class="sport-edit-icone-x">${SPORT_ICONE_X}</span>
                <input type="number" id="sport-edit-reps-${exerciceId}" value="${repsActuel}" min="1" placeholder="Reps">
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
        let body;
        if (estDuree) {
            const minutes = parseInt(document.getElementById(`sport-edit-duree-${exerciceId}`).value, 10) || 1;
            body = { target_duration_seconds: _sportMinutesVersSecondes(minutes) };
        } else {
            const sets = parseInt(document.getElementById(`sport-edit-sets-${exerciceId}`).value, 10) || 1;
            const reps = parseInt(document.getElementById(`sport-edit-reps-${exerciceId}`).value, 10) || 1;
            body = { target_sets: sets, target_reps: reps };
        }
        try {
            await fetch(`/api/sport/exercises/${exerciceId}`, {
                method : 'PUT',
                headers: _sportAuthHeaders(),
                body   : JSON.stringify(body)
            });
            _sportOuvrirDetailRoutine(_sportRoutineDetailActive.workoutId);
        } catch (err) {
            console.error('[SPORT] editerExercice :', err.message);
        }
    });
}

// ── Sélecteur d'exercice (remplace l'ancien onglet Catalogue) ──

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
                <input type="text"
                       id="sport-selecteur-search"
                       class="sport-catalogue-search"
                       placeholder="Rechercher un exercice…"
                       autocomplete="off">
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
            _sportSelecteurOffset       = 0;
            _sportSelecteurPageActuelle = 1;
            _sportRechercherExercicesSelecteur();
        }, 400);
    });

    document.getElementById('sport-selecteur-filtre-categorie').addEventListener('change', () => {
        _sportSelecteurOffset       = 0;
        _sportSelecteurPageActuelle = 1;
        _sportRechercherExercicesSelecteur();
    });

    document.getElementById('sport-selecteur-filtre-equipement').addEventListener('change', () => {
        _sportSelecteurOffset       = 0;
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

// ── Charge catégories/équipements (une fois par ouverture) ──
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

// ── Recherche exercices selon filtres/texte/pagination ──
async function _sportRechercherExercicesSelecteur() {
    const zone = document.getElementById('sport-selecteur-resultats');
    if (!zone) return;

    const search     = document.getElementById('sport-selecteur-search')?.value.trim() || '';
    const categorie  = document.getElementById('sport-selecteur-filtre-categorie')?.value || '';
    const equipement = document.getElementById('sport-selecteur-filtre-equipement')?.value || '';

    zone.innerHTML = `<p class="sport-catalogue-loading">Recherche en cours…</p>`;

    try {
        const params = new URLSearchParams({
            limit : String(SPORT_SELECTEUR_LIMIT),
            offset: String(_sportSelecteurOffset)
        });
        if (search)     params.set('search', search);
        if (categorie)  params.set('category', categorie);
        if (equipement) params.set('equipment', equipement);

        const r = await fetch(`/api/sport/wger/exercises?${params.toString()}`, {
            headers: _sportAuthHeaders()
        });
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

// ── Grille de résultats + pagination (has_more) ──
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

// ── Mini-formulaire séries/reps ou durée après sélection ──
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
            ${estDuree ? `
            <div class="sport-routine-exercice-edit-champs" style="margin:16px 0">
                <input type="number" id="sport-ajout-duree" value="20" min="1" placeholder="Durée (min)">
                <span>min</span>
            </div>` : `
            <div class="sport-routine-exercice-edit-champs" style="margin:16px 0">
                <input type="number" id="sport-ajout-sets" value="3" min="1" placeholder="Séries">
                <span class="sport-edit-icone-x">${SPORT_ICONE_X}</span>
                <input type="number" id="sport-ajout-reps" value="10" min="1" placeholder="Reps">
            </div>`}
            <div id="sport-ajout-msg" class="sport-routine-msg-erreur"></div>
            <button class="sport-cta-btn" onclick="_sportValiderAjoutExercice(${exercice.wger_exercise_id}, '${_sportEchapperJs(exercice.name)}', ${estDuree})">
                Ajouter à la routine
            </button>
        </div>
    `;
}

// Échappement pour insertion dans un attribut onclick (guillemets simples)
function _sportEchapperJs(str) {
    return (str || '').replace(/'/g, "\\'");
}

// ── Ajout effectif de l'exercice ──
async function _sportValiderAjoutExercice(wgerExerciseId, exerciseName, estDuree) {
    const msg = document.getElementById('sport-ajout-msg');

    if (!_sportRoutineDetailActive?.dayId) {
        if (msg) msg.textContent = 'Erreur : routine mal initialisée.';
        return;
    }

    const body = {
        wger_exercise_id: wgerExerciseId,
        exercise_name   : exerciseName
    };

    if (estDuree) {
        const minutes = parseInt(document.getElementById('sport-ajout-duree').value, 10) || 1;
        body.target_duration_seconds = _sportMinutesVersSecondes(minutes);
    } else {
        body.target_sets = parseInt(document.getElementById('sport-ajout-sets').value, 10) || 3;
        body.target_reps = parseInt(document.getElementById('sport-ajout-reps').value, 10) || 10;
    }

    try {
        const r = await fetch(`/api/sport/days/${_sportRoutineDetailActive.dayId}/exercises`, {
            method : 'POST',
            headers: _sportAuthHeaders(),
            body   : JSON.stringify(body)
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

// ── Phrases d'encouragement (widget colonne droite) ──
const SPORT_PHRASES_ENCOURAGEMENT = [
    "Chaque séance compte, même la plus courte. Lancez-vous !",
    "Votre progression commence par un premier pas.",
    "Aujourd'hui est un bon jour pour bouger un peu.",
    "Pas de séance cette semaine ? Il n'est jamais trop tard.",
    "Votre corps vous remerciera pour chaque effort, même petit."
];

// ── Widget Sport Stats (colonne droite, global) ──
function chargerSportStatsWidget() {
    const zone = document.getElementById('sport-stats-widget');
    if (!zone) return;

    const phrase = SPORT_PHRASES_ENCOURAGEMENT[
        Math.floor(Math.random() * SPORT_PHRASES_ENCOURAGEMENT.length)
    ];

    zone.innerHTML = `
        <div class="sport-stats-header">
            <h3 class="sport-stats-title">${SPORT_ICONE_DUMBBELL} Sport</h3>
            <button class="sport-stats-arrow" onclick="switchTab('sport')" title="Aller au module Sport">
                ${SPORT_ICONE_FLECHE}
            </button>
        </div>
        <p class="sport-stats-text">${phrase}</p>
    `;
}
