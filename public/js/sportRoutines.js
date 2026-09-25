// public/js/sportRoutines.js
// Module Sport — Mes Routines : liste, création, détail, édition/suppression
// d'exercice, réorganisation par glisser-déposer, renommage/suppression de routine.
// Dépend de sport-widget.js et sport.js chargés AVANT (auth, échappement,
// icônes, modales génériques _sportOuvrirConfirmationSuppression, etc.).

let _sportRoutineDetailActive   = null;  // { workoutId, dayId }
let _sportGlissementJusteTermine = false; // évite d'ouvrir une routine juste après un drag

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
                    <div class="sport-routine-carte" id="sport-routine-carte-${w.id}" data-workout-id="${w.id}" onclick="_sportOuvrirDetailRoutine(${w.id})">
                        <span class="sport-routine-drag-handle" style="cursor:grab; color:#9ca3af; display:flex; align-items:center; margin-right:4px;" title="Glisser pour réordonner">${SPORT_ICONE_POIGNEE}</span>
                        <div class="sport-routine-carte-icone">${SPORT_ICONE_DUMBBELL}</div>
                        <div class="sport-routine-carte-info">
                            <div class="sport-routine-carte-nom">${_sportEchapper(w.name)}</div>
                            <div class="sport-routine-carte-meta">Voir les exercices</div>
                        </div>
                        <button class="sport-routine-exercice-btn-edit" data-workout-id="${w.id}"
                                data-nom="${_sportEchapper(w.name)}" title="Renommer">✏️</button>
                        <button class="sport-routine-exercice-btn-del" data-workout-id="${w.id}" title="Supprimer">${SPORT_ICONE_POUBELLE}</button>
                    </div>
                `).join('')}
            </div>
        `}
    `;

    document.getElementById('sport-routine-nouveau-nom').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _sportCreerRoutine();
    });

    zone.querySelectorAll('.sport-routine-carte .sport-routine-exercice-btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            _sportRenommerRoutineCarte(parseInt(btn.dataset.workoutId, 10), btn.dataset.nom);
        });
    });

    zone.querySelectorAll('.sport-routine-carte .sport-routine-exercice-btn-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            _sportConfirmerSuppressionRoutine(parseInt(btn.dataset.workoutId, 10));
        });
    });

    _sportInitDragAndDropRoutines(zone);
}

// ── Drag & Drop des routines ──
// Mécanisme unifié basé sur les Pointer Events (souris, tactile, stylet),
// actif sur toute la ligne (pas seulement une poignée).
// - Souris : le glissement démarre dès qu'un mouvement dépasse le seuil de
//   10px, comportement instantané.
// - Tactile (Android/iOS) : le glissement ne s'arme qu'après un appui
//   maintenu de DELAI_ARMEMENT_MS sans déplacement significatif. Si le doigt
//   bouge avant ce délai, le geste est laissé au scroll natif de la page
//   (le timer est annulé). Ce délai lève l'ambiguïté entre "je veux scroller"
//   et "je veux réordonner", qui posait problème avec touch-action seul.
// Un seul système actif sur toutes les plateformes : plus de concurrence
// avec un drag natif HTML5 (draggable retiré) ni avec le compositeur tactile.
function _sportInitDragAndDropRoutines(zone) {
    const liste = zone.querySelector('.sport-routine-liste');
    if (!liste) return;

    const SEUIL_DEPLACEMENT_PX = 10;
    const DELAI_ARMEMENT_MS    = 250;

    let itemActif     = null;
    let pointerId     = null;
    let pointerType   = null;
    let enGlissement  = false;
    let arme          = false;
    let timerArmement = null;
    let departX = 0, departY = 0;

    function annulerTimer() {
        if (timerArmement) {
            clearTimeout(timerArmement);
            timerArmement = null;
        }
    }

    function demarrerGlissement(item) {
        enGlissement = true;
        item.setPointerCapture(pointerId);
        item.style.opacity = '0.4';
    }

    function reinitialiser() {
        annulerTimer();
        itemActif    = null;
        pointerId    = null;
        pointerType  = null;
        enGlissement = false;
        arme         = false;
    }

    liste.querySelectorAll('.sport-routine-carte').forEach(item => {
        item.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;       // ne pas interférer avec ✏️ / 🗑️
            if (item.dataset.dragLock === '1') return;     // désactivé pendant le renommage
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            itemActif   = item;
            pointerId   = e.pointerId;
            pointerType = e.pointerType;
            enGlissement = false;
            arme         = false;
            departX = e.clientX;
            departY = e.clientY;

            if (pointerType !== 'mouse') {
                // Tactile : on arme le drag après un appui maintenu.
                timerArmement = setTimeout(() => {
                    if (!itemActif) return;
                    arme = true;
                    demarrerGlissement(itemActif);
                }, DELAI_ARMEMENT_MS);
            }
        });
    });

    liste.addEventListener('pointermove', (e) => {
        if (!itemActif || e.pointerId !== pointerId) return;
        const dx = e.clientX - departX;
        const dy = e.clientY - departY;
        const depasseSeuil = Math.abs(dx) >= SEUIL_DEPLACEMENT_PX || Math.abs(dy) >= SEUIL_DEPLACEMENT_PX;

        if (!enGlissement) {
            if (pointerType === 'mouse') {
                if (!depasseSeuil) return;
                demarrerGlissement(itemActif);
            } else {
                // Tactile : tant que le drag n'est pas armé par le timer,
                // un mouvement significatif annule le drag (= scroll normal).
                if (depasseSeuil && !arme) {
                    reinitialiser();
                    return;
                }
                if (!arme) return; // en attente de l'armement par le timer
            }
        }

        e.preventDefault();
        const cible = document.elementFromPoint(e.clientX, e.clientY);
        const item  = cible?.closest('.sport-routine-carte');
        if (!item || item === itemActif) return;

        const rect = item.getBoundingClientRect();
        const apresMilieu = e.clientY > rect.top + rect.height / 2;

        if (apresMilieu) {
            item.after(itemActif);
        } else {
            item.before(itemActif);
        }
    }, { passive: false });

    liste.addEventListener('pointerup', (e) => {
        if (!itemActif || e.pointerId !== pointerId) return;
        if (enGlissement) {
            itemActif.style.opacity = '1';
            itemActif.releasePointerCapture(pointerId);
            _sportSauvegarderOrdreRoutines(liste);
            _sportGlissementJusteTermine = true;
            setTimeout(() => { _sportGlissementJusteTermine = false; }, 50);
        }
        reinitialiser();
    });

    liste.addEventListener('pointercancel', (e) => {
        if (!itemActif || e.pointerId !== pointerId) return;
        if (enGlissement) itemActif.style.opacity = '1';
        reinitialiser();
    });
}

async function _sportSauvegarderOrdreRoutines(liste) {
    const ordre = Array.from(liste.querySelectorAll('.sport-routine-carte'))
        .map(item => parseInt(item.dataset.workoutId, 10));

    try {
        await fetch('/api/sport/workouts/reorder', {
            method : 'PUT',
            headers: _sportAuthHeaders(),
            body   : JSON.stringify({ ordre })
        });
    } catch (err) {
        console.error('[SPORT] sauvegarderOrdreRoutines :', err.message);
        _sportChargerListeRoutines();
    }
}

// ── Renommage inline d'une routine depuis la liste ──
function _sportRenommerRoutineCarte(workoutId, nomActuel) {
    const carte = document.getElementById(`sport-routine-carte-${workoutId}`);
    if (!carte) return;

    carte.onclick = null;
    carte.dataset.dragLock = '1'; // Désactiver le drag pendant l'édition
    carte.innerHTML = `
        <div class="sport-routine-carte-icone">${SPORT_ICONE_DUMBBELL}</div>
        <div class="sport-routine-carte-info" style="display:flex;flex-direction:column;gap:8px">
            <input type="text" id="sport-routine-rename-input-${workoutId}" class="sport-catalogue-search"
                   value="${_sportEchapper(nomActuel)}" autocomplete="off" style="width:100%">
            <div class="sport-routine-exercice-edit-actions">
                <button class="btn-save" id="sport-routine-rename-save-${workoutId}">Sauvegarder</button>
                <button class="btn-cancel" id="sport-routine-rename-cancel-${workoutId}">Annuler</button>
            </div>
        </div>
    `;

    document.getElementById(`sport-routine-rename-cancel-${workoutId}`).addEventListener('click', (e) => {
        e.stopPropagation();
        _sportChargerListeRoutines();
    });

        document.getElementById(`sport-routine-rename-save-${workoutId}`).addEventListener('click', async (e) => {
        e.stopPropagation();
        const input = document.getElementById(`sport-routine-rename-input-${workoutId}`);
        const nouveauNom = input?.value.trim();
        if (!nouveauNom) return;

        try {
            await fetch(`/api/sport/workouts/${workoutId}`, {
                method: 'PUT', headers: _sportAuthHeaders(), body: JSON.stringify({ name: nouveauNom })
            });
            _sportChargerListeRoutines();
        } catch (err) {
            console.error('[SPORT] renommerRoutine :', err.message);
        }
    });
}

// ── Suppression d'une routine depuis la liste ──
function _sportConfirmerSuppressionRoutine(workoutId) {
    _sportOuvrirConfirmationSuppression(async () => {
        try {
            await fetch(`/api/sport/workouts/${workoutId}`, { method: 'DELETE', headers: _sportAuthHeaders() });
            _sportChargerListeRoutines();
        } catch (err) {
            console.error('[SPORT] supprimerRoutine :', err.message);
        }
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
    if (_sportGlissementJusteTermine) return; // évite d'ouvrir la routine juste après un drag

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
            <div class="sport-routine-detail-nom">${_sportEchapper(workout.name)}</div>
            <button class="sport-cta-btn" style="width:100%;justify-content:center" onclick="_sportDemarrerSeance(${workout.id})">
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
                        <div class="sport-routine-exercice-item" id="sport-exercice-${ex.id}" data-exercice-id="${ex.id}">
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
            <button class="sport-cta-btn" style="width:100%;justify-content:center;margin-top:16px" onclick="_sportOuvrirSelecteurExercice()">
                + Ajouter un exercice
            </button>
        </div>
    `;

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

// ── Drag & Drop des exercices d'une routine ──
// Même mécanisme unifié que pour les routines : Pointer Events sur toute la
// ligne, avec armement différé (250ms) sur tactile pour laisser le scroll
// natif fonctionner tant que l'utilisateur n'a pas manifestement l'intention
// de réordonner (appui maintenu immobile).
function _sportInitDragAndDropExercices(zone, workoutId) {
    const liste = zone.querySelector('.sport-routine-exercices-liste');
    if (!liste) return;

    const SEUIL_DEPLACEMENT_PX = 10;
    const DELAI_ARMEMENT_MS    = 250;

    let itemActif     = null;
    let pointerId     = null;
    let pointerType   = null;
    let enGlissement  = false;
    let arme          = false;
    let timerArmement = null;
    let departX = 0, departY = 0;

    function annulerTimer() {
        if (timerArmement) {
            clearTimeout(timerArmement);
            timerArmement = null;
        }
    }

    function demarrerGlissement(item) {
        enGlissement = true;
        item.setPointerCapture(pointerId);
        item.classList.add('sport-exercice-en-glissement');
    }

    function reinitialiser() {
        annulerTimer();
        itemActif    = null;
        pointerId    = null;
        pointerType  = null;
        enGlissement = false;
        arme         = false;
    }

    liste.querySelectorAll('.sport-routine-exercice-item').forEach(item => {
        item.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;       // ne pas interférer avec ✏️ / 🗑️
            if (e.target.closest('input')) return;         // ne pas interférer avec les champs d'édition
            if (item.dataset.dragLock === '1') return;     // désactivé pendant l'édition
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            itemActif   = item;
            pointerId   = e.pointerId;
            pointerType = e.pointerType;
            enGlissement = false;
            arme         = false;
            departX = e.clientX;
            departY = e.clientY;

            if (pointerType !== 'mouse') {
                timerArmement = setTimeout(() => {
                    if (!itemActif) return;
                    arme = true;
                    demarrerGlissement(itemActif);
                }, DELAI_ARMEMENT_MS);
            }
        });
    });

    liste.addEventListener('pointermove', (e) => {
        if (!itemActif || e.pointerId !== pointerId) return;
        const dx = e.clientX - departX;
        const dy = e.clientY - departY;
        const depasseSeuil = Math.abs(dx) >= SEUIL_DEPLACEMENT_PX || Math.abs(dy) >= SEUIL_DEPLACEMENT_PX;

        if (!enGlissement) {
            if (pointerType === 'mouse') {
                if (!depasseSeuil) return;
                demarrerGlissement(itemActif);
            } else {
                if (depasseSeuil && !arme) {
                    reinitialiser();
                    return;
                }
                if (!arme) return;
            }
        }

        e.preventDefault();
        const cible = document.elementFromPoint(e.clientX, e.clientY);
        const item  = cible?.closest('.sport-routine-exercice-item');
        if (!item || item === itemActif) return;

        const rect = item.getBoundingClientRect();
        const apresMilieu = e.clientY > rect.top + rect.height / 2;

        if (apresMilieu) {
            item.after(itemActif);
        } else {
            item.before(itemActif);
        }
        }, { passive: false });

    liste.addEventListener('pointerup', (e) => {
        if (!itemActif || e.pointerId !== pointerId) return;
        if (enGlissement) {
            itemActif.classList.remove('sport-exercice-en-glissement');
            itemActif.releasePointerCapture(pointerId);
            _sportSauvegarderOrdreExercices(liste, workoutId);
        }
        reinitialiser();
    });

    liste.addEventListener('pointercancel', (e) => {
        if (!itemActif || e.pointerId !== pointerId) return;
        if (enGlissement) itemActif.classList.remove('sport-exercice-en-glissement');
        reinitialiser();
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

    itemEl.dataset.dragLock = '1'; // Désactiver le drag pendant l'édition

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
