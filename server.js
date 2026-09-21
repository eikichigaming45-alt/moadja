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
app.get('/share/seance/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).send('ID invalide');

    try {
        const { rows } = await pool.query(`
            SELECT s.id, w.name AS workout_name, u.username, pr.prenom
            FROM sport_sessions s
            LEFT JOIN sport_workouts w ON w.id = s.workout_id
            JOIN users u ON u.id = s.user_id
            LEFT JOIN profiles pr ON pr.user_id = s.user_id
            WHERE s.id = \$1
        `, [id]);

        if (!rows.length) return res.status(404).send('Séance introuvable');
        
        const session = rows[0];
        const nomAuteur = session.prenom || session.username;
        const baseUrl = req.protocol + '://' + req.get('host');
        const imageUrl = `${baseUrl}/uploads/sport_shares/share_seance_${id}.jpg`;
        const title = `Séance Sport MoaDja de ${nomAuteur}`;
        const desc = `Découvrez les performances de ${nomAuteur} et rejoignez la communauté MoaDja !`;

        // Design "Landing Page de conversion"
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
            background: linear-gradient(135deg, #fff0e6 0%, #fdfbfb 50%, #f3e8ff 100%);
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            color: #1f2937;
        }
        .navbar {
            width: 100%;
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255, 255, 255, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.8);
            box-sizing: border-box;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .nav-logo {
            font-size: 20px;
            font-weight: 900;
            color: #7c3aed;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .nav-login {
            font-size: 14px;
            font-weight: 600;
            color: #4b5563;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.8);
            border: 1px solid #e5e7eb;
            transition: all 0.2s;
        }
        .nav-login:hover {
            background: #f3f4f6;
        }
        .hero {
            max-width: 600px;
            width: 100%;
            padding: 40px 20px;
            text-align: center;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 16px;
            flex: 1;
        }
        h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 800;
            line-height: 1.2;
            color: #111827;
        }
        h1 span {
            color: #7c3aed;
        }
        p.subtitle {
            margin: 0;
            font-size: 16px;
            color: #6b7280;
            line-height: 1.5;
        }
        .post-image {
            width: 100%;
            height: auto;
            border-radius: 20px;
            display: block;
            box-shadow: 0 12px 40px rgba(124, 58, 237, 0.15);
            background: #fff;
            margin-top: 10px;
        }
        .cta-container {
            margin-top: 24px;
            padding: 24px;
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.04);
            border: 1px solid #f3f4f6;
        }
        .cta-title {
            font-weight: 700;
            font-size: 18px;
            margin-bottom: 16px;
        }
        .cta-button {
            display: block;
            width: 100%;
            padding: 16px;
            background: #7c3aed;
            color: #ffffff;
            text-decoration: none;
            border-radius: 16px;
            font-weight: 700;
            font-size: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
            border: none;
        }
        .cta-button:hover {
            background: #6d28d9;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(124, 58, 237, 0.35);
        }
        
        /* Cacher la page de promo si l'utilisateur est déjà connecté sur cet appareil */
        html.auth-ok .promo-content { display: none !important; }
        html.auth-ok .hero { padding-top: 20px; }
        html.auth-ok h1 { display: none; }
        html.auth-ok p.subtitle { display: none; }
    </style>
    <script>
        // Mini script anti-flash : si connecté, on masque le blabla promo
        (function() {
            try {
                if (localStorage.getItem('moadja_user')) {
                    document.documentElement.classList.add('auth-ok');
                }
            } catch(e) {}
        })();
    </script>
</head>
<body>
    <nav class="navbar promo-content">
        <a href="https://moadja.fr" class="nav-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="2.5" y1="7" x2="2.5" y2="17"></line>
                <line x1="5.5" y1="9" x2="5.5" y2="15"></line>
                <line x1="18.5" y1="9" x2="18.5" y2="15"></line>
                <line x1="21.5" y1="7" x2="21.5" y2="17"></line>
                <line x1="5.5" y1="12" x2="18.5" y2="12"></line>
            </svg>
            MoaDja
        </a>
        <a href="https://moadja.fr" class="nav-login">Se connecter</a>
    </nav>

    <div class="hero">
        <h1><span>${nomAuteur}</span> a terminé une séance !</h1>
        <p class="subtitle">Découvrez ses statistiques ci-dessous.</p>
        
        <img src="${imageUrl}" class="post-image" alt="Statistiques de la séance">
        
        <div class="cta-container promo-content">
            <div class="cta-title">Envie de suivre vos propres entraînements ?</div>
            <a href="https://moadja.fr" class="cta-button">Créer mon espace gratuit</a>
        </div>
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
    purgerMessages(); 
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
