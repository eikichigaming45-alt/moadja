// ============================================================
// public/js/feed.js
// Fil social — onglet Accueil.
// MODULE @TAG : suggestions, B4 (Tchat), LOC1-4 (Lieu)
// Dépend de : app.js, profil.js, tchat.js
// ============================================================

let feedFilter = 'all';
let feedFollowing = [];
let feedHashtag = null;

const RESONANCES = [
    { type: 'douceur',     label: 'Douceur',     icone: '🩷', couleur: '#f9a8d4' },
    { type: 'energie',     label: 'Énergie',     icone: '⚡', couleur: '#fcd34d' },
    { type: 'calme',       label: 'Calme',       icone: '🌙', couleur: '#a5b4fc' },
    { type: 'inspiration', label: 'Inspiration', icone: '✨', couleur: '#6ee7b7' }
];

function _feedTrigramme(prenom, nom, fallback) {
    if (typeof construireTrigramme === 'function') return construireTrigramme(prenom, nom) || (fallback?.[0] || '?').toUpperCase();
    const mots = [...(prenom || '').split(/\s+/), ...(nom || '').split(/\s+/)].map(m => m.trim()).filter(Boolean);
    return mots.slice(0, 3).map(m => m[0].toUpperCase()).join('') || (fallback?.[0] || '?').toUpperCase();
}

function _feedAvatarHTML(photo, prenom, nom, username, taille = 36) {
    if (photo) return `<img src="${photo}" style="width:${taille}px;height:${taille}px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`;
    const trig = _feedTrigramme(prenom, nom, username);
    return `<div style="width:${taille}px;height:${taille}px;border-radius:50%;background:linear-gradient(135deg,#e9d5ff,#fbcfe8);color:#7c3aed;font-size:${Math.round(taille * 0.33)}px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${trig}</div>`;
}

async function initFeed() {
    const el = document.getElementById('accueil-feed');
    if (!el) return;
    await chargerFollowing();
    renderFeedHeader();
    await chargerFeed();
}

async function chargerFollowing() {
    const user = getUser();
    try {
        const r = await fetch('/api/feed/following', { headers: { 'Authorization': `Bearer ${user.token}` } });
        const d = await r.json();
        if (d.success) feedFollowing = d.following;
    } catch {}
}

function renderFeedHeader() {
    const el = document.getElementById('accueil-feed');
    el.innerHTML = `
        <div class="feed-header">
            <div class="feed-filters">
                <button class="feed-filter-btn active" data-filter="all" onclick="setFeedFilter('all')">Tous</button>
                <button class="feed-filter-btn" data-filter="following" onclick="setFeedFilter('following')">Abonnements</button>
            </div>
            <button class="feed-new-btn" onclick="ouvrirModalPost()">+ Post</button>
        </div>
        <div id="feed-list"></div>
    `;
}

async function setFeedFilter(filter) {
    feedFilter = filter;
    document.querySelectorAll('.feed-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    await chargerFeed();
}

async function chargerFeed() {
    const user = getUser();
    const list = document.getElementById('feed-list');
    if (!list) return;
    list.innerHTML = '<div class="feed-loading">Chargement...</div>';
    try {
        const r = await fetch(`/api/feed${feedFilter === 'following' ? '?filter=following' : ''}`, { headers: { 'Authorization': `Bearer ${user.token}` } });
        const d = await r.json();
        if (!d.success) throw new Error();
        if (!d.posts.length) { list.innerHTML = '<div class="feed-empty">Aucun post pour l\'instant.</div>'; return; }
        list.innerHTML = d.posts.map(p => renderPost(p)).join('');
        _bindResonances();
    } catch {
        list.innerHTML = '<div class="feed-empty">Erreur de chargement.</div>';
    }
}

function _renderHashtags(texte) {
    return texte.replace(/(<[^>]*>)|#([a-zA-ZÀ-ÿ0-9_]+)/g, (match, tag_html, tag) => {
        if (tag_html) return tag_html;
        return `<span class="hashtag-tag" data-tag="${tag.toLowerCase()}" style="color:#7c3aed;font-weight:600;cursor:pointer">#${tag}</span>`;
    });
}

function renderContenuAvecMentions(contenu, mentionsData) {
    if (!contenu) return '';
    if (!mentionsData || !mentionsData.length) return _renderHashtags(escapeHtml(contenu).replace(/@toutlemonde/gi, '<span class="mention-tag" style="color:#7c3aed;font-weight:600;cursor:default">@Tout le monde</span>'));
    let result = contenu;
    const sorted = [...mentionsData].sort((a, b) => (`${b.prenom || ''} ${b.nom || ''}`.trim().length) - (`${a.prenom || ''} ${a.nom || ''}`.trim().length));
    const placeholders = [];
    for (const m of sorted) {
        if (!m || !m.id) continue;
        const full = `${m.prenom || ''} ${m.nom || ''}`.trim();
        if (!full) continue;
        const tag = `@${full}`, placeholder = `%%MENTION_${m.id}%%`;
        if (result.includes(tag)) {
            result = result.split(tag).join(placeholder);
            placeholders.push({ placeholder, html: `<span class="mention-tag" data-user-id="${m.id}" style="color:#7c3aed;font-weight:600;cursor:pointer">@${escapeHtml(full)}</span>` });
        }
    }
    result = result.replace(/@toutlemonde/gi, '%%TOUTLEMONDE%%');
    result = escapeHtml(result);
    for (const { placeholder, html } of placeholders) result = result.split(escapeHtml(placeholder)).join(html);
    result = result.split('%%TOUTLEMONDE%%').join('<span class="mention-tag" style="color:#7c3aed;font-weight:600;cursor:default">@Tout le monde</span>');
    return _renderHashtags(result);
}

document.addEventListener('click', e => {
    const tag = e.target.closest('.mention-tag');
    if (tag && tag.dataset.userId) { e.stopPropagation(); ouvrirProfilPublic(parseInt(tag.dataset.userId)); }
    const hash = e.target.closest('.hashtag-tag');
    if (hash) { e.stopPropagation(); filtrerParHashtag(hash.dataset.tag); }
});

async function filtrerParHashtag(tag) {
    feedFilter = 'hashtag'; feedHashtag = tag;
    document.querySelectorAll('.feed-filter-btn').forEach(b => b.classList.remove('active'));
    const list = document.getElementById('feed-list');
    if (!list) return;
    list.innerHTML = '<div class="feed-loading">Chargement...</div>';
    const user = getUser();
    try {
        const r = await fetch(`/api/feed?hashtag=${encodeURIComponent(tag)}`, { headers: { 'Authorization': `Bearer ${user.token}` } });
        const d = await r.json();
        if (!d.success) throw new Error();
        const header = document.querySelector('.feed-header');
        const existing = document.getElementById('hashtag-banner');
        if (existing) existing.remove();
        if (header) {
            const banner = document.createElement('div');
            banner.id = 'hashtag-banner';
            banner.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:#ede9fe;border-radius:10px;margin-bottom:8px;font-size:13px;font-weight:600;color:#7c3aed';
            banner.innerHTML = `#${tag} <button onclick="clearHashtagFilter()" style="margin-left:auto;background:none;border:none;font-size:16px;cursor:pointer;color:#7c3aed;line-height:1">✕</button>`;
            header.insertAdjacentElement('afterend', banner);
        }
        if (!d.posts.length) { list.innerHTML = `<div class="feed-empty">Aucun post avec #${tag}.</div>`; return; }
        list.innerHTML = d.posts.map(p => renderPost(p)).join('');
        _bindResonances();
    } catch { list.innerHTML = '<div class="feed-empty">Erreur de chargement.</div>'; }
}

async function clearHashtagFilter() {
    feedFilter = 'all'; feedHashtag = null;
    const banner = document.getElementById('hashtag-banner');
    if (banner) banner.remove();
    document.querySelectorAll('.feed-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
    await chargerFeed();
}

function initMentions(inputEl, wrapEl) {
    if (!inputEl || !wrapEl) return;
    let dropEl = wrapEl.querySelector('.mention-dropdown');
    if (!dropEl) { dropEl = document.createElement('div'); dropEl.className = 'mention-dropdown'; wrapEl.style.position = 'relative'; wrapEl.appendChild(dropEl); }
    let debounceTimer = null;
    inputEl.addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => _mentionInput(inputEl, dropEl), 200); });
    inputEl.addEventListener('keydown', e => {
        if (dropEl.style.display === 'none' || !dropEl.children.length) return;
        const items = [...dropEl.querySelectorAll('.mention-item')], cur = dropEl.querySelector('.mention-item.active'), idx = items.indexOf(cur);
        if (e.key === 'ArrowDown') { e.preventDefault(); const next = items[Math.min(idx + 1, items.length - 1)]; if (cur) cur.classList.remove('active'); if (next) next.classList.add('active'); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); const prev = items[Math.max(idx - 1, 0)]; if (cur) cur.classList.remove('active'); if (prev) prev.classList.add('active'); }
        else if (e.key === 'Enter' || e.key === 'Tab') { const active = dropEl.querySelector('.mention-item.active'); if (active) { e.preventDefault(); if (active.dataset.special === 'toutlemonde') _insererToutLeMonde(inputEl, dropEl); else _insererMention(inputEl, dropEl, active.dataset.prenom, active.dataset.nom); } }
        else if (e.key === 'Escape') _fermerDropdown(dropEl);
    });
    document.addEventListener('click', e => { if (!wrapEl.contains(e.target)) _fermerDropdown(dropEl); }, { capture: true });
}

async function _mentionInput(inputEl, dropEl) {
    const val = inputEl.value, cursor = inputEl.selectionStart, avant = val.substring(0, cursor), match = avant.match(/@([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ \t]{0,40})$/);
    if (!match) { _fermerDropdown(dropEl); return; }
    const q = match[1].trim();
    if (!q) { _fermerDropdown(dropEl); return; }
    const user = getUser(), isAdmin = user.role === 'admin';
    try {
        const r = await fetch(`/api/feed/users?q=${encodeURIComponent(q)}`, { headers: { 'Authorization': `Bearer ${user.token}` } });
        const d = await r.json();
        if (!d.success) { _fermerDropdown(dropEl); return; }
        const items = [];
        if (isAdmin && 'toutlemonde'.startsWith(q.toLowerCase())) {
            items.push(`<div class="mention-item active" data-special="toutlemonde" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer"><div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">📢</div><span style="font-size:13px;font-weight:700;color:#7c3aed">@toutlemonde</span><span style="font-size:11px;color:#9ca3af;margin-left:4px">Tout le monde</span></div>`);
        }
        if (d.users.length) {
            d.users.forEach((u, i) => {
                const av = u.avatar ? `<img src="${u.avatar}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">` : `<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#e9d5ff,#fbcfe8);color:#7c3aed;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${_feedTrigramme(u.prenom, u.nom, u.username)}</div>`;
                items.push(`<div class="mention-item${items.length === 0 && i === 0 ? ' active' : ''}" data-prenom="${escapeHtml(u.prenom || '')}" data-nom="${escapeHtml(u.nom || '')}">${av}<span style="font-size:13px;font-weight:600;color:#111">${escapeHtml(u.prenom || '')} ${escapeHtml(u.nom || '')}</span></div>`);
            });
        }
        if (!items.length) { _fermerDropdown(dropEl); return; }
        dropEl.innerHTML = items.join(''); dropEl.style.display = 'block';
        dropEl.querySelectorAll('.mention-item').forEach(item => item.addEventListener('mousedown', e => { e.preventDefault(); if (item.dataset.special === 'toutlemonde') _insererToutLeMonde(inputEl, dropEl); else _insererMention(inputEl, dropEl, item.dataset.prenom, item.dataset.nom); }));
    } catch { _fermerDropdown(dropEl); }
}

function _insererMention(inputEl, dropEl, prenom, nom) {
    const val = inputEl.value, cursor = inputEl.selectionStart, avant = val.substring(0, cursor), apres = val.substring(cursor);
    const newAvant = avant.replace(/@([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ \t]{0,40})$/, `@${prenom} ${nom}  `);
    inputEl.value = newAvant + apres;
    inputEl.setSelectionRange(newAvant.length, newAvant.length);
    inputEl.focus(); _fermerDropdown(dropEl);
}

function _insererToutLeMonde(inputEl, dropEl) {
    const val = inputEl.value, cursor = inputEl.selectionStart, avant = val.substring(0, cursor), apres = val.substring(cursor);
    const newAvant = avant.replace(/@([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ \t]{0,40})$/, '@toutlemonde ');
    inputEl.value = newAvant + apres;
    inputEl.setSelectionRange(newAvant.length, newAvant.length);
    inputEl.focus(); _fermerDropdown(dropEl);
}

function _fermerDropdown(dropEl) { if (dropEl) { dropEl.innerHTML = ''; dropEl.style.display = 'none'; } }
function _isMobile() { return window.matchMedia('(pointer: coarse)').matches; }

function _renderResonanceBouton(postId, maResonance, resonancesStats) {
    const stats = resonancesStats || [], total = stats.reduce((s, r) => s + (r.nb || 0), 0), actifs = RESONANCES.filter(r => stats.find(s => s.type === r.type && s.nb > 0));
    if (!total) return `<button class="feed-resonance-btn" onclick="ouvrirArcResonance(this, event)"><span class="feed-resonance-neutre">✦</span><span class="feed-resonance-label-neutre">Résonances</span></button>`;
    const icones = actifs.map(r => `<span class="feed-resonance-icone${maResonance === r.type ? ' mine' : ''}">${r.icone}</span>`).join('');
    return `<div style="display:flex;align-items:center;gap:8px"><button class="feed-resonance-btn" onclick="ouvrirArcResonance(this, event)"><span class="feed-resonance-icones">${icones}</span></button><button class="feed-resonance-count-btn" onclick="voirLikers(${postId}, event)" style="background:none;border:none;cursor:pointer;font-size:13px;font-weight:600;color:#6b7280;padding:4px 0;transition:color .2s" onmouseover="this.style.color='#7c3aed'" onmouseout="this.style.color='#6b7280'">${total}</button></div>`;
}

// ── RENDER POST (Modifié pour LOC2 et LOC4) ───────────────────
function renderPost(p) {
    const user = getUser(), isOwner = user.username === p.username, isAdmin = user.role === 'admin';
    const avatar = p.avatar ? `<img src="${p.avatar}" class="feed-avatar" alt="">` : `<div class="feed-avatar feed-avatar-initiale">${_feedTrigramme(p.prenom, p.nom, p.username)}</div>`;
    const date = new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const followed = feedFollowing.includes(p.user_id);

    const lieuTag = p.lieu ? 
        `<span class="feed-lieu-badge" 
            ${p.lieu_lat && p.lieu_lon ? `onclick="ouvrirCarte(${p.lieu_lat}, ${p.lieu_lon}, '${escapeHtml(p.lieu)}', event)"` : ''} 
            title="${p.lieu_lat ? 'Voir sur la carte' : ''}">📍 ${escapeHtml(p.lieu)}</span>` : '';

    return `
        <div class="feed-card" id="post-${p.id}" data-post-id="${p.id}" data-photo-url="${escapeHtml(p.photo_url || '')}">
            <div class="feed-card-header">
                <div class="feed-user" onclick="ouvrirProfilPublic(${p.user_id})">
                    ${avatar}
                    <div style="flex:1;min-width:0">
                        <div class="feed-username" style="display:flex;align-items:center;flex-wrap:wrap">
                            ${escapeHtml(p.prenom || '')} ${escapeHtml(p.nom || '')}
                            ${lieuTag}
                        </div>
                        <div class="feed-handle">@${escapeHtml(p.username)} · ${date} ${p.personnes_taguees && p.personnes_taguees.length ? `· Avec l'équipe` : ''}</div>
                    </div>
                </div>
                <div class="feed-card-actions">
                    ${!isOwner ? `<button class="feed-follow-btn ${followed ? 'following' : ''}" onclick="toggleFollow(${p.user_id}, this)">${followed ? 'Abonné' : 'Suivre'}</button>` : ''}
                    ${isOwner || isAdmin ? `<button class="feed-action-btn" onclick="editerPost(${p.id})" title="Modifier"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="feed-delete-btn" onclick="supprimerPost(${p.id})" title="Supprimer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>` : ''}
                </div>
            </div>
            <div class="feed-contenu-text" id="post-contenu-${p.id}" style="display:none">${escapeHtml(p.contenu || '')}</div>
            <div class="feed-lieu-raw" id="post-lieu-raw-${p.id}" style="display:none">${escapeHtml(p.lieu || '')}</div>
            <div class="feed-lieulat-raw" id="post-lieulat-raw-${p.id}" style="display:none">${p.lieu_lat || ''}</div>
            <div class="feed-lieulon-raw" id="post-lieulon-raw-${p.id}" style="display:none">${p.lieu_lon || ''}</div>
            ${p.contenu ? `<div class="feed-contenu">${renderContenuAvecMentions(p.contenu, p.mentions_data)}</div>` : ''}
            ${p.photo_url ? `
            <div class="feed-photo-wrap" id="photo-wrap-${p.id}" data-post-id="${p.id}" data-photo-url="${escapeHtml(p.photo_url)}" data-ma-resonance="${escapeHtml(p.ma_resonance || '')}">
                <img src="${p.photo_url}" class="feed-photo" alt="">
                <div class="feed-arc-resonance" id="arc-${p.id}" style="display:none"><div class="feed-arc-label">Résonances</div><div class="feed-arc-items">${RESONANCES.map(r => `<button class="feed-arc-item ${p.ma_resonance === r.type ? 'active' : ''}" data-type="${r.type}" style="--r-color:${r.couleur}" onclick="choisirResonance(${p.id}, '${r.type}', this, event)"><span class="feed-arc-icone">${r.icone}</span><span class="feed-arc-item-label">${r.label}</span></button>`).join('')}</div></div>
            </div>` : ''}
            <div class="feed-footer">
                <div class="feed-resonance-wrap" data-post-id="${p.id}">${_renderResonanceBouton(p.id, p.ma_resonance, p.resonances_stats)}</div>
                <button class="feed-comment-btn" onclick="toggleCommentaires(${p.id})"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>${p.nb_comments}</span></button>
                <button class="feed-share-btn" onclick="partagerPost(${p.id})"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>
            </div>
            <div class="feed-comments" id="comments-${p.id}" style="display:none"></div>
        </div>
    `;
}

// ── CARTOGRAPHIE (LOC4) ───────────────────────────────────────
function ouvrirCarte(lat, lon, nomLieu, e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    document.getElementById('modal-title').textContent = nomLieu || 'Lieu du post';
    document.getElementById('modal-body').innerHTML = `
        <div id="map-container" style="width:100%; height:400px; border-radius:12px; background:#e5e7eb; overflow:hidden;"></div>
        <div style="margin-top:12px;text-align:center;">
            <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}" target="_blank" rel="noopener"
               style="color:#7c3aed;font-size:13px;font-weight:600;text-decoration:none;">Ouvrir dans OpenStreetMap</a>
        </div>
    `;
    document.getElementById('overlay').classList.add('on');

    setTimeout(() => {
        if (typeof L !== 'undefined') {
            const map = L.map('map-container').setView([lat, lon], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors', maxZoom: 19
            }).addTo(map);
            L.marker([lat, lon]).addTo(map).bindPopup(`<b>${escapeHtml(nomLieu)}</b>`).openPopup();
            setTimeout(() => map.invalidateSize(), 100);
        } else {
            document.getElementById('map-container').innerHTML = `<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#6b7280;font-size:13px;">Erreur chargement carte.</div>`;
        }
    }, 100);
}

// ── GÉOLOCALISATION : CACHE DE POSITION (session, 5 min) ───────
let _locPositionCache = null;
let _locPositionCacheTime = 0;
const LOC_CACHE_DUREE_MS = 5 * 60 * 1000;

function _getLocPosition() {
    return new Promise((resolve) => {
        const maintenant = Date.now();
        if (_locPositionCache && (maintenant - _locPositionCacheTime) < LOC_CACHE_DUREE_MS) {
            resolve(_locPositionCache);
            return;
        }
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                _locPositionCache = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                _locPositionCacheTime = maintenant;
                resolve(_locPositionCache);
            },
            () => resolve(null),
            { timeout: 8000 }
        );
    });
}

// ── CALCUL DE DISTANCE (formule Haversine, aucun appel réseau) ──
function _distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function _formatDistance(km) {
    if (km < 1) return `à ${Math.round(km * 1000)} m`;
    return `à ${km.toFixed(1)} km`;
}

// ── AFFICHAGE D'UNE LIGNE DE SUGGESTION (nom + détail) ─────────
function _renderLocItem(nom, detail, lat, lon) {
    return `<div class="loc-item" data-nom="${escapeHtml(nom)}" data-lat="${lat}" data-lon="${lon}">
        <div class="loc-item-nom">📍 ${escapeHtml(nom)}</div>
        ${detail ? `<div class="loc-item-detail">${escapeHtml(detail)}</div>` : ''}
    </div>`;
}

function _bindLocItems(drop, inputElId, latId, lonId) {
    drop.querySelectorAll('.loc-item[data-nom]').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById(inputElId).value = item.dataset.nom;
            document.getElementById(latId).value = item.dataset.lat;
            document.getElementById(lonId).value = item.dataset.lon;
            drop.style.display = 'none';
        });
    });
}

// ── RECHERCHE DE LIEU GEOLOC (clic sur l'icône — position exacte) ──
async function rechercherLieuGeoloc(inputElId, latId, lonId, wrapId) {
    const wrap = document.getElementById(wrapId);
    let drop = wrap.querySelector('.loc-dropdown');
    if (!drop) { drop = document.createElement('div'); drop.className = 'loc-dropdown'; wrap.style.position = 'relative'; wrap.appendChild(drop); }

    drop.innerHTML = '<div class="loc-item" style="text-align:center;color:#9ca3af;">Recherche GPS en cours...</div>';
    drop.style.display = 'block';

    const position = await _getLocPosition();
    if (!position) {
        drop.innerHTML = '<div class="loc-item" style="text-align:center;color:#ef4444;">Géolocalisation refusée/échouée</div>';
        setTimeout(() => drop.style.display = 'none', 3000);
        return;
    }
    const { lat, lon } = position;

    try {
        const resNom = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`);
        const dataNom = await resNom.json();
        const ville = dataNom.address?.city || dataNom.address?.town || dataNom.address?.village || dataNom.address?.suburb || 'Autour de moi';

        const query = `
            [out:json][timeout:5];
            (
              node["amenity"~"cafe|bar|restaurant|cinema|theatre"](around:300,${lat},${lon});
              node["tourism"~"camp_site|museum|gallery"](around:300,${lat},${lon});
              node["leisure"~"park|pitch"](around:300,${lat},${lon});
            );
            out body 10;
        `;
        const resOv = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
        const dataOv = await resOv.json();

        let itemsHTML = _renderLocItem(ville, 'Ville actuelle', lat, lon);

        if (dataOv.elements && dataOv.elements.length > 0) {
            // Tri par distance réelle (Haversine) même sur les résultats Overpass
            const elementsAvecDistance = dataOv.elements
                .filter(el => el.tags && el.tags.name)
                .map(el => ({ ...el, _dist: _distanceKm(lat, lon, el.lat, el.lon) }))
                .sort((a, b) => a._dist - b._dist);

            if (elementsAvecDistance.length > 0) {
                itemsHTML += `<div style="padding:6px 14px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;background:#f9fafb;">Lieux à proximité</div>`;
                elementsAvecDistance.forEach(el => {
                    itemsHTML += _renderLocItem(el.tags.name, _formatDistance(el._dist), el.lat, el.lon);
                });
            }
        }

        drop.innerHTML = itemsHTML;
        _bindLocItems(drop, inputElId, latId, lonId);

        document.addEventListener('click', function _closeLoc(e) {
            if (!wrap.contains(e.target)) { drop.style.display = 'none'; document.removeEventListener('click', _closeLoc); }
        });

        } catch (err) {
        drop.innerHTML = '<div class="loc-item" style="text-align:center;color:#ef4444;">Erreur réseau OSM</div>';
        setTimeout(() => drop.style.display = 'none', 3000);
    }
}

// ── RECHERCHE DE LIEU PAR TEXTE (frappe — triée par proximité réelle) ──
function _initLieuAutocomplete(inputElId, latId, lonId, wrapId) {
    const input = document.getElementById(inputElId);
    const latInput = document.getElementById(latId);
    const lonInput = document.getElementById(lonId);
    if (!input) return;
    let debounceTimer = null;
    input.addEventListener('input', () => {
        if (latInput) latInput.value = '';
        if (lonInput) lonInput.value = '';
        clearTimeout(debounceTimer);
        const q = input.value.trim();
        if (q.length < 2) {
            const wrap = document.getElementById(wrapId);
            const drop = wrap?.querySelector('.loc-dropdown');
            if (drop) drop.style.display = 'none';
            return;
        }
        debounceTimer = setTimeout(() => _rechercherLieuTexte(q, inputElId, latId, lonId, wrapId), 450);
    });
}

async function _rechercherLieuTexte(q, inputElId, latId, lonId, wrapId) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    let drop = wrap.querySelector('.loc-dropdown');
    if (!drop) { drop = document.createElement('div'); drop.className = 'loc-dropdown'; wrap.style.position = 'relative'; wrap.appendChild(drop); }

    drop.innerHTML = '<div class="loc-item" style="text-align:center;color:#9ca3af;">Recherche...</div>';
    drop.style.display = 'block';

    const position = await _getLocPosition();

    try {
                // On demande plus de résultats à Nominatim pour avoir de la matière à trier par distance
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=15&addressdetails=1`;

        if (position) {
            const delta = 0.15;
            const left   = position.lon - delta;
            const top    = position.lat + delta;
            const right  = position.lon + delta;
            const bottom = position.lat - delta;
            url += `&viewbox=${left},${top},${right},${bottom}&bounded=1`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (!data || !data.length) {
            drop.innerHTML = '<div class="loc-item" style="text-align:center;color:#9ca3af;">Aucun lieu trouvé à proximité</div>';
            return;
        }

        // Tri par distance réelle (Haversine) si on a la position GPS,
        // sinon on garde l'ordre de pertinence renvoyé par Nominatim.
        let resultats = data.map(r => ({
            nom: r.display_name.split(',')[0].trim(),
            detail: r.address?.city || r.address?.town || r.address?.village
                || r.display_name.split(',')[1]?.trim() || '',
            lat: r.lat,
            lon: r.lon,
            _dist: position ? _distanceKm(position.lat, position.lon, parseFloat(r.lat), parseFloat(r.lon)) : null
        }));

        if (position) {
            resultats.sort((a, b) => a._dist - b._dist);
        }

        resultats = resultats.slice(0, 8);

        const itemsHTML = resultats.map(r => {
            const detailAffiche = r._dist !== null ? _formatDistance(r._dist) : r.detail;
            return _renderLocItem(r.nom, detailAffiche, r.lat, r.lon);
        }).join('');

        drop.innerHTML = itemsHTML;
        _bindLocItems(drop, inputElId, latId, lonId);

        document.addEventListener('click', function _closeLocTexte(e) {
            if (!wrap.contains(e.target)) { drop.style.display = 'none'; document.removeEventListener('click', _closeLocTexte); }
        });

        } catch (err) {
        drop.innerHTML = '<div class="loc-item" style="text-align:center;color:#ef4444;">Erreur réseau</div>';
    }
}

function _bindResonances() {
    document.querySelectorAll('.feed-photo-wrap[data-post-id]').forEach(wrap => {
        const postId = wrap.dataset.postId, arc = document.getElementById(`arc-${postId}`), img = wrap.querySelector('.feed-photo');
        if (!img) return;
        if (_isMobile()) { img.addEventListener('click', e => { e.stopPropagation(); ouvrirPhoto(wrap.dataset.photoUrl); }); }
        else {
            if (arc) {
                wrap.addEventListener('mouseenter', e => { if (e.target.closest('.feed-arc-resonance')) return; _ouvrirArc(postId); });
                wrap.addEventListener('mouseleave', e => { if (e.relatedTarget && wrap.contains(e.relatedTarget)) return; _fermerArc(postId); });
            }
            img.addEventListener('click', e => { e.stopPropagation(); ouvrirPhoto(wrap.dataset.photoUrl); });
        }
    });
    if (!window._feedResonanceOutsideBound) {
        window._feedResonanceOutsideBound = true;
        document.addEventListener('click', e => {
            if (!e.target.closest('.feed-photo-wrap') && !e.target.closest('.feed-resonance-btn') && !e.target.closest('.feed-resonance-count-btn')) {
                document.querySelectorAll('.feed-arc-resonance').forEach(a => a.style.display = 'none');
                document.querySelectorAll('.feed-arc-inline').forEach(a => a.remove());
            }
        });
    }
}

function _ouvrirArc(postId) { document.querySelectorAll('.feed-arc-resonance').forEach(a => { if (a.id !== `arc-${postId}`) a.style.display = 'none'; }); document.querySelectorAll('.feed-arc-inline').forEach(a => { if (a.id !== `arc-inline-${postId}`) a.remove(); }); const arc = document.getElementById(`arc-${postId}`); if (arc) arc.style.display = 'flex'; }
function _fermerArc(postId) { const arc = document.getElementById(`arc-${postId}`); if (arc) arc.style.display = 'none'; }
function ouvrirArcResonance(btn, e) { if (e) { e.preventDefault(); e.stopPropagation(); } const wrap = btn.closest('.feed-resonance-wrap'), postId = wrap?.dataset.postId; if (!postId) return; const photoWrap = document.getElementById(`photo-wrap-${postId}`); if (!_isMobile() && photoWrap) { const arc = document.getElementById(`arc-${postId}`); if (arc && arc.style.display === 'flex') { _fermerArc(postId); } else { _ouvrirArc(postId); } } else { _ouvrirArcInline(postId, btn); } }

function _ouvrirArcInline(postId, btn) {
    let inline = document.getElementById(`arc-inline-${postId}`);
    if (inline) { inline.remove(); return; }
    document.querySelectorAll('.feed-arc-inline').forEach(a => a.remove()); document.querySelectorAll('.feed-arc-resonance').forEach(a => a.style.display = 'none');
    const wrap = btn.closest('.feed-resonance-wrap');
    inline = document.createElement('div'); inline.id = `arc-inline-${postId}`; inline.className = 'feed-arc-resonance feed-arc-inline';
    inline.innerHTML = `<div class="feed-arc-label">Résonances</div><div class="feed-arc-items">${RESONANCES.map(r => `<button class="feed-arc-item" data-type="${r.type}" style="--r-color:${r.couleur}" onclick="choisirResonance(${postId}, '${r.type}', this, event)"><span class="feed-arc-icone">${r.icone}</span><span class="feed-arc-item-label">${r.label}</span></button>`).join('')}</div>`;
    wrap.appendChild(inline);
}

async function choisirResonance(postId, type, btn, e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const user = getUser();
    try {
        const r = await fetch(`/api/feed/${postId}/resonance`, { method: 'POST', headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) });
        const d = await r.json();
        if (!d.success) return;
        _fermerArc(postId); const inline = document.getElementById(`arc-inline-${postId}`); if (inline) inline.remove();
        const wrap = document.querySelector(`.feed-resonance-wrap[data-post-id="${postId}"]`); if (wrap) wrap.innerHTML = _renderResonanceBouton(postId, d.ma_resonance, d.resonances_stats || []);
        const arc = document.getElementById(`arc-${postId}`); if (arc) arc.querySelectorAll('.feed-arc-item').forEach(b => b.classList.toggle('active', b.dataset.type === d.ma_resonance));
        const photoWrap = document.getElementById(`photo-wrap-${postId}`); if (photoWrap) photoWrap.dataset.maResonance = d.ma_resonance || '';
    } catch {}
}

async function voirLikers(postId, e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const user = getUser();
    try {
        const r = await fetch(`/api/feed/${postId}/likes`, { headers: { 'Authorization': `Bearer ${user.token}` } });
        const d = await r.json();
        if (!d.success) return;
        document.getElementById('modal-title').textContent = 'Résonances';
        document.getElementById('modal-body').innerHTML = d.likers.length ? d.likers.map(l => {
            const av = l.avatar ? `<img src="${l.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">` : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#e9d5ff,#fbcfe8);color:#7c3aed;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">${_feedTrigramme(l.prenom, l.nom, l.username)}</div>`;
            const res = RESONANCES.find(r => r.type === l.type);
            return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f3f4f6">${av}<div style="flex:1"><div style="font-size:14px;font-weight:700;color:#111">${escapeHtml(l.prenom || '')} ${escapeHtml(l.nom || '')}</div><div style="font-size:12px;color:#9ca3af">@${escapeHtml(l.username)}</div></div>${res ? `<span style="font-size:20px">${res.icone}</span>` : ''}</div>`;
        }).join('') : '<p style="text-align:center;color:#9ca3af;padding:20px">Aucune résonance pour l\'instant.</p>';
        document.getElementById('overlay').classList.add('on');
    } catch {}
}

// ── ÉDITER POST (LOC3 + LOC1) ─────────────────────────────────
function editerPost(postId) {
    const contenuActuel = document.getElementById(`post-contenu-${postId}`)?.textContent || '';
    const photoActuelle = document.getElementById(`post-${postId}`)?.dataset.photoUrl || '';
    const lieuActuel = document.getElementById(`post-lieu-raw-${postId}`)?.textContent || '';
    const lieuLatActuel = document.getElementById(`post-lieulat-raw-${postId}`)?.textContent || '';
    const lieuLonActuel = document.getElementById(`post-lieulon-raw-${postId}`)?.textContent || '';

    document.getElementById('modal-title').textContent = 'Modifier le post';
    document.getElementById('modal-body').innerHTML = `
        <div id="edit-post-wrap" style="position:relative">
            <textarea id="edit-post-contenu" rows="4" style="width:100%;padding:12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;resize:vertical;box-sizing:border-box;outline:none;font-family:inherit"></textarea>
        </div>
        <div id="edit-loc-wrap" class="loc-input-wrap" style="margin-top:10px">
            <button type="button" class="loc-input-icone" onclick="rechercherLieuGeoloc('edit-post-lieu', 'edit-post-lat', 'edit-post-lon', 'edit-loc-wrap')" title="Me géolocaliser">📍</button>
            <input type="text" id="edit-post-lieu" class="loc-input" placeholder="Lieu (optionnel)" value="${escapeHtml(lieuActuel)}">
            <input type="hidden" id="edit-post-lat" value="${lieuLatActuel}">
            <input type="hidden" id="edit-post-lon" value="${lieuLonActuel}">
        </div>
        ${photoActuelle ? `<div id="edit-photo-actuelle" style="margin-top:12px"><div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:6px">Photo actuelle</div><img src="${photoActuelle}" style="width:100%;border-radius:10px;max-height:200px;object-fit:contain;background:#f3f4f6"><button id="btn-suppr-photo" onclick="marquerSuppressionPhoto()" style="margin-top:8px;padding:7px 14px;background:#fee2e2;color:#ef4444;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Supprimer la photo</button></div>` : ''}
        <div style="margin-top:12px"><label style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;display:block;margin-bottom:6px">${photoActuelle ? 'Remplacer la photo' : 'Ajouter une photo (optionnelle)'}</label><input type="file" id="edit-post-photo" accept="image/*" style="font-size:13px;color:#374151"></div>
        <div id="edit-post-preview" style="margin-top:10px"></div>
        <button onclick="sauvegarderEditionPost(${postId})" style="width:100%;margin-top:14px;padding:13px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">Sauvegarder</button>
        <div id="edit-post-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>
    `;
        const ta = document.getElementById('edit-post-contenu'); const wrap = document.getElementById('edit-post-wrap'); ta.value = contenuActuel; initMentions(ta, wrap);
    _initLieuAutocomplete('edit-post-lieu', 'edit-post-lat', 'edit-post-lon', 'edit-loc-wrap');
    document.getElementById('edit-post-photo').addEventListener('change', e => { const file = e.target.files[0]; const preview = document.getElementById('edit-post-preview'); if (file) { preview.innerHTML = `<img src="${URL.createObjectURL(file)}" style="width:100%;border-radius:10px;max-height:200px;object-fit:cover">`; } else { preview.innerHTML = ''; } });
    document.getElementById('overlay').classList.add('on');
}

window._editSupprimerPhoto = false;
function marquerSuppressionPhoto() { window._editSupprimerPhoto = true; const bloc = document.getElementById('edit-photo-actuelle'); if (bloc) bloc.innerHTML = `<div style="font-size:13px;color:#ef4444;font-weight:600;padding:8px 0">Photo supprimée à la sauvegarde</div>`; }

async function sauvegarderEditionPost(postId) {
    const user = getUser(), contenu = document.getElementById('edit-post-contenu').value.trim(), photo = document.getElementById('edit-post-photo').files[0], msg = document.getElementById('edit-post-msg');
    let lieu = (document.getElementById('edit-post-lieu')?.value || '').trim() || null;
    let lieu_lat = document.getElementById('edit-post-lat')?.value || null;
    let lieu_lon = document.getElementById('edit-post-lon')?.value || null;
    if (lieu && (!lieu_lat || !lieu_lon)) { lieu = null; lieu_lat = null; lieu_lon = null; }
    if (!contenu && !photo && window._editSupprimerPhoto) { msg.style.color = '#ef4444'; msg.textContent = 'Le post ne peut pas être vide.'; return; }
    try {
        let photoB64 = null; if (photo) { photoB64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = e => resolve(e.target.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(photo); }); }
        const body = { contenu, supprimer_photo: window._editSupprimerPhoto, lieu, lieu_lat, lieu_lon };
        if (photoB64) body.photo = photoB64;
        const r = await fetch(`/api/feed/${postId}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const d = await r.json();
        if (d.success) { window._editSupprimerPhoto = false; closeModal(); await chargerFeed(); } else { msg.style.color = '#ef4444'; msg.textContent = d.message || 'Erreur.'; }
    } catch { msg.style.color = '#ef4444'; msg.textContent = 'Erreur réseau.'; }
}

// ── COMMENTAIRES ──────────────────────────────────────────────
async function toggleCommentaires(postId) { const zone = document.getElementById(`comments-${postId}`); if (!zone) return; if (zone.style.display === 'none') { zone.style.display = 'block'; await chargerCommentaires(postId); } else { zone.style.display = 'none'; } }
async function chargerCommentaires(postId) {
    const user = getUser(), zone = document.getElementById(`comments-${postId}`); zone.innerHTML = '<div class="feed-loading">Chargement...</div>';
    try {
        const r = await fetch(`/api/feed/${postId}/comments`, { headers: { 'Authorization': `Bearer ${user.token}` } }), d = await r.json(); if (!d.success) throw new Error();
        const racines = d.comments.filter(c => !c.parent_id), reponses = d.comments.filter(c => !!c.parent_id);
        const html = racines.map(c => { const reps = reponses.filter(r => Number(r.parent_id) === Number(c.id)); return `${renderComment(c, postId, false)}${reps.length ? `<div class="feed-replies" style="margin-left:32px;border-left:2px solid #ede9fe;padding-left:10px">${reps.map(r => renderComment(r, postId, true)).join('')}</div>` : ''}`; }).join('');
        zone.innerHTML = `${html}<div class="feed-comment-form" id="comment-form-${postId}" style="position:relative"><input type="text" id="comment-input-${postId}" placeholder="Écrire un commentaire... (@Prénom NOM)" class="feed-comment-input" onkeydown="if(event.key==='Enter'&&!event.shiftKey) envoyerCommentaire(${postId})"><button onclick="envoyerCommentaire(${postId})" class="feed-comment-send">Envoyer</button></div>`;
        const inputEl = document.getElementById(`comment-input-${postId}`), wrapEl = document.getElementById(`comment-form-${postId}`); initMentions(inputEl, wrapEl);
    } catch { zone.innerHTML = '<div class="feed-empty">Erreur.</div>'; }
}

function renderComment(c, postId, isReponse = false) {
    const user = getUser(), isOwner = user.username === c.username, isAdmin = user.role === 'admin';
    const date = new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const avatar = c.avatar ? `<img src="${c.avatar}" onclick="ouvrirProfilPublic(${c.user_id})" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;cursor:pointer" alt="">` : `<div onclick="ouvrirProfilPublic(${c.user_id})" style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#e9d5ff,#fbcfe8);color:#7c3aed;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer">${_feedTrigramme(c.prenom, c.nom, c.username)}</div>`;
    return `
        <div class="feed-comment${isReponse ? ' feed-comment-reply' : ''}" id="comment-${c.id}" data-comment-id="${c.id}" style="display:flex;gap:8px;padding:8px 0;align-items:flex-start">
            ${avatar}
            <div style="flex:1;min-width:0">
                <div class="feed-comment-meta" style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">
                    <span class="feed-comment-author" style="font-size:13px;font-weight:700;color:#111;cursor:pointer" onclick="ouvrirProfilPublic(${c.user_id})">${escapeHtml(c.prenom || '')} ${escapeHtml(c.nom || '')}</span>
                    <span class="feed-comment-date" style="font-size:11px;color:#9ca3af">${date}</span>
                    <div class="feed-comment-actions" style="display:flex;align-items:center;gap:4px;margin-left:auto">
                        ${isOwner || isAdmin ? `<button class="feed-comment-edit-btn" onclick="editerCommentaire(${c.id}, ${postId})" title="Modifier"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="feed-comment-delete" onclick="supprimerCommentaire(${c.id}, ${postId})" title="Supprimer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>` : ''}
                        <button class="feed-comment-like-btn ${c.liked ? 'liked' : ''}" onclick="toggleLikeCommentaire(${c.id}, this)"><svg width="12" height="12" viewBox="0 0 24 24" fill="${c.liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg><span class="comment-like-count">${c.likes}</span></button>
                        ${!isReponse ? `<button class="feed-comment-reply-btn" onclick="afficherFormulaireReponse(${c.id}, ${postId}, '${escapeHtml(c.prenom || '')} ${escapeHtml(c.nom || '')}')" style="font-size:11px;font-weight:600;color:#7c3aed;background:none;border:none;cursor:pointer;padding:2px 4px">Répondre</button>` : ''}
                    </div>
                </div>
                <div class="feed-comment-contenu" id="comment-text-${c.id}" style="font-size:13px;color:#374151;margin-top:3px;line-height:1.5">${renderContenuAvecMentions(c.contenu, c.mentions_data)}</div>
                <div class="feed-comment-raw" id="comment-raw-${c.id}" style="display:none">${escapeHtml(c.contenu)}</div>
                <div id="reply-form-${c.id}"></div>
            </div>
        </div>
    `;
}

function afficherFormulaireReponse(parentId, postId, nomAuteur) {
    document.querySelectorAll('[id^="reply-form-"]').forEach(el => el.innerHTML = ''); const zone = document.getElementById(`reply-form-${parentId}`); if (!zone) return;
    zone.innerHTML = `<div id="reply-wrap-${parentId}" style="display:flex;gap:6px;margin-top:6px;align-items:center;position:relative"><input type="text" id="reply-input-${parentId}" placeholder="Répondre à ${escapeHtml(nomAuteur)}..." style="flex:1;padding:6px 10px;border:1.5px solid #7c3aed;border-radius:20px;font-size:13px;outline:none;font-family:inherit"><button onclick="envoyerReponse(${parentId}, ${postId})" style="padding:6px 12px;background:#7c3aed;color:#fff;border:none;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer">Envoyer</button><button onclick="document.getElementById('reply-form-${parentId}').innerHTML=''" style="padding:6px 10px;background:#f3f4f6;color:#374151;border:none;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer">✕</button></div>`;
    const inputEl = document.getElementById(`reply-input-${parentId}`), wrapEl = document.getElementById(`reply-wrap-${parentId}`);
    if (inputEl) { inputEl.value = ''; inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyerReponse(parentId, postId); } }); inputEl.focus(); }
    initMentions(inputEl, wrapEl);
}

async function envoyerReponse(parentId, postId) {
    const user = getUser(), input = document.getElementById(`reply-input-${parentId}`), text = (input?.value || '').trim(); if (!text) return;
    try { const r = await fetch(`/api/feed/${postId}/comments`, { method: 'POST', headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ contenu: text, parent_id: parentId }) }), d = await r.json(); if (d.success) { await chargerCommentaires(postId); const btn = document.querySelector(`#post-${postId} .feed-comment-btn span`); if (btn) btn.textContent = parseInt(btn.textContent) + 1; } } catch {}
}

async function envoyerCommentaire(postId) {
    const user = getUser(), input = document.getElementById(`comment-input-${postId}`), text = (input?.value || '').trim(); if (!text) return;
    try { const r = await fetch(`/api/feed/${postId}/comments`, { method: 'POST', headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ contenu: text }) }), d = await r.json(); if (d.success) { input.value = ''; await chargerCommentaires(postId); const btn = document.querySelector(`#post-${postId} .feed-comment-btn span`); if (btn) btn.textContent = parseInt(btn.textContent) + 1; } } catch {}
}

function editerCommentaire(commentId, postId) {
    const contenuActuel = document.getElementById(`comment-raw-${commentId}`)?.textContent || '', textEl = document.getElementById(`comment-text-${commentId}`); if (!textEl) return;
    textEl.innerHTML = `<div id="edit-comment-wrap-${commentId}" style="display:flex;gap:6px;margin-top:4px;position:relative"><input type="text" id="edit-comment-input-${commentId}" style="flex:1;padding:6px 10px;border:1.5px solid #7c3aed;border-radius:20px;font-size:13px;outline:none;font-family:inherit"><button onclick="sauvegarderEditionCommentaire(${commentId}, ${postId})" style="padding:6px 12px;background:#7c3aed;color:#fff;border:none;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer">OK</button><button onclick="chargerCommentaires(${postId})" style="padding:6px 10px;background:#f3f4f6;color:#374151;border:none;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer">✕</button></div>`;
    const input = document.getElementById(`edit-comment-input-${commentId}`), wrap = document.getElementById(`edit-comment-wrap-${commentId}`);
    if (input) { input.value = contenuActuel; input.focus(); }
    initMentions(input, wrap);
}

async function sauvegarderEditionCommentaire(commentId, postId) {
    const user = getUser(), input = document.getElementById(`edit-comment-input-${commentId}`), contenu = (input?.value || '').trim(); if (!contenu) return;
    try { const r = await fetch(`/api/feed/comments/${commentId}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ contenu }) }), d = await r.json(); if (d.success) await chargerCommentaires(postId); } catch {}
}

function supprimerCommentaire(commentId, postId) {
    document.getElementById('modal-title').textContent = 'Confirmation';
    document.getElementById('modal-body').innerHTML = `<p style="color:#333;font-size:15px;margin-bottom:20px">Confirmer la suppression ?</p><div style="display:flex;gap:8px"><button id="btn-delcomment-oui" style="flex:1;padding:13px;background:#ef4444;color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">Confirmer</button><button id="btn-delcomment-non" style="flex:1;padding:13px;background:#f3f4f6;color:#374151;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">Annuler</button></div>`;
    document.getElementById('overlay').classList.add('on');
    document.getElementById('btn-delcomment-non').onclick = () => document.getElementById('overlay').classList.remove('on');
    document.getElementById('btn-delcomment-oui').onclick = async () => { const user = getUser(); try { const r = await fetch(`/api/feed/comments/${commentId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` } }), d = await r.json(); if (d.success) { document.getElementById('overlay').classList.remove('on'); await chargerCommentaires(postId); const btn = document.querySelector(`#post-${postId} .feed-comment-btn span`); if (btn) btn.textContent = Math.max(0, parseInt(btn.textContent) - 1); } } catch {} };
}

async function toggleLikeCommentaire(commentId, btn) {
    const user = getUser();
    try {
        const r = await fetch(`/api/feed/comments/${commentId}/like`, { method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` } }), d = await r.json();
        if (!d.success) return; btn.classList.toggle('liked', d.liked); const svg = btn.querySelector('svg'); if (svg) svg.setAttribute('fill', d.liked ? 'currentColor' : 'none'); const span = btn.querySelector('.comment-like-count'); if (span) span.textContent = parseInt(span.textContent) + (d.liked ? 1 : -1);
    } catch {}
}

function supprimerPost(postId) {
    document.getElementById('modal-title').textContent = 'Confirmation';
    document.getElementById('modal-body').innerHTML = `<p style="color:#333;font-size:15px;margin-bottom:20px">Confirmer la suppression ?</p><div style="display:flex;gap:8px"><button id="btn-delpost-oui" style="flex:1;padding:13px;background:#ef4444;color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">Confirmer</button><button id="btn-delpost-non" style="flex:1;padding:13px;background:#f3f4f6;color:#374151;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">Annuler</button></div>`;
    document.getElementById('overlay').classList.add('on');
    document.getElementById('btn-delpost-non').onclick = () => document.getElementById('overlay').classList.remove('on');
    document.getElementById('btn-delpost-oui').onclick = async () => { const user = getUser(); try { const r = await fetch(`/api/feed/${postId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` } }), d = await r.json(); if (d.success) { document.getElementById('overlay').classList.remove('on'); document.getElementById(`post-${postId}`)?.remove(); } } catch {} };
}

async function toggleFollow(userId, btn) {
    const user = getUser();
    try {
        const r = await fetch(`/api/feed/follow/${userId}`, { method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` } }), d = await r.json();
        if (!d.success) return;
        if (d.following) { feedFollowing.push(userId); btn.textContent = 'Abonné'; btn.classList.add('following'); } else { feedFollowing = feedFollowing.filter(id => id !== userId); btn.textContent = 'Suivre'; btn.classList.remove('following'); }
    } catch {}
}

// ── MODAL NOUVEAU POST (LOC1) ─────────────────────────────────
function ouvrirModalPost() {
    window._editSupprimerPhoto = false;
    document.getElementById('overlay').classList.add('on');
    document.getElementById('modal-title').textContent = 'Nouveau post';
    document.getElementById('modal-body').innerHTML = `
        <div id="new-post-wrap" style="position:relative">
            <textarea id="post-contenu" placeholder="Quoi de neuf ? (@Prénom NOM pour mentionner)" rows="4" style="width:100%;padding:12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;resize:vertical;box-sizing:border-box;outline:none;font-family:inherit"></textarea>
        </div>
        <div id="new-loc-wrap" class="loc-input-wrap" style="margin-top:10px">
            <button type="button" class="loc-input-icone" onclick="rechercherLieuGeoloc('post-lieu', 'post-lat', 'post-lon', 'new-loc-wrap')" title="Me géolocaliser">📍</button>
            <input type="text" id="post-lieu" class="loc-input" placeholder="Lieu (optionnel)">
            <input type="hidden" id="post-lat" value="">
            <input type="hidden" id="post-lon" value="">
        </div>
                <div style="margin-top:10px"><label style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;display:block;margin-bottom:6px">Photo (optionnelle)</label><input type="file" id="post-photo" accept="image/*" style="font-size:13px;color:#374151"></div>
        <div id="post-preview" style="margin-top:10px"></div>
        <button onclick="publierPost()" style="width:100%;margin-top:16px;padding:13px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">Publier</button>
        <div id="post-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>
    `;
    const ta = document.getElementById('post-contenu'), wrap = document.getElementById('new-post-wrap'); initMentions(ta, wrap);
    _initLieuAutocomplete('post-lieu', 'post-lat', 'post-lon', 'new-loc-wrap');
    document.getElementById('post-photo').addEventListener('change', e => { const file = e.target.files[0]; const preview = document.getElementById('post-preview'); if (file) { preview.innerHTML = `<img src="${URL.createObjectURL(file)}" style="width:100%;border-radius:10px;max-height:200px;object-fit:cover">`; } else { preview.innerHTML = ''; } });
}

async function publierPost() {
    const user = getUser(), contenu = document.getElementById('post-contenu').value.trim(), photo = document.getElementById('post-photo').files[0], msg = document.getElementById('post-msg');
    let lieu = (document.getElementById('post-lieu')?.value || '').trim() || null;
    let lieu_lat = document.getElementById('post-lat')?.value || null;
    let lieu_lon = document.getElementById('post-lon')?.value || null;
    if (lieu && (!lieu_lat || !lieu_lon)) { lieu = null; lieu_lat = null; lieu_lon = null; }
    if (!contenu && !photo) { msg.style.color = '#ef4444'; msg.textContent = 'Le post ne peut pas être vide.'; return; }
    try {
        let photoB64 = null; if (photo) { photoB64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = e => resolve(e.target.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(photo); }); }
        const body = { contenu, lieu, lieu_lat, lieu_lon }; if (photoB64) body.photo = photoB64;
        const r = await fetch('/api/feed', { method: 'POST', headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const d = await r.json();
        if (d.success) { closeModal(); await chargerFeed(); } else { msg.style.color = '#ef4444'; msg.textContent = d.message || 'Erreur.'; }
    } catch { msg.style.color = '#ef4444'; msg.textContent = 'Erreur réseau.'; }
}

// ── PROFIL PUBLIC (B4) ────────────────────────────────────────
async function ouvrirProfilPublic(userId) {
    const user = getUser();
    try {
        const r = await fetch(`/api/profil/public/${userId}`, { headers: { 'Authorization': `Bearer ${user.token}` } });
        const d = await r.json();
        if (!d.success) return;
        const p = d.profil, isSelf = String(user.userId) === String(p.id);
        const avatar = p.photo ? `<img src="${p.photo}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #7c3aed">` : `<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#e9d5ff,#fbcfe8);color:#7c3aed;font-size:26px;font-weight:700;display:flex;align-items:center;justify-content:center">${_feedTrigramme(p.prenom, p.nom, p.username)}</div>`;
        const abonnesEl = isSelf ? `<div style="cursor:pointer" onclick="voirAbonnes(${p.id})"><div style="font-size:20px;font-weight:800;color:#7c3aed">${p.nb_abonnes}</div><div style="font-size:11px;color:#7c3aed;font-weight:600;text-transform:uppercase;text-decoration:underline">Abonnés</div></div>` : `<div><div style="font-size:20px;font-weight:800;color:#111">${p.nb_abonnes}</div><div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase">Abonnés</div></div>`;

        const infosPubliques = [];
        if (p.age) infosPubliques.push(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase">Âge</span><span style="font-size:13px;color:#374151;text-align:right">${escapeHtml(String(p.age))} ans</span></div>`);
        if (p.profession) infosPubliques.push(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase">Profession</span><span style="font-size:13px;color:#374151;text-align:right">${escapeHtml(p.profession)}</span></div>`);
        if (p.site_web) infosPubliques.push(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase">Site</span><a href="${escapeHtml(p.site_web)}" target="_blank" rel="noopener" style="font-size:13px;color:#7c3aed;text-decoration:underline;text-align:right;word-break:break-all">${escapeHtml(p.site_web)}</a></div>`);
        if (p.signe_astro && p.signe_astro.label) infosPubliques.push(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase">Signe astro</span><span style="font-size:13px;color:#374151;text-align:right">${escapeHtml(p.signe_astro.emoji || '')} ${escapeHtml(p.signe_astro.label)}</span></div>`);
        const blocInfos = infosPubliques.length ? `<div style="width:100%;display:flex;flex-direction:column;gap:8px;background:#f9fafb;border-radius:12px;padding:12px 14px;box-sizing:border-box">${infosPubliques.join('')}</div>` : '';

        let btnMessageHTML = '';
        if (!isSelf) {
            btnMessageHTML = `
                <button id="btn-profil-message" 
                    onclick="document.getElementById('overlay').classList.remove('on'); Tchat.ouvrirConversation({id: ${p.id}, username: '${escapeHtml(p.username)}', prenom: '${escapeHtml(p.prenom || '')}', nom: '${escapeHtml(p.nom || '')}', photo: '${escapeHtml(p.photo || '')}'})"
                    style="width:100%;padding:12px;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;background:#fff;color:#7c3aed;border:2px solid #7c3aed;margin-bottom:8px;">
                    Envoyer un message
                </button>
            `;
        }

        document.getElementById('modal-title').textContent = '';
        document.getElementById('modal-body').innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0">
                ${avatar}
                <div style="text-align:center"><div style="font-size:18px;font-weight:700;color:#111">${escapeHtml(p.prenom || '')} ${escapeHtml(p.nom || '')}</div><div style="font-size:13px;color:#9ca3af;margin-top:2px">@${escapeHtml(p.username)}</div></div>
                <div style="display:flex;gap:24px;text-align:center;background:#f9fafb;border-radius:14px;padding:14px 24px;width:100%;justify-content:center;box-sizing:border-box">
                    <div><div style="font-size:20px;font-weight:800;color:#111">${p.nb_posts}</div><div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase">Posts</div></div>
                    ${abonnesEl}
                    <div><div style="font-size:20px;font-weight:800;color:#111">${p.nb_abonnements}</div><div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase">Abonnements</div></div>
                </div>
                ${blocInfos}
                <div style="width:100%;display:flex;flex-direction:column;">
                    ${btnMessageHTML}
                    ${!isSelf ? `<button id="btn-profil-follow" onclick="toggleFollowDepuisProfil(${p.id}, this)" style="width:100%;padding:12px;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;background:${p.suivi ? '#f3f4f6' : 'linear-gradient(135deg,#7c3aed,#6d28d9)'};color:${p.suivi ? '#374151' : '#fff'}">${p.suivi ? 'Abonné' : 'Suivre'}</button>` : ''}
                </div>
                ${p.note ? `<div style="width:100%;background:#f9fafb;border-radius:12px;padding:12px 14px;border-left:3px solid #7c3aed;box-sizing:border-box"><div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;margin-bottom:4px">Note</div><div style="font-size:13px;color:#555;line-height:1.5">${escapeHtml(p.note)}</div></div>` : ''}
            </div>
        `;
        document.getElementById('overlay').classList.add('on');
    } catch {}
}

async function voirAbonnes(userId) {
    const user = getUser();
    try {
        const r = await fetch(`/api/profil/abonnes/${userId}`, { headers: { 'Authorization': `Bearer ${user.token}` } }), d = await r.json();
        if (!d.success) return; document.getElementById('modal-title').textContent = 'Mes abonnés';
        document.getElementById('modal-body').innerHTML = d.abonnes.length ? d.abonnes.map(a => { const av = a.photo ? `<img src="${a.photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">` : `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#e9d5ff,#fbcfe8);color:#7c3aed;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${_feedTrigramme(a.prenom, a.nom, a.username)}</div>`; return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f3f4f6;cursor:pointer" onclick="ouvrirProfilPublic(${a.id})">${av}<div><div style="font-size:14px;font-weight:700;color:#111">${escapeHtml(a.prenom || '')} ${escapeHtml(a.nom || '')}</div><div style="font-size:12px;color:#9ca3af">@${escapeHtml(a.username)}</div></div></div>`; }).join('') : '<p style="text-align:center;color:#9ca3af;padding:24px 0">Aucun abonné pour l\'instant.</p>';
        document.getElementById('overlay').classList.add('on');
    } catch {}
}

async function toggleFollowDepuisProfil(userId, btn) {
    const user = getUser();
    try {
        const r = await fetch(`/api/feed/follow/${userId}`, { method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` } }), d = await r.json(); if (!d.success) return;
        if (d.following) { feedFollowing.push(userId); btn.textContent = 'Abonné'; btn.style.background = '#f3f4f6'; btn.style.color = '#374151'; } else { feedFollowing = feedFollowing.filter(id => id !== userId); btn.textContent = 'Suivre'; btn.style.background = 'linear-gradient(135deg,#7c3aed,#6d28d9)'; btn.style.color = '#fff'; }
        const feedBtn = document.querySelector(`#feed-list .feed-follow-btn[onclick="toggleFollow(${userId}, this)"]`); if (feedBtn) { feedBtn.textContent = d.following ? 'Abonné' : 'Suivre'; feedBtn.classList.toggle('following', d.following); }
    } catch {}
}

function ouvrirPhoto(url) { document.getElementById('overlay').classList.add('on'); document.getElementById('modal-title').textContent = ''; document.getElementById('modal-body').innerHTML = `<img src="${url}" style="width:100%;border-radius:10px;max-height:70vh;object-fit:contain">`; }

async function partagerPost(postId) {
    const card = document.getElementById(`post-${postId}`), contenuEl = document.getElementById(`post-contenu-${postId}`), contenu = contenuEl ? contenuEl.textContent.trim() : '', photoUrl = card?.dataset.photoUrl || '', text = contenu.substring(0, 100) || 'Regarde ce post sur MoaDja';
    if (navigator.share) { try { const shareData = { title: 'MoaDja', text }; shareData.url = photoUrl || location.origin; await navigator.share(shareData); } catch (e) { if (e.name !== 'AbortError') console.error(e); } } else { try { await navigator.clipboard.writeText(`${text}\n${photoUrl || location.origin}`); document.getElementById('modal-title').textContent = 'Lien copié'; document.getElementById('modal-body').innerHTML = `<p style="text-align:center;color:#374151;padding:20px 0">Le lien a été copié dans le presse-papier.</p><button onclick="closeModal()" style="width:100%;padding:12px;background:#7c3aed;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">OK</button>`; document.getElementById('overlay').classList.add('on'); } catch (e) { console.error('clipboard', e); } }
}

function escapeHtml(str) { return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
