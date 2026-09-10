// routes/sante.js
// Module Santé — Plan hebdomadaire (7 jours) + liste de courses + conseil du jour via Groq
// Endpoint : POST /api/sante/plan
// Cache serveur : sante_plan_cache (jsonb) + sante_plan_date (date = lundi de la semaine) dans profiles
// 1 seul appel Groq/semaine — partagé tous appareils
// max_tokens relevé pour laisser de la place au raisonnement interne du modèle + la sortie JSON complète

const express               = require('express');
const router                = express.Router();
const { pool }              = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const Groq                  = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

// Retourne la date (YYYY-MM-DD) du lundi de la semaine contenant la date fournie
function lundiSemaine(date) {
  const d = new Date(date);
  const jour = d.getDay(); // 0 = dimanche, 1 = lundi, ...
  const diff = (jour === 0 ? -6 : 1 - jour);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// POST /api/sante/plan
// Si un plan existe en base pour la semaine en cours, le retourne directement.
// Sinon, appelle Groq, sauvegarde en base, retourne le plan.
router.post('/plan', authenticateToken, async (req, res) => {
  try {
    const userId      = req.user.id;
    const today        = new Date();
    const lundiActuel  = lundiSemaine(today);

    // Récupération du profil + cache éventuel
    const result = await pool.query(
      `SELECT sexe, date_naissance, taille, poids, niveau_activite, objectif_sante,
              allergies, aliments_exclus, traitements_en_cours, diabete, cholesterol,
              sante_plan_cache, sante_plan_date
       FROM profiles WHERE user_id = \$1`,
      [userId]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Profil introuvable' });

    const p = result.rows[0];

    // Retour du cache si le plan de la semaine existe déjà en base
    if (p.sante_plan_cache && p.sante_plan_date) {
      const dateCache = new Date(p.sante_plan_date).toISOString().split('T')[0];
      if (dateCache === lundiActuel) {
        return res.json({ plan: p.sante_plan_cache, calories_cibles: p.sante_plan_cache.calories_cibles || null, cached: true });
      }
    }

    // Vérification des champs obligatoires pour les calculs
    if (!p.taille || !p.poids || !p.sexe || !p.date_naissance || !p.niveau_activite || !p.objectif_sante) {
      return res.status(400).json({ error: 'Profil incomplet — taille, poids, sexe, date de naissance, niveau d\'activité et objectif requis' });
    }

    // Calcul de l'âge
    const age    = Math.floor((new Date() - new Date(p.date_naissance)) / (365.25 * 24 * 3600 * 1000));
    const taille = parseFloat(p.taille);
    const poids  = parseFloat(p.poids);

    // BMR — formule Mifflin-St Jeor
    const bmr = p.sexe === 'homme'
      ? 10 * poids + 6.25 * taille - 5 * age + 5
      : 10 * poids + 6.25 * taille - 5 * age - 161;

    // Coefficients TDEE selon niveau_activite
    const coeffs = {
      sedentaire : 1.2,
      leger      : 1.375,
      modere     : 1.55,
      actif      : 1.725,
      tres_actif : 1.9
    };

    // Delta calorique selon objectif_sante
    const deltas = {
      perte_moderee     : -300,
      perte_rapide      : -500,
      maintien          :    0,
      prise_masse       :  300,
      prise_masse_rapide:  500
    };

    const tdee   = bmr * (coeffs[p.niveau_activite] || 1.2);
    const cibles = Math.round(tdee + (deltas[p.objectif_sante] || 0));

    // Formatage des champs libres pour le prompt
    const allergies   = (p.allergies || []).join(', ') || 'aucune';
    const exclus      = (p.aliments_exclus || []).join(', ') || 'aucun';
    const traitements = p.traitements_en_cours || 'aucun';
    const diabete     = p.diabete || 'non renseigné';
    const cholesterol = p.cholesterol || 'non renseigné';
    const moisActuel  = MOIS_FR[today.getMonth()];

    // Liste des 7 jours de la semaine (lundi -> dimanche) avec leurs dates
    const labelsJours = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
    const joursSemaine = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(lundiActuel);
      d.setDate(d.getDate() + i);
      joursSemaine.push({ date: d.toISOString().split('T')[0], label: labelsJours[i] });
    }

    // Construction du prompt Groq — compressé pour rester léger
    const prompt = `Nutritionniste expert. Génère un plan alimentaire de 7 jours en JSON strict, ULTRA CONCIS (chaque repas en une courte formule de 6 à 10 mots maximum, pas de phrases longues).

Profil : ${p.sexe}, ${age} ans, ${taille} cm, ${poids} kg, activité ${p.niveau_activite}, objectif ${p.objectif_sante}, ${cibles} kcal/j en moyenne.
Allergies (interdit) : ${allergies}
Aliments exclus (interdit) : ${exclus}
Traitements en cours : ${traitements}
Diabète : ${diabete}
Cholestérol : ${cholesterol}
Mois : ${moisActuel}

Règles strictes :
1. Jamais d'allergène ni d'aliment exclu.
2. Adapte au diabète/cholestérol si renseignés (peu de sucre rapide si diabète, peu de graisses saturées si cholestérol élevé).
3. Tiens compte des traitements sur l'appétit/métabolisme sans avis médical.
4. 7 repas différents, pas de répétition, moyenne équilibrée sans jour trop restrictif.
5. Fruits/légumes de saison (${moisActuel}, France).
6. Économique, ingrédients courants.
7. Liste de courses consolidée par catégorie, quantités totales, SANS doublons.
8. Reste très bref partout (activités : 1 seule ligne courte, conseil : 1 phrase courte).

JSON attendu (rien d'autre, pas de markdown) :
{"jours":[{"date":"${joursSemaine[0].date}","jour_label":"${joursSemaine[0].label}","repas":{"petit_dejeuner":"...","collation_matin":"...","dejeuner":"...","collation_soir":"...","diner":"..."},"activites":["..."],"conseil_du_jour":"..."}],"liste_courses":[{"categorie":"Fruits & légumes","items":["..."]},{"categorie":"Protéines","items":["..."]},{"categorie":"Féculents","items":["..."]},{"categorie":"Produits laitiers","items":["..."]},{"categorie":"Épicerie","items":["..."]}]}

Génère bien les 7 jours dans l'ordre et dates : ${joursSemaine.map(j => j.label + ' ' + j.date).join(', ')}.`;

    // Appel Groq — max_tokens relevé pour absorber le raisonnement interne du modèle + la sortie JSON complète
    const completion = await groq.chat.completions.create({
      model      : 'openai/gpt-oss-20b',
      messages   : [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens : 7500
    });

    // Nettoyage de la réponse — suppression des blocs markdown éventuels
    let raw = completion.choices[0].message.content.trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    // Parsing et validation du JSON retourné par Groq
    let plan;
    try {
      plan = JSON.parse(raw);
    } catch {
      console.error('[SANTE] Réponse Groq non-JSON — extrait brut :', raw.slice(0, 500));
      return res.status(500).json({ error: 'Réponse Groq invalide', raw });
    }

    // Stockage des métadonnées dans le cache pour les retours suivants
    plan.calories_cibles = cibles;
    plan.semaine_debut   = lundiActuel;

    // Sauvegarde en base — écrase l'ancien cache
    await pool.query(
      `UPDATE profiles SET sante_plan_cache = \$1, sante_plan_date = \$2 WHERE user_id = \$3`,
      [JSON.stringify(plan), lundiActuel, userId]
    );

    res.json({ plan, calories_cibles: cibles });

  } catch (err) {
    console.error('sante/plan :', err.message || err);
    if (err.status === 429) {
      return res.status(429).json({ error: 'Limite Groq atteinte, réessaie dans quelques secondes.' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
