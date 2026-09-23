// ============================================================
// routes/auth.js
// Authentification JWT — login + déblocage admin.
// ============================================================

const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const rateLimit  = require('express-rate-limit');
const { pool }   = require('../db/pool');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validerMotDePasse } = require('../utils/validations');

// ── Rate limiter login ────────────────────────────────────────
// 10 tentatives max par IP sur 15 minutes.
const loginLimiter = rateLimit({
    windowMs        : 15 * 60 * 1000,
    max             : 10,
    message         : { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
    standardHeaders : true,
    legacyHeaders   : false
});

// ── POST /api/login ───────────────────────────────────────────
// Vérifie les identifiants et retourne un token JWT 7 jours.
router.post('/login', loginLimiter, async (req, res) => {
    const { username: rawUsername, password } = req.body;

    const username = rawUsername ? rawUsername.trim().toLowerCase() : '';

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Identifiants manquants.' });
    }
    try {
        const result = await pool.query(
            'SELECT id, username, password, role, must_change_password FROM users WHERE username = \$1',
            [username]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Identifiants incorrects.' });
        }
        const user  = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Identifiants incorrects.' });
        }

        const mdpInvalide = validerMotDePasse(password) !== null;
        if (mdpInvalide && !user.must_change_password) {
            await pool.query('UPDATE users SET must_change_password = TRUE WHERE id = \$1', [user.id]);
        }

        await pool.query('UPDATE users SET last_login = NOW() WHERE id = \$1', [user.id]);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success            : true,
            role               : user.role,
            userId             : user.id,
            username           : user.username,
            token,
            mustChangePassword : user.must_change_password || mdpInvalide
        });
    } catch (err) {
        console.error('[AUTH] Erreur login :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/debloquer ───────────────────────────────────────
// Réservé admin. NB : aucune notion de compte "bloqué" n'existe
// actuellement dans la table users — cette route ne réalise donc
// aucune action de déblocage réelle pour l'instant.
router.post('/debloquer', authenticateToken, requireAdmin, async (req, res) => {
    res.json({ success: true, message: 'Action autorisée.' });
});

module.exports = { router, authenticateToken };
