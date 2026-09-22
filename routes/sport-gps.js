// ============================================================
// routes/sport-gps.js
// ============================================================
// API dédiée au module "Activité libre" (Tracking GPS).
// Gère la création de séances sans workout_id, l'enregistrement
// des points GPS, et la clôture avec statistiques (distance/vitesse).

const express = require('express');
const router  = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken: auth } = require('../middleware/auth');

// ── DÉMARRER UNE ACTIVITÉ LIBRE ──
router.post('/sessions', auth, async (req, res) => {
    const moi = req.user.id;
    // On nettoie la chaîne (minuscules, retrait des accents si écrit "vélo" ou "velo")
    const typeBrut = (req.body.activity_type || '').toLowerCase();
    const type = typeBrut === 'velo' ? 'vélo' : typeBrut;

    if (!['marche', 'course', 'vélo'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Type d\'activité invalide.' });
    }

    try {
        // Vérifier s'il y a déjà une activité en cours
        const { rows: existante } = await pool.query(`
            SELECT id, user_id, activity_type, date_start, status
            FROM sport_sessions
            WHERE user_id = \$1 AND status = 'in_progress'
            ORDER BY date_start DESC
            LIMIT 1
        `, [moi]);

        if (existante.length) {
            return res.json({ success: true, session: existante[0] });
        }

        // Création de la séance sans workout_id
        const { rows } = await pool.query(`
            INSERT INTO sport_sessions (user_id, workout_id, activity_type, date_start, status)
            VALUES (\$1, NULL, \$2, NOW(), 'in_progress')
            RETURNING *
        `, [moi, type]);

        res.json({ success: true, session: rows[0] });
    } catch (err) {
        console.error('[SPORT-GPS] POST /sessions :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── ENREGISTRER DES POINTS GPS (BATCH) ──
// Accepte un tableau de points pour limiter le nombre d'appels réseau
router.post('/sessions/:id/points', auth, async (req, res) => {
    const moi = req.user.id;
    const sessionId = parseInt(req.params.id, 10);
    const points = req.body.points; // Array: [{ lat, lng, recorded_at }]

    if (!Array.isArray(points) || points.length === 0) {
        return res.status(400).json({ success: false, message: 'Points GPS manquants.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Vérifier la propriété et l'état de la séance
        const { rows: owner } = await client.query(`
            SELECT id FROM sport_sessions WHERE id = \$1 AND user_id = \$2 AND status = 'in_progress'
        `, [sessionId, moi]);

        if (!owner.length) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Séance introuvable ou déjà terminée.' });
        }

        // Insérer les points
        const queryText = `
            INSERT INTO sport_gps_points (session_id, lat, lng, recorded_at)
            VALUES (\$1, \$2, \$3, \$4)
        `;
        for (const pt of points) {
            const recordDate = pt.recorded_at ? new Date(pt.recorded_at) : new Date();
            await client.query(queryText, [sessionId, pt.lat, pt.lng, recordDate]);
        }

        await client.query('COMMIT');
        res.json({ success: true, inserted: points.length });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[SPORT-GPS] POST /sessions/:id/points :', err.message);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

// ── CLÔTURER L'ACTIVITÉ LIBRE ──
router.put('/sessions/:id/end', auth, async (req, res) => {
    const moi = req.user.id;
    const sessionId = parseInt(req.params.id, 10);
    const { distance_km, vitesse_moyenne_kmh } = req.body;

    try {
        const { rows } = await pool.query(`
            UPDATE sport_sessions
            SET date_end = NOW(),
                status = 'completed',
                distance_km = \$1,
                vitesse_moyenne_kmh = \$2
            WHERE id = \$3 AND user_id = \$4 AND status = 'in_progress'
            RETURNING *
        `, [
            distance_km != null ? parseFloat(distance_km) : null,
            vitesse_moyenne_kmh != null ? parseFloat(vitesse_moyenne_kmh) : null,
            sessionId,
            moi
        ]);

        if (!rows.length) {
            return res.status(403).json({ success: false, message: 'Séance introuvable ou déjà terminée.' });
        }

        res.json({ success: true, session: rows[0] });
    } catch (err) {
        console.error('[SPORT-GPS] PUT /sessions/:id/end :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── RÉCUPÉRER LES POINTS GPS D'UNE SÉANCE (Pour affichage carte) ──
router.get('/sessions/:id/points', auth, async (req, res) => {
    const moi = req.user.id;
    const sessionId = parseInt(req.params.id, 10);

    try {
        const { rows: owner } = await pool.query(`
            SELECT id FROM sport_sessions WHERE id = \$1 AND user_id = \$2
        `, [sessionId, moi]);

        if (!owner.length) {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }

        const { rows: points } = await pool.query(`
            SELECT lat, lng, recorded_at
            FROM sport_gps_points
            WHERE session_id = \$1
            ORDER BY recorded_at ASC
        `, [sessionId]);

        res.json({ success: true, points });
    } catch (err) {
        console.error('[SPORT-GPS] GET /sessions/:id/points :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
