// ============================================================
// routes/sport-partage.js
// ============================================================
const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

router.get('/seance/:id', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.id, 10);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
        const sessionRes = await pool.query(
            `SELECT s.*, 
                    u.nom, u.prenom, u.username, u.avatar
             FROM sport_sessions s
             JOIN users u ON s.user_id = u.id
             WHERE s.id = \$1`,
            [sessionId]
        );

        if (sessionRes.rows.length === 0) {
            return res.status(404).send('Séance introuvable.');
        }

        const session = sessionRes.rows[0];
        const nomAuteur = session.prenom || session.nom || session.username;
        const routineName = session.workout_name || 'Séance MoaDja';
        const isGps = session.activity_type === 'marche' || session.activity_type === 'course' || session.activity_type === 'vélo';
        
        const title = `Séance : ${escapeHtml(routineName)} par ${escapeHtml(nomAuteur)}`;
        const desc = isGps 
            ? `Découvrez la séance de ${session.activity_type} de ${escapeHtml(nomAuteur)} sur MoaDja !`
            : `Découvrez la séance de musculation de ${escapeHtml(nomAuteur)} sur MoaDja !`;
            
        const imageUrl = session.share_image_url 
            ? `${baseUrl}${session.share_image_url}` 
            : `${baseUrl}/images/logo.png`;

        const avatarHtml = session.avatar 
            ? `<img src="${baseUrl}${escapeHtml(session.avatar)}" alt="Avatar" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #a78bfa;">`
            : `<div style="width: 48px; height: 48px; border-radius: 50%; background: #a78bfa; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">${escapeHtml(nomAuteur.charAt(0).toUpperCase())}</div>`;

        let mapHtml = '';
        let mapScript = '';

        if (isGps) {
            const pointsRes = await pool.query(
                `SELECT lat, lng FROM sport_gps_points WHERE session_id = \$1 ORDER BY recorded_at ASC`,
                [sessionId]
            );
            const points = pointsRes.rows;

            if (points.length > 0) {
                mapHtml = `
                    <div id="map" style="width: 100%; height: 320px; border-radius: 16px; margin: 16px 0; z-index: 1; box-shadow: inset 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;"></div>
                `;
                mapScript = `
                    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                    <script>
                        document.addEventListener("DOMContentLoaded", function() {
                            var points = ${JSON.stringify(points)};
                            if(points.length > 0) {
                                var map = L.map('map', { zoomControl: false }).setView([points[0].lat, points[0].lng], 14);
                                L.control.zoom({ position: 'bottomright' }).addTo(map);
                                
                                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_3sfj_1_e7e2e040a3d271817c743aa0', {
                                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                                    subdomains: 'abcd',
                                    maxZoom: 20
                                }).addTo(map);

                                var latlngs = points.map(function(p) { return [p.lat, p.lng]; });
                                var polyline = L.polyline(latlngs, {color: '#a78bfa', weight: 4, opacity: 0.9}).addTo(map);
                                map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

                                L.circleMarker(latlngs[0], { radius: 6, fillColor: "#10b981", color: "#fff", weight: 2, fillOpacity: 1 }).addTo(map);
                                L.circleMarker(latlngs[latlngs.length - 1], { radius: 6, fillColor: "#ef4444", color: "#fff", weight: 2, fillOpacity: 1 }).addTo(map);
                            }
                        });
                    </script>
                `;
            }
        }

        const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${baseUrl}/share/seance/${sessionId}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="MoaDja" />
    <meta name="twitter:card" content="summary_large_image" />
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(135deg, #ffc3a0 0%, #fdfbfb 40%, #e6d8fb 70%, #d8b4fe 100%);
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            box-sizing: border-box;
            color: #1f2937;
        }
        .brand-header {
            font-size: 22px;
            font-weight: 900;
            color: #7c3aed;
            margin-bottom: 20px;
            letter-spacing: -0.5px;
        }
        .share-card {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.9);
            border-radius: 24px;
            box-shadow: 0 16px 40px rgba(124, 58, 237, 0.15);
            max-width: 540px;
            width: 100%;
            padding: 24px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .user-row { display: flex; align-items: center; gap: 12px; }
        .user-info { display: flex; flex-direction: column; }
        .user-name { font-size: 16px; font-weight: 700; color: #111827; }
        .user-handle { font-size: 13px; color: #9ca3af; }
        .post-text { font-size: 14.5px; color: #374151; line-height: 1.5; margin: 0; }
        .post-image { width: 100%; height: auto; border-radius: 16px; display: block; border: 1px solid rgba(229, 231, 235, 0.8); }
        .cta-button {
            display: flex; align-items: center; justify-content: center; width: 100%; padding: 14px;
            background: #a78bfa; color: #ffffff; text-decoration: none; border-radius: 50px;
            font-weight: 700; font-size: 15px; transition: all 0.2s ease; box-shadow: 0 8px 20px rgba(167, 139, 250, 0.3);
            border: 1px solid rgba(255,255,255,0.5);
        }
        .cta-button:hover { background: #7c3aed; transform: translateY(-2px); box-shadow: 0 12px 24px rgba(124, 58, 237, 0.4); }
    </style>
    ${mapScript}
</head>
<body>
    <div class="brand-header">MoaDja</div>
    
    <div class="share-card">
        <div class="user-row">
            ${avatarHtml}
            <div class="user-info">
                <span class="user-name">${escapeHtml(nomAuteur)}</span>
                <span class="user-handle">@${escapeHtml(session.username)}</span>
            </div>
        </div>

        <p class="post-text">🏋️‍♂️ Séance terminée : ${escapeHtml(routineName)}</p>
        
        ${mapHtml}

        <img src="${imageUrl}" class="post-image" alt="Statistiques de la séance">
        
        <a href="https://moadja.fr" class="cta-button">Rejoindre MoaDja</a>
    </div>
</body>
</html>`;
        
        res.send(html);
    } catch (err) {
        console.error('[SPORT] Erreur Open Graph GET /share/seance/:id :', err.message);
        res.status(500).send('Erreur serveur');
    }
});

module.exports = router;
