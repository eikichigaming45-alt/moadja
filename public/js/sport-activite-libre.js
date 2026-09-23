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
let _gpsHorlogeInterval = null;
let _gpsDistanceKm = 0;
let _gpsDernierPoint = null;
let _gpsActivityType = '';

// ── 1. MODALE DE CHOIX (Marche / Course / Vélo) ──
function _sportActiviteLibreOuvrir() {
    document.getElementById('overlay').classList.add('on');
    document.body.classList.add('modal-open');
    history.pushState({ modalOpen: true }, '', '');

    document.getElementById('modal-title').textContent = 'Activité extérieure';
    
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
            <button class="sport-seance-btn-ajouter-exercice" style="width:100%; max-width:280px; margin:0; background:rgba(16, 185, 129, 0.15); color:rgb(16, 185, 129); border: 2px solid rgba(16, 185, 129, 0.5); box-shadow:none;" onclick="_sportDemarrerGPS('vélo')">
                🚴 Vélo GPS
            </button>
        </div>
    `;
}

// ── 2. INITIALISATION & DÉMARRAGE ──
async function _sportDemarrerGPS(type) {
    closeModal();
    _gpsActivityType = type;
    
    try {
        const r = await fetch('/api/sport-gps/sessions', {
            method: 'POST',
            headers: _sportAuthHeaders(),
            body: JSON.stringify({ activity_type: type })
        });
        const d = await r.json();
        if (!d.success) throw new Error(d.message);
        
        _gpsSessionId = d.session.id;
        _gpsPoints = [];
        _gpsDistanceKm = 0;
        _gpsDernierPoint = null;
        
        // CORRECTION DU CHRONO (-1:-1) : Utilisation d'un timestamp absolu sécurisé
        _gpsStartTime = Date.now();

        _sportAfficherModePoche(type);
        
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
    let libelleType = '🚶 MARCHE EN COURS';
    if (type === 'course') libelleType = '🏃 COURSE EN COURS';
    if (type === 'vélo' || type === 'velo') libelleType = '🚴 VÉLO EN COURS';
    
    const oldBanner = document.getElementById('sport-gps-banner');
    if (oldBanner) oldBanner.remove();

    const div = document.createElement('div');
    div.id = 'sport-poche-ui';
    div.className = 'sport-poche-overlay';
    div.innerHTML = `
        <div class="sport-poche-header">
            <div class="sport-poche-type">${libelleType}</div>
            <div class="sport-poche-status" id="gps-status">🟡 Recherche signal GPS...</div>
        </div>

        <div style="display:flex; flex-direction:column; align-items:center; margin-top: auto; margin-bottom: auto; width: 100%;">
            <div class="sport-poche-horloge" id="gps-horloge" style="font-size: 2.8rem; font-weight: 800; text-align: center; color: #ffffff; letter-spacing: 1px; line-height: 1; margin-bottom: 20px;">--:--</div>
            
            <div class="sport-poche-chrono" id="gps-chrono">00:00</div>
            
            <div class="sport-poche-stats-row" style="margin-top: 24px; align-items: flex-start;">
                <div class="sport-poche-stat" style="display: flex; flex-direction: column; align-items: center;">
                    <div class="sport-poche-stat-val" id="gps-dist">0.00</div>
                    <div class="sport-poche-stat-lbl" style="text-align: center;">KM</div>
                </div>
                <div class="sport-poche-stat" style="display: flex; flex-direction: column; align-items: center;">
                    <div class="sport-poche-stat-val" id="gps-vit">0.0</div>
                    <div class="sport-poche-stat-lbl" style="text-align: center;">KM/H <span style="font-size:10px; opacity:0.6; display:block; margin-top:2px;">(Instantanée)</span></div>
                </div>
            </div>
        </div>

        <div class="sport-poche-slider-container" id="gps-slider-box">
            <div class="sport-poche-slider-text">Glisser pour déverrouiller >>></div>
            <input type="range" min="0" max="100" value="0" class="sport-poche-slider-input" id="gps-slider">
        </div>

        <div class="sport-poche-actions" id="gps-actions" style="display:none;">
            <button class="sport-poche-btn-reduire" onclick="_sportReduirePoche()">📱 Masquer l'écran noir</button>
            <button class="sport-poche-btn-terminer" onclick="_sportTerminerGPS()">⏹ Terminer l'activité</button>
            <button class="sport-poche-btn-verrouiller" onclick="_sportVerrouillerPoche()">🔒 Reverrouiller l'écran</button>
            <button class="sport-poche-btn-reduire" onclick="_sportAnnulerGPS()" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.1);">❌ Annuler l'activité</button>
        </div>
    `;
    document.body.appendChild(div);

    _gpsChronoInterval = setInterval(_sportUpdateChronoGPS, 1000);
    _gpsHorlogeInterval = setInterval(_sportUpdateHorloge, 1000);
    _sportUpdateChronoGPS();
    _sportUpdateHorloge();

    const slider = document.getElementById('gps-slider');
    slider.addEventListener('input', (e) => {
        if (e.target.value > 90) {
            document.getElementById('gps-slider-box').style.display = 'none';
            document.getElementById('gps-actions').style.display = 'flex';
        }
    });
    slider.addEventListener('change', (e) => {
        if (e.target.value <= 90) e.target.value = 0;
    });
}

function _sportUpdateHorloge() {
    const el = document.getElementById('gps-horloge');
    if (!el) return;
    const now = new Date();
    el.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
}

function _sportVerrouillerPoche() {
    document.getElementById('gps-actions').style.display = 'none';
    const slider = document.getElementById('gps-slider');
    if (slider) slider.value = 0;
    const box = document.getElementById('gps-slider-box');
    if (box) box.style.display = 'block';
}

function _sportReduirePoche() {
    const ui = document.getElementById('sport-poche-ui');
    if (ui) ui.style.display = 'none';
    
    const banner = document.createElement('div');
    banner.id = 'sport-gps-banner';
    banner.className = 'sport-gps-floating-banner';
    
    let icone = '🚶';
    if (_gpsActivityType === 'course') icone = '🏃';
    if (_gpsActivityType === 'vélo' || _gpsActivityType === 'velo') icone = '🚴';
    
    banner.innerHTML = `<div class="sport-gps-floating-pulse"></div> ${icone} Activité en cours...`;
    banner.onclick = _sportAgrandirPoche;
    document.body.appendChild(banner);
}

function _sportAgrandirPoche() {
    const banner = document.getElementById('sport-gps-banner');
    if (banner) banner.remove();
    
    const ui = document.getElementById('sport-poche-ui');
    if (ui) {
        ui.style.display = 'flex';
        _sportVerrouillerPoche();
    }
}

function _sportUpdateChronoGPS() {
    const el = document.getElementById('gps-chrono');
    if (!el || !_gpsStartTime) return;
    
    const diffSec = Math.max(0, Math.floor((Date.now() - _gpsStartTime) / 1000));
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    
    if (h > 0) {
        el.textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else {
        el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

            const statusEl = document.getElementById('gps-status');
            if (statusEl) {
                statusEl.innerHTML = '🟢 GPS Actif (Précision: '+Math.round(accuracy)+'m)';
                statusEl.className = 'sport-poche-status';
            }

            if (accuracy > 100) return;

            const nouveauPoint = { lat, lng, recorded_at: new Date(ts).toISOString() };
            let vitesseInstantanee = 0;

            if (position.coords.speed !== null && position.coords.speed >= 0) {
                vitesseInstantanee = position.coords.speed * 3.6;
            }

            if (_gpsDernierPoint) {
                const dist = _haversineDistance(_gpsDernierPoint.lat, _gpsDernierPoint.lng, lat, lng);
                _gpsDistanceKm += dist;
                const distEl = document.getElementById('gps-dist');
                if (distEl) distEl.textContent = _gpsDistanceKm.toFixed(2);

                if (vitesseInstantanee === 0) {
                    const timeDiffSec = (ts - new Date(_gpsDernierPoint.recorded_at).getTime()) / 1000;
                    if (timeDiffSec > 0) {
                        vitesseInstantanee = dist / (timeDiffSec / 3600);
                    }
                }
            }

            const vitEl = document.getElementById('gps-vit');
            if (vitEl) vitEl.textContent = vitesseInstantanee.toFixed(1);

            _gpsDernierPoint = nouveauPoint;
            _gpsPoints.push(nouveauPoint);

            if (_gpsPoints.length >= 10) {
                _sportSauvegarderPointsBatch();
            }
        },
        (error) => {
            console.warn('[SPORT-GPS] Erreur signal :', error.message);
            const statusEl = document.getElementById('gps-status');
            if (statusEl) {
                statusEl.innerHTML = '🟡 Signal GPS perdu...';
                statusEl.className = 'sport-poche-status recherche';
            }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
}

function _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
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
    _gpsPoints = [];
    
    try {
        await fetch(`/api/sport-gps/sessions/${_gpsSessionId}/points`, {
            method: 'POST',
            headers: _sportAuthHeaders(),
            body: JSON.stringify({ points: pointsAEnvoyer })
        });
    } catch (err) {
        console.error('[SPORT-GPS] Échec sauvegarde points en arrière-plan');
        _gpsPoints = pointsAEnvoyer.concat(_gpsPoints);
    }
}

// ── 5. CLÔTURE DE LA SÉANCE ──
async function _sportTerminerGPS() {
    if (_gpsWatchId !== null) navigator.geolocation.clearWatch(_gpsWatchId);
    if (_gpsChronoInterval !== null) clearInterval(_gpsChronoInterval);
    if (_gpsHorlogeInterval !== null) clearInterval(_gpsHorlogeInterval);
    
    if (typeof _sportRelacherWakeLock === 'function') _sportRelacherWakeLock();

    const btn = document.querySelector('.sport-poche-btn-terminer');
    if (btn) {
        btn.textContent = "Enregistrement...";
        btn.disabled = true;
    }

    await _sportSauvegarderPointsBatch();

    let vitMoyenneFinale = null;
    const diffSec = Math.floor((Date.now() - _gpsStartTime) / 1000);
    if (_gpsDistanceKm > 0 && diffSec > 0) {
        vitMoyenneFinale = _gpsDistanceKm / (diffSec / 3600);
    }

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

    const ui = document.getElementById('sport-poche-ui');
    if (ui) ui.remove();
    const banner = document.getElementById('sport-gps-banner');
    if (banner) banner.remove();

    _gpsSessionId = null;
    if (typeof _sportChargerDashboardStats === 'function') {
        _sportChargerDashboardStats();
    }
}

// ── 6. ANNULATION DE LA SÉANCE (SUPPRESSION) ──
function _sportAnnulerGPS() {
    const ui = document.getElementById('sport-poche-ui');
    
    if (ui) ui.style.display = 'none';

    _sportOuvrirModalChoix(
        'Annuler l\'activité',
        'Êtes-vous sûr de vouloir annuler cette activité ? Rien ne sera sauvegardé.',
        'Oui, annuler',
        'Non, reprendre',
        async () => {
            if (_gpsWatchId !== null) navigator.geolocation.clearWatch(_gpsWatchId);
            if (_gpsChronoInterval !== null) clearInterval(_gpsChronoInterval);
            if (_gpsHorlogeInterval !== null) clearInterval(_gpsHorlogeInterval);
            if (typeof _sportRelacherWakeLock === 'function') _sportRelacherWakeLock();

            try {
                await fetch(`/api/sport/sessions/${_gpsSessionId}`, {
                    method: 'DELETE',
                    headers: _sportAuthHeaders()
                });
            } catch (err) {
                console.error('[SPORT-GPS] Erreur lors de l\'annulation :', err);
            }

            if (ui) ui.remove();
            const banner = document.getElementById('sport-gps-banner');
            if (banner) banner.remove();
            
            _gpsSessionId = null;
            if (typeof _sportChargerDashboardStats === 'function') {
                _sportChargerDashboardStats();
            }
        },
        () => {
            if (ui) ui.style.display = 'flex';
        }
    );
}
