// ============================================================
// routes/animal-totem.js
// Widget Animal Totem — calcul déterministe depuis le mois/jour
// de naissance (date_naissance en profil), zodiaque amérindien.
// Aucune API externe, aucun cache BDD nécessaire (calcul instantané).
// ============================================================
const express                = require('express');
const router                 = express.Router();
const { pool }                = require('../db/pool');
const { authenticateToken }   = require('../middleware/auth');

// ── Table des 12 animaux totems (zodiaque amérindien) ────────
// Sources croisées : traditions amérindiennes du zodiaque solaire (12 animaux).
// Croyances symboliques traditionnelles — à visée inspirationnelle.
const ANIMAUX_TOTEM = [
    {
        debut: { mois: 12, jour: 22 }, fin: { mois: 1, jour: 19 },
        nom: 'Oie des Neiges',
        element: 'Terre',
        trait: 'Détermination tranquille',
        image: '/images/animaux-totem/oie-neiges.jpg',
        credit: null,
        description: `Messagère des grands froids, l'Oie des Neiges guide son clan sur de longues distances sans jamais perdre le cap. Elle incarne la persévérance calme et le sens du devoir envers les siens. Un totem de constance pour avancer pas à pas vers ses objectifs.`
    },
    {
        debut: { mois: 1, jour: 20 }, fin: { mois: 2, jour: 18 },
        nom: 'Loutre',
        element: 'Air',
        trait: 'Curiosité et sociabilité',
        image: '/images/animaux-totem/loutre.jpg',
        credit: null,
        description: `Joueuse et vive, la Loutre explore son environnement avec un enthousiasme communicatif. Elle rappelle l'importance de la légèreté et du lien social pour traverser les difficultés. Un totem d'ingéniosité pour cultiver la joie au quotidien.`
    },
    {
        debut: { mois: 2, jour: 19 }, fin: { mois: 3, jour: 20 },
        nom: 'Loup',
        element: 'Eau',
        trait: 'Intuition et fidélité',
        image: '/images/animaux-totem/loup.jpg',
        credit: null,
        description: `Gardien de la meute, le Loup navigue entre instinct profond et loyauté indéfectible envers son clan. Il éveille une sensibilité aiguë aux non-dits et aux émotions d'autrui. Un totem de fidélité pour renforcer les liens qui comptent.`
    },
    {
        debut: { mois: 3, jour: 21 }, fin: { mois: 4, jour: 19 },
        nom: 'Faucon',
        element: 'Feu',
        trait: 'Vision et audace',
        image: '/images/animaux-totem/faucon.jpg',
        credit: null,
        description: `Observateur perché au sommet, le Faucon repère l'opportunité avant tous les autres et fond sur elle sans hésiter. Il symbolise la clarté d'esprit et le courage d'agir au bon moment. Un totem d'initiative pour ceux qui visent loin.`
    },
    {
        debut: { mois: 4, jour: 20 }, fin: { mois: 5, jour: 20 },
        nom: 'Castor',
        element: 'Terre',
        trait: 'Constance et sens pratique',
        image: '/images/animaux-totem/castor.jpg',
        credit: null,
        description: `Bâtisseur infatigable, le Castor transforme patiemment son environnement pour assurer la sécurité des siens. Il incarne le travail méthodique et la solidité des fondations bien posées. Un totem de persévérance pour concrétiser ses projets.`
    },
    {
        debut: { mois: 5, jour: 21 }, fin: { mois: 6, jour: 20 },
        nom: 'Cerf',
        element: 'Air',
        trait: 'Douceur et adaptabilité',
        image: '/images/animaux-totem/cerf.jpg',
        credit: 'Photo : Mehmet Karatay (CC BY-SA 3.0) — Wikimedia Commons',
        description: `Gracieux et attentif, le Cerf se déplace avec une élégance qui désamorce les tensions autour de lui. Il symbolise la douceur comme force et la capacité à s'adapter sans perdre son essence. Un totem de diplomatie pour apaiser les échanges.`
    },
    {
        debut: { mois: 6, jour: 21 }, fin: { mois: 7, jour: 22 },
        nom: 'Pic Vert',
        element: 'Eau',
        trait: 'Sensibilité et protection',
        image: '/images/animaux-totem/pic-vert.jpg',
        credit: null,
        description: `Fidèle gardien de son territoire, le Pic Vert veille sur son foyer avec une attention constante et rythmée. Il évoque la protection des proches et une sensibilité tournée vers le soin. Un totem de vigilance pour préserver ce qui est précieux.`
    },
    {
        debut: { mois: 7, jour: 23 }, fin: { mois: 8, jour: 21 },
        nom: 'Saumon',
        element: 'Feu',
        trait: 'Persévérance et instinct',
        image: '/images/animaux-totem/saumon.jpg',
        credit: null,
        description: `Remontant le courant sans jamais dévier de sa route, le Saumon incarne la détermination face à l'adversité. Il rappelle que l'instinct profond guide souvent mieux que la raison seule. Un totem de ténacité pour ne jamais renoncer à son but.`
    },
    {
        debut: { mois: 8, jour: 22 }, fin: { mois: 9, jour: 21 },
        nom: 'Ours Brun',
        element: 'Terre',
        trait: 'Force tranquille',
        image: '/images/animaux-totem/ours-brun.jpg',
        credit: 'Photo : Charles J. Sharp (CC BY-SA 4.0) — Wikimedia Commons',
        description: `Puissant mais posé, l'Ours Brun sait quand agir et quand se retirer pour observer. Il symbolise une force intérieure qui n'a pas besoin de se démontrer bruyamment. Un totem d'ancrage pour affronter les épreuves avec assurance.`
    },
    {
        debut: { mois: 9, jour: 22 }, fin: { mois: 10, jour: 22 },
        nom: 'Corbeau',
        element: 'Air',
        trait: 'Sagesse et diplomatie',
        image: '/images/animaux-totem/corbeau.jpg',
        credit: 'Photo : Diliff (CC BY-SA) — Wikimedia Commons',
        description: `Intelligent et observateur, le Corbeau perçoit les subtilités que d'autres ignorent et sait tisser des liens équilibrés. Il incarne la sagesse acquise par l'expérience et le sens de la justice. Un totem de clairvoyance pour désamorcer les conflits.`
    },
    {
        debut: { mois: 10, jour: 23 }, fin: { mois: 11, jour: 22 },
        nom: 'Serpent',
        element: 'Eau',
        trait: 'Transformation et mystère',
        image: '/images/animaux-totem/serpent.jpg',
        credit: null,
        description: `Muant sa peau pour renaître, le Serpent est le symbole ancestral de la transformation profonde. Il invite à se défaire de ce qui est révolu pour évoluer en conscience. Un totem de renouveau pour ceux qui traversent un cap important.`
    },
    {
        debut: { mois: 11, jour: 23 }, fin: { mois: 12, jour: 21 },
        nom: 'Hibou',
        element: 'Feu',
        trait: 'Clairvoyance et liberté',
        image: '/images/animaux-totem/hibou.jpg',
        credit: null,
        description: `Voyant dans l'obscurité là où d'autres sont aveugles, le Hibou incarne la lucidité et l'indépendance d'esprit. Il rappelle la valeur du recul et de l'intuition silencieuse. Un totem de liberté pour suivre sa propre voie.`
    }
];

// ── Résolution animal depuis mois/jour ────────────────────────
function trouverAnimalTotem(mois, jour) {
    return ANIMAUX_TOTEM.find(a => {
        const { debut, fin } = a;
        if (debut.mois === fin.mois) {
            return mois === debut.mois && jour >= debut.jour && jour <= fin.jour;
        }
        // Période à cheval sur deux mois (ex: 22 déc → 19 jan)
        if (mois === debut.mois) return jour >= debut.jour;
        if (mois === fin.mois)   return jour <= fin.jour;
        return false;
    }) || null;
}

// ── GET /api/animal-totem ──────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const { rows } = await pool.query(
            'SELECT date_naissance FROM profiles WHERE user_id = \\$1',
            [userId]
        );
        if (!rows.length) {
            return res.json({ success: false, code: 'NO_PROFILE' });
        }
        const dateNaissance = rows[0].date_naissance;
        if (!dateNaissance) {
            return res.json({ success: false, code: 'NO_DATE' });
        }
        const d    = new Date(dateNaissance);
        const mois = d.getUTCMonth() + 1;
        const jour = d.getUTCDate();
        const animal = trouverAnimalTotem(mois, jour);
        if (!animal) {
            return res.json({ success: false, code: 'ERREUR_CALCUL' });
        }
        res.json({ success: true, data: animal });
    } catch (err) {
        console.error('[ANIMAL-TOTEM] GET / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
