// ============================================================
// routes/tchat.js
// ============================================================
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const sharp   = require('sharp');
const { pool } = require('../db/pool');
const { authenticateToken: auth } = require('../middleware/auth');

const TCHAT_UPLOADS_DIR = path.join(__dirname, '../public/uploads/posts');
if (!fs.existsSync(TCHAT_UPLOADS_DIR)) fs.mkdirSync(TCHAT_UPLOADS_DIR, { recursive: true });

const _upload = multer({
    storage: multer.memoryStorage(),
    limits : { fileSize: 10 * 1024 * 1024 },
    fileFilter(req, file, cb) {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Fichier non image.'));
    }
});

// ── GET /api/tchat/conversations ─────────────────────────────
router.get('/conversations', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows } = await pool.query(`
            SELECT
                u.id                            AS interlocuteur_id,
                u.username,
                p.prenom,
                p.nom,
                p.photo,
                pm.content                      AS dernier_message,
                pm.image_url                    AS dernier_image_url,
                pm.sender_id                    AS dernier_sender_id,
                pm.created_at                   AS dernier_message_at,
                COUNT(pm2.id) FILTER (
                    WHERE pm2.receiver_id = \$1
                    AND   pm2.seen = FALSE
                    AND   NOT (\$1 = ANY(COALESCE(pm2.deleted_for,'{}')))
                )::int                          AS non_lus
            FROM (
                SELECT DISTINCT ON (LEAST(sender_id,receiver_id), GREATEST(sender_id,receiver_id))
                    sender_id, receiver_id, content, image_url, created_at
                FROM private_messages
                WHERE (sender_id = \$1 OR receiver_id = \$1)
                    AND NOT (\$1 = ANY(COALESCE(deleted_for,'{}')))
                ORDER BY LEAST(sender_id,receiver_id), GREATEST(sender_id,receiver_id), created_at DESC
            ) pm
            JOIN users u ON u.id = CASE WHEN pm.sender_id = \$1 THEN pm.receiver_id ELSE pm.sender_id END
            LEFT JOIN profiles p ON p.user_id = u.id
            LEFT JOIN private_messages pm2
                ON (pm2.sender_id = u.id AND pm2.receiver_id = \$1)
            GROUP BY u.id, u.username, p.prenom, p.nom, p.photo,
                     pm.content, pm.image_url, pm.sender_id, pm.created_at
            ORDER BY pm.created_at DESC
        `, [moi]);
        res.json({ success: true, conversations: rows });
    } catch (err) {
        console.error('[TCHAT] conversations :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/tchat/messages/:interlocuteurId ──────────────────
router.get('/messages/:interlocuteurId', auth, async (req, res) => {
    const moi   = req.user.id;
    const autre = parseInt(req.params.interlocuteurId, 10);
    const avant = req.query.avant ? parseInt(req.query.avant, 10) : null;
    const LIMIT = 40;

    try {
        const params = [moi, autre];
        let whereAvant = '';
        if (avant) { params.push(avant); whereAvant = `AND pm.id < $${params.length}`; }

        const { rows } = await pool.query(`
            SELECT
                pm.id, pm.sender_id, pm.receiver_id,
                pm.content, pm.image_url, pm.seen, pm.created_at, pm.edited_at,
                pm.reply_to_id, pm.deleted_for,
                su.username  AS sender_username,
                sp.prenom    AS sender_prenom,
                sp.nom       AS sender_nom,
                sp.photo     AS sender_photo,
                rpm.content  AS reply_content,
                ru.username  AS reply_sender_username,
                rp2.prenom   AS reply_sender_prenom,
                rp2.nom      AS reply_sender_nom
            FROM private_messages pm
            JOIN users su         ON su.id = pm.sender_id
            LEFT JOIN profiles sp ON sp.user_id = pm.sender_id
            LEFT JOIN private_messages rpm ON rpm.id = pm.reply_to_id
            LEFT JOIN users ru        ON ru.id  = rpm.sender_id
            LEFT JOIN profiles rp2    ON rp2.user_id = rpm.sender_id
            WHERE (
                (pm.sender_id = \$1 AND pm.receiver_id = \$2) OR
                (pm.sender_id = \$2 AND pm.receiver_id = \$1)
            )
            AND NOT (\$1 = ANY(COALESCE(pm.deleted_for,'{}')))
            ${whereAvant}
            ORDER BY pm.id DESC
            LIMIT ${LIMIT}
        `, params);

        res.json({ success: true, messages: rows.reverse() });
    } catch (err) {
        console.error('[TCHAT] messages :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/tchat/messages ──────────────────────────────────
router.post('/messages', auth, async (req, res) => {
    const moi = req.user.id;
    const { receiver_id, content, reply_to_id } = req.body;
    if (!receiver_id || !content?.trim()) {
        return res.status(400).json({ success: false, message: 'Données manquantes.' });
    }
    try {
        const { rows } = await pool.query(`
            INSERT INTO private_messages (sender_id, receiver_id, content, reply_to_id)
            VALUES (\$1, \$2, \$3, \$4)
            RETURNING *
        `, [moi, receiver_id, content.trim(), reply_to_id || null]);

        const msg = rows[0];

        const { rows: extra } = await pool.query(`
            SELECT u.username AS sender_username, p.prenom AS sender_prenom,
                   p.nom AS sender_nom, p.photo AS sender_photo
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.id = \$1
        `, [moi]);

        const enriched = { ...msg, ...extra[0] };

        if (reply_to_id) {
            const { rows: rRows } = await pool.query(`
                SELECT pm.content AS reply_content,
                       u.username AS reply_sender_username,
                       p.prenom   AS reply_sender_prenom,
                       p.nom      AS reply_sender_nom
                FROM private_messages pm
                JOIN users u        ON u.id = pm.sender_id
                LEFT JOIN profiles p ON p.user_id = pm.sender_id
                WHERE pm.id = \$1
            `, [reply_to_id]);
            if (rRows[0]) Object.assign(enriched, rRows[0]);
        }

        const io   = req.app.get('io');
        const room = `conv_${Math.min(moi, receiver_id)}_${Math.max(moi, receiver_id)}`;
        if (io) io.to(room).emit('tchat:message', enriched);

        try {
            const { rows: subs } = await pool.query(
                'SELECT * FROM push_subscriptions WHERE user_id = \$1', [receiver_id]
            );
            if (subs.length) {
                const webpush    = require('web-push');
                const expediteur = extra[0]?.prenom || 'Quelqu\'un';
                const payload    = JSON.stringify({
                    title: `💬 ${expediteur}`,
                    body : content.trim().substring(0, 80),
                    url  : '/'
                });
                for (const sub of subs) {
                    try {
                        await webpush.sendNotification(
                            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                            payload
                        );
                    } catch { /* sub expirée */ }
                }
            }
        } catch { /* silencieux */ }

        res.json({ success: true, message: enriched });
    } catch (err) {
        console.error('[TCHAT] sendMessage :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/tchat/messages/image ───────────────────────────
router.post('/messages/image', auth, _upload.single('image'), async (req, res) => {
    const moi         = req.user.id;
    const receiver_id = parseInt(req.body.receiver_id, 10);
    const reply_to_id = req.body.reply_to_id ? parseInt(req.body.reply_to_id, 10) : null;

    if (!receiver_id || !req.file) {
        return res.status(400).json({ success: false, message: 'Données manquantes.' });
    }

    // Vérifie que le fichier est réellement une image (contenu réel, pas juste l'étiquette déclarée)
    try {
        await sharp(req.file.buffer).metadata();
    } catch {
        return res.status(400).json({ success: false, message: 'Fichier image invalide.' });
    }

    try {
        const filename = `tchat_${Date.now()}_${moi}.webp`;
        const filepath = path.join(TCHAT_UPLOADS_DIR, filename);

        await sharp(req.file.buffer)
            .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82 })
            .toFile(filepath);

        const image_url = `/uploads/posts/${filename}`;

        const { rows } = await pool.query(`
            INSERT INTO private_messages (sender_id, receiver_id, content, image_url, reply_to_id)
            VALUES (\$1, \$2, \$3, \$4, \$5)
            RETURNING *
        `, [moi, receiver_id, '', image_url, reply_to_id]);

        const msg = rows[0];

        const { rows: extra } = await pool.query(`
            SELECT u.username AS sender_username, p.prenom AS sender_prenom,
                   p.nom AS sender_nom, p.photo AS sender_photo
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.id = \$1
        `, [moi]);

        const enriched = { ...msg, ...extra[0] };

        if (reply_to_id) {
            const { rows: rRows } = await pool.query(`
                SELECT pm.content AS reply_content,
                       u.username AS reply_sender_username,
                       p.prenom   AS reply_sender_prenom,
                       p.nom      AS reply_sender_nom
                FROM private_messages pm
                JOIN users u        ON u.id = pm.sender_id
                LEFT JOIN profiles p ON p.user_id = pm.sender_id
                WHERE pm.id = \$1
            `, [reply_to_id]);
            if (rRows[0]) Object.assign(enriched, rRows[0]);
        }

        const io   = req.app.get('io');
        const room = `conv_${Math.min(moi, receiver_id)}_${Math.max(moi, receiver_id)}`;
        if (io) io.to(room).emit('tchat:message', enriched);

        try {
            const { rows: subs } = await pool.query(
                'SELECT * FROM push_subscriptions WHERE user_id = \$1', [receiver_id]
            );
            if (subs.length) {
                const webpush    = require('web-push');
                const expediteur = extra[0]?.prenom || 'Quelqu\'un';
                const payload    = JSON.stringify({
                    title: `💬 ${expediteur}`,
                    body : '📷 Photo',
                    url  : '/'
                });
                for (const sub of subs) {
                    try {
                        await webpush.sendNotification(
                            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                            payload
                        );
                    } catch { /* sub expirée */ }
                }
            }
        } catch { /* silencieux */ }

        res.json({ success: true, message: enriched });
    } catch (err) {
        console.error('[TCHAT] sendImage :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/tchat/messages/lus ─────────────────────────────
router.post('/messages/lus', auth, async (req, res) => {
    const moi   = req.user.id;
    const autre = req.body.interlocuteur_id;
    try {
        await pool.query(`
            UPDATE private_messages
            SET seen = TRUE
            WHERE receiver_id = \$1 AND sender_id = \$2 AND seen = FALSE
        `, [moi, autre]);

        const io   = req.app.get('io');
        const room = `conv_${Math.min(moi, autre)}_${Math.max(moi, autre)}`;
        if (io) io.to(room).emit('tchat:lu', { par: moi });

        res.json({ success: true });
    } catch (err) {
        console.error('[TCHAT] messages/lus :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/tchat/non-lus ────────────────────────────────────
router.get('/non-lus', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows } = await pool.query(`
            SELECT COUNT(*)::int AS total
            FROM private_messages
            WHERE receiver_id = \$1 AND seen = FALSE
                AND NOT (\$1 = ANY(COALESCE(deleted_for,'{}')))
        `, [moi]);
        res.json({ success: true, total: rows[0].total });
    } catch (err) {
        console.error('[TCHAT] non-lus :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/tchat/users ──────────────────────────────────────
router.get('/users', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows } = await pool.query(`
            SELECT u.id, u.username, p.prenom, p.nom, p.photo
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.id != \$1
            ORDER BY COALESCE(p.prenom, u.username) ASC
        `, [moi]);
        res.json({ success: true, users: rows });
    } catch (err) {
        console.error('[TCHAT] /users error:', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/tchat/presence ───────────────────────────────────
router.get('/presence', auth, async (req, res) => {
    try {
        const io = req.app.get('io');
        if (!io) return res.json({ success: true, enligne: [] });
        const sockets = await io.fetchSockets();
        const enligne = [...new Set(
            sockets
                .map(s => s.data?.userId)
                .filter(id => id != null && id !== req.user.id)
        )];
        res.json({ success: true, enligne });
    } catch (err) {
        console.error('[TCHAT] presence :', err.message);
        res.status(500).json({ success: false, enligne: [] });
    }
});

// ── PATCH /api/tchat/messages/:id ────────────────────────────
router.patch('/messages/:id', auth, async (req, res) => {
    const moi     = req.user.id;
    const msgId   = parseInt(req.params.id, 10);
    const content = req.body.content?.trim();
    if (!content) return res.status(400).json({ success: false, message: 'Contenu vide.' });
    try {
        const { rows } = await pool.query(`
            UPDATE private_messages
            SET content = \$1, edited_at = NOW()
            WHERE id = \$2 AND sender_id = \$3
            RETURNING *
        `, [content, msgId, moi]);
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });

        const msg  = rows[0];
        const io   = req.app.get('io');
        const room = `conv_${Math.min(moi, msg.receiver_id)}_${Math.max(moi, msg.receiver_id)}`;
        if (io) io.to(room).emit('tchat:modifie', { id: msg.id, content: msg.content, edited_at: msg.edited_at });

        res.json({ success: true, message: msg });
    } catch (err) {
        console.error('[TCHAT] update message :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/tchat/messages/:id ───────────────────────────
router.delete('/messages/:id', auth, async (req, res) => {
    const moi   = req.user.id;
    const msgId = parseInt(req.params.id, 10);
    try {
        const { rows } = await pool.query(`
            UPDATE private_messages
            SET deleted_for = array_append(COALESCE(deleted_for,'{}'), \$1)
            WHERE id = \$2
                AND (sender_id = \$1 OR receiver_id = \$1)
                AND NOT (\$1 = ANY(COALESCE(deleted_for,'{}')))
            RETURNING *
        `, [moi, msgId]);
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });

        const msg  = rows[0];
        const io   = req.app.get('io');
        const room = `conv_${Math.min(moi, msg.receiver_id)}_${Math.max(moi, msg.receiver_id)}`;
        if (io) io.to(room).emit('tchat:supprime', { id: msg.id, par: moi });

        res.json({ success: true });
    } catch (err) {
        console.error('[TCHAT] delete message :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/tchat/conversations/:interlocuteurId ─────────
router.delete('/conversations/:interlocuteurId', auth, async (req, res) => {
    const moi   = req.user.id;
    const autre = parseInt(req.params.interlocuteurId, 10);
    try {
        await pool.query(`
            UPDATE private_messages
            SET deleted_for = array_append(COALESCE(deleted_for,'{}'), \$1)
            WHERE (sender_id = \$1 OR receiver_id = \$1)
                AND (sender_id = \$2 OR receiver_id = \$2)
                AND NOT (\$1 = ANY(COALESCE(deleted_for,'{}')))
        `, [moi, autre]);
        res.json({ success: true });
    } catch (err) {
        console.error('[TCHAT] delete conversation :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/tchat/purge ─────────────────────────────────────
router.post('/purge', auth, async (req, res) => {
    try {
        const { rowCount } = await pool.query(
            "DELETE FROM private_messages WHERE created_at < NOW() - INTERVAL '90 days'"
        );
        res.json({ success: true, supprimés: rowCount });
    } catch (err) {
        console.error('[TCHAT] purge :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── Export ────────────────────────────────────────────────────
async function purgerMessages() {
    try {
        const { rowCount } = await pool.query(
            "DELETE FROM private_messages WHERE created_at < NOW() - INTERVAL '90 days'"
        );
        console.log(`[TCHAT] Purge 90j : ${rowCount} message(s) supprimé(s)`);
    } catch (err) {
        console.error('[TCHAT] Erreur purge :', err.message);
    }
}

module.exports = { router, purgerMessages };
