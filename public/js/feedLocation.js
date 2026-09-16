// ============================================================
// public/js/feedLocation.js
// Fil social — Module Géolocalisation / Lieu (extrait de feed.js)
// Cartographie, recherche de lieu (GPS + texte), autocomplete lieu.
// Dépend de : feed.js (escapeHtml)
// ============================================================

// ── CARTOGRAPHIE (LOC4) ───────────────────────────────────────
function ouvrirCarte(lat, lon, nomLieu, e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    document.getElementById('modal-title').textContent = nomLieu || 'Lieu du post';
    document.getElementById('modal-body').innerHTML = `
        <div id="map-container" style="width:100%; height:400px; border-radius:12px; background:#e5e7eb; overflow:hidden;"></div>
        <div style="margin-top:12px;text-align:center;">
            <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}" target="_blank" rel="noopener"
               style="color:#7c3aed;font-size:13px;font-weight:600;text-decoration:none;">Ouvrir dans OpenStreetMap</a>
        </div>
    `;
    document.getElementById('overlay').classList.add('on');

    setTimeout(() => {
        if (typeof L !== 'undefined') {
            const map = L.map('map-container').setView([lat, lon], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors', maxZoom: 19
            }).addTo(map);
            L.marker([lat, lon]).addTo(map).bindPopup(`<b>${escapeHtml(nomLieu)}</b>`).openPopup();
            setTimeout(() => map.invalidateSize(), 100);
        } else {
            document.getElementById('map-container').innerHTML = `<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#6b7280;font-size:13px;">Erreur chargement carte.</div>`;
        }
    }, 100);
}

// ── GÉOLOCALISATION : CACHE DE POSITION (session, 5 min) ───────
let _locPositionCache = null;
let _locPositionCacheTime = 0;
const LOC_CACHE_DUREE_MS = 5 * 60 * 1000;

function _getLocPosition() {
    return new Promise((resolve) => {
        const maintenant = Date.now();
        if (_locPositionCache && (maintenant - _locPositionCacheTime) < LOC_CACHE_DUREE_MS) {
            resolve(_locPositionCache);
            return;
        }
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                _locPositionCache = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                _locPositionCacheTime = maintenant;
                resolve(_locPositionCache);
            },
            () => resolve(null),
            { timeout: 8000 }
        );
    });
}

// ── CALCUL DE DISTANCE (formule Haversine, aucun appel réseau) ──
function _distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function _formatDistance(km) {
    if (km < 1) return `à ${Math.round(km * 1000)} m`;
    return `à ${km.toFixed(1)} km`;
}

// ── AFFICHAGE D'UNE LIGNE DE SUGGESTION (nom + détail) ─────────
function _renderLocItem(nom, detail, lat, lon) {
    return `<div class="loc-item" data-nom="${escapeHtml(nom)}" data-lat="${lat}" data-lon="${lon}">
        <div class="loc-item-nom">📍 ${escapeHtml(nom)}</div>
        ${detail ? `<div class="loc-item-detail">${escapeHtml(detail)}</div>` : ''}
    </div>`;
}

function _bindLocItems(drop, inputElId, latId, lonId) {
    drop.querySelectorAll('.loc-item[data-nom]').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById(inputElId).value = item.dataset.nom;
            document.getElementById(latId).value = item.dataset.lat;
            document.getElementById(lonId).value = item.dataset.lon;
            drop.style.display = 'none';
        });
    });
}

// ── RECHERCHE DE LIEU GEOLOC (clic sur l'icône — position exacte) ──
// [MODIFIÉ v1.92.27] Nominatim et Overpass séparés : un échec d'Overpass
// (liste des lieux à proximité) n'empêche plus d'afficher la position GPS
// précise (ville actuelle), qui reste utilisable pour ouvrir la carte au bon endroit.
async function rechercherLieuGeoloc(inputElId, latId, lonId, wrapId) {
    const wrap = document.getElementById(wrapId);
    let drop = wrap.querySelector('.loc-dropdown');
    if (!drop) { drop = document.createElement('div'); drop.className = 'loc-dropdown'; wrap.style.position = 'relative'; wrap.appendChild(drop); }

    drop.innerHTML = '<div class="loc-item" style="text-align:center;color:#9ca3af;">Recherche GPS en cours...</div>';
    drop.style.display = 'block';

    const position = await _getLocPosition();
    if (!position) {
        drop.innerHTML = '<div class="loc-item" style="text-align:center;color:#ef4444;">Géolocalisation refusée/échouée</div>';
        setTimeout(() => drop.style.display = 'none', 3000);
        return;
    }
    const { lat, lon } = position;

    let ville = 'Autour de moi';
    try {
        const resNom = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`);
        const dataNom = await resNom.json();
        ville = dataNom.address?.city || dataNom.address?.town || dataNom.address?.village || dataNom.address?.suburb || 'Autour de moi';
    } catch (err) {
        // Échec Nominatim : on garde le nom générique et on continue quand
        // même avec les coordonnées GPS précises, sans bloquer l'affichage.
    }

    let itemsHTML = _renderLocItem(ville, 'Ville actuelle', lat, lon);

    try {
        const query = `
            [out:json][timeout:5];
            (
              node["amenity"~"cafe|bar|restaurant|cinema|theatre"](around:300,${lat},${lon});
              node["tourism"~"camp_site|museum|gallery"](around:300,${lat},${lon});
              node["leisure"~"park|pitch"](around:300,${lat},${lon});
            );
            out body 10;
        `;
        const resOv = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
        const dataOv = await resOv.json();

        if (dataOv.elements && dataOv.elements.length > 0) {
            const elementsAvecDistance = dataOv.elements
                .filter(el => el.tags && el.tags.name)
                .map(el => ({ ...el, _dist: _distanceKm(lat, lon, el.lat, el.lon) }))
                .sort((a, b) => a._dist - b._dist);

            if (elementsAvecDistance.length > 0) {
                itemsHTML += `<div style="padding:6px 14px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;background:#f9fafb;">Lieux à proximité</div>`;
                elementsAvecDistance.forEach(el => {
                    itemsHTML += _renderLocItem(el.tags.name, _formatDistance(el._dist), el.lat, el.lon);
                });
            }
        }
    } catch (err) {
        // Échec Overpass (service tiers moins fiable) : la liste des lieux à
        // proximité est simplement omise, la ville actuelle reste affichée.
    }

    drop.innerHTML = itemsHTML;
    _bindLocItems(drop, inputElId, latId, lonId);

    document.addEventListener('click', function _closeLoc(e) {
        if (!wrap.contains(e.target)) { drop.style.display = 'none'; document.removeEventListener('click', _closeLoc); }
    });
}

// ── RECHERCHE DE LIEU PAR TEXTE (frappe — triée par proximité réelle) ──
function _initLieuAutocomplete(inputElId, latId, lonId, wrapId) {
    const input = document.getElementById(inputElId);
    const latInput = document.getElementById(latId);
    const lonInput = document.getElementById(lonId);
    if (!input) return;
    let debounceTimer = null;
    input.addEventListener('input', () => {
        if (latInput) latInput.value = '';
        if (lonInput) lonInput.value = '';
        clearTimeout(debounceTimer);
        const q = input.value.trim();
        if (q.length < 2) {
            const wrap = document.getElementById(wrapId);
            const drop = wrap?.querySelector('.loc-dropdown');
            if (drop) drop.style.display = 'none';
            return;
        }
        debounceTimer = setTimeout(() => _rechercherLieuTexte(q, inputElId, latId, lonId, wrapId), 450);
    });
}

async function _rechercherLieuTexte(q, inputElId, latId, lonId, wrapId) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    let drop = wrap.querySelector('.loc-dropdown');
    if (!drop) { drop = document.createElement('div'); drop.className = 'loc-dropdown'; wrap.style.position = 'relative'; wrap.appendChild(drop); }

    drop.innerHTML = '<div class="loc-item" style="text-align:center;color:#9ca3af;">Recherche...</div>';
    drop.style.display = 'block';

    const position = await _getLocPosition();

    try {
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=15&addressdetails=1`;

        if (position) {
            const delta = 0.15;
            const left   = position.lon - delta;
            const top    = position.lat + delta;
            const right  = position.lon + delta;
            const bottom = position.lat - delta;
            url += `&viewbox=${left},${top},${right},${bottom}&bounded=1`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (!data || !data.length) {
            drop.innerHTML = '<div class="loc-item" style="text-align:center;color:#9ca3af;">Aucun lieu trouvé à proximité</div>';
            return;
        }

        let resultats = data.map(r => ({
            nom: r.display_name.split(',')[0].trim(),
            detail: r.address?.city || r.address?.town || r.address?.village
                || r.display_name.split(',')[1]?.trim() || '',
            lat: r.lat,
            lon: r.lon,
            _dist: position ? _distanceKm(position.lat, position.lon, parseFloat(r.lat), parseFloat(r.lon)) : null
        }));

        if (position) {
            resultats.sort((a, b) => a._dist - b._dist);
        }

        resultats = resultats.slice(0, 8);

        const itemsHTML = resultats.map(r => {
            let detailAffiche;
            if (r._dist !== null && r.detail) {
                detailAffiche = `${_formatDistance(r._dist)} · ${r.detail}`;
            } else if (r._dist !== null) {
                detailAffiche = _formatDistance(r._dist);
            } else {
                detailAffiche = r.detail;
            }
            return _renderLocItem(r.nom, detailAffiche, r.lat, r.lon);
        }).join('');

        drop.innerHTML = itemsHTML;
        _bindLocItems(drop, inputElId, latId, lonId);

        document.addEventListener('click', function _closeLocTexte(e) {
            if (!wrap.contains(e.target)) { drop.style.display = 'none'; document.removeEventListener('click', _closeLocTexte); }
        });

    } catch (err) {
        drop.innerHTML = '<div class="loc-item" style="text-align:center;color:#ef4444;">Erreur réseau</div>';
    }
}
