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

const SPORT_ICONE_PARTAGE = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
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

// ── Formatage date courte ──
function _sportFormatDateCourte(dateIso) {
    const MOIS_ABREGES = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const d = new Date(dateIso);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${MOIS_ABREGES[d.getMonth()]}`;
}

// ── Formatage durée longue ──
function _sportFormatDureeLongue(secondes) {
    const h = Math.floor(secondes / 3600);
    const m = Math.floor((secondes % 3600) / 60);
    const s = secondes % 60;
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
    if (m > 0) return `${m}min${String(s).padStart(2, '0')}`;
    return `${s}s`;
}

// ── Détail d'une série individuelle ──
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

// ── Détecte si toutes les séries d'un exercice consolidé sont identiques ──
function _sportSeriesIdentiques(series, estCardio) {
    if (series.length <= 1) return true;
    const cle = s => estCardio
        ? [s.duration_seconds, s.distance_km, s.speed_kmh, s.incline_percent].join('|')
        : [s.reps, s.weight_kg].join('|');
    const premiere = cle(series[0]);
    return series.every(s => cle(s) === premiere);
}

// Bloc détaillé d'un exercice consolidé
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

// ── Bloc partagé ISO ──
function _sportRenderSeanceIso(s, mode = 'modal', btnSupprHtml = '') {
    const dateTexte   = _sportFormatDateCourte(s.date_end || s.date_start);
    const nbRecords   = Number.isInteger(s.nb_records) ? s.nb_records : 0;
    const exercices   = s.exercices || [];
    
    const iconeTropheeJaune = `<span style="color: #eab308; display: inline-flex; align-items: center;">${SPORT_ICONE_TROPHEE}</span>`;

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

    const warningCalories = s.profil_incomplet
        ? `<div style="grid-column: 1 / -1; font-size: 11.5px; color: #ef4444; text-align: center; margin-top: 6px; padding: 6px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px;">
            Complétez votre profil (poids, taille, sexe, date de naissance) pour voir vos calories brûlées.
           </div>`
        : '';
    const valCalories = s.profil_incomplet ? '—' : `${s.calories} kcal`;

    let detailsRecordsHtml = '';
    if (mode === 'modal' && nbRecords > 0 && Array.isArray(s.records)) {
        detailsRecordsHtml = `
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed rgba(167, 139, 250, 0.3);">
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; color: #a78bfa;">
                    ${iconeTropheeJaune} Nouveaux records
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${s.records.map(r => `
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; background: rgba(255, 255, 255, 0.4); padding: 6px 10px; border-radius: 6px;">
                            <span style="font-weight: 500; color: #1f2937;">${_sportEchapper(r.exercise_name)}</span>
                            <span style="color: #4b5563;">
                                <span style="text-decoration: line-through; opacity: 0.6; margin-right: 4px;">${r.ancien_record}kg</span> 
                                <span style="font-weight: 600; color: #10b981;">${r.nouveau_poids}kg</span>
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    const styleGris = 'color: #9ca3af; background: rgba(156, 163, 175, 0.1); border: 1px solid rgba(156, 163, 175, 0.2);';
    const badgeHtml = `
        <div class="sport-widget-badge-record" ${nbRecords === 0 ? `style="${styleGris}"` : ''}>
            ${iconeTropheeJaune} <span>${nbRecords > 0 ? `${nbRecords} record${nbRecords > 1 ? 's' : ''}` : 'Aucun nouveau record'}</span>
        </div>
    `;

    let footerHtml = '';
    if (mode === 'dashboard') {
        footerHtml = `
            <div class="sport-widget-footer sport-widget-footer-dashboard">
                <span class="sport-widget-footer-logo">${SPORT_ICONE_LOGO_MINI} MoaDja</span>
                <button class="sport-widget-btn-partage" onclick="_sportOuvrirModalPartage(event, ${s.id})" title="Partager la séance">
                    ${SPORT_ICONE_PARTAGE}
                </button>
            </div>
        `;
    } else if (mode === 'widget') {
        footerHtml = `
            <div class="sport-widget-footer">
                <span class="sport-widget-footer-logo">${SPORT_ICONE_LOGO_MINI} MoaDja</span>
            </div>
        `;
    }

    return `
        <div class="sport-widget-recap-title-row">
            <span class="sport-widget-recap-name">${_sportEchapper(s.workout_name)}</span>
            <span style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <span class="sport-widget-recap-date">${dateTexte}</span>
                ${btnSupprHtml}
            </span>
        </div>

        ${badgeHtml}

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
                <span class="sport-widget-stat-val" style="color:#ef4444">${valCalories}</span>
            </div>
            ${warningCalories}
        </div>

        ${listeHtml}
        ${detailsRecordsHtml}
        ${footerHtml}
    `;
}

// ── Modale de choix de partage (2 boutons : Fil social & Partage externe) ──
function _sportOuvrirModalPartage(event, sessionId) {
    if (event) event.stopPropagation();

    const seance = _sportDashboardSeancesCache.find(s => s.id === sessionId);
    if (!seance) return;

    document.getElementById('overlay').classList.add('on');
    document.body.classList.add('modal-open');
    history.pushState({ modalOpen: true }, '', '');

    document.getElementById('modal-title').textContent = 'Partager la séance';
    document.getElementById('modal-body').innerHTML = `
        <p style="color:#6b7280; font-size:14px; margin-bottom:20px; text-align:center">
            Comment souhaitez-vous partager <strong>${_sportEchapper(seance.workout_name)}</strong> ?
        </p>
        <div style="display:flex; flex-direction:column; gap:10px;">
            <button id="btn-partage-feed" class="sport-cta-btn" onclick="_sportLancerPartage(${sessionId}, 'feed', this, '${_sportEchapper(seance.workout_name)}')" style="width:100%; justify-content:center;">
                📝 Publier sur le fil social
            </button>
            <button id="btn-partage-externe" class="sport-cta-btn" onclick="_sportLancerPartage(${sessionId}, 'externe', this, '${_sportEchapper(seance.workout_name)}')" style="width:100%; justify-content:center; background:rgba(0,0,0,0.8); color:#fff; border:none;">
                🌐 Partager (WhatsApp, etc.)
            </button>
        </div>
        <p id="msg-erreur-partage" style="color:#ef4444; font-size:13px; text-align:center; margin-top:15px; display:none;"></p>
    `;
}

// Appel du backend (sharp) et routage vers l'action choisie
async function _sportLancerPartage(sessionId, destination, boutonDom, nomRoutine) {
    const texteOriginal = boutonDom.innerHTML;
    boutonDom.innerHTML = 'Génération en cours... ⏳';
    boutonDom.disabled = true;
    
    const msgErreur = document.getElementById('msg-erreur-partage');
    msgErreur.style.display = 'none';

    try {
        // 1. Génération de l'image SVG -> JPEG via la route sharp
        const rep = await fetch(`/api/sport/sessions/${sessionId}/generate-share`, {
            method: 'POST',
            headers: _sportAuthHeaders()
        });
        const data = await rep.json();

        if (!data.success) {
            throw new Error(data.message || 'Erreur lors de la génération de l\'image.');
        }

        const imageUrl = data.imageUrl;
        const openGraphUrl = `${window.location.origin}/share/seance/${sessionId}`;
        
        // Textes adaptés selon la destination.
        // Le lien externe n'est plus dupliqué dans le texte : il est porté uniquement
        // par le champ "url" de navigator.share (ou ajouté une seule fois au fallback presse-papiers).
        const texteInterne = `🏋️‍♂️ Séance terminée : ${nomRoutine}`;
        const texteExterne = `🏋️‍♂️ Séance : ${nomRoutine}\nDécouvre les statistiques de cette séance sur MoaDja !`;

        closeModal();

        // 2. Routage selon la destination
        if (destination === 'feed') {
            // Ouvre l'éditeur de post
            switchTab('accueil');
            if (typeof ouvrirModalPost === 'function') ouvrirModalPost();
            
            // Le setTimeout garantit que l'input du feed existe bien dans le DOM
            setTimeout(async () => {
                const inputTexte = document.getElementById('post-contenu');
                if (inputTexte) inputTexte.value = texteInterne;
                
                try {
                    const repImg = await fetch(imageUrl);
                    const blob = await repImg.blob();
                    
                    const file = new File([blob], `seance_${sessionId}.jpg`, { type: 'image/jpeg' });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);

                    const fileInput = document.getElementById('post-photo');
                    if (fileInput) {
                        fileInput.files = dataTransfer.files;
                        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        console.warn('[SPORT] Input file #post-photo non trouvé.');
                    }
                } catch (e) {
                    console.error('[SPORT] Impossible d\'attacher l\'image au feed:', e);
                }
            }, 400);
        } 
        else if (destination === 'externe') {
            // Web Share API native ou fallback presse-papiers.
            // Le lien n'est présent qu'une seule fois (champ url pour navigator.share,
            // concaténé une seule fois au texte pour le fallback presse-papiers).
            if (navigator.share) {
                await navigator.share({
                    title: `Séance : ${nomRoutine}`,
                    text: texteExterne, 
                    url: openGraphUrl
                }).catch(console.error);
            } else {
                await navigator.clipboard.writeText(`${texteExterne}\n\n${openGraphUrl}`);
                alert('Lien et message copiés dans le presse-papiers ! Vous pouvez les coller où vous voulez (WhatsApp Web, Facebook...).');
            }
        }

    } catch (err) {
        console.error('[SPORT] Erreur _sportLancerPartage :', err.message);
        boutonDom.innerHTML = texteOriginal;
        boutonDom.disabled = false;
        msgErreur.textContent = `❌ ${err.message}`;
        msgErreur.style.display = 'block';
    }
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
