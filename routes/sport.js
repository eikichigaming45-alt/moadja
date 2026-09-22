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
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const WGER_BASE_URL = 'https://wger.de/api/v2';

const SPORT_TRADUCTION_FR = {
    'Bench press': { nom: 'Développé couché', type: 'musculation' },
    'Squat': { nom: 'Squat', type: 'musculation' },
    'Deadlift': { nom: 'Soulevé de terre', type: 'musculation' },
    'Pull-up': { nom: 'Tractions', type: 'musculation' },
    'Push-up': { nom: 'Pompes', type: 'musculation' },
    'Dumbbell Biceps Curl': { nom: 'Curl haltères', type: 'musculation' },
    'Triceps pushdown': { nom: 'Extensions triceps poulie', type: 'musculation' },
    'Shoulder press': { nom: 'Développé épaules', type: 'musculation' },
    'Plank': { nom: 'Gainage (Planche)', type: 'gainage' },
    'Crunch': { nom: 'Crunch abdominal', type: 'musculation' },
    'Running': { nom: 'Course à pied', type: 'cardio' },
    'Walking': { nom: 'Marche', type: 'cardio' },
    'Cycling': { nom: 'Vélo', type: 'cardio' },
    'Treadmill': { nom: 'Tapis de course', type: 'cardio' },
    'Elliptical trainer': { nom: 'Vélo elliptique', type: 'cardio' },
    'Rowing machine': { nom: 'Rameur', type: 'cardio' }
};

// ── GESTION DES ROUTINES (WORKOUTS) ──

router.get('/workouts', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows: workouts } = await pool.query(`
            SELECT id, name, description, color, created_at
            FROM sport_workouts
            WHERE user_id = \$1
            ORDER BY created_at DESC
        `, [moi]);

        if (!workouts.length) {
            return res.json({ success: true, workouts: [] });
        }

        const workoutIds = workouts.map(w => w.id);
        const { rows: days } = await pool.query(`
            SELECT d.id, d.workout_id, d.day_number, d.title
            FROM sport_workout_days d
            WHERE d.workout_id = ANY(\$1::int[])
            ORDER BY d.day_number ASC
        `, [workoutIds]);

        const dayIds = days.map(d => d.id);
        let exercises = [];
        if (dayIds.length > 0) {
            const { rows: exRows } = await pool.query(`
                SELECT e.id, e.workout_day_id, e.wger_exercise_id, e.exercise_name, e.sets_count, e.reps, e.weight_kg, e.order_index
                FROM sport_day_exercises e
                WHERE e.workout_day_id = ANY(\$1::int[])
                ORDER BY e.order_index ASC
            `, [dayIds]);
            exercises = exRows;
        }

        const workoutsComplets = workouts.map(w => {
            const daysForW = days.filter(d => d.workout_id === w.id).map(d => {
                const exForD = exercises.filter(e => e.workout_day_id === d.id);
                return { ...d, exercises: exForD };
            });
            return { ...w, days: daysForW };
        });

        res.json({ success: true, workouts: workoutsComplets });
    } catch (err) {
        console.error('[SPORT] GET /workouts :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/workouts', auth, async (req, res) => {
    const moi = req.user.id;
    const { name, description, color, days } = req.body;

    if (!name?.trim()) {
        return res.status(400).json({ success: false, message: 'Le nom de la routine est requis.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: wRows } = await client.query(`
            INSERT INTO sport_workouts (user_id, name, description, color, created_at)
            VALUES (\$1, \$2, \$3, \$4, NOW())
            RETURNING *
        `, [moi, name.trim(), description?.trim() || null, color || '#8b5cf6']);
        const workout = wRows[0];

        if (Array.isArray(days)) {
            for (const [index, day] of days.entries()) {
                const dayNumber = day.day_number || (index + 1);
                const title = day.title?.trim() || `Jour ${dayNumber}`;

                const { rows: dRows } = await client.query(`
                    INSERT INTO sport_workout_days (workout_id, day_number, title)
                    VALUES (\$1, \$2, \$3)
                    RETURNING id
                `, [workout.id, dayNumber, title]);
                const dayId = dRows[0].id;

                if (Array.isArray(day.exercises)) {
                    for (const [exIndex, ex] of day.exercises.entries()) {
                        await client.query(`
                            INSERT INTO sport_day_exercises
                                (workout_day_id, wger_exercise_id, exercise_name, sets_count, reps, weight_kg, order_index)
                            VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7)
                        `, [
                            dayId,
                            ex.wger_exercise_id,
                            ex.exercise_name?.trim() || 'Exercice',
                            ex.sets_count || 3,
                            ex.reps || 10,
                            ex.weight_kg != null ? ex.weight_kg : null,
                            ex.order_index != null ? ex.order_index : exIndex
                        ]);
                    }
                }
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, workout });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[SPORT] POST /workouts :', err.message);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

router.delete('/workouts/:id', auth, async (req, res) => {
    const moi = req.user.id;
    const workoutId = parseInt(req.params.id, 10);
    try {
        const { rows } = await pool.query(`
            DELETE FROM sport_workouts
            WHERE id = \$1 AND user_id = \$2
            RETURNING id
        `, [workoutId, moi]);

        if (!rows.length) {
            return res.status(403).json({ success: false, message: 'Routine introuvable ou interdite.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[SPORT] DELETE /workouts/:id :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GESTION DES SÉANCES : sport_sessions ──

router.get('/sessions/en-cours', auth, async (req, res) => {
    const moi = req.user.id;
    try {
        const { rows } = await pool.query(`
            SELECT s.*, w.name AS workout_name
            FROM sport_sessions s
            LEFT JOIN sport_workouts w ON w.id = s.workout_id
            WHERE s.user_id = \$1 AND s.status = 'in_progress'
            ORDER BY s.date_start DESC
            LIMIT 1
        `, [moi]);

        if (!rows.length) {
            return res.json({ success: true, session: null });
        }

        const session = rows[0];
        const { rows: logs } = await pool.query(`
            SELECT * FROM sport_session_logs WHERE session_id = \$1 ORDER BY id ASC
        `, [session.id]);

        let gpsPoints = [];
        const isGps = ['marche', 'course', 'vélo', 'velo'].includes(session.activity_type);
        if (isGps) {
            const { rows: pts } = await pool.query(`
                SELECT lat, lng, recorded_at FROM sport_gps_points WHERE session_id = \$1 ORDER BY recorded_at ASC
            `, [session.id]);
            gpsPoints = pts;
        }

        res.json({ success: true, session: { ...session, logs, gpsPoints } });
    } catch (err) {
        console.error('[SPORT] GET /sessions/en-cours :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/sessions', auth, async (req, res) => {
    const moi = req.user.id;
    const { workout_id, activity_type } = req.body;

    try {
        const { rows: active } = await pool.query(`
            SELECT id FROM sport_sessions WHERE user_id = \$1 AND status = 'in_progress'
        `, [moi]);

        if (active.length > 0) {
            return res.status(400).json({ success: false, message: 'Une séance est déjà en cours.' });
        }

        const typeFinal = activity_type || 'musculation';
        const { rows } = await pool.query(`
            INSERT INTO sport_sessions (user_id, workout_id, activity_type, status, date_start)
            VALUES (\$1, \$2, \$3, 'in_progress', NOW())
            RETURNING *
        `, [moi, workout_id || null, typeFinal]);

        res.json({ success: true, session: rows[0] });
    } catch (err) {
        console.error('[SPORT] POST /sessions :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/sessions/:id/terminer', auth, async (req, res) => {
    const moi = req.user.id;
    const sessionId = parseInt(req.params.id, 10);
    const { distance_km, vitesse_moyenne_kmh } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: sRows } = await client.query(`
            SELECT * FROM sport_sessions WHERE id = \$1 AND user_id = \$2
        `, [sessionId, moi]);

        if (!sRows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Séance introuvable.' });
        }
        const session = sRows[0];

        let distFinale = distance_km != null ? parseFloat(distance_km) : null;
        let vitFinale = vitesse_moyenne_kmh != null ? parseFloat(vitesse_moyenne_kmh) : null;

        const isGps = ['marche', 'course', 'vélo', 'velo'].includes(session.activity_type);
        if (isGps && distFinale == null) {
            const { rows: pts } = await client.query(`
                SELECT lat, lng FROM sport_gps_points WHERE session_id = \$1 ORDER BY recorded_at ASC
            `, [sessionId]);

            if (pts.length >= 2) {
                let distTotaleKm = 0;
                for (let i = 1; i < pts.length; i++) {
                    const p1 = pts[i - 1];
                    const p2 = pts[i];
                    distTotaleKm += _calculerDistanceHaversine(p1.lat, p1.lng, p2.lat, p2.lng);
                }
                distFinale = Math.round(distTotaleKm * 100) / 100;

                const debut = new Date(session.date_start);
                const fin = new Date();
                const heures = (fin - debut) / 3600000;
                if (heures > 0.001) {
                    vitFinale = Math.round((distFinale / heures) * 10) / 10;
                }
            }
        }

        const { rows: updated } = await client.query(`
            UPDATE sport_sessions
            SET status = 'completed',
                date_end = NOW(),
                distance_km = COALESCE(\$1, distance_km),
                vitesse_moyenne_kmh = COALESCE(\$2, vitesse_moyenne_kmh)
            WHERE id = \$3
            RETURNING *
        `, [distFinale, vitFinale, sessionId]);

        await client.query('COMMIT');
        res.json({ success: true, session: updated[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[SPORT] POST /sessions/:id/terminer :', err.message);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

router.delete('/sessions/:id', auth, async (req, res) => {
    const moi = req.user.id;
    const sessionId = parseInt(req.params.id, 10);
    try {
        const { rows } = await pool.query(`
            DELETE FROM sport_sessions
            WHERE id = \$1 AND user_id = \$2
            RETURNING id
        `, [sessionId, moi]);

        if (!rows.length) {
            return res.status(403).json({ success: false, message: 'Séance introuvable ou interdite.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[SPORT] DELETE /sessions/:id :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POINTS GPS ──

router.post('/sessions/:id/gps', auth, async (req, res) => {
    const moi = req.user.id;
    const sessionId = parseInt(req.params.id, 10);
    const { points } = req.body;

    if (!Array.isArray(points) || !points.length) {
        return res.status(400).json({ success: false, message: 'Aucun point GPS fourni.' });
    }

    try {
        const { rows: owner } = await pool.query(`
            SELECT id FROM sport_sessions WHERE id = \$1 AND user_id = \$2
        `, [sessionId, moi]);
        if (!owner.length) return res.status(403).json({ success: false, message: 'Interdit.' });

        for (const p of points) {
            if (p.lat != null && p.lng != null) {
                await pool.query(`
                    INSERT INTO sport_gps_points (session_id, lat, lng, recorded_at)
                    VALUES (\$1, \$2, \$3, COALESCE(\$4, NOW()))
                `, [sessionId, p.lat, p.lng, p.recorded_at || null]);
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[SPORT] POST /sessions/:id/gps :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

function _calculerDistanceHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ── CALCUL STATS & CALORIES ──

function _sportCalculerStatsSession(session, logs, profil) {
    const dateStart = session.date_start ? new Date(session.date_start) : null;
    const dateEnd = session.date_end ? new Date(session.date_end) : new Date();
    const dureeSecondes = dateStart ? Math.max(0, Math.floor((dateEnd - dateStart) / 1000)) : 0;

    const poidsUser = profil.poids ? parseFloat(profil.poids) : 70;
    const age = profil.date_naissance ? new Date().getFullYear() - new Date(profil.date_naissance).getFullYear() : 30;
    const sexe = profil.sexe === 'F' ? 'F' : 'M';
    const profil_incomplet = !profil.poids || !profil.taille || !profil.sexe || !profil.date_naissance;

    const isGps = ['marche', 'course', 'vélo', 'velo'].includes(session.activity_type);

    if (isGps) {
        let distanceKm = session.distance_km != null ? parseFloat(session.distance_km) : 0;
        let vitesseKmh = session.vitesse_moyenne_kmh != null ? parseFloat(session.vitesse_moyenne_kmh) : 0;

        if (distanceKm === 0 && dureeSecondes > 0 && vitesseKmh > 0) {
            distanceKm = (vitesseKmh * dureeSecondes) / 3600;
        } else if (vitesseKmh === 0 && dureeSecondes > 0 && distanceKm > 0) {
            vitesseKmh = (distanceKm / (dureeSecondes / 3600));
        }

        let met = 3.5;
        if (session.activity_type === 'course') met = 9.8;
        else if (session.activity_type === 'vélo' || session.activity_type === 'velo') met = 7.5;
        else if (session.activity_type === 'marche') met = 3.8;

        const dureeHeures = dureeSecondes / 3600;
        const calories = Math.round(met * poidsUser * dureeHeures);

        return {
            dureeSecondes,
            distanceKm: Math.round(distanceKm * 100) / 100,
            vitesseKmh: Math.round(vitesseKmh * 10) / 10,
            calories,
            profil_incomplet,
            isGps: true
        };
    } else {
        const logsValides = logs.filter(l => l.completed);
        let volumeKg = 0;
        logsValides.forEach(l => {
            if (l.weight_kg != null && l.reps != null) {
                volumeKg += parseFloat(l.weight_kg) * parseInt(l.reps, 10);
            }
        });

        const dureeMinutes = dureeSecondes / 60;
        let calories = 0;
        if (sexe === 'M') {
            calories = Math.round((0.2017 * age + 0.09036 * poidsUser + 0.6309 * 100 - 55.0969) * (dureeMinutes / 4.184));
        } else {
            calories = Math.round((0.074 * age + 0.05741 * poidsUser + 0.4472 * 100 - 20.4022) * (dureeMinutes / 4.184));
        }
        if (isNaN(calories) || calories < 0) calories = Math.round(dureeMinutes * 5);

        return {
            dureeSecondes,
            volumeKg: Math.round(volumeKg * 10) / 10,
            nbSeries: logsValides.length,
            calories,
            profil_incomplet,
            isGps: false
        };
    }
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
            SELECT s.id, s.workout_id, s.activity_type, s.distance_km, s.vitesse_moyenne_kmh, s.date_start, s.date_end, w.name AS workout_name
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
            
            let nomAffiche = s.workout_name;
            if (!nomAffiche) {
                if (s.activity_type === 'course') nomAffiche = 'Course à pied';
                else if (s.activity_type === 'marche') nomAffiche = 'Marche';
                else if (s.activity_type === 'vélo' || s.activity_type === 'velo') nomAffiche = 'Vélo';
                else nomAffiche = 'Séance';
            }

            return {
                id: s.id,
                activity_type: s.activity_type,
                workout_name: nomAffiche,
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
            SELECT l.weight_kg, l.reps, l.set_number
            FROM sport_session_logs l
            JOIN sport_sessions s ON s.id = l.session_id
            WHERE s.user_id = \$1
                AND s.status = 'completed'
                AND l.wger_exercise_id = \$2
                AND l.completed = TRUE
            ORDER BY s.date_end DESC, l.set_number ASC
            LIMIT 1
        `, [moi, wgerExerciseId]);

        if (!rows.length) {
            return res.json({ success: true, dernier_log: null });
        }
        res.json({ success: true, dernier_log: rows[0] });
    } catch (err) {
        console.error('[SPORT] GET /exercises/:wgerExerciseId/dernier-log :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── ROUTE DE GÉNÉRATION D'IMAGE DE PARTAGE (JPEG) ──

router.post('/sessions/:id/generate-share', auth, async (req, res) => {
    const moi = req.user.id;
    const id = parseInt(req.params.id, 10);

    try {
        const { rows: sessions } = await pool.query(`
            SELECT s.*, w.name AS workout_name
            FROM sport_sessions s
            LEFT JOIN sport_workouts w ON w.id = s.workout_id
            WHERE s.id = \$1 AND s.user_id = \$2
        `, [id, moi]);

        if (!sessions.length) {
            return res.status(404).json({ success: false, message: 'Séance introuvable.' });
        }
        const session = sessions[0];

        const { rows: profilRows } = await pool.query(`
            SELECT poids, taille, sexe, date_naissance FROM profiles WHERE user_id = \$1
        `, [moi]);
        const profil = profilRows[0] || {};

        const { rows: logs } = await pool.query(`
            SELECT * FROM sport_session_logs WHERE session_id = \$1 ORDER BY id ASC
        `, [id]);

        const stats = _sportCalculerStatsSession(session, logs, profil);
        const exercicesConsolides = _sportConsoliderExercicesSession(logs);

        let titreRoutine = session.workout_name;
        if (!titreRoutine) {
            if (session.activity_type === 'course') titreRoutine = 'Course à pied';
            else if (session.activity_type === 'marche') titreRoutine = 'Marche';
            else if (session.activity_type === 'vélo' || session.activity_type === 'velo') titreRoutine = 'Vélo';
            else titreRoutine = 'Séance MoaDja';
        }

        const isGps = stats.isGps;

        // Formats texte
        const heures = Math.floor(stats.dureeSecondes / 3600);
        const minutes = Math.floor((stats.dureeSecondes % 3600) / 60);
        const secondes = stats.dureeSecondes % 60;
        let dureeStr = '';
        if (heures > 0) dureeStr += `${heures}h`;
        if (minutes > 0 || heures > 0) dureeStr += `${minutes}min`;
        dureeStr += `${secondes}`;

        const caloriesStr = `${stats.calories} kcal`;

        let bloc2Label = 'VOLUME';
        let bloc2Value = `${stats.volumeKg || 0} kg`;

        if (isGps) {
            bloc2Label = 'DISTANCE';
            bloc2Value = `${stats.distanceKm} km`;
        }

        function _echapperXML(str) {
            if (!str) return '';
            return str.replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/"/g, '&quot;')
                      .replace(/'/g, '&apos;');
        }

        const titreEchappe = _echapperXML(titreRoutine);

        // Construction du SVG en 1200x630 (OpenGraph standard)
        let svg = `
        <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#fff0e6" />
                    <stop offset="50%" stop-color="#fdfbfb" />
                    <stop offset="100%" stop-color="#f3e8ff" />
                </linearGradient>
                <filter id="shadowCard" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="10" stdDeviation="20" flood-color="#7c3aed" flood-opacity="0.08" />
                </filter>
                <filter id="shadowStat" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.04" />
                </filter>
            </defs>

            <!-- Fond global -->
            <rect width="1200" height="630" fill="url(#bgGrad)" />

            <!-- Carte centrale blanche -->
            <rect x="80" y="60" width="1040" height="510" rx="32" fill="#ffffff" filter="url(#shadowCard)" stroke="rgba(255,255,255,0.8)" stroke-width="2" />

            <!-- En-tête de la carte -->
            <text x="120" y="125" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="900" fill="#111827">${titreEchappe}</text>
            <text x="1080" y="125" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="#9ca3af" text-anchor="end">${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }</text>

            <!-- 3 Blocs de statistiques -->
            <rect x="120" y="165" width="280" height="90" rx="16" fill="#ffffff" filter="url(#shadowStat)" stroke="#f3f4f6" stroke-width="1" />
            <text x="260" y="193" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#9ca3af" letter-spacing="1" text-anchor="middle">DURÉE</text>
            <text x="260" y="232" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="900" fill="#1f2937" text-anchor="middle">${dureeStr}</text>

            <rect x="460" y="165" width="280" height="90" rx="16" fill="#ffffff" filter="url(#shadowStat)" stroke="#f3f4f6" stroke-width="1" />
            <text x="600" y="193" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#9ca3af" letter-spacing="1" text-anchor="middle">${bloc2Label}</text>
            <text x="600" y="232" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="900" fill="#1f2937" text-anchor="middle">${bloc2Value}</text>

            <rect x="800" y="165" width="280" height="90" rx="16" fill="#ffffff" filter="url(#shadowStat)" stroke="#f3f4f6" stroke-width="1" />
            <text x="940" y="193" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#9ca3af" letter-spacing="1" text-anchor="middle">CALORIES</text>
            <text x="940" y="232" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="900" fill="#ef4444" text-anchor="middle">${caloriesStr}</text>
        `;

        let yEx = 310;
        
        if (isGps) {
            // Affichage spécifique GPS parfaitement centré
            svg += `
            <text x="600" y="${yEx + 30}" font-family="system-ui, -apple-system, sans-serif" font-size="24" text-anchor="middle">
                <tspan font-weight="800" fill="#8b5cf6">📍 Vitesse moyenne :</tspan>
                <tspan font-weight="700" fill="#374151" dx="15">${stats.vitesseKmh.toFixed(1)} km/h</tspan>
            </text>
            `;
        } else {
            // Affichage musculation standard
            const maxEx = 5;
            const nbAffiches = Math.min(exercicesConsolides.length, maxEx);

            for (let i = 0; i < nbAffiches; i++) {
                const ex = exercicesConsolides[i];
                const nom = _echapperXML(ex.exercise_name);
                
                let detail = '';
                if (ex.series && ex.series.length > 0) {
                    detail = _formatDetailSerieSVG(ex.series[0], ex.est_cardio);
                }
                detail = _echapperXML(detail);

                svg += `
                <text x="120" y="${yEx}" font-family="system-ui, -apple-system, sans-serif" font-size="22">
                    <tspan font-weight="800" fill="#8b5cf6">${ex.nb_series}x</tspan>
                    <tspan font-weight="600" fill="#374151" dx="15">${nom}</tspan>
                    ${detail ? `
                    <tspan fill="#9ca3af" dx="15">·</tspan>
                    <tspan font-weight="600" fill="#a78bfa" dx="15">${detail}</tspan>
                    ` : ''}
                </text>
                `;
                yEx += 42;
            }

            if (exercicesConsolides.length > maxEx) {
                const restants = exercicesConsolides.length - maxEx;
                svg += `<text x="120" y="${yEx}" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-style="italic" fill="#9ca3af">...et ${restants} autre${restants > 1 ? 's' : ''}</text>`;
            }
        }

        // Logo MoaDja aligné en bas à droite (avec haltère parfaitement centré)
        svg += `
            <g transform="translate(980, 505)">
                <path d="M-15,-6 L-15,6 M-9,-2 L-9,2 M9,-2 L9,2 M15,-6 L15,6 M-9,0 L9,0" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                <text x="25" y="6" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="900" fill="#8b5cf6" text-anchor="start">MoaDja</text>
            </g>
        </svg>
        `;

        const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'sport_shares');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const fileName = `share_seance_${id}.jpg`;
        const filePath = path.join(uploadsDir, fileName);

        await sharp(Buffer.from(svg))
            .jpeg({ quality: 95 })
            .toFile(filePath);

        res.json({ 
            success: true, 
            imageUrl: `/uploads/sport_shares/${fileName}` 
        });

    } catch (err) {
        console.error('[SPORT] POST /sessions/:id/generate-share :', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

function _formatDetailSerieSVG(serie, estCardio) {
    if (estCardio) {
        let parts = [];
        if (serie.distance_km) parts.push(`${serie.distance_km} km`);
        if (serie.duration_seconds) {
            const m = Math.floor(serie.duration_seconds / 60);
            const s = serie.duration_seconds % 60;
            parts.push(m > 0 ? `${m}min${s > 0 ? s : ''}` : `${s}s`);
        }
        return parts.join(' · ');
    } else {
        let parts = [];
        if (serie.weight_kg) parts.push(`${serie.weight_kg} kg`);
        if (serie.reps) parts.push(`${serie.reps} reps`);
        return parts.join(' · ');
    }
}

module.exports = router;
