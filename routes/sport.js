// ============================================================
// routes/sport.js
// ============================================================
const express = require('express');
const router = express.express.Router ? express.express.Router() : express.Router();
const { pool } = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// POST /sessions/:id/generate-share -> Génère l'image Open Graph
router.post('/sessions/:id/generate-share', verifyToken, async (req, res) => {
    try {
        const sessionId = parseInt(req.params.id, 10);
        const userId = req.user.id;

        // Récupérer la séance et vérifier l'appartenance
        const sessionRes = await pool.query(
            `SELECT s.*, 
                    COALESCE(u.prenom, u.nom, u.username) as prenom,
                    u.username
             FROM sport_sessions s
             JOIN users u ON s.user_id = u.id
             WHERE s.id = \$1 AND s.user_id = \$2`,
            [sessionId, userId]
        );

        if (sessionRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Séance introuvable.' });
        }

        const session = sessionRes.rows[0];
        const isGps = session.activity_type === 'marche' || session.activity_type === 'course' || session.activity_type === 'vélo';
        
        let routineName = session.workout_name || 'Séance MoaDja';
        if (routineName.length > 30) routineName = routineName.substring(0, 27) + '...';

        const d = new Date(session.date_end || session.date_start || Date.now());
        const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

        const dureeTotale = session.duration_seconds || 0;
        const h = Math.floor(dureeTotale / 3600);
        const m = Math.floor((dureeTotale % 3600) / 60);
        const dureeStr = h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;

        const calStr = session.calories ? `${session.calories} kcal` : '—';
        
        const labelBloc2 = isGps ? 'DISTANCE' : 'VOLUME';
        const valeurBloc2 = isGps 
            ? (session.distance_km ? `${parseFloat(session.distance_km).toFixed(2)} km` : '0 km')
            : (session.total_volume_kg ? `${session.total_volume_kg} kg` : '0 kg');

        // Préparation du tracé GPS s'il y a lieu
        let svgPath = '';
        if (isGps) {
            const pointsRes = await pool.query(
                `SELECT lat, lng FROM sport_gps_points WHERE session_id = \$1 ORDER BY recorded_at ASC`,
                [sessionId]
            );
            const points = pointsRes.rows;

            if (points.length > 1) {
                let minLat = points[0].lat, maxLat = points[0].lat;
                let minLng = points[0].lng, maxLng = points[0].lng;
                for (let p of points) {
                    if (p.lat < minLat) minLat = p.lat;
                    if (p.lat > maxLat) maxLat = p.lat;
                    if (p.lng < minLng) minLng = p.lng;
                    if (p.lng > maxLng) maxLng = p.lng;
                }

                const pad = 0.1; 
                const latDiff = (maxLat - minLat) || 0.001;
                const lngDiff = (maxLng - minLng) || 0.001;
                minLat -= latDiff * pad; maxLat += latDiff * pad;
                minLng -= lngDiff * pad; maxLng += lngDiff * pad;

                const mapW = 960; 
                const mapH = 220; 
                const offsetX = 120; 
                const offsetY = 320;

                const project = (lat, lng) => {
                    const x = offsetX + ((lng - minLng) / (maxLng - minLng)) * mapW;
                    const y = offsetY + mapH - ((lat - minLat) / (maxLat - minLat)) * mapH;
                    return { x, y };
                };

                let dPath = `M ${project(points[0].lat, points[0].lng).x} ${project(points[0].lat, points[0].lng).y}`;
                for (let i = 1; i < points.length; i++) {
                    const pt = project(points[i].lat, points[i].lng);
                    dPath += ` L ${pt.x} ${pt.y}`;
                }

                const startPt = project(points[0].lat, points[0].lng);
                const endPt = project(points[points.length - 1].lat, points[points.length - 1].lng);

                svgPath = `
                    <rect x="${offsetX}" y="${offsetY}" width="${mapW}" height="${mapH}" rx="16" fill="#f3f4f6" />
                    <path d="${dPath}" fill="none" stroke="#a78bfa" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
                    <circle cx="${startPt.x}" cy="${startPt.y}" r="8" fill="#10b981" stroke="#ffffff" stroke-width="3" />
                    <circle cx="${endPt.x}" cy="${endPt.y}" r="8" fill="#ef4444" stroke="#ffffff" stroke-width="3" />
                `;
            } else {
                svgPath = `
                    <rect x="120" y="320" width="960" height="220" rx="16" fill="#f3f4f6" />
                    <text x="600" y="435" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#9ca3af" text-anchor="middle">Tracé GPS indisponible</text>
                `;
            }
        }

        // SVG sans filtres complexes pour compatibilité Sharp
        const svg = `
        <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
            <rect width="1200" height="630" fill="#f3e8ff" />
            
            <rect x="60" y="50" width="1080" height="530" rx="32" fill="#ffffff" stroke="#d8b4fe" stroke-width="4" />

            <text x="120" y="120" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#1f2937">${routineName}</text>
            <text x="1080" y="120" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#9ca3af" text-anchor="end">${dateStr}</text>

            <rect x="120" y="180" width="300" height="110" rx="16" fill="#f9fafb" stroke="#e5e7eb" stroke-width="2" />
            <text x="270" y="220" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#9ca3af" letter-spacing="1" text-anchor="middle">DURÉE</text>
            <text x="270" y="265" font-family="Arial, sans-serif" font-size="38" font-weight="bold" fill="#1f2937" text-anchor="middle">${dureeStr}</text>

            <rect x="450" y="180" width="300" height="110" rx="16" fill="#f9fafb" stroke="#e5e7eb" stroke-width="2" />
            <text x="600" y="220" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#9ca3af" letter-spacing="1" text-anchor="middle">${labelBloc2}</text>
            <text x="600" y="265" font-family="Arial, sans-serif" font-size="38" font-weight="bold" fill="#1f2937" text-anchor="middle">${valeurBloc2}</text>

            <rect x="780" y="180" width="300" height="110" rx="16" fill="#fff1f2" stroke="#fecdd3" stroke-width="2" />
            <text x="930" y="220" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#f43f5e" letter-spacing="1" text-anchor="middle">CALORIES</text>
            <text x="930" y="265" font-family="Arial, sans-serif" font-size="38" font-weight="bold" fill="#be123c" text-anchor="middle">${calStr}</text>

            ${svgPath}
        </svg>`;

        const uploadsDir = path.join(__dirname, '../public/uploads/sport_shares');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const filename = `share_${sessionId}_${Date.now()}.jpg`;
        const filepath = path.join(uploadsDir, filename);

        await sharp(Buffer.from(svg))
            .jpeg({ quality: 90 })
            .toFile(filepath);

        const publicUrl = `/uploads/sport_shares/${filename}`;
        
        await pool.query(
            `UPDATE sport_sessions SET share_image_url = \$1 WHERE id = \$2`,
            [publicUrl, sessionId]
        );

        res.json({ success: true, imageUrl: publicUrl });

    } catch (err) {
        console.error('[SPORT] Erreur generate-share:', err);
        res.status(500).json({ success: false, message: 'Erreur lors de la génération de l\'image de partage.' });
    }
});

// Les autres routes backend classiques viennent ici (POST /sessions, GET /dashboard-stats, etc.)
// ... (Assurez-vous de bien conserver vos routes existantes si j'ai omis de les lister ici) ...

module.exports = router;
