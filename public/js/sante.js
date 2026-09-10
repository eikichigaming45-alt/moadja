// ============================================================
// public/js/sante.js
// Widget Santé — onglet Sport.
// Calculs locaux : IMC, BMR (Mifflin-St Jeor), TDEE, macros,
// kcal objectif. Affichage instantané depuis profilCache.
// Groq : 1 appel/semaine max — cache serveur (sante_plan_cache + sante_plan_date)
// Plan hebdomadaire : Aujourd'hui / Semaine / Liste de courses.
// Dépend de : app.js (getUser, profilCache)
// ============================================================

// ===================== CALCULS LOCAUX ========================

function _imc(poids, taille) {
    if (!poids || !taille) return null;
    return (poids / Math.pow(taille / 100, 2)).toFixed(1);
}

function _imcCategorie(imc) {
    if (!imc) return null;
    const v = parseFloat(imc);
    if (v < 18.5) return { label: 'Insuffisance pondérale', color: '#3b82f6' };
    if (v < 25)   return { label: 'Poids normal',           color: '#10b981' };
    if (v < 30)   return { label: 'Surpoids',               color: '#f59e0b' };
    return             { label: 'Obésité',                  color: '#ef4444' };
}

function _bmr(poids, taille, age, sexe) {
    if (!poids || !taille || !age || !sexe) return null;
    if (sexe === 'homme') return 10 * poids + 6.25 * taille - 5 * age + 5;
    return 10 * poids + 6.25 * taille - 5 * age - 161;
}

function _tdee(bmr, niveau_activite) {
    if (!bmr) return null;
    const coeffs = {
        sedentaire : 1.2,
        leger      : 1.375,
        modere     : 1.55,
        actif      : 1.725,
        tres_actif : 1.9
    };
    return Math.round(bmr * (coeffs[niveau_activite] || 1.2));
}

function _kcalObjectif(tdee, objectif_sante) {
    if (!tdee || !objectif_sante) return null;
    const deltas = {
        perte_moderee     : -300,
        perte_rapide      : -500,
        maintien          :    0,
        prise_masse       :  300,
        prise_masse_rapide:  500
    };
    const delta = deltas[objectif_sante];
    if (delta === undefined) return null;
    return tdee + delta;
}

function _macros(kcal, objectif_sante) {
    if (!kcal) return null;
    const ratios = {
        perte_moderee     : { p: 0.35, g: 0.40, l: 0.25 },
        perte_rapide      : { p: 0.40, g: 0.35, l: 0.25 },
        maintien          : { p: 0.30, g: 0.45, l: 0.25 },
        prise_masse       : { p: 0.30, g: 0.45, l: 0.25 },
        prise_masse_rapide: { p: 0.30, g: 0.45, l: 0.25 }
    };
    const r = ratios[objectif_sante] || ratios['maintien'];
    return {
        proteines: Math.round((kcal * r.p) / 4),
        glucides  : Math.round((kcal * r.g) / 4),
        lipides   : Math.round((kcal * r.l) / 9)
    };
}

function _age(date_naissance) {
    if (!date_naissance) return null;
    const n     = new Date(date_naissance);
    const today = new Date();
    let a       = today.getFullYear() - n.getFullYear();
    if (today < new Date(today.getFullYear(), n.getMonth(), n.getDate())) a--;
    return a;
}

// ===================== ÉTAT DU WIDGET (mémoire d'onglet) =====

let _santePlanActuel  = null;
let _santeOngletActif = 'jour';

// ===================== OUTILS DATES ==========================

function _dateISOAujourdhui() {
    return new Date().toISOString().split('T')[0];
}

function _formatDateCourt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function _trouverJourActuel(plan) {
    if (!plan?.jours?.length) return null;
    const today = _dateISOAujourdhui();
    return plan.jours.find(j => j.date === today) || plan.jours[0];
}

// ===================== RENDU WIDGET ==========================

async function chargerWidgetSante() {
    const el = document.getElementById('wc-sante');
    if (!el) return;

    const user = getUser();
    if (!user?.token) {
        el.innerHTML = '<p class="rdv-empty">Non connecté</p>';
        return;
    }

    // Utiliser profilCache si dispo, sinon fetch
    let p = profilCache;
    if (!p) {
        try {
            const r = await fetch('/api/profil', {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const d = await r.json();
            if (d.success && d.profil) { p = d.profil; profilCache = p; }
        } catch {}
    }

    if (!p) {
        el.innerHTML = `
            <div class="sante-alerte">
                ⚠️ Profil introuvable — complète ton profil pour activer le widget Santé.
                <br><button class="ta-banner-btn" style="margin-top:8px" onclick="ouvrirMonProfil()">Compléter le profil</button>
            </div>`;
        return;
    }

    // ── Calculs locaux ────────────────────────────────────────
    const age    = _age(p.date_naissance);
    const imc    = _imc(p.poids, p.taille);
    const imcCat = _imcCategorie(imc);
    const bmr    = _bmr(p.poids, p.taille, age, p.sexe);
    const tdee   = _tdee(bmr, p.niveau_activite);
    const kcal   = _kcalObjectif(tdee, p.objectif_sante);
    const macros = _macros(kcal, p.objectif_sante);

    const profilComplet = p.taille && p.poids && p.sexe && p.date_naissance && p.niveau_activite && p.objectif_sante;

    // ── Récupération / génération du plan hebdomadaire ────────
    let plan  = null;
    let erreurPlan = null;

    if (profilComplet) {
        try {
            const rc = await fetch('/api/sante/plan', {
                method  : 'POST',
                headers : { 'Authorization': `Bearer ${user.token}` }
            });
            const dc = await rc.json();
            if (dc.plan) {
                plan = dc.plan;
            } else {
                erreurPlan = dc.error || 'Erreur lors de la génération du plan.';
            }
        } catch {
            erreurPlan = 'Erreur réseau.';
        }
    }

    _santePlanActuel = plan;

    // ── HTML calculs (inchangé) ────────────────────────────────
    const htmlCalculs = `
        <div class="sante-calculs">
            <div class="sante-calcul-row">
                <div class="sante-calcul-bloc">
                    <div class="sante-calcul-label">IMC</div>
                    <div class="sante-calcul-val" style="color:${imcCat?.color || '#9ca3af'}">
                        ${imc || '—'}
                    </div>
                    <div class="sante-calcul-sub" style="color:${imcCat?.color || '#9ca3af'}">
                        ${imcCat?.label || 'Profil incomplet'}
                    </div>
                </div>
                <div class="sante-calcul-bloc">
                    <div class="sante-calcul-label">TDEE</div>
                    <div class="sante-calcul-val" style="color:#7c3aed">
                        ${tdee ? tdee + ' kcal' : '—'}
                    </div>
                    <div class="sante-calcul-sub">Maintien / jour</div>
                </div>
                <div class="sante-calcul-bloc">
                    <div class="sante-calcul-label">Objectif</div>
                    <div class="sante-calcul-val" style="color:#10b981">
                        ${kcal ? kcal + ' kcal' : '—'}
                    </div>
                    <div class="sante-calcul-sub">/ jour</div>
                </div>
            </div>
            ${macros ? `
            <div class="sante-macros">
                <div class="sante-macro-item">
                    <span class="sante-macro-label">Protéines</span>
                    <span class="sante-macro-val">${macros.proteines} g</span>
                </div>
                <div class="sante-macro-item">
                    <span class="sante-macro-label">Glucides</span>
                    <span class="sante-macro-val">${macros.glucides} g</span>
                </div>
                <div class="sante-macro-item">
                    <span class="sante-macro-label">Lipides</span>
                    <span class="sante-macro-val">${macros.lipides} g</span>
                </div>
            </div>` : ''}
        </div>
    `;

    // ── Conseil du jour — toujours visible, jamais replié ─────
    const jourActuel = plan ? _trouverJourActuel(plan) : null;
    const htmlConseil = jourActuel?.conseil_du_jour ? `
        <div class="sante-conseil-card">
            <div class="sante-conseil-icone">💡</div>
            <div class="sante-conseil-texte">
                <div class="sante-conseil-titre">Conseil du jour</div>
                <div class="sante-conseil-contenu">${jourActuel.conseil_du_jour}</div>
            </div>
        </div>
    ` : '';

    // ── Bloc plan (tabs) ou erreur ─────────────────────────────
    let htmlPlanZone = '';
    if (!profilComplet) {
        htmlPlanZone = `
        <div class="sante-alerte">
            ⚠️ Complète ton profil Santé pour activer tous les calculs et générer ton plan.
        </div>`;
    } else if (erreurPlan) {
        htmlPlanZone = `
        <div class="sante-error">❌ ${erreurPlan}</div>
        <button class="sante-btn-groq" onclick="chargerWidgetSante()">🔄 Réessayer</button>`;
    } else if (plan) {
        const semaineLabel = plan.jours?.length
            ? `Semaine du ${_formatDateCourt(plan.jours[0].date)} au ${_formatDateCourt(plan.jours[6]?.date || plan.jours[plan.jours.length-1].date)}`
            : '';
        htmlPlanZone = `
        <div class="sante-semaine-info">📅 ${semaineLabel} · ${plan.calories_cibles || kcal} kcal/j en moyenne</div>
        <div class="sante-tabs" id="sante-tabs">
            ${_renderTabButton('jour',    '📆', 'Aujourd\'hui')}
            ${_renderTabButton('semaine', '🗓️', 'Semaine')}
            ${_renderTabButton('courses', '🛒', 'Courses')}
        </div>
        <div id="sante-tab-content" class="sante-tab-content">
            ${_renderContenuOnglet(_santeOngletActif, plan)}
        </div>`;
    }

    el.innerHTML = `
        ${htmlCalculs}
        ${htmlConseil}
        ${htmlPlanZone}
    `;
}

// ===================== NAVIGATION ONGLETS ====================

function _renderTabButton(id, icone, label) {
    const actif = _santeOngletActif === id;
    return `
        <button class="sante-tab ${actif ? 'active' : ''}" onclick="switchSanteTab('${id}')">
            <span>${icone}</span> ${label}
        </button>`;
}

function switchSanteTab(id) {
    _santeOngletActif = id;
    document.querySelectorAll('#sante-tabs .sante-tab').forEach(btn => btn.classList.remove('active'));
    const idx = { jour: 0, semaine: 1, courses: 2 }[id];
    document.querySelectorAll('#sante-tabs .sante-tab')[idx]?.classList.add('active');

    const zone = document.getElementById('sante-tab-content');
    if (zone && _santePlanActuel) {
        zone.innerHTML = _renderContenuOnglet(id, _santePlanActuel);
    }
}

// ===================== RENDU CONTENU PAR ONGLET ===============

function _renderContenuOnglet(id, plan) {
    if (id === 'semaine') return _renderSemaine(plan);
    if (id === 'courses') return _renderCourses(plan);
    return _renderJour(plan);
}

// ── Vue "Aujourd'hui" ──────────────────────────────────────────
function _renderJour(plan) {
    const jour = _trouverJourActuel(plan);
    if (!jour) return '<div class="sante-empty">Aucun repas disponible pour aujourd\'hui.</div>';

    return `
        <div class="sante-plan">
            <div class="sante-plan-titre">🥗 ${jour.jour_label} ${_formatDateCourt(jour.date)}</div>
            <div class="sante-plan-section">🌅 Petit-déjeuner</div>
            <div class="sante-plan-contenu">${jour.repas?.petit_dejeuner || '—'}</div>
            <div class="sante-plan-section">🍎 Collation matin</div>
            <div class="sante-plan-contenu">${jour.repas?.collation_matin || '—'}</div>
            <div class="sante-plan-section">🍽️ Déjeuner</div>
            <div class="sante-plan-contenu">${jour.repas?.dejeuner || '—'}</div>
            <div class="sante-plan-section">🍊 Collation soir</div>
            <div class="sante-plan-contenu">${jour.repas?.collation_soir || '—'}</div>
            <div class="sante-plan-section">🌙 Dîner</div>
            <div class="sante-plan-contenu">${jour.repas?.diner || '—'}</div>
            ${jour.activites?.length ? `
            <div class="sante-plan-section">🏃 Activités recommandées</div>
            <div class="sante-plan-contenu">${jour.activites.join('<br>')}</div>
            ` : ''}
        </div>
    `;
}

// ── Vue "Semaine" (accordéon, un jour ouvert à la fois) ────────
function _renderSemaine(plan) {
    if (!plan?.jours?.length) return '<div class="sante-empty">Aucun plan hebdomadaire disponible.</div>';
    const today = _dateISOAujourdhui();

    return `
        <div class="sante-semaine-liste">
            ${plan.jours.map((j, i) => {
                const estAujourdhui = j.date === today;
                return `
                <div class="sante-jour-accordeon ${estAujourdhui ? 'sante-jour-actuel' : ''}">
                    <button class="sante-jour-header" onclick="_toggleJourSemaine(${i})">
                        <span class="sante-jour-nom">${j.jour_label} <span class="sante-jour-date">${_formatDateCourt(j.date)}</span></span>
                        ${estAujourdhui ? '<span class="sante-jour-badge">Aujourd\'hui</span>' : ''}
                        <span class="sante-jour-arrow" id="sante-jour-arrow-${i}">▾</span>
                    </button>
                    <div class="sante-jour-body" id="sante-jour-body-${i}" style="display:${estAujourdhui ? 'block' : 'none'}">
                        <div class="sante-plan-section">🌅 Petit-déjeuner</div>
                        <div class="sante-plan-contenu">${j.repas?.petit_dejeuner || '—'}</div>
                        <div class="sante-plan-section">🍎 Collation matin</div>
                        <div class="sante-plan-contenu">${j.repas?.collation_matin || '—'}</div>
                        <div class="sante-plan-section">🍽️ Déjeuner</div>
                        <div class="sante-plan-contenu">${j.repas?.dejeuner || '—'}</div>
                        <div class="sante-plan-section">🍊 Collation soir</div>
                        <div class="sante-plan-contenu">${j.repas?.collation_soir || '—'}</div>
                        <div class="sante-plan-section">🌙 Dîner</div>
                        <div class="sante-plan-contenu">${j.repas?.diner || '—'}</div>
                        ${j.activites?.length ? `
                        <div class="sante-plan-section">🏃 Activités</div>
                        <div class="sante-plan-contenu">${j.activites.join('<br>')}</div>` : ''}
                        ${j.conseil_du_jour ? `
                        <div class="sante-plan-section">💡 Conseil</div>
                        <div class="sante-plan-contenu">${j.conseil_du_jour}</div>` : ''}
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
}

function _toggleJourSemaine(i) {
    const body  = document.getElementById(`sante-jour-body-${i}`);
    const arrow = document.getElementById(`sante-jour-arrow-${i}`);
    if (!body) return;
    const ouvert = body.style.display === 'block';
    // Ferme tous les autres jours (accordéon = un seul ouvert à la fois)
    document.querySelectorAll('.sante-jour-body').forEach(b => b.style.display = 'none');
    document.querySelectorAll('.sante-jour-arrow').forEach(a => a.textContent = '▾');
    if (!ouvert) {
        body.style.display = 'block';
        if (arrow) arrow.textContent = '▴';
    }
}

// ── Vue "Liste de courses" (par catégorie) ─────────────────────
function _renderCourses(plan) {
    if (!plan?.liste_courses?.length) return '<div class="sante-empty">Aucune liste de courses disponible.</div>';

    const icones = {
        'fruits'    : '🥦',
        'protéines' : '🍗',
        'féculents' : '🌾',
        'laitiers'  : '🧀',
        'épicerie'  : '🛒'
    };
    const iconePourCategorie = (nom) => {
        const clef = Object.keys(icones).find(k => nom.toLowerCase().includes(k));
        return icones[clef] || '📦';
    };

    return `
        <div class="sante-courses-liste">
            ${plan.liste_courses.map(cat => `
                <div class="sante-courses-carte">
                    <div class="sante-courses-titre">${iconePourCategorie(cat.categorie)} ${cat.categorie}</div>
                    <ul class="sante-courses-items">
                        ${(cat.items || []).map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            `).join('')}
        </div>
    `;
}
