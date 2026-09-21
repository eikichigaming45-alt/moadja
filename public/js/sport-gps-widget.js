// ============================================================
// public/js/sport-gps-widget.js
// ============================================================
// Gestion cartographique (Leaflet) et affichage spécifique
// des activités libres GPS (Marche, Course, Vélo).

const CARTO_API_KEY = 'cb1_3sfj_1_e7e2e040a3d271817c743aa0';

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
        
        // CSS
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        // JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

/**
 * Initialise la carte Leaflet pour une session donnée dans un conteneur cible.
 * Utilisable dans une modale, le dashboard, ou la page de partage.
 */
async function _sportInitMap(sessionId, mapDivId) {
    const mapDiv = document.getElementById(mapDivId);
    if (!mapDiv) return;

    try {
        // 1. On attend que Leaflet (CSS + JS) soit bien chargé
        await _loadLeafletDynamically();

        // 2. Récupération des points GPS
        const response = await fetch(`/api/sport-gps/sessions/${sessionId}/points`, {
            headers: _sportAuthHeaders()
        });
        const data = await response.json();

        if (!data.success || !data.points || data.points.length === 0) {
            mapDiv.innerHTML = '<span style="color: #9ca3af; font-size: 13px;">Aucun tracé GPS enregistré pour cette séance.</span>';
            return;
        }

        // On vide le texte "Chargement..."
        mapDiv.innerHTML = '';

        // 3. Initialisation de la carte Leaflet (UI épurée, sans zoom si widget)
        const isWidget = mapDivId.includes('widget');
        const map = L.map(mapDivId, {
            zoomControl: !isWidget,
            dragging: !isWidget,
            scrollWheelZoom: !isWidget,
            doubleClickZoom: !isWidget,
            touchZoom: !isWidget
        });

        // 4. Ajout du fond de carte CartoDB Voyager avec la clé d'API
        L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19
        }).addTo(map);

        // 5. Préparation des coordonnées
        const latlngs = data.points.map(p => [p.lat, p.lng]);

        // 6. Dessin du tracé (Ligne violette)
        const polyline = L.polyline(latlngs, {
            color: '#a78bfa',
            weight: 5,
            opacity: 0.9,
            lineJoin: 'round'
        }).addTo(map);

        // 7. Marqueurs de Début (Vert) et Fin (Rouge)
        const startPoint = latlngs[0];
        const endPoint = latlngs[latlngs.length - 1];

        const createDotIcon = (color) => L.divIcon({
            className: 'custom-map-dot',
            html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });

        L.marker(startPoint, { icon: createDotIcon('#10b981') }).addTo(map);
        if (latlngs.length > 1) {
            L.marker(endPoint, { icon: createDotIcon('#ef4444') }).addTo(map);
        }

        // 8. Ajuster la caméra
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

        // 9. Force un recalcul de la taille après l'affichage pour éviter le bug de tuiles grises
        setTimeout(() => {
            map.invalidateSize();
        }, 300);

    } catch (error) {
        console.error('[SPORT] Erreur initialisation carte Leaflet :', error);
        mapDiv.innerHTML = '<span style="color: #ef4444; font-size: 13px;">Impossible de charger la carte.</span>';
    }
}
