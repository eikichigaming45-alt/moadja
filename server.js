// ============================================================
// server.js
// ============================================================

require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const webpush    = require('web-push');
const jwt        = require('jsonwebtoken');
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
app.use('/api/admin',            require('./routes/admin'));
app.use('/api/cycle',            require('./routes/cycle'));
app.use('/api/agenda',           require('./routes/agenda'));
app.use('/api/astrologie',       require('./routes/astrologie'));
app.use('/api/theme-astral',     require('./routes/theme-astral'));
app.use('/api/pierre-naissance', require('./routes/pierre-naissance'));
app.use('/api/animal-totem',     require('./routes/animal-totem'));
app.use('/api/feed',             require('./routes/feed'));
app.use('/api/social',           require('./routes/social'));
app.use('/api/eclats',           require('./routes/eclats'));
app.use('/api/sport',            require('./routes/sport'));
app.use('/api/tchat',            tchatRouter);

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
