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

        <div class="sport-card" style="margin-top:16px">
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
