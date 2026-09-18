// routes/sport.js
// Module Sport : CRUD routines/jours/exercices/séances/logs + mensurations.
// Catalogue d'exercices en lecture seule via API externe (traduction FR
// complète, recherche insensible accents/casse, bilingue anglais/français).
const express = require('express');
const router  = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken: auth } = require('../middleware/auth');
const { SPORT_TRADUCTION_FR } = require('./sport-traduction-fr');

const WGER_BASE_URL = 'https://wger.de/api/v2';

// Estimation calories : MET par type d'exercice x poids x durée réelle.
const SPORT_MET_CARDIO    = 6;
const SPORT_MET_DYNAMIQUE = 5;

const SPORT_NOMS_CARDIO    = new Set();
const SPORT_NOMS_DYNAMIQUE = new Set();
Object.values(SPORT_TRADUCTION_FR).forEach(ex => {
    if (!ex) return;
    if (ex.cardio === true) SPORT_NOMS_CARDIO.add(ex.nom);
    if (ex.dynamique === true) SPORT_NOMS_DYNAMIQUE.add(ex.nom);
});

// ── DASHBOARD & STATS ──

router.get('/dashboard-stats', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows: sessions } = await pool.query(
            `SELECT s.id, s.date_start, s.date_end, s.status, w.name AS workout_name
             FROM sport_sessions s
             LEFT JOIN sport_workouts w ON s.workout_id = w.id
             WHERE s.user_id = \$1 AND s.status = 'completed'
             ORDER BY s.date_start DESC
             LIMIT 5`,
            [moi]
        );

        const seances = [];
        for (let s of sessions) {
            // Utilise ta fonction existante pour récupérer durée, volume, et calories
            const stats = await _sportCalculerStatsSession(s.id, moi);

            const { rows: logs } = await pool.query(
                `SELECT exercise_name, COUNT(*) as nb_series
                 FROM sport_session_logs
                 WHERE session_id = \$1
                 GROUP BY exercise_name
                 ORDER BY MIN(id) ASC`,
                [s.id]
            );

            seances.push({
                id: s.id,
                workout_name: s.workout_name || 'Séance Libre',
                date_start: s.date_start,
                date_end: s.date_end,
                dureeSecondes: stats ? stats.duree_secondes : 0,
                volumeKg: stats ? stats.volume_kg : 0,
                nb_records: 0,
                calories: stats ? stats.calories : 0,
                exercices: logs
            });
        }
        res.json({ success: true, dernieres_seances: seances });
    } catch (err) {
        console.error('[SPORT] GET /dashboard-stats :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── ROUTINES : sport_workouts ──

router.get('/workouts', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows } = await pool.query(
            `SELECT id, user_id, name, created_at
             FROM sport_workouts
             WHERE user_id = \$1
             ORDER BY created_at DESC`,
            [moi]
        );
        res.json({ success: true, workouts: rows });
    } catch (err) {
        console.error('[SPORT] GET /workouts :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/workouts', auth, async (req, res) => {
    const moi  = req.user.id;
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ success: false, message: 'Nom requis.' });
    try {
        const { rows } = await pool.query(
            `INSERT INTO sport_workouts (user_id, name)
             VALUES (\$1, \$2)
             RETURNING *`,
            [moi, name]
        );
        res.json({ success: true, workout: rows[0] });
    } catch (err) {
        console.error('[SPORT] POST /workouts :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/workouts/:id', auth, async (req, res) => {
    const moi = req.user.id;
    const id  = parseInt(req.params.id, 10);
    try {
        const { rows: workoutRows } = await pool.query(
            `SELECT id, user_id, name, created_at
             FROM sport_workouts
             WHERE id = \$1 AND user_id = \$2`,
            [id, moi]
        );
        if (!workoutRows.length) {
            return res.status(404).json({ success: false, message: 'Routine introuvable.' });
        }

        const { rows: days } = await pool.query(
            `SELECT id, workout_id, description, day_order
             FROM sport_workout_days
             WHERE workout_id = \$1
             ORDER BY day_order ASC`,
            [id]
        );

        const dayIds = days.map(d => d.id);
        let exercises = [];
        if (dayIds.length) {
            const { rows: exRows } = await pool.query(
                `SELECT id, day_id, wger_exercise_id, exercise_name,
                        order_in_day, target_sets, target_reps, target_duration_seconds,
                        target_weight_kg, target_rest_seconds
                 FROM sport_day_exercises
                 WHERE day_id = ANY(\$1::int[])
                 ORDER BY order_in_day ASC`,
                [dayIds]
            );
            exercises = exRows;
        }

        const joursAvecExercices = days.map(d => ({
            ...d,
            exercises: exercises.filter(e => e.day_id === d.id)
        }));

        res.json({ success: true, workout: { ...workoutRows[0], days: joursAvecExercices } });
    } catch (err) {
        console.error('[SPORT] GET /workouts/:id :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/workouts/:id', auth, async (req, res) => {
    const moi  = req.user.id;
    const id   = parseInt(req.params.id, 10);
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ success: false, message: 'Nom requis.' });
    try {
        const { rows } = await pool.query(
            `UPDATE sport_workouts
             SET name = \$1
             WHERE id = \$2 AND user_id = \$3
             RETURNING *`,
            [name, id, moi]
        );
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        res.json({ success: true, workout: rows[0] });
    } catch (err) {
        console.error('[SPORT] PUT /workouts/:id :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/workouts/:id', auth, async (req, res) => {
    const moi = req.user.id;
    const id  = parseInt(req.params.id, 10);
    try {
        const { rows } = await pool.query(
            `DELETE FROM sport_workouts
             WHERE id = \$1 AND user_id = \$2
             RETURNING id`,
            [id, moi]
        );
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        res.json({ success: true });
    } catch (err) {
        console.error('[SPORT] DELETE /workouts/:id :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── JOURS : sport_workout_days ──

router.post('/workouts/:workoutId/days', auth, async (req, res) => {
    const moi         = req.user.id;
    const workoutId   = parseInt(req.params.workoutId, 10);
    const description = req.body.description?.trim();
    const dayOrder    = Number.isInteger(req.body.day_order) ? req.body.day_order : 0;
    if (!description) return res.status(400).json({ success: false, message: 'Description requise.' });
    try {
        const { rows: owner } = await pool.query(
            `SELECT id FROM sport_workouts WHERE id = \$1 AND user_id = \$2`,
            [workoutId, moi]
        );
        if (!owner.length) return res.status(403).json({ success: false, message: 'Interdit.' });

        const { rows } = await pool.query(
            `INSERT INTO sport_workout_days (workout_id, description, day_order)
             VALUES (\$1, \$2, \$3)
             RETURNING *`,
            [workoutId, description, dayOrder]
        );
        res.json({ success: true, day: rows[0] });
    } catch (err) {
        console.error('[SPORT] POST /workouts/:workoutId/days :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/days/:dayId', auth, async (req, res) => {
    const moi         = req.user.id;
    const dayId       = parseInt(req.params.dayId, 10);
    const description = req.body.description?.trim();
    const dayOrder    = req.body.day_order;
    try {
        const { rows } = await pool.query(
            `UPDATE sport_workout_days AS d
             SET description = COALESCE(\$1, d.description),
                 day_order   = COALESCE(\$2, d.day_order)
             FROM sport_workouts AS w
             WHERE d.id = \$3
                 AND d.workout_id = w.id
                 AND w.user_id = \$4
             RETURNING d.*`,
            [description || null, Number.isInteger(dayOrder) ? dayOrder : null, dayId, moi]
        );
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        res.json({ success: true, day: rows[0] });
    } catch (err) {
        console.error('[SPORT] PUT /days/:dayId :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/days/:dayId', auth, async (req, res) => {
    const moi   = req.user.id;
    const dayId = parseInt(req.params.dayId, 10);
    try {
        const { rows } = await pool.query(
            `DELETE FROM sport_workout_days AS d
             USING sport_workouts AS w
             WHERE d.id = \$1
                 AND d.workout_id = w.id
                 AND w.user_id = \$2
             RETURNING d.id`,
            [dayId, moi]
        );
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        res.json({ success: true });
    } catch (err) {
        console.error('[SPORT] DELETE /days/:dayId :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── EXERCICES D'UN JOUR : sport_day_exercises ──

router.post('/days/:dayId/exercises', auth, async (req, res) => {
    const moi   = req.user.id;
    const dayId = parseInt(req.params.dayId, 10);
    const {
        wger_exercise_id, exercise_name,
        target_sets, target_reps, target_duration_seconds,
        target_weight_kg, target_rest_seconds
    } = req.body;

    if (!wger_exercise_id || !exercise_name?.trim()) {
        return res.status(400).json({ success: false, message: 'Données manquantes.' });
    }

    try {
        const { rows: owner } = await pool.query(
            `SELECT d.id
             FROM sport_workout_days d
             JOIN sport_workouts w ON w.id = d.workout_id
             WHERE d.id = \$1 AND w.user_id = \$2`,
            [dayId, moi]
        );
        if (!owner.length) return res.status(403).json({ success: false, message: 'Interdit.' });

        const { rows: maxOrderRows } = await pool.query(
            `SELECT COALESCE(MAX(order_in_day), 0) AS max_order
             FROM sport_day_exercises
             WHERE day_id = \$1`,
            [dayId]
        );
        const prochainOrdre = maxOrderRows[0].max_order + 1;

        const { rows } = await pool.query(
            `INSERT INTO sport_day_exercises
                 (day_id, wger_exercise_id, exercise_name, order_in_day, target_sets, target_reps,
                  target_duration_seconds, target_weight_kg, target_rest_seconds)
             VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9)
             RETURNING *`,
            [
                dayId,
                wger_exercise_id,
                exercise_name.trim(),
                prochainOrdre,
                Number.isInteger(target_sets)  ? target_sets  : 3,
                Number.isInteger(target_reps)  ? target_reps  : 10,
                Number.isInteger(target_duration_seconds) ? target_duration_seconds : null,
                target_weight_kg != null ? target_weight_kg : null,
                Number.isInteger(target_rest_seconds) ? target_rest_seconds : 60
            ]
        );
        res.json({ success: true, exercise: rows[0] });
    } catch (err) {
        console.error('[SPORT] POST /days/:dayId/exercises :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/days/:dayId/exercises/reorder', auth, async (req, res) => {
    const moi   = req.user.id;
    const dayId = parseInt(req.params.dayId, 10);
    const ordre = req.body.ordre;

    if (!Array.isArray(ordre) || !ordre.length) {
        return res.status(400).json({ success: false, message: 'Ordre invalide.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: owner } = await client.query(
            `SELECT d.id
             FROM sport_workout_days d
             JOIN sport_workouts w ON w.id = d.workout_id
             WHERE d.id = \$1 AND w.user_id = \$2`,
            [dayId, moi]
        );
        if (!owner.length) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }

        const { rows: existants } = await client.query(
            `SELECT id FROM sport_day_exercises WHERE day_id = \$1`,
            [dayId]
        );
        const idsValides  = new Set(existants.map(e => e.id));
        const idsRecus    = ordre.map(id => parseInt(id, 10));
        const tousValides = idsRecus.length === idsValides.size
            && idsRecus.every(id => idsValides.has(id));

        if (!tousValides) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Liste d'exercices incohérente." });
        }

        for (let i = 0; i < idsRecus.length; i++) {
            await client.query(
                `UPDATE sport_day_exercises SET order_in_day = \$1 WHERE id = \$2`,
                [i + 1, idsRecus[i]]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[SPORT] PUT /days/:dayId/exercises/reorder :', err.message);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

router.put('/exercises/:exerciseId', auth, async (req, res) => {
    const moi        = req.user.id;
    const exerciseId = parseInt(req.params.exerciseId, 10);
    const {
        exercise_name, order_in_day, target_sets, target_reps, target_duration_seconds,
        target_weight_kg, target_rest_seconds
    } = req.body;

    try {
        const { rows } = await pool.query(
            `UPDATE sport_day_exercises AS e
             SET exercise_name = COALESCE(\$1, e.exercise_name),
                 order_in_day  = COALESCE(\$2, e.order_in_day),
                 target_sets   = COALESCE(\$3, e.target_sets),
                 target_reps   = COALESCE(\$4, e.target_reps),
                 target_duration_seconds = COALESCE(\$5, e.target_duration_seconds),
                 target_weight_kg        = COALESCE(\$6, e.target_weight_kg),
                 target_rest_seconds     = COALESCE(\$7, e.target_rest_seconds)
             FROM sport_workout_days d
             JOIN sport_workouts w ON w.id = d.workout_id
             WHERE e.id = \$8
                 AND e.day_id = d.id
                 AND w.user_id = \$9
             RETURNING e.*`,
            [
                                exercise_name?.trim() || null,
                Number.isInteger(order_in_day) ? order_in_day : null,
                Number.isInteger(target_sets)  ? target_sets  : null,
                Number.isInteger(target_reps)  ? target_reps  : null,
                Number.isInteger(target_duration_seconds) ? target_duration_seconds : null,
                target_weight_kg != null ? target_weight_kg : null,
                Number.isInteger(target_rest_seconds) ? target_rest_seconds : null,
                exerciseId,
                moi
            ]
        );
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        res.json({ success: true, exercise: rows[0] });
    } catch (err) {
        console.error('[SPORT] PUT /exercises/:exerciseId :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/exercises/:exerciseId', auth, async (req, res) => {
    const moi        = req.user.id;
    const exerciseId = parseInt(req.params.exerciseId, 10);
    try {
        const { rows } = await pool.query(
            `DELETE FROM sport_day_exercises AS e
             USING sport_workout_days AS d, sport_workouts AS w
             WHERE e.id = \$1
                 AND e.day_id = d.id
                 AND d.workout_id = w.id
                 AND w.user_id = \$2
             RETURNING e.id`,
            [exerciseId, moi]
        );
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        res.json({ success: true });
    } catch (err) {
        console.error('[SPORT] DELETE /exercises/:exerciseId :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── SÉANCES : sport_sessions ──

router.get('/sessions', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows } = await pool.query(
            `SELECT id, user_id, workout_id, date_start, date_end, status
             FROM sport_sessions
             WHERE user_id = \$1
             ORDER BY date_start DESC`,
            [moi]
        );
        res.json({ success: true, sessions: rows });
    } catch (err) {
        console.error('[SPORT] GET /sessions :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/sessions/active', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows: sessions } = await pool.query(
            `SELECT id, user_id, workout_id, date_start, date_end, status
             FROM sport_sessions
             WHERE user_id = \$1 AND status = 'in_progress'
             ORDER BY date_start DESC
             LIMIT 1`,
            [moi]
        );
        if (!sessions.length) return res.json({ success: true, session: null });

        const { rows: logs } = await pool.query(
            `SELECT *
             FROM sport_session_logs
             WHERE session_id = \$1
             ORDER BY id ASC`,
            [sessions[0].id]
        );

        res.json({ success: true, session: { ...sessions[0], logs } });
    } catch (err) {
        console.error('[SPORT] GET /sessions/active :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/sessions/:id', auth, async (req, res) => {
    const moi = req.user.id;
    const id  = parseInt(req.params.id, 10);
    try {
        const { rows: sessions } = await pool.query(
            `SELECT id, user_id, workout_id, date_start, date_end, status
             FROM sport_sessions
             WHERE id = \$1 AND user_id = \$2`,
            [id, moi]
        );
        if (!sessions.length) return res.status(404).json({ success: false, message: 'Séance introuvable.' });

        const { rows: logs } = await pool.query(
            `SELECT *
             FROM sport_session_logs
             WHERE session_id = \$1
             ORDER BY id ASC`,
            [id]
        );

        res.json({ success: true, session: { ...sessions[0], logs } });
    } catch (err) {
        console.error('[SPORT] GET /sessions/:id :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/sessions', auth, async (req, res) => {
    const moi       = req.user.id;
    const workoutId = req.body.workout_id || null;
    try {
        const { rows: existante } = await pool.query(
            `SELECT id, user_id, workout_id, date_start, date_end, status
             FROM sport_sessions
             WHERE user_id = \$1 AND status = 'in_progress'
             ORDER BY date_start DESC
             LIMIT 1`,
            [moi]
        );
        if (existante.length) {
            return res.json({ success: true, session: existante[0] });
        }

        if (workoutId) {
            const { rows: owner } = await pool.query(
                `SELECT id FROM sport_workouts WHERE id = \$1 AND user_id = \$2`,
                [workoutId, moi]
            );
            if (!owner.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        }
        const { rows } = await pool.query(
            `INSERT INTO sport_sessions (user_id, workout_id, date_start)
             VALUES (\$1, \$2, NOW())
             RETURNING *`,
            [moi, workoutId]
        );
        res.json({ success: true, session: rows[0] });
    } catch (err) {
        console.error('[SPORT] POST /sessions :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/sessions/:id', auth, async (req, res) => {
    const moi    = req.user.id;
    const id     = parseInt(req.params.id, 10);
    const status = req.body.status;
    if (!['completed', 'abandoned'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }
    try {
        const { rows } = await pool.query(
            `UPDATE sport_sessions
             SET date_end = NOW(), status = \$1
             WHERE id = \$2 AND user_id = \$3
             RETURNING *`,
            [status, id, moi]
        );
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        res.json({ success: true, session: rows[0] });
    } catch (err) {
        console.error('[SPORT] PUT /sessions/:id :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/sessions/:id', auth, async (req, res) => {
    const moi = req.user.id;
    const id  = parseInt(req.params.id, 10);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: owner } = await client.query(
            `SELECT id FROM sport_sessions WHERE id = \$1 AND user_id = \$2`,
            [id, moi]
        );
        if (!owner.length) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }

        await client.query(`DELETE FROM sport_session_logs WHERE session_id = \$1`, [id]);
        await client.query(`DELETE FROM sport_sessions WHERE id = \$1`, [id]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[SPORT] DELETE /sessions/:id :', err.message);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

// ── LOGS D'UNE SÉANCE : sport_session_logs ──

router.post('/sessions/:sessionId/logs', auth, async (req, res) => {
    const moi       = req.user.id;
    const sessionId = parseInt(req.params.sessionId, 10);
    const {
        wger_exercise_id, exercise_name,
        sets, reps, weight_kg, duration_seconds
    } = req.body;

    if (!exercise_name?.trim()) {
        return res.status(400).json({ success: false, message: 'Nom de l\'exercice requis.' });
    }

    try {
        const { rows: owner } = await pool.query(
            `SELECT id FROM sport_sessions WHERE id = \$1 AND user_id = \$2`,
            [sessionId, moi]
        );
        if (!owner.length) return res.status(403).json({ success: false, message: 'Interdit.' });

        const { rows } = await pool.query(
            `INSERT INTO sport_session_logs
                 (session_id, wger_exercise_id, exercise_name, sets, reps, weight_kg, duration_seconds)
             VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7)
             RETURNING *`,
            [
                sessionId,
                wger_exercise_id || null,
                exercise_name.trim(),
                Number.isInteger(sets) ? sets : null,
                Number.isInteger(reps) ? reps : null,
                weight_kg != null ? weight_kg : null,
                Number.isInteger(duration_seconds) ? duration_seconds : null
            ]
        );
        res.json({ success: true, log: rows[0] });
    } catch (err) {
        console.error('[SPORT] POST /sessions/:sessionId/logs :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/logs/:logId', auth, async (req, res) => {
    const moi   = req.user.id;
    const logId = parseInt(req.params.logId, 10);
    try {
        const { rows } = await pool.query(
            `DELETE FROM sport_session_logs AS l
             USING sport_sessions AS s
             WHERE l.id = \$1
                 AND l.session_id = s.id
                 AND s.user_id = \$2
             RETURNING l.id`,
            [logId, moi]
        );
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        res.json({ success: true });
    } catch (err) {
        console.error('[SPORT] DELETE /logs/:logId :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── CATALOGUE EXERCICES (Lecture Seule - Traduction FR) ──

router.get('/wger/search', auth, async (req, res) => {
    const query = req.query.q?.trim().toLowerCase();
    if (!query) return res.json({ success: true, results: [] });

    try {
        const results = [];
        for (const [nomEn, data] of Object.entries(SPORT_TRADUCTION_FR)) {
            if (!data) continue;
            const matchEn = nomEn.toLowerCase().includes(query);
            const matchFr = data.nom.toLowerCase().includes(query);
            if (matchEn || matchFr) {
                results.push({
                    id: nomEn,
                    name: data.nom,
                    original_name: nomEn,
                    type: data.type,
                    cardio: data.cardio || false,
                    dynamique: data.dynamique || false
                });
            }
        }
        res.json({ success: true, results });
    } catch (err) {
        console.error('[SPORT] GET /wger/search :', err.message);
        res.status(500).json({ success: false, message: 'Erreur lors de la recherche des exercices.' });
    }
});

// ── RÉSUMÉ / STATS DE LA SÉANCE ──

router.get('/sessions/:id/stats', auth, async (req, res) => {
    const moi = req.user.id;
    const id  = parseInt(req.params.id, 10);

    try {
        const { rows: sessions } = await pool.query(
            `SELECT id, user_id FROM sport_sessions WHERE id = \$1 AND user_id = \$2`,
            [id, moi]
        );
        if (!sessions.length) return res.status(404).json({ success: false, message: 'Séance introuvable.' });

        const stats = await _sportCalculerStatsSession(id, moi);
        res.json({ success: true, stats });
    } catch (err) {
        console.error('[SPORT] GET /sessions/:id/stats :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * Calcule les statistiques d'une séance (Volume, Séries, Durée et Calories)
 * Utilise les METs (6 pour cardio, 5 pour dynamique) et le poids de l'utilisateur.
 */
async function _sportCalculerStatsSession(sessionId, userId) {
    // 1. Récupérer la séance et ses temps
    const { rows: sessionRows } = await pool.query(
        `SELECT date_start, date_end FROM sport_sessions WHERE id = \$1`,
        [sessionId]
    );
    if (!sessionRows.length) return null;
    const session = sessionRows[0];

    // 2. Récupérer le poids de l'utilisateur depuis la table profiles (colonne poids)
    //    Défaut 70kg si non renseigné.
    let userWeightKg = 70;
    const { rows: profRows } = await pool.query(
        `SELECT poids FROM profiles WHERE user_id = \$1`,
        [userId]
    );
    if (profRows.length > 0 && profRows[0].poids) {
        userWeightKg = parseFloat(profRows[0].poids);
    }

    // 3. Récupérer tous les logs de la séance
    const { rows: logs } = await pool.query(
        `SELECT exercise_name, sets, reps, weight_kg, duration_seconds
         FROM sport_session_logs
         WHERE session_id = \$1`,
        [sessionId]
    );

    let volumeTotal = 0;
    let seriesTotales = 0;
    let caloriesTotales = 0;
    let dureeTotaleSec = 0;

    // Calcul de la durée globale de la séance si elle est terminée
    if (session.date_start && session.date_end) {
        dureeTotaleSec = Math.max(0, Math.floor((new Date(session.date_end) - new Date(session.date_start)) / 1000));
    }

    // Parcours des logs
    logs.forEach(l => {
        // Volume (poids * reps * séries)
        const sets   = parseInt(l.sets, 10) || 0;
        const reps   = parseInt(l.reps, 10) || 0;
        const weight = parseFloat(l.weight_kg) || 0;
        volumeTotal += (sets * reps * weight);
        seriesTotales += sets;

        // Calories log par log
        const dureeExoSec = parseInt(l.duration_seconds, 10) || 0;
        if (dureeExoSec > 0) {
            const dureeExoHeures = dureeExoSec / 3600;
            let met = 0;

            if (SPORT_NOMS_CARDIO.has(l.exercise_name)) {
                met = SPORT_MET_CARDIO; // 6
            } else if (SPORT_NOMS_DYNAMIQUE.has(l.exercise_name)) {
                met = SPORT_MET_DYNAMIQUE; // 5
            }

            if (met > 0) {
                // Formule: kcal = MET * Poids(kg) * Temps(heures)
                caloriesTotales += (met * userWeightKg * dureeExoHeures);
            }
        }
    });

    return {
        duree_secondes: dureeTotaleSec,
        volume_kg: volumeTotal,
        series: seriesTotales,
        calories: Math.round(caloriesTotales) // Arrondi à l'entier pour l'affichage
    };
}

module.exports = router;
