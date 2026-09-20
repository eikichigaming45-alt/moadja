// ============================================================
// server.js
// ============================================================

require('dotenv').config();

const express     = require('express');
const http        = require('http');
const { Server }  = require('socket.io');
const webpush     = require('web-push');
const jwt         = require('jsonwebtoken');
const rateLimit   = require('express-rate-limit');
const { pool, initDB }          = require('./db/pool');
const { router: tchatRouter,
        purgerMessages }        = require('./routes/tchat');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors      : { origin: false },
    transports: ['websocket', 'polling']
});
const PORT = process.env.PORT || 3000;

// ── Set des userIds connectés au tchat ────────────────────────
const tchatConnectedUsers = new Set();

app.set('trust proxy', 1);
app.set('etag', false);
app.set('io', io);
app.set('tchatConnectedUsers', tchatConnectedUsers);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public', { etag: true, lastModified: true }));

app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma',  'no-cache');
    res.set('Expires', '0');
    next();
});

// ── Configuration VAPID ───────────────────────────────────────
if (!process.env.VAPID_MAILTO || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('[VAPID] Variables manquantes — notifications push désactivées.');
} else {
    webpush.setVapidDetails(
        process.env.VAPID_MAILTO,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

// ── Rate limiters — protection routes sensibles ───────────────
const adminLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Trop de requêtes, réessayez plus tard.' }
});

const tchatSocialLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Trop de requêtes, réessayez plus tard.' }
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api',                  require('./routes/auth').router);
app.use('/api',                  require('./routes/changelog'));
app.use('/api/profil',           require('./routes/profil'));
app.use('/api/sante',            require('./routes/sante'));
app.use('/api/widget-order',     require('./routes/widgets'));
app.use('/api/taches',           require('./routes/taches'));
app.use('/api/anniversaires',    require('./routes/anniversaires'));
app.use('/api/push',             require('./routes/push').router);
app.use('/api/priere',           require('./routes/priere'));
app.use('/api/islam',            require('./routes/islam'));
app.use('/api/admin',            adminLimiter, require('./routes/admin'));
app.use('/api/cycle',            require('./routes/cycle'));
app.use('/api/agenda',           require('./routes/agenda'));
app.use('/api/astrologie',       require('./routes/astrologie'));
app.use('/api/theme-astral',     require('./routes/theme-astral'));
app.use('/api/pierre-naissance', require('./routes/pierre-naissance'));
app.use('/api/animal-totem',     require('./routes/animal-totem'));
app.use('/api/feed',             require('./routes/feed'));
app.use('/api/social',           tchatSocialLimiter, require('./routes/social'));
app.use('/api/eclats',           require('./routes/eclats'));
app.use('/api/sport',            require('./routes/sport'));
app.use('/api/tchat',            tchatSocialLimiter, tchatRouter);

// ── Route publique Open Graph (Partage de séance) ─────────────
// Cette route n'est PAS protégée par /api/auth. Elle est lue par
// les robots de WhatsApp, Facebook, etc., pour générer l'aperçu,
// et affiche l'image statique joliment pour un humain.
app.get('/share/seance/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).send('ID invalide');

    try {
        const { rows } = await pool.query(`
            SELECT s.id, w.name AS workout_name, 
                   u.username, pr.prenom, pr.nom
            FROM sport_sessions s
            LEFT JOIN sport_workouts w ON w.id = s.workout_id
            JOIN users u ON u.id = s.user_id
            LEFT JOIN profiles pr ON pr.user_id = s.user_id
            WHERE s.id = \$1
        `, [id]);

        if (!rows.length) return res.status(404).send('Séance introuvable');
        
        const session = rows[0];
        const nomAuteur = [session.prenom, session.nom].filter(Boolean).join(' ') || session.username;
        const initiale = (session.prenom ? session.prenom[0] : session.username[0]).toUpperCase();
        
        const baseUrl = req.protocol + '://' + req.get('host');
        const imageUrl = `${baseUrl}/uploads/sport_shares/share_seance_${id}.jpg`;
        const title = session.workout_name ? `Séance : ${session.workout_name}` : 'Séance Sport MoaDja';
        const desc = `Découvrez les statistiques de cette séance sur MoaDja !`;

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
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            box-sizing: border-box;
        }
        .logo {
            font-size: 24px;
            font-weight: 900;
            color: #7c3aed;
            margin-bottom: 30px;
            margin-top: 20px;
            letter-spacing: -0.5px;
        }
        .post-card {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255,255,255,0.8);
            border-radius: 24px;
            padding: 24px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 12px 32px rgba(0,0,0,0.08);
            box-sizing: border-box;
        }
        .header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }
        .avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, #7c3aed, #6d28d9);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 18px;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(124,58,237,0.3);
        }
        .author-name {
            font-weight: 800;
            color: #1f2937;
            font-size: 16px;
        }
        .author-handle {
            color: #6b7280;
            font-size: 13px;
            margin-top: 2px;
        }
        .post-image {
            max-width: 100%;
            height: auto;
            border-radius: 16px;
            margin-bottom: 20px;
            object-fit: contain;
            border: 1px solid rgba(0,0,0,0.05);
            display: block;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .cta-button {
            display: block;
            width: 100%;
            text-align: center;
            padding: 14px;
            background: rgba(167,139,250,0.85);
            color: white;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 700;
            transition: all 0.2s;
            box-shadow: 0 8px 24px rgba(167,139,250,0.25);
            box-sizing: border-box;
        }
        .cta-button:hover {
            transform: translateY(-2px);
            background: rgba(167,139,250,1);
        }
    </style>
</head>
<body>
    <div class="logo">MoaDja</div>
    <div class="post-card">
        <div class="header">
            <div class="avatar">${initiale}</div>
            <div>
                <div class="author-name">${nomAuteur}</div>
                <div class="author-handle">@${session.username}</div>
            </div>
        </div>
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

// ── Socket.io — authentification middleware ───────────────────
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token manquant'));
    try {
        const user        = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId     = user.id;
        socket.data.userId = user.id;
        next();
    } catch {
        next(new Error('Token invalide'));
    }
});

// ── Socket.io — connexions ────────────────────────────────────
io.on('connection', (socket) => {
    const userId = socket.userId;
    tchatConnectedUsers.add(userId);
    console.log(`[SOCKET] User ${userId} connecté — socket ${socket.id}`);

    // Notifier tous les autres de la connexion
    socket.broadcast.emit('tchat:presence', { userId, enligne: true });

    socket.on('tchat:rejoindre', ({ room }) => {
        if (!_roomValide(room, userId)) return;
        socket.join(room);
        console.log(`[SOCKET] User ${userId} rejoint room ${room}`);
    });

    socket.on('tchat:quitter', ({ room }) => {
        socket.leave(room);
        console.log(`[SOCKET] User ${userId} quitte room ${room}`);
    });

    socket.on('disconnect', () => {
        tchatConnectedUsers.delete(userId);
        // Notifier tous les autres de la déconnexion
        socket.broadcast.emit('tchat:presence', { userId, enligne: false });
        console.log(`[SOCKET] User ${userId} déconnecté`);
    });
});

// ── Valide qu'une room appartient bien à userId ───────────────
function _roomValide(room, userId) {
    const match = room.match(/^conv_(\d+)_(\d+)$/);
    if (!match) return false;
    const u1 = parseInt(match[1], 10);
    const u2 = parseInt(match[2], 10);
    return userId === u1 || userId === u2;
}

// ── Cron purge messages > 90j — toutes les 24h ───────────────
function _lancerCronPurge() {
    const VINGT_QUATRE_HEURES = 24 * 60 * 60 * 1000;
    purgerMessages(); // premier passage au démarrage
    setInterval(purgerMessages, VINGT_QUATRE_HEURES);
    console.log('[TCHAT] Cron purge 90j activé');
}

// ── Middleware erreurs global ─────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[ERREUR]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur inattendue.' });
});

// ── Démarrage ─────────────────────────────────────────────────
(async () => {
    try {
        await initDB();
        _lancerCronPurge();
        server.listen(PORT, () => console.log(`[SERVER] Démarré sur le port ${PORT}`));
    } catch (err) {
        console.error('[SERVER] Échec initDB — arrêt :', err.message);
        process.exit(1);
    }
})();
