// ============================================================
// public/js/sport.js
// Logique du module Sport (WGER) : Dashboard, Mes Routines.
// Auth : token Bearer stocké dans localStorage['moadja_user'].token
// (même mécanisme que le reste du site, cf. tchat.js).
//
// Mes Routines : une routine = un nom libre + une liste d'exercices
// (séries/reps cibles). Techniquement, le schéma SQL impose un
// niveau "jour" (sport_workout_days) entre la routine et ses
// exercices : un jour unique et invisible est créé automatiquement
// à la création de chaque routine, jamais montré à l'écran.
//
// Le sélecteur d'exercice (recherche + filtres + grille) reprend
// le moteur déjà validé pour l'ex-onglet Catalogue (retiré du menu
// car jugé peu utile en tant qu'onglet autonome) : il s'ouvre
// désormais uniquement depuis le détail d'une routine, via
// "Ajouter un exercice".
//
// Confirmation de suppression : inline, dans la zone concernée,
// texte "Confirmer la suppression ?", classes globales
// .btn-delete / .btn-cancel (esprit taches.js), jamais de confirm().
// ============================================================

const SPORT_ICONE_DUMBBELL = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="2.5"  y1="7" x2="2.5"  y2="17"></line>
        <line x1="5.5"  y1="9" x2="5.5"  y2="15"></line>
        <line x1="18.5" y1="9" x2="18.5" y2="15"></line>
        <line x1="21.5" y1="7" x2="21.5" y2="17"></line>
        <line x1="5.5" y1="12" x2="18.5" y2="12"></line>
    </svg>
`;

// Icône flèche (bouton d'accès rapide vers l'onglet Sport)
const SPORT_ICONE_FLECHE = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14"></path>
        <path d="M12 5l7 7-7 7"></path>
    </svg>
`;

// Icône générique utilisée quand un exercice n'a pas d'image (sélecteur)
const SPORT_ICONE_PAS_IMAGE = `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
`;

let _sportSectionActive = 'dashboard';

// ── Construction initiale du module Sport ──────────────────
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

// ── Rendu de la vue Dashboard (état "aucune activité") ────────
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

// ── Changement de section via les pilules ─────────────────────
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

// ────────────────────────────────────────────────────────────
// AUTH — même mécanisme que le reste du site
// ────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────
// MES ROUTINES — liste, création, détail, suppression
// Une routine = nom libre + liste d'exercices directe.
// Le "jour" (sport_workout_days) est créé automatiquement et
// silencieusement à la création d'une routine, jamais affiché.
// ────────────────────────────────────────────────────────────

let _sportRoutineDetailActive = null; // { workoutId, dayId }

// ── Vue liste des routines ─────────────────────────────────────
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

// ── Création d'une routine (+ jour caché automatique) ──────────
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

        // Création silencieuse du jour unique (pont technique invisible)
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

// ── Suppression d'une routine (confirmation inline) ─────────────
function _sportConfirmerSuppressionRoutine(workoutId, carteEl) {
    if (carteEl.querySelector('.sport-confirm-suppr')) return;

    const confirm = document.createElement('div');
    confirm.className = 'sport-confirm-suppr';
    confirm.innerHTML = `
        <span class="sport-confirm-suppr-texte">Confirmer la suppression ?</span>
        <div class="sport-confirm-suppr-actions">
            <button class="btn-delete">Confirmer</button>
            <button class="btn-cancel">Annuler</button>
        </div>`;

    carteEl.appendChild(confirm);

    confirm.querySelector('.btn-cancel').addEventListener('click', (e) => {
        e.stopPropagation();
        confirm.remove();
    });

    confirm.querySelector('.btn-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await fetch(`/api/sport/workouts/${workoutId}`, {
                method : 'DELETE',
                headers: _sportAuthHeaders()
            });
            _sportChargerListeRoutines();
        } catch (err) {
            console.error('[SPORT] supprimerRoutine :', err.message);
            confirm.remove();
        }
    });
}

// ── Détail d'une routine (liste des exercices) ──────────────────
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
            <div id="sport-routine-suppr-msg"></div>

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
                    ${exercices.map(ex => `
                        <div class="sport-routine-exercice-item" id="sport-exercice-${ex.id}">
                            <div class="sport-routine-exercice-info">
                                <div class="sport-routine-exercice-nom">${_sportEchapper(ex.exercise_name)}</div>
                                <div class="sport-routine-exercice-meta">${ex.target_sets} séries × ${ex.target_reps} reps</div>
                            </div>
                            <button class="sport-routine-exercice-btn-edit" data-exercice-id="${ex.id}"
                                    data-sets="${ex.target_sets}" data-reps="${ex.target_reps}"
                                    data-nom="${_sportEchapper(ex.exercise_name)}" title="Modifier">✏️</button>
                            <button class="sport-routine-exercice-btn-del" data-exercice-id="${ex.id}" title="Supprimer">🗑️</button>
                        </div>
                    `).join('')}
                </div>
            `}
            <button class="sport-cta-btn" style="margin-top:16px" onclick="_sportOuvrirSelecteurExercice()">
                + Ajouter un exercice
            </button>
        </div>
    `;

    document.querySelector('.sport-routine-btn-suppr-routine').addEventListener('click', (e) => {
        _sportConfirmerSuppressionRoutineDetail(workout.id, e.currentTarget);
    });

    zone.querySelectorAll('.sport-routine-exercice-btn-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
            _sportConfirmerSuppressionExercice(
                parseInt(btn.dataset.exerciceId, 10),
                btn.closest('.sport-routine-exercice-item')
            );
        });
    });

    zone.querySelectorAll('.sport-routine-exercice-btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            _sportEditerExercice(
                parseInt(btn.dataset.exerciceId, 10),
                btn.dataset.nom,
                parseInt(btn.dataset.sets, 10),
                parseInt(btn.dataset.reps, 10)
            );
        });
    });
}

// ── Suppression de la routine depuis le détail (confirmation inline) ──
function _sportConfirmerSuppressionRoutineDetail(workoutId, btnEl) {
    const msgZone = document.getElementById('sport-routine-suppr-msg');
    if (!msgZone || msgZone.querySelector('.sport-confirm-suppr')) return;

    msgZone.innerHTML = `
        <div class="sport-confirm-suppr">
            <span class="sport-confirm-suppr-texte">Confirmer la suppression ?</span>
            <div class="sport-confirm-suppr-actions">
                <button class="btn-delete" id="sport-suppr-routine-oui">Confirmer</button>
                <button class="btn-cancel" id="sport-suppr-routine-non">Annuler</button>
            </div>
        </div>`;

    document.getElementById('sport-suppr-routine-non').addEventListener('click', () => {
        msgZone.innerHTML = '';
    });

    document.getElementById('sport-suppr-routine-oui').addEventListener('click', async () => {
        try {
            await fetch(`/api/sport/workouts/${workoutId}`, {
                method : 'DELETE',
                headers: _sportAuthHeaders()
            });
            _sportChargerListeRoutines();
        } catch (err) {
            console.error('[SPORT] supprimerRoutineDetail :', err.message);
            msgZone.innerHTML = '';
        }
    });
}

// ── Suppression d'un exercice de routine (confirmation inline) ──
function _sportConfirmerSuppressionExercice(exerciceId, itemEl) {
    if (itemEl.querySelector('.sport-confirm-suppr')) return;

    const confirm = document.createElement('div');
    confirm.className = 'sport-confirm-suppr';
    confirm.innerHTML = `
        <span class="sport-confirm-suppr-texte">Confirmer la suppression ?</span>
        <div class="sport-confirm-suppr-actions">
            <button class="btn-delete">Confirmer</button>
            <button class="btn-cancel">Annuler</button>
        </div>`;

    itemEl.appendChild(confirm);

    confirm.querySelector('.btn-cancel').addEventListener('click', () => confirm.remove());

    confirm.querySelector('.btn-delete').addEventListener('click', async () => {
        try {
            await fetch(`/api/sport/exercises/${exerciceId}`, {
                method : 'DELETE',
                headers: _sportAuthHeaders()
            });
            _sportOuvrirDetailRoutine(_sportRoutineDetailActive.workoutId);
        } catch (err) {
            console.error('[SPORT] supprimerExercice :', err.message);
            confirm.remove();
        }
    });
}

// ── Modification séries/reps d'un exercice ──────────────────────
function _sportEditerExercice(exerciceId, nom, setsActuel, repsActuel) {
    const itemEl = document.getElementById(`sport-exercice-${exerciceId}`);
    if (!itemEl) return;

    itemEl.innerHTML = `
        <div class="sport-routine-exercice-edit">
            <span class="sport-routine-exercice-edit-nom">${_sportEchapper(nom)}</span>
            <div class="sport-routine-exercice-edit-champs">
                <input type="number" id="sport-edit-sets-${exerciceId}" value="${setsActuel}" min="1" placeholder="Séries">
                <span>×</span>
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
        const sets = parseInt(document.getElementById(`sport-edit-sets-${exerciceId}`).value, 10) || 1;
        const reps = parseInt(document.getElementById(`sport-edit-reps-${exerciceId}`).value, 10) || 1;
        try {
            await fetch(`/api/sport/exercises/${exerciceId}`, {
                method : 'PUT',
                headers: _sportAuthHeaders(),
                body   : JSON.stringify({ target_sets: sets, target_reps: reps })
            });
            _sportOuvrirDetailRoutine(_sportRoutineDetailActive.workoutId);
        } catch (err) {
            console.error('[SPORT] editerExercice :', err.message);
        }
    });
}

// ────────────────────────────────────────────────────────────
// SÉLECTEUR D'EXERCICE — remplace l'ancien onglet Catalogue.
// Ouvert uniquement depuis le détail d'une routine.
// Reprend le moteur de recherche déjà validé (agrégation par
// lots, traductions FR, has_more) : aucun changement de logique
// de recherche ici, uniquement le contexte d'affichage change.
// ────────────────────────────────────────────────────────────

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

// ── Charge les listes de catégories et d'équipements (une seule fois par ouverture) ──
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

// ── Recherche les exercices selon les filtres/texte/pagination actuels ──
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

// ── Affiche la grille de résultats du sélecteur + pagination (has_more) ──
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

// ── Mini-formulaire séries/reps après sélection d'un exercice ──────
function _sportOuvrirFormulaireAjoutExercice(exercice) {
    const zone = document.getElementById('sport-routines-zone');
    if (!zone || !_sportRoutineDetailActive) return;

    zone.innerHTML = `
        <div class="sport-card">
            <div class="sport-routine-detail-header">
                <button class="sport-routine-btn-retour" onclick="_sportOuvrirSelecteurExercice()">‹ Retour</button>
            </div>
            <div class="sport-routine-detail-nom">${_sportEchapper(exercice.name)}</div>
            <div class="sport-routine-exercice-edit-champs" style="margin:16px 0">
                <input type="number" id="sport-ajout-sets" value="3" min="1" placeholder="Séries">
                <span>×</span>
                <input type="number" id="sport-ajout-reps" value="10" min="1" placeholder="Reps">
            </div>
            <div id="sport-ajout-msg" class="sport-routine-msg-erreur"></div>
            <button class="sport-cta-btn" onclick="_sportValiderAjoutExercice(${exercice.wger_exercise_id}, '${_sportEchapperJs(exercice.name)}')">
                Ajouter à la routine
            </button>
        </div>
    `;
}

// Échappement pour insertion dans un attribut onclick (guillemets simples)
function _sportEchapperJs(str) {
    return (str || '').replace(/'/g, "\\'");
}

// ── Ajout effectif de l'exercice à la routine ───────────────────
async function _sportValiderAjoutExercice(wgerExerciseId, exerciseName) {
    const msg  = document.getElementById('sport-ajout-msg');
    const sets = parseInt(document.getElementById('sport-ajout-sets').value, 10) || 3;
    const reps = parseInt(document.getElementById('sport-ajout-reps').value, 10) || 10;

    if (!_sportRoutineDetailActive?.dayId) {
        if (msg) msg.textContent = 'Erreur : routine mal initialisée.';
        return;
    }

    try {
        const r = await fetch(`/api/sport/days/${_sportRoutineDetailActive.dayId}/exercises`, {
            method : 'POST',
            headers: _sportAuthHeaders(),
            body   : JSON.stringify({
                wger_exercise_id: wgerExerciseId,
                exercise_name   : exerciseName,
                target_sets     : sets,
                target_reps     : reps
            })
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

// ── Phrases d'encouragement (widget colonne droite) ────────────
const SPORT_PHRASES_ENCOURAGEMENT = [
    "Chaque séance compte, même la plus courte. Lancez-vous !",
    "Votre progression commence par un premier pas.",
    "Aujourd'hui est un bon jour pour bouger un peu.",
    "Pas de séance cette semaine ? Il n'est jamais trop tard.",
    "Votre corps vous remerciera pour chaque effort, même petit."
];

// ── Widget Sport Stats (colonne droite, global à tous les onglets) ─
// Toutes les classes utilisées ici sont définies dans public/css/sport.css
// (.sport-stats-header, .sport-stats-title, .sport-stats-arrow, .sport-stats-text)
// — aucun style inline, conformément à la règle établie.
function chargerSportStatsWidget() {
    const zone = document.getElementById('sport-stats-widget');
    if (!zone) return;

    // Étape actuelle : aucune donnée réelle (pas d'API branchée).
    // On affiche systématiquement une phrase d'encouragement aléatoire.
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
