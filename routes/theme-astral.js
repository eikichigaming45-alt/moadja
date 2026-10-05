// ============================================================
// routes/theme-astral.js
// Thème astral natal — freeastrologyapi.com western + Groq + cache BDD
// ============================================================

const express               = require('express');
const router                = express.Router();
const { pool }              = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const { find }              = require('geo-tz');

const FREEASTRO_URL     = 'https://json.freeastrologyapi.com/western/planets';
const FREEASTRO_TZ_URL  = 'https://json.freeastrologyapi.com/timezone-with-dst';
const GROQ_URL          = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL        = 'openai/gpt-oss-20b';

// ── Mappings FR ───────────────────────────────────────────────
const PLANETES_FR = {
    Sun        : 'Soleil',
    Moon       : 'Lune',
    Mercury    : 'Mercure',
    Venus      : 'Vénus',
    Mars       : 'Mars',
    Jupiter    : 'Jupiter',
    Saturn     : 'Saturne',
    Uranus     : 'Uranus',
    Neptune    : 'Neptune',
    Pluto      : 'Pluton',
    Ascendant  : 'Ascendant',
    Descendant : 'Descendant',
    MC         : 'Milieu du Ciel',
    IC         : 'Fond du Ciel',
    'Mean Node': 'Nœud Nord',
    'True Node': 'Nœud Nord (vrai)',
    Chiron     : 'Chiron',
    Lilith     : 'Lilith',
    Ceres      : 'Cérès',
    Vesta      : 'Vesta',
    Juno       : 'Junon',
    Pallas     : 'Pallas'
};

const SIGNES_FR = {
    Aries      : 'Bélier',
    Taurus     : 'Taureau',
    Gemini     : 'Gémeaux',
    Cancer     : 'Cancer',
    Leo        : 'Lion',
    Virgo      : 'Vierge',
    Libra      : 'Balance',
    Scorpio    : 'Scorpion',
    Sagittarius: 'Sagittaire',
    Capricorn  : 'Capricorne',
    Aquarius   : 'Verseau',
    Pisces     : 'Poissons'
};

const SIGNES_EMOJI = {
    Aries:'♈', Taurus:'♉', Gemini:'♊', Cancer:'♋',
    Leo:'♌', Virgo:'♍', Libra:'♎', Scorpio:'♏',
    Sagittarius:'♐', Capricorn:'♑', Aquarius:'♒', Pisces:'♓'
};

// ── Récupérer l'offset UTC réel via l'API (DST historique exact) ─
async function getTimezoneOffset(tzName, year, month, day, hour, minute) {
    try {
        const res = await fetch(FREEASTRO_TZ_URL, {
            method : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key'   : process.env.FREEASTROAPI_KEY
            },
            body: JSON.stringify({ timezone: tzName, year, month, day, hour, minute })
        });
        if (!res.ok) throw new Error(`TZ API error: ${res.status}`);
        const data = await res.json();
        const offset = data?.timezone_with_dst?.timezone_offset_hours;
        if (offset == null) throw new Error('offset null');
        console.log(`[THEME-ASTRAL] TZ offset pour ${tzName} ${year}-${month}-${day} ${hour}:${minute} → ${offset}h`);
        return offset;
    } catch (e) {
        console.warn('[THEME-ASTRAL] getTimezoneOffset fallback UTC+0 :', e.message);
        return 0;
    }
}

// ── Normaliser une planète depuis le format API western ───────
function normaliserPlanete(p) {
    const name       = p.planet?.en || '';
    const sign       = p.zodiac_sign?.name?.en || '';
    const fullDegree = p.fullDegree != null ? parseFloat(p.fullDegree)            : null;
    const normDegree = p.normDegree != null ? parseFloat(p.normDegree).toFixed(1) : null;
    return {
        name,
        sign,
        fullDegree,
        normDegree,
        isRetro : p.isRetro === 'true' || p.isRetro === true,
        house   : null,
        nameFR  : PLANETES_FR[name]  || name,
        signeFR : SIGNES_FR[sign]    || sign,
        emoji   : SIGNES_EMOJI[sign] || ''
    };
}

// ── Calcul dominante planétaire ───────────────────────────────
function calculerDominante(planetes) {
    const scores      = {};
    const principales = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
    planetes.forEach(p => {
        if (!principales.includes(p.name)) return;
        scores[p.name] = (scores[p.name] || 0) + 1;
    });
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || null;
}

// ── GET /api/theme-astral/status ──────────────────────────────
router.get('/status', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const { rows } = await pool.query(
            'SELECT date_naissance, heure_naissance, naissance_lat, naissance_lon, astral_cache FROM profiles WHERE user_id = \$1',
            [userId]
        );
        if (!rows.length) return res.json({ success: true, hasCache: false, hasDate: false, hasLocation: false });
        
        const profil = rows[0];
        let isCacheValid = false;
        
        if (profil.astral_cache) {
            const cacheData = typeof profil.astral_cache === 'string' ? JSON.parse(profil.astral_cache) : profil.astral_cache;
            // Si le cache n'a pas d'heure, MAIS que l'utilisateur a maintenant renseigné une heure : le cache est obsolète (Upgrade)
            if (!cacheData.hasHeure && profil.heure_naissance) {
                isCacheValid = false;
            } else {
                isCacheValid = true;
            }
        }

        res.json({
            success    : true,
            hasCache   : isCacheValid,
            hasDate    : !!profil.date_naissance,
            hasLocation: !!(profil.naissance_lat && profil.naissance_lon)
        });
    } catch (err) {
        console.error('[THEME-ASTRAL] GET /status :', err.message);
        res.status(500).json({ success: false });
    }
});

// ── GET /api/theme-astral ─────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const { rows } = await pool.query(
            'SELECT date_naissance, heure_naissance, naissance_lat, naissance_lon, lieu_naissance, astral_cache FROM profiles WHERE user_id = \$1',
            [userId]
        );

        if (!rows.length) {
            return res.json({ success: false, code: 'NO_PROFILE' });
        }

        const profil = rows[0];

        if (!profil.date_naissance) {
            return res.json({ success: false, code: 'NO_DATE' });
        }
        if (!profil.naissance_lat || !profil.naissance_lon) {
            return res.json({ success: false, code: 'NO_LOCATION' });
        }

        const hasHeure = !!profil.heure_naissance;

        // Vérification d'upgrade de cache
        if (profil.astral_cache) {
            const cacheData = typeof profil.astral_cache === 'string' ? JSON.parse(profil.astral_cache) : profil.astral_cache;
            // On renvoie le cache si : il contient déjà une heure, OU s'il n'y a toujours pas d'heure dispo dans le profil.
            if (cacheData.hasHeure || !hasHeure) {
                return res.json({ success: true, data: cacheData, fromCache: true });
            }
            // Si cacheData.hasHeure est false mais que hasHeure est true -> on ignore le cache pour faire l'upgrade.
            console.log(`[THEME-ASTRAL] Upgrade autorisé pour l'utilisateur ${userId} : ajout de l'heure de naissance.`);
        }

        const dateNaissance = new Date(profil.date_naissance);
        const heureStr      = hasHeure ? profil.heure_naissance.slice(0, 5) : '12:00';
        const [hh, mm]      = heureStr.split(':').map(Number);

        const year  = dateNaissance.getUTCFullYear();
        const month = dateNaissance.getUTCMonth() + 1;
        const day   = dateNaissance.getUTCDate();

        const lat = parseFloat(profil.naissance_lat);
        const lng = parseFloat(profil.naissance_lon);

        const tzNames  = find(lat, lng);
        const tzName   = tzNames?.[0] || 'UTC';

        // Récupérer l'offset DST historique exact depuis l'API elle-même
        const timezone = await getTimezoneOffset(tzName, year, month, day, hh, mm);

        const payload = {
            year,
            month,
            date     : day,
            hours    : hh,
            minutes  : mm,
            seconds  : 0,
            latitude : lat,
            longitude: lng,
            timezone,
            config   : {
                observation_point: 'topocentric',
                ayanamsha        : 'tropical',
                language         : 'en'
            }
        };

        console.log('[THEME-ASTRAL] Payload envoyé:', JSON.stringify(payload));

        const astroRes = await fetch(FREEASTRO_URL, {
            method : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key'   : process.env.FREEASTROAPI_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!astroRes.ok) {
            const errTxt = await astroRes.text();
            console.error('[THEME-ASTRAL] FreeAstroAPI error:', astroRes.status, errTxt);
            return res.json({ success: false, code: 'API_ERROR', message: 'FreeAstroAPI indisponible.' });
        }

        const astroData = await astroRes.json();
        console.log('[THEME-ASTRAL] statusCode:', astroData.statusCode);

        const rawOutput = astroData.output;
        if (!Array.isArray(rawOutput) || !rawOutput.length) {
            console.error('[THEME-ASTRAL] Aucune donnée output. Réponse:', JSON.stringify(astroData));
            return res.json({ success: false, code: 'API_ERROR', message: 'Données astrologiques invalides.' });
        }

        const planetesFR = rawOutput.map(normaliserPlanete).filter(p => p.name);

        const soleil    = planetesFR.find(p => p.name === 'Sun');
        const lune      = planetesFR.find(p => p.name === 'Moon');
        const ascendant = planetesFR.find(p => p.name === 'Ascendant');
        const mc        = planetesFR.find(p => p.name === 'MC');
        const dominante   = calculerDominante(planetesFR);
        const dominanteFR = dominante ? (PLANETES_FR[dominante] || dominante) : null;

        let interpretation = null;
        try {
            const promptParts = [
                `Tu es un astrologue expert. Génère une interprétation narrative du thème natal en français, structurée en 4 parties courtes (3-4 phrases chacune) :`,
                `1. **Soleil en ${soleil?.signeFR || '?'}** — identité profonde, ego, vitalité`,
                ascendant
                    ? `2. **Ascendant ${ascendant.signeFR}** — façade, première impression, corps`
                    : `2. **Ascendant** — non calculé (heure de naissance manquante)`,
                mc ? `3. **Milieu du Ciel en ${mc.signeFR}** — vocation, ambitions, image publique` : '',
                `4. **Dominante planétaire : ${dominanteFR || '?'}** — énergie principale du thème`,
                `Lune en ${lune?.signeFR || '?'}${lune?.house ? ', en maison ' + lune.house : ''}.`,
                `Sois précis, bienveillant, et évite les généralités vagues. Pas de bullet points — texte fluide uniquement.`,
                !hasHeure ? `Note : l'heure de naissance est inconnue, l'Ascendant et le MC sont donc absents.` : ''
            ].filter(Boolean).join('\n');

            const groqRes = await fetch(GROQ_URL, {
                method : 'POST',
                headers: {
                    'Content-Type' : 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model      : GROQ_MODEL,
                    messages   : [{ role: 'user', content: promptParts }],
                    max_tokens : 1200,
                    temperature: 0.7
                })
            });

            if (groqRes.ok) {
                const groqData = await groqRes.json();
                interpretation = groqData.choices?.[0]?.message?.content?.trim() || null;
            }
        } catch (groqErr) {
            console.error('[THEME-ASTRAL] Groq error:', groqErr.message);
        }

        const cacheData = {
            planetes      : planetesFR,
            soleil,
            lune,
            ascendant     : hasHeure ? ascendant : null,
            mc            : hasHeure ? mc : null,
            dominante,
            dominanteFR,
            interpretation,
            hasHeure,
            generatedAt   : new Date().toISOString().split('T')[0]
        };

        await pool.query(
            'UPDATE profiles SET astral_cache = \$1 WHERE user_id = \$2',
            [JSON.stringify(cacheData), userId]
        );

        return res.json({ success: true, data: cacheData, fromCache: false });

    } catch (err) {
        console.error('[THEME-ASTRAL] Erreur:', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/theme-astral/cache — reset tous users (admin uniquement) ──
router.delete('/cache', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }
    try {
        await pool.query('UPDATE profiles SET astral_cache = NULL');
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
