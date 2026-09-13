// ============================================================
// routes/sport.js
// Module Sport — CRUD sur 6 tables : sport_workouts,
// sport_workout_days, sport_day_exercises, sport_sessions,
// sport_session_logs, sport_measurements.
// Toutes les routes sont scopées par utilisateur.
//
// + Intégration WGER (lecture seule, catalogue d'exercices).
// Noms affichés "Anglais (Français)" si traduction dispo.
// Catégorie Cardio (id 15) : noms FR + type de suivi (durée ou
// séries×reps) via routes/sport-cardio-fr.js. Certains exercices
// masqués (doublons WGER désignant la même activité).
// ============================================================
const express = require('express');
const router  = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken: auth } = require('../middleware/auth');
const { SPORT_CARDIO_FR } = require('./sport-cardio-fr');

const WGER_BASE_URL = 'https://wger.de/api/v2';

// ────────────────────────────────────────────────────────────
// ROUTINES — sport_workouts
// ────────────────────────────────────────────────────────────

router.get('/workouts', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows } = await pool.query(`
            SELECT id, user_id, name, created_at
            FROM sport_workouts
            WHERE user_id = \$1
            ORDER BY created_at DESC
        `, [moi]);
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
        const { rows } = await pool.query(`
            INSERT INTO sport_workouts (user_id, name)
            VALUES (\$1, \$2)
            RETURNING *
        `, [moi, name]);
        res.json({ success: true, workout: rows[0] });
    } catch (err) {
        console.error('[SPORT] POST /workouts :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /workouts/:id — détail + jours + exercices
router.get('/workouts/:id', auth, async (req, res) => {
    const moi = req.user.id;
    const id  = parseInt(req.params.id, 10);
    try {
        const { rows: workoutRows } = await pool.query(`
            SELECT id, user_id, name, created_at
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
                       order_in_day, target_sets, target_reps, target_duration_seconds
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

// ────────────────────────────────────────────────────────────
// JOURS DE ROUTINE — sport_workout_days
// ────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────
// EXERCICES D'UN JOUR — sport_day_exercises
// ────────────────────────────────────────────────────────────

router.post('/days/:dayId/exercises', auth, async (req, res) => {
    const moi   = req.user.id;
    const dayId = parseInt(req.params.dayId, 10);
    const {
        wger_exercise_id, exercise_name,
        order_in_day, target_sets, target_reps, target_duration_seconds
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

        const { rows } = await pool.query(`
            INSERT INTO sport_day_exercises
                (day_id, wger_exercise_id, exercise_name, order_in_day, target_sets, target_reps, target_duration_seconds)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7)
            RETURNING *
        `, [
            dayId,
            wger_exercise_id,
            exercise_name.trim(),
            Number.isInteger(order_in_day) ? order_in_day : 0,
            Number.isInteger(target_sets)  ? target_sets  : 3,
            Number.isInteger(target_reps)  ? target_reps  : 10,
            Number.isInteger(target_duration_seconds) ? target_duration_seconds : null
        ]);
        res.json({ success: true, exercise: rows[0] });
    } catch (err) {
        console.error('[SPORT] POST /days/:dayId/exercises :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/exercises/:exerciseId', auth, async (req, res) => {
    const moi        = req.user.id;
    const exerciseId = parseInt(req.params.exerciseId, 10);
    const { exercise_name, order_in_day, target_sets, target_reps, target_duration_seconds } = req.body;

    try {
        const { rows } = await pool.query(`
            UPDATE sport_day_exercises AS e
            SET exercise_name = COALESCE(\$1, e.exercise_name),
                order_in_day  = COALESCE(\$2, e.order_in_day),
                target_sets   = COALESCE(\$3, e.target_sets),
                target_reps   = COALESCE(\$4, e.target_reps),
                target_duration_seconds = COALESCE(\$5, e.target_duration_seconds)
            FROM sport_workout_days d
            JOIN sport_workouts w ON w.id = d.workout_id
            WHERE e.id = \$6
                AND e.day_id = d.id
                AND w.user_id = \$7
            RETURNING e.*
        `, [
            exercise_name?.trim() || null,
            Number.isInteger(order_in_day) ? order_in_day : null,
            Number.isInteger(target_sets)  ? target_sets  : null,
            Number.isInteger(target_reps)  ? target_reps  : null,
            Number.isInteger(target_duration_seconds) ? target_duration_seconds : null,
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

// ────────────────────────────────────────────────────────────
// SÉANCES — sport_sessions
// ────────────────────────────────────────────────────────────

router.get('/sessions', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows } = await pool.query(`
            SELECT id, user_id, workout_id, date_start, date_end
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

router.post('/sessions', auth, async (req, res) => {
    const moi       = req.user.id;
    const workoutId = req.body.workout_id || null;
    try {
        if (workoutId) {
            const { rows: owner } = await pool.query(`
                SELECT id FROM sport_workouts WHERE id = \$1 AND user_id = \$2
            `, [workoutId, moi]);
            if (!owner.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        }
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
    const moi = req.user.id;
    const id  = parseInt(req.params.id, 10);
    try {
        const { rows } = await pool.query(`
            UPDATE sport_sessions
            SET date_end = NOW()
            WHERE id = \$1 AND user_id = \$2
            RETURNING *
        `, [id, moi]);
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
    try {
        const { rows } = await pool.query(`
            DELETE FROM sport_sessions
            WHERE id = \$1 AND user_id = \$2
            RETURNING id
        `, [id, moi]);
        if (!rows.length) return res.status(403).json({ success: false, message: 'Interdit.' });
        res.json({ success: true });
    } catch (err) {
        console.error('[SPORT] DELETE /sessions/:id :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ────────────────────────────────────────────────────────────
// LOGS DE SÉANCE — sport_session_logs
// ────────────────────────────────────────────────────────────

router.post('/sessions/:sessionId/logs', auth, async (req, res) => {
    const moi       = req.user.id;
    const sessionId = parseInt(req.params.sessionId, 10);
    const { wger_exercise_id, exercise_name, set_number, reps, weight_kg } = req.body;

    if (!wger_exercise_id || !exercise_name?.trim() ||
        !Number.isInteger(set_number) || !Number.isInteger(reps) || weight_kg == null) {
        return res.status(400).json({ success: false, message: 'Données manquantes.' });
    }

    try {
        const { rows: owner } = await pool.query(`
            SELECT id FROM sport_sessions WHERE id = \$1 AND user_id = \$2
        `, [sessionId, moi]);
        if (!owner.length) return res.status(403).json({ success: false, message: 'Interdit.' });

        const { rows } = await pool.query(`
            INSERT INTO sport_session_logs
                (session_id, wger_exercise_id, exercise_name, set_number, reps, weight_kg)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6)
            RETURNING *
        `, [sessionId, wger_exercise_id, exercise_name.trim(), set_number, reps, weight_kg]);
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

// ────────────────────────────────────────────────────────────
// MENSURATIONS — sport_measurements
// ────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────
// CATALOGUE WGER — lecture seule, aucune clé API requise.
// Noms "Anglais (Français)" si traduction dispo. Catégories et
// équipements traduits via tables statiques FR (repli anglais si
// terme absent). Recherche agrégée par lots de 50 (WGER ne filtre
// pas le texte libre côté serveur). Aucun filtre sur la présence
// d'image (certains appareils cardio n'en ont pas).
//
// Catégorie Cardio (id 15) : le nom construit passe dans
// SPORT_CARDIO_FR pour être remplacé par un nom FR + type_suivi
// ('duree' ou 'series'). Entrées mappées à null = exclues
// (doublons WGER). La recherche texte s'applique après, sur le
// nom final affiché.
// ────────────────────────────────────────────────────────────

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

// Repli automatique sur le nom anglais si non présent ici.
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

// Construit le nom bilingue "Anglais (Français)" à partir des
// traductions WGER (langue 2 = anglais, langue 5 = français).
function _construireNomBilingue(translations) {
    const en = translations.find(t => t.language === 2)?.name || null;
    const fr = translations.find(t => t.language === 5)?.name || null;
    if (en && fr) return `${en} (${fr})`;
    return en || fr || 'Exercice sans nom';
}

// Isole le nom de base avant la première parenthèse, pour matcher
// SPORT_CARDIO_FR indépendamment d'un texte russe ou d'une
// traduction déjà présente entre parenthèses.
function _nettoyerNomBase(nom) {
    return nom.split('(')[0].trim();
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

// GET /wger/exercises?search=squat&category=10&equipment=3&limit=20&offset=0
//
// Agrégation par lots de 50 (page interne WGER), filtrage local
// sur le texte de recherche, avance dans les lots suivants jusqu'à
// remplir la page demandée (limit) ou épuisement de la base.
router.get('/wger/exercises', auth, async (req, res) => {
    const search    = (req.query.search    || '').trim().toLowerCase();
    const category  = req.query.category   || '';
    const equipment = req.query.equipment  || '';
    const limit     = Math.min(parseInt(req.query.limit, 10)  || 20, 50);
    const offset    = parseInt(req.query.offset, 10) || 0;

    const LOT_INTERNE     = 50;
    const MAX_LOTS_SONDES = 40; // garde-fou : ~2000 exercices WGER max explorés

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
                let nom            = _construireNomBilingue(translations);
                let typeSuivi      = null;

                if (ex.category === 15) {
    const cle = _nettoyerNomBase(nom);
    if (Object.prototype.hasOwnProperty.call(SPORT_CARDIO_FR, cle)) {
        const mapping = SPORT_CARDIO_FR[cle];
        if (mapping === null) continue; // exercice masqué (doublon)
        nom       = mapping.nom;
        typeSuivi = mapping.type;
    }
}

                const image = ex.images?.[0]?.image || null;

                if (search && !nom.toLowerCase().includes(search)) continue;

                if (aIgnorer > 0) {
                    aIgnorer--;
                    continue;
                }

                resultats.push({
                    wger_exercise_id: ex.id,
                    name            : nom,
                    category        : ex.category,
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
