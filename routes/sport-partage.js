// ============================================================
// routes/sport-partage.js
// ============================================================
// Page publique de partage d'une séance de sport (Open Graph + Leaflet)
const express = require('express');
const router  = express.Router();
const { pool } = require('../db/pool');

router.get('/share/seance/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).send('Séance invalide.');
    }

    try {
        // 1. Récupérer la séance et l'utilisateur associé
        const { rows: sessionRows } = await pool.query(`
            SELECT s.*, u.username as pseudo 
            FROM sport_sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.id = \$1
        `, [id]);

        if (!sessionRows.length) {
            return res.status(404).send('Séance introuvable.');
        }
        const session = sessionRows[0];

        // 2. Récupérer les points GPS associés
        const { rows: gpsRows } = await pool.query(`
            SELECT lat, lng FROM sport_gps_points 
            WHERE session_id = \$1 
            ORDER BY recorded_at ASC
        `, [id]);

        const gpsPointsCoord = gpsRows.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
        const centreLat = gpsPointsCoord.length > 0 ? gpsPointsCoord[0][0] : 48.8566;
        const centreLng = gpsPointsCoord.length > 0 ? gpsPointsCoord[0][1] : 2.3522;

        const imageUrl = `https://moadja.fr/uploads/sport_shares/share_seance_${id}.jpg`;
        const titre = `Séance ${session.activity_type || 'Sport'} de ${session.pseudo}`;
        const description = `Durée : ${Math.round((new Date(session.date_end) - new Date(session.date_start))/60000)} min | Distance : ${session.distance_km || 0} km | Vitesse moyenne : ${session.vitesse_moyenne_kmh || 0} km/h`;

        // 3. Rendu HTML de la page publique de partage
        const html = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${titre} - MoaDja</title>
            
            <!-- Open Graph / Réseaux Sociaux -->
            <meta property="og:title" content="${titre}">
            <meta property="og:description" content="${description}">
            <meta property="og:image" content="${imageUrl}">
            <meta property="og:url" content="https://moadja.fr/share/seance/${id}">
            <meta property="og:type" content="article">

            <!-- Tailwind CSS -->
            <script src="https://cdn.tailwindcss.com"></script>
            <!-- Leaflet CSS -->
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

            <style>
                body {
                    background: linear-gradient(135deg, #fff0e6 0%, #fdfbfb 50%, #f3e8ff 100%);
                    min-height: 100vh;
                    font-family: system-ui, -apple-system, sans-serif;
                }
                #map {
                    height: 450px;
                    width: 100%;
                    border-radius: 1rem;
                }
            </style>
        </head>
        <body class="flex flex-col items-center justify-center p-4">
            <div class="text-center mb-6">
                <h1 class="text-3xl font-black text-purple-600 tracking-wider">MoaDja</h1>
            </div>

            <div class="bg-white/90 backdrop-blur-md shadow-xl rounded-3xl p-6 w-full max-w-2xl border border-white">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-lg">
                            ${session.pseudo.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 class="font-bold text-gray-900">${session.pseudo}</h2>
                            <p class="text-xs text-gray-400">Séance de ${session.activity_type}</p>
                        </div>
                    </div>
                </div>

                <!-- Stats principales -->
                <div class="grid grid-cols-3 gap-4 mb-6 text-center">
                    <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Distance</span>
                        <p class="text-xl font-extrabold text-gray-800">${session.distance_km || 0} km</p>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Vitesse moy.</span>
                        <p class="text-xl font-extrabold text-purple-600">${session.vitesse_moyenne_kmh || 0} km/h</p>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Statut</span>
                        <p class="text-xl font-extrabold text-green-600">Terminée</p>
                    </div>
                </div>

                <!-- Grande Carte Leaflet Interactive -->
                <div class="mb-6">
                    <h3 class="text-sm font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                        <span>📍</span> Tracé interactif de l'activité
                    </h3>
                    <div id="map"></div>
                </div>

                <!-- Bouton d'action pour rejoindre la plateforme -->
                <div class="text-center">
                    <a href="https://moadja.fr" target="_blank" class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-200">
                        Rejoindre MoaDja
                    </a>
                </div>
            </div>

            <!-- Leaflet JS -->
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <script>
                const map = L.map('map').setView([${centreLat}, ${centreLng}], 14);

                // Fond de carte CARTO Voyager avec la clé API configurée
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_3sfj_1_e7e2e040a3d271817c743aa0', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    maxZoom: 20
                }).addTo(map);

                const latlngs = ${JSON.stringify(gpsPointsCoord)};
                if (latlngs.length > 0) {
                    const polyline = L.polyline(latlngs, { color: '#8b5cf6', weight: 4 }).addTo(map);
                    map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

                    // Marqueur de début (vert) et fin (rouge)
                    L.circleMarker(latlngs[0], { color: 'green', radius: 6, fillOpacity: 1 }).addTo(map);
                    L.circleMarker(latlngs[latlngs.length - 1], { color: 'red', radius: 6, fillOpacity: 1 }).addTo(map);
                }
            </script>
        </body>
        </html>
        `;

        res.send(html);
    } catch (err) {
        console.error('[SPORT-PARTAGE] Erreur :', err.message);
        res.status(500).send('Erreur interne du serveur.');
    }
});

module.exports = router;
