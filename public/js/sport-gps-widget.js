// ============================================================
// public/js/sport-gps-widget.js
// ============================================================
// Gestion cartographique (Leaflet) et affichage spécifique
// des activités libres GPS (Marche, Course, Vélo).

const CARTO_API_KEY = 'cb1_3sfj_1_e7e2e040a3d271817c743aa0';

if (!window._moadjaLeafletMaps) {
    window._moadjaLeafletMaps = {};
}

/**
 * Détecte si une séance est de type GPS (Marche, Course, Vélo)
 */
function _sportIsGpsActivity(activityType, isGpsFlag) {
    if (isGpsFlag) return true;
    const type = (activityType || '').toLowerCase();
    return type === 'marche' || type === 'course' || type === 'vélo' || type === 'velo';
}

/**
 * Charge dynamiquement CSS et JS de Leaflet
 */
function _loadLeafletDynamically() {
    return new Promise((resolve) => {
        if (document.getElementById('leaflet-css')) {
            resolve();
            return;
        }
        
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

/**
 * Initialise la carte Leaflet
 */
async function _sportInitMap(sessionId, mapDivId) {
    const mapDiv = document.getElementById(mapDivId);
    if (!mapDiv) return;

    try {
        await _loadLeafletDynamically();

        const response = await fetch(`/api/sport-gps/sessions/${sessionId}/points`, {
            headers: _sportAuthHeaders()
        });
        const data = await response.json();

        // FIX RACE CONDITION : on revérifie l'état de la div APRÈS le fetch asynchrone
        if (mapDiv._leaflet_id) {
            if (window._moadjaLeafletMaps[mapDivId]) {
                window._moadjaLeafletMaps[mapDivId].remove();
                delete window._moadjaLeafletMaps[mapDivId];
            }
            mapDiv._leaflet_id = null;
        }

        if (!data.success || !data.points || data.points.length === 0) {
            mapDiv.innerHTML = '<span style="color: #9ca3af; font-size: 13px;">Aucun tracé GPS enregistré pour cette séance.</span>';
            return;
        }

        mapDiv.innerHTML = '';

        const isWidget = mapDivId.includes('widget') || mapDivId.includes('dashboard');
        const map = L.map(mapDivId, {
            zoomControl: !isWidget,
            dragging: !isWidget,
            scrollWheelZoom: !isWidget,
            doubleClickZoom: !isWidget,
            touchZoom: !isWidget
        });

        window._moadjaLeafletMaps[mapDivId] = map;

        L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19
        }).addTo(map);

        const latlngs = data.points.map(p => [p.lat, p.lng]);
        const polyline = L.polyline(latlngs, { color: '#a78bfa', weight: 5, opacity: 0.9, lineJoin: 'round' }).addTo(map);

        const startPoint = latlngs[0];
        const endPoint = latlngs[latlngs.length - 1];
        const createDotIcon = (color) => L.divIcon({
            className: 'custom-map-dot',
            html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4);"></div>`,
            iconSize: [14, 14], iconAnchor: [7, 7]
        });

        L.marker(startPoint, { icon: createDotIcon('#10b981') }).addTo(map);
        if (latlngs.length > 1) {
            L.marker(endPoint, { icon: createDotIcon('#ef4444') }).addTo(map);
        }

        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

        setTimeout(() => {
            if (window._moadjaLeafletMaps[mapDivId]) {
                window._moadjaLeafletMaps[mapDivId].invalidateSize();
            }
        }, 300);

    } catch (error) {
        console.error('[SPORT] Erreur initialisation carte Leaflet :', error);
        if (mapDiv) mapDiv.innerHTML = '<span style="color: #ef4444; font-size: 13px;">Impossible de charger la carte.</span>';
    }
}
