// ============================================================
// public/js/admin.js
// Dashboard admin — widget + modale stats/users + CRUD.
// ============================================================

// ===================== WIDGET ADMIN (dashboard) ==============

async function chargerWidgetAdmin() {
    const user = getUser();
    if (!user?.token || user.role !== 'admin') return;
    const el = document.getElementById('wc-admin');
    if (!el) return;
    try {
        const r = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) { el.innerHTML = '<p class="wa-error">Erreur serveur</p>'; return; }
        el.innerHTML = `
            <div class="wa-stats-row">
                <div class="wa-stat wa-stat-blue">
                    <div class="wa-stat-val">${d.totalUsers}</div>
                    <div class="wa-stat-lbl">Utilisateurs</div>
                </div>
                <div class="wa-stat wa-stat-purple">
                    <div class="wa-stat-val">${d.actifsRecents}</div>
                    <div class="wa-stat-lbl">Actifs 7j</div>
                </div>
                <div class="wa-stat wa-stat-green">
                    <div class="wa-stat-val">${d.profilsRemplis}</div>
                    <div class="wa-stat-lbl">Profils</div>
                </div>
                <div class="wa-stat wa-stat-orange">
                    <div class="wa-stat-val">${d.jamaisActifs}</div>
                    <div class="wa-stat-lbl">Inactifs</div>
                </div>
            </div>
            <div class="wa-activity-title">Dernière activité</div>
            ${(d.lastActivity || []).map(u => {
                const initiale  = (u.prenom ? u.prenom[0] : u.username[0]).toUpperCase();
                const affichage = (u.prenom && u.nom)
                    ? u.prenom + ' ' + u.nom.toUpperCase()
                    : u.username;
                return `
                <div class="wa-activity-row">
                    <div class="wa-avatar ${u.role === 'admin' ? 'wa-avatar-admin' : 'wa-avatar-user'}">${initiale}</div>
                    <div class="wa-username">${affichage}</div>
                    <span class="wa-badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role}</span>
                    <div class="wa-date">${u.lastActivity ? _formatDateRelative(u.lastActivity) : '<span style="color:#d1d5db">Jamais</span>'}</div>
                </div>`;
            }).join('')}
        `;
    } catch {
        el.innerHTML = '<p class="wa-error">Erreur réseau</p>';
    }
}

// ===================== UTILITAIRES DATE ======================

function _formatDateRelative(dateStr) {
    if (!dateStr) return '—';
    const date    = new Date(dateStr);
    const now     = new Date();
    const diffMs  = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffH   = Math.floor(diffMs / 3600000);
    const diffJ   = Math.floor(diffMs / 86400000);
    if (diffMin < 2)  return '<span style="color:#10b981;font-weight:700">À l\'instant</span>';
    if (diffMin < 60) return `<span style="color:#10b981;font-weight:600">Il y a ${diffMin} min</span>`;
    if (diffH < 24)   return `<span style="color:#f59e0b;font-weight:600">Il y a ${diffH}h</span>`;
    if (diffJ === 1)  return '<span style="color:#6b7280">Hier</span>';
    if (diffJ < 7)    return `<span style="color:#6b7280">Il y a ${diffJ} jours</span>`;
    return `<span style="color:#9ca3af">${date.toLocaleDateString('fr-FR')}</span>`;
}

function _formatDateComplete(dateStr) {
    if (!dateStr) return 'Jamais';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' à ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ===================== MODALE ADMIN — STATS ==================

async function chargerAdminStats() {
    const user = getUser();
    const el   = document.getElementById('admin-tab-stats');
    if (!el) return;
    el.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px 0">Chargement...</p>';
    try {
        const r = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) { el.innerHTML = `<p style="color:#ef4444">${d.message}</p>`; return; }

        const tauxProfils = d.totalUsers > 0
            ? Math.round((d.profilsRemplis / d.totalUsers) * 100)
            : 0;

        const medailles = ['🥇', '🥈', '🥉', '4.', '5.'];

        const widgetLabels = {
    'agenda'        : '📅 Agenda',
    'anniversaires' : '🎂 Anniversaires',
    'astrologie'    : '✨ Astrologie',
    'priere'        : '🙏 Prière du jour',
    'islam'         : '🌙 Prières & Hadiths',
    'sante'         : '🥗 Santé',
    'social'        : '🤝 Social',
    'cycle'         : '🌸 Suivi du cycle',
    'taches'        : '✅ Tâches',
    'admin'         : '⚙️ Administration',
    'meteo'         : '🌤️ Météo',
    'theme-astral'  : '🔯 Thème Astral',
    'profil'        : '👤 Profil'
};

        el.innerHTML = `
            <div class="as-section-title">Utilisateurs</div>
            <div class="as-cards-grid">
                <div class="as-card as-card-blue">
                    <div class="as-card-icon">👥</div>
                    <div class="as-card-val">${d.totalUsers}</div>
                    <div class="as-card-lbl">Total</div>
                </div>
                <div class="as-card as-card-purple">
                    <div class="as-card-icon">⚙️</div>
                    <div class="as-card-val">${d.totalAdmins}</div>
                    <div class="as-card-lbl">Admins</div>
                </div>
                <div class="as-card as-card-green">
                    <div class="as-card-icon">🟢</div>
                    <div class="as-card-val">${d.actifsRecents}</div>
                    <div class="as-card-lbl">Actifs 7j</div>
                </div>
                <div class="as-card as-card-red">
                    <div class="as-card-icon">💤</div>
                    <div class="as-card-val">${d.jamaisActifs}</div>
                    <div class="as-card-lbl">Jamais actifs</div>
                </div>
            </div>

            <div class="as-progress-bloc">
                <div class="as-progress-header">
                    <span class="as-progress-label">Profils remplis</span>
                    <span class="as-progress-pct">${d.profilsRemplis}/${d.totalUsers} — ${tauxProfils}%</span>
                </div>
                <div class="as-progress-bar">
                    <div class="as-progress-fill as-fill-blue" style="width:${tauxProfils}%"></div>
                </div>
            </div>

            <div class="as-section-title" style="margin-top:20px">Top contributeurs</div>
            <div class="as-contrib-list">
                ${(d.topContributeurs || []).map((u, i) => {
                    const affichage = (u.prenom && u.nom)
                        ? u.prenom + ' ' + u.nom.toUpperCase()
                        : u.username;
                    const initiale = (u.prenom ? u.prenom[0] : u.username[0]).toUpperCase();
                    const details = [
                        u.posts         > 0 ? `${u.posts} post${u.posts > 1 ? 's' : ''}`          : null,
                        u.commentaires  > 0 ? `${u.commentaires} comment.`                          : null,
                        u.likes         > 0 ? `${u.likes} like${u.likes > 1 ? 's' : ''}`           : null,
                        u.rdv           > 0 ? `${u.rdv} RDV`                                        : null,
                        u.taches        > 0 ? `${u.taches} tâche${u.taches > 1 ? 's' : ''}`        : null,
                        u.anniversaires > 0 ? `${u.anniversaires} anniv.`                           : null,
                    ].filter(Boolean).join(' · ');
                    return `
                    <div class="as-contrib-row">
                        <div class="as-contrib-medal">${medailles[i]}</div>
                        <div class="as-login-avatar ${u.role === 'admin' ? 'as-av-admin' : 'as-av-user'}">${initiale}</div>
                        <div class="as-contrib-info">
                            <div class="as-contrib-name">${affichage}
                                <span class="as-badge ${u.role === 'admin' ? 'as-badge-admin' : 'as-badge-user'}">${u.role}</span>
                            </div>
                            <div class="as-contrib-detail">${details || 'Aucune activité'}</div>
                        </div>
                        <div class="as-contrib-score">${u.score} pts</div>
                    </div>`;
                }).join('') || '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:12px 0">Aucune donnée.</p>'}
            </div>

            <div class="as-section-title" style="margin-top:20px">Widgets les plus utilisés</div>
            <div class="as-widgets-list">
                ${(d.widgetsPopulaires || []).length === 0
                    ? '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:12px 0">Aucune ouverture enregistrée pour le moment.</p>'
                    : (d.widgetsPopulaires || []).map((w, i) => {
                        const label = widgetLabels[w.widget] || w.widget;
                        const maxNb = parseInt(d.widgetsPopulaires[0]?.nb) || 1;
                        const pct   = Math.round((parseInt(w.nb) / maxNb) * 100);
                        return `
                        <div class="as-widget-row">
                            <div class="as-widget-label">${label}</div>
                            <div class="as-widget-bar-wrap">
                                <div class="as-widget-bar-fill" style="width:${pct}%;background:${i === 0 ? '#4f46e5' : i === 1 ? '#7c3aed' : '#a78bfa'}"></div>
                            </div>
                            <div class="as-widget-count">${w.nb}</div>
                        </div>`;
                    }).join('')
                }
            </div>

            <div class="as-section-title" style="margin-top:20px">Dernière activité</div>
            <div class="as-logins-list">
                ${(d.lastActivity || []).map(u => {
                    const initiale  = (u.prenom ? u.prenom[0] : u.username[0]).toUpperCase();
                    const affichage = (u.prenom && u.nom)
                        ? u.prenom + ' ' + u.nom.toUpperCase()
                        : u.username;
                    return `
                    <div class="as-login-row">
                        <div class="as-login-avatar ${u.role === 'admin' ? 'as-av-admin' : 'as-av-user'}">${initiale}</div>
                        <div class="as-login-info">
                            <div class="as-login-name">${affichage}
                                <span class="as-badge ${u.role === 'admin' ? 'as-badge-admin' : 'as-badge-user'}">${u.role}</span>
                            </div>
                            <div class="as-login-date">${u.lastActivity ? _formatDateComplete(u.lastActivity) : 'Jamais actif'}</div>
                        </div>
                        <div class="as-login-relative">${_formatDateRelative(u.lastActivity)}</div>
                    </div>`;
                }).join('') || '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:12px 0">Aucune activité.</p>'}
            </div>
        `;
    } catch {
        el.innerHTML = '<p style="color:#ef4444;font-size:13px;text-align:center">Erreur réseau.</p>';
    }
}

// ===================== MODALE ADMIN — UTILISATEURS ===========

async function chargerAdminUsers() {
    const user = getUser();
    const el   = document.getElementById('admin-tab-users');
    if (!el) return;
    el.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px 0">Chargement...</p>';
    try {
        const r = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) { el.innerHTML = `<p style="color:#ef4444">${d.message}</p>`; return; }
        window._adminUsersCache = d.users || [];
        _renderAdminUsers();
    } catch {
        el.innerHTML = '<p style="color:#ef4444;font-size:13px;text-align:center">Erreur réseau.</p>';
    }
}

function _renderAdminUsers() {
    const el = document.getElementById('admin-tab-users');
    if (!el) return;
    el.innerHTML = `
        <form autocomplete="off" onsubmit="return false" style="margin-bottom:12px">
            <input type="text" id="admin-search"
                placeholder="🔍 Rechercher un utilisateur..."
                oninput="_filtrerAdminUsers()"
                autocomplete="off"
                style="width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:10px;
                       font-size:14px;outline:none;box-sizing:border-box;background:#f8fafc">
        </form>
        <button onclick="_toggleCreerForm()" id="btn-creer-user"
            style="width:100%;padding:11px;background:linear-gradient(135deg,#4f46e5,#7c3aed);
                   color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;
                   cursor:pointer;margin-bottom:12px;display:flex;align-items:center;
                   justify-content:center;gap:6px">
            ➕ Créer un utilisateur
        </button>
        <div id="admin-creer-form" style="display:none;background:#f8fafc;border-radius:12px;
             padding:16px;margin-bottom:12px;border:1.5px solid #e5e7eb">
            <div style="font-size:13px;font-weight:700;color:#1e1b4b;margin-bottom:12px">Nouveau compte</div>
            <input type="text" id="new-username" placeholder="Nom d'utilisateur"
                autocomplete="off" name="new-username-field"
                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;
                       font-size:14px;outline:none;box-sizing:border-box;margin-bottom:8px">
            <input type="text" id="new-password-fake"
                style="display:none;position:absolute;left:-9999px" aria-hidden="true">
            <input type="password" id="new-password"
                autocomplete="new-password" name="new-password-field"
                placeholder="8 car. min · majuscule · minuscule · chiffre · spécial"
                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;
                       font-size:14px;outline:none;box-sizing:border-box;margin-bottom:8px">
            <select id="new-role"
                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;
                       font-size:14px;outline:none;box-sizing:border-box;margin-bottom:12px;background:#fff">
                <option value="user">user</option>
                <option value="admin">admin</option>
            </select>
            <button onclick="creerUser()" class="ua-btn ua-btn-blue"
                style="width:100%;padding:10px;font-size:13px;justify-content:center">
                ✓ Créer l'utilisateur
            </button>
            <div id="create-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>
        </div>
        <div id="admin-users-liste"></div>
    `;
    setTimeout(() => {
        const s = document.getElementById('admin-search');
        if (s) s.value = '';
        _filtrerAdminUsers();
    }, 50);
}

function _toggleCreerForm() {
    const f = document.getElementById('admin-creer-form');
    const b = document.getElementById('btn-creer-user');
    if (!f || !b) return;
    const visible = f.style.display !== 'none';
    f.style.display = visible ? 'none' : 'block';
    b.innerHTML     = visible ? '➕ Créer un utilisateur' : '✕ Fermer';
    if (!visible) {
        setTimeout(() => {
            const u = document.getElementById('new-username');
            const p = document.getElementById('new-password');
            const r = document.getElementById('new-role');
            const m = document.getElementById('create-msg');
            if (u) u.value = '';
            if (p) p.value = '';
            if (r) r.value = 'user';
            if (m) m.textContent = '';
            if (u) u.focus();
        }, 50);
    }
}

function _filtrerAdminUsers() {
    const q     = (document.getElementById('admin-search')?.value || '').toLowerCase().trim();
    const users = (window._adminUsersCache || [])
        .filter(u =>
            !q
            || u.username.toLowerCase().includes(q)
            || (u.prenom && u.prenom.toLowerCase().includes(q))
            || (u.nom    && u.nom.toLowerCase().includes(q))
        )
        .sort((a, b) => {
            if (a.role === 'admin' && b.role !== 'admin') return -1;
            if (a.role !== 'admin' && b.role === 'admin') return  1;
            const nomA    = (a.nom    || a.username).toLowerCase();
            const nomB    = (b.nom    || b.username).toLowerCase();
            const prenomA = (a.prenom || '').toLowerCase();
            const prenomB = (b.prenom || '').toLowerCase();
            if (nomA !== nomB) return nomA.localeCompare(nomB, 'fr');
            return prenomA.localeCompare(prenomB, 'fr');
        });
    const el = document.getElementById('admin-users-liste');
    if (!el) return;
    el.innerHTML = users.length ? users.map(u => {
        const initiale  = (u.prenom ? u.prenom[0] : u.username[0]).toUpperCase();
        const affichage = (u.prenom && u.nom)
            ? u.prenom + ' ' + u.nom.toUpperCase()
            : u.username;
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;
                    border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px">
            <div class="as-login-avatar ${u.role === 'admin' ? 'as-av-admin' : 'as-av-user'}"
                 style="width:36px;height:36px;font-size:15px;flex-shrink:0">${initiale}</div>
            <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;color:#1e1b4b;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    ${affichage}
                    <span class="as-badge ${u.role === 'admin' ? 'as-badge-admin' : 'as-badge-user'}">${u.role}</span>
                </div>
                <div style="font-size:11px;color:#9ca3af;margin-top:2px">
                    ${u.lastActivity
                        ? _formatDateComplete(u.lastActivity) + ' — ' + _formatDateRelative(u.lastActivity)
                        : 'Jamais actif'}
                </div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
                <button class="au-btn au-btn-role" title="${u.role === 'admin' ? 'Passer user' : 'Passer admin'}"
                    onclick="adminToggleRole(${u.id},'${u.role}')">${u.role === 'admin' ? '↓' : '↑'}</button>
                <button class="au-btn au-btn-key"  title="Changer MDP"
                    onclick="adminResetPwd(${u.id},'${u.username}')">🔑</button>
                <button class="au-btn au-btn-edit" title="Éditer"
                    onclick="adminEditerProfil(${u.id},'${u.username}')">✏️</button>
                <button class="au-btn au-btn-del"  title="Supprimer"
                    onclick="adminSupprimerUser(${u.id},'${u.username}')">🗑️</button>
            </div>
        </div>`;
    }).join('') : '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:12px 0">Aucun résultat.</p>';
}

// ===================== ÉDITION PROFIL PAR ADMIN ==============

async function adminEditerProfil(id, username) {
    const user = getUser();
    const el   = document.getElementById('admin-tab-users');
    el.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px 0">Chargement...</p>';
    try {
        const r = await fetch(`/api/admin/users/${id}/profil`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) { el.innerHTML = `<p style="color:#ef4444">${d.message}</p>`; return; }
        const p = d.profil || {};
        const u = d.user;
        el.innerHTML = `
            <div class="user-card">
                <div style="font-size:15px;font-weight:700;color:#1e1b4b;margin-bottom:16px">
                    ✏️ Éditer — <span style="color:#4f46e5">${u.username}</span>
                </div>
                <div class="section-title">Compte</div>
                <div style="margin-bottom:14px">
                    <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px">Nom d'utilisateur</label>
                    <input id="edit-username" type="text" value="${u.username}"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;box-sizing:border-box">
                </div>
                <div class="section-title">Profil</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                    <div>
                        <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px">Prénom</label>
                        <input id="edit-prenom" type="text" value="${p.prenom||''}"
                            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;box-sizing:border-box">
                    </div>
                    <div>
                        <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px">Nom</label>
                        <input id="edit-nom" type="text" value="${p.nom||''}"
                            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;box-sizing:border-box">
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                    <div>
                        <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px">Téléphone</label>
                        <input id="edit-telephone" type="text" value="${p.telephone||''}"
                            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;box-sizing:border-box">
                    </div>
                    <div>
                        <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px">Profession</label>
                        <input id="edit-profession" type="text" value="${p.profession||''}"
                            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;box-sizing:border-box">
                    </div>
                </div>
                <div style="margin-bottom:10px">
                    <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px">Email</label>
                    <input id="edit-email" type="email" value="${p.email||''}"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;box-sizing:border-box">
                </div>
                <div style="margin-bottom:10px">
                    <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px">Date de naissance</label>
                    <input id="edit-naissance" type="date" value="${p.date_naissance ? p.date_naissance.split('T')[0] : ''}"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                </div>
                <div style="margin-bottom:16px">
                    <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px">Note</label>
                    <textarea id="edit-note" rows="3"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;resize:none;font-family:inherit;box-sizing:border-box">${p.note||''}</textarea>
                </div>
                <div style="display:flex;gap:8px">
                    <button class="ua-btn ua-btn-blue" style="flex:1" onclick="adminSauvegarderProfil(${id})">💾 Sauvegarder</button>
                    <button class="ua-btn" style="flex:1;background:#f3f4f6;color:#374151" onclick="chargerAdminUsers()">Annuler</button>
                </div>
                <div id="edit-msg" style="margin-top:10px;font-size:13px;text-align:center"></div>
            </div>
        `;
    } catch {
        el.innerHTML = '<p style="color:#ef4444;font-size:13px;text-align:center">Erreur réseau.</p>';
    }
}

async function adminSauvegarderProfil(id) {
    const user       = getUser();
    const msg        = document.getElementById('edit-msg');
    const username   = document.getElementById('edit-username')?.value?.trim();
    const prenom     = document.getElementById('edit-prenom')?.value?.trim();
    const nom        = document.getElementById('edit-nom')?.value?.trim();
    const telephone  = document.getElementById('edit-telephone')?.value?.trim();
    const profession = document.getElementById('edit-profession')?.value?.trim();
    const email      = document.getElementById('edit-email')?.value?.trim();
    const naissance  = document.getElementById('edit-naissance')?.value;
    const note       = document.getElementById('edit-note')?.value?.trim();
    try {
        const r = await fetch(`/api/admin/users/${id}/profil`, {
            method : 'PATCH',
            headers: {
                'Content-Type' : 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ username, prenom, nom, telephone, profession, email, date_naissance: naissance, note })
        });
        const d = await r.json();
        if (msg) {
            msg.style.color = d.success ? '#16a34a' : '#ef4444';
            msg.textContent = d.success ? '✅ Profil mis à jour.' : (d.message || 'Erreur.');
        }
        if (d.success) setTimeout(() => chargerAdminUsers(), 1200);
    } catch {
        if (msg) { msg.style.color = '#ef4444'; msg.textContent = 'Erreur réseau.'; }
    }
}

// ===================== TOGGLE ROLE ===========================

async function adminToggleRole(id, roleActuel) {
    const user    = getUser();
    const newRole = roleActuel === 'admin' ? 'user' : 'admin';
    try {
        const r = await fetch(`/api/admin/users/${id}/role`, {
            method : 'PATCH',
            headers: {
                'Content-Type' : 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ role: newRole })
        });
        const d = await r.json();
        if (d.success) chargerAdminUsers();
        else { const m = document.createElement('p'); m.textContent = d.message || 'Erreur.'; }
    } catch { /* silencieux */ }
}

// ===================== RESET MOT DE PASSE ====================

function adminResetPwd(id, username) {
    const el = document.getElementById('admin-tab-users');
    el.innerHTML = `
        <div class="user-card">
            <div class="user-card-name" style="margin-bottom:4px">🔑 Nouveau MDP — <strong>${username}</strong></div>
            <div style="font-size:11px;color:#9ca3af;margin-bottom:12px">8 car. min · majuscule · minuscule · chiffre · spécial</div>
            <input type="password" id="admin-new-pwd" placeholder="Nouveau mot de passe"
                autocomplete="new-password" name="admin-pwd-field"
                style="width:100%;padding:10px 12px;font-size:14px;outline:none;box-sizing:border-box;margin-bottom:10px">
            <div style="display:flex;gap:8px">
                <button class="ua-btn ua-btn-blue" style="flex:1" onclick="adminConfirmResetPwd(${id})">✓ Confirmer</button>
                <button class="ua-btn" style="flex:1;background:#f3f4f6;color:#374151" onclick="chargerAdminUsers()">Annuler</button>
            </div>
            <div id="admin-pwd-msg" style="margin-top:8px;font-size:13px;color:#ef4444;text-align:center"></div>
        </div>
    `;
    setTimeout(() => {
        const f = document.getElementById('admin-new-pwd');
        if (f) { f.value = ''; f.focus(); }
    }, 50);
}

async function adminConfirmResetPwd(id) {
    const user   = getUser();
    const pwd    = document.getElementById('admin-new-pwd')?.value;
    const msg    = document.getElementById('admin-pwd-msg');
    const erreur = validerMotDePasse(pwd || '');
    if (erreur) { if (msg) msg.textContent = erreur; return; }
    try {
        const r = await fetch(`/api/admin/users/${id}/password`, {
            method : 'PATCH',
            headers: {
                'Content-Type' : 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ password: pwd })
        });
        const d = await r.json();
        if (d.success) chargerAdminUsers();
        else if (msg) msg.textContent = d.message || 'Erreur.';
    } catch {
        if (msg) msg.textContent = 'Erreur réseau.';
    }
}

// ===================== SUPPRIMER UTILISATEUR =================

function adminSupprimerUser(id, username) {
    const el = document.getElementById('admin-tab-users');
    el.innerHTML = `
        <div class="user-card" style="border-color:#fee2e2;background:#fff5f5">
            <div style="font-size:32px;text-align:center;margin-bottom:8px">🗑️</div>
            <div class="user-card-name" style="text-align:center;margin-bottom:16px">
                Confirmer la suppression de <strong>${username}</strong> ?
            </div>
            <div style="display:flex;gap:8px">
                <button class="ua-btn ua-btn-red" style="flex:1" onclick="adminConfirmSupprimer(${id})">Confirmer</button>
                <button class="ua-btn" style="flex:1;background:#f3f4f6;color:#374151" onclick="chargerAdminUsers()">Annuler</button>
            </div>
        </div>
    `;
}

async function adminConfirmSupprimer(id) {
    const user = getUser();
    try {
        const r = await fetch(`/api/admin/users/${id}`, {
            method : 'DELETE',
            headers: {
                'Content-Type' : 'application/json',
                'Authorization': `Bearer ${user.token}`
            }
        });
        const d = await r.json();
        if (d.success) chargerAdminUsers();
        else {
            const el  = document.getElementById('admin-tab-users');
            if (el) el.innerHTML += `<p style="color:#ef4444;font-size:13px;text-align:center;margin-top:8px">${d.message || 'Erreur.'}</p>`;
        }
    } catch { /* silencieux */ }
}

// ===================== CRÉER UTILISATEUR =====================

async function creerUser() {
    const user     = getUser();
    const username = document.getElementById('new-username')?.value?.trim();
    const password = document.getElementById('new-password')?.value;
    const role     = document.getElementById('new-role')?.value;
    const msg      = document.getElementById('create-msg');
    if (!username || !password) {
        if (msg) { msg.style.color = '#ef4444'; msg.textContent = 'Champs requis.'; }
        return;
    }
    const erreur = validerMotDePasse(password);
    if (erreur) {
        if (msg) { msg.style.color = '#ef4444'; msg.textContent = erreur; }
        return;
    }
    try {
        const r = await fetch('/api/admin/users', {
            method : 'POST',
            headers: {
                'Content-Type' : 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ username, password, role })
        });
        const d = await r.json();
        if (msg) {
            msg.style.color = d.success ? '#16a34a' : '#ef4444';
            msg.textContent = d.success
                ? `✅ "${username}" créé avec succès.`
                : (d.message || 'Erreur.');
        }
        if (d.success) {
            document.getElementById('new-username').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('new-role').value     = 'user';
            setTimeout(() => chargerAdminUsers(), 1200);
        }
    } catch {
        if (msg) { msg.style.color = '#ef4444'; msg.textContent = 'Erreur réseau.'; }
    }
}

// ===================== SWITCH ONGLETS ========================

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.admin-tab[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById(`admin-tab-${tab}`)?.classList.add('active');
    if (tab === 'stats') chargerAdminStats();
    if (tab === 'users') chargerAdminUsers();
}

// ===================== VALIDATION MDP (client) ===============

function validerMotDePasse(pwd) {
    if (!pwd || pwd.length < 8)         return 'Minimum 8 caractères.';
    if (!/[A-Z]/.test(pwd))             return 'Au moins une majuscule.';
    if (!/[a-z]/.test(pwd))             return 'Au moins une minuscule.';
    if (!/[0-9]/.test(pwd))             return 'Au moins un chiffre.';
    if (!/[^A-Za-z0-9]/.test(pwd))     return 'Au moins un caractère spécial.';
    return null;
}
