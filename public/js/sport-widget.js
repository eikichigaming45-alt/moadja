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

const SPORT_ICONE_LOGO_MINI = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="2.5"  y1="7" x2="2.5"  y2="17"></line>
        <line x1="5.5"  y1="9" x2="5.5"  y2="15"></line>
        <line x1="18.5" y1="9" x2="18.5" y2="15"></line>
        <line x1="21.5" y1="7" x2="21.5" y2="17"></line>
        <line x1="5.5" y1="12" x2="18.5" y2="12"></line>
    </svg>
`;

const SPORT_WIDGET_MAX_EXERCICES_APERCU = 3;

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

function _sportEchapper(str) {
    return (str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _sportFormatDateCourte(dateIso) {
    const MOIS_ABREGES = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const d = new Date(dateIso);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${MOIS_ABREGES[d.getMonth()]}`;
}

function _sportFormatDureeLongue(secondes) {
    const h = Math.floor(secondes / 3600);
    const m = Math.floor((secondes % 3600) / 60);
    const s = secondes % 60;
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
    if (m > 0) return `${m}min${String(s).padStart(2, '0')}`;
    return `${s}s`;
}

const SPORT_PHRASES_ENCOURAGEMENT = [
    "Chaque séance compte, même la plus courte. Lancez-vous !",
    "Votre progression commence par un premier pas.",
    "Aujourd'hui est un bon jour pour bouger un peu.",
    "Pas de séance cette semaine ? Il n'est jamais trop tard.",
    "Votre corps vous remerciera pour chaque effort, même petit."
];

let _sportWidgetDerniereSeanceCache = null;

async function chargerSportStatsWidget() {
    const zone = document.getElementById('sport-stats-widget');
    if (!zone) return;

    try {
        const r = await fetch('/api/sport/dashboard-stats', { headers: _sportAuthHeaders() });
        const d = await r.json();

        // L'API renvoie un TABLEAU "dernieres_seances" (pluriel), pas un objet "derniere_seance".
        const seances = Array.isArray(d.dernieres_seances) ? d.dernieres_seances : [];

        if (!d.success || !seances.length) {
            _sportWidgetDerniereSeanceCache = null;
            _sportRenderWidgetPhraseAleatoire(zone);
            return;
        }

        // La première entrée du tableau est la plus récente (ORDER BY date_start DESC côté backend).
        _sportRenderWidgetDerniereSeance(zone, seances[0]);
    } catch (err) {
        console.error('[SPORT] chargerSportStatsWidget :', err.message);
        _sportWidgetDerniereSeanceCache = null;
        _sportRenderWidgetPhraseAleatoire(zone);
    }
}

function _sportRenderWidgetPhraseAleatoire(zone) {
    const phrase = SPORT_PHRASES_ENCOURAGEMENT[
        Math.floor(Math.random() * SPORT_PHRASES_ENCOURAGEMENT.length)
    ];

    zone.innerHTML = `
        <div class="sport-widget-top">
            <h3 class="sport-widget-top-title">${SPORT_ICONE_DUMBBELL} Sport</h3>
            <button class="sport-widget-top-arrow" onclick="switchTab('sport')" title="Aller au module Sport">
                ${SPORT_ICONE_FLECHE}
            </button>
        </div>
        <p class="sport-widget-empty-text">${phrase}</p>
    `;
}

function _sportWidgetOuvrirStats() {
    if (!_sportWidgetDerniereSeanceCache) return;
    window._sportSeanceStatsCourante = _sportWidgetDerniereSeanceCache;
    openModal('sport-stats');
}

// Ligne d'exercice : "Nx Nom" + durée entre parenthèses si l'exercice
// en comporte une (Marche, Gainage, Jumping Jack, etc.).
function _sportRenderLigneExercice(e) {
    const duree = e.duree_totale_secondes > 0
        ? ` <span class="sport-widget-exercice-duree">(${_sportFormatDureeLongue(e.duree_totale_secondes)})</span>`
        : '';
    return `
        <div class="sport-widget-exercice-ligne">
            <span class="sport-widget-exercice-nb">${e.nb_series}x</span>
            <span class="sport-widget-exercice-nom">${_sportEchapper(e.exercise_name)}</span>${duree}
        </div>
    `;
}

function _sportRenderWidgetDerniereSeance(zone, seance) {
    _sportWidgetDerniereSeanceCache = seance;

    const dateTexte   = _sportFormatDateCourte(seance.date_end || seance.date_start);
    const nbRecords   = Number.isInteger(seance.nb_records) ? seance.nb_records : 0;
    const exercices   = seance.exercices || [];
    const apercu      = exercices.slice(0, SPORT_WIDGET_MAX_EXERCICES_APERCU);
    const reste       = exercices.length - apercu.length;
    const totalSeries = exercices.reduce((acc, e) => acc + (Number(e.nb_series) || 0), 0);

    zone.innerHTML = `
        <div class="sport-widget-top">
            <h3 class="sport-widget-top-title">${SPORT_ICONE_DUMBBELL} Sport</h3>
            <button class="sport-widget-top-arrow" onclick="switchTab('sport')" title="Aller au module Sport">
                ${SPORT_ICONE_FLECHE}
            </button>
        </div>

        <div class="sport-widget-clickable" onclick="_sportWidgetOuvrirStats()" role="button" tabindex="0">

            <div class="sport-widget-recap-title-row">
                <span class="sport-widget-recap-name">${_sportEchapper(seance.workout_name)}</span>
                <span class="sport-widget-recap-date">${dateTexte}</span>
            </div>

            ${nbRecords > 0 ? `
                <div class="sport-widget-badge-record">
                    ${SPORT_ICONE_TROPHEE} ${nbRecords} record${nbRecords > 1 ? 's' : ''}
                </div>
            ` : ''}

            <div class="sport-widget-stats-row">
                <div class="sport-widget-stat">
                    <span class="sport-widget-stat-label">Durée</span>
                    <span class="sport-widget-stat-val">${_sportFormatDureeLongue(seance.dureeSecondes)}</span>
                </div>
                <div class="sport-widget-stat">
                    <span class="sport-widget-stat-label">Volume</span>
                    <span class="sport-widget-stat-val">${seance.volumeKg} kg</span>
                </div>
                <div class="sport-widget-stat">
                    <span class="sport-widget-stat-label">Séries</span>
                    <span class="sport-widget-stat-val">${totalSeries}</span>
                </div>
            </div>

            ${apercu.length ? `
                <div class="sport-widget-exercices-liste">
                    ${apercu.map(_sportRenderLigneExercice).join('')}
                    ${reste > 0 ? `<div class="sport-widget-exercice-reste">…et ${reste} autre${reste > 1 ? 's' : ''}</div>` : ''}
                </div>
            ` : ''}

            <div class="sport-widget-footer">
                <span class="sport-widget-footer-logo">${SPORT_ICONE_LOGO_MINI} MoaDja</span>
            </div>

        </div>
    `;
}

async function _ouvrirModaleSportStats() {
    const zone = document.getElementById('modal-body');
    if (!zone) return;

    const seanceCourante = window._sportSeanceStatsCourante;
    window._sportSeanceStatsCourante = null;

    if (seanceCourante) {
        _sportRenderModaleStatsDepuisSeance(zone, seanceCourante);
        return;
    }

    try {
        const r = await fetch('/api/sport/dashboard-stats', { headers: _sportAuthHeaders() });
        const d = await r.json();

        // Même correctif : tableau "dernieres_seances", pas objet "derniere_seance".
        const seances = Array.isArray(d.dernieres_seances) ? d.dernieres_seances : [];

        if (!d.success || !seances.length) {
            zone.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px">Aucune séance enregistrée pour l\'instant.</p>';
            return;
        }

        _sportRenderModaleStatsDepuisSeance(zone, seances[0]);
    } catch (err) {
        console.error('[SPORT] _ouvrirModaleSportStats :', err.message);
        zone.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px">Erreur de chargement des statistiques.</p>';
    }
}

function _sportRenderModaleStatsDepuisSeance(zone, s) {
    const dateTexte   = _sportFormatDateCourte(s.date_end || s.date_start);
    const exercices   = s.exercices || [];
    const totalSeries = exercices.reduce((acc, e) => acc + (Number(e.nb_series) || 0), 0);
    const nbRecords   = Number.isInteger(s.nb_records) ? s.nb_records : 0;

    zone.innerHTML = `
        <div class="sport-modal-stats">
            <div class="sport-widget-recap-title-row">
                <span class="sport-widget-recap-name">${_sportEchapper(s.workout_name)}</span>
                <span class="sport-widget-recap-date">${dateTexte}</span>
            </div>

            ${nbRecords > 0 ? `
                <div class="sport-widget-badge-record">
                    ${SPORT_ICONE_TROPHEE} ${nbRecords} record${nbRecords > 1 ? 's' : ''}
                </div>
            ` : ''}

            <div class="sport-widget-stats-row">
                <div class="sport-widget-stat">
                    <span class="sport-widget-stat-label">Durée</span>
                    <span class="sport-widget-stat-val">${_sportFormatDureeLongue(s.dureeSecondes)}</span>
                </div>
                <div class="sport-widget-stat">
                    <span class="sport-widget-stat-label">Volume</span>
                    <span class="sport-widget-stat-val">${s.volumeKg} kg</span>
                </div>
                <div class="sport-widget-stat">
                    <span class="sport-widget-stat-label">Séries</span>
                    <span class="sport-widget-stat-val">${totalSeries}</span>
                </div>
            </div>

            <div class="sport-widget-exercices-liste">
                ${exercices.map(_sportRenderLigneExercice).join('')}
            </div>
        </div>
    `;
}
