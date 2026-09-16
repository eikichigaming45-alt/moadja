// ============================================================
// public/js/feedMentions.js
// Fil social — Module Mentions (@) & Hashtags (#) (extrait de feed.js)
// Rendu, autocomplete, insertion des mentions et hashtags.
// Dépend de : feed.js (escapeHtml, getUser, _feedTrigramme, ouvrirProfilPublic, filtrerParHashtag)
// ============================================================

function _renderHashtags(texte) {
    return texte.replace(/(<[^>]*>)|(&#?[a-zA-Z0-9]+;)|#([a-zA-ZÀ-ÿ0-9_]+)/g, (match, tag_html, entity_html, tag) => {
        if (tag_html) return tag_html;
        if (entity_html) return entity_html;
        return `<span class="hashtag-tag" data-tag="${tag.toLowerCase()}">#${tag}</span>`;
    });
}

function renderContenuAvecMentions(contenu, mentionsData) {
    if (!contenu) return '';
    if (!mentionsData || !mentionsData.length) return _renderHashtags(escapeHtml(contenu).replace(/@toutlemonde/gi, '<span class="mention-tag">@Tout le monde</span>'));
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
            placeholders.push({ placeholder, html: `<span class="mention-tag" data-user-id="${m.id}">@${escapeHtml(full)}</span>` });
        }
    }
    result = result.replace(/@toutlemonde/gi, '%%TOUTLEMONDE%%');
    result = escapeHtml(result);
    for (const { placeholder, html } of placeholders) result = result.split(escapeHtml(placeholder)).join(html);
    result = result.split('%%TOUTLEMONDE%%').join('<span class="mention-tag">@Tout le monde</span>');
    return _renderHashtags(result);
}

document.addEventListener('click', e => {
    const tag = e.target.closest('.mention-tag');
    if (tag && tag.dataset.userId) { e.stopPropagation(); ouvrirProfilPublic(parseInt(tag.dataset.userId)); }
    const hash = e.target.closest('.hashtag-tag');
    if (hash) { e.stopPropagation(); filtrerParHashtag(hash.dataset.tag); }
});

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
    inputEl.focus();    _fermerDropdown(dropEl);
}

function _fermerDropdown(dropEl) { if (dropEl) { dropEl.innerHTML = ''; dropEl.style.display = 'none'; } }
