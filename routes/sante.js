// routes/sante.js
// Module Santé — Plan repas + activités + conseil du jour via Groq
// Endpoint : POST /api/sante/plan
// Cache serveur : sante_plan_cache (jsonb) + sante_plan_date (date) dans profiles
// Historique : sante_plan_historique (jsonb, 6 derniers jours) — évite la répétition des menus
// 1 seul appel Groq/jour — partagé tous appareils

const express               = require('express');
const router                = express.Router();
const { pool }              = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const Groq                  = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const NB_JOURS_HISTORIQUE = 6;

// POST /api/sante/plan
// Si un plan existe en base pour aujourd'hui, le retourne directement.
// Sinon, appelle Groq, sauvegarde en base (plan + historique), retourne le plan.
router.post('/plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];

    // Récupération du profil + cache + historique
    const result = await pool.query(
      `SELECT sexe, date_naissance, taille, poids, groupe_sanguin,
              niveau_activite, objectif_sante,
              allergies, aliments_exclus,
              traitements_en_cours, diabete, cholesterol,
              sante_plan_cache, sante_plan_date, sante_plan_historique
       FROM profiles WHERE user_id = \$1`,
      [userId]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Profil introuvable' });

    const p = result.rows[0];

    // Retour du cache si le plan du jour existe déjà en base
    if (p.sante_plan_cache && p.sante_plan_date) {
      const dateCache = new Date(p.sante_plan_date).toISOString().split('T')[0];
      if (dateCache === today) {
        return res.json({ plan: p.sante_plan_cache, calories_cibles: p.sante_plan_cache._calories_cibles || null, cached: true });
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

    // Formatage des champs texte pour le prompt
    const allergies   = (p.allergies || []).join(', ') || 'aucune';
    const exclus      = (p.aliments_exclus || []).join(', ') || 'aucun';
    const groupeSang  = p.groupe_sanguin || 'non renseigné';
    const traitements = p.traitements_en_cours || 'aucun';
    const diabete     = p.diabete || 'non renseigné';
    const cholesterol = p.cholesterol || 'non renseigné';

    // ── Historique des repas récents (anti-répétition) ─────────
    const historique = Array.isArray(p.sante_plan_historique) ? p.sante_plan_historique : [];
    const historiqueTexte = historique.length
      ? historique.map(j => `- ${j.date} : ${j.plats.join(', ')}`).join('\n')
      : 'Aucun historique — premier plan généré.';

    // Construction des contraintes médicales dynamiques
    const contraintesMedicales = [];
    if (diabete && diabete.toLowerCase() !== 'non' && diabete !== 'non renseigné') {
      contraintesMedicales.push(`- Diabète (${diabete}) : privilégier un index glycémique bas, éviter sucres rapides et féculents raffinés, répartir les glucides sur la journée.`);
    }
    if (cholesterol && ['élevé', 'eleve', 'sous traitement'].includes(cholesterol.toLowerCase())) {
      contraintesMedicales.push(`- Cholestérol (${cholesterol}) : limiter les graisses saturées et fritures, privilégier oméga-3, fibres, cuissons légères.`);
    }
    if (traitements && traitements.toLowerCase() !== 'aucun') {
      contraintesMedicales.push(`- Traitements en cours (${traitements}) : rester prudent et neutre sur d'éventuelles interactions alimentaires connues, sans donner de conseil médical.`);
    }
    const contraintesTexte = contraintesMedicales.length
      ? contraintesMedicales.join('\n')
      : '- Aucune contrainte médicale particulière signalée.';

    // Construction du prompt Groq
    const prompt = `Tu es un nutritionniste expert. Génère un plan journalier personnalisé en JSON strict.

Profil :
- Sexe : ${p.sexe}
- Âge : ${age} ans
- Taille : ${taille} cm
- Poids : ${poids} kg
- Groupe sanguin : ${groupeSang}
- Niveau d'activité : ${p.niveau_activite}
- Objectif : ${p.objectif_sante}
- Calories cibles : ${cibles} kcal/jour
- Allergies : ${allergies}
- Aliments exclus (n'aime pas / à éviter) : ${exclus}

Contraintes médicales à respecter impérativement :
${contraintesTexte}

Adaptation à l'âge : ajuste les portions et le type d'aliments recommandés en fonction de la tranche d'âge (ado, adulte, senior), en tenant compte des besoins nutritionnels spécifiques.

Historique des repas des ${NB_JOURS_HISTORIQUE} derniers jours (à NE PAS répéter aujourd'hui, propose des plats différents) :
${historiqueTexte}

Réponds UNIQUEMENT avec ce JSON, sans texte autour :
{
  "repas": {
    "petit_dejeuner": "...",
    "collation_matin": "...",
    "dejeuner": "...",
    "collation_soir": "...",
    "diner": "..."
  },
  "activites": ["..."],
  "conseil_du_jour": "..."
}`;

    // Appel Groq
    const completion = await groq.chat.completions.create({
      model      : 'openai/gpt-oss-20b',
      messages   : [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens : 800
    });

    // Nettoyage de la réponse — suppression des blocs markdown éventuels
    let raw = completion.choices[0].message.content.trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    // Parsing et validation du JSON retourné par Groq
    let plan;
    try {
      plan = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Réponse Groq invalide', raw });
    }

    // Stockage des calories cibles dans le cache pour les retours suivants
    plan._calories_cibles = cibles;

    // ── Mise à jour de l'historique (anti-répétition sur 7 jours) ──
    const platsDuJour = [
      plan.repas?.petit_dejeuner,
      plan.repas?.collation_matin,
      plan.repas?.dejeuner,
      plan.repas?.collation_soir,
      plan.repas?.diner
    ].filter(Boolean);

    const nouvelHistorique = [
      { date: today, plats: platsDuJour },
      ...historique
    ].slice(0, NB_JOURS_HISTORIQUE);

    // Sauvegarde en base — écrase l'ancien cache, met à jour l'historique
    await pool.query(
      `UPDATE profiles
       SET sante_plan_cache = \$1, sante_plan_date = \$2, sante_plan_historique = \$3
       WHERE user_id = \$4`,
      [JSON.stringify(plan), today, JSON.stringify(nouvelHistorique), userId]
    );

    res.json({ plan, calories_cibles: cibles });

  } catch (err) {
    console.error('sante/plan :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
