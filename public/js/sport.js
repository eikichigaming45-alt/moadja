// ============================================================
// public/js/sport.js
// Logique du module Sport (WGER) : Dashboard, routines,
// séance active, bilan, mensurations, partage.
// Étape actuelle : Dashboard visuel mocké (aucune donnée réelle,
// aucun appel API). Les sections "Mes Routines" et "Catalogue"
// sont des placeholders en attendant le développement backend.
// ============================================================

const SPORT_ICONE_DUMBBELL = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="2.5"  y1="7" x2="2.5"  y2="17"></line>
        <line x1="5.5"  y1="9" x2="5.5"  y2="15"></line>
        <line x1="18.5" y1="9" x2="18.5" y2="15"></line>
        <line x1="21.5" y1="7" x2="21.5" y2="17"></line>
        <line x1="5.5" y1="12" x2="18.5" y2="12"></line>
    </svg>
`;

// Icône flèche (bouton d'accès rapide vers l'onglet Sport)
const SPORT_ICONE_FLECHE = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14"></path>
        <path d="M12 5l7 7-7 7"></path>
    </svg>
`;

let _sportSectionActive = 'dashboard';

// ── Construction initiale du Dashboard Sport ──────────────────
function chargerSportDashboard() {
    const zone = document.getElementById('grid-sport');
    if (!zone) return;

    zone.innerHTML = `
        <div class="sport-wrap">

            <div class="sport-pills">
                <button class="sport-pill active" data-section="dashboard" onclick="_sportSwitchSection('dashboard')">Dashboard</button>
                <button class="sport-pill" data-section="routines" onclick="_sportSwitchSection('routines')">Mes Routines</button>
                <button class="sport-pill" data-section="catalogue" onclick="_sportSwitchSection('catalogue')">Catalogue</button>
            </div>

            <div id="sport-section-dashboard" class="sport-section">
                ${_sportRenderDashboard()}
            </div>

            <div id="sport-section-routines" class="sport-section" style="display:none">
                ${_sportRenderPlaceholder('Mes Routines', 'La création et la gestion de vos routines d\'entraînement seront bientôt disponibles ici.')}
            </div>

            <div id="sport-section-catalogue" class="sport-section" style="display:none">
                ${_sportRenderPlaceholder('Catalogue', 'La recherche d\'exercices (musculation, muscles ciblés, équipement) sera bientôt disponible ici.')}
            </div>

        </div>
    `;
}

// ── Rendu de la vue Dashboard (état "aucune activité") ────────
function _sportRenderDashboard() {
    return `
        <div class="sport-card">
            <div class="sport-empty-state">
                <div class="sport-empty-icon">${SPORT_ICONE_DUMBBELL}</div>
                <div class="sport-empty-title">Aucune séance cette semaine</div>
                <div class="sport-empty-text">
                    Prêt à commencer ? Créez votre première routine pour suivre vos entraînements
                    et voir votre progression au fil du temps.
                </div>
                <button class="sport-cta-btn" onclick="_sportSwitchSection('routines')">
                    ${SPORT_ICONE_DUMBBELL} Commencer une séance
                </button>
            </div>
        </div>

        <div class="sport-card">
            <div class="sport-section-title">Dernières séances</div>
            <p style="color:#9ca3af;font-size:13px;text-align:center;padding:12px 0">
                Aucune séance enregistrée pour l'instant.
            </p>
        </div>
    `;
}

// ── Rendu générique d'une section en construction ─────────────
function _sportRenderPlaceholder(titre, texte) {
    return `
        <div class="sport-card">
            <div class="sport-empty-state">
                <div class="sport-empty-icon">${SPORT_ICONE_DUMBBELL}</div>
                <div class="sport-empty-title">${titre}</div>
                <div class="sport-empty-text">${texte}</div>
            </div>
        </div>
    `;
}

// ── Changement de section via les pilules ─────────────────────
function _sportSwitchSection(section) {
    _sportSectionActive = section;

    document.querySelectorAll('.sport-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.section === section);
    });

    document.querySelectorAll('.sport-section').forEach(s => {
        s.style.display = 'none';
    });
    const cible = document.getElementById(`sport-section-${section}`);
    if (cible) cible.style.display = 'block';
}

// ── Phrases d'encouragement (widget colonne droite) ────────────
const SPORT_PHRASES_ENCOURAGEMENT = [
    "Chaque séance compte, même la plus courte. Lancez-vous !",
    "Votre progression commence par un premier pas.",
    "Aujourd'hui est un bon jour pour bouger un peu.",
    "Pas de séance cette semaine ? Il n'est jamais trop tard.",
    "Votre corps vous remerciera pour chaque effort, même petit."
];

// ── Widget Sport Stats (colonne droite, global à tous les onglets) ─
// Toutes les classes utilisées ici sont définies dans public/css/sport.css
// (.sport-stats-header, .sport-stats-title, .sport-stats-arrow, .sport-stats-text)
// — aucun style inline, conformément à la règle établie.
function chargerSportStatsWidget() {
    const zone = document.getElementById('sport-stats-widget');
    if (!zone) return;

    // Étape actuelle : aucune donnée réelle (pas d'API branchée).
    // On affiche systématiquement une phrase d'encouragement aléatoire.
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
