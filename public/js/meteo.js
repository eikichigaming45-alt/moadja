// ============================================================
// public/js/meteo.js
// Widget Météo — Open-Meteo + Nominatim.
// Persistance localStorage : moadja_meteo_mode + moadja_meteo_coords
// Refresh manuel (bouton ↻) + auto toutes les 30 min.
// ============================================================

const METEO_SVG = {
    soleil: `<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><g stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="3.5"/><line x1="12" y1="20.5" x2="12" y2="23"/><line x1="1" y1="12" x2="3.5" y2="12"/><line x1="20.5" y1="12" x2="23" y2="12"/><line x1="4.2" y1="4.2" x2="6" y2="6"/><line x1="18" y1="18" x2="19.8" y2="19.8"/><line x1="4.2" y1="19.8" x2="6" y2="18"/><line x1="18" y1="6" x2="19.8" y2="4.2"/></g><circle cx="12" cy="12" r="5.5" fill="#fbbf24"/></svg>`,
    peuNuageux: `<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><circle cx="9" cy="8" r="4.5" fill="#fbbf24"/><path d="M18.5 18.5H8.5a3.6 3.6 0 0 1-.5-7.16A4.7 4.7 0 0 1 17 10a3.9 3.9 0 0 1 2.6 3.1 3 3 0 0 1-1.1 5.4z" fill="#7dd3fc"/></svg>`,
    partNuageux: `<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><path d="M8.5 15.5h-3a2.6 2.6 0 0 1-.35-5.17A3.3 3.3 0 0 1 11.5 9a1.8 1.8 0 0 1 .2 3.45" fill="#bae6fd"/><path d="M19 18.5H9a3.4 3.4 0 0 1-.5-6.75A4.6 4.6 0 0 1 17.5 10.6a3.7 3.7 0 0 1 2.1 7.1z" fill="#38bdf8"/></svg>`,
    couvert: `<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><path d="M19.5 18H6.2a4.1 4.1 0 0 1-.6-8.15A5.6 5.6 0 0 1 16.3 8.3a4.6 4.6 0 0 1 3.1 3.6 3.6 3.6 0 0 1 0.1 6.1z" fill="#93c5fd"/></svg>`,
    brouillard: `<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><path d="M18 9.5H7.5a3.3 3.3 0 0 1-.5-6.55A4.7 4.7 0 0 1 16 2 3.8 3.8 0 0 1 18 9.5z" fill="#bae6fd"/><g stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round"><line x1="2.5" y1="13" x2="21.5" y2="13"/><line x1="4.5" y1="16.5" x2="19.5" y2="16.5"/><line x1="2.5" y1="20" x2="21.5" y2="20"/></g></svg>`,
    bruine: `<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><path d="M18 11.5H7.5a3.3 3.3 0 0 1-.5-6.55A4.7 4.7 0 0 1 16 4 3.8 3.8 0 0 1 18 11.5z" fill="#7dd3fc"/><g stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"><line x1="8" y1="15.5" x2="7" y2="18.5"/><line x1="12" y1="16" x2="11" y2="19.5"/><line x1="16" y1="15.5" x2="15" y2="18.5"/></g></svg>`,
    pluie: `<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><path d="M18 11.5H7.5a3.3 3.3 0 0 1-.5-6.55A4.7 4.7 0 0 1 16 4 3.8 3.8 0 0 1 18 11.5z" fill="#38bdf8"/><g fill="#0284c7"><path d="M8 15c0 1.3-1.6 2.3-1.6 3.7a1.6 1.6 0 0 0 3.2 0C9.6 17.3 8 16.3 8 15z"/><path d="M13 15.6c0 1.3-1.6 2.3-1.6 3.7a1.6 1.6 0 0 0 3.2 0c0-1.4-1.6-2.4-1.6-3.7z"/><path d="M18 15c0 1.3-1.6 2.3-1.6 3.7a1.6 1.6 0 0 0 3.2 0c0-1.4-1.6-2.4-1.6-3.7z"/></g></svg>`,
    neige: `<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><path d="M18 10.5H7.5a3.3 3.3 0 0 1-.5-6.55A4.7 4.7 0 0 1 16 3 3.8 3.8 0 0 1 18 10.5z" fill="#bae6fd"/><g fill="#38bdf8"><circle cx="8" cy="15" r="1.2"/><circle cx="12" cy="17.5" r="1.2"/><circle cx="16" cy="15" r="1.2"/><circle cx="10" cy="20" r="1.2"/><circle cx="14" cy="20" r="1.2"/></g></svg>`,
    orage: `<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><path d="M18 9.5H7.5a3.3 3.3 0 0 1-.5-6.55A4.7 4.7 0 0 1 16 2 3.8 3.8 0 0 1 18 9.5z" fill="#94a3b8"/><path d="M13 10.5l-3.5 5.5h2.7l-1 5 4.8-6.5h-2.7l1-4z" fill="#fbbf24"/></svg>`
};

const METEO_ICONS = {
    0: METEO_SVG.soleil, 1: METEO_SVG.peuNuageux, 2: METEO_SVG.partNuageux, 3: METEO_SVG.couvert,
    45: METEO_SVG.brouillard, 48: METEO_SVG.brouillard,
    51: METEO_SVG.bruine, 53: METEO_SVG.bruine, 55: METEO_SVG.pluie,
    56: METEO_SVG.pluie, 57: METEO_SVG.pluie,
    61: METEO_SVG.pluie, 63: METEO_SVG.pluie, 65: METEO_SVG.pluie,
    66: METEO_SVG.pluie, 67: METEO_SVG.pluie,
    71: METEO_SVG.neige, 73: METEO_SVG.neige, 75: METEO_SVG.neige, 77: METEO_SVG.neige,
    80: METEO_SVG.bruine, 81: METEO_SVG.pluie, 82: METEO_SVG.pluie,
    85: METEO_SVG.neige, 86: METEO_SVG.neige,
    95: METEO_SVG.orage, 96: METEO_SVG.orage, 99: METEO_SVG.orage
};

const METEO_DESC = {
    0:'Ciel dégagé', 1:'Principalement dégagé', 2:'Partiellement nuageux',
    3:'Couvert', 45:'Brouillard', 48:'Brouillard givrant',
    51:'Bruine légère', 53:'Bruine', 55:'Bruine forte',
    56:'Bruine légère verglaçante', 57:'Bruine verglaçante forte',
    61:'Pluie légère', 63:'Pluie modérée', 65:'Forte pluie',
    66:'Pluie verglaçante légère', 67:'Pluie verglaçante forte',
    71:'Neige légère', 73:'Neige', 75:'Forte neige', 77:'Grésil',
    80:'Averses légères', 81:'Averses', 82:'Fortes averses',
    85:'Averses de neige légères', 86:'Averses de neige fortes',
    95:'Orage', 96:'Orage avec grêle', 99:'Orage violent'
};

const JOURS_COURT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

// ── Clés localStorage ─────────────────────────────────────────
const LS_MODE   = 'moadja_meteo_mode';
const LS_COORDS = 'moadja_meteo_coords';

// ── Intervalle refresh auto (30 min) ─────────────────────────
let _meteoRefreshInterval = null;
let _dernierFetchMeteo = 0;
const METEO_SEUIL_REFRESH_MS = 30 * 60 * 1000;

// ── Utilitaires localStorage ──────────────────────────────────
function _sauverMeteoLS(mode, lat, lon, ville) {
    try {
        localStorage.setItem(LS_MODE, mode);
        localStorage.setItem(LS_COORDS, JSON.stringify({ lat, lon, ville }));
    } catch (e) {}
}

function _lireMeteoLS() {
    try {
        const mode   = localStorage.getItem(LS_MODE);
        const coords = localStorage.getItem(LS_COORDS);
        if (mode && coords) return { mode, ...JSON.parse(coords) };
    } catch (e) {}
    return null;
}

// ── Calcul distance entre deux points (km) — formule Haversine ─
function _distanceKm(lat1, lon1, lat2, lon2) {
    const R  = 6371;
    const dL = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a  = Math.sin(dL / 2) * Math.sin(dL / 2)
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dl / 2) * Math.sin(dl / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getNomVille(lat, lon) {
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`);
        const d = await r.json();
        return d.address?.city || d.address?.town || d.address?.village || d.address?.municipality || 'Ma position';
    } catch { return 'Ma position'; }
}

async function chargerMeteo(lat, lon, nomVille, mode) {
    const el = document.getElementById('wc-meteo');
    // On n'affiche "Chargement..." que si la zone est vraiment vide
    if (el && !el.innerHTML.includes('meteo-badge')) {
        el.textContent = 'Chargement...';
    }
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=Europe%2FParis&forecast_days=6`;
        const r = await fetch(url);
        const d = await r.json();

                meteoData = {
            temp  : Math.round(d.current.temperature_2m),
            code  : d.current.weather_code,
            icon  : METEO_ICONS[d.current.weather_code] || '🌡️',
            vent  : Math.round(d.current.wind_speed_10m),
            hum   : d.current.relative_humidity_2m,
            pluie : d.daily.precipitation_probability_max?.[0] || 0,
            max   : Math.round(d.daily.temperature_2m_max[0]),
            min   : Math.round(d.daily.temperature_2m_min[0]),
            ville : nomVille,
            lat, lon,
            daily : d.daily
        };

        const modeEffectif = mode || 'ville';
        _sauverMeteoLS(modeEffectif, lat, lon, nomVille);
        _dernierFetchMeteo = Date.now();
        _renderWidget();

        const user = getUser();
        fetch('/api/profil/meteo-ville', {
            method : 'PATCH',
            headers: {
                'Content-Type' : 'application/json',
                'Authorization': `Bearer ${user?.token}`
            },
            body: JSON.stringify({ lat, lon, ville: nomVille })
        }).catch(() => {});

    } catch { 
        if (el && !el.innerHTML.includes('meteo-badge')) {
            el.textContent = 'Météo non disponible'; 
        }
    }
}

function _renderWidget() {
    const el = document.getElementById('wc-meteo');
    if (!el || !meteoData) return;
    const d = meteoData;

    const now       = new Date();
    const dateLabel = now.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
    const dateCap = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

    const joursHTML = d.daily.time.slice(0, 5).map((tj, i) => {
        const jObj  = new Date(tj + 'T12:00:00');
        const jour  = i === 0 ? 'Auj.' : JOURS_COURT[jObj.getDay()];
        const jMax  = Math.round(d.daily.temperature_2m_max[i]);
        const jMin  = Math.round(d.daily.temperature_2m_min[i]);
        const jIcon = i === 0 ? d.icon : (METEO_ICONS[d.daily.weather_code[i]] || '🌡️');
        return `
            <div style="display:flex;flex-direction:column;align-items:center;gap:1px;
                        padding:5px 0;border-radius:8px;flex:1;min-width:0">
                <div style="font-size:9px;font-weight:700;color:#888">${jour}</div>
                <div style="font-size:16px;line-height:1.2">${jIcon}</div>
                <div style="font-size:11px;font-weight:700;color:#333">${jMax}°</div>
                <div style="font-size:10px;color:#aaa">${jMin}°</div>
            </div>`;
    }).join('');

    el.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between">
                <div>
                    <div style="font-size:38px;font-weight:800;color:#1e3a5f;line-height:1">${d.temp}°</div>
                    <div style="font-size:12px;color:#555;margin-top:2px">${d.icon} ${METEO_DESC[d.code] || 'Variable'}</div>
                    <div style="font-size:11px;color:#888">↑${d.max}° ↓${d.min}°</div>
                    <div style="font-size:11px;color:#e879a0;margin-top:2px;font-weight:600">📍 ${d.ville}</div>
                    <div style="font-size:11px;color:#9ca3af;margin-top:2px">${dateCap}</div>
                </div>
                <div style="font-size:44px;line-height:1">${d.icon}</div>
            </div>
            <div style="display:flex;gap:5px;flex-wrap:wrap">
                <span class="meteo-badge">💧 ${d.hum}%</span>
                <span class="meteo-badge">💨 ${d.vent} km/h</span>
                <span class="meteo-badge">🌧️ ${d.pluie}%</span>
            </div>
            <div style="display:flex;gap:4px;width:100%">${joursHTML}</div>
        </div>
    `;
}

// ── Refresh manuel ────────────────────────────────────────────
window._refreshMeteo = async function () {
    const ls = _lireMeteoLS();
    if (ls?.mode === 'geoloc' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async pos => {
                const newLat = pos.coords.latitude;
                const newLon = pos.coords.longitude;
                const ville  = await getNomVille(newLat, newLon);
                await chargerMeteo(newLat, newLon, ville, 'geoloc');
            },
            async () => {
                if (ls?.lat && ls?.lon) {
                    await chargerMeteo(ls.lat, ls.lon, ls.ville || 'Ma position', 'ville');
                }
            }
        );
    } else if (ls?.lat && ls?.lon) {
        await chargerMeteo(ls.lat, ls.lon, ls.ville || 'Ma position', ls.mode || 'ville');
    }
};

function _refreshMeteoSiPerime() {
    if (Date.now() - _dernierFetchMeteo > METEO_SEUIL_REFRESH_MS) {
        window._refreshMeteo();
    }
}

// ── Refresh auto 30 min ───────────────────────────────────────
function _demarrerRefreshAuto() {
    if (_meteoRefreshInterval) clearInterval(_meteoRefreshInterval);
    _meteoRefreshInterval = setInterval(async () => {
        const ls = _lireMeteoLS();
        if (!ls) return;

        if (ls.mode === 'geoloc' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async pos => {
                    const newLat = pos.coords.latitude;
                    const newLon = pos.coords.longitude;
                    const dist = (ls.lat && ls.lon)
                        ? _distanceKm(ls.lat, ls.lon, newLat, newLon)
                        : 999;
                    if (dist > 5) {
                        const ville = await getNomVille(newLat, newLon);
                        await chargerMeteo(newLat, newLon, ville, 'geoloc');
                    } else {
                        await chargerMeteo(ls.lat, ls.lon, ls.ville || 'Ma position', 'geoloc');
                    }
                },
                () => {
                    if (ls.lat && ls.lon) {
                        chargerMeteo(ls.lat, ls.lon, ls.ville || 'Ma position', 'ville');
                    }
                }
            );
        } else if (ls.lat && ls.lon) {
            await chargerMeteo(ls.lat, ls.lon, ls.ville || 'Ma position', ls.mode || 'ville');
        }
    }, 30 * 60 * 1000);
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        _refreshMeteoSiPerime();
    }
});

window.addEventListener('focus', () => {
    _refreshMeteoSiPerime();
});

// ── Modale météo — Glassmorphism V3 ─────────────────────────────
function _renderModaleMeteo(selectedIdx) {
    const body = document.getElementById('modal-body');
    if (!body || !meteoData) {
        if (body) body.innerHTML = `
            <div class="modal-meteo-wrap">
                <p style="color:#555;margin-bottom:16px">Météo non disponible.</p>
                <div class="ville-form">
                    <input type="text" id="ville-input" placeholder="Rechercher une ville...">
                    <button onclick="rechercherVille()">OK</button>
                </div>
                <button class="geo-btn" onclick="geoLocaliser()">📍 Utiliser ma position</button>
            </div>
        `;
        return;
    }
    const d = meteoData;
    const isToday = selectedIdx === 0;

    const t         = d.daily.time[selectedIdx];
    const dateObj   = new Date(t + 'T12:00:00');
    const dateLabel = isToday
        ? "Aujourd'hui"
        : dateObj.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
    const iMax    = Math.round(d.daily.temperature_2m_max[selectedIdx]);
    const iMin    = Math.round(d.daily.temperature_2m_min[selectedIdx]);
    const iIcon   = isToday ? d.icon : (METEO_ICONS[d.daily.weather_code[selectedIdx]] || '🌡️');
    const iPluie  = d.daily.precipitation_probability_max?.[selectedIdx] || 0;
    const desc    = isToday ? (METEO_DESC[d.code] || 'Variable') : (METEO_DESC[d.daily.weather_code[selectedIdx]] || 'Variable');

    const joursHTML = d.daily.time.slice(0, 6).map((tj, i) => {
        const jObj  = new Date(tj + 'T12:00:00');
        const jour  = i === 0 ? 'Auj.' : JOURS_COURT[jObj.getDay()];
        const jMax  = Math.round(d.daily.temperature_2m_max[i]);
        const jMin  = Math.round(d.daily.temperature_2m_min[i]);
        const jIcon = i === 0 ? d.icon : (METEO_ICONS[d.daily.weather_code[i]] || '🌡️');
        const sel   = i === selectedIdx;
        return `
            <div onclick="_selectJourModale(${i})" class="modal-meteo-jour-card${sel ? ' active' : ''}">
                <div class="modal-meteo-jour-nom">${jour}</div>
                <div class="modal-meteo-jour-icon">${jIcon}</div>
                <div class="modal-meteo-jour-max">${jMax}°</div>
                <div class="modal-meteo-jour-min">${jMin}°</div>
            </div>`;
    }).join('');

    body.innerHTML = `
        <div class="modal-meteo-wrap">
            <div class="modal-meteo-hero">
                <div>
                    <div class="modal-meteo-temp">${isToday ? d.temp : iMax}°</div>
                    <div class="modal-meteo-desc">${iIcon} ${desc}</div>
                    <div class="modal-meteo-minmax">↑${iMax}° ↓${iMin}°</div>
                    <div class="modal-meteo-ville">📍 ${d.ville}</div>
                </div>
                <div class="modal-meteo-hero-icon">${iIcon}</div>
            </div>
            ${isToday ? `
            <div class="modal-meteo-badges">
                <span class="meteo-badge">💧 ${d.hum}%</span>
                <span class="meteo-badge">💨 ${d.vent} km/h</span>
                <span class="meteo-badge">🌧️ ${d.pluie}%</span>
            </div>` : ''}
            <div>
                <div class="modal-meteo-section-label">Prévisions 6 jours</div>
                <div class="modal-meteo-jours">${joursHTML}</div>
            </div>
            <div class="modal-meteo-today">
                <div class="modal-meteo-today-date">${dateLabel}</div>
                <div class="modal-meteo-today-body">
                    <div>
                        <div class="modal-meteo-today-desc">${iIcon} ${desc}</div>
                        <div class="modal-meteo-today-minmax">↑${iMax}° ↓${iMin}°</div>
                        <div class="modal-meteo-today-precip">
                            <span class="meteo-badge">🌧️ Précipitations : ${iPluie}%</span>
                        </div>
                    </div>
                    <div class="modal-meteo-today-icon">${iIcon}</div>
                </div>
            </div>
            <div class="ville-form">
                <input type="text" id="ville-input" placeholder="Rechercher une ville...">
                <button onclick="rechercherVille()">OK</button>
            </div>
            <button class="geo-btn" onclick="geoLocaliser()">📍 Utiliser ma position</button>
        </div>
    `;
}

window._selectJourModale = function (idx) {
    _renderModaleMeteo(idx);
};

window._ouvrirModaleMeteo = function () {
    _renderModaleMeteo(0);
    _refreshMeteoSiPerime();
};

function afficherDetailJourModale(i) {
    _renderModaleMeteo(i);
}

function _afficherEtatMeteoVide() {
    const el = document.getElementById('wc-meteo');
    if (el) {
        el.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 0;text-align:center">
                <div style="font-size:13px;color:#888">Position non définie</div>
                <div style="font-size:12px;color:#aaa">Cliquez pour choisir votre ville</div>
            </div>`;
    }
}

// FIX GEOLOC-LAUNCH (v1.69.7) / STALE-WHILE-REVALIDATE (v1.70.0) :
// Au lancement, on affiche immédiatement les données en cache (stale)
// pour éviter le texte "Chargement..." qui fait sauter l'écran. 
// Puis, si on est en mode 'geoloc', on lance une requête GPS en 
// arrière-plan (revalidate) pour rafraîchir la position silencieusement.
async function chargerMeteoAuto() {
    const ls = _lireMeteoLS();

    // 1. Affichage immédiat (cache local) pour ne pas bloquer l'écran
    let affichageImmediatLance = false;
    if (ls?.lat && ls?.lon) {
        chargerMeteo(ls.lat, ls.lon, ls.ville || 'Ma position', ls.mode || 'ville').catch(() => {});
        affichageImmediatLance = true;
    }

    // 2. Si on est en mode ville (ou sans géoloc), on s'arrête là
    if (ls?.mode !== 'geoloc' || !navigator.geolocation) {
        if (!affichageImmediatLance) {
            _tenterChargementProfilMeteo();
        } else {
            _demarrerRefreshAuto();
        }
        return;
    }

    // 3. Mode geoloc : Rafraîchissement silencieux en arrière-plan
    navigator.geolocation.getCurrentPosition(
        async pos => {
            const ville = await getNomVille(pos.coords.latitude, pos.coords.longitude);
            await chargerMeteo(pos.coords.latitude, pos.coords.longitude, ville, 'geoloc');
            _demarrerRefreshAuto();
        },
        () => {
            if (!affichageImmediatLance) {
                _afficherEtatMeteoVide();
            } else {
                _demarrerRefreshAuto();
            }
        }
    );
}

// Sous-fonction : chaîne de secours complète si pas de cache exploitable
// (BDD profil → géolocalisation directe → état vide), identique au
// comportement historique de chargerMeteoAuto.
async function _tenterChargementProfilMeteo() {
    try {
        const user = getUser();
        if (user?.token) {
            const r = await fetch('/api/profil', {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const d = await r.json();
            if (d.profil?.meteo_lat && d.profil?.meteo_lon) {
                profilCache = d.profil;
                await chargerMeteo(
                    d.profil.meteo_lat,
                    d.profil.meteo_lon,
                    d.profil.meteo_ville || 'Ma ville',
                    'ville'
                );
                _demarrerRefreshAuto();
                return;
            }
        }
    } catch {}

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async pos => {
                const ville = await getNomVille(pos.coords.latitude, pos.coords.longitude);
                await chargerMeteo(pos.coords.latitude, pos.coords.longitude, ville, 'geoloc');
                _demarrerRefreshAuto();
            },
            () => {
                _afficherEtatMeteoVide();
            }
        );
    } else {
        _afficherEtatMeteoVide();
    }
}

async function rechercherVille() {
    const ville = document.getElementById('ville-input')?.value?.trim();
    if (!ville) return;
    try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville)}&count=1&language=fr`);
        const d = await r.json();
        if (d.results?.length > 0) {
            const res = d.results[0];
            await chargerMeteo(res.latitude, res.longitude, res.name, 'ville');
            closeModal();
        } else {
            document.getElementById('modal-body').innerHTML = `
                <div class="modal-meteo-wrap">
                    <p style="color:#ef4444;margin-bottom:16px">Aucune ville trouvée.</p>
                    <div class="ville-form">
                        <input type="text" id="ville-input" placeholder="Rechercher une ville...">
                        <button onclick="rechercherVille()">OK</button>
                    </div>
                    <button class="geo-btn" onclick="geoLocaliser()">📍 Utiliser ma position</button>
                </div>`;
        }
    } catch {
        document.getElementById('modal-body').innerHTML = `
            <div class="modal-meteo-wrap">
                <p style="color:#ef4444;margin-bottom:16px">Erreur réseau.</p>
                <div class="ville-form">
                    <input type="text" id="ville-input" placeholder="Rechercher une ville...">
                    <button onclick="rechercherVille()">OK</button>
                </div>
                <button class="geo-btn" onclick="geoLocaliser()">📍 Utiliser ma position</button>
            </div>`;
    }
}

async function geoLocaliser() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        async pos => {
            const ville = await getNomVille(pos.coords.latitude, pos.coords.longitude);
            await chargerMeteo(pos.coords.latitude, pos.coords.longitude, ville, 'geoloc');
            closeModal();
        },
        () => {
            document.getElementById('modal-body').innerHTML = `
                <div class="modal-meteo-wrap">
                    <p style="color:#ef4444;margin-bottom:16px">Localisation refusée.</p>
                    <div class="ville-form">
                        <input type="text" id="ville-input" placeholder="Rechercher une ville...">
                        <button onclick="rechercherVille()">OK</button>
                    </div>
                    <button class="geo-btn" onclick="geoLocaliser()">📍 Utiliser ma position</button>
                </div>`;
        }
    );
}
