// ============================================================
// routes/sport-partage.js
// ============================================================
const express = require('express');
const router  = express.Router();
const { pool } = require('../db/pool');

router.get('/share/seance/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
        const { rows: sessions } = await pool.query(`
            SELECT s.*, u.username, p.first_name, p.last_name, w.name AS workout_name
            FROM sport_sessions s
            JOIN users u ON u.id = s.user_id
            LEFT JOIN profiles p ON p.user_id = u.id
            LEFT JOIN sport_workouts w ON w.id = s.workout_id
            WHERE s.id = \$1
        `, [id]);

        if (!sessions.length) {
            return res.status(404).send('Séance introuvable.');
        }
        const session = sessions[0];
        
        // Construction du prénom/nom, avec repli sur username si vide
        const fullName = (session.first_name || session.last_name) 
            ? `${session.first_name || ''} ${session.last_name || ''}`.trim() 
            : session.username;

        const isGps = ['marche', 'course', 'vélo', 'velo'].includes(session.activity_type);

        let gpsPoints = [];
        if (isGps) {
            const { rows: pts } = await pool.query(`
                SELECT lat, lng FROM sport_gps_points WHERE session_id = \$1 ORDER BY recorded_at ASC
            `, [id]);
            gpsPoints = pts;
        }

        let titreRoutine = session.workout_name;
        if (!titreRoutine) {
            if (session.activity_type === 'course') titreRoutine = 'Course à pied';
            else if (session.activity_type === 'marche') titreRoutine = 'Marche';
            else if (session.activity_type === 'vélo' || session.activity_type === 'velo') titreRoutine = 'Vélo';
            else titreRoutine = 'Séance MoaDja';
        }

        const imageUrl = `/uploads/sport_shares/share_seance_${id}.jpg`;
        const shareUrl = `https://moadja.fr/share/seance/${id}`;

        const html = `<!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${titreRoutine} par ${fullName} - MoaDja</title>
            <link rel="icon" type="image/png" href="/icon-192.png">
            
            <meta property="og:title" content="Séance de ${fullName} : ${titreRoutine}">
            <meta property="og:description" content="Découvrez les détails et le tracé de cette séance sur MoaDja.">
            <meta property="og:image" content="https://moadja.fr${imageUrl}">
            <meta property="og:url" content="${shareUrl}">
            <meta property="og:type" content="article">

            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: system-ui, -apple-system, sans-serif;
                    background: linear-gradient(135deg, #fff0e6 0%, #fdfbfb 50%, #f3e8ff 100%);
                    color: #1f2937;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .container {
                    width: 100%;
                    max-width: 700px;
                    padding: 20px;
                    box-sizing: border-box;
                }
                .brand {
                    text-align: center;
                    font-size: 24px;
                    font-weight: 900;
                    color: #7c3aed;
                    margin-bottom: 20px;
                    letter-spacing: -0.5px;
                }
                .card {
                    background: #ffffff;
                    border-radius: 24px;
                    box-shadow: 0 20px 25px -5px rgba(124, 58, 237, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    padding: 24px;
                    box-sizing: border-box;
                    border: 1px solid rgba(255, 255, 255, 0.8);
                }
                .user-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }
                .avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: #7c3aed;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 18px;
                }
                .username {
                    font-weight: 700;
                    font-size: 16px;
                    color: #111827;
                }
                .handle {
                    font-size: 13px;
                    color: #6b7280;
                }
                .activity-title {
                    font-size: 14px;
                    color: #4b5563;
                    margin-bottom: 16px;
                    font-weight: 500;
                }
                .share-image-preview {
                    width: 100%;
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    margin-bottom: 24px;
                }
                .share-image-preview img {
                    width: 100%;
                    height: auto;
                    display: block;
                }
                .map-section-title {
                    font-size: 15px;
                    font-weight: 700;
                    color: #4b5563;
                    margin: 24px 0 12px 4px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                #map {
                    width: 100%;
                    height: 380px;
                    border-radius: 16px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    border: 1px solid #e5e7eb;
                }
                .cta-container {
                    margin-top: 28px;
                    text-align: center;
                }
                .btn {
                    display: inline-block;
                    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                    color: white;
                    font-weight: 700;
                    padding: 14px 32px;
                    border-radius: 9999px;
                    text-decoration: none;
                    box-shadow: 0 10px 15px -3px rgba(124, 58, 237, 0.3);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 14px 20px -3px rgba(124, 58, 237, 0.4);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="brand">MoaDja</div>
                
                <div class="card">
                    <div class="user-info">
                        <div class="avatar">${fullName.charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="username">${fullName}</div>
                            <div class="handle">@${session.username.toLowerCase()}</div>
                        </div>
                    </div>

                    <div class="activity-title">🏆 Séance terminée : <strong>${titreRoutine}</strong></div>

                    <div class="share-image-preview">
                        <img src="${imageUrl}" alt="Statistiques de la séance">
                    </div>

                    ${isGps && gpsPoints.length > 0 ? `
                        <div class="map-section-title">📍 Tracé de l'activité</div>
                        <div id="map"></div>
                    ` : ''}

                    <div class="cta-container">
                        <a href="https://moadja.fr" class="btn">Rejoindre MoaDja</a>
                    </div>
                </div>
            </div>

            ${isGps && gpsPoints.length > 0 ? `
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <script>
                const points = ${JSON.stringify(gpsPoints)};
                if (points.length > 0) {
                    const latlngs = points.map(p => [p.lat, p.lng]);
                    const map = L.map('map', { zoomControl: true, attributionControl: false }).setView(latlngs[0], 15);

                    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_3sfj_1_e7e2e040a3d271817c743aa0', {
                        maxZoom: 19
                    }).addTo(map);

                    const polyline = L.polyline(latlngs, {
                        color: '#8b5cf6',
                        weight: 5,
                        opacity: 0.9,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }).addTo(map);

                    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });

                    L.circleMarker(latlngs[0], {
                        radius: 7,
                        fillColor: '#10b981',
                        color: '#ffffff',
                        weight: 2.5,
                        fillOpacity: 1
                    }).addTo(map);

                    L.circleMarker(latlngs[latlngs.length - 1], {
                        radius: 7,
                        fillColor: '#ef4444',
                        color: '#ffffff',
                        weight: 2.5,
                        fillOpacity: 1
                    }).addTo(map);
                }
            </script>
            ` : ''}
        </body>
        </html>`;

        res.send(html);
    } catch (err) {
        console.error('[SPORT-PARTAGE] GET /share/seance/:id :', err.message);
        res.status(500).send('Erreur serveur.');
    }
});

module.exports = router;
