// ============================================================
// routes/sport.js
// ============================================================
// Module Sport : CRUD routines/jours/exercices/séances/logs + mensurations.
// Toutes les routes scopées par user. Catalogue WGER en lecture seule
// (traduction FR complète via SPORT_TRADUCTION_FR, toutes catégories,
// recherche insensible accents/casse, bilingue anglais/français).
const express = require('express');
const router  = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken: auth } = require('../middleware/auth');
const { SPORT_TRADUCTION_FR } = require('./sport-traduction-fr');

const WGER_BASE_URL = 'https://wger.de/api/v2';

// Estimation calories : MET pondéré (5=muscu, 6=cardio) x poids x durée.
// Indicatif uniquement, ne remplace pas une mesure médicale.
const SPORT_MET_MUSCULATION = 5;
const SPORT_MET_CARDIO      = 6;

// ── ROUTINES : sport_workouts ──

// Tri par workout_order (réorganisation manuelle par glisser-déposer),
// NULLS LAST + created_at ASC en repli si une ligne n'a jamais reçu d'ordre.
router.get('/workouts', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows } = await pool.query(`
            SELECT id, user_id, name, created_at, workout_order
            FROM sport_workouts
            WHERE user_id = \$1
            ORDER BY workout_order ASC NULLS LAST, created_at ASC
        `, [moi]);
        res.json({ success: true, workouts: rows });
    } catch (err) {
        console.error('[SPORT] GET /workouts :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Nouvelle routine placée en dernière position (MAX(workout_order) + 1).
router.post('/workouts', auth, async (req, res) => {
    const moi  = req.user.id;
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ success: false, message: 'Nom requis.' });
    try {
        const { rows: maxOrderRows } = await pool.query(`
            SELECT COALESCE(MAX(workout_order), 0) AS max_order
            FROM sport_workouts
            WHERE user_id = \$1
        `, [moi]);
        const prochainOrdre = maxOrderRows[0].max_order + 1;

        const { rows } = await pool.query(`
            INSERT INTO sport_workouts (user_id, name, workout_order)
            VALUES (\$1, \$2, \$3)
            RETURNING *
        `, [moi, name, prochainOrdre]);
        res.json({ success: true, workout: rows[0] });
    } catch (err) {
        console.error('[SPORT] POST /workouts :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Réordonnancement en masse des routines d'un utilisateur (drag-and-drop).
router.put('/workouts/reorder', auth, async (req, res) => {
    const moi   = req.user.id;
    const ordre = req.body.ordre;

    if (!Array.isArray(ordre) || !ordre.length) {
        return res.status(400).json({ success: false, message: 'Ordre invalide.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: existantes } = await client.query(`
            SELECT id FROM sport_workouts WHERE user_id = \$1
        `, [moi]);
        const idsValides  = new Set(existantes.map(w => w.id));
        const idsRecus    = ordre.map(id => parseInt(id, 10));
        const tousValides = idsRecus.length === idsValides.size
            && idsRecus.every(id => idsValides.has(id));

        if (!tousValides) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Liste de routines incohérente.' });
        }

        for (let i = 0; i < idsRecus.length; i++) {
            await client.query(`
                UPDATE sport_workouts SET workout_order = \$1 WHERE id = \$2 AND user_id = \$3
            `, [i + 1, idsRecus[i], moi]);
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[SPORT] PUT /workouts/reorder :', err.message);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

// Ajout target_weight_kg / target_rest_seconds au SELECT des exercices.
router.get('/workouts/:id', auth, async (req, res) => {
    const moi = req.user.id;
    const id  = parseInt(req.params.id, 10);
    try {
        const { rows: workoutRows } = await pool.query(`
            SELECT id, user_id, name, created_at, workout_order
            FROM sport_workouts
            WHERE id = \$1 AND user_id = \$2
        `, [id, moi]);
        if (!workoutRows.length) {
            return res.status(404).json({ success: false, message: 'Routine introuvable.' });
        }

        const { rows: days } = await pool.query(`
            SELECT id, workout_id, description, day_order
            FROM sport_workout_days
            WHERE workout_id = \$1
            ORDER BY day_order ASC
        `, [id]);

        const dayIds = days.map(d => d.id);
        let exercises = [];
        if (dayIds.length) {
            const { rows: exRows } = await pool.query(`
                SELECT id, day_id, wger_exercise_id, exercise_name,
                       order_in_day, target_sets, target_reps, target_duration_seconds,
                       target_weight_kg, target_rest_seconds
                FROM sport_day_exercises
                WHERE day_id = ANY(\$1::int[])
                ORDER BY order_in_day ASC
            `, [dayIds]);
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
        const { rows } = await pool.query(`
            UPDATE sport_workouts
            SET name = \$1
            WHERE id = \$2 AND user_id = \$3
            RETURNING *
        `, [name, id, moi]);
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
        const { rows } = await pool.query(`
            DELETE FROM sport_workouts
            WHERE id = \$1 AND user_id = \$2
            RETURNING id
        `, [id, moi]);
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
        const { rows: owner } = await pool.query(`
            SELECT id FROM sport_workouts WHERE id = \$1 AND user_id = \$2
        `, [workoutId, moi]);
        if (!owner.length) return res.status(403).json({ success: false, message: 'Interdit.' });

        const { rows } = await pool.query(`
            INSERT INTO sport_workout_days (workout_id, description, day_order)
            VALUES (\$1, \$2, \$3)
            RETURNING *
        `, [workoutId, description, dayOrder]);
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
        const { rows } = await pool.query(`
            UPDATE sport_workout_days AS d
            SET description = COALESCE(\$1, d.description),
                day_order   = COALESCE(\$2, d.day_order)
            FROM sport_workouts AS w
            WHERE d.id = \$3
                AND d.workout_id = w.id
                AND w.user_id = \$4
            RETURNING d.*
        `, [description || null, Number.isInteger(dayOrder) ? dayOrder : null, dayId, moi]);
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
        const { rows } = await pool.query(`
            DELETE FROM sport_workout_days AS d
            USING sport_workouts AS w
            WHERE d.id = \$1
                AND d.workout_id = w.id
                AND w.user_id = \$2
            RETURNING d.id
        `, [dayId, moi]);
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
        const { rows: owner } = await pool.query(`
            SELECT d.id
            FROM sport_workout_days d
            JOIN sport_workouts w ON w.id = d.workout_id
            WHERE d.id = \$1 AND w.user_id = \$2
        `, [dayId, moi]);
        if (!owner.length) return res.status(403).json({ success: false, message: 'Interdit.' });

        // Calcul automatique de la position : dernier ordre du jour + 1.
        const { rows: maxOrderRows } = await pool.query(`
            SELECT COALESCE(MAX(order_in_day), 0) AS max_order
            FROM sport_day_exercises
            WHERE day_id = \$1
        `, [dayId]);
        const prochainOrdre = maxOrderRows[0].max_order + 1;

        const { rows } = await pool.query(`
            INSERT INTO sport_day_exercises
                (day_id, wger_exercise_id, exercise_name, order_in_day, target_sets, target_reps,
                 target_duration_seconds, target_weight_kg, target_rest_seconds)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9)
            RETURNING *
        `, [
            dayId,
            wger_exercise_id,
            exercise_name.trim(),
            prochainOrdre,
            Number.isInteger(target_sets)  ? target_sets  : 3,
            Number.isInteger(target_reps)  ? target_reps  : 10,
            Number.isInteger(target_duration_seconds) ? target_duration_seconds : null,
            target_weight_kg != null ? target_weight_kg : null,
            Number.isInteger(target_rest_seconds) ? target_rest_seconds : 60
        ]);
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

        const { rows: owner } = await client.query(`
            SELECT d.id
            FROM sport_workout_days d
            JOIN sport_workouts w ON w.id = d.workout_id
            WHERE d.id = \$1 AND w.user_id = \$2
        `, [dayId, moi]);
        if (!owner.length) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }

        const { rows: existants } = await client.query(`
            SELECT id FROM sport_day_exercises WHERE day_id = \$1
        `, [dayId]);
        const idsValides  = new Set(existants.map(e => e.id));
        const idsRecus    = ordre.map(id => parseInt(id, 10));
        const tousValides = idsRecus.length === idsValides.size
            && idsRecus.every(id => idsValides.has(id));

        if (!tousValides) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Liste d'exercices incohérente." });
        }

        for (let i = 0; i < idsRecus.length; i++) {
            await client.query(`
                UPDATE sport_day_exercises SET order_in_day = \$1 WHERE id = \$2
            `, [i + 1, idsRecus[i]]);
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
        const { rows } = await pool.query(`
            UPDATE sport_day_exercises AS e
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
            RETURNING e.*
        `, [
            exercise_name?.trim() || null,
            Number.isInteger(order_in_day) ? order_in_day : null,
            Number.isInteger(target_sets)  ? target_sets  : null,
            Number.isInteger(target_reps)  ? target_reps  : null,
            Number.isInteger(target_duration_seconds) ? target_duration_seconds : null,
            target_weight_kg != null ? target_weight_kg : null,
            Number.isInteger(target_rest_seconds) ? target_rest_seconds : null,
            exerciseId,
            moi
        ]);
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
        const { rows } = await pool.query(`
            DELETE FROM sport_day_exercises AS e
            USING sport_workout_days AS d, sport_workouts AS w
            WHERE e.id = \$1
                AND e.day_id = d.id
                AND d.workout_id = w.id
                AND w.user_id = \$2
            RETURNING e.id
        `, [exerciseId, moi]);
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
        const { rows } = await pool.query(`
            SELECT id, user_id, workout_id, date_start, date_end, status
            FROM sport_sessions
            WHERE user_id = \$1
            ORDER BY date_start DESC
        `, [moi]);
        res.json({ success: true, sessions: rows });
    } catch (err) {
        console.error('[SPORT] GET /sessions :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/sessions/active', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows: sessions } = await pool.query(`
            SELECT id, user_id, workout_id, date_start, date_end, status
            FROM sport_sessions
            WHERE user_id = \$1 AND status = 'in_progress'
            ORDER BY date_start DESC
            LIMIT 1
        `, [moi]);
        if (!sessions.length) return res.json({ success: true, session: null });

        const { rows: logs } = await pool.query(`
            SELECT *
            FROM sport_session_logs
            WHERE session_id = \$1
            ORDER BY id ASC
        `, [sessions[0].id]);

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
        const { rows: sessions } = await pool.query(`
            SELECT id, user_id, workout_id, date_start, date_end, status
            FROM sport_sessions
            WHERE id = \$1 AND user_id = \$2
        `, [id, moi]);
        if (!sessions.length) return res.status(404).json({ success: false, message: 'Séance introuvable.' });

        const { rows: logs } = await pool.query(`
            SELECT *
            FROM sport_session_logs
            WHERE session_id = \$1
            ORDER BY id ASC
        `, [id]);

        res.json({ success: true, session: { ...sessions[0], logs } });
    } catch (err) {
        console.error('[SPORT] GET /sessions/:id :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/sessions', auth, async (req, res) => {
    const moi       = req.user.id;
    const workoutId = req.body.workout_id || null;

    // FIX 6.8 : workout_id strictement obligatoire pour créer une session
    if (!workoutId) {
        return res.status(400).json({ success: false, message: 'workout_id requis.' });
    }

    try {
        // FIX 6.8 : On vérifie s'il existe une séance active POUR CETTE ROUTINE spécifiquement
        const { rows: existante } = await pool.query(`
            SELECT id, user_id, workout_id, date_start, date_end, status
            FROM sport_sessions
            WHERE user_id = \$1 AND status = 'in_progress' AND workout_id = \$2
            ORDER BY date_start DESC
            LIMIT 1
        `, [moi, workoutId]);
        if (existante.length) {
            return res.json({ success: true, session: existante[0] });
        }

        const { rows: owner } = await pool.query(`
            SELECT id FROM sport_workouts WHERE id = \$1 AND user_id = \$2
        `, [workoutId, moi]);
        if (!owner.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        
        const { rows } = await pool.query(`
            INSERT INTO sport_sessions (user_id, workout_id, date_start)
            VALUES (\$1, \$2, NOW())
            RETURNING *
        `, [moi, workoutId]);
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
        const { rows } = await pool.query(`
            UPDATE sport_sessions
            SET date_end = NOW(), status = \$1
            WHERE id = \$2 AND user_id = \$3
            RETURNING *
        `, [status, id, moi]);
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

        const { rows: owner } = await client.query(`
            SELECT id FROM sport_sessions WHERE id = \$1 AND user_id = \$2
        `, [id, moi]);
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

// ── DASHBOARD & WIDGET : stats agrégées + Mifflin-St Jeor ──

// Calcule l'âge à partir d'une date de naissance
function _calculerAge(dateNaissance) {
    if (!dateNaissance) return null;
    const n = new Date(dateNaissance);
    if (isNaN(n.getTime())) return null;
    const aujourdhui = new Date();
    let age = aujourdhui.getFullYear() - n.getFullYear();
    const pasEncoreAnniversaire =
        aujourdhui.getMonth() < n.getMonth() ||
        (aujourdhui.getMonth() === n.getMonth() && aujourdhui.getDate() < n.getDate());
    if (pasEncoreAnniversaire) age--;
    return age;
}

function _sportCalculerStatsSession(session, logs, profil) {
    const logsValides = logs.filter(l => l.completed);

    const dureeSecondes = session.date_end
        ? Math.max(0, Math.round((new Date(session.date_end) - new Date(session.date_start)) / 1000))
        : 0;

    let volumeKg = 0;
    let nbCardio = 0, nbMusculation = 0;

    logsValides.forEach(l => {
        const estCardio = l.distance_km != null || l.duration_seconds != null;
        if (estCardio) {
            nbCardio++;
        } else {
            nbMusculation++;
            if (l.weight_kg != null && l.reps != null) {
                volumeKg += parseFloat(l.weight_kg) * l.reps;
            }
        }
    });

    const totalSeries = nbCardio + nbMusculation;
    let calories = null;
    let profil_incomplet = false;

    if (totalSeries > 0 && dureeSecondes > 0) {
        const poids = profil?.poids != null ? parseFloat(profil.poids) : null;
        const taille = profil?.taille != null ? parseFloat(profil.taille) : null;
        const age = _calculerAge(profil?.date_naissance);
        const sexe = profil?.sexe ? profil.sexe.toLowerCase() : null;

        if (poids && taille && age && (sexe === 'homme' || sexe === 'femme')) {
            const s = (sexe === 'homme') ? 5 : -161;
            const bmr = (10 * poids) + (6.25 * taille) - (5 * age) + s;
            const metPondere = ((nbMusculation * SPORT_MET_MUSCULATION) + (nbCardio * SPORT_MET_CARDIO)) / totalSeries;
            
            calories = Math.round(metPondere * (bmr / 24) * (dureeSecondes / 3600));
        } else {
            profil_incomplet = true;
        }
    }

    return {
        dureeSecondes,
        volumeKg: Math.round(volumeKg * 10) / 10,
        nbSeries: logsValides.length,
        calories,
        profil_incomplet
    };
}

function _sportConsoliderExercicesSession(logs) {
    const logsValides = logs.filter(l => l.completed);
    const blocs = [];

    logsValides.forEach(l => {
        const estCardio = l.distance_km != null || l.duration_seconds != null;

        const detailSerie = estCardio
            ? {
                distance_km     : l.distance_km != null ? parseFloat(l.distance_km) : null,
                duration_seconds: l.duration_seconds,
                speed_kmh       : l.speed_kmh != null ? parseFloat(l.speed_kmh) : null,
                incline_percent : l.incline_percent != null ? parseFloat(l.incline_percent) : null
            }
            : {
                reps     : l.reps,
                weight_kg: l.weight_kg != null ? parseFloat(l.weight_kg) : null
            };

        const dernierBloc = blocs[blocs.length - 1];
        if (dernierBloc && dernierBloc.exercise_name === l.exercise_name) {
            dernierBloc.nb_series++;
            dernierBloc.series.push(detailSerie);
        } else {
            blocs.push({
                exercise_name   : l.exercise_name,
                wger_exercise_id: l.wger_exercise_id,
                est_cardio      : estCardio,
                nb_series       : 1,
                series          : [detailSerie]
            });
        }
    });

    return blocs;
}

async function _sportDetecterRecords(moi, sessionId, logsSession) {
    const logsMusculationValides = logsSession.filter(l =>
        l.completed && l.weight_kg != null && l.distance_km == null && l.duration_seconds == null
    );
    if (!logsMusculationValides.length) return [];

    const exercicesTouches = [...new Set(logsMusculationValides.map(l => l.wger_exercise_id))];
    const records = [];

    for (const wgerExerciseId of exercicesTouches) {
        const { rows } = await pool.query(`
            SELECT MAX(l.weight_kg) AS record_precedent
            FROM sport_session_logs l
            JOIN sport_sessions s ON s.id = l.session_id
            WHERE s.user_id = \$1
                AND s.status = 'completed'
                AND s.id != \$2
                AND l.wger_exercise_id = \$3
                AND l.completed = TRUE
                AND l.weight_kg IS NOT NULL
        `, [moi, sessionId, wgerExerciseId]);

        const recordPrecedent = rows[0]?.record_precedent != null ? parseFloat(rows[0].record_precedent) : null;
        if (recordPrecedent == null) continue;

        const meilleurKgSession = Math.max(...logsMusculationValides
            .filter(l => l.wger_exercise_id === wgerExerciseId)
            .map(l => parseFloat(l.weight_kg)));

        if (meilleurKgSession > recordPrecedent) {
            const nomExercice = logsMusculationValides.find(l => l.wger_exercise_id === wgerExerciseId)?.exercise_name;
            records.push({ wger_exercise_id: wgerExerciseId, exercise_name: nomExercice, nouveau_poids: meilleurKgSession, ancien_record: recordPrecedent });
        }
    }

    return records;
}

router.get('/dashboard-stats', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows: profilRows } = await pool.query(`
            SELECT poids, taille, sexe, date_naissance FROM profiles WHERE user_id = \$1
        `, [moi]);
        const profil = profilRows[0] || {};

        const { rows: sessions } = await pool.query(`
            SELECT s.id, s.workout_id, s.date_start, s.date_end, w.name AS workout_name
            FROM sport_sessions s
            LEFT JOIN sport_workouts w ON w.id = s.workout_id
            WHERE s.user_id = \$1 AND s.status = 'completed'
            ORDER BY s.date_end DESC
            LIMIT 5
        `, [moi]);

        if (!sessions.length) {
            return res.json({ success: true, dernieres_seances: [], derniere_seance: null });
        }

        const sessionIds = sessions.map(s => s.id);
        const { rows: tousLogs } = await pool.query(`
            SELECT * FROM sport_session_logs WHERE session_id = ANY(\$1::int[]) ORDER BY id ASC
        `, [sessionIds]);

        const dernieresSeances = sessions.map(s => {
            const logsSession = tousLogs.filter(l => l.session_id === s.id);
            const stats = _sportCalculerStatsSession(s, logsSession, profil);
            const exercicesConsolides = _sportConsoliderExercicesSession(logsSession);
            return {
                id: s.id,
                workout_name: s.workout_name || 'Séance',
                date_start: s.date_start,
                date_end: s.date_end,
                ...stats,
                exercices: exercicesConsolides
            };
        });

        const derniereSessionBrute = sessions[0];
        const logsDerniereSeance   = tousLogs.filter(l => l.session_id === derniereSessionBrute.id);
        const records              = await _sportDetecterRecords(moi, derniereSessionBrute.id, logsDerniereSeance);

        res.json({
            success: true,
            dernieres_seances: dernieresSeances,
            derniere_seance: {
                ...dernieresSeances[0],
                records,
                nb_records: records.length,
                record_battu: records.length > 0
            }
        });
    } catch (err) {
        console.error('[SPORT] GET /dashboard-stats :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── LOGS DE SÉANCE : sport_session_logs ──

router.post('/sessions/:sessionId/logs', auth, async (req, res) => {
    const moi       = req.user.id;
    const sessionId = parseInt(req.params.sessionId, 10);
    const {
        wger_exercise_id, exercise_name, set_number,
        reps, weight_kg, completed,
        rest_seconds, distance_km, speed_kmh, incline_percent, duration_seconds
    } = req.body;

    if (!wger_exercise_id || !exercise_name?.trim() || !Number.isInteger(set_number)) {
        return res.status(400).json({ success: false, message: 'Données manquantes.' });
    }

    try {
        const { rows: owner } = await pool.query(`
            SELECT id FROM sport_sessions WHERE id = \$1 AND user_id = \$2
        `, [sessionId, moi]);
        if (!owner.length) return res.status(403).json({ success: false, message: 'Interdit.' });

        const { rows } = await pool.query(`
            INSERT INTO sport_session_logs
                (session_id, wger_exercise_id, exercise_name, set_number, reps, weight_kg,
                 completed, logged_at, rest_seconds, distance_km, speed_kmh, incline_percent, duration_seconds)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, NOW(), \$8, \$9, \$10, \$11, \$12)
            RETURNING *
        `, [
            sessionId, wger_exercise_id, exercise_name.trim(), set_number,
            Number.isInteger(reps) ? reps : null,
            weight_kg != null ? weight_kg : null,
            completed === true,
            Number.isInteger(rest_seconds) ? rest_seconds : null,
            distance_km != null ? distance_km : null,
            speed_kmh != null ? speed_kmh : null,
            incline_percent != null ? incline_percent : null,
            Number.isInteger(duration_seconds) ? duration_seconds : null
        ]);
        res.json({ success: true, log: rows[0] });
    } catch (err) {
        console.error('[SPORT] POST /sessions/:sessionId/logs :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/logs/:logId', auth, async (req, res) => {
    const moi   = req.user.id;
    const logId = parseInt(req.params.logId, 10);
    const {
        reps, weight_kg, completed,
        rest_seconds, distance_km, speed_kmh, incline_percent, duration_seconds
    } = req.body;

    try {
        const { rows } = await pool.query(`
            UPDATE sport_session_logs AS l
            SET reps             = COALESCE(\$1, l.reps),
                weight_kg        = COALESCE(\$2, l.weight_kg),
                completed        = COALESCE(\$3, l.completed),
                rest_seconds     = COALESCE(\$4, l.rest_seconds),
                distance_km      = COALESCE(\$5, l.distance_km),
                speed_kmh        = COALESCE(\$6, l.speed_kmh),
                incline_percent  = COALESCE(\$7, l.incline_percent),
                duration_seconds = COALESCE(\$8, l.duration_seconds)
            FROM sport_sessions s
            WHERE l.id = \$9
                AND l.session_id = s.id
                AND s.user_id = \$10
            RETURNING l.*
        `, [
            Number.isInteger(reps) ? reps : null,
            weight_kg != null ? weight_kg : null,
            typeof completed === 'boolean' ? completed : null,
            Number.isInteger(rest_seconds) ? rest_seconds : null,
            distance_km != null ? distance_km : null,
            speed_kmh != null ? speed_kmh : null,
            incline_percent != null ? incline_percent : null,
            Number.isInteger(duration_seconds) ? duration_seconds : null,
            logId, moi
        ]);
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        res.json({ success: true, log: rows[0] });
    } catch (err) {
        console.error('[SPORT] PUT /logs/:logId :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/logs/:logId', auth, async (req, res) => {
    const moi   = req.user.id;
    const logId = parseInt(req.params.logId, 10);
    try {
        const { rows } = await pool.query(`
            DELETE FROM sport_session_logs AS l
            USING sport_sessions AS s
            WHERE l.id = \$1
                AND l.session_id = s.id
                AND s.user_id = \$2
            RETURNING l.id
        `, [logId, moi]);
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        res.json({ success: true });
    } catch (err) {
        console.error('[SPORT] DELETE /logs/:logId :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/exercises/:wgerExerciseId/dernier-log', auth, async (req, res) => {
    const moi = req.user.id;
    const wgerExerciseId = parseInt(req.params.wgerExerciseId, 10);
    try {
        const { rows } = await pool.query(`
            SELECT l.*
            FROM sport_session_logs l
            JOIN sport_sessions s ON s.id = l.session_id
            WHERE s.user_id = \$1 AND l.wger_exercise_id = \$2 AND l.completed = TRUE
            ORDER BY l.logged_at DESC
            LIMIT 1
        `, [moi, wgerExerciseId]);
        res.json({ success: true, log: rows[0] || null });
    } catch (err) {
        console.error('[SPORT] GET /exercises/:wgerExerciseId/dernier-log :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── MENSURATIONS : sport_measurements ──

router.get('/measurements', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows } = await pool.query(`
            SELECT id, user_id, date_logged, weight_kg
            FROM sport_measurements
            WHERE user_id = \$1
            ORDER BY date_logged DESC
        `, [moi]);
        res.json({ success: true, measurements: rows });
    } catch (err) {
        console.error('[SPORT] GET /measurements :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/measurements', auth, async (req, res) => {
    const moi = req.user.id;
    const { date_logged, weight_kg } = req.body;
    if (!date_logged || weight_kg == null) {
        return res.status(400).json({ success: false, message: 'Données manquantes.' });
    }
    try {
        const { rows } = await pool.query(`
            INSERT INTO sport_measurements (user_id, date_logged, weight_kg)
            VALUES (\$1, \$2, \$3)
            RETURNING *
        `, [moi, date_logged, weight_kg]);
        res.json({ success: true, measurement: rows[0] });
    } catch (err) {
        console.error('[SPORT] POST /measurements :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/measurements/:id', auth, async (req, res) => {
    const moi = req.user.id;
    const id  = parseInt(req.params.id, 10);
    try {
        const { rows } = await pool.query(`
            DELETE FROM sport_measurements
            WHERE id = \$1 AND user_id = \$2
            RETURNING id
        `, [id, moi]);
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        res.json({ success: true });
    } catch (err) {
        console.error('[SPORT] DELETE /measurements/:id :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── CATALOGUE WGER (lecture seule) ──

const SPORT_WGER_CATEGORIES_FR = {
    'Abs'      : 'Abdominaux',
    'Arms'     : 'Bras',
    'Back'     : 'Dos',
    'Calves'   : 'Mollets',
    'Cardio'   : 'Cardio',
    'Chest'    : 'Poitrine',
    'Legs'     : 'Jambes',
    'Shoulders': 'Épaules'
};

const SPORT_WGER_EQUIPEMENT_FR = {
    'Barbell'                    : 'Barre olympique',
    'SZ-Bar'                     : 'Barre EZ',
    'Dumbbell'                   : 'Haltère',
    'Kettlebell'                 : 'Kettlebell',
    'Gym mat'                    : 'Tapis de sol',
    'Swiss Ball'                 : 'Ballon de gym',
    'Pull-up bar'                : 'Barre de traction',
    'Bench'                      : 'Banc',
    'none (bodyweight exercise)' : 'Aucun (poids du corps)'
};

function _traduireCategorie(nom) {
    return SPORT_WGER_CATEGORIES_FR[nom] || nom;
}

function _traduireEquipement(nom) {
    return SPORT_WGER_EQUIPEMENT_FR[nom] || nom;
}

function _construireNomBilingue(translations) {
    const en = translations.find(t => t.language === 2)?.name || null;
    const fr = translations.find(t => t.language === 5)?.name || null;
    if (en && fr) return `${en} (${fr})`;
    return en || fr || 'Exercice sans nom';
}

function _nettoyerNomBase(nom) {
    return nom.split('(')[0].trim();
}

function _nettoyerParenthesesNonLatines(nom) {
    return nom.replace(/\s*$([^()]*)$/g, (match, interieur) => {
        return /[a-zA-Z]/.test(interieur) ? match : '';
    }).trim();
}

function _sansAccents(txt) {
    return txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

router.get('/wger/categories', auth, async (req, res) => {
    try {
        const r = await fetch(`${WGER_BASE_URL}/exercisecategory/?limit=50&format=json`);
        if (!r.ok) throw new Error(`WGER a répondu avec le statut ${r.status}`);
        const data = await r.json();
        const categories = data.results.map(c => ({
            id  : c.id,
            name: _traduireCategorie(c.name)
        }));
        res.json({ success: true, categories });
    } catch (err) {
        console.error('[SPORT] GET /wger/categories :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/wger/equipment', auth, async (req, res) => {
    try {
        const r = await fetch(`${WGER_BASE_URL}/equipment/?limit=50&format=json`);
        if (!r.ok) throw new Error(`WGER a répondu avec le statut ${r.status}`);
        const data = await r.json();
        const equipment = data.results.map(e => ({
            id  : e.id,
            name: _traduireEquipement(e.name)
        }));
        res.json({ success: true, equipment });
    } catch (err) {
        console.error('[SPORT] GET /wger/equipment :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/wger/exercises', auth, async (req, res) => {
    const search    = _sansAccents((req.query.search || '').trim().toLowerCase());
    const category  = req.query.category   || '';
    const equipment = req.query.equipment  || '';
    const limit     = Math.min(parseInt(req.query.limit, 10)  || 20, 50);
    const offset    = parseInt(req.query.offset, 10) || 0;

    const LOT_INTERNE     = 50;
    const MAX_LOTS_SONDES = 40;

    try {
        let aIgnorer   = offset;
        let aCollecter = limit;
        const resultats = [];

        let lotOffsetWger = 0;
        let lotsSondes     = 0;
        let plusDeDonnees  = true;

        while (aCollecter > 0 && plusDeDonnees && lotsSondes < MAX_LOTS_SONDES) {
            const params = new URLSearchParams({
                limit : String(LOT_INTERNE),
                offset: String(lotOffsetWger),
                format: 'json'
            });
            if (category)  params.set('category',  category);
            if (equipment) params.set('equipment', equipment);

            const r = await fetch(`${WGER_BASE_URL}/exerciseinfo/?${params.toString()}`);
            if (!r.ok) throw new Error(`WGER a répondu avec le statut ${r.status}`);
            const data = await r.json();

            if (!data.results.length) {
                plusDeDonnees = false;
                break;
            }

            for (const ex of data.results) {
                const translations = ex.translations || [];
                const nomOriginal  = _nettoyerParenthesesNonLatines(_construireNomBilingue(translations));
                let nom            = nomOriginal;
                let typeSuivi      = null;

                const cle = _nettoyerNomBase(nomOriginal);
                if (Object.prototype.hasOwnProperty.call(SPORT_TRADUCTION_FR, cle)) {
                    const mapping = SPORT_TRADUCTION_FR[cle];
                    if (mapping === null) continue;
                    nom       = mapping.nom;
                    typeSuivi = mapping.type;
                }

                const image = ex.images?.[0]?.image || null;

                if (search) {
                    const texteRecherchable = _sansAccents(`${nom} ${nomOriginal}`.toLowerCase());
                    if (!texteRecherchable.includes(search)) continue;
                }

                if (aIgnorer > 0) {
                    aIgnorer--;
                    continue;
                }

                resultats.push({
                    wger_exercise_id: ex.id,
                    name            : nom,
                    category        : ex.category?.id ?? ex.category,
                    equipment       : ex.equipment,
                    muscles         : ex.muscles,
                    image,
                    type_suivi      : typeSuivi
                });
                aCollecter--;

                if (aCollecter === 0) break;
            }

            plusDeDonnees = Boolean(data.next);
            lotOffsetWger += LOT_INTERNE;
            lotsSondes++;
        }

        res.json({
            success  : true,
            has_more : aCollecter === 0 && plusDeDonnees,
            exercises: resultats
        });
    } catch (err) {
        console.error('[SPORT] GET /wger/exercises :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
