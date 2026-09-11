// ============================================================
// public/js/widgets.js
// Grille par onglet, drag & drop souris + tactile, opt-out widgets.
// Dépend de : app.js (WIDGETS_DEF, dragSrc, dragActif, longPressTimer)
// ============================================================

let gridConstruit = false;

function resetGrid() {
    gridConstruit = false;
}

// ── Définition par onglet ─────────────────────────────────────────────

const WIDGETS_PAR_ONGLET = {
    quotidien : ['agenda', 'taches', 'priere', 'islam', 'anniversaires', 'social'],
    bienetre  : ['cycle', 'sante'],
    astral    : ['astrologie', 'theme-astral', 'pierre-naissance'],
    profil    : ['profil', 'admin'],
    apropos   : ['faq', 'changelog']
};

function getOngletWidget(id) {
    for (const [onglet, ids] of Object.entries(WIDGETS_PAR_ONGLET)) {
        if (ids.includes(id)) return onglet;
    }
    return null;
}

// ── Tracking ouverture ────────────────────────────────────────────────

function _trackerOuverture(widgetId) {
    const user = getUser();
    if (!user?.token) return;
    fetch('/api/widget-order/open', {
        method  : 'POST',
        headers : {
            'Content-Type' : 'application/json',
            'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ widget: widgetId })
    }).catch(() => {});
}

// ── Build principal ───────────────────────────────────────────────────

async function buildGrid() {
    if (gridConstruit) return;
    gridConstruit = true;

    const user  = getUser();
    const token = user?.token;

    let ordre         = null;
    let widgetsCaches = [];
    let sexe          = null;

    try {
        const [rOrdre, rWidgets, rProfil] = await Promise.all([
            fetch('/api/widget-order',            { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/profil/widgets-visibles', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/profil',                  { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const dOrdre   = await rOrdre.json();
        const dWidgets = await rWidgets.json();
        const dProfil  = await rProfil.json();
        if (dOrdre.success   && dOrdre.ordre)                           ordre         = dOrdre.ordre;
        if (dWidgets.success && Array.isArray(dWidgets.widgets_caches)) widgetsCaches = dWidgets.widgets_caches;
        if (dProfil.success  && dProfil.profil) {
            sexe        = dProfil.profil.sexe;
            profilCache = dProfil.profil;
        }
    } catch { /* silencieux */ }

    let defs = [...WIDGETS_DEF];
    if (user?.role === 'admin') {
        defs.push({
            id   : 'admin',
            label: 'Administration',
            icon : '⚙️',
            cls  : 'w-admin',
            desc : 'Gérer les utilisateurs et les paramètres',
            foot : 'Cliquez pour gérer'
        });
    }

    if (sexe === 'homme') {
        defs = defs.filter(w => w.id !== 'cycle');
    }

    await buildTabGrid('quotidien', defs, ordre, widgetsCaches, user);
    await buildTabGrid('bienetre',  defs, ordre, widgetsCaches, user);
    await buildTabGrid('astral',    defs, ordre, widgetsCaches, user);
    await buildTabGrid('profil',    defs, ordre, widgetsCaches, user);
    await buildTabGrid('apropos',   defs, ordre, widgetsCaches, user);

    _buildAccueilMeteo();

    if (typeof chargerProfilHeader        === 'function') chargerProfilHeader();
    if (typeof Agenda                     !== 'undefined') Agenda.charger();
    if (typeof Cycle                      !== 'undefined') Cycle.charger();
    if (typeof chargerWidgetSocial        === 'function')  chargerWidgetSocial();
    if (typeof chargerWidgetSante         === 'function')  chargerWidgetSante();
    if (typeof chargerThemeAstral         === 'function')  chargerThemeAstral();
    if (typeof chargerPierreNaissance     === 'function')  chargerPierreNaissance();
    if (typeof chargerWidgetAnniversaires === 'function')  chargerWidgetAnniversaires();
    if (typeof chargerWidgetAdmin         === 'function')  chargerWidgetAdmin();
    if (typeof chargerAstrologie          === 'function')  chargerAstrologie();
}

async function buildTabGrid(onglet, allDefs, ordre, widgetsCaches, user) {
    const gridId = `grid-${onglet}`;
    const grid   = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';

    const idsOnglet = WIDGETS_PAR_ONGLET[onglet] || [];
    let defs = allDefs.filter(w => idsOnglet.includes(w.id));

    if (ordre) {
        const ordreOnglet = ordre.filter(id => idsOnglet.includes(id));
        const sorted      = [];
        ordreOnglet.forEach(id => { const w = defs.find(d => d.id === id); if (w) sorted.push(w); });
        defs.forEach(w => { if (!ordreOnglet.includes(w.id)) sorted.push(w); });
        defs = sorted;
    } else {
        const DERNIERS = ['profil', 'admin'];
        const normaux  = defs
            .filter(w => !DERNIERS.includes(w.id))
            .sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
        const derniers = DERNIERS
            .map(id => defs.find(w => w.id === id))
            .filter(Boolean);
        defs = [...normaux, ...derniers];
    }

    const TOUJOURS_VISIBLES = ['profil'];
    defs = defs.filter(w => {
        if (w.id === 'admin')                 return user?.role === 'admin';
        if (TOUJOURS_VISIBLES.includes(w.id)) return true;
        return !widgetsCaches.includes(w.id);
    });

    defs.forEach(def => grid.appendChild(creerWidget(def, gridId)));
}

// ── Météo onglet accueil ──────────────────────────────────────────────

function _buildAccueilMeteo() {
    const el = document.getElementById('accueil-meteo');
    if (!el) return;
    el.innerHTML = `
        <div class="meteo-accueil-card" onclick="openModal('meteo')" title="Cliquez pour les détails">
            <div id="wc-meteo">Chargement...</div>
        </div>
    `;
    if (typeof chargerMeteoAuto === 'function') chargerMeteoAuto();
}

// ── Créer widget ──────────────────────────────────────────────────────

function creerWidget(def, gridId) {
    const div        = document.createElement('div');
    div.className    = `widget ${def.cls}`;
    div.dataset.id   = def.id;
    div.dataset.grid = gridId;
    div.draggable    = true;

    let contentHtml = def.desc || '';
    if (def.id === 'agenda')            contentHtml = '<div id="wc-agenda">Chargement...</div>';
    if (def.id === 'cycle')             contentHtml = '<div id="widget-cycle-content">Chargement...</div>';
    if (def.id === 'profil')            contentHtml = '<div id="wc-profil"></div>';
    if (def.id === 'astrologie')        contentHtml = '<div id="wc-astrologie">Chargement...</div>';
    if (def.id === 'theme-astral')      contentHtml = '<div id="wc-theme-astral">Chargement...</div>';
    if (def.id === 'pierre-naissance')  contentHtml = '<div id="wc-pierre-naissance">Chargement...</div>';
    if (def.id === 'admin')             contentHtml = '<div id="wc-admin">Chargement...</div>';
    if (def.id === 'social')            contentHtml = '<div id="wc-social">Chargement...</div>';
    if (def.id === 'sante')             contentHtml = '<div id="wc-sante">Chargement...</div>';
    if (def.id === 'anniversaires')     contentHtml = '<div id="wc-anniversaires">Chargement...</div>';

    div.innerHTML = `
        <span class="drag-handle" title="Déplacer">⠿</span>
        <div class="wh">
            <div class="whl">
                <div class="wi" id="wi-${def.id}">${def.icon}</div>
                <div class="wt">${def.label}</div>
            </div>
        </div>
        <div class="wc" id="wc-${def.id}">${contentHtml}</div>
        <div class="wf">${def.foot || ''}</div>
    `;

    const SANS_MODAL = ['social', 'sante', 'pierre-naissance'];

    div.addEventListener('click', e => {
        if (e.target.classList.contains('drag-handle')) return;
        if (e.target.closest('button'))                 return;
        if (SANS_MODAL.includes(def.id))                return;

        if (def.id === 'agenda') {
            const clickedCard = e.target.closest('#wc-agenda > div[onclick]');
            if (clickedCard) return;
            if (e.target.closest('.wf') || !e.target.closest('#wc-agenda')) {
                _trackerOuverture(def.id);
                Agenda.ouvrirModal();
                document.getElementById('overlay').classList.add('on');
            }
            return;
        }

        _trackerOuverture(def.id);
        openModal(def.id);
    });

    div.addEventListener('dragstart', onDragStart);
    div.addEventListener('dragover',  onDragOver);
    div.addEventListener('dragleave', onDragLeave);
    div.addEventListener('drop',      onDrop);
    div.addEventListener('dragend',   onDragEnd);

    ajouterTouchDrag(div);

    return div;
}

// ── Drag & drop souris ────────────────────────────────────────────────

function onDragStart(e) {
    dragSrc = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id);
}

function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this !== dragSrc) this.classList.add('drag-over');
}

function onDragLeave() {
    this.classList.remove('drag-over');
}

function onDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    if (this === dragSrc) return;
    if (this.dataset.grid !== dragSrc.dataset.grid) return;
    const grid    = document.getElementById(this.dataset.grid);
    const widgets = [...grid.children];
    const si      = widgets.indexOf(dragSrc);
    const ti      = widgets.indexOf(this);
    if (si < ti) grid.insertBefore(dragSrc, this.nextSibling);
    else         grid.insertBefore(dragSrc, this);
    sauvegarderOrdre();
}

function onDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
}

// ── Drag & drop tactile ───────────────────────────────────────────────

function ajouterTouchDrag(el) {
    let startX, startY, clone, origRect;

    el.addEventListener('touchstart', e => {
        dragActif = false;
        const t   = e.touches[0];
        startX    = t.clientX;
        startY    = t.clientY;
        longPressTimer = setTimeout(() => {
            dragActif = true;
            origRect  = el.getBoundingClientRect();
            clone     = el.cloneNode(true);
            clone.style.cssText = `
                position:fixed;z-index:9999;opacity:.75;pointer-events:none;
                width:${origRect.width}px;left:${origRect.left}px;top:${origRect.top}px;
                margin:0;transition:none;border-radius:16px;
                box-shadow:0 12px 32px rgba(0,0,0,.2);
            `;
            document.body.appendChild(clone);
            el.classList.add('dragging');
            dragSrc = el;
            if (navigator.vibrate) navigator.vibrate(40);
        }, 500);
    }, { passive: true });

    el.addEventListener('touchmove', e => {
        const t  = e.touches[0];
        const dx = Math.abs(t.clientX - startX);
        const dy = Math.abs(t.clientY - startY);
        if (!dragActif && (dx > 8 || dy > 8)) { clearTimeout(longPressTimer); return; }
        if (!dragActif) return;
        e.preventDefault();
        clone.style.left = (origRect.left + t.clientX - startX) + 'px';
        clone.style.top  = (origRect.top  + t.clientY - startY) + 'px';
        clone.style.display = 'none';
        const below  = document.elementFromPoint(t.clientX, t.clientY);
        clone.style.display = '';
        const target = below?.closest('.widget');
        document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
        if (target && target !== el) target.classList.add('drag-over');
    }, { passive: false });

    el.addEventListener('touchend', e => {
        clearTimeout(longPressTimer);
        if (!dragActif) return;
        if (clone) clone.remove();
        el.classList.remove('dragging');
        dragActif = false;
        const t      = e.changedTouches?.[0];
        const below  = t ? document.elementFromPoint(t.clientX, t.clientY) : null;
        const target = below?.closest('.widget');
        document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
        if (target && target !== el && target.dataset.grid === el.dataset.grid) {
            const grid    = document.getElementById(el.dataset.grid);
            const widgets = [...grid.children];
            const si      = widgets.indexOf(el);
            const ti      = widgets.indexOf(target);
            if (si < ti) grid.insertBefore(el, target.nextSibling);
            else         grid.insertBefore(el, target);
            sauvegarderOrdre();
        }
    }, { passive: true });

    el.addEventListener('touchcancel', () => {
        clearTimeout(longPressTimer);
        if (clone) clone.remove();
        el.classList.remove('dragging');
        dragActif = false;
        document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
    }, { passive: true });
}

// ── Sauvegarde ordre ──────────────────────────────────────────────────

async function sauvegarderOrdre() {
    const user  = getUser();
    const ordre = [];
    Object.keys(WIDGETS_PAR_ONGLET).forEach(onglet => {
        const grid = document.getElementById(`grid-${onglet}`);
        if (grid) {
            [...grid.children].forEach(w => { if (w.dataset.id) ordre.push(w.dataset.id); });
        }
    });
    try {
        await fetch('/api/widget-order', {
            method  : 'POST',
            headers : {
                'Content-Type'  : 'application/json',
                'Authorization' : `Bearer ${user?.token}`
            },
            body: JSON.stringify({ ordre })
        });
    } catch { /* silencieux */ }
}

// ── Appliquer widgets visibles ────────────────────────────────────────

function appliquerWidgetsVisibles(widgetsCaches) {
    const user              = getUser();
    const TOUJOURS_VISIBLES = user?.role === 'admin'
        ? ['profil', 'admin']
        : ['profil'];
    Object.keys(WIDGETS_PAR_ONGLET).forEach(onglet => {
        const grid = document.getElementById(`grid-${onglet}`);
        if (!grid) return;
        [...grid.children].forEach(el => {
            const id = el.dataset.id;
            if (!id)                            return;
            if (TOUJOURS_VISIBLES.includes(id)) return;
            el.style.display = widgetsCaches.includes(id) ? 'none' : '';
        });
    });
}
