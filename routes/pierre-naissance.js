// ============================================================
// routes/pierre-naissance.js
// Widget Pierre de naissance — calcul déterministe depuis le
// mois de naissance (date_naissance en profil). Aucune API
// externe, aucun cache BDD nécessaire (calcul instantané).
// ============================================================
const express                = require('express');
const router                 = express.Router();
const { pool }                = require('../db/pool');
const { authenticateToken }   = require('../middleware/auth');

// ── Table des 12 pierres de naissance (mois 1 à 12) ──────────
// Sources croisées : mediamsuisse.ch, bajoia.com, cloralys-bijoux.fr
// Croyances symboliques traditionnelles — à visée inspirationnelle.
const PIERRES_PAR_MOIS = {
    1: {
        nom    : 'Grenat',
        statut : 'Pierre fine',
        chakra : 'Chakra racine',
        image  : '/images/pierres/grenat.jpg',
        credit : null,
        description: `Autrefois nommé escarboucle, la "petite braise", le grenat était emporté par les voyageurs comme talisman de retour et de protection. Relié au chakra racine, il ancre l'énergie vitale, renforce la sécurité intérieure et insuffle courage, régénération et détermination. Un allié de constance pour traverser le doute et avancer avec assurance.`
    },
    2: {
        nom    : 'Améthyste',
        statut : 'Pierre fine',
        chakra : 'Chakra couronne',
        image  : '/images/pierres/amethyste.jpg',
        credit : null,
        description: `Son nom grec signifiant "qui n'est pas ivre", elle était censée préserver des excès. Reliée au chakra couronne, elle favorise la méditation, calme le mental agité et réduit l'insomnie. Une pierre de sagesse et de clarté spirituelle durable.`
    },
    3: {
        nom    : 'Aigue-marine',
        statut : 'Pierre fine',
        chakra : 'Chakra gorge',
        image  : '/images/pierres/aigue-marine.jpg',
        credit : null,
        description: `Son nom latin, "eau de mer", en faisait le talisman des marins pour une navigation clémente. Reliée au chakra de la gorge, elle facilite une communication sincère et apaise le trop-plein émotionnel. Une pierre de clarté pour les périodes de transition.`
    },
    4: {
        nom    : 'Diamant',
        statut : 'Pierre précieuse',
        chakra : 'Chakra couronne',
        image  : '/images/pierres/diamant.jpg',
        credit : null,
        description: `Pierre la plus dure de la nature, née il y a plus d'un milliard d'années, symbole de pureté et de force inébranlable. Il amplifie l'énergie environnante et clarifie l'esprit comme un catalyseur. Symbole d'engagement et d'amour éternel.`
    },
    5: {
        nom    : 'Émeraude',
        statut : 'Pierre précieuse',
        chakra : 'Chakra cœur',
        image  : '/images/pierres/emeraude.jpg',
        credit : 'Photo : Didier Descouens (CC BY-SA 4.0) — Wikimedia Commons',
        description: `Pierre favorite de Cléopâtre, évoquant le renouveau perpétuel du printemps. Reliée au chakra du cœur, elle nourrit l'harmonie affective, la compassion et la fidélité. Une pierre de renaissance pour cultiver des liens sincères.`
    },
    6: {
        nom    : 'Pierre de lune',
        statut : 'Pierre fine',
        chakra : 'Chakra sacré',
        image  : '/images/pierres/pierre-de-lune.jpg',
        credit : 'Photo : Super DM (CC BY-SA 4.0) — Wikimedia Commons',
        description: `Reconnaissable à son voile lumineux, l'adularescence, elle évoque le mystère nocturne et la sensibilité. Liée au chakra sacré, elle apaise les émotions fluctuantes et éveille l'intuition. Une pierre douce pour les périodes de transformation intime.`
    },
    7: {
        nom    : 'Rubis',
        statut : 'Pierre précieuse',
        chakra : 'Chakra racine',
        image  : '/images/pierres/rubis.jpg',
        credit : null,
        description: `À la couleur flamboyante, un rubis d'exception peut rivaliser avec les plus grandes gemmes. Relié au chakra racine, il dissipe la colère et ravive la joie de vivre. Une pierre de feu pour retrouver vitalité et élan.`
    },
    8: {
        nom    : 'Péridot',
        statut : 'Pierre fine',
        chakra : 'Chakra cœur / plexus solaire',
        image  : '/images/pierres/peridot.jpg',
        credit : null,
        description: `Rareté minérale n'existant qu'en une seule teinte, surnommée par les Égyptiens "la gemme du soleil". Il agit comme un bouclier entre cœur et plexus solaire, dissolvant jalousie et tensions. Une pierre purificatrice pour renouer avec l'optimisme.`
    },
    9: {
        nom    : 'Saphir',
        statut : 'Pierre précieuse',
        chakra : 'Chakra gorge / 3ᵉ œil',
        image  : '/images/pierres/saphir.jpg',
        credit : null,
        description: `Existant dans toutes les teintes sauf le rouge, associé depuis l'Antiquité à la royauté et à la vérité. Il canalise les pensées éparpillées et renforce loyauté et discipline intérieure. Une pierre pour aligner ses actes avec ses convictions.`
    },
    10: {
        nom    : 'Tourmaline',
        statut : 'Pierre fine',
        chakra : 'Chakra cœur',
        image  : '/images/pierres/tourmaline.jpg',
        credit : 'Photo : Wikimedia Commons (licence à vérifier)',
        description: `Offrant la palette la plus étendue du règne minéral, certains cristaux réunissent rose et vert en un seul. Véritable pierre du cœur, elle favorise créativité, espoir et réconfort émotionnel. Une pierre d'inspiration pour l'équilibre affectif.`
    },
    11: {
        nom    : 'Citrine',
        statut : 'Pierre fine',
        chakra : 'Chakra plexus solaire',
        image  : '/images/pierres/citrine.jpg',
        credit : null,
        description: `Pierre du soleil, rarement authentique — souvent une améthyste chauffée. Réputée ne jamais se recharger négativement, elle diffuse une énergie constamment positive, motivation et confiance en soi. Une pierre lumineuse pour repousser la morosité.`
    },
    12: {
        nom    : 'Turquoise',
        statut : 'Pierre fine',
        chakra : 'Chakra gorge',
        image  : '/images/pierres/turquoise.jpg',
        credit : null,
        description: `Portée en bijoux depuis l'Antiquité, réputée créer un pont entre ciel et terre. Elle favorise une communication authentique, absorbe les énergies négatives et accompagne la transformation intérieure. Une pierre protectrice de chance et de sérénité.`
    }
};

// ── GET /api/pierre-naissance ─────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const { rows } = await pool.query(
            'SELECT date_naissance FROM profiles WHERE user_id = \$1',
            [userId]
        );
        if (!rows.length) {
            return res.json({ success: false, code: 'NO_PROFILE' });
        }
        const dateNaissance = rows[0].date_naissance;
        if (!dateNaissance) {
            return res.json({ success: false, code: 'NO_DATE' });
        }
        const mois  = new Date(dateNaissance).getUTCMonth() + 1;
        const pierre = PIERRES_PAR_MOIS[mois];
        if (!pierre) {
            return res.json({ success: false, code: 'ERREUR_CALCUL' });
        }
        res.json({ success: true, data: pierre });
    } catch (err) {
        console.error('[PIERRE-NAISSANCE] GET / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
