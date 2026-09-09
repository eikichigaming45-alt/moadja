// ============================================================
// public/js/profil.js
// Widget "Mon Profil" (privé) : affichage auto nom/âge/profession
// /téléphone/site web/signe/note. Gestion photo (upload, crop,
// suppression), géocodage lieu de naissance, sauvegarde profil
// et santé, widgets visibles, changement mot de passe, onglet
// social (miens / nouveau / mon profil public).
// ============================================================

function construireTrigramme(prenom, nom) {
    const mots = [...(prenom || '').split(/\s+/), ...(nom || '').split(/\s+/)]
        .map(m => m.trim())
        .filter(Boolean);
    return mots.slice(0, 3).map(m => m[0].toUpperCase()).join('');
}

const _SIGNES_ZODIAQUE = [
    { signe:'Capricorne', emoji:'♑', mois:1,  jour:20 },
    { signe:'Verseau',    emoji:'♒', mois:2,  jour:19 },
    { signe:'Poissons',   emoji:'♓', mois:3,  jour:20 },
    { signe:'Bélier',     emoji:'♈', mois:4,  jour:20 },
    { signe:'Taureau',    emoji:'♉', mois:5,  jour:21 },
    { signe:'Gémeaux',    emoji:'♊', mois:6,  jour:21 },
    { signe:'Cancer',     emoji:'♋', mois:7,  jour:23 },
    { signe:'Lion',       emoji:'♌', mois:8,  jour:23 },
    { signe:'Vierge',     emoji:'♍', mois:9,  jour:23 },
    { signe:'Balance',    emoji:'♎', mois:10, jour:23 },
    { signe:'Scorpion',   emoji:'♏', mois:11, jour:22 },
    { signe:'Sagittaire', emoji:'♐', mois:12, jour:22 },
    { signe:'Capricorne', emoji:'♑', mois:12, jour:31 },
];

const _SIGNES_LABELS = {
    belier    : { signe:'Bélier',     emoji:'♈' },
    taureau   : { signe:'Taureau',    emoji:'♉' },
    gemeaux   : { signe:'Gémeaux',    emoji:'♊' },
    cancer    : { signe:'Cancer',     emoji:'♋' },
    lion      : { signe:'Lion',       emoji:'♌' },
    vierge    : { signe:'Vierge',     emoji:'♍' },
    balance   : { signe:'Balance',    emoji:'♎' },
    scorpion  : { signe:'Scorpion',   emoji:'♏' },
    sagittaire: { signe:'Sagittaire', emoji:'♐' },
    capricorne: { signe:'Capricorne', emoji:'♑' },
    verseau   : { signe:'Verseau',    emoji:'♒' },
    poissons  : { signe:'Poissons',   emoji:'♓' },
};

function _signeDepuisDate(dateStr) {
    if (!dateStr) return null;
    const d    = new Date(dateStr);
    const mois = d.getMonth() + 1;
    const jour = d.getDate();
    const found = _SIGNES_ZODIAQUE.find(s => mois < s.mois || (mois === s.mois && jour <= s.jour));
    return found || null;
}

function obtenirSigne(p) {
    if (p.signe_zodiaque && _SIGNES_LABELS[p.signe_zodiaque]) {
        return _SIGNES_LABELS[p.signe_zodiaque];
    }
    return _signeDepuisDate(p.date_naissance);
}

async function geocoderLieuNaissance() {
    const input = document.getElementById('p-lieu-naissance');
    const msg   = document.getElementById('p-lieu-naissance-msg');
    const latEl = document.getElementById('p-naissance-lat');
    const lonEl = document.getElementById('p-naissance-lon');
    if (!input || !msg || !latEl || !lonEl) return;

    const q = input.value.trim();
    if (!q) {
        msg.textContent = '';
        latEl.value     = '';
        lonEl.value     = '';
        return;
    }

    msg.textContent = '🔍 Recherche en cours...';
    msg.style.color = '#9ca3af';

    try {
        const r = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
            { headers: { 'Accept-Language': 'fr' } }
        );
        const data = await r.json();
        if (!data.length) {
            msg.textContent = '❌ Lieu non trouvé — vérifie le nom de la ville.';
            msg.style.color = '#ef4444';
            latEl.value     = '';
            lonEl.value     = '';
            return;
        }
        const lieu      = data[0];
        latEl.value     = lieu.lat;
        lonEl.value     = lieu.lon;
        msg.textContent = `✅ ${lieu.display_name.split(',').slice(0, 2).join(',')}`;
        msg.style.color = '#10b981';
    } catch {
        msg.textContent = '❌ Erreur réseau lors du géocodage.';
        msg.style.color = '#ef4444';
        latEl.value     = '';
        lonEl.value     = '';
    }
}

async function chargerProfilHeader() {
    const user = getUser();
    if (!user?.token) return;
    const btn = document.getElementById('btn-profil-header');
    if (!btn) return;
    try {
        const r = await fetch('/api/profil', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success || !d.profil) return;
        profilCache     = d.profil;
        const p         = d.profil;
        const trigramme = construireTrigramme(p.prenom, p.nom);

        try {
            localStorage.setItem('moadja_profil', JSON.stringify({ photo: p.photo || null }));
        } catch { /* silencieux */ }

        if (p.photo) {
            btn.innerHTML        = `<img src="${p.photo}" alt="profil">`;
            btn.style.fontSize   = '';
            btn.style.fontWeight = '';
            btn.style.background = '';
        } else if (trigramme) {
            btn.innerHTML        = trigramme;
            btn.style.fontSize   = '11px';
            btn.style.fontWeight = '700';
            btn.style.background = '#7c3aed';
            btn.style.color      = '#fff';
        } else {
            btn.innerHTML        = '👤';
            btn.style.fontSize   = '';
            btn.style.fontWeight = '';
        }

        _appliquerVisibiliteCycle(p.sexe);

        const wc = document.getElementById('wc-profil');
        const nom = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Mon Profil';

        const age = p.date_naissance ? (() => {
            const n     = new Date(p.date_naissance);
            const today = new Date();
            let a       = today.getFullYear() - n.getFullYear();
            if (today < new Date(today.getFullYear(), n.getMonth(), n.getDate())) a--;
            return a;
        })() : null;

        const signe = obtenirSigne(p);

        // 1. Mise à jour du widget classique (pour Mobile)
        if (wc) {
            wc.innerHTML = `
                <div class="profil-widget">
                    ${p.photo
                        ? `<img src="${p.photo}" alt="profil" class="profil-widget-photo">`
                        : `<div class="profil-widget-initiales">${trigramme || '👤'}</div>`
                    }
                    <div class="profil-widget-nom">${nom}</div>
                    ${age          ? `<div class="profil-widget-info">${age} ans</div>`          : ''}
                    ${p.profession ? `<div class="profil-widget-info">💼 ${p.profession}</div>` : ''}
                    ${p.telephone  ? `<div class="profil-widget-info">📞 ${p.telephone}</div>`  : ''}
                    ${signe        ? `<div class="profil-widget-info">${signe.emoji} ${signe.signe}</div>` : ''}
                    ${p.site_web   ? `<div class="profil-widget-info">🔗 <a href="${p.site_web}" target="_blank" rel="noopener noreferrer" style="color:inherit">${p.site_web}</a></div>` : ''}
                    ${p.note       ? `<div class="profil-widget-bio">${p.note}</div>`           : ''}
                </div>
            `;
        }

        // ==========================================
        // 2. INJECTION DANS L'IDENTITY MIRROR (DESKTOP)
        // ==========================================
        const imAvatarImg   = document.getElementById('im-avatar-img');
        const imUserName    = document.getElementById('im-user-name');
        const imTogglesList = document.querySelector('.im-toggles-list');

        if (imUserName) imUserName.textContent = nom;

        if (imAvatarImg) {
            if (p.photo) {
                imAvatarImg.src = p.photo;
                imAvatarImg.style.display = 'block';
                const oldTri = imAvatarImg.parentElement.querySelector('.im-trigramme');
                if (oldTri) oldTri.remove();
            } else {
                imAvatarImg.style.display = 'none';
                let tri = imAvatarImg.parentElement.querySelector('.im-trigramme');
                if (!tri) {
                    tri = document.createElement('div');
                    tri.className = 'im-trigramme';
                    tri.style.cssText = 'width:100%;height:100%;border-radius:50%;background:#7C3AED;color:#fff;font-size:32px;font-weight:700;display:flex;align-items:center;justify-content:center;border:3px solid #fff;';
                    imAvatarImg.parentElement.appendChild(tri);
                }
                tri.textContent = trigramme || '👤';
            }
        }

        if (imTogglesList) {
            imTogglesList.innerHTML = ''; 
            
            // On transforme le conteneur pour afficher les infos sous forme de "pilules" alignées
            imTogglesList.style.display = 'flex';
            imTogglesList.style.flexDirection = 'row';
            imTogglesList.style.flexWrap = 'wrap';
            imTogglesList.style.justifyContent = 'center';
            imTogglesList.style.gap = '8px';
            imTogglesList.style.marginBottom = '16px';

            const addPill = (icon, color, val) => {
                if (!val) return;
                imTogglesList.innerHTML += `
                <div style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:rgba(255,255,255,0.6); border:1px solid rgba(255,255,255,0.8); border-radius:20px; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
                    <span style="color:${color}; font-size:14px;">${icon}</span>
                    <span style="font-size:12px; font-weight:600; color:var(--text-main); white-space:nowrap;">${val}</span>
                </div>`;
            };

            // Injection des pilules minimalistes (Icône + Valeur uniquement)
            if (age) addPill('🎂', '#f59e0b', `${age} ans`);
            if (signe) addPill(signe.emoji, '#8b5cf6', signe.signe);
            if (p.profession) addPill('💼', '#3b82f6', p.profession);
            if (p.telephone) addPill('📞', '#10b981', p.telephone);
            if (p.site_web) addPill('🔗', '#ec4899', `<a href="${p.site_web}" target="_blank" style="color:inherit;text-decoration:none">${p.site_web.replace(/^https?:\/\//,'')}</a>`);

            // Note (Bio) centrée en dessous
            if (p.note) {
                imTogglesList.innerHTML += `
                <div style="width:100%; text-align:center; font-size:12px; color:#6b7280; line-height:1.4; margin-top:8px; font-style:italic; padding:0 10px;">
                    "${p.note}"
                </div>`;
            }

            // Bloc boutons (Modifier + Admin) harmonisé Glass V3
            let boutonsHtml = `
            <div style="width:100%; margin-top:16px; display:flex; flex-direction:column; gap:8px;">
                <button class="btn-save" onclick="openModal('profil')" style="width:100%; padding:10px 16px;">
                    ✏️ Modifier mon profil
                </button>`;

            // Injection du bouton Administration si l'utilisateur est admin (version amber glass)
            if (user?.role === 'admin') {
                boutonsHtml += `
                <button class="btn-save" onclick="openModal('admin')" style="width:100%; padding:10px 16px; background:rgba(245,158,11,0.85); box-shadow:0 4px 15px rgba(245,158,11,0.25);">
                    ⚙️ Administration
                </button>`;
            }

            boutonsHtml += `</div>`;
            imTogglesList.innerHTML += boutonsHtml;
        }
        
        // 3. Injection du numéro de version dans le menu déroulant (pour Mobile & Desktop)
        const userMenu = document.getElementById('user-menu');
        if (userMenu && !document.getElementById('menu-version-display')) {
            const versionNode = document.getElementById('topbar-version');
            const vText = versionNode ? versionNode.textContent : '';
            userMenu.innerHTML += `<div id="menu-version-display" style="text-align:center; padding:10px; font-size:10px; color:#9ca3af; border-top:1px solid #f0f0f0; margin-top:4px; font-weight:600;">${vText}</div>`;
        }

    } catch { /* silencieux */ }
}

function _appliquerVisibiliteCycle(sexe) {
    const widgetCycle = document.querySelector('.widget[data-id="cycle"]');
    if (!widgetCycle) return;
    const cacher = sexe === 'homme' || sexe === 'intersexe';
    widgetCycle.style.display = cacher ? 'none' : '';
}

function previewPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
        let cropZone = document.getElementById('crop-zone');
        if (!cropZone) {
            cropZone = document.createElement('div');
            cropZone.id = 'crop-zone';
            cropZone.innerHTML = `
                <div class="crop-container">
                    <img id="crop-img" src="">
                </div>
                <div class="crop-actions" style="display:flex; gap:8px;">
                    <button class="btn-cancel" onclick="annulerCrop()" style="flex:1;">✕ Annuler</button>
                    <button class="btn-save" onclick="validerCrop()" style="flex:1;">✅ Valider le recadrage</button>
                </div>
            `;
            const tabInfos = document.getElementById('profil-tab-infos');
            if (tabInfos) tabInfos.insertBefore(cropZone, tabInfos.firstChild);
        }
        document.getElementById('crop-img').src = e.target.result;
        cropperInstance = new Cropper(document.getElementById('crop-img'), {
            aspectRatio: 1, viewMode: 1,
            movable: true, zoomable: true,
            rotatable: false, scalable: false
        });
    };
    reader.readAsDataURL(file);
}

async function validerCrop() {
    if (!cropperInstance) return;
    const user = getUser();

    const canvas = cropperInstance.getCroppedCanvas({ width: 300, height: 300 });
    canvas.toBlob(async blob => {
        if (!blob) return;

        const formData = new FormData();
        formData.append('photo', blob, 'avatar.jpg');

        const btn = document.getElementById('btn-profil-header');
        if (btn) btn.innerHTML = '...';

        try {
            const r = await fetch('/api/profil/photo', {
                method  : 'POST',
                headers : { 'Authorization': `Bearer ${user.token}` },
                body    : formData
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.message);

            const urlPhoto = d.url;
            profilCache = { ...profilCache, photo: urlPhoto };

            try {
                localStorage.setItem('moadja_profil', JSON.stringify({ photo: urlPhoto }));
            } catch { /* silencieux */ }

            let preview = document.getElementById('profil-photo-preview');
            if (preview) {
                preview.src = urlPhoto;
            } else {
                const zone = document.querySelector('#profil-tab-infos .profil-widget-initiales, #profil-tab-infos .initiales');
                if (zone) {
                    const newImg         = document.createElement('img');
                    newImg.id            = 'profil-photo-preview';
                    newImg.src           = urlPhoto;
                    newImg.style.cssText = 'width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid #7c3aed;cursor:pointer;box-shadow:0 4px 12px rgba(124,58,237,0.3)';
                    newImg.onclick       = () => document.getElementById('photo-input').click();
                    zone.replaceWith(newImg);
                    preview = newImg;
                }
            }

            let btnSuppr = document.getElementById('btn-supprimer-photo');
            if (!btnSuppr && preview) {
                btnSuppr               = document.createElement('button');
                btnSuppr.id            = 'btn-supprimer-photo';
                btnSuppr.className     = 'btn-delete';
                btnSuppr.onclick       = supprimerPhoto;
                btnSuppr.style.cssText = 'margin-top:12px; width:100%;';
                btnSuppr.innerHTML     = '🗑️ Supprimer la photo';
                preview.insertAdjacentElement('afterend', btnSuppr);
            }

            if (btn) {
                btn.innerHTML        = `<img src="${urlPhoto}" alt="profil">`;
                btn.style.fontSize   = '';
                btn.style.fontWeight = '';
                btn.style.background = '';
            }

            // Rafraîchit l'Identity Mirror
            chargerProfilHeader();

        } catch (err) {
            const msgEl = document.getElementById('profil-msg');
            if (msgEl) { msgEl.textContent = '❌ Erreur lors de la sauvegarde de la photo.'; msgEl.style.color = '#ef4444'; }
            chargerProfilHeader();
        }

        annulerCrop();
    }, 'image/jpeg', 0.8);
}

function annulerCrop() {
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
    const cropZone = document.getElementById('crop-zone');
    if (cropZone) cropZone.remove();
    const input = document.getElementById('photo-input');
    if (input) input.value = '';
}

function supprimerPhoto() {
    document.getElementById('modal-title').textContent = 'Confirmation';
    document.getElementById('modal-body').innerHTML = `
        <p style="color:#333;font-size:15px;margin-bottom:20px">Confirmer la suppression ?</p>
        <div class="modal-actions" style="display:flex;gap:10px;">
            <button class="btn-delete" id="btn-photo-oui" style="flex:1;">Confirmer</button>
            <button class="btn-cancel" id="btn-photo-non" style="flex:1;">Annuler</button>
        </div>`;
    document.getElementById('overlay').classList.add('on');
    document.getElementById('btn-photo-oui').onclick = () => _confirmerSupprimerPhoto();
    document.getElementById('btn-photo-non').onclick = () => openModal('profil');
}

async function _confirmerSupprimerPhoto() {
    const user = getUser();
    try {
        const r = await fetch('/api/profil/photo', {
            method  : 'DELETE',
            headers : { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (d.success) {
            profilCache = { ...profilCache, photo: null };
            try {
                localStorage.setItem('moadja_profil', JSON.stringify({ photo: null }));
            } catch { /* silencieux */ }
            closeModal();
            chargerProfilHeader();
            const preview   = document.getElementById('profil-photo-preview');
            const trigramme = construireTrigramme(profilCache?.prenom, profilCache?.nom);
            if (preview) {
                const div         = document.createElement('div');
                div.className     = 'profil-widget-initiales';
                div.style.cssText = 'width:90px;height:90px;font-size:24px;cursor:pointer;box-shadow:0 4px 12px rgba(124,58,237,0.3)';
                div.textContent   = trigramme || '👤';
                div.onclick       = () => document.getElementById('photo-input').click();
                preview.replaceWith(div);
            }
            const btnSuppr = document.getElementById('btn-supprimer-photo');
            if (btnSuppr) btnSuppr.style.display = 'none';
        } else {
            document.getElementById('modal-title').textContent = 'Erreur';
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">
                    ${d.message || 'Erreur lors de la suppression.'}
                </p>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="closeModal()" style="width:100%;">Fermer</button>
                </div>`;
        }
    } catch {
        document.getElementById('modal-title').textContent = 'Erreur';
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur réseau.</p>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="closeModal()" style="width:100%;">Fermer</button>
            </div>`;
    }
}

async function sauvegarderProfil() {
    const user = getUser();
    const msg  = document.getElementById('profil-msg');
    msg.textContent = 'Sauvegarde...';
    msg.style.color = '#9ca3af';

    const body = {
        prenom          : document.getElementById('p-prenom')?.value           || '',
        nom             : document.getElementById('p-nom')?.value              || '',
        date_naissance  : document.getElementById('p-naissance')?.value        || null,
        heure_naissance : document.getElementById('p-heure-naissance')?.value  || null,
        lieu_naissance  : document.getElementById('p-lieu-naissance')?.value   || null,
        naissance_lat   : document.getElementById('p-naissance-lat')?.value    ? parseFloat(document.getElementById('p-naissance-lat').value)  : null,
                naissance_lon   : document.getElementById('p-naissance-lon')?.value    ? parseFloat(document.getElementById('p-naissance-lon').value)  : null,
        email           : document.getElementById('p-email')?.value            || '',
        telephone       : document.getElementById('p-tel')?.value              || '',
        profession      : document.getElementById('p-prof')?.value             || '',
        note            : document.getElementById('p-note')?.value             || '',
        site_web        : document.getElementById('p-site-web')?.value         || '',
    };

    try {
        const r = await fetch('/api/profil', {
            method  : 'POST',
            headers : {
                'Content-Type'  : 'application/json',
                'Authorization' : `Bearer ${user.token}`
            },
            body: JSON.stringify(body)
        });
        const d = await r.json();
        if (d.success) {
            msg.textContent = '✅ Profil sauvegardé !';
            msg.style.color = '#10b981';
            profilCache     = { ...profilCache, ...body };
            chargerProfilHeader();
        } else {
            msg.textContent = '❌ ' + (d.message || 'Erreur.');
            msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau.';
        msg.style.color = '#ef4444';
    }
}

async function sauvegarderSante() {
    const user = getUser();
    const msg  = document.getElementById('sante-msg');
    msg.textContent = 'Sauvegarde...';
    msg.style.color = '#9ca3af';

    const allergiesRaw       = document.getElementById('p-allergies')?.value       || '';
    const aliments_exclusRaw = document.getElementById('p-aliments-exclus')?.value || '';

    const allergies       = allergiesRaw.split(',').map(s => s.trim()).filter(Boolean);
    const aliments_exclus = aliments_exclusRaw.split(',').map(s => s.trim()).filter(Boolean);

    const body = {
        sexe            : document.getElementById('p-sexe')?.value            || null,
        taille          : document.getElementById('p-taille')?.value          ? parseInt(document.getElementById('p-taille').value)            : null,
        poids           : document.getElementById('p-poids')?.value           ? parseFloat(document.getElementById('p-poids').value) : null,
        groupe_sanguin  : document.getElementById('p-sang')?.value            || null,
        allergies       : allergies,
        aliments_exclus : aliments_exclus,
        traitement      : document.getElementById('p-traitement')?.value      || '',
        maladie         : document.getElementById('p-maladie')?.value         || '',
        medecin         : document.getElementById('p-medecin')?.value         || '',
        contact_urgence : document.getElementById('p-contact-urgence')?.value || ''
    };

    try {
        const r = await fetch('/api/profil/sante', {
            method  : 'POST',
            headers : {
                'Content-Type'  : 'application/json',
                'Authorization' : `Bearer ${user.token}`
            },
            body: JSON.stringify(body)
        });
        const d = await r.json();
        if (d.success) {
            msg.textContent = '✅ Données santé sauvegardées !';
            msg.style.color = '#10b981';
            profilCache     = { ...profilCache, ...body };
            _appliquerVisibiliteCycle(body.sexe);
        } else {
            msg.textContent = '❌ ' + (d.message || 'Erreur.');
            msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau.';
        msg.style.color = '#ef4444';
    }
}

async function sauvegarderWidgetPrefs() {
    const user = getUser();
    const msg  = document.getElementById('widgets-msg');
    msg.textContent = 'Sauvegarde...';
    msg.style.color = '#9ca3af';

    const form             = document.getElementById('form-widgets');
    const checkboxes       = form.querySelectorAll('input[type="checkbox"]');
    const widgets_visibles = [];
    checkboxes.forEach(cb => {
        if (cb.checked) widgets_visibles.push(cb.value);
    });

    try {
        const r = await fetch('/api/profil/widgets', {
            method  : 'POST',
            headers : {
                'Content-Type'  : 'application/json',
                'Authorization' : `Bearer ${user.token}`
            },
            body: JSON.stringify({ widgets_visibles })
        });
        const d = await r.json();
        if (d.success) {
            msg.textContent = '✅ Préférences sauvegardées !';
            msg.style.color = '#10b981';
            setTimeout(() => window.location.reload(), 1000);
        } else {
            msg.textContent = '❌ ' + (d.message || 'Erreur.');
            msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau.';
        msg.style.color = '#ef4444';
    }
}

async function changerMotDePasse() {
    const user = getUser();
    const msg  = document.getElementById('mdp-msg');
    msg.textContent = 'Modification...';
    msg.style.color = '#9ca3af';

    const actuel  = document.getElementById('p-mdp-actuel').value;
    const nouveau = document.getElementById('p-mdp-nouveau').value;
    const conf    = document.getElementById('p-mdp-conf').value;

    if (!actuel || !nouveau || !conf) {
        msg.textContent = '❌ Remplissez tous les champs.';
        msg.style.color = '#ef4444';
        return;
    }
    if (nouveau !== conf) {
        msg.textContent = '❌ Les mots de passe ne correspondent pas.';
        msg.style.color = '#ef4444';
        return;
    }

    try {
        const r = await fetch('/api/profil/mdp', {
            method  : 'POST',
            headers : {
                'Content-Type'  : 'application/json',
                'Authorization' : `Bearer ${user.token}`
            },
            body: JSON.stringify({ actuel, nouveau })
        });
        const d = await r.json();
        if (d.success) {
            msg.textContent = '✅ Mot de passe modifié !';
            msg.style.color = '#10b981';
            document.getElementById('p-mdp-actuel').value  = '';
            document.getElementById('p-mdp-nouveau').value = '';
            document.getElementById('p-mdp-conf').value    = '';
        } else {
            msg.textContent = '❌ ' + (d.message || 'Erreur.');
            msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau.';
        msg.style.color = '#ef4444';
    }
}

// ============================================================
// GESTION DU PROFIL PUBLIC (Appelé dans social.js)
// ============================================================

async function _injecterProfilPublicToggles() {
    const container = document.getElementById('social-profil-public-container');
    if (!container) return;

    // Évite de recharger si déjà présent (optimisation)
    if (container.dataset.loaded === 'true') return;

    const user = getUser();
    if (!user || !user.token) return;

    try {
        const r = await fetch('/api/profil/public-prefs', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) return;

        const prefs = d.prefs || {};

        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.4); border-radius:12px; padding:14px; border:1px solid rgba(255,255,255,0.6); margin-bottom:16px;">
                <div style="font-size:12px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.5px; margin-bottom:12px;">
                    Mon Profil Public
                </div>
                <div style="font-size:13px; color:#374151; margin-bottom:12px; line-height:1.5;">
                    Sélectionne les informations que les autres utilisateurs peuvent voir sur ton profil lorsqu'ils cliquent sur ton nom.
                </div>
                
                <div style="display:flex; flex-direction:column; gap:8px;" id="public-prefs-list">
                    ${_creerTogglePref('public_age', 'Âge / Date de naissance', prefs.public_age)}
                    ${_creerTogglePref('public_signe', 'Signe astrologique', prefs.public_signe)}
                    ${_creerTogglePref('public_profession', 'Profession', prefs.public_profession)}
                    ${_creerTogglePref('public_telephone', 'Téléphone', prefs.public_telephone)}
                    ${_creerTogglePref('public_siteweb', 'Site Web', prefs.public_siteweb)}
                </div>
                
                <div id="public-prefs-msg" style="font-size:12px; min-height:16px; margin-top:10px; text-align:center;"></div>
                <button class="btn-save" onclick="_sauvegarderProfilPublic()" style="width:100%; margin-top:10px;">
                    Enregistrer les préférences
                </button>
            </div>
        `;
        container.dataset.loaded = 'true';
    } catch { /* silencieux */ }
}

function _creerTogglePref(id, label, isChecked) {
    return `
    <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; background:rgba(255,255,255,0.7); border-radius:8px; padding:8px 12px; border:1px solid rgba(255,255,255,0.9);">
        <span style="font-size:13px; color:#374151;">${label}</span>
        <div style="position:relative; display:inline-flex; align-items:center; width:38px; height:22px; flex-shrink:0;">
            <input type="checkbox" id="${id}" ${isChecked ? 'checked' : ''} style="opacity:0; width:0; height:0; position:absolute;">
            <span style="position:absolute; inset:0; border-radius:22px; background:${isChecked ? '#7c3aed' : '#d1d5db'}; transition:background .2s;">
                <span style="position:absolute; top:3px; left:${isChecked ? '19px' : '3px'}; width:16px; height:16px; border-radius:50%; background:#fff; transition:left .2s; display:block;"></span>
            </span>
        </div>
    </label>`;
}

async function _sauvegarderProfilPublic() {
    const user = getUser();
    const msg  = document.getElementById('public-prefs-msg');
    if (!msg || !user) return;
    
    msg.textContent = 'Enregistrement...';
    msg.style.color = '#9ca3af';

    const prefs = {
        public_age:        document.getElementById('public_age')?.checked        || false,
        public_signe:      document.getElementById('public_signe')?.checked      || false,
        public_profession: document.getElementById('public_profession')?.checked || false,
        public_telephone:  document.getElementById('public_telephone')?.checked  || false,
        public_siteweb:    document.getElementById('public_siteweb')?.checked    || false
    };

    try {
        const r = await fetch('/api/profil/public-prefs', {
            method  : 'POST',
            headers : {
                'Authorization': `Bearer ${user.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(prefs)
        });
        const d = await r.json();
        if (d.success) {
            msg.textContent = '✅ Préférences mises à jour !';
            msg.style.color = '#10b981';
            setTimeout(() => { msg.textContent = ''; }, 3000);
        } else {
            msg.textContent = '❌ Erreur lors de la sauvegarde.';
            msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau.';
        msg.style.color = '#ef4444';
    }
}

// Animation locale des toggles de préférences publiques
document.addEventListener('change', e => {
    const cb = e.target;
    if (['public_age', 'public_signe', 'public_profession', 'public_telephone', 'public_siteweb'].includes(cb.id)) {
        const track = cb.nextElementSibling;
        const thumb = track?.querySelector('span');
        if (track) track.style.background = cb.checked ? '#7c3aed' : '#d1d5db';
        if (thumb) thumb.style.left       = cb.checked ? '19px'   : '3px';
    }
});
