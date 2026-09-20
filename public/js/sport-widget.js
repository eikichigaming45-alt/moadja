// ============================================================
// public/js/sport-widget.js
// ============================================================
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

// Petit logo dumbbell (14x14) dédié à la marque "MoaDja" en pied de carte —
// distinct de SPORT_ICONE_DUMBBELL (28x28, utilisé ailleurs dans sport.js)
// pour ne pas dépendre d'une résolution CSS forcée sur un SVG déjà dimensionné.
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

// ── Détail d'une série individuelle (musculation : "12×20kg" ou "12 reps"
// au poids du corps ; cardio : combine durée/distance/vitesse/inclinaison,
// n'affiche que les valeurs réellement renseignées pour cette série). ──
function _sportFormatDetailSerie(serie, estCardio) {
    if (estCardio) {
        const morceaux = [];
        if (Number.isInteger(serie.duration_seconds)) morceaux.push(_sportFormatDureeLongue(serie.duration_seconds));
        if (serie.distance_km != null) morceaux.push(`${serie.distance_km.toString().replace('.', ',')} km`);
        if (serie.speed_kmh != null) morceaux.push(`${serie.speed_kmh} km/h`);
        if (serie.incline_percent != null) morceaux.push(`${serie.incline_percent}%`);
        return morceaux.length ? morceaux.join(' · ') : '—';
    }
    if (serie.weight_kg != null) {
        return `${serie.reps ?? '?'}×${serie.weight_kg}kg`;
    }
    return serie.reps != null ? `${serie.reps} reps` : '—';
}

// ── Détecte si toutes les séries d'un exercice consolidé sont strictement identiques ──
function _sportSeriesIdentiques(series, estCardio) {
    if (series.length <= 1) return true;
    const cle = s => estCardio
        ? [s.duration_seconds, s.distance_km, s.speed_kmh, s.incline_percent].join('|')
        : [s.reps, s.weight_kg].join('|');
    const premiere = cle(series[0]);
    return series.every(s => cle(s) === premiere);
}

// Bloc détaillé d'un exercice consolidé — format compact "texte coloré sur une ligne"
function _sportRenderBlocExerciceDetail(e) {
    const series    = Array.isArray(e.series) ? e.series : [];
    const estCardio = !!e.est_cardio;
    const nom       = _sportEchapper(e.exercise_name);

    let detailTexte = '';
    if (series.length) {
        const aAfficher = _sportSeriesIdentiques(series, estCardio) ? [series[0]] : series;
        detailTexte = aAfficher.map(s => _sportFormatDetailSerie(s, estCardio)).join(', ');
    }

    return `
        <div class="sport-exo-ligne">
            <span class="sport-exo-ligne-nb">${e.nb_series}x</span>
            <span class="sport-exo-ligne-nom">${nom}</span>${detailTexte ? `
            <span class="sport-exo-ligne-sep">·</span>
            <span class="sport-exo-ligne-detail">${_sportEchapper(detailTexte)}</span>` : ''}
        </div>
    `;
}

// ── Bloc partagé ISO (Dashboard / Widget droite / Modale) ──
// Factorise l'affichage Titre, Trophées, Stats (Durée/Volume/Calories), 
// Warning profil incomplet, Liste d'exercices et Footer MoaDja.
function _sportRenderSeanceIso(s, mode = 'modal') {
    const dateTexte   = _sportFormatDateCourte(s.date_end || s.date_start);
    const nbRecords   = Number.isInteger(s.nb_records) ? s.nb_records : 0;
    const exercices   = s.exercices || [];
    
    // Rendu de la liste
    let listeHtml = '';
    if (mode === 'widget' || mode === 'dashboard') {
        const limit = mode === 'dashboard' ? 5 : SPORT_WIDGET_MAX_EXERCICES_APERCU;
        const apercu = exercices.slice(0, limit);
        const reste  = exercices.length - apercu.length;
        if (apercu.length) {
            listeHtml = `
                <div class="${mode === 'dashboard' ? 'sport-seance-recap-liste' : 'sport-widget-exercices-liste'}">
                    ${apercu.map(e => _sportRenderBlocExerciceDetail(e)).join('')}
                    ${reste > 0 ? `<div class="${mode === 'dashboard' ? 'sport-seance-recap-reste' : 'sport-widget-exercice-reste'}">…et ${reste} autre${reste > 1 ? 's' : ''}</div>` : ''}
                </div>
            `;
        }
    } else {
        listeHtml = `
            <div class="sport-modal-exercices-liste">
                ${exercices.map(e => _sportRenderBlocExerciceDetail(e)).join('')}
            </div>
        `;
    }

    // Gestion de l'erreur profil incomplet (calories)
    const warningCalories = s.profil_incomplet
        ? `<div style="grid-column: 1 / -1; font-size: 11.5px; color: #ef4444; text-align: center; margin-top: 6px; padding: 6px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px;">
            Complétez votre profil (poids, taille, sexe, date de naissance) pour voir vos calories brûlées.
           </div>`
        : '';
    const valCalories = s.profil_incomplet ? '—' : `${s.calories} kcal`;

    return `
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
                <span class="sport-widget-stat-label">Calories</span>
                <span class="sport-widget-stat-val" ${s.profil_incomplet ? 'style="color:#ef4444"' : ''}>${valCalories}</span>
            </div>
            ${warningCalories}
        </div>

        ${listeHtml}

        ${(mode === 'widget' || mode === 'dashboard') ? `
            <div class="sport-widget-footer">
                <span class="sport-widget-footer-logo">${SPORT_ICONE_LOGO_MINI} MoaDja</span>
            </div>
        ` : ''}
    `;
}

// ── Phrases d'encouragement (si aucune séance) ──
const SPORT_PHRASES_ENCOURAGEMENT = [
    "Chaque séance compte, même la plus courte. Lancez-vous !",
    "Votre progression commence par un premier pas.",
    "Aujourd'hui est un bon jour pour bouger un peu.",
    "Pas de séance cette semaine ? Il n'est jamais trop tard.",
    "Votre corps vous remerciera pour chaque effort, même petit."
];

// Cache de la séance actuellement affichée dans le widget colonne droite.
let _sportWidgetDerniereSeanceCache = null;

// ── Widget Sport Stats (colonne droite, global) ──
async function chargerSportStatsWidget() {
    const zone = document.getElementById('sport-stats-widget');
    if (!zone) return;

    try {
        const r = await fetch('/api/sport/dashboard-stats', { headers: _sportAuthHeaders() });
        const d = await r.json();

        if (!d.success || !d.derniere_seance) {
            _sportWidgetDerniereSeanceCache = null;
            _sportRenderWidgetPhraseAleatoire(zone);
            return;
        }

        _sportRenderWidgetDerniereSeance(zone, d.derniere_seance);
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

// Rendu du widget colonne droite en utilisant la fonction ISO
function _sportRenderWidgetDerniereSeance(zone, seance) {
    _sportWidgetDerniereSeanceCache = seance;

    zone.innerHTML = `
        <div class="sport-widget-top">
            <h3 class="sport-widget-top-title">${SPORT_ICONE_DUMBBELL} Sport</h3>
            <button class="sport-widget-top-arrow" onclick="switchTab('sport')" title="Aller au module Sport">
                ${SPORT_ICONE_FLECHE}
            </button>
        </div>

        <div class="sport-widget-clickable" onclick="_sportWidgetOuvrirStats()" role="button" tabindex="0">
            ${_sportRenderSeanceIso(seance, 'widget')}
        </div>
    `;
}

// ── Modale Statistiques Sport (détail complet) ──
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

        if (!d.success || !d.derniere_seance) {
            zone.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px">Aucune séance enregistrée pour l\'instant.</p>';
            return;
        }

        _sportRenderModaleStatsDepuisSeance(zone, d.derniere_seance);
    } catch (err) {
        console.error('[SPORT] _ouvrirModaleSportStats :', err.message);
        zone.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px">Erreur de chargement des statistiques.</p>';
    }
}

// Rendu de la modale en utilisant la fonction ISO
function _sportRenderModaleStatsDepuisSeance(zone, s) {
    zone.innerHTML = `
        <div class="sport-modal-stats">
            ${_sportRenderSeanceIso(s, 'modal')}
        </div>
    `;
}
