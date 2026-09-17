// public/js/sportSeance.js
// Module Sport — Séance en cours : démarrage/reprise, écran de séance,
// chronos (global + timers de série), validation des logs, repos entre
// séries, clôture (terminer/abandonner).
// Dépend de sport-widget.js et sport.js chargés AVANT (auth, échappement,
// icônes, Wake Lock, chargerSportDashboard, modales génériques).

let _sportSeanceActive         = null; // { id, workout_id, logs: [...] }
let _sportSeanceExercices      = [];   // liste des exercices de la routine
let _sportSeanceChronoInterval = null;
let _sportSeanceReposInterval  = null;
let _sportSeryTimers           = {};   // Stockage des chronos individuels (exercices en durée)
let _sportReposActif           = null; // { exIndex, restant }
let _sportAudioCtx             = null; // Contexte global pour contourner le blocage iOS

// Initialise et déverrouille l'audio au premier clic utilisateur (requis par iOS)
function _sportInitAudio() {
    if (!_sportAudioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            _sportAudioCtx = new AudioContext();
        }
    }
    if (_sportAudioCtx && _sportAudioCtx.state === 'suspended') {
        _sportAudioCtx.resume();
    }
}

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
        _sportInitAudio();
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
    _sportInitAudio();
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
    clearInterval(_sportSeanceReposInterval);
    _sportSeryTimers = {};
    _sportReposActif = null;
    _sportSeanceChronoInterval = setInterval(_sportMettreAJourChronoSeance, 1000);

    // FIX SCROLL: Utilisation de Flexbox pour créer une zone de défilement interne parfaite.
    // Le conteneur parent prend la hauteur de l'écran (moins la navbar estimée à 100px).
    // Le bloc haut est fixe (flex-shrink: 0).
    // Le bloc bas défile (flex: 1, overflow-y: auto) sans affecter la page entière.
    zoneGlobale.innerHTML = `
        <div class="sport-wrap" style="height: calc(100vh - 100px); display: flex; flex-direction: column; overflow: hidden; padding-bottom: 0;">
            
            <div class="sport-card" style="flex-shrink: 0; margin-bottom: 12px; z-index: 10; border-bottom: 1px solid rgba(255,255,255,0.4); box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                <div class="sport-seance-header-top" style="margin-bottom: 0; align-items: center;">
                    <span id="sport-seance-chrono" class="sport-seance-nom">00:00</span>
                    <button class="sport-seance-btn-abandon" id="sport-seance-btn-terminer">Terminer</button>
                </div>
                <div id="sport-seance-repos-zone" style="display: none; margin-top: 16px;"></div>
            </div>
            
            <div class="sport-card" style="flex: 1; overflow-y: auto; margin-top: 0; padding-top: 12px;">
                <div id="sport-seance-contenu"></div>
            </div>
            
        </div>
    `;

    document.getElementById('sport-seance-btn-terminer').addEventListener('click', () => {
        _sportInitAudio();
        _sportConfirmerFinSeance();
    });

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

function _sportRenderBandeauRepos(restant) {
    return `
        <div class="sport-seance-repos-ligne" style="margin-bottom: 0;">
            <span class="sport-seance-repos-label">Temps de repos</span>
            <span class="sport-seance-repos-chrono" id="sport-repos-badge">${_sportFormatChrono(restant)}</span>
        </div>
    `;
}

function _sportRenderTousLesExercices() {
    const zone = document.getElementById('sport-seance-contenu');
    if (!zone) return;

    let html = '';

    _sportSeanceExercices.forEach((ex, index) => {
        const estDuree = Number.isInteger(ex.target_duration_seconds);
        const logsExerciceExistants = (_sportSeanceActive.logs || []).filter(l =>
            l.exIndex !== undefined ? l.exIndex === index : l.wger_exercise_id === ex.wger_exercise_id
        );

        html += `<div class="sport-seance-exercice-bloc" style="${index > 0 ? 'margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(167, 139, 250, 0.2);' : ''}">`;
        html += `
                <div class="sport-seance-exercice-nom" style="margin-bottom: 12px; font-size: 16px;">${_sportEchapper(ex.exercise_name)}</div>
                ${estDuree ? _sportRenderFormulaireDuree(ex, logsExerciceExistants, index) : _sportRenderFormulaireSeries(ex, logsExerciceExistants, index)}
            </div>
        `;
    });

    // Espace vide à la fin pour pouvoir scroller confortablement jusqu'au dernier bouton Check
    html += `<div style="height: 60px;"></div>`;

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
            <div class="sport-seance-table-header" style="grid-template-columns: 40px 1fr 1fr 40px 40px">
                <span>Série</span>
                <span style="text-align:center;">Poids (kg)</span>
                <span style="text-align:center;">Reps</span>
                <span></span><span></span>
            </div>
            ${lignes.map(l => `
                <div class="sport-seance-table-row ${l.log?.completed ? 'sport-seance-row-validee' : ''}" style="grid-template-columns: 40px 1fr 1fr 40px 40px">
                    <span class="sport-seance-serie-numero">${l.numero}</span>
                    <input type="number" step="0.5" class="sport-seance-input" id="sport-serie-poids-${exIndex}-${l.numero}"
                           value="${l.log?.weight_kg ?? ex.target_weight_kg ?? ''}" placeholder="kg" ${l.log?.completed ? 'disabled' : ''}>
                    <input type="number" class="sport-seance-input" id="sport-serie-reps-${exIndex}-${l.numero}"
                           value="${l.log?.reps ?? ex.target_reps ?? ''}" placeholder="reps" ${l.log?.completed ? 'disabled' : ''}>
                    <span></span>
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
        if (!_sportAudioCtx) _sportInitAudio();
        const osc = _sportAudioCtx.createOscillator();
        const gain = _sportAudioCtx.createGain();
        osc.connect(gain);
        gain.connect(_sportAudioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, _sportAudioCtx.currentTime);
        gain.gain.setValueAtTime(1, _sportAudioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, _sportAudioCtx.currentTime + 0.6);
        osc.start();
        osc.stop(_sportAudioCtx.currentTime + 0.6);
    } catch (e) {
        console.error("[SPORT] Erreur WebAudio (alerte):", e);
    }
}

// Bip court du compte à rebours final de repos (5, 4, 3, 2, 1).
function _sportJouerBipCompteARebours() {
    try {
        if (!_sportAudioCtx) _sportInitAudio();
        const osc = _sportAudioCtx.createOscillator();
        const gain = _sportAudioCtx.createGain();
        osc.connect(gain);
        gain.connect(_sportAudioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, _sportAudioCtx.currentTime);
        gain.gain.setValueAtTime(0.8, _sportAudioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, _sportAudioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(_sportAudioCtx.currentTime + 0.15);
    } catch (e) {
        console.error("[SPORT] Erreur WebAudio (bip repos):", e);
    }
}

function _sportToggleTimerSerie(exIndex, setNumber, targetSeconds) {
    _sportInitAudio(); // Déverrouille l'audio iOS au clic sur Play
    const key = `${exIndex}-${setNumber}`;
    const btnPlayStop = document.getElementById(`sport-duree-playstop-${key}`);
    const inputM      = document.getElementById(`sport-duree-m-${key}`);
    const inputS      = document.getElementById(`sport-duree-s-${key}`);
    const chronoZone  = document.getElementById(`sport-duree-chronotext-${key}`);

    if (_sportSeryTimers[key] && _sportSeryTimers[key].active) {
        clearInterval(_sportSeryTimers[key].interval);
        _sportSeryTimers[key].active = false;

        const elapsedSecs = Math.floor((Date.now() - _sportSeryTimers[key].startTime) / 1000);

        inputM.value = Math.floor(elapsedSecs / 60);
        inputS.value = elapsedSecs % 60;

        chronoZone.style.display = 'none';
        inputM.style.display = 'block';
        inputS.style.display = 'block';
        
        btnPlayStop.innerHTML = '▶️';
        btnPlayStop.classList.remove('actif');
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
                chronoZone.classList.toggle('depassement', remaining < 0);
            }, 500)
        };

        inputM.style.display = 'none';
        inputS.style.display = 'none';
        chronoZone.style.display = 'block';
        
        chronoZone.textContent = _sportFormatChrono(targetSeconds);
        chronoZone.classList.remove('depassement');

        btnPlayStop.innerHTML = '⏹️';
        btnPlayStop.classList.add('actif');
    }
}

function _sportRenderFormulaireDuree(ex, logsExistants, exIndex) {
    const lignes = [];
    const nbSets = ex.target_sets || 1;

    for (let i = 1; i <= nbSets; i++) {
        const logExistant = logsExistants.find(l => l.set_number === i);
        lignes.push({ numero: i, log: logExistant || null });
    }

    const estCardio = SPORT_NOMS_EXERCICES_CARDIO.has(ex.exercise_name);

    return `
        <div class="sport-seance-table">
            <div class="sport-seance-table-header" style="grid-template-columns: 40px 1fr 1fr 40px 40px">
                <span>Série</span>
                <span style="text-align:center;">MIN</span>
                <span style="text-align:center;">SEC</span>
                <span></span><span></span>
            </div>
            ${lignes.map(l => {
                const totalSec = l.log ? l.log.duration_seconds : ex.target_duration_seconds;
                const m = Math.floor(totalSec / 60);
                const s = totalSec % 60;
                const isCompleted = !!l.log?.completed;
                const key = `${exIndex}-${l.numero}`;

                return `
                <div class="sport-seance-table-row ${isCompleted ? 'sport-seance-row-validee' : ''}" style="grid-template-columns: 40px 1fr 1fr 40px 40px; align-items:center;">
                    <span class="sport-seance-serie-numero">${l.numero}</span>

                    <input type="number" class="sport-seance-input" id="sport-duree-m-${key}"
                           value="${totalSec > 0 ? m : ''}" placeholder="0" ${isCompleted ? 'disabled' : ''}>
                    
                    <input type="number" class="sport-seance-input" id="sport-duree-s-${key}"
                           value="${totalSec > 0 ? s : ''}" placeholder="0" ${isCompleted ? 'disabled' : ''}>
                           
                    <div id="sport-duree-chronotext-${key}" class="sport-duree-chrono-texte" style="display:none; grid-column: 2 / 4; align-self:center;">
                        00:00
                    </div>

                    <button class="sport-duree-playstop-btn"
                            id="sport-duree-playstop-${key}" ${isCompleted ? 'disabled' : ''}>▶️</button>

                    <button class="sport-seance-check-btn ${isCompleted ? 'active' : ''}"
                            id="sport-duree-check-${key}" ${isCompleted ? 'disabled' : ''}>${SPORT_ICONE_CHECK}</button>
                </div>
                `;
            }).join('')}
        </div>

        ${estCardio ? `
        <div style="display: flex; gap: 8px; margin-top: 12px;">
            <input type="number" step="0.1" class="sport-seance-input" id="sport-duree-distance-${exIndex}" value="${logsExistants[0]?.distance_km || ''}" placeholder="Dist. (km)">
            <input type="number" step="0.1" class="sport-seance-input" id="sport-duree-vitesse-${exIndex}" value="${logsExistants[0]?.speed_kmh || ''}" placeholder="Vit. (km/h)">
            <input type="number" step="0.1" class="sport-seance-input" id="sport-duree-inclinaison-${exIndex}" value="${logsExistants[0]?.incline_percent || ''}" placeholder="Incl. (%)">
        </div>
        ` : ''}
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
    _sportInitAudio(); // Déverrouille l'audio iOS au clic sur Check
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
            d.log.exIndex = exIndex;
            _sportSeanceActive.logs.push(d.log);
            _sportLancerReposEntreSeries(ex.target_rest_seconds || 60, exIndex);
        }
    } catch (err) {
        console.error('[SPORT] validerLogSerie :', err.message);
    }
}

async function _sportValiderLogDuree(ex, setNumber, exIndex) {
    _sportInitAudio(); // Déverrouille l'audio iOS au clic sur Check
    const key = `${exIndex}-${setNumber}`;
    if (_sportSeryTimers[key] && _sportSeryTimers[key].active) {
        _sportToggleTimerSerie(exIndex, setNumber, ex.target_duration_seconds);
    }

    const m = parseInt(document.getElementById(`sport-duree-m-${key}`).value, 10) || 0;
    const s = parseInt(document.getElementById(`sport-duree-s-${key}`).value, 10) || 0;

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
            d.log.exIndex = exIndex;
            _sportSeanceActive.logs.push(d.log);
            _sportLancerReposEntreSeries(ex.target_rest_seconds || 60, exIndex);
        }
    } catch (err) {
        console.error('[SPORT] validerLogDuree :', err.message);
    }
}

function _sportLancerReposEntreSeries(secondesRepos, exIndex) {
    clearInterval(_sportSeanceReposInterval);
    const zoneRepos = document.getElementById('sport-seance-repos-zone');

    if (!secondesRepos) {
        _sportReposActif = null;
        if (zoneRepos) zoneRepos.style.display = 'none';
        _sportRenderTousLesExercices();
        return;
    }

    _sportReposActif = { exIndex, restant: secondesRepos };
    _sportRenderTousLesExercices(); // Met à jour l'état validé des lignes

    if (zoneRepos) {
        zoneRepos.style.display = 'block';
        zoneRepos.innerHTML = _sportRenderBandeauRepos(_sportReposActif.restant);
    }

    _sportSeanceReposInterval = setInterval(() => {
        if (!_sportReposActif) { clearInterval(_sportSeanceReposInterval); return; }
        _sportReposActif.restant--;

        const badge = document.getElementById('sport-repos-badge');
        if (!badge) { clearInterval(_sportSeanceReposInterval); return; }

        if (_sportReposActif.restant <= 0) {
            clearInterval(_sportSeanceReposInterval);
            _sportJouerAlerteObjectif();
            _sportReposActif = null;
            if (zoneRepos) zoneRepos.style.display = 'none';
            return;
        }

        if (_sportReposActif.restant <= 5) {
            _sportJouerBipCompteARebours();
        }

        badge.textContent = _sportFormatChrono(_sportReposActif.restant);
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
    _sportReposActif = null;
    
    // Fermer l'audio proprement si existant
    if (_sportAudioCtx && _sportAudioCtx.state !== 'closed') {
        _sportAudioCtx.close().catch(() => {});
        _sportAudioCtx = null;
    }

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
