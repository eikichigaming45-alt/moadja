// ============================================================
// public/js/sport-activite-libre.js
// ============================================================
// Module dédié à l'Activité libre (Tracking GPS / Mode Poche).
// Dépend de sport.js (chargé avant) pour le WakeLock et les headers API.

let _gpsSessionId = null;
let _gpsWatchId = null;
let _gpsPoints = [];
let _gpsStartTime = null;
let _gpsChronoInterval = null;
let _gpsDistanceKm = 0;
let _gpsDernierPoint = null;
let _gpsActivityType = '';

// ── 1. MODALE DE CHOIX (Marche / Course) ──
function _sportActiviteLibreOuvrir() {
    document.getElementById('overlay').classList.add('on');
    document.body.classList.add('modal-open');
    history.pushState({ modalOpen: true }, '', '');

    document.getElementById('modal-title').textContent = 'Activité extérieure';
    
    // On réutilise les styles de boutons existants pour la cohérence
    document.getElementById('modal-body').innerHTML = `
        <p style="color:#6b7280; font-size:14px; text-align:center; margin-bottom:24px;">
            Choisissez le type d'activité. L'écran passera en "Mode Poche" (noir) pour économiser la batterie tout en suivant votre trajet.
        </p>
        <div style="display:flex; flex-direction:column; gap:12px; align-items:center;">
            <button class="sport-seance-btn-ajouter-exercice" style="width:100%; max-width:280px; margin:0;" onclick="_sportDemarrerGPS('marche')">
                🚶 Marche GPS
            </button>
            <button class="sport-seance-btn-ajouter-exercice" style="width:100%; max-width:280px; margin:0; background:rgba(167, 139, 250, 0.15); color:rgb(167, 139, 250); border: 2px solid rgba(167, 139, 250, 0.5); box-shadow:none;" onclick="_sportDemarrerGPS('course')">
                🏃 Course GPS
            </button>
        </div>
    `;
}

// ── 2. INITIALISATION & DÉMARRAGE ──
async function _sportDemarrerGPS(type) {
    closeModal();
    _gpsActivityType = type;
    
    try {
        // 1. Créer la séance côté serveur
        const r = await fetch('/api/sport-gps/sessions', {
            method: 'POST',
            headers: _sportAuthHeaders(),
            body: JSON.stringify({ activity_type: type })
        });
        const d = await r.json();
        if (!d.success) throw new Error(d.message);
        
        _gpsSessionId = d.session.id;
        
        // 2. Initialiser les variables
        _gpsPoints = [];
        _gpsDistanceKm = 0;
        _gpsDernierPoint = null;
        
        // Gérer la reprise si la séance était déjà "in_progress"
        const dateStart = new Date(d.session.date_start);
        _gpsStartTime = dateStart.getTime();

        // 3. Afficher l'interface "Mode Poche"
        _sportAfficherModePoche(type);
        
        // 4. Lancer les chronos et capteurs
        if (typeof _sportDemanderWakeLock === 'function') {
            await _sportDemanderWakeLock();
        }
        _sportLancerBoucleGPS();

    } catch (err) {
        console.error('[SPORT-GPS] Erreur démarrage :', err.message);
        _sportOuvrirConfirmationInfo("Impossible de démarrer l'activité : " + err.message);
    }
}

// ── 3. INTERFACE "MODE POCHE" ──
function _sportAfficherModePoche(type) {
    const libelleType = type === 'course' ? '🏃 Course en cours' : '🚶 Marche en cours';
    
    const div = document.createElement('div');
    div.id = 'sport-poche-ui';
    div.className = 'sport-poche-overlay';
    div.innerHTML = `
        <div class="sport-poche-header">
            <div class="sport-poche-type">${libelleType}</div>
            <div class="sport-poche-status" id="gps-status">🟡 Recherche signal GPS...</div>
        </div>

        <div style="display:flex; flex-direction:column; align-items:center;">
            <div class="sport-poche-chrono" id="gps-chrono">00:00</div>
            
            <div class="sport-poche-stats-row">
                <div class="sport-poche-stat">
                    <div class="sport-poche-stat-val" id="gps-dist">0.00</div>
                    <div class="sport-poche-stat-lbl">KM</div>
                </div>
                <div class="sport-poche-stat">
                    <div class="sport-poche-stat-val" id="gps-vit">0.0</div>
                    <div class="sport-poche-stat-lbl">KM/H</div>
                </div>
            </div>
        </div>

        <!-- Slider de déverrouillage -->
        <div class="sport-poche-slider-container" id="gps-slider-box">
            <div class="sport-poche-slider-text">Glisser pour déverrouiller >>></div>
            <input type="range" min="0" max="100" value="0" class="sport-poche-slider-input" id="gps-slider">
        </div>

        <!-- Actions cachées par défaut -->
        <div class="sport-poche-actions" id="gps-actions" style="display:none;">
            <button class="sport-poche-btn-terminer" onclick="_sportTerminerGPS()">⏹ Terminer l'activité</button>
            <button class="sport-poche-btn-reprendre" onclick="_sportVerrouillerPoche()">🔒 Reprendre (Verrouiller)</button>
        </div>
    `;
    document.body.appendChild(div);

    // Boucle d'affichage du chrono
    _gpsChronoInterval = setInterval(_sportUpdateChronoGPS, 1000);
    _sportUpdateChronoGPS(); // 1er appel immédiat

    // Logique du slider anti-accident
    const slider = document.getElementById('gps-slider');
    slider.addEventListener('input', (e) => {
        if (e.target.value > 90) {
            document.getElementById('gps-slider-box').style.display = 'none';
            document.getElementById('gps-actions').style.display = 'flex';
        }
    });
    slider.addEventListener('change', (e) => {
        if (e.target.value <= 90) e.target.value = 0; // Snap back
    });
}

function _sportVerrouillerPoche() {
    document.getElementById('gps-actions').style.display = 'none';
    const slider = document.getElementById('gps-slider');
    slider.value = 0;
    document.getElementById('gps-slider-box').style.display = 'block';
}

function _sportUpdateChronoGPS() {
    const el = document.getElementById('gps-chrono');
    if (!el || !_gpsStartTime) return;
    
    const diffSec = Math.floor((Date.now() - _gpsStartTime) / 1000);
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    
    if (h > 0) {
        el.textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else {
        el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // Mise à jour de la vitesse moyenne d'affichage
    if (_gpsDistanceKm > 0 && diffSec > 0) {
        const vitMoyenne = _gpsDistanceKm / (diffSec / 3600);
        document.getElementById('gps-vit').textContent = vitMoyenne.toFixed(1);
    }
}

// ── 4. CAPTEUR GPS & CALCULS ──
function _sportLancerBoucleGPS() {
    if (!('geolocation' in navigator)) {
        document.getElementById('gps-status').innerHTML = '🔴 GPS non supporté par ce navigateur';
        return;
    }

    _gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            const ts = position.timestamp;

            document.getElementById('gps-status').innerHTML = '🟢 GPS Actif (Précision: '+Math.round(accuracy)+'m)';
            document.getElementById('gps-status').className = 'sport-poche-status';

            // On ignore les points trop imprécis (ex: > 30 mètres) pour éviter les sauts
            if (accuracy > 30) return;

            const nouveauPoint = { lat, lng, recorded_at: new Date(ts).toISOString() };

            if (_gpsDernierPoint) {
                const dist = _haversineDistance(_gpsDernierPoint.lat, _gpsDernierPoint.lng, lat, lng);
                _gpsDistanceKm += dist;
                document.getElementById('gps-dist').textContent = _gpsDistanceKm.toFixed(2);
            }

            _gpsDernierPoint = nouveauPoint;
            _gpsPoints.push(nouveauPoint);

            // Sauvegarde batch en base (tous les 10 points pour économiser le réseau)
            if (_gpsPoints.length >= 10) {
                _sportSauvegarderPointsBatch();
            }
        },
        (error) => {
            console.warn('[SPORT-GPS] Erreur signal :', error.message);
            document.getElementById('gps-status').innerHTML = '🟡 Signal GPS perdu...';
            document.getElementById('gps-status').className = 'sport-poche-status recherche';
        },
        {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000
        }
    );
}

// Formule de Haversine pour calculer la distance entre deux coordonnées (en km)
function _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}

async function _sportSauvegarderPointsBatch() {
    if (_gpsPoints.length === 0 || !_gpsSessionId) return;
    
    const pointsAEnvoyer = [..._gpsPoints];
    _gpsPoints = []; // On vide la file d'attente
    
    try {
        await fetch(`/api/sport-gps/sessions/${_gpsSessionId}/points`, {
            method: 'POST',
            headers: _sportAuthHeaders(),
            body: JSON.stringify({ points: pointsAEnvoyer })
        });
    } catch (err) {
        console.error('[SPORT-GPS] Échec sauvegarde points en arrière-plan');
        // Si échec, on remet les points dans la file pour le prochain essai
        _gpsPoints = pointsAEnvoyer.concat(_gpsPoints);
    }
}

// ── 5. CLÔTURE DE LA SÉANCE ──
async function _sportTerminerGPS() {
    // 1. Arrêter le GPS et le chrono
    if (_gpsWatchId !== null) navigator.geolocation.clearWatch(_gpsWatchId);
    if (_gpsChronoInterval !== null) clearInterval(_gpsChronoInterval);
    
    // 2. Relâcher l'écran
    if (typeof _sportRelacherWakeLock === 'function') _sportRelacherWakeLock();

    // 3. Bouton visuel de chargement
    const btn = document.querySelector('.sport-poche-btn-terminer');
    if (btn) {
        btn.textContent = "Enregistrement...";
        btn.disabled = true;
    }

    // 4. Vider les derniers points restants
    await _sportSauvegarderPointsBatch();

    // 5. Calculer la vitesse moyenne finale
    let vitMoyenneFinale = null;
    const diffSec = Math.floor((Date.now() - _gpsStartTime) / 1000);
    if (_gpsDistanceKm > 0 && diffSec > 0) {
        vitMoyenneFinale = _gpsDistanceKm / (diffSec / 3600);
    }

    // 6. Appel API de clôture
    try {
        await fetch(`/api/sport-gps/sessions/${_gpsSessionId}/end`, {
            method: 'PUT',
            headers: _sportAuthHeaders(),
            body: JSON.stringify({ 
                distance_km: _gpsDistanceKm.toFixed(2), 
                vitesse_moyenne_kmh: vitMoyenneFinale ? vitMoyenneFinale.toFixed(1) : null
            })
        });
    } catch (err) {
        console.error('[SPORT-GPS] Erreur clôture :', err);
    }

    // 7. Nettoyer l'interface et recharger le dashboard
    const ui = document.getElementById('sport-poche-ui');
    if (ui) ui.remove();

    _gpsSessionId = null;
    if (typeof _sportChargerDashboardStats === 'function') {
        _sportChargerDashboardStats();
    }
}
