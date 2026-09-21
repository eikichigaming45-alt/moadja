// ============================================================
// routes/sport-partage.js
// ============================================================
// Route publique Open Graph (Page de destination de partage de séance)

const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

router.get('/share/seance/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).send('ID invalide');

    try {
        const queryText = `
            SELECT s.id, w.name AS workout_name, u.username 
            FROM sport_sessions s 
            LEFT JOIN sport_workouts w ON w.id = s.workout_id 
            JOIN users u ON u.id = s.user_id 
            WHERE s.id = \$1
        `;
        const { rows } = await pool.query(queryText, [id]);

        if (!rows.length) return res.status(404).send('Séance introuvable');
        
        const session = rows[0];
        const nomAuteur = session.username || 'Utilisateur';
        const initiales = nomAuteur.charAt(0).toUpperCase();
        const avatarHtml = `<div style="width:48px;height:48px;border-radius:50%;background:#7c3aed;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;flex-shrink:0;">${initiales}</div>`;

        const baseUrl = req.protocol + '://' + req.get('host');
        const imageUrl = `${baseUrl}/uploads/sport_shares/share_seance_${id}.jpg`;
        const title = `Séance Sport MoaDja de ${nomAuteur}`;
        const desc = `Découvrez les performances de ${nomAuteur} et rejoignez la communauté MoaDja !`;

        const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${baseUrl}/share/seance/${id}" />
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
        .user-row {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .user-info {
            display: flex;
            flex-direction: column;
        }
        .user-name {
            font-size: 16px;
            font-weight: 700;
            color: #111827;
        }
        .user-handle {
            font-size: 13px;
            color: #9ca3af;
        }
        .post-text {
            font-size: 14.5px;
            color: #374151;
            line-height: 1.5;
            margin: 0;
        }
        .post-image {
            width: 100%;
            height: auto;
            border-radius: 16px;
            display: block;
            border: 1px solid rgba(229, 231, 235, 0.8);
            box-shadow: 0 4px 12px rgba(0,0,0,0.04);
        }
        .cta-button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            padding: 14px;
            background: #a78bfa;
            color: #ffffff;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 700;
            font-size: 15px;
            transition: all 0.2s ease;
            box-shadow: 0 8px 20px rgba(167, 139, 250, 0.3);
            box-sizing: border-box;
            border: 1px solid rgba(255,255,255,0.5);
        }
        .cta-button:hover {
            background: #7c3aed;
            transform: translateY(-2px);
            box-shadow: 0 12px 24px rgba(124, 58, 237, 0.4);
        }
    </style>
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

        <p class="post-text">🏋️‍♂️ Séance terminée : ${escapeHtml(session.workout_name)}</p>
        
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
