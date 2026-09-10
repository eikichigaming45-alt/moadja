// ============================================================
// routes/feed.js
// Fil social : posts, likes, résonances, commentaires, follows, @mentions
// ============================================================

const express               = require('express');
const router                = express.Router();
const { pool }              = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const { envoyerPush }       = require('./push');
const multer                = require('multer');
const sharp                 = require('sharp');
const path                  = require('path');
const fs                    = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../public/uploads/posts');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const RESONANCES_VALIDES = ['douceur', 'energie', 'calme', 'inspiration'];

// ── Utilitaire : sauvegarder une image sur disque ────────────
async function sauvegarderImage(buffer, userId) {
    const filename = `${userId}_${Date.now()}.webp`;
    const filepath = path.join(UPLOADS_DIR, filename);
    await sharp(buffer).webp({ quality: 80 }).toFile(filepath);
    return `/uploads/posts/${filename}`;
}

// ── Utilitaire : supprimer une image du disque ───────────────
function supprimerImage(photo_url) {
    if (!photo_url) return;
    const filename = path.basename(photo_url);
    const filepath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
}

// ── Utilitaire : extraire et résoudre les @mentions ──────────
async function resoudreMentions(contenu, auteurId) {
    const matches = [...contenu.matchAll(/@([A-ZÀ-Ÿa-zà-ÿ][A-ZÀ-Ÿa-zà-ÿ]*(?:\s[A-ZÀ-Ÿa-zà-ÿ][A-ZÀ-Ÿa-zà-ÿ]*)*)(?:\u00A0|\s{2,}|\s|$)/g)];
    if (!matches.length) return [];
    const mentions = new Set();
    for (const m of matches) {
        const token = m[1].trim();
        if (token.toLowerCase() === 'toutlemonde') continue;
        const parts = token.split(/\s+/);
        if (parts.length < 2) continue;
        for (let i = 1; i < parts.length; i++) {
            const prenom = parts.slice(0, i).join(' ');
            const nom    = parts.slice(i).join(' ');
            const { rows } = await pool.query(
                `SELECT user_id FROM profiles
                 WHERE LOWER(prenom) = LOWER(\$1) AND LOWER(nom) = LOWER(\$2)
                 LIMIT 1`,
                [prenom, nom]
            );
            if (rows.length && rows[0].user_id !== auteurId) {
                mentions.add(rows[0].user_id);
                break;
            }
        }
    }
    return [...mentions];
}

// ── Utilitaire : notifier @toutlemonde ───────────────────────
async function notifierToutLeMonde(auteurId, refId, type, prenomAuteur, nomAuteur) {
    const { rows } = await pool.query('SELECT id FROM users WHERE id != \$1', [auteurId]);
    for (const u of rows) {
        await pool.query(
            `INSERT INTO notifications (user_id, type, ref_id, sender_id)
             VALUES (\$1, \$2, \$3, \$4) ON CONFLICT DO NOTHING`,
            [u.id, type === 'post' ? 'mention_post' : 'mention_comment', refId, auteurId]
        );
        await envoyerPush(
            u.id, '📢 Annonce générale',
            `${prenomAuteur}${nomAuteur ? ' ' + nomAuteur : ''} a publié une annonce pour tout le monde`,
            `toutlemonde-${type}-${refId}`
        );
    }
}

// ── Utilitaire : notifier les @mentions ──────────────────────
async function notifierMentions(mentionIds, auteurId, refId, type, prenomAuteur, nomAuteur) {
    for (const targetId of mentionIds) {
        await pool.query(
            `INSERT INTO notifications (user_id, type, ref_id, sender_id)
             VALUES (\$1, \$2, \$3, \$4) ON CONFLICT DO NOTHING`,
            [targetId, type === 'post' ? 'mention_post' : 'mention_comment', refId, auteurId]
        );
        await envoyerPush(
            targetId, '🏷️ Tu as été mentionné(e)',
            `${prenomAuteur}${nomAuteur ? ' ' + nomAuteur : ''} t'a mentionné(e) dans un ${type === 'post' ? 'post' : 'commentaire'}`,
            `mention-${type}-${refId}`
        );
    }
}

// ── Utilitaire : récupérer prenom/nom de l'auteur ────────────
async function getProfilAuteur(userId) {
    const { rows } = await pool.query(
        `SELECT prenom, nom FROM profiles WHERE user_id = \$1`, [userId]
    );
    return { prenom: rows[0]?.prenom || 'Quelqu\'un', nom: rows[0]?.nom || '' };
}

// ── Utilitaire : détecter @toutlemonde ───────────────────────
function contientToutLeMonde(contenu) {
    return /@toutlemonde(?:\s|$)/i.test(contenu);
}

// ── GET /api/feed/users (autocomplete @mention) ──────────────
router.get('/users', authenticateToken, async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, users: [] });
    try {
        const { rows } = await pool.query(
            `SELECT u.id, pr.prenom, pr.nom, pr.photo AS avatar
             FROM users u
             LEFT JOIN profiles pr ON pr.user_id = u.id
             WHERE LOWER(pr.prenom) LIKE LOWER(\$1)
                OR LOWER(pr.nom)    LIKE LOWER(\$1)
                OR LOWER(CONCAT(pr.prenom, ' ', pr.nom)) LIKE LOWER(\$1)
             ORDER BY pr.prenom, pr.nom
             LIMIT 8`,
            [`${q}%`]
        );
        res.json({ success: true, users: rows, isAdmin: req.user.role === 'admin' });
    } catch (e) {
        console.error('[FEED USERS SEARCH]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/feed ─────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const filter = req.query.filter;
    try {
        let query = `
            SELECT
                p.id, p.contenu, p.photo_url, p.created_at,
                p.lieu, p.lieu_lat, p.lieu_lon, p.personnes_taguees,
                p.mentions,
                CASE WHEN p.mentions IS NOT NULL AND array_length(p.mentions, 1) > 0 THEN (
                    SELECT json_agg(json_build_object('id', u2.id, 'prenom', pr2.prenom, 'nom', pr2.nom))
                    FROM unnest(p.mentions) AS mid
                    JOIN users u2 ON u2.id = mid
                    LEFT JOIN profiles pr2 ON pr2.user_id = u2.id
                ) ELSE NULL END AS mentions_data,
                pr.prenom, pr.nom, pr.photo AS avatar,
                u.username, u.id AS user_id,
                (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id)::int AS nb_resonances,
                (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id)::int AS nb_comments,
                (SELECT type FROM post_likes l WHERE l.post_id = p.id AND l.user_id = \$1 LIMIT 1) AS ma_resonance,
                (SELECT json_agg(json_build_object('type', l.type, 'nb', cnt)) FROM (
                    SELECT type, COUNT(*)::int AS cnt FROM post_likes WHERE post_id = p.id GROUP BY type
                ) l) AS resonances_stats
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN profiles pr ON pr.user_id = p.user_id
        `;
        const hashtag = (req.query.hashtag || '').trim().toLowerCase();
        const params  = [userId];
        if (filter === 'following') {
            query += ` WHERE p.user_id IN (SELECT following_id FROM follows WHERE follower_id = \$1)`;
            if (hashtag) { params.push(`%#${hashtag}%`); query += ` AND LOWER(p.contenu) LIKE \$2`; }
        } else if (hashtag) {
            params.push(`%#${hashtag}%`);
            query += ` WHERE LOWER(p.contenu) LIKE \$2`;
        }
        query += ` ORDER BY p.created_at DESC LIMIT 50`;
        const { rows } = await pool.query(query, params);
        res.json({ success: true, posts: rows });
    } catch (e) {
        console.error('[FEED GET]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/feed ────────────────────────────────────────────
router.post('/', authenticateToken, upload.single('photo'), async (req, res) => {
    const userId   = req.user.id;
    const contenu  = (req.body.contenu || '').trim();
    const photoB64 = req.body.photo || null;
    const lieu     = (req.body.lieu || '').trim() || null;
    const lieu_lat = (req.body.lieu_lat !== undefined && req.body.lieu_lat !== null && req.body.lieu_lat !== '')
        ? parseFloat(req.body.lieu_lat) : null;
    const lieu_lon = (req.body.lieu_lon !== undefined && req.body.lieu_lon !== null && req.body.lieu_lon !== '')
        ? parseFloat(req.body.lieu_lon) : null;
    const personnes_taguees = req.body.personnes_taguees
        ? JSON.parse(req.body.personnes_taguees)
        : [];

    if (!contenu && !photoB64 && !req.file) {
        return res.status(400).json({ success: false, message: 'Post vide.' });
    }
    try {
        let photo_url = null;
        if (req.file) {
            photo_url = await sauvegarderImage(req.file.buffer, userId);
        } else if (photoB64) {
            photo_url = await sauvegarderImage(Buffer.from(photoB64, 'base64'), userId);
        }
        const mentionIds = contenu ? await resoudreMentions(contenu, userId) : [];
        const { rows } = await pool.query(
            `INSERT INTO posts (user_id, contenu, photo_url, mentions, lieu, lieu_lat, lieu_lon, personnes_taguees)
             VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8)
             RETURNING id, contenu, photo_url, created_at, mentions, lieu, lieu_lat, lieu_lon, personnes_taguees`,
            [userId, contenu || null, photo_url, mentionIds, lieu, lieu_lat, lieu_lon, personnes_taguees]
        );
        const post = rows[0];
        const { prenom, nom } = await getProfilAuteur(userId);
        if (mentionIds.length) await notifierMentions(mentionIds, userId, post.id, 'post', prenom, nom);
        if (contenu && contientToutLeMonde(contenu) && req.user.role === 'admin') {
            await notifierToutLeMonde(userId, post.id, 'post', prenom, nom);
        }
        res.json({ success: true, post });
    } catch (e) {
        console.error('[FEED POST]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/feed/following ───────────────────────────────────
router.get('/following', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const { rows } = await pool.query(
            `SELECT following_id FROM follows WHERE follower_id = \$1`, [userId]
        );
        res.json({ success: true, following: rows.map(r => r.following_id) });
    } catch (e) {
        console.error('[FEED FOLLOWING]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/feed/follow/:id ─────────────────────────────────
router.post('/follow/:id', authenticateToken, async (req, res) => {
    const followerId  = req.user.id;
    const followingId = parseInt(req.params.id);
    if (followerId === followingId) {
        return res.status(400).json({ success: false, message: 'Impossible de se suivre soi-même.' });
    }
    try {
        const { rows } = await pool.query(
            `SELECT id FROM follows WHERE follower_id = \$1 AND following_id = \$2`,
            [followerId, followingId]
        );
        if (rows.length) {
            await pool.query(
                `DELETE FROM follows WHERE follower_id = \$1 AND following_id = \$2`,
                [followerId, followingId]
            );
            return res.json({ success: true, following: false });
        }
        await pool.query(
            `INSERT INTO follows (follower_id, following_id) VALUES (\$1, \$2)`,
            [followerId, followingId]
        );
        const { prenom, nom } = await getProfilAuteur(followerId);
        await pool.query(
            `INSERT INTO notifications (user_id, type, ref_id, sender_id) VALUES (\$1, 'follow', \$2, \$3)`,
            [followingId, followerId, followerId]
        );
        await envoyerPush(followingId, '👤 Nouvel abonné',
            `${prenom}${nom ? ' ' + nom : ''} a commencé à te suivre`, `follow-${followerId}`);
        res.json({ success: true, following: true });
    } catch (e) {
        console.error('[FEED FOLLOW]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/feed/:id/resonance ──────────────────────────────
router.post('/:id/resonance', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const postId = parseInt(req.params.id);
    const type   = (req.body.type || '').toLowerCase();

    if (!RESONANCES_VALIDES.includes(type)) {
        return res.status(400).json({ success: false, message: 'Type de résonance invalide.' });
    }
    try {
        const { rows: existing } = await pool.query(
            `SELECT id, type FROM post_likes WHERE post_id = \$1 AND user_id = \$2`,
            [postId, userId]
        );

        if (existing.length) {
            if (existing[0].type === type) {
                await pool.query(
                    `DELETE FROM post_likes WHERE post_id = \$1 AND user_id = \$2`,
                    [postId, userId]
                );
                return res.json({ success: true, ma_resonance: null });
            }
            await pool.query(
                `UPDATE post_likes SET type = \$1 WHERE post_id = \$2 AND user_id = \$3`,
                [type, postId, userId]
            );
        } else {
            await pool.query(
                `INSERT INTO post_likes (post_id, user_id, type) VALUES (\$1, \$2, \$3)`,
                [postId, userId, type]
            );
            const { rows: postRows } = await pool.query(
                `SELECT user_id FROM posts WHERE id = \$1`, [postId]
            );
            const ownerId = postRows[0]?.user_id;
            if (ownerId && ownerId !== userId) {
                const { prenom, nom } = await getProfilAuteur(userId);
                await pool.query(
                    `INSERT INTO notifications (user_id, type, ref_id, sender_id) VALUES (\$1, 'like', \$2, \$3)`,
                    [ownerId, postId, userId]
                );
                await envoyerPush(ownerId, '✨ Nouvelle résonance',
                    `${prenom}${nom ? ' ' + nom : ''} a résonné sur ta publication`, `like-${postId}-${userId}`);
            }
        }

        const { rows: stats } = await pool.query(
            `SELECT type, COUNT(*)::int AS nb FROM post_likes WHERE post_id = \$1 GROUP BY type`,
            [postId]
        );
        res.json({ success: true, ma_resonance: type, resonances_stats: stats });
    } catch (e) {
        console.error('[FEED RESONANCE]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/feed/:id/likes ───────────────────────────────────
router.get('/:id/likes', authenticateToken, async (req, res) => {
    const postId = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(`
            SELECT pr.prenom, pr.nom, pr.photo AS avatar, u.username, l.type
            FROM post_likes l
            JOIN users u ON u.id = l.user_id
            LEFT JOIN profiles pr ON pr.user_id = l.user_id
            WHERE l.post_id = \$1
            ORDER BY l.id ASC
        `, [postId]);
        res.json({ success: true, likers: rows });
    } catch (e) {
        console.error('[FEED LIKES GET]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/feed/:id/comments ────────────────────────────────
router.get('/:id/comments', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const postId = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(`
            SELECT c.id, c.contenu, c.created_at, c.parent_id, c.mentions,
                   CASE WHEN c.mentions IS NOT NULL AND array_length(c.mentions, 1) > 0 THEN (
                       SELECT json_agg(json_build_object('id', u2.id, 'prenom', pr2.prenom, 'nom', pr2.nom))
                       FROM unnest(c.mentions) AS mid
                       JOIN users u2 ON u2.id = mid
                       LEFT JOIN profiles pr2 ON pr2.user_id = u2.id
                   ) ELSE NULL END AS mentions_data,
                   pr.prenom, pr.nom, pr.photo AS avatar,
                   u.username, u.id AS user_id,
                   (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id)::int AS likes,
                   EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = \$2) AS liked
            FROM post_comments c
            JOIN users u ON u.id = c.user_id
            LEFT JOIN profiles pr ON pr.user_id = c.user_id
            WHERE c.post_id = \$1
            ORDER BY COALESCE(c.parent_id, c.id), c.id ASC
        `, [postId, userId]);
        res.json({ success: true, comments: rows });
    } catch (e) {
        console.error('[FEED COMMENTS GET]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/feed/:id/comments ───────────────────────────────
router.post('/:id/comments', authenticateToken, async (req, res) => {
    const userId   = req.user.id;
    const postId   = parseInt(req.params.id);
    const contenu  = (req.body.contenu || '').trim();
    const parentId = req.body.parent_id ? parseInt(req.body.parent_id) : null;
    if (!contenu) return res.status(400).json({ success: false, message: 'Commentaire vide.' });
    try {
                const mentionIds = await resoudreMentions(contenu, userId);
        const { rows } = await pool.query(
            `INSERT INTO post_comments (post_id, user_id, contenu, mentions, parent_id)
             VALUES (\$1, \$2, \$3, \$4, \$5)
             RETURNING id, contenu, created_at, mentions, parent_id`,
            [postId, userId, contenu, mentionIds, parentId]
        );
        const comment = rows[0];
        const { prenom, nom } = await getProfilAuteur(userId);
        const { rows: postRows } = await pool.query(`SELECT user_id FROM posts WHERE id = \$1`, [postId]);
        const ownerId = postRows[0]?.user_id;
        if (ownerId && ownerId !== userId) {
            await pool.query(
                `INSERT INTO notifications (user_id, type, ref_id, sender_id) VALUES (\$1, 'comment', \$2, \$3)`,
                [ownerId, comment.id, userId]
            );
            await envoyerPush(ownerId, '💬 Nouveau commentaire',
                `${prenom}${nom ? ' ' + nom : ''} a commenté ta publication`, `comment-${comment.id}`);
        }
        if (parentId) {
            const { rows: parentRows } = await pool.query(
                `SELECT user_id FROM post_comments WHERE id = \$1`, [parentId]
            );
            const parentAuteurId = parentRows[0]?.user_id;
            if (parentAuteurId && parentAuteurId !== userId && parentAuteurId !== ownerId) {
                await pool.query(
                    `INSERT INTO notifications (user_id, type, ref_id, sender_id) VALUES (\$1, 'reply', \$2, \$3)`,
                    [parentAuteurId, comment.id, userId]
                );
                await envoyerPush(parentAuteurId, '↩️ Réponse à ton commentaire',
                    `${prenom}${nom ? ' ' + nom : ''} a répondu à ton commentaire`, `reply-${comment.id}`);
            }
        }
        const exclus = [ownerId, parentId
            ? (await pool.query(`SELECT user_id FROM post_comments WHERE id = \$1`, [parentId])).rows[0]?.user_id
            : null].filter(Boolean);
        const mentionsFiltered = mentionIds.filter(id => !exclus.includes(id));
        if (mentionsFiltered.length) await notifierMentions(mentionsFiltered, userId, comment.id, 'comment', prenom, nom);
        if (contientToutLeMonde(contenu) && req.user.role === 'admin') {
            await notifierToutLeMonde(userId, comment.id, 'comment', prenom, nom);
        }
        res.json({ success: true, comment });
    } catch (e) {
        console.error('[FEED COMMENT POST]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/feed/comments/:id ────────────────────────────────
router.put('/comments/:id', authenticateToken, async (req, res) => {
    const userId    = req.user.id;
    const commentId = parseInt(req.params.id);
    const contenu   = (req.body.contenu || '').trim();
    if (!contenu) return res.status(400).json({ success: false, message: 'Contenu vide.' });
    try {
        const { rows } = await pool.query(`SELECT user_id FROM post_comments WHERE id = \$1`, [commentId]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Commentaire introuvable.' });
        if (rows[0].user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }
        const mentionIds = await resoudreMentions(contenu, userId);
        await pool.query(`UPDATE post_comments SET contenu = \$1, mentions = \$2 WHERE id = \$3`,
            [contenu, mentionIds, commentId]);
        const { prenom, nom } = await getProfilAuteur(userId);
        if (mentionIds.length) await notifierMentions(mentionIds, userId, commentId, 'comment', prenom, nom);
        if (contientToutLeMonde(contenu) && req.user.role === 'admin') {
            await notifierToutLeMonde(userId, commentId, 'comment', prenom, nom);
        }
        res.json({ success: true });
    } catch (e) {
        console.error('[FEED COMMENT PUT]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/feed/comments/:id ────────────────────────────
router.delete('/comments/:id', authenticateToken, async (req, res) => {
    const userId    = req.user.id;
    const commentId = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(`SELECT user_id FROM post_comments WHERE id = \$1`, [commentId]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Commentaire introuvable.' });
        if (rows[0].user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }
        await pool.query(`DELETE FROM post_comments WHERE id = \$1`, [commentId]);
        res.json({ success: true });
    } catch (e) {
        console.error('[FEED COMMENT DELETE]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/feed/comments/:id/like ─────────────────────────
router.post('/comments/:id/like', authenticateToken, async (req, res) => {
    const userId    = req.user.id;
    const commentId = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(
            `SELECT id FROM comment_likes WHERE comment_id = \$1 AND user_id = \$2`,
            [commentId, userId]
        );
        if (rows.length) {
            await pool.query(`DELETE FROM comment_likes WHERE comment_id = \$1 AND user_id = \$2`,
                [commentId, userId]);
            return res.json({ success: true, liked: false });
        }
        await pool.query(`INSERT INTO comment_likes (comment_id, user_id) VALUES (\$1, \$2)`,
            [commentId, userId]);
        res.json({ success: true, liked: true });
    } catch (e) {
        console.error('[COMMENT LIKE]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/feed/:id ─────────────────────────────────────────
router.put('/:id', authenticateToken, upload.single('photo'), async (req, res) => {
    const userId    = req.user.id;
    const postId    = parseInt(req.params.id);
    const contenu   = (req.body.contenu || '').trim();
    const photoB64  = req.body.photo || null;
    const suppPhoto = req.body.supprimer_photo === true || req.body.supprimer_photo === 'true';
    const lieu      = req.body.lieu !== undefined ? (req.body.lieu || '').trim() || null : undefined;
    const lieu_lat  = req.body.lieu_lat !== undefined
        ? (req.body.lieu_lat === null || req.body.lieu_lat === '' ? null : parseFloat(req.body.lieu_lat))
        : undefined;
    const lieu_lon  = req.body.lieu_lon !== undefined
        ? (req.body.lieu_lon === null || req.body.lieu_lon === '' ? null : parseFloat(req.body.lieu_lon))
        : undefined;
    const personnes_taguees = req.body.personnes_taguees
        ? JSON.parse(req.body.personnes_taguees)
        : undefined;
    try {
        const { rows } = await pool.query(
            `SELECT user_id, photo_url FROM posts WHERE id = \$1`, [postId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Post introuvable.' });
        const post = rows[0];
        if (post.user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }
        let photo_url = post.photo_url;
        if ((suppPhoto || req.file || photoB64) && post.photo_url) {
            supprimerImage(post.photo_url);
            photo_url = null;
        }
        if (req.file) {
            photo_url = await sauvegarderImage(req.file.buffer, userId);
        } else if (photoB64) {
            photo_url = await sauvegarderImage(Buffer.from(photoB64, 'base64'), userId);
        }
        const mentionIds = contenu ? await resoudreMentions(contenu, userId) : [];
        const setClauses = [
            `contenu = \$1`, `photo_url = \$2`, `mentions = \$3`
        ];
        const params = [contenu || null, photo_url, mentionIds];
        if (lieu !== undefined)              { params.push(lieu);               setClauses.push(`lieu = $${params.length}`); }
        if (lieu_lat !== undefined)          { params.push(lieu_lat);           setClauses.push(`lieu_lat = $${params.length}`); }
        if (lieu_lon !== undefined)          { params.push(lieu_lon);           setClauses.push(`lieu_lon = $${params.length}`); }
        if (personnes_taguees !== undefined) { params.push(personnes_taguees);  setClauses.push(`personnes_taguees = $${params.length}`); }
        params.push(postId);
        await pool.query(
            `UPDATE posts SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
            params
        );
        const { prenom, nom } = await getProfilAuteur(userId);
        if (mentionIds.length) await notifierMentions(mentionIds, userId, postId, 'post', prenom, nom);
        if (contenu && contientToutLeMonde(contenu) && req.user.role === 'admin') {
            await notifierToutLeMonde(userId, postId, 'post', prenom, nom);
        }
        res.json({ success: true, photo_url });
    } catch (e) {
        console.error('[FEED PUT]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/feed/:id ──────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const postId = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(
            `SELECT user_id, photo_url FROM posts WHERE id = \$1`, [postId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Post introuvable.' });
        const post = rows[0];
        if (post.user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }
        supprimerImage(post.photo_url);
        await pool.query(`DELETE FROM posts WHERE id = \$1`, [postId]);
        res.json({ success: true });
    } catch (e) {
        console.error('[FEED DELETE]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/feed/share/:id (Route publique pour prévisualisation WhatsApp) ──
// Attention : Pas de middleware authenticateToken ici, car WhatsApp doit pouvoir lire les balises !
router.get('/share/:id', async (req, res) => {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) return res.status(400).send('ID invalide');

    try {
        const { rows } = await pool.query(`
            SELECT p.contenu, p.photo_url, pr.prenom, pr.nom, u.username
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN profiles pr ON pr.user_id = p.user_id
            WHERE p.id = \$1
        `, [postId]);

        if (!rows.length) return res.status(404).send('Post introuvable');

        const post = rows[0];
        const nomAuteur = [post.prenom, post.nom].filter(Boolean).join(' ') || post.username;
        // Nettoyage du HTML (mentions, hashtags) pour le texte brut de description
        const contenuBrut = post.contenu ? post.contenu.replace(/<[^>]*>?/gm, '').trim() : '';
        const extrait = contenuBrut ? (contenuBrut.substring(0, 120) + '...') : `Voir la publication de ${nomAuteur}`;
        const titre = `Post de ${nomAuteur} sur MoaDja`;
        const imageUrl = post.photo_url ? `https://moadja.fr${post.photo_url}` : 'https://moadja.fr/images/logo.png'; // Fallback sur le logo si pas d'image

        const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titre}</title>
    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="https://moadja.fr/api/feed/share/${postId}" />
    <meta property="og:title" content="${titre}" />
    <meta property="og:description" content="${extrait}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:site_name" content="MoaDja" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${titre}" />
    <meta name="twitter:description" content="${extrait}" />
    <meta name="twitter:image" content="${imageUrl}" />
    
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f3f4f6; color: #374151; margin:0; }
        .card { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.1); text-align: center; }
    </style>
    <script>
        // Redirection immédiate vers l'application (PWA) pour les vrais utilisateurs
        window.location.replace("https://moadja.fr");
    </script>
</head>
<body>
    <div class="card">
        <p style="font-size: 14px; margin-bottom: 12px;">Redirection vers l'application MoaDja en cours...</p>
        <a href="https://moadja.fr" style="color: #7c3aed; text-decoration: none; font-weight: bold; font-size: 14px;">Cliquez ici si rien ne se passe</a>
    </div>
</body>
</html>`;
        res.send(html);
    } catch (e) {
        console.error('[FEED SHARE]', e.message);
        res.status(500).send('Erreur serveur');
    }
});


module.exports = router;
