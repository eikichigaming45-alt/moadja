// ============================================================
// public/js/sport.js
// Logique du module Sport (WGER) : Dashboard, routines,
// séance active, bilan, mensurations, partage.
// Étape actuelle : Dashboard visuel mocké (aucune donnée réelle,
// aucun appel API). La section "Mes Routines" reste un placeholder.
// Le Catalogue est branché sur le backend WGER (v1.88+, pagination
// par has_more suite à la correction du filtrage agrégé).
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
            <p class="sport-empty-note">
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

    if (section === 'catalogue') {
        _sportChargerCatalogue();
    }
}

// ────────────────────────────────────────────────────────────
// CATALOGUE WGER — recherche d'exercices (relais backend v1.88+)
// Auth : même mécanisme que le reste du site (token Bearer
// stocké dans localStorage['moadja_user'].token).
// Pagination basée sur has_more (le backend agrège/filtre les
// exercices WGER, un total exact n'est pas disponible).
// ────────────────────────────────────────────────────────────

let _sportCatalogueChargee     = false;
let _sportCatalogueOffset      = 0;
let _sportCataloguePageActuelle = 1;
let _sportCatalogueSearchTimer = null;
const SPORT_CATALOGUE_LIMIT    = 20;

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

// Icône générique utilisée quand un exercice n'a pas d'image
const SPORT_ICONE_PAS_IMAGE = `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
`;

// ── Point d'entrée : construit la structure de la section Catalogue ──
function _sportChargerCatalogue() {
    const zone = document.getElementById('sport-section-catalogue');
    if (!zone) return;

    // Ne reconstruit la structure qu'une seule fois (chargement paresseux)
    if (_sportCatalogueChargee) return;
    _sportCatalogueChargee = true;

    zone.innerHTML = `
        <div class="sport-card">
            <div class="sport-catalogue-toolbar">
                <input type="text"
                       id="sport-catalogue-search"
                       class="sport-catalogue-search"
                       placeholder="Rechercher un exercice…"
                       autocomplete="off">
                <select id="sport-catalogue-filtre-categorie" class="sport-catalogue-select">
                    <option value="">Toutes catégories</option>
                </select>
                <select id="sport-catalogue-filtre-equipement" class="sport-catalogue-select">
                    <option value="">Tout équipement</option>
                </select>
            </div>
            <div id="sport-catalogue-resultats">
                <p class="sport-catalogue-loading">Chargement du catalogue…</p>
            </div>
            <div id="sport-catalogue-pagination" class="sport-catalogue-pagination" style="display:none">
                <button id="sport-catalogue-prev" class="sport-catalogue-page-btn">Précédent</button>
                <span id="sport-catalogue-page-info" class="sport-catalogue-page-info"></span>
                <button id="sport-catalogue-next" class="sport-catalogue-page-btn">Suivant</button>
            </div>
        </div>
    `;

    document.getElementById('sport-catalogue-search').addEventListener('input', () => {
        clearTimeout(_sportCatalogueSearchTimer);
        _sportCatalogueSearchTimer = setTimeout(() => {
            _sportCatalogueOffset       = 0;
            _sportCataloguePageActuelle = 1;
            _sportRechercherExercices();
        }, 400);
    });

    document.getElementById('sport-catalogue-filtre-categorie').addEventListener('change', () => {
        _sportCatalogueOffset       = 0;
        _sportCataloguePageActuelle = 1;
        _sportRechercherExercices();
    });

    document.getElementById('sport-catalogue-filtre-equipement').addEventListener('change', () => {
        _sportCatalogueOffset       = 0;
        _sportCataloguePageActuelle = 1;
        _sportRechercherExercices();
    });

    document.getElementById('sport-catalogue-prev').addEventListener('click', () => {
        if (_sportCatalogueOffset >= SPORT_CATALOGUE_LIMIT) {
            _sportCatalogueOffset -= SPORT_CATALOGUE_LIMIT;
            _sportCataloguePageActuelle -= 1;
            _sportRechercherExercices();
        }
    });

    document.getElementById('sport-catalogue-next').addEventListener('click', () => {
        _sportCatalogueOffset += SPORT_CATALOGUE_LIMIT;
        _sportCataloguePageActuelle += 1;
        _sportRechercherExercices();
    });

    _sportChargerFiltresWger();
    _sportRechercherExercices();
}

// ── Charge les listes de catégories et d'équipements (une seule fois) ──
async function _sportChargerFiltresWger() {
    try {
        const [rCat, rEqu] = await Promise.all([
            fetch('/api/sport/wger/categories', { headers: _sportAuthHeaders() }),
            fetch('/api/sport/wger/equipment',  { headers: _sportAuthHeaders() })
        ]);
        const dCat = await rCat.json();
        const dEqu = await rEqu.json();

        if (dCat.success) {
            const selCat = document.getElementById('sport-catalogue-filtre-categorie');
            dCat.categories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                selCat.appendChild(opt);
            });
        }

        if (dEqu.success) {
            const selEqu = document.getElementById('sport-catalogue-filtre-equipement');
            dEqu.equipment.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = e.name;
                selEqu.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('[SPORT] chargerFiltresWger :', err.message);
    }
}

// ── Recherche les exercices selon les filtres/texte/pagination actuels ──
async function _sportRechercherExercices() {
    const zone = document.getElementById('sport-catalogue-resultats');
    if (!zone) return;

    const search    = document.getElementById('sport-catalogue-search')?.value.trim() || '';
    const categorie = document.getElementById('sport-catalogue-filtre-categorie')?.value || '';
    const equipement= document.getElementById('sport-catalogue-filtre-equipement')?.value || '';

    zone.innerHTML = `<p class="sport-catalogue-loading">Recherche en cours…</p>`;

    try {
        const params = new URLSearchParams({
            limit : String(SPORT_CATALOGUE_LIMIT),
            offset: String(_sportCatalogueOffset)
        });
        if (search)     params.set('search', search);
        if (categorie)  params.set('category', categorie);
        if (equipement) params.set('equipment', equipement);

        const r = await fetch(`/api/sport/wger/exercises?${params.toString()}`, {
            headers: _sportAuthHeaders()
        });
        const d = await r.json();

        if (!d.success) {
            zone.innerHTML = `<p class="sport-catalogue-loading">Erreur lors de la récupération des exercices.</p>`;
            return;
        }

        _sportRenderResultatsCatalogue(d.exercises, d.has_more);
    } catch (err) {
        console.error('[SPORT] rechercherExercices :', err.message);
        zone.innerHTML = `<p class="sport-catalogue-loading">Erreur de connexion au serveur.</p>`;
    }
}

// ── Affiche la grille de résultats + met à jour la pagination ──
// (basée sur has_more, un total exact de pages n'est pas disponible
// avec le filtrage agrégé côté backend)
function _sportRenderResultatsCatalogue(exercices, hasMore) {
    const zone       = document.getElementById('sport-catalogue-resultats');
    const pagination = document.getElementById('sport-catalogue-pagination');
    if (!zone) return;

    if (!exercices.length) {
        zone.innerHTML = `<p class="sport-catalogue-loading">Aucun exercice trouvé.</p>`;
        if (pagination) pagination.style.display = 'none';
        return;
    }

    zone.innerHTML = `
        <div class="sport-catalogue-grid">
            ${exercices.map(ex => `
                <div class="sport-catalogue-exercise">
                    ${ex.image
                        ? `<img src="${ex.image}" alt="${ex.name}" class="sport-catalogue-exercise-img">`
                        : `<div class="sport-catalogue-exercise-noimg">${SPORT_ICONE_PAS_IMAGE}</div>`
                    }
                    <div class="sport-catalogue-exercise-name">${ex.name}</div>
                </div>
            `).join('')}
        </div>
    `;

    if (pagination) {
        pagination.style.display = 'flex';
        document.getElementById('sport-catalogue-page-info').textContent = `Page ${_sportCataloguePageActuelle}`;
        document.getElementById('sport-catalogue-prev').disabled = _sportCatalogueOffset === 0;
        document.getElementById('sport-catalogue-next').disabled = !hasMore;
    }
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
