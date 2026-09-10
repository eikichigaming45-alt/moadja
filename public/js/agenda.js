// ============================================================
// public/js/agenda.js
// Widget agenda unifié — aperçu 3 jours + modal CRUD.
// Catégories, sous-catégories, employeurs mémorisés.
// ============================================================

const Agenda = (() => {

    const CAT_ICONS = {
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

    const CAT_COLORS = {
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

    const JOURS_FR   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const MOIS_FR    = ['Janvier','Février','Mars','Avril','Mai','Juin',
                        'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const MOIS_COURT = ['jan','fév','mar','avr','mai','juin',
                        'juil','août','sep','oct','nov','déc'];

    let _categories    = [];
    let _sousCats      = {};
    let _employeurs    = [];
    let _moisActuel    = new Date().getMonth();
    let _anneeActuelle = new Date().getFullYear();
    let _agendaMois    = [];

    function _auth() {
        const user = JSON.parse(localStorage.getItem('moadja_user'));
        return { user, token: user?.token || '' };
    }

    function _headers() {
        const { token } = _auth();
        return {
            'Content-Type' : 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    function _dateStr(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const j = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${j}`;
    }

    function _labelDate(dateStr) {
        const [y, m, j] = dateStr.split('-').map(Number);
        const d = new Date(y, m - 1, j);
        return `${JOURS_FR[d.getDay()]} ${j} ${MOIS_COURT[m - 1]}`;
    }

    function _labelDateLong(dateStr) {
        const [y, m, j] = dateStr.split('-').map(Number);
        const d     = new Date(y, m - 1, j);
        const label = d.toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        return label.charAt(0).toUpperCase() + label.slice(1);
    }

    function _formatHeure(h) {
        return h ? h.slice(0, 5) : null;
    }

    function _optionsRappel(selected = 0) {
        const opts = [
            { v: 0,    l: 'Pas de rappel' },
            { v: 15,   l: '15 min avant'  },
            { v: 30,   l: '30 min avant'  },
            { v: 60,   l: '1h avant'      },
            { v: 120,  l: '2h avant'      },
            { v: 1440, l: 'La veille'     }
        ];
        return opts.map(o =>
            `<option value="${o.v}" ${selected === o.v ? 'selected' : ''}>${o.l}</option>`
        ).join('');
    }

    function _trierAvecAutreEnDernier(arr) {
        const sansAutre = [...arr].filter(v => v !== 'Autre').sort((a, b) =>
            a.localeCompare(b, 'fr', { sensitivity: 'base' })
        );
        return arr.includes('Autre') ? [...sansAutre, 'Autre'] : sansAutre;
    }

    function _sousCatLabel(categorie, sous_categorie) {
        if (!sous_categorie || sous_categorie === categorie) return categorie;
        return `${categorie} - ${sous_categorie}`;
    }

    async function _chargerCategories() {
        try {
            const res  = await fetch('/api/agenda/categories', { headers: _headers() });
            const data = await res.json();
            if (data.success) {
                _categories = data.categories;
                _sousCats   = data.sous_categories;
            }
        } catch { /* silencieux */ }
    }

    async function _chargerEmployeurs() {
        try {
            const res  = await fetch('/api/agenda/employeurs', { headers: _headers() });
            const data = await res.json();
            if (data.success) _employeurs = data.employeurs;
        } catch { /* silencieux */ }
    }

    // ── Widget — aperçu 3 jours ───────────────────────────────

    async function charger() {
        const container = document.getElementById('wc-agenda');
        if (!container) return;
        const { token } = _auth();
        if (!token) { setTimeout(charger, 300); return; }

        try {
            const res  = await fetch('/api/agenda/widget', { headers: _headers() });
            const data = await res.json();
            if (!data.success) throw new Error();

            if (data.jours.length === 0) {
                container.innerHTML = `
                    <p style="color:#9ca3af;font-size:13px;text-align:center;padding:8px 0">
                        Aucun événement à venir.
                    </p>
                    <button onclick="Agenda.ouvrirModal()" class="btn-agenda-primary">
                        + Ajouter un événement
                    </button>`;
                return;
            }

            let html = '';
            data.jours.forEach(({ date, entrees }) => {
                const aujourd = _dateStr(new Date());
                const label   = date === aujourd ? "Aujourd'hui" : _labelDate(date);

                entrees.forEach((entree, idx) => {
                    const couleur  = CAT_COLORS[entree.categorie] || '#bcaaa4';
                    const icone    = CAT_ICONS[entree.categorie]  || '📌';
                    const hDebut   = _formatHeure(entree.heure_debut);
                    const hFin     = _formatHeure(entree.heure_fin);
                    const infoLieu = entree.praticien || entree.lieu || null;

                    html += `
                        <div onclick="Agenda.ouvrirJour('${date}');document.getElementById('overlay').classList.add('on')" style="
                            display:flex;align-items:center;gap:10px;
                            padding:8px 10px;margin-bottom:4px;
                            background:${couleur}22;
                            border-left:4px solid ${couleur};
                            border-radius:8px;cursor:pointer">
                            <span style="font-size:20px">${icone}</span>
                            <div style="flex:1;min-width:0">
                                ${idx === 0
                                    ? `<div style="font-size:11px;color:#888;font-weight:600;
                                                  text-transform:uppercase;letter-spacing:.5px">
                                           ${label}
                                       </div>`
                                    : ''}
                                <div style="font-size:14px;font-weight:700;color:#333;
                                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                                    ${entree.titre}
                                </div>
                                ${entree.sous_categorie && entree.sous_categorie !== entree.categorie
                                    ? `<div style="font-size:11px;color:#888">${entree.sous_categorie}</div>`
                                    : ''}
                                ${infoLieu
                                    ? `<div style="font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📍 ${infoLieu}</div>`
                                    : ''}
                                ${hDebut
                                    ? `<div style="font-size:12px;color:#666">⏰ ${hDebut}${hFin ? ' - ' + hFin : ''}</div>`
                                    : ''}
                            </div>
                        </div>`;
                });

                html += `<div style="margin-bottom:8px"></div>`;
            });

            container.innerHTML = html;
        } catch {
            container.innerHTML = `<p style="color:#ef4444;font-size:13px">Erreur de chargement.</p>`;
        }
    }

    // ── Modal — calendrier mensuel ────────────────────────────

    async function ouvrirModal() {
        _moisActuel    = new Date().getMonth();
        _anneeActuelle = new Date().getFullYear();
        document.getElementById('modal-title').textContent = 'Agenda';
        await _chargerCategories();
        await _chargerEmployeurs();
        await _afficherCalendrier();
    }

    async function _afficherCalendrier() {
        const body = document.getElementById('modal-body');
        body.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px">Chargement...</p>';

        try {
            const premierJour = `${_anneeActuelle}-${String(_moisActuel + 1).padStart(2, '0')}-01`;
            const dernierJour = new Date(_anneeActuelle, _moisActuel + 1, 0);
            const dernierStr  = _dateStr(dernierJour);
            const res  = await fetch(
                `/api/agenda?date_debut=${premierJour}&date_fin=${dernierStr}`,
                { headers: _headers() }
            );
            const data = await res.json();
            if (!data.success) throw new Error();
            _agendaMois = data.agenda;
        } catch {
            document.getElementById('modal-body').innerHTML =
                '<p style="color:#ef4444;text-align:center;padding:20px">Erreur de chargement.</p>';
            return;
        }

        const today    = new Date();
        const offset   = new Date(_anneeActuelle, _moisActuel, 1).getDay();
        const decalage = offset === 0 ? 6 : offset - 1;
        const nbJours  = new Date(_anneeActuelle, _moisActuel + 1, 0).getDate();

        const parJour = {};
        _agendaMois.forEach(e => {
            const d = e.date_debut;
            if (!parJour[d]) parJour[d] = [];
            parJour[d].push(e);
        });

        let cellules = '';
        for (let i = 0; i < decalage; i++) {
            cellules += `<div style="aspect-ratio:1;min-height:44px"></div>`;
        }

        for (let j = 1; j <= nbJours; j++) {
            const dateStr   = `${_anneeActuelle}-${String(_moisActuel + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
            const isToday   = j === today.getDate()
                           && _moisActuel === today.getMonth()
                           && _anneeActuelle === today.getFullYear();
            const entries   = parJour[dateStr] || [];
                        const horsRepos = entries.filter(e => e.categorie !== 'Repos');
            const e0        = horsRepos.length > 0 ? horsRepos[0] : entries[0];
            const couleur   = e0 ? (CAT_COLORS[e0.categorie] || '#bcaaa4') : null;
            const icone     = e0 ? (CAT_ICONS[e0.categorie]  || '📌')      : null;
            const plus      = entries.length > 1
                ? `<div style="font-size:9px;color:#666">+${entries.length - 1}</div>`
                : '';

            cellules += `
                <div onclick="Agenda.ouvrirJour('${dateStr}')" style="
                    aspect-ratio:1;min-height:44px;border-radius:10px;cursor:pointer;
                    display:flex;flex-direction:column;align-items:center;justify-content:center;
                    background:${couleur ? couleur + '33' : '#f9fafb'};
                    border:2px solid ${isToday ? 'rgb(167, 139, 250)' : (couleur ? couleur + '99' : '#e5e7eb')};
                    font-size:12px;font-weight:600;color:#333;transition:opacity .15s">
                    <div style="font-size:11px;font-weight:700;color:${isToday ? 'rgb(167, 139, 250)' : '#444'}">${j}</div>
                    ${icone ? `<div style="font-size:14px;line-height:1">${icone}</div>` : ''}
                    ${plus}
                </div>`;
        }

        document.getElementById('modal-title').textContent = 'Agenda';
        document.getElementById('modal-body').innerHTML = `
            <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                    <button onclick="Agenda._moisPrec()" style="background:none;border:none;font-size:22px;cursor:pointer;padding:4px 10px;border-radius:8px">‹</button>
                    <div style="font-weight:700;font-size:16px;color:#1f2937">
                        ${MOIS_FR[_moisActuel]} ${_anneeActuelle}
                    </div>
                    <button onclick="Agenda._moisSuiv()" style="background:none;border:none;font-size:22px;cursor:pointer;padding:4px 10px;border-radius:8px">›</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
                    ${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(j =>
                        `<div style="text-align:center;font-size:11px;font-weight:700;color:#9ca3af;padding:4px 0">${j}</div>`
                    ).join('')}
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:16px">
                    ${cellules}
                </div>
                <button onclick="Agenda.ouvrirFormulaire(null)" style="
                    width:100%;padding:13px;
                    background:rgba(167, 139, 250, 0.85);
                    color:white;border:none;border-radius:12px;
                    font-size:15px;font-weight:600;cursor:pointer;
                    box-shadow:0 4px 12px rgba(167, 139, 250, 0.25)">
                    + Ajouter un événement
                </button>
            </div>`;
    }

    async function _moisPrec() {
        _moisActuel--;
        if (_moisActuel < 0) { _moisActuel = 11; _anneeActuelle--; }
        await _afficherCalendrier();
    }

    async function _moisSuiv() {
        _moisActuel++;
        if (_moisActuel > 11) { _moisActuel = 0; _anneeActuelle++; }
        await _afficherCalendrier();
    }

    // ── Détail d'un jour ──────────────────────────────────────

    async function ouvrirJour(dateStr) {
        const body      = document.getElementById('modal-body');
        const dateLabel = _labelDateLong(dateStr);

        let entries = [];
        try {
            const res  = await fetch(
                `/api/agenda?date_debut=${dateStr}&date_fin=${dateStr}`,
                { headers: _headers() }
            );
            const data = await res.json();
            if (data.success) entries = data.agenda;
        } catch { /* silencieux */ }

        let html = `
            <div>
                <div style="font-size:16px;font-weight:700;margin-bottom:16px;color:#1f2937">
                    ${dateLabel}
                </div>`;

        if (entries.length === 0) {
            html += `<p style="color:#9ca3af;text-align:center;padding:20px">Aucun événement ce jour.</p>`;
        } else {
            entries.forEach(e => {
                const couleur  = CAT_COLORS[e.categorie] || '#bcaaa4';
                const icone    = CAT_ICONS[e.categorie]  || '📌';
                const hDebut   = _formatHeure(e.heure_debut);
                const hFin     = _formatHeure(e.heure_fin);
                const sousCat  = e.sous_categorie && e.sous_categorie !== e.categorie
                    ? `${e.categorie} - ${e.sous_categorie}`
                    : e.categorie;

                html += `
                    <div style="background:${couleur}22;border-left:4px solid ${couleur};
                                border-radius:10px;padding:12px 14px;margin-bottom:10px">
                        <div style="font-size:16px;font-weight:700;color:#1f2937">
                            ${icone} ${e.titre}
                        </div>
                        <div style="font-size:12px;color:#666;margin-top:2px">${sousCat}</div>
                        ${hDebut
                            ? `<div style="font-size:13px;color:#666;margin-top:4px">⏰ ${hDebut}${hFin ? ' - ' + hFin : ''}</div>`
                            : e.date_fin && e.date_fin !== e.date_debut
                                ? `<div style="font-size:13px;color:#666;margin-top:4px">📅 Du ${e.date_debut} au ${e.date_fin}</div>`
                                : ''}
                        ${e.praticien ? `<div style="font-size:12px;color:#999;margin-top:2px">🩺 ${e.praticien}</div>` : ''}
                        ${e.lieu      ? `<div style="font-size:12px;color:#999;margin-top:2px">📍 ${e.lieu}</div>`      : ''}
                        ${e.notes     ? `<div style="font-size:12px;color:#999;margin-top:4px">📝 ${e.notes}</div>`     : ''}
                        ${e.rappel_avant > 0
                            ? `<div style="font-size:12px;color:#999;margin-top:2px">🔔 Rappel ${e.rappel_avant >= 60 ? e.rappel_avant / 60 + 'h' : e.rappel_avant + ' min'} avant</div>`
                            : ''}
                        <div style="display:flex;gap:8px;margin-top:10px">
                            <button onclick="Agenda.ouvrirFormulaire(${e.id},'${dateStr}')" style="
                                flex:1;padding:8px;background:rgba(167, 139, 250, 0.85);color:white;
                                border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">
                                ✏️ Modifier
                            </button>
                            <button onclick="Agenda.supprimer(${e.id},'${dateStr}')" style="
                                flex:1;padding:8px;background:#fee2e2;color:#ef4444;
                                border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">
                                🗑️ Supprimer
                            </button>
                        </div>
                    </div>`;
            });
        }

                html += `
            <div style="display:flex;gap:8px;margin-top:12px">
                <button onclick="Agenda.ouvrirFormulaire(null,'${dateStr}')" style="
                    flex:1;padding:11px;
                    background:rgba(167, 139, 250, 0.85);
                    color:white;border:none;border-radius:10px;
                    cursor:pointer;font-size:14px;font-weight:600">
                    + Ajouter
                </button>
                <button onclick="Agenda._afficherCalendrier()" style="
                    padding:11px 16px;background:#f3f4f6;color:#374151;
                    border:none;border-radius:10px;cursor:pointer;
                    font-size:14px;font-weight:600">
                    Retour
                </button>
            </div>
            </div>`;

        document.getElementById('modal-body').innerHTML = html;
    }

    // ── Formulaire ajout / édition ────────────────────────────

    async function ouvrirFormulaire(id = null, dateDefaut = null) {
        const body = document.getElementById('modal-body');
        body.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px">Chargement...</p>';

        await _chargerCategories();
        await _chargerEmployeurs();

        let e = {};
        if (id) {
            try {
                const res  = await fetch(`/api/agenda/${id}`, { headers: _headers() });
                const data = await res.json();
                if (data.success) e = data.entree;
            } catch { e = {}; }
        }

        const catVal     = e.categorie     || 'Travail';
        const sousCatVal = e.sous_categorie || '';
        const dateDebVal = e.date_debut     || dateDefaut || '';
        const dateFinVal = e.date_fin       || '';
        const hDebutVal  = e.heure_debut    || '';
        const hFinVal    = e.heure_fin      || '';
        const rappelVal  = e.rappel_avant   || 0;
        const lieuVal    = e.lieu           || '';
        const praticienVal = e.praticien    || '';
        const notesVal   = e.notes          || '';

        const afficherEmployeur = ['Travail', 'Mission'].includes(catVal);
        const afficherMedecin   = catVal === 'Médical';

        const catsTriees  = _trierAvecAutreEnDernier(_categories);
        const catsOptions = catsTriees.map(c =>
            `<option value="${c}" ${catVal === c ? 'selected' : ''}>${CAT_ICONS[c] || ''} ${c}</option>`
        ).join('');

        const sousCatsTriees  = _trierAvecAutreEnDernier(_sousCats[catVal] || []);
        const sousCatsOptions = sousCatsTriees.map(s =>
            `<option value="${s}" ${sousCatVal === s ? 'selected' : ''}>${s}</option>`
        ).join('');

        const empOptions = _employeurs.map(emp =>
            `<option value="${emp.nom}" ${lieuVal === emp.nom ? 'selected' : ''}>${emp.nom}</option>`
        ).join('') + `<option value="__nouveau__">+ Saisir manuellement...</option>`;

        document.getElementById('modal-title').textContent = id ? 'Modifier' : 'Nouvel événement';
        body.innerHTML = `
            <div>
                <div style="margin-bottom:10px">
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Titre *</label>
                    <input type="text" id="ag-titre" value="${e.titre || ''}"
                        placeholder="Nom de l'événement"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                </div>

                <div style="margin-bottom:10px">
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Catégorie *</label>
                    <select id="ag-categorie" onchange="Agenda._onCatChange()"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;background:#fff">
                        ${catsOptions}
                    </select>
                </div>

                <div style="margin-bottom:10px">
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Sous-catégorie</label>
                    <select id="ag-sous-cat"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;background:#fff;margin-bottom:6px">
                        <option value="">-- Aucune --</option>
                        ${sousCatsOptions}
                    </select>
                    <input type="text" id="ag-sous-cat-nouveau"
                        placeholder="Ou saisir une nouvelle sous-catégorie..."
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                </div>

                <div id="ag-employeur-wrap" style="margin-bottom:10px;display:${afficherEmployeur ? 'block' : 'none'}">
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Employeur</label>
                    <select id="ag-employeur-select" onchange="Agenda._onEmployeurChange()"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;background:#fff;margin-bottom:6px">
                        <option value="">-- Aucun --</option>
                        ${empOptions}
                    </select>
                    <div id="ag-employeur-nouveau-wrap" style="display:none">
                        <input type="text" id="ag-employeur-nouveau"
                            placeholder="Nom de l'employeur"
                            style="width:100%;padding:10px 12px;border:1.5px solid rgb(167, 139, 250);border-radius:10px;font-size:14px;box-sizing:border-box;margin-bottom:6px">
                        <input type="text" id="ag-employeur-adresse"
                            placeholder="Adresse (optionnel)"
                            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;margin-bottom:6px">
                        <input type="text" id="ag-employeur-telephone"
                            placeholder="Téléphone (optionnel)"
                            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                    </div>
                </div>

                <div id="ag-medecin-wrap" style="margin-bottom:10px;display:${afficherMedecin ? 'block' : 'none'}">
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Praticien</label>
                    <input type="text" id="ag-praticien" value="${praticienVal}"
                        placeholder="Dr. Nom, cabinet..."
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                </div>

                <div style="margin-bottom:10px">
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Date de début *</label>
                    <input type="date" id="ag-date-debut" value="${dateDebVal}"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                </div>

                <div style="margin-bottom:10px">
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Date de fin</label>
                    <input type="date" id="ag-date-fin" value="${dateFinVal}"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                    <div>
                        <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Heure début</label>
                        <input type="time" id="ag-heure-debut" value="${hDebutVal}"
                            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                    </div>
                    <div>
                        <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Heure fin</label>
                        <input type="time" id="ag-heure-fin" value="${hFinVal}"
                            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                    </div>
                </div>

                <div style="margin-bottom:10px">
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Lieu / Adresse</label>
                    <input type="text" id="ag-lieu" value="${lieuVal}"
                        placeholder="Adresse, salle, endroit..."
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                </div>

                <div style="margin-bottom:10px">
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Notes</label>
                    <textarea id="ag-notes" rows="2"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;resize:none;font-family:inherit">${notesVal}</textarea>
                </div>

                <div style="margin-bottom:16px">
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Rappel</label>
                    <select id="ag-rappel"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;background:#fff">
                        ${_optionsRappel(rappelVal)}
                    </select>
                </div>

                <div id="ag-msg" style="text-align:center;font-size:13px;min-height:18px;margin-bottom:8px;color:#ef4444"></div>

                <div style="display:flex;gap:8px">
                    <button onclick="Agenda.sauvegarder(${id || 'null'},'${dateDefaut || ''}')" style="
                        flex:1;padding:13px;
                        background:rgba(167, 139, 250, 0.85);
                        color:white;border:none;border-radius:12px;
                        font-size:15px;font-weight:600;cursor:pointer">
                        💾 Sauvegarder
                    </button>
                    <button onclick="${dateDefaut ? `Agenda.ouvrirJour('${dateDefaut}')` : 'Agenda._afficherCalendrier()'}" style="
                        padding:13px 16px;background:#f3f4f6;color:#374151;
                        border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">
                        Retour
                    </button>
                </div>
            </div>`;
    }

    function _onCatChange() {
        const cat     = document.getElementById('ag-categorie')?.value;
        const sousCatEl = document.getElementById('ag-sous-cat');
        const empWrap   = document.getElementById('ag-employeur-wrap');
        const medWrap   = document.getElementById('ag-medecin-wrap');

        if (sousCatEl) {
            const triees = _trierAvecAutreEnDernier(_sousCats[cat] || []);
            sousCatEl.innerHTML = `<option value="">-- Aucune --</option>` +
                triees.map(s => `<option value="${s}">${s}</option>`).join('');
        }
        if (empWrap) empWrap.style.display = ['Travail', 'Mission'].includes(cat) ? 'block' : 'none';
        if (medWrap) medWrap.style.display = cat === 'Médical' ? 'block' : 'none';
    }

    function _onEmployeurChange() {
        const sel  = document.getElementById('ag-employeur-select');
        const wrap = document.getElementById('ag-employeur-nouveau-wrap');
        if (wrap) wrap.style.display = sel?.value === '__nouveau__' ? 'block' : 'none';
    }

    async function sauvegarder(id = null, dateRetour = '') {
        const msg = document.getElementById('ag-msg');

        const titre          = document.getElementById('ag-titre')?.value?.trim();
        const categorie      = document.getElementById('ag-categorie')?.value;
        const sousCatSelect  = document.getElementById('ag-sous-cat')?.value;
        const sousCatNouveau = document.getElementById('ag-sous-cat-nouveau')?.value?.trim();
        const sous_categorie = sousCatNouveau || sousCatSelect || null;
        const date_debut     = document.getElementById('ag-date-debut')?.value;
        const date_fin       = document.getElementById('ag-date-fin')?.value    || null;
        const heure_debut    = document.getElementById('ag-heure-debut')?.value || null;
        const heure_fin      = document.getElementById('ag-heure-fin')?.value   || null;
        const notes          = document.getElementById('ag-notes')?.value?.trim()     || null;
        const rappel_avant   = parseInt(document.getElementById('ag-rappel')?.value)  || 0;
        const praticien      = document.getElementById('ag-praticien')?.value?.trim() || null;
        const lieu           = document.getElementById('ag-lieu')?.value?.trim()      || null;

        const empSelect  = document.getElementById('ag-employeur-select');
        const empNouveau = document.getElementById('ag-employeur-nouveau');
        let employeurNom = null;
        if (['Travail', 'Mission'].includes(categorie)) {
            employeurNom = empSelect?.value === '__nouveau__'
                ? empNouveau?.value?.trim() || null
                : empSelect?.value || null;
        }

        if (!titre) {
            if (msg) msg.textContent = 'Le titre est obligatoire.'; return;
        }
        if (!date_debut) {
            if (msg) msg.textContent = 'La date de début est obligatoire.'; return;
        }

        const bodyData = {
            titre, categorie, sous_categorie,
            date_debut, date_fin,
            heure_debut, heure_fin,
            lieu : ['Travail', 'Mission'].includes(categorie) ? employeurNom : lieu,
            praticien : categorie === 'Médical' ? praticien : null,
            notes, rappel_avant
        };

        try {
            const url    = id ? `/api/agenda/${id}` : '/api/agenda';
            const method = id ? 'PUT' : 'POST';
            const res    = await fetch(url, {
                method,
                headers : _headers(),
                body    : JSON.stringify(bodyData)
            });
            const data = await res.json();
            if (!data.success) {
                if (msg) msg.textContent = data.message || 'Erreur lors de la sauvegarde.';
                return;
            }

            if (sousCatNouveau && categorie) {
                fetch('/api/agenda/categories', {
                    method  : 'POST',
                    headers : _headers(),
                    body    : JSON.stringify({ niveau: categorie, nom: sousCatNouveau })
                }).catch(() => {});
            }

            if (['Travail', 'Mission'].includes(categorie) && empSelect?.value === '__nouveau__') {
                const nomEmp = empNouveau?.value?.trim();
                const adr    = document.getElementById('ag-employeur-adresse')?.value?.trim()   || null;
                const tel    = document.getElementById('ag-employeur-telephone')?.value?.trim() || null;
                if (nomEmp) {
                    fetch('/api/agenda/employeurs', {
                        method  : 'POST',
                        headers : _headers(),
                        body    : JSON.stringify({ nom: nomEmp, adresse: adr, telephone: tel })
                    }).catch(() => {});
                }
            }

            charger();
            if (dateRetour) {
                await ouvrirJour(dateRetour);
            } else {
                await _afficherCalendrier();
            }
        } catch {
            if (msg) msg.textContent = 'Erreur lors de la sauvegarde.';
        }
    }

    async function supprimer(id, dateRetour) {
        document.getElementById('modal-title').textContent = 'Confirmation';
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#333;font-size:15px;margin-bottom:20px">Confirmer la suppression ?</p>
            <div style="display:flex;gap:8px">
                <button id="ag-btn-oui" style="
                    flex:1;padding:13px;background:#ef4444;color:white;
                    border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">
                    Confirmer
                </button>
                <button id="ag-btn-non" style="
                    flex:1;padding:13px;background:#f3f4f6;color:#374151;
                    border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">
                    Annuler
                </button>
            </div>`;

        document.getElementById('ag-btn-non').onclick = () => ouvrirJour(dateRetour);
        document.getElementById('ag-btn-oui').onclick = async () => {
            try {
                await fetch(`/api/agenda/${id}`, { method: 'DELETE', headers: _headers() });
                charger();
                await ouvrirJour(dateRetour);
            } catch {
                document.getElementById('modal-body').innerHTML =
                    '<p style="color:#ef4444;text-align:center;padding:20px">Erreur lors de la suppression.</p>';
            }
        };
    }

    return {
        charger,
        ouvrirModal,
        ouvrirJour,
        ouvrirFormulaire,
        sauvegarder,
        supprimer,
        _afficherCalendrier,
        _moisPrec,
        _moisSuiv,
        _onCatChange,
        _onEmployeurChange
    };

})();
