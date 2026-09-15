// ============================================================
// middleware/auth.js
// Auth JWT — met à jour last_activity à chaque requête auth.
// ============================================================

const jwt        = require('jsonwebtoken');
const { pool }   = require('../db/pool');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token manquant' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token invalide' });
        req.user = user;
        // Mise à jour last_activity non bloquante
        pool.query(
            'UPDATE users SET last_activity = NOW() WHERE id = \$1',
            [user.id]
        ).catch(e => console.error('[AUTH] last_activity update error:', e.message));
        next();
    });
}

async function requireAdmin(req, res, next) {
    if (!req.user?.id) {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    try {
        const result = await pool.query('SELECT role FROM users WHERE id = \$1', [req.user.id]);
        const currentRole = result.rows[0]?.role;
        if (currentRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }
        next();
    } catch (e) {
        console.error('[AUTH] requireAdmin role check error:', e.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

module.exports = { authenticateToken, requireAdmin };
