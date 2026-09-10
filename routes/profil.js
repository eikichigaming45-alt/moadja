// ============================================================
// routes/profil.js
// ============================================================

const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const path       = require('path');
const fs         = require('fs');
const multer     = require('multer');
const sharp      = require('sharp');
const { pool }   = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const { validerMotDePasse } = require('../utils/validations');

const uploadsAvatars = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
if (!fs.existsSync(uploadsAvatars)) fs.mkdirSync(uploadsAvatars, { recursive: true });

const storage = multer.memoryStorage();
const upload  = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Fichier non supporté.'));
        }
        cb(null, true);
    }
});

// ============================================================
// PROFIL PUBLIC — champs autorisés pour les toggles de visibilité
// ============================================================
const CHAMPS_PUBLICS_VALIDES = ['age', 'profession', 'site_web', 'signe_astro', 'note'];

// Table des bornes de signes astrologiques (calcul depuis date_naissance uniquement)
const SIGNES_ASTRO = [
    { cle: 'capricorne', label: 'Capricorne', emoji: '♑', mois: 1,  jour: 20 },
    { cle: 'verseau',    label: 'Verseau',    emoji: '♒', mois: 2,  jour: 19 },
    { cle: 'poissons',   label: 'Poissons',   emoji: '♓', mois: 3,  jour: 20 },
    { cle: 'belier',     label: 'Bélier',     emoji: '♈', mois: 4,  jour: 20 },
    { cle: 'taureau',    label: 'Taureau',    emoji: '♉', mois: 5,  jour: 21 },
    { cle: 'gemeaux',    label: 'Gémeaux',    emoji: '♊', mois: 6,  jour: 21 },
    { cle: 'cancer',     label: 'Cancer',     emoji: '♋', mois: 7,  jour: 23 },
    { cle: 'lion',       label: 'Lion',       emoji: '♌', mois: 8,  jour: 23 },
    { cle: 'vierge',     label: 'Vierge',     emoji: '♍', mois: 9,  jour: 23 },
    { cle: 'balance',    label: 'Balance',    emoji: '♎', mois: 10, jour: 23 },
    { cle: 'scorpion',   label: 'Scorpion',   emoji: '♏', mois: 11, jour: 22 },
    { cle: 'sagittaire', label: 'Sagittaire', emoji: '♐', mois: 12, jour: 22 },
    { cle: 'capricorne', label: 'Capricorne', emoji: '♑', mois: 12, jour: 31 },
];

function calculerAge(dateNaissance) {
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

function calculerSigneAstro(dateNaissance) {
    if (!dateNaissance) return null;
    const n = new Date(dateNaissance);
    if (isNaN(n.getTime())) return null;
    const mois = n.getMonth() + 1;
    const jour = n.getDate();
    const trouve = SIGNES_ASTRO.find(s => mois < s.mois || (mois === s.mois && jour <= s.jour));
    return trouve || null;
}

// GET /api/profil
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT prenom, nom, date_naissance, heure_naissance, lieu_naissance,
                    naissance_lat, naissance_lon,
                    email, telephone, profession, note, photo, widgets_visibles,
                    signe_zodiaque, sexe, taille, poids, groupe_sanguin,
                    niveau_activite, objectif_sante, allergies, aliments_exclus,
                    meteo_lat, meteo_lon, meteo_ville, site_web,
                    traitements_en_cours, diabete, cholesterol
             FROM profiles WHERE user_id = \$1`,
            [req.user.id]
        );
        if (result.rows.length === 0) return res.json({ success: true, profil: null });
        res.json({ success: true, profil: result.rows[0] });
    } catch (err) {
        console.error('[PROFIL] GET /', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// POST /api/profil
router.post('/', authenticateToken, async (req, res) => {
    const {
        prenom, nom, date_naissance, heure_naissance, lieu_naissance,
        naissance_lat, naissance_lon,
        email, telephone, profession, note,
        signe_zodiaque, sexe, taille, poids, groupe_sanguin,
        niveau_activite, objectif_sante,
        allergies, aliments_exclus,
        site_web,
        traitements_en_cours, diabete, cholesterol
    } = req.body;

    try {
        await pool.query(
            `INSERT INTO profiles (user_id, updated_at) VALUES (\$1, NOW()) ON CONFLICT (user_id) DO NOTHING`,
            [req.user.id]
        );

        await pool.query(`
            UPDATE profiles SET
                prenom          = CASE WHEN \$2::text  IS NOT NULL THEN \$2::text     ELSE prenom          END,
                nom             = CASE WHEN \$3::text  IS NOT NULL THEN \$3::text     ELSE nom             END,
                date_naissance  = CASE WHEN \$4::text  IS NOT NULL THEN \$4::date     ELSE date_naissance  END,
                heure_naissance = CASE WHEN \$5::text  IS NOT NULL THEN \$5::time     ELSE heure_naissance END,
                lieu_naissance  = CASE WHEN \$6::text  IS NOT NULL THEN \$6::text     ELSE lieu_naissance  END,
                naissance_lat   = CASE WHEN \$7::text  IS NOT NULL THEN \$7::numeric  ELSE naissance_lat   END,
                naissance_lon   = CASE WHEN \$8::text  IS NOT NULL THEN \$8::numeric  ELSE naissance_lon   END,
                email           = CASE WHEN \$9::text  IS NOT NULL THEN \$9::text     ELSE email           END,
                telephone       = CASE WHEN \$10::text IS NOT NULL THEN \$10::text    ELSE telephone       END,
                profession      = CASE WHEN \$11::text IS NOT NULL THEN \$11::text    ELSE profession      END,
                note            = CASE WHEN \$12::text IS NOT NULL THEN \$12::text    ELSE note            END,
                signe_zodiaque  = CASE WHEN \$13::text IS NOT NULL THEN \$13::text    ELSE signe_zodiaque  END,
                sexe            = CASE WHEN \$14::text IS NOT NULL THEN \$14::text    ELSE sexe            END,
                taille          = CASE WHEN \$15::text IS NOT NULL THEN \$15::integer ELSE taille          END,
                poids           = CASE WHEN \$16::text IS NOT NULL THEN \$16::numeric ELSE poids           END,
                groupe_sanguin  = CASE WHEN \$17::text IS NOT NULL THEN \$17::text    ELSE groupe_sanguin  END,
                niveau_activite = CASE WHEN \$18::text IS NOT NULL THEN \$18::text    ELSE niveau_activite END,
                objectif_sante  = CASE WHEN \$19::text IS NOT NULL THEN \$19::text    ELSE objectif_sante  END,
                allergies       = CASE WHEN \$20::text IS NOT NULL THEN \$20::text[]  ELSE allergies       END,
                aliments_exclus = CASE WHEN \$21::text IS NOT NULL THEN \$21::text[]  ELSE aliments_exclus END,
                site_web        = CASE WHEN \$22::text IS NOT NULL THEN \$22::text    ELSE site_web        END,
                traitements_en_cours = CASE WHEN \$23::text IS NOT NULL THEN \$23::text ELSE traitements_en_cours END,
                diabete         = CASE WHEN \$24::text IS NOT NULL THEN \$24::text    ELSE diabete         END,
                cholesterol     = CASE WHEN \$25::text IS NOT NULL THEN \$25::text    ELSE cholesterol     END,
                updated_at      = NOW()
            WHERE user_id = \$1
        `, [
            req.user.id,
            prenom          != null && prenom          !== '' ? prenom          : null,
            nom             != null && nom             !== '' ? nom             : null,
            date_naissance  != null && date_naissance  !== '' ? date_naissance  : null,
            heure_naissance != null && heure_naissance !== '' ? heure_naissance : null,
            lieu_naissance  != null && lieu_naissance  !== '' ? lieu_naissance  : null,
            naissance_lat   != null                           ? String(naissance_lat) : null,
            naissance_lon   != null                           ? String(naissance_lon) : null,
            email           != null && email           !== '' ? email           : null,
            telephone       != null && telephone       !== '' ? telephone       : null,
            profession      != null && profession      !== '' ? profession      : null,
            note            != null && note            !== '' ? note            : null,
            // FIX signe_zodiaque : distinguer "champ absent" (undefined -> ne pas toucher)
            // de "champ envoyé vide" ('' -> reset explicite vers calcul auto).
            signe_zodiaque  !== undefined ? signe_zodiaque : null,
            sexe            != null && sexe            !== '' ? sexe            : null,
            taille          != null                           ? String(taille)  : null,
            poids           != null                           ? String(poids)   : null,
            groupe_sanguin  != null && groupe_sanguin  !== '' ? groupe_sanguin  : null,
            niveau_activite != null && niveau_activite !== '' ? niveau_activite : null,
            objectif_sante  != null && objectif_sante  !== '' ? objectif_sante  : null,
            Array.isArray(allergies)       && allergies.length       ? allergies       : null,
            Array.isArray(aliments_exclus) && aliments_exclus.length ? aliments_exclus : null,
            site_web        != null && site_web        !== '' ? site_web        : null,
            traitements_en_cours != null && traitements_en_cours !== '' ? traitements_en_cours : null,
            diabete         != null && diabete         !== '' ? diabete         : null,
            cholesterol     != null && cholesterol     !== '' ? cholesterol     : null,
        ]);

        res.json({ success: true });
    } catch (err) {
        console.error('[PROFIL] POST /', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// POST /api/profil/photo
router.post('/photo', authenticateToken, upload.single('photo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier reçu.' });
    try {
        const ancienRes = await pool.query(
            'SELECT photo FROM profiles WHERE user_id = \$1',
            [req.user.id]
        );
        const anciennePhoto = ancienRes.rows[0]?.photo;

        const nomFichier = `avatar_${req.user.id}_${Date.now()}.webp`;
        const cheminDest = path.join(uploadsAvatars, nomFichier);

        await sharp(req.file.buffer)
            .resize(300, 300, { fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(cheminDest);

        const urlPhoto = `/uploads/avatars/${nomFichier}`;

        await pool.query(
            'UPDATE profiles SET photo = \$1, updated_at = NOW() WHERE user_id = \$2',
            [urlPhoto, req.user.id]
        );

        if (anciennePhoto && anciennePhoto.startsWith('/uploads/avatars/')) {
            const ancienChemin = path.join(__dirname, '..', 'public', anciennePhoto);
            fs.unlink(ancienChemin, () => {});
        }

        res.json({ success: true, url: urlPhoto });
    } catch (err) {
        console.error('[PROFIL] POST /photo :', err.message);
        res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde de la photo.' });
    }
});

// PATCH /api/profil/meteo-ville
router.patch('/meteo-ville', authenticateToken, async (req, res) => {
    const { lat, lon, ville } = req.body;
    if (!lat || !lon) return res.status(400).json({ success: false, message: 'Coordonnées manquantes.' });
    try {
        await pool.query(
            `UPDATE profiles SET meteo_lat = \$1, meteo_lon = \$2, meteo_ville = \$3, updated_at = NOW() WHERE user_id = \$4`,
            [lat, lon, ville || null, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PROFIL] PATCH /meteo-ville :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// DELETE /api/profil/photo
router.delete('/photo', authenticateToken, async (req, res) => {
    try {
        const ancienRes = await pool.query(
            'SELECT photo FROM profiles WHERE user_id = \$1',
            [req.user.id]
        );
        const anciennePhoto = ancienRes.rows[0]?.photo;

        await pool.query(
            'UPDATE profiles SET photo = NULL, updated_at = NOW() WHERE user_id = \$1',
            [req.user.id]
        );

        if (anciennePhoto && anciennePhoto.startsWith('/uploads/avatars/')) {
            const ancienChemin = path.join(__dirname, '..', 'public', anciennePhoto);
            fs.unlink(ancienChemin, () => {});
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[PROFIL] DELETE /photo :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// POST /api/profil/changer-mdp
router.post('/changer-mdp', authenticateToken, async (req, res) => {
    const { ancienMdp, nouveauMdp } = req.body;
    if (!ancienMdp || !nouveauMdp) return res.status(400).json({ success: false, message: 'Champs manquants.' });
    const erreur = validerMotDePasse(nouveauMdp);
    if (erreur) return res.status(400).json({ success: false, message: erreur });
    try {
        const result = await pool.query(
            'SELECT password FROM users WHERE id = \$1',
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        const match = await bcrypt.compare(ancienMdp, result.rows[0].password);
        if (!match) return res.status(401).json({ success: false, message: 'Ancien mot de passe incorrect.' });
        const hash = await bcrypt.hash(nouveauMdp, 10);
        await pool.query(
            'UPDATE users SET password = \$1, must_change_password = FALSE WHERE id = \$2',
            [hash, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PROFIL] POST /changer-mdp :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// GET /api/profil/widgets-visibles
router.get('/widgets-visibles', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT widgets_visibles FROM profiles WHERE user_id = \$1',
            [req.user.id]
        );
        const widgets_caches = result.rows[0]?.widgets_visibles || [];
        res.json({ success: true, widgets_caches });
    } catch (err) {
        console.error('[PROFIL] GET /widgets-visibles :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PATCH /api/profil/widgets-visibles
router.patch('/widgets-visibles', authenticateToken, async (req, res) => {
    const { widgets_caches } = req.body;
    if (!Array.isArray(widgets_caches)) return res.status(400).json({ success: false, message: 'Format invalide.' });
    try {
        await pool.query(
            'UPDATE profiles SET widgets_visibles = \$1, updated_at = NOW() WHERE user_id = \$2',
            [widgets_caches, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PROFIL] PATCH /widgets-visibles :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// GET /api/profil/abonnes/:userId
router.get('/abonnes/:userId', authenticateToken, async (req, res) => {
    const cibleId = parseInt(req.params.userId);
    if (isNaN(cibleId)) return res.status(400).json({ success: false, message: 'ID invalide.' });
    if (cibleId !== req.user.id) return res.status(403).json({ success: false, message: 'Accès refusé.' });
    try {
        const { rows } = await pool.query(`
            SELECT u.id, u.username, p.prenom, p.nom, p.photo
            FROM follows f
            JOIN users u ON u.id = f.follower_id
            LEFT JOIN profiles p ON p.user_id = f.follower_id
            WHERE f.following_id = \$1
            ORDER BY u.username ASC
        `, [cibleId]);
        res.json({ success: true, abonnes: rows });
    } catch (err) {
        console.error('[PROFIL] GET /abonnes/:userId :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ============================================================
// GET /api/profil/public-champs
// Renvoie les toggles de visibilité de l'utilisateur connecté
// ============================================================
router.get('/public-champs', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT profil_public_champs FROM profiles WHERE user_id = \$1',
            [req.user.id]
        );
        const champs = result.rows[0]?.profil_public_champs || [];
        res.json({ success: true, champs });
    } catch (err) {
        console.error('[PROFIL] GET /public-champs :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ============================================================
// PATCH /api/profil/public-champs
// Met à jour les toggles de visibilité du profil public.
// Body attendu : { champs: ['age', 'profession', ...] }
// Filtrage strict sur CHAMPS_PUBLICS_VALIDES pour éviter
// toute valeur arbitraire en base.
// ============================================================
router.patch('/public-champs', authenticateToken, async (req, res) => {
    const { champs } = req.body;
    if (!Array.isArray(champs)) {
        return res.status(400).json({ success: false, message: 'Format invalide.' });
    }
    const champsFiltres = champs.filter(c => CHAMPS_PUBLICS_VALIDES.includes(c));
    try {
        await pool.query(
            'UPDATE profiles SET profil_public_champs = \$1, updated_at = NOW() WHERE user_id = \$2',
            [champsFiltres, req.user.id]
        );
        res.json({ success: true, champs: champsFiltres });
    } catch (err) {
        console.error('[PROFIL] PATCH /public-champs :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ============================================================
// GET /api/profil/public/:userId
// Profil public enrichi : âge, profession, site web et signe
// astro affichés uniquement si le toggle correspondant est
// activé ET la donnée réellement renseignée en base.
// Note conservée en dernier (comportement existant, inchangé).
// ============================================================
router.get('/public/:userId', authenticateToken, async (req, res) => {
    const cibleId = parseInt(req.params.userId);
    const moi     = req.user.id;
    if (isNaN(cibleId)) return res.status(400).json({ success: false, message: 'ID invalide.' });
    try {
        const profilRes = await pool.query(
            `SELECT u.id, u.username, p.prenom, p.nom, p.photo,
                    p.note, p.date_naissance, p.profession, p.site_web,
                    p.profil_public_champs
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.id = \$1`,
            [cibleId]
        );
        if (profilRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        const profil = profilRes.rows[0];
        const champsAutorises = profil.profil_public_champs || [];

        const [[postsRes], [abonnesRes], [abonnementsRes], [suiviRes]] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM posts WHERE user_id = \$1',                              [cibleId]),
            pool.query('SELECT COUNT(*) FROM follows WHERE following_id = \$1',                       [cibleId]),
            pool.query('SELECT COUNT(*) FROM follows WHERE follower_id = \$1',                        [cibleId]),
            pool.query('SELECT 1 FROM follows WHERE follower_id = \$1 AND following_id = \$2', [moi, cibleId])
        ].map(p => p.then(r => [r])));

        // ── Âge (toggle + date_naissance renseignée) ──────────
        const age = (champsAutorises.includes('age') && profil.date_naissance)
            ? calculerAge(profil.date_naissance)
            : null;

        // ── Profession (toggle + donnée renseignée) ───────────
        const profession = (champsAutorises.includes('profession') && profil.profession)
            ? profil.profession
            : null;

        // ── Site internet (toggle + donnée renseignée) ────────
        const siteWeb = (champsAutorises.includes('site_web') && profil.site_web)
            ? profil.site_web
            : null;

        // ── Signe astro — calcul exclusif depuis date_naissance ─
        const signeCalcule = (champsAutorises.includes('signe_astro') && profil.date_naissance)
            ? calculerSigneAstro(profil.date_naissance)
            : null;

        // ── Note (toggle + donnée renseignée) — reste en dernier ─
        const note = (champsAutorises.includes('note') && profil.note)
            ? profil.note
            : null;

        res.json({
            success: true,
            profil: {
                id             : profil.id,
                username       : profil.username,
                prenom         : profil.prenom || '',
                nom            : profil.nom    || '',
                photo          : profil.photo  || null,
                age,
                profession,
                site_web       : siteWeb,
                signe_astro    : signeCalcule ? { label: signeCalcule.label, emoji: signeCalcule.emoji } : null,
                note,
                nb_posts       : parseInt(postsRes.rows[0].count),
                nb_abonnes     : parseInt(abonnesRes.rows[0].count),
                nb_abonnements : parseInt(abonnementsRes.rows[0].count),
                suivi          : suiviRes.rows.length > 0
            }
        });
    } catch (err) {
        console.error('[PROFIL] GET /public/:userId :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
