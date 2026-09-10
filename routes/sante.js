// routes/sante.js
// Module Santé — Plan hebdomadaire (7 jours) + liste de courses quantifiée + conseil du jour via Groq
// Endpoint : POST /api/sante/plan
// Cache serveur : sante_plan_cache (jsonb) + sante_plan_date (date = lundi de la semaine) dans profiles
// 1 seul appel Groq/semaine — partagé tous appareils
// max_tokens calibré sous la limite structurelle Groq (8000 tokens/min, prompt + max_tokens compris)

const express               = require('express');
const router                = express.Router();
const { pool }              = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const Groq                  = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

function lundiSemaine(date) {
  const d = new Date(date);
  const jour = d.getDay();
  const diff = (jour === 0 ? -6 : 1 - jour);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

router.post('/plan', authenticateToken, async (req, res) => {
  try {
    const userId      = req.user.id;
    const today        = new Date();
    const lundiActuel  = lundiSemaine(today);

    const result = await pool.query(
      `SELECT sexe, date_naissance, taille, poids, niveau_activite, objectif_sante,
              allergies, aliments_exclus, traitements_en_cours, diabete, cholesterol,
              sante_plan_cache, sante_plan_date
       FROM profiles WHERE user_id = \$1`,
      [userId]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Profil introuvable' });

    const p = result.rows[0];

    if (p.sante_plan_cache && p.sante_plan_date) {
      const dateCache = new Date(p.sante_plan_date).toISOString().split('T')[0];
      if (dateCache === lundiActuel) {
        return res.json({ plan: p.sante_plan_cache, calories_cibles: p.sante_plan_cache.calories_cibles || null, cached: true });
      }
    }

    if (!p.taille || !p.poids || !p.sexe || !p.date_naissance || !p.niveau_activite || !p.objectif_sante) {
      return res.status(400).json({ error: 'Profil incomplet — taille, poids, sexe, date de naissance, niveau d\'activité et objectif requis' });
    }

    const age    = Math.floor((new Date() - new Date(p.date_naissance)) / (365.25 * 24 * 3600 * 1000));
    const taille = parseFloat(p.taille);
    const poids  = parseFloat(p.poids);

    const bmr = p.sexe === 'homme'
      ? 10 * poids + 6.25 * taille - 5 * age + 5
      : 10 * poids + 6.25 * taille - 5 * age - 161;

    const coeffs = {
      sedentaire : 1.2,
      leger      : 1.375,
      modere     : 1.55,
      actif      : 1.725,
      tres_actif : 1.9
    };

    const deltas = {
      perte_moderee     : -300,
      perte_rapide      : -500,
      maintien          :    0,
      prise_masse       :  300,
      prise_masse_rapide:  500
    };

    const tdee   = bmr * (coeffs[p.niveau_activite] || 1.2);
    const cibles = Math.round(tdee + (deltas[p.objectif_sante] || 0));

    const allergies   = (p.allergies || []).join(', ') || 'aucune';
    const exclus      = (p.aliments_exclus || []).join(', ') || 'aucun';
    const traitements = p.traitements_en_cours || 'aucun';
    const diabete     = p.diabete || 'non renseigné';
    const cholesterol = p.cholesterol || 'non renseigné';
    const moisActuel  = MOIS_FR[today.getMonth()];

    const labelsJours = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
    const joursSemaine = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(lundiActuel);
      d.setDate(d.getDate() + i);
      joursSemaine.push({ date: d.toISOString().split('T')[0], label: labelsJours[i] });
    }

    const prompt = `Nutritionniste expert. Génère un plan alimentaire de 7 jours en JSON strict, ULTRA CONCIS (chaque repas en 6-10 mots max).

Profil : ${p.sexe}, ${age} ans, ${taille} cm, ${poids} kg, activité ${p.niveau_activite}, objectif ${p.objectif_sante}, ${cibles} kcal/j en moyenne.
Allergies (interdit) : ${allergies}
Aliments exclus (interdit) : ${exclus}
Traitements en cours : ${traitements}
Diabète : ${diabete}
Cholestérol : ${cholesterol}
Mois : ${moisActuel}

Règles strictes :
1. Jamais d'allergène ni d'aliment exclu.
2. Adapte au diabète/cholestérol si renseignés.
3. Tiens compte des traitements sur l'appétit/métabolisme, sans avis médical.
4. 7 repas différents, moyenne équilibrée sans jour trop restrictif.
5. Fruits/légumes de saison (${moisActuel}, France). Reste économique, ingrédients courants.
6. Activités variées et réalisables à la maison — alterne marche, yoga, pilates, gainage, étirements, mobilité, vélo d'appartement. PAS toujours de la marche.
7. Un seul conseil court par jour (nutrition ou bien-être).
8. Liste de courses consolidée SANS doublons, quantité totale pour toute la semaine par item, avec valeur numérique + unité séparées (ex nom:"Poulet", quantite_semaine:800, unite:"g"). Si non quantifiable (épice, sauce), quantite_semaine:null, unite:"au besoin".

JSON attendu (rien d'autre, pas de markdown) :
{"jours":[{"date":"${joursSemaine[0].date}","jour_label":"${joursSemaine[0].label}","repas":{"petit_dejeuner":"...","collation_matin":"...","dejeuner":"...","collation_soir":"...","diner":"..."},"activites":["..."],"conseil_du_jour":"..."}],"liste_courses":[{"categorie":"Fruits & légumes","items":[{"nom":"...","quantite_semaine":0,"unite":"g"}]},{"categorie":"Protéines","items":[]},{"categorie":"Féculents","items":[]},{"categorie":"Produits laitiers","items":[]},{"categorie":"Épicerie","items":[]}]}

Génère les 7 jours dans l'ordre : ${joursSemaine.map(j => j.label + ' ' + j.date).join(', ')}.`;

    // Appel Groq — max_tokens calibré sous la limite structurelle (prompt + max_tokens <= 8000)
    const completion = await groq.chat.completions.create({
      model      : 'openai/gpt-oss-20b',
      messages   : [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens : 7000
    });

    let raw = completion.choices[0].message.content.trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    let plan;
    try {
      plan = JSON.parse(raw);
    } catch {
      console.error(`[SANTE] Réponse Groq non-JSON — longueur totale: ${raw.length} caractères`);
      console.error('[SANTE] DÉBUT :', raw.slice(0, 300));
      console.error('[SANTE] FIN   :', raw.slice(-300));
      return res.status(500).json({ error: 'Réponse Groq invalide', raw });
    }

    plan.calories_cibles = cibles;
    plan.semaine_debut   = lundiActuel;

    await pool.query(
      `UPDATE profiles SET sante_plan_cache = \$1, sante_plan_date = \$2 WHERE user_id = \$3`,
      [JSON.stringify(plan), lundiActuel, userId]
    );

    res.json({ plan, calories_cibles: cibles });

  } catch (err) {
    console.error('sante/plan :', err.message || err);
    if (err.status === 429 || err.status === 413) {
      return res.status(429).json({ error: 'Limite Groq atteinte, réessaie dans une minute.' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
