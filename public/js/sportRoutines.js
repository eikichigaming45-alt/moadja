// public/js/sportRoutines.js
// Module Sport — Mes Routines : liste, création, détail, édition/suppression
// d'exercice, réorganisation par glisser-déposer.
// Dépend de sport-widget.js et sport.js chargés AVANT (auth, échappement,
// icônes, modales génériques _sportOuvrirConfirmationSuppression, etc.).

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
