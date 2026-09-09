// ============================================================
// public/js/social.js
// ============================================================

// ── Utilitaire auth ───────────────────────────────────────────
function _socialAuth() {
    const user = JSON.parse(localStorage.getItem('moadja_user'));
    return { user, token: user?.token };
}

// ── Labels triés alphabétiquement ────────────────────────────
const _SHARE_LABELS_LIST = [
    { type: 'agenda', label: 'Agenda'          },
    { type: 'cycle',  label: 'Cycle menstruel' },
    { type: 'taches', label: 'Tâches'          },
];

const _SHARE_LABELS = Object.fromEntries(
    _SHARE_LABELS_LIST.map(l => [l.type, l.label])
);

// ── Ordre d'affichage widget social
const _SHARE_ORDER = ['cycle', 'agenda', 'taches'];

// ── Lire le sexe de l'utilisateur courant via l'API ──────────
async function _getSexeCourant() {
    try {
        const { token } = _socialAuth();
        const r = await fetch('/api/profil', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        return d?.profil?.sexe ?? null;
    } catch {
        return null;
    }
}

// ── Modale conseil complet ────────────────────────────────────
function _ouvrirModaleConseil(texte) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;
        display:flex;align-items:center;justify-content:center;padding:20px`;
    overlay.innerHTML = `
        <div style="background:rgba(255,255,255,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.9);border-radius:24px;padding:24px;
                    max-width:340px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.15)">
            <div style="font-size:14px;font-weight:700;color:#7c3aed;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">
                Conseil du jour
            </div>
            <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px">
                ${texte}
            </p>
            <button class="btn-save" style="width:100%;">
                Fermer
            </button>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('button').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Formater une date YYYY-MM-DD en label lisible ─────────────
function _labelDate(dateStr) {
    const today  = new Date(); today.setHours(0,0,0,0);
    const demain = new Date(today); demain.setDate(today.getDate() + 1);
    const d      = new Date(dateStr + 'T00:00:00');
    if (d.getTime() === today.getTime())  return "Aujourd'hui";
    if (d.getTime() === demain.getTime()) return 'Demain';
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
             .toUpperCase();
}

// ============================================================
// WIDGET SOCIAL
// ============================================================

async function chargerWidgetSocial() {
    const el = document.getElementById('wc-social');
    if (!el) return;
    const { token } = _socialAuth();
    if (!token) return;

    try {
        const r = await fetch('/api/social/partages/recus', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        if (!d.success) throw new Error();

        const partages = d.partages || [];

        if (partages.length === 0) {
            el.innerHTML = `
                <div style="text-align:center;padding:16px 8px;color:#9ca3af">
                    <div style="font-size:28px;margin-bottom:8px">🤍</div>
                    <div style="font-size:13px;line-height:1.5">
                        Rien n'a encore été partagé avec toi.<br>
                        Quand quelqu'un partage quelque chose, tu le verras ici.
                    </div>
                </div>`;
            return;
        }

        const parOwner = {};
        partages.forEach(p => {
            if (!parOwner[p.owner_id]) {
                parOwner[p.owner_id] = {
                    owner_id : p.owner_id,
                    prenom   : p.prenom,
                    nom      : p.nom,
                    photo    : p.photo,
                    username : p.username,
                    types    : []
                };
            }
            parOwner[p.owner_id].types.push(p.resource_type);
        });

        const sections = await Promise.all(
            Object.values(parOwner).map(owner => _renderOwnerSection(owner, token))
        );
        el.innerHTML = sections.join('');

    } catch {
        el.innerHTML = '<p style="color:#9ca3af;font-size:13px;text-align:center">Erreur de chargement.</p>';
    }
}

// ── Section par owner ─────────────────────────────────────────
async function _renderOwnerSection(owner, token) {
    const nom    = [owner.prenom, owner.nom].filter(Boolean).join(' ') || owner.username;
    const avatar = owner.photo
        ? `<img src="${owner.photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`
        : `<div style="width:32px;height:32px;border-radius:50%;background:rgba(167,139,250,0.85);backdrop-filter:blur(8px);
                       color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;
                       justify-content:center;flex-shrink:0">
               ${(owner.prenom?.[0] || owner.username[0]).toUpperCase()}
           </div>`;

    const typesTries = _SHARE_ORDER.filter(t => owner.types.includes(t));

    const blocs = await Promise.all(
        typesTries.map(type => _renderCategorieBloc(owner.owner_id, type, token))
    );

    const blocsAvecSeparateur = blocs.map((bloc, i) =>
        i === 0
            ? bloc
            : `<div style="border-top:1px solid rgba(167,139,250,0.2);margin-top:2px;padding-top:10px">${bloc}</div>`
    ).join('');

    return `
        <div style="margin-bottom:16px;background:rgba(255,255,255,0.4);border-radius:14px;
                    padding:12px 14px;border:1px solid rgba(255,255,255,0.6)">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                ${avatar}
                <div style="font-size:14px;font-weight:700;color:#1f2937">${nom}</div>
            </div>
            ${blocsAvecSeparateur}
        </div>`;
}

// ── Bloc par catégorie ────────────────────────────────────────
async function _renderCategorieBloc(ownerId, type, token) {
    try {
        switch (type) {
            case 'cycle'  : return await _renderBlocCycle(ownerId, token);
            case 'agenda' : return await _renderBlocAgenda(ownerId, token);
            case 'taches' : return await _renderBlocTaches(ownerId, token);
            default       : return '';
        }
    } catch { return ''; }
}

// ── Bloc cycle ────────────────────────────────────────────────
async function _renderBlocCycle(ownerId, token) {
    const r = await fetch(`/api/social/conseil/${ownerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await r.json();
    if (!d.success) return '';

    const ci = d.cycleInfo;

    const titre = `
        <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:6px">Suivi du cycle</div>`;

    let carteInfos = '';
    if (ci) {
        const lignes = [];

        if (ci.enRetard) {
            lignes.push(`
                <div style="background:rgba(255,247,237,0.8);border:1.5px solid rgba(245,158,11,0.5);border-radius:10px;
                            padding:10px 12px;margin-bottom:8px">
                    <div style="display:flex;align-items:center;gap:6px;font-size:13px;
                                font-weight:700;color:#92400e;margin-bottom:4px">
                        <span>⏳</span>
                        Règles en retard - ${ci.joursRetard} jour${ci.joursRetard > 1 ? 's' : ''}
                    </div>
                    <div style="font-size:12px;color:#b45309">
                        Attendues le ${ci.prochainDebut}. Elle n'a pas encore enregistré ses règles.
                    </div>
                </div>`);
        }

        if (!ci.enRetard) {
            lignes.push(`
                <div style="display:flex;align-items:center;justify-content:space-between;
                            margin-bottom:8px">
                    <span style="font-size:12px;font-weight:700;color:#7c3aed">${ci.phaseLabel}</span>
                    <span style="font-size:11px;color:#9ca3af">Jour ${ci.jourCycle} / ${ci.dureeCycle}</span>
                </div>`);
        }

        if (ci.enRegles && ci.finRegles) {
            lignes.push(`
                <div style="display:flex;justify-content:space-between;align-items:flex-start;
                            padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.05)">
                    <span style="font-size:12px;color:#6b7280;flex:1">Fin des règles estimée</span>
                    <span style="font-size:12px;font-weight:600;color:#ef4444;text-align:right">${ci.finRegles}</span>
                </div>`);
        }

        if (!ci.enRetard && ci.labelOvulation) {
            lignes.push(`
                <div style="display:flex;justify-content:space-between;align-items:flex-start;
                            padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.05)">
                    <span style="font-size:12px;color:#6b7280;flex:1">${ci.labelOvulation}</span>
                    <span style="font-size:12px;font-weight:600;color:#7c3aed;text-align:right">${ci.valeurOvulation}</span>
                </div>`);

            lignes.push(`
                <div style="display:flex;justify-content:space-between;align-items:flex-start;
                            padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.05)">
                    <span style="font-size:12px;color:#6b7280;flex:1;padding-right:8px">${ci.labelFenetre}</span>
                    <span style="font-size:12px;font-weight:600;color:#7c3aed;text-align:right;white-space:nowrap">${ci.valeurFenetre}</span>
                </div>`);
        }

        if (!ci.enRetard) {
            lignes.push(`
                <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0">
                    <span style="font-size:12px;color:#6b7280;flex:1">Prochaines règles</span>
                    <span style="font-size:12px;font-weight:600;color:#6b7280;text-align:right">
                        ${ci.prochainDebut}
                        ${ci.joursAvantRegles > 0
                            ? `<span style="font-size:11px;color:#9ca3af;margin-left:4px">(dans ${ci.joursAvantRegles}j)</span>`
                            : ''}
                    </span>
                </div>`);
        }

        if (!ci.enRetard) {
            if (ci.enFenetre) {
                lignes.push(`
                    <div style="margin-top:8px;padding:6px 10px;background:rgba(253,244,255,0.8);border-radius:8px;
                                font-size:12px;color:#7c3aed;font-weight:600;text-align:center">
                        🌸 Fenêtre fertile en cours
                    </div>`);
            }
            if (ci.estOvulation) {
                lignes.push(`
                    <div style="margin-top:8px;padding:6px 10px;background:rgba(253,244,255,0.8);border-radius:8px;
                                font-size:12px;color:#7c3aed;font-weight:600;text-align:center">
                        🌟 Jour d'ovulation
                    </div>`);
            }
        }

        carteInfos = `
            <div style="background:rgba(255,255,255,0.6);border-radius:10px;padding:10px 12px;
                        border:1px solid rgba(255,255,255,0.8);margin-bottom:8px">
                ${lignes.join('')}
            </div>`;
    }

    if (!d.moodRempli) {
        return `
            <div style="margin-bottom:10px">
                ${titre}
                ${carteInfos}
                <div style="background:rgba(255,255,255,0.6);border-radius:10px;padding:10px 12px;
                            border:1px solid rgba(255,255,255,0.8);font-size:13px;color:#6b7280;margin-bottom:8px">
                    Elle n'a pas encore renseigné son humeur aujourd'hui.
                </div>
                <button class="btn-save" data-owner-id="${ownerId}" data-action="envoyer-coucou" style="width:100%; margin-top:4px;">
                    Envoyer un coucou 💕
                </button>
            </div>`;
    }

    const moodBadges = (d.moods || []).map(m =>
        `<span style="background:rgba(237,233,254,0.8);color:#7c3aed;border-radius:20px;
                      padding:3px 8px;font-size:11px;font-weight:600;border:1px solid rgba(167,139,250,0.2)">${m}</span>`
    ).join('');

    let conseilBloc = '';
    if (d.conseil) {
        const texteComplet = d.conseil;
        const SEUIL        = 220;
        const court        = texteComplet.length > SEUIL
            ? texteComplet.slice(0, SEUIL).trimEnd() + '…'
            : texteComplet;
        const avecLien     = texteComplet.length > SEUIL
            ? `${court} <span data-conseil-complet="${encodeURIComponent(texteComplet)}"
                              data-action="lire-conseil"
                              style="color:#7c3aed;font-weight:600;cursor:pointer;white-space:nowrap">
                   Lire la suite
               </span>`
            : court;

        conseilBloc = `
            <div style="margin-top:8px;padding:10px 12px;background:rgba(253,244,255,0.6);border-radius:10px;
                        border-left:3px solid #7c3aed;font-size:13px;color:#374151;line-height:1.6;
                        word-break:break-word;overflow-wrap:anywhere">
                ${avecLien}
            </div>`;
    }

    return `
        <div style="margin-bottom:10px">
            ${titre}
            ${carteInfos}
            <div style="background:rgba(255,255,255,0.6);border-radius:10px;padding:12px;border:1px solid rgba(255,255,255,0.8)">
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">
                    ${moodBadges}
                </div>
                ${conseilBloc}
            </div>
        </div>`;
}

// ── Délégation "Lire la suite" ────────────────────────────────
document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="lire-conseil"]');
    if (!btn) return;
    _ouvrirModaleConseil(decodeURIComponent(btn.dataset.conseilComplet));
});

// ── Couleurs et icônes catégories agenda ──────────────────────
const _CAT_COLORS = {
    'Travail'       : '#f4a261',
    'Mission'       : '#ce93d8',
    'Repos'         : '#90caf9',
    'Médical'       : '#f87171',
    'Sport'         : '#34d399',
    'Sortie'        : '#fbbf24',
    'Famille'       : '#f9a8d4',
    'Administratif' : '#94a3b8',
    'Voyage'        : '#60a5fa',
    'Autre'         : '#bcaaa4'
};
const _CAT_ICONS = {
    'Travail'       : '💼',
    'Mission'       : '🧳',
    'Repos'         : '😴',
    'Médical'       : '🩺',
    'Sport'         : '🏃',
    'Sortie'        : '🎉',
    'Famille'       : '👨‍👩‍👧',
    'Administratif' : '📋',
    'Voyage'        : '✈️',
    'Autre'         : '📌'
};

// ── Bloc Agenda ───────────────────────────────────────────────
async function _renderBlocAgenda(ownerId, token) {
    const r = await fetch(`/api/social/data/${ownerId}/agenda`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await r.json();

    const titre = `
        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:6px">Agenda</div>`;

    if (!d.success || !d.data.length) {
        return `
            <div style="margin-bottom:10px">
                ${titre}
                <div style="font-size:13px;color:#9ca3af">Rien à l'agenda sur les 5 prochains jours.</div>
            </div>`;
    }

    const evtsFiltres = d.data.filter(e =>
        e.categorie !== 'Repos' && e.sous_categorie !== 'Repos' && e.titre !== 'Repos'
    );

    if (!evtsFiltres.length) {
        return `
            <div style="margin-bottom:10px">
                ${titre}
                <div style="font-size:13px;color:#9ca3af">Rien de prévu sur les 5 prochains jours.</div>
            </div>`;
    }

    const parDate = {};
    evtsFiltres.forEach(e => {
        if (!parDate[e.date_debut]) parDate[e.date_debut] = [];
        parDate[e.date_debut].push(e);
    });

    const blocsDate = Object.entries(parDate).map(([date, evts]) => {
        const label = _labelDate(date);
        const items = evts.map(e => {
            const couleur  = _CAT_COLORS[e.categorie] || '#bcaaa4';
            const icone    = _CAT_ICONS[e.categorie]  || '📌';
            const hDebut   = e.heure_debut ? e.heure_debut.slice(0, 5) : null;
            const hFin     = e.heure_fin   ? e.heure_fin.slice(0, 5)   : null;
            const sousCat  = e.sous_categorie && e.sous_categorie !== e.categorie
                ? `${e.categorie} - ${e.sous_categorie}`
                : e.categorie;
            const infoLieu = e.praticien || e.lieu || null;

            return `
                <div style="padding:8px 10px;background:${couleur}15;border-left:3px solid ${couleur};
                            border-radius:8px;margin-bottom:4px;font-size:13px;backdrop-filter:blur(4px)">
                    <div style="font-weight:600;color:#1f2937">${icone} ${e.titre}</div>
                    <div style="color:#6b7280;font-size:12px">${sousCat}</div>
                    ${hDebut
                        ? `<div style="color:#6b7280;font-size:12px">⏰ ${hDebut}${hFin ? ' - ' + hFin : ''}</div>`
                        : ''}
                    ${infoLieu
                        ? `<div style="color:#9ca3af;font-size:11px">📍 ${infoLieu}</div>`
                        : ''}
                </div>`;
        }).join('');
                    return `
            <div style="margin-bottom:8px">
                <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                            letter-spacing:.4px;margin-bottom:4px">${label}</div>
                ${items}
            </div>`;
    }).join('');

    return `
        <div style="margin-bottom:10px">
            ${titre}
            ${blocsDate}
        </div>`;
}

// ── Bloc Tâches ───────────────────────────────────────────────
async function _renderBlocTaches(ownerId, token) {
    const r = await fetch(`/api/social/data/${ownerId}/taches`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await r.json();
    if (!d.success || !d.data.length) {
        return `
            <div style="margin-bottom:10px">
                <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                            letter-spacing:.5px;margin-bottom:6px">Tâches du jour</div>
                <div style="font-size:13px;color:#9ca3af">Aucune tâche aujourd'hui.</div>
            </div>`;
    }
    const items = d.data.map(t => `
        <div style="padding:8px 10px;background:rgba(255,255,255,0.6);border-radius:8px;
                    margin-bottom:4px;border:1px solid rgba(255,255,255,0.8);
                    display:flex;align-items:center;gap:8px;font-size:13px">
            <span style="color:${t.faite ? '#10b981' : '#9ca3af'};font-size:16px">
                ${t.faite ? '✅' : '⬜'}
            </span>
            <span style="color:#1f2937;${t.faite ? 'text-decoration:line-through;color:#9ca3af' : ''}">
                ${t.titre}
            </span>
            ${t.heure
                ? `<span style="color:#9ca3af;font-size:11px;margin-left:auto">${t.heure.slice(0,5)}</span>`
                : ''}
        </div>`).join('');
    return `
        <div style="margin-bottom:10px">
            <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                        letter-spacing:.5px;margin-bottom:6px">Tâches du jour</div>
            ${items}
        </div>`;
}

// ── Envoyer un coucou ─────────────────────────────────────────
document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action="envoyer-coucou"]');
    if (!btn) return;
    const ownerId   = btn.dataset.ownerId;
    const { token } = _socialAuth();
    btn.disabled    = true;
    btn.textContent = 'Envoi...';
    try {
        const r = await fetch(`/api/social/coucou/${ownerId}`, {
            method : 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        if (d.success) {
            btn.textContent      = 'Coucou envoyé 💕';
            btn.style.background = 'rgba(16, 185, 129, 0.85)'; // Vert emeraude glass
            setTimeout(() => {
                btn.disabled         = false;
                btn.textContent      = 'Envoyer un coucou 💕';
                btn.style.background = ''; // Restaure le style .btn-save (violet)
            }, 3000);
        } else {
            btn.disabled    = false;
            btn.textContent = 'Envoyer un coucou 💕';
        }
    } catch {
        btn.disabled    = false;
        btn.textContent = 'Envoyer un coucou 💕';
    }
});

// ============================================================
// GESTION DES PARTAGES — onglet Social du profil
// ============================================================

async function _socialOnglet(tab) {
    // Injection unique et indépendante du bloc "Mon Profil Public",
    // tout en haut de l'onglet Social — ne dépend pas du sous-onglet actif.
    if (typeof _injecterProfilPublicToggles === 'function') {
        await _injecterProfilPublicToggles();
    }

    // Bascule esthétique glassmorphism V3
    const btnMiens = document.getElementById('social-tab-miens');
    const btnNouv = document.getElementById('social-tab-nouveau');
    
    if (btnMiens && btnNouv) {
        if (tab === 'miens') {
            btnMiens.style.background = 'rgba(167,139,250,0.85)';
            btnMiens.style.color = '#fff';
            btnMiens.style.boxShadow = '0 8px 24px rgba(167,139,250,0.25)';
            btnMiens.style.backdropFilter = 'blur(8px)';
            
            btnNouv.style.background = 'transparent';
            btnNouv.style.color = '#6b7280';
            btnNouv.style.boxShadow = 'none';
            btnNouv.style.backdropFilter = 'none';
        } else {
            btnNouv.style.background = 'rgba(167,139,250,0.85)';
            btnNouv.style.color = '#fff';
            btnNouv.style.boxShadow = '0 8px 24px rgba(167,139,250,0.25)';
            btnNouv.style.backdropFilter = 'blur(8px)';
            
            btnMiens.style.background = 'transparent';
            btnMiens.style.color = '#6b7280';
            btnMiens.style.boxShadow = 'none';
            btnMiens.style.backdropFilter = 'none';
        }
    }

    if (tab === 'miens')   await _renderOngletMiens();
    if (tab === 'nouveau') await _renderOngletNouveau();
}

// ============================================================
// ONGLET — CE QUE JE PARTAGE
// ============================================================

async function _renderOngletMiens() {
    const { token } = _socialAuth();
    const container = document.getElementById('social-tab-content');
    if (!container) return;
    container.innerHTML = '<p style="color:#9ca3af;font-size:13px;text-align:center">Chargement…</p>';

    try {
        const [resMiens, sexe] = await Promise.all([
            fetch('/api/social/partages/miens', {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json()),
            _getSexeCourant()
        ]);

        if (!resMiens.success) throw new Error();

        const partages = resMiens.partages || [];

        if (partages.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:24px 8px;color:#9ca3af">
                    <div style="font-size:32px;margin-bottom:8px">🔒</div>
                    <div style="font-size:13px;line-height:1.6">
                        Tu ne partages encore rien avec personne.<br>
                        Utilise l'onglet <strong style="color:#7c3aed">Partager avec…</strong> pour commencer.
                    </div>
                </div>`;
            return;
        }

        const parViewer = {};
        partages.forEach(p => {
            if (!parViewer[p.viewer_id]) {
                parViewer[p.viewer_id] = {
                    viewer_id: p.viewer_id,
                    username : p.username,
                    prenom   : p.prenom,
                    nom      : p.nom,
                    photo    : p.photo,
                    partages : []
                };
            }
            parViewer[p.viewer_id].partages.push(p);
        });

        const typesDisponibles = sexe === 'homme'
            ? _SHARE_LABELS_LIST.filter(l => l.type !== 'cycle')
            : _SHARE_LABELS_LIST;

        const blocs = Object.values(parViewer)
            .map(v => _htmlBlocViewer(v, typesDisponibles))
            .join('');
        container.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">${blocs}</div>`;

    } catch {
        container.innerHTML = '<p style="color:#ef4444;font-size:13px;text-align:center">Erreur de chargement.</p>';
    }
}

// ── Bloc viewer ───────────────────────────────────────────────
function _htmlBlocViewer(v, typesDisponibles) {
    const nom    = [v.prenom, v.nom].filter(Boolean).join(' ') || v.username;
    const avatar = v.photo
        ? `<img src="${v.photo}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`
        : `<div style="width:34px;height:34px;border-radius:50%;background:rgba(167,139,250,0.85);
                       color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;
                       justify-content:center;flex-shrink:0">
               ${(v.prenom?.[0] || v.username[0]).toUpperCase()}
           </div>`;

        const lignes = typesDisponibles.map(l => {
        const partage = v.partages.find(p => p.resource_type === l.type);
        const existe  = !!partage;
        const actif   = partage?.active ?? false;
        const shareId = partage?.id ?? '';

        return `
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:8px 10px;background:rgba(255,255,255,0.6);border-radius:8px;
                    border:1px solid rgba(255,255,255,0.8);margin-bottom:4px;min-height:40px">
            <span style="font-size:13px;color:#374151;flex:1">${_SHARE_LABELS[l.type]}</span>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                <label style="position:relative;display:inline-flex;align-items:center;
                              width:38px;height:22px;flex-shrink:0;cursor:pointer">
                    <input type="checkbox" ${actif ? 'checked' : ''}
                        data-share-id="${shareId}"
                        data-viewer-id="${v.viewer_id}"
                        data-resource-type="${l.type}"
                        data-existe="${existe}"
                        data-action="toggle-partage"
                        style="opacity:0;width:0;height:0;position:absolute">
                    <span style="position:absolute;inset:0;border-radius:22px;cursor:pointer;
                                 background:${actif ? '#7c3aed' : '#d1d5db'};transition:background .2s">
                        <span style="position:absolute;top:3px;left:${actif ? '19px' : '3px'};
                                     width:16px;height:16px;border-radius:50%;background:#fff;
                                     transition:left .2s;display:block"></span>
                    </span>
                </label>
                <div style="width:80px;display:flex;justify-content:flex-end">
                    ${existe
                        ? `<button class="btn-delete" data-action="supprimer-partage"
                                   data-del-id="${shareId}" style="width:auto; padding:4px 8px; font-size:11px;">
                               Supprimer
                           </button>`
                        : ''
                    }
                </div>
            </div>
        </div>`;
    }).join('');

    return `
        <div style="background:rgba(255,255,255,0.3);border-radius:12px;padding:12px 14px;border:1px solid rgba(255,255,255,0.5)">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                ${avatar}
                <div style="font-size:14px;font-weight:700;color:#1f2937">${nom}</div>
            </div>
            ${lignes}
        </div>`;
}

// ── Délégation toggle ─────────────────────────────────────────
document.addEventListener('change', async e => {
    const cb = e.target.closest('[data-action="toggle-partage"]');
    if (!cb) return;
    const id           = cb.dataset.shareId;
    const active       = cb.checked;
    const existe       = cb.dataset.existe === 'true';
    const viewerId     = cb.dataset.viewerId;
    const resourceType = cb.dataset.resourceType;
    const { token }    = _socialAuth();
    const track        = cb.nextElementSibling;
    const thumb        = track?.querySelector('span');
    if (track) track.style.background = active ? '#7c3aed' : '#d1d5db';
    if (thumb) thumb.style.left       = active ? '19px'   : '3px';

    try {
        if (!existe) {
            await fetch('/api/social/partages', {
                method : 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body   : JSON.stringify({ viewer_id: parseInt(viewerId), resource_type: resourceType })
            });
            await _renderOngletMiens();
        } else {
            await fetch(`/api/social/partages/${id}`, {
                method : 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body   : JSON.stringify({ active })
            });
        }
    } catch {
        cb.checked = !active;
        if (track) track.style.background = !active ? '#7c3aed' : '#d1d5db';
        if (thumb) thumb.style.left       = !active ? '19px'    : '3px';
    }
});

// ── Délégation suppression ────────────────────────────────────
document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="supprimer-partage"]');
    if (!btn) return;
    _supprimerPartage(btn.dataset.delId);
});

// ── Confirmation suppression ──────────────────────────────────
function _supprimerPartage(id) {
    const overlay = document.createElement('div');
    overlay.id    = 'social-confirm-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;
        display:flex;align-items:center;justify-content:center;padding:20px`;
    overlay.innerHTML = `
        <div style="background:rgba(255,255,255,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.9);border-radius:24px;padding:24px;
                    max-width:320px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.15)">
            <div style="font-size:15px;font-weight:700;color:#1f2937;margin-bottom:8px">
                Supprimer ce partage ?
            </div>
            <p style="font-size:13px;color:#6b7280;line-height:1.5;margin-bottom:20px">
                La personne ne pourra plus voir ce contenu.
            </p>
            <div style="display:flex;gap:10px">
                <button class="btn-delete" data-action="confirmer-supprimer" data-id="${id}" style="flex:1;">
                    Supprimer
                </button>
                <button class="btn-cancel" data-action="annuler-supprimer" style="flex:1;">
                    Annuler
                </button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('[data-action="confirmer-supprimer"]').addEventListener('click', async () => {
        const { token } = _socialAuth();
        overlay.remove();
        try {
            await fetch(`/api/social/partages/${id}`, {
                method : 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch { /* silencieux */ }
        await _renderOngletMiens();
    });

    overlay.querySelector('[data-action="annuler-supprimer"]').addEventListener('click', () => {
        overlay.remove();
    });
}

// ============================================================
// ONGLET — PARTAGER AVEC QUELQU'UN
// ============================================================

async function _renderOngletNouveau() {
    const container = document.getElementById('social-tab-content');
    if (!container) return;
    container.innerHTML = `
        <div style="margin-bottom:14px">
            <input id="social-search-input"
                type="text"
                placeholder="Rechercher par nom d'utilisateur…"
                style="width:100%;box-sizing:border-box;padding:10px 12px;
                       border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;
                       outline:none;background:rgba(255,255,255,0.8);color:#1f2937">
            <div id="social-search-results" style="margin-top:8px"></div>
        </div>
        <div id="social-nouveau-form" style="display:none">
            <div style="background:rgba(255,255,255,0.4);border-radius:12px;padding:14px;border:1px solid rgba(255,255,255,0.6)">
                <div id="social-user-selectionne" style="margin-bottom:14px"></div>
                <div style="font-size:12px;font-weight:700;color:#6b7280;
                            text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
                    Que souhaites-tu partager ?
                </div>
                <div id="social-types-list" style="display:flex;flex-direction:column;gap:8px"></div>
                <div id="social-share-msg"
                    style="font-size:12px;min-height:16px;margin-top:10px;text-align:center"></div>
                <button class="btn-save" data-action="envoyer-partages" style="width:100%;margin-top:14px;">
                    Partager
                </button>
            </div>
        </div>`;

    let _timer = null;
    document.getElementById('social-search-input').addEventListener('input', e => {
        clearTimeout(_timer);
        const q = e.target.value.trim();
        if (q.length < 2) {
            document.getElementById('social-search-results').innerHTML = '';
            return;
        }
        _timer = setTimeout(() => _socialRechercherUser(q), 350);
    });

    document.querySelector('[data-action="envoyer-partages"]')
        .addEventListener('click', _envoyerPartages);
}

// ── Recherche utilisateur ─────────────────────────────────────
async function _socialRechercherUser(q) {
    const results = document.getElementById('social-search-results');
    if (!results) return;
    const { token } = _socialAuth();
    try {
        const r = await fetch(`/api/social/users/search?q=${encodeURIComponent(q)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        if (!d.success) return;

        if (!d.users.length) {
            results.innerHTML = '<div style="font-size:13px;color:#9ca3af;padding:8px 4px">Aucun utilisateur trouvé.</div>';
            return;
        }

        results.innerHTML = d.users.map(u => {
            const nom    = [u.prenom, u.nom].filter(Boolean).join(' ') || u.username;
            const avatar = u.photo
                ? `<img src="${u.photo}" style="width:30px;height:30px;border-radius:50%;object-fit:cover" alt="">`
                : `<div style="width:30px;height:30px;border-radius:50%;background:rgba(167,139,250,0.85);
                               color:#fff;font-size:12px;font-weight:700;display:flex;
                               align-items:center;justify-content:center">
                       ${(u.prenom?.[0] || u.username[0]).toUpperCase()}
                   </div>`;
            return `
                <div data-action="select-user"
                     data-user-id="${u.id}"
                     data-username="${u.username}"
                     data-prenom="${u.prenom || ''}"
                     data-nom="${u.nom || ''}"
                     data-photo="${u.photo || ''}"
                     style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                            background:rgba(255,255,255,0.7);border-radius:10px;border:1px solid rgba(255,255,255,0.9);
                            margin-bottom:6px;cursor:pointer">
                    ${avatar}
                    <div>
                        <div style="font-size:13px;font-weight:600;color:#1f2937">${nom}</div>
                        <div style="font-size:11px;color:#9ca3af">@${u.username}</div>
                    </div>
                </div>`;
        }).join('');

        results.querySelectorAll('[data-action="select-user"]').forEach(el => {
            el.addEventListener('click', () => _socialSelectionnerUser(el));
        });

    } catch { /* silencieux */ }
}

// ── Sélectionner un utilisateur ───────────────────────────────
async function _socialSelectionnerUser(el) {
    const userId    = el.dataset.userId;
    const username  = el.dataset.username;
    const prenom    = el.dataset.prenom;
    const nom       = el.dataset.nom;
    const photo     = el.dataset.photo;
    const { token } = _socialAuth();

    document.getElementById('social-search-input').value       = '';
    document.getElementById('social-search-results').innerHTML = '';

    const form = document.getElementById('social-nouveau-form');
    form.style.display    = 'block';
    form.dataset.viewerId = userId;

    const nomAffiche = [prenom, nom].filter(Boolean).join(' ') || username;
    const avatar     = photo
        ? `<img src="${photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`
        : `<div style="width:36px;height:36px;border-radius:50%;background:rgba(167,139,250,0.85);
                       color:#fff;font-size:14px;font-weight:700;display:flex;
                       align-items:center;justify-content:center;flex-shrink:0">
               ${(prenom?.[0] || username[0]).toUpperCase()}
           </div>`;

    document.getElementById('social-user-selectionne').innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.7);
                    border-radius:10px;padding:10px 12px;border:1px solid rgba(255,255,255,0.9)">
            ${avatar}
            <div>
                <div style="font-size:14px;font-weight:700;color:#1f2937">${nomAffiche}</div>
                <div style"font-size:12px;color:#9ca3af">@${username}</div>
            </div>
            <button data-action="annuler-selection"
                style="margin-left:auto;background:none;border:none;
                       color:#9ca3af;font-size:18px;cursor:pointer;line-height:1">×</button>
        </div>`;

    document.querySelector('[data-action="annuler-selection"]')
        .addEventListener('click', _socialAnnulerSelection);

    document.getElementById('social-share-msg').textContent = '';

    let dejaPartages = [];
    try {
        const r = await fetch('/api/social/partages/miens', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        if (d.success) {
            dejaPartages = d.partages
                .filter(p => String(p.viewer_id) === String(userId) && p.active)
                .map(p => p.resource_type);
        }
    } catch { /* silencieux */ }

    const sexe = await _getSexeCourant();
    const typesDisponibles = sexe === 'homme'
        ? _SHARE_LABELS_LIST.filter(l => l.type !== 'cycle')
        : _SHARE_LABELS_LIST;

    document.getElementById('social-types-list').innerHTML = typesDisponibles.map(l => `
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;
                      background:rgba(255,255,255,0.7);border-radius:8px;padding:10px 12px;
                      border:1px solid ${dejaPartages.includes(l.type) ? 'rgba(167,139,250,0.8)' : 'rgba(255,255,255,0.9)'}">
            <input type="checkbox"
                   value="${l.type}"
                   id="share-type-${l.type}"
                   ${dejaPartages.includes(l.type) ? 'checked' : ''}
                   style="width:16px;height:16px;accent-color:#7c3aed;cursor:pointer;flex-shrink:0;margin:0">
            <span style="font-size:13px;color:#374151;flex:1">${l.label}</span>
            ${dejaPartages.includes(l.type)
                ? '<span style="font-size:11px;color:#7c3aed;font-weight:600">Déjà partagé</span>'
                : ''}
        </label>`).join('');
}

// ── Annuler la sélection ──────────────────────────────────────
function _socialAnnulerSelection() {
    const form = document.getElementById('social-nouveau-form');
    if (form) { form.style.display = 'none'; form.dataset.viewerId = ''; }
    const sel = document.getElementById('social-user-selectionne');
    if (sel) sel.innerHTML = '';
    const liste = document.getElementById('social-types-list');
    if (liste) liste.innerHTML = '';
    const msg = document.getElementById('social-share-msg');
    if (msg) msg.textContent = '';
}

// ── Envoyer les partages cochés ───────────────────────────────
async function _envoyerPartages() {
    const { token } = _socialAuth();
    const form      = document.getElementById('social-nouveau-form');
    const viewerId  = form?.dataset.viewerId;
    const msg       = document.getElementById('social-share-msg');
    if (!viewerId) return;

    const types = _SHARE_LABELS_LIST
        .map(l => l.type)
        .filter(t => document.getElementById(`share-type-${t}`)?.checked);

    if (types.length === 0) {
        msg.textContent = 'Sélectionne au moins un type de contenu.';
        msg.style.color = '#ef4444';
        return;
    }

    msg.textContent = 'Envoi en cours…';
    msg.style.color = '#9ca3af';

    const resultats = await Promise.all(types.map(async type => {
        try {
            const r = await fetch('/api/social/partages', {
                method : 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type' : 'application/json'
                },
                body: JSON.stringify({ viewer_id: parseInt(viewerId), resource_type: type })
            });
            const d = await r.json();
            return { type, success: d.success, message: d.message };
        } catch {
            return { type, success: false, message: 'Erreur réseau.' };
        }
    }));

    const echecs = resultats.filter(r => !r.success);
    if (echecs.length === 0) {
        msg.textContent = '✅ Partages mis à jour !';
        msg.style.color = '#10b981';
        setTimeout(async () => {
            await _renderOngletNouveau();
            chargerWidgetSocial();
        }, 1200);
    } else {
        msg.textContent = echecs.map(e => `${_SHARE_LABELS[e.type]} : ${e.message}`).join(' · ');
        msg.style.color = '#ef4444';
    }
}

// ============================================================
// CLOCHE — NOTIFICATIONS
// ============================================================

let _notifsData        = [];
let _notifsTab         = 'tout';
let _notifsOffset      = 0;
const _NOTIFS_PAR_PAGE = 6;
let _panelNotifOuvert  = false;

const _NOTIF_ICONES = {
    like            : { icone: '❤️',  texte: 'a aimé ta publication'                },
    comment         : { icone: '💬',  texte: 'a commenté ta publication'             },
    follow          : { icone: '👤',  texte: 'a commencé à te suivre'               },
    coucou          : { icone: '💕',  texte: 't\'a envoyé un coucou'                },
    share_request   : { icone: '🤝',  texte: 'a partagé des données avec toi'       },
    mention_post    : { icone: '🏷️', texte: 't\'a mentionné(e) dans un post'       },
    mention_comment : { icone: '🏷️', texte: 't\'a mentionné(e) dans un commentaire'},
};

function _tempsEcoule(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min  = Math.floor(diff / 60000);
    const h    = Math.floor(diff / 3600000);
    const j    = Math.floor(diff / 86400000);
    if (min < 1)  return 'À l\'instant';
    if (min < 60) return `${min} min`;
    if (h < 24)   return `${h} h`;
    if (j < 7)    return `${j} j`;
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function _estAujourdhui(dateStr) {
    const d     = new Date(dateStr);
    const today = new Date();
    return d.getDate()     === today.getDate()
        && d.getMonth()    === today.getMonth()
        && d.getFullYear() === today.getFullYear();
}

async function chargerBadgeNotifs() {
    const { token } = _socialAuth();
    if (!token) return;
    try {
        const r = await fetch('/api/social/notifications/count', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        if (d.success && d.count > 0) {
            badge.textContent   = d.count > 99 ? '99+' : d.count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch { /* silencieux */ }
}

function _fermerTousPanneaux() {
    const panelNotifs = document.getElementById('panel-notifs');
    const userMenu    = document.getElementById('user-menu');
    if (panelNotifs) panelNotifs.style.display = 'none';
    if (userMenu)    userMenu.style.display    = 'none';
    _panelNotifOuvert = false;
}

async function togglePanelNotifs(e) {
    e.stopPropagation();
    const panel = document.getElementById('panel-notifs');
    if (!panel) return;
    const etaitOuvert = _panelNotifOuvert;
    _fermerTousPanneaux();
    if (!etaitOuvert) {
        panel.style.display = 'flex';
        _panelNotifOuvert   = true;
        _notifsOffset       = 0;
        await _chargerNotifs();
    }
}

document.addEventListener('click', e => {
    const panel = document.getElementById('panel-notifs');
    const btn   = document.getElementById('btn-cloche');
    if (!panel || !btn) return;
    if (_panelNotifOuvert && !panel.contains(e.target) && e.target !== btn) {
        panel.style.display = 'none';
        _panelNotifOuvert   = false;
    }
});

async function _chargerNotifs() {
    const { token } = _socialAuth();
    const liste     = document.getElementById('notif-liste');
    if (!liste) return;

    liste.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:20px;font-size:13px">Chargement…</p>';

    try {
        const r = await fetch('/api/social/notifications', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        if (!d.success) throw new Error();
        _notifsData = d.notifications || [];
        _renderNotifs();
    } catch {
        liste.innerHTML = '<p style="text-align:center;color:#ef4444;padding:20px;font-size:13px">Erreur de chargement.</p>';
    }
}

function _renderNotifs() {
    const liste = document.getElementById('notif-liste');
    if (!liste) return;

    const filtrees = _notifsTab === 'nonlu'
        ? _notifsData.filter(n => !n.seen)
        : _notifsData;

    const visibles = filtrees.slice(0, _notifsOffset + _NOTIFS_PAR_PAGE);

    const btnVoir = document.getElementById('btn-voir-plus-notifs');
    if (btnVoir) {
        btnVoir.style.display = filtrees.length > visibles.length ? 'block' : 'none';
    }

    if (visibles.length === 0) {
        liste.innerHTML = `
            <div style="text-align:center;padding:32px 16px;color:#9ca3af">
                <div style="font-size:32px;margin-bottom:8px">🔔</div>
                <div style="font-size:13px">Aucune notification</div>
            </div>`;
        return;
    }

    const aujourdhui = visibles.filter(n => _estAujourdhui(n.created_at));
    const plusTot    = visibles.filter(n => !_estAujourdhui(n.created_at));

    let html = '';

    if (aujourdhui.length) {
        html += `<div style="padding:8px 16px 4px;font-size:12px;font-weight:700;color:#6b7280;
                             text-transform:uppercase;letter-spacing:.5px">Aujourd'hui</div>`;
        html += aujourdhui.map(n => _htmlNotif(n)).join('');
    }

    if (plusTot.length) {
        html += `<div style="padding:8px 16px 4px">
                     <span style="font-size:12px;font-weight:700;color:#6b7280;
                                  text-transform:uppercase;letter-spacing:.5px">Plus tôt</span>
                 </div>`;
        html += plusTot.map(n => _htmlNotif(n)).join('');
    }

    liste.innerHTML = html;

    liste.querySelectorAll('[data-notif-id]').forEach(el => {
        el.addEventListener('click', async () => {
            const id        = el.dataset.notifId;
            const type      = el.dataset.notifType;
            const { token } = _socialAuth();
            try {
                await fetch(`/api/social/notifications/${id}/vu`, {
                    method : 'PATCH',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const notif = _notifsData.find(n => String(n.id) === String(id));
                if (notif) notif.seen = true;
                _renderNotifs();
                chargerBadgeNotifs();
            } catch { /* silencieux */ }

            // ── Redirection selon type ────────────────────────
            _fermerTousPanneaux();
            switch (type) {
                case 'coucou':
                    switchTab('bienetre');
                    break;
                case 'share_request':
                    switchTab('profil');
                    break;
                case 'like':
                case 'comment':
                case 'mention_post':
                case 'mention_comment':
                    switchTab('accueil');
                    if (typeof chargerFeed === 'function') {
                        chargerFeed().then(() => {
                            const refId = el.dataset.notifRef;
                            if (refId) {
                                const postEl = document.getElementById(`post-${refId}`);
                                if (postEl) setTimeout(() => postEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                            }
                        });
                    }
                    break;
            }
        });
    });
}

function _htmlNotif(n) {
    const infos   = _NOTIF_ICONES[n.type] || { icone: '🔔', texte: 'nouvelle notification' };
    const prenom  = n.sender_prenom || '';
    const nom     = n.sender_nom    || '';
    const nomComp = [prenom, nom].filter(Boolean).join(' ') || 'Quelqu\'un';
    const temps   = _tempsEcoule(n.created_at);
    const nonLu   = !n.seen;

    const avatar = n.sender_photo
        ? `<img src="${n.sender_photo}"
               style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`
        : `<div style="width:44px;height:44px;border-radius:50%;
                       background:rgba(167,139,250,0.85);
                       color:#fff;font-size:16px;font-weight:700;
                       display:flex;align-items:center;justify-content:center;flex-shrink:0">
               ${(prenom?.[0] || '?').toUpperCase()}
           </div>`;

    return `
        <div data-notif-id="${n.id}"
             data-notif-type="${n.type}"
             data-notif-ref="${n.ref_id || ''}"
             style="
            display:flex;align-items:center;gap:12px;
            padding:10px 16px;cursor:pointer;
            background:${nonLu ? 'rgba(167,139,250,0.08)' : 'transparent'};
            border-bottom:1px solid rgba(0,0,0,0.05);
            transition:background .15s;
        " onmouseover="this.style.background='${nonLu ? 'rgba(167,139,250,0.12)' : 'rgba(0,0,0,0.02)'}'"
           onmouseout="this.style.background='${nonLu ? 'rgba(167,139,250,0.08)' : 'transparent'}'">
            <div style="position:relative;flex-shrink:0">
                ${avatar}
                <div style="position:absolute;bottom:-2px;right:-2px;
                            width:20px;height:20px;border-radius:50%;
                            background:#fff;border:2px solid #fff;
                            display:flex;align-items:center;justify-content:center;
                            font-size:11px;line-height:1;
                            box-shadow:0 1px 4px rgba(0,0,0,.15)">
                    ${infos.icone}
                </div>
            </div>
            <div style="flex:1;min-width:0">
                <div style="font-size:13px;color:#1f2937;line-height:1.4">
                    <span style="font-weight:700">${nomComp}</span>
                    <span style="font-weight:400"> ${infos.texte}</span>
                </div>
                <div style="font-size:11px;color:${nonLu ? '#7c3aed' : '#9ca3af'};
                            margin-top:3px;font-weight:${nonLu ? '600' : '400'}">
                    ${temps}
                </div>
            </div>
            ${nonLu
                ? `<div style="width:10px;height:10px;border-radius:50%;
                               background:#7c3aed;flex-shrink:0"></div>`
                : ''}
        </div>`;
}

function switchNotifTab(tab) {
    _notifsTab    = tab;
    _notifsOffset = 0;

    const btnTout  = document.getElementById('notif-tab-tout');
    const btnNonlu = document.getElementById('notif-tab-nonlu');

    if (btnTout) {
        btnTout.style.color             = tab === 'tout'  ? '#7c3aed' : '#9ca3af';
        btnTout.style.borderBottomColor = tab === 'tout'  ? '#7c3aed' : 'transparent';
        btnTout.style.fontWeight        = tab === 'tout'  ? '700'     : '600';
    }
    if (btnNonlu) {
        btnNonlu.style.color             = tab === 'nonlu' ? '#7c3aed' : '#9ca3af';
        btnNonlu.style.borderBottomColor = tab === 'nonlu' ? '#7c3aed' : 'transparent';
        btnNonlu.style.fontWeight        = tab === 'nonlu' ? '700'     : '600';
    }

    _renderNotifs();
}

function voirPlusNotifs() {
    _notifsOffset += _NOTIFS_PAR_PAGE;
    _renderNotifs();
}

async function toutMarquerVu() {
    const { token } = _socialAuth();
    try {
        await fetch('/api/social/notifications/tout-vu', {
            method : 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        _notifsData.forEach(n => n.seen = true);
        _renderNotifs();
        chargerBadgeNotifs();
    } catch { /* silencieux */ }
}

setInterval(chargerBadgeNotifs, 60000);

