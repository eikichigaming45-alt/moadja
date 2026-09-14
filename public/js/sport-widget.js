// public/js/sport-widget.js
// Widget Sport global (colonne droite, visible sur tous les onglets) +
// utilitaires partagés avec sport.js (auth, formatage, échappement HTML,
// icônes communes). DOIT être chargé AVANT sport.js dans index.html.

const SPORT_ICONE_DUMBBELL = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="2.5"  y1="7" x2="2.5"  y2="17"></line>
        <line x1="5.5"  y1="9" x2="5.5"  y2="15"></line>
        <line x1="18.5" y1="9" x2="18.5" y2="15"></line>
        <line x1="21.5" y1="7" x2="21.5" y2="17"></line>
        <line x1="5.5" y1="12" x2="18.5" y2="12"></line>
    </svg>
`;

const SPORT_ICONE_FLECHE = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14"></path>
        <path d="M12 5l7 7-7 7"></path>
    </svg>
`;

const SPORT_ICONE_TROPHEE = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 21h8"></path>
        <path d="M12 17v4"></path>
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4z"></path>
        <path d="M7 5H5a2 2 0 0 0 0 4h1"></path>
        <path d="M17 5h2a2 2 0 0 1 0 4h-1"></path>
    </svg>
`;

const SPORT_WIDGET_MAX_EXERCICES_APERCU = 3;

// ── AUTH ──

function _sportToken() {
    try { return JSON.parse(localStorage.getItem('moadja_user'))?.token || ''; }
    catch { return ''; }
}

function _sportAuthHeaders() {
    return {
        'Content-Type' : 'application/json',
        'Authorization': `Bearer ${_sportToken()}`
    };
}

// ── Échappement HTML (anti-XSS) ──
function _sportEchapper(str) {
    return (str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ── Formatage date courte type "13 sept." ──
function _sportFormatDateCourte(dateIso) {
    const MOIS_ABREGES = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const d = new Date(dateIso);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${MOIS_ABREGES[d.getMonth()]}`;
}

// ── Formatage durée longue type "3h12", "16min05", "9s" ──
function _sportFormatDureeLongue(secondes) {
    const h = Math.floor(secondes / 3600);
    const m = Math.floor((secondes % 3600) / 60);
    const s = secondes % 60;
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
    if (m > 0) return `${m}min${String(s).padStart(2, '0')}`;
    return `${s}s`;
}

// ── Phrases d'encouragement (si aucune séance) ──
const SPORT_PHRASES_ENCOURAGEMENT = [
    "Chaque séance compte, même la plus courte. Lancez-vous !",
    "Votre progression commence par un premier pas.",
    "Aujourd'hui est un bon jour pour bouger un peu.",
    "Pas de séance cette semaine ? Il n'est jamais trop tard.",
    "Votre corps vous remerciera pour chaque effort, même petit."
];

// ── Widget Sport Stats (colonne droite, global) ──
// Aucune séance : phrase d'encouragement aléatoire. Sinon : carte
// compacte façon Hevy (titre, Durée/Volume/Records + badge trophée,
// liste consolidée d'exercices tronquée).
async function chargerSportStatsWidget() {
    const zone = document.getElementById('sport-stats-widget');
    if (!zone) return;

    try {
        const r = await fetch('/api/sport/dashboard-stats', { headers: _sportAuthHeaders() });
        const d = await r.json();

        if (!d.success || !d.derniere_seance) {
            _sportRenderWidgetPhraseAleatoire(zone);
            return;
        }

        _sportRenderWidgetDerniereSeance(zone, d.derniere_seance);
    } catch (err) {
        console.error('[SPORT] chargerSportStatsWidget :', err.message);
        _sportRenderWidgetPhraseAleatoire(zone);
    }
}

function _sportRenderWidgetPhraseAleatoire(zone) {
    const phrase = SPORT_PHRASES_ENCOURAGEMENT[
        Math.floor(Math.random() * SPORT_PHRASES_ENCOURAGEMENT.length)
    ];

    zone.innerHTML = `
        <div class="sport-stats-header">
            <h3 class="sport-stats-title">${SPORT_ICONE_DUMBBELL} Sport</h3>
            <button class="sport-stats-arrow" onclick="switchTab('sport')" title="Aller au module Sport">
                ${SPORT_ICONE_FLECHE}
            </button>
        </div>
        <p class="sport-stats-text">${phrase}</p>
    `;
}

// Carte compacte façon Hevy, adaptée à l'espace réduit de la colonne droite.
function _sportRenderWidgetDerniereSeance(zone, seance) {
    const dateTexte = _sportFormatDateCourte(seance.date_end || seance.date_start);
    const nbRecords = Number.isInteger(seance.nb_records) ? seance.nb_records : 0;
    const exercices = seance.exercices || [];
    const apercu    = exercices.slice(0, SPORT_WIDGET_MAX_EXERCICES_APERCU);
    const reste     = exercices.length - apercu.length;

    zone.innerHTML = `
        <div class="sport-stats-header">
            <h3 class="sport-stats-title">${SPORT_ICONE_DUMBBELL} Sport</h3>
            <button class="sport-stats-arrow" onclick="switchTab('sport')" title="Aller au module Sport">
                ${SPORT_ICONE_FLECHE}
            </button>
        </div>

        <div class="sport-widget-hevy-titre">
            <strong>${_sportEchapper(seance.workout_name)}</strong>
            <span class="sport-widget-hevy-date">${dateTexte}</span>
        </div>

        <div class="sport-widget-hevy-stats">
            <div class="sport-widget-hevy-stat">
                <span class="sport-widget-hevy-stat-label">Durée</span>
                <span class="sport-widget-hevy-stat-val">${_sportFormatDureeLongue(seance.dureeSecondes)}</span>
            </div>
            <div class="sport-widget-hevy-stat">
                <span class="sport-widget-hevy-stat-label">Volume</span>
                <span class="sport-widget-hevy-stat-val">${seance.volumeKg} kg</span>
            </div>
            <div class="sport-widget-hevy-stat">
                <span class="sport-widget-hevy-stat-label">Records</span>
                <span class="sport-widget-hevy-stat-val">
                    ${nbRecords}${nbRecords > 0 ? ` ${SPORT_ICONE_TROPHEE}` : ''}
                </span>
            </div>
        </div>

        ${apercu.length ? `
            <div class="sport-widget-hevy-liste">
                ${apercu.map(e => `
                    <div class="sport-widget-hevy-ligne">
                        <span class="sport-widget-hevy-ligne-nb">${e.nb_series}x</span>
                        <span class="sport-widget-hevy-ligne-nom">${_sportEchapper(e.exercise_name)}</span>
                    </div>
                `).join('')}
                ${reste > 0 ? `<div class="sport-widget-hevy-reste">…et ${reste} autre${reste > 1 ? 's' : ''}</div>` : ''}
            </div>
        ` : ''}
    `;
}
