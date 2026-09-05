// ============================================================
// public/js/profil.js
// Widget "Mon Profil" (privé) : affichage auto nom/âge/profession
// /téléphone/site web/signe/note. Gestion photo (upload, crop,
// suppression), géocodage lieu de naissance, sauvegarde profil
// et santé, widgets visibles, changement mot de passe, onglet
// social (miens / nouveau / mon profil public).
//
// FIX WIDGETS-TOGGLE (v1.69.8) : afficherSectionWidgets() reprend
// désormais le style toggle (libellé à gauche, interrupteur à droite)
// déjà utilisé dans "Mon Profil Public" (onglet Social), au lieu des
// checkboxes natives mal alignées. Le listener `change` visuel est
// étendu pour gérer aussi ces nouveaux toggles. Classe et attribut
// data-id inchangés (widget-visible-check / data-id) — aucune
// modification de sauvegarderWidgetsVisibles() ni de la logique
// métier associée.
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
        if (!wc) return;
        const nom = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Mon Profil';

        const age = p.date_naissance ? (() => {
            const n     = new Date(p.date_naissance);
            const today = new Date();
            let a       = today.getFullYear() - n.getFullYear();
            if (today < new Date(today.getFullYear(), n.getMonth(), n.getDate())) a--;
            return a;
        })() : null;

        const signe = obtenirSigne(p);

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
                <div class="crop-actions">
                    <button class="btn-crop-cancel" onclick="annulerCrop()">✕ Annuler</button>
                    <button class="btn-crop-ok"     onclick="validerCrop()">✅ Valider le recadrage</button>
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
                    newImg.style.cssText = 'width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid #4f46e5;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.3)';
                    newImg.onclick       = () => document.getElementById('photo-input').click();
                    zone.replaceWith(newImg);
                    preview = newImg;
                }
            }

            let btnSuppr = document.getElementById('btn-supprimer-photo');
            if (!btnSuppr && preview) {
                btnSuppr               = document.createElement('button');
                btnSuppr.id            = 'btn-supprimer-photo';
                btnSuppr.onclick       = supprimerPhoto;
                btnSuppr.style.cssText = 'margin-top:8px;background:#fee2e2;color:#ef4444;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer';
                btnSuppr.innerHTML     = '🗑️ Supprimer la photo';
                preview.insertAdjacentElement('afterend', btnSuppr);
            }

            if (btn) {
                btn.innerHTML        = `<img src="${urlPhoto}" alt="profil">`;
                btn.style.fontSize   = '';
                btn.style.fontWeight = '';
                btn.style.background = '';
            }

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
        <div class="modal-actions">
            <button class="btn-delete" id="btn-photo-oui">Confirmer</button>
            <button class="btn-cancel" id="btn-photo-non">Annuler</button>
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
                div.style.cssText = 'width:90px;height:90px;font-size:24px;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.3)';
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
                    <button class="btn-cancel" onclick="closeModal()">Fermer</button>
                </div>`;
        }
    } catch {
        document.getElementById('modal-title').textContent = 'Erreur';
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur réseau.</p>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="closeModal()">Fermer</button>
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
        taille          : document.getElementById('p-taille')?.value          ? parseInt(document.getElementById('p-taille').value)          : null,
        poids           : document.getElementById('p-poids')?.value           ? parseFloat(document.getElementById('p-poids').value)         : null,
        groupe_sanguin  : document.getElementById('p-groupe-sanguin')?.value  || null,
        niveau_activite : document.getElementById('p-niveau-activite')?.value || null,
        objectif_sante  : document.getElementById('p-objectif-sante')?.value  || null,
        signe_zodiaque  : document.getElementById('p-signe')?.value           || null,
        allergies,
        aliments_exclus,
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
            msg.textContent = '✅ Santé sauvegardée !';
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

function _injecterChampsAllergies(p) {
    const container = document.getElementById('profil-tab-sante');
    if (!container) return;
    if (document.getElementById('p-allergies')) return;

    const allergiesVal       = Array.isArray(p?.allergies)       ? p.allergies.join(', ')       : '';
    const aliments_exclusVal = Array.isArray(p?.aliments_exclus) ? p.aliments_exclus.join(', ') : '';

        const bloc = document.createElement('div');
    bloc.innerHTML = `
        <div class="form-group">
            <label for="p-allergies">Allergies <span style="font-size:11px;color:#9ca3af">(séparées par des virgules)</span></label>
            <input type="text" id="p-allergies" placeholder="gluten, arachides, lactose" value="${allergiesVal}">
        </div>
        <div class="form-group">
            <label for="p-aliments-exclus">Aliments exclus <span style="font-size:11px;color:#9ca3af">(séparés par des virgules)</span></label>
            <input type="text" id="p-aliments-exclus" placeholder="porc, alcool, café" value="${aliments_exclusVal}">
        </div>
    `;

        const btnSave = container.querySelector('button[onclick="sauvegarderSante()"]');
    if (btnSave) {
        btnSave.parentNode.insertBefore(bloc, btnSave);
    } else {
        container.appendChild(bloc);
    }
}

// FIX WIDGETS-TOGGLE (v1.69.8) : rendu réécrit pour reprendre le style
// toggle (libellé à gauche, interrupteur à droite) déjà utilisé dans
// "Mon Profil Public" (_injecterProfilPublicToggles). La classe
// "widget-visible-check" et l'attribut data-id sont conservés à l'identique
// pour ne rien casser côté sauvegarderWidgetsVisibles()/appliquerWidgetsVisibles().
async function afficherSectionWidgets() {
    const user = getUser();
    const zone = document.getElementById('widgets-choix');
    if (!zone || !user?.token) return;

    const WIDGETS_DISPONIBLES = [
        { id:'meteo',          label:'☁️ Météo' },
        { id:'priere',         label:'🙏 Prière du jour' },
        { id:'islam',          label:'🕌 Prières & Hadiths' },
        { id:'taches',         label:'✅ Tâches du jour' },
        { id:'anniversaires',  label:'🎂 Anniversaires' },
        { id:'cycle',          label:'🌙 Suivi du cycle' },
        { id:'astrologie',     label:'✨ Astrologie' },
        { id:'theme-astral',   label:'🔮 Thème Astral' },
        { id:'agenda-unifie',  label:'📅 Mon Agenda' },
    ];

    try {
        const r = await fetch('/api/profil/widgets-visibles', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        const caches = Array.isArray(d.widgets_caches) ? d.widgets_caches : [];

        zone.innerHTML = WIDGETS_DISPONIBLES.map(w => {
            const actif = !caches.includes(w.id);
            return `
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:10px 12px;background:#fff;border-radius:10px;
                        border:1px solid #f3f4f6;margin-bottom:6px;min-height:40px">
                <span style="font-size:14px;color:#333;flex:1">${w.label}</span>
                <label style="position:relative;display:inline-flex;align-items:center;
                              width:38px;height:22px;flex-shrink:0;cursor:pointer">
                    <input type="checkbox" class="widget-visible-check" data-id="${w.id}"
                        ${actif ? 'checked' : ''}
                        style="opacity:0;width:0;height:0;position:absolute">
                    <span style="position:absolute;inset:0;border-radius:22px;cursor:pointer;
                                 background:${actif ? '#7c3aed' : '#d1d5db'};transition:background .2s">
                        <span style="position:absolute;top:3px;left:${actif ? '19px' : '3px'};
                                     width:16px;height:16px;border-radius:50%;background:#fff;
                                     transition:left .2s;display:block"></span>
                    </span>
                </label>
            </div>`;
        }).join('');
    } catch {
        zone.innerHTML = '<p style="color:#ef4444;font-size:13px">Erreur de chargement des widgets.</p>';
    }
}

async function sauvegarderWidgetsVisibles() {
    const user = getUser();
    const msg  = document.getElementById('widgets-msg');
    msg.textContent = 'Sauvegarde...';
    msg.style.color = '#9ca3af';

    const checks = document.querySelectorAll('.widget-visible-check');
    const widgets_caches = [];
    checks.forEach(c => {
        if (!c.checked) widgets_caches.push(c.dataset.id);
    });

    try {
        const r = await fetch('/api/profil/widgets-visibles', {
            method  : 'PATCH',
            headers : {
                'Content-Type'  : 'application/json',
                'Authorization' : `Bearer ${user.token}`
            },
            body: JSON.stringify({ widgets_caches })
        });
        const d = await r.json();
        if (d.success) {
            msg.textContent = '✅ Widgets sauvegardés !';
            msg.style.color = '#10b981';
            if (typeof appliquerWidgetsVisibles === 'function') appliquerWidgetsVisibles(widgets_caches);
        } else {
            msg.textContent = '❌ ' + (d.message || 'Erreur.');
            msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau.';
        msg.style.color = '#ef4444';
    }
}

function appliquerWidgetsVisibles(widgets_caches) {
    if (!Array.isArray(widgets_caches)) return;
    widgets_caches.forEach(id => {
        const widget = document.querySelector(`.widget[data-id="${id}"]`);
        if (widget) widget.style.display = 'none';
    });
}

async function changerMdp() {
    const user     = getUser();
    const msg      = document.getElementById('mdp-msg');
    const ancien   = document.getElementById('mdp-ancien')?.value   || '';
    const nouveau  = document.getElementById('mdp-nouveau')?.value  || '';
    const confirm_ = document.getElementById('mdp-confirm')?.value  || '';

    if (!ancien || !nouveau || !confirm_) {
        msg.textContent = '❌ Tous les champs sont requis.';
        msg.style.color = '#ef4444';
        return;
    }
    if (nouveau !== confirm_) {
        msg.textContent = '❌ Les mots de passe ne correspondent pas.';
        msg.style.color = '#ef4444';
        return;
    }

    msg.textContent = 'Changement en cours...';
    msg.style.color = '#9ca3af';

    try {
        const r = await fetch('/api/profil/changer-mdp', {
            method  : 'POST',
            headers : {
                'Content-Type'  : 'application/json',
                'Authorization' : `Bearer ${user.token}`
            },
            body: JSON.stringify({ ancienMdp: ancien, nouveauMdp: nouveau })
        });
        const d = await r.json();
        if (d.success) {
            msg.textContent = '✅ Mot de passe changé !';
            msg.style.color = '#10b981';
            document.getElementById('mdp-ancien').value  = '';
            document.getElementById('mdp-nouveau').value = '';
            document.getElementById('mdp-confirm').value = '';
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
// PROFIL PUBLIC — 5 toggles de visibilité (section ajoutée
// dans l'onglet Social, au-dessus de "Ce que je partage")
// ============================================================
const _PROFIL_PUBLIC_CHAMPS_DEF = [
    { id: 'age',         label: 'Âge' },
    { id: 'profession',  label: 'Profession' },
    { id: 'site_web',    label: 'Site internet' },
    { id: 'signe_astro', label: 'Signe astro' },
    { id: 'note',        label: 'Note' },
];

async function _injecterProfilPublicToggles() {
    const container = document.getElementById('profil-tab-social');
    if (!container) return;
    if (document.getElementById('profil-public-toggles-bloc')) return; // déjà injecté, on ne duplique pas
    const user = getUser();
    if (!user?.token) return;

    const bloc = document.createElement('div');
    bloc.id = 'profil-public-toggles-bloc';
    bloc.style.cssText = 'background:#f8fafc;border-radius:14px;padding:16px;margin-bottom:16px';
    bloc.innerHTML = `
        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:4px">Mon Profil Public</div>
        <div style="font-size:12px;color:#9ca3af;margin-bottom:12px">
            Choisis les informations visibles par les autres sur ton profil public.
        </div>
        <div id="profil-public-toggles-liste">
            <p style="color:#9ca3af;font-size:13px">Chargement...</p>
        </div>
        <button id="btn-sauver-profil-public" onclick="_sauvegarderProfilPublicToggles()"
            style="width:100%;padding:11px;background:linear-gradient(135deg,#7c3aed,#6d28d9);
                   color:white;border:none;border-radius:10px;font-size:14px;font-weight:600;
                   cursor:pointer;margin-top:12px">
            💾 Sauvegarder
        </button>
        <div id="profil-public-toggles-msg" style="text-align:center;margin-top:8px;font-size:13px;min-height:16px"></div>
    `;
    container.insertBefore(bloc, container.firstChild);

    const liste = document.getElementById('profil-public-toggles-liste');
    // ── le reste de la fonction (fetch + affichage des toggles) est inchangé ──
    try {
        const r = await fetch('/api/profil/public-champs', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        const champsActifs = Array.isArray(d.champs) ? d.champs : [];

        liste.innerHTML = _PROFIL_PUBLIC_CHAMPS_DEF.map(c => {
            const actif = champsActifs.includes(c.id);
            return `
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:9px 12px;background:#fff;border-radius:8px;
                        border:1px solid #f3f4f6;margin-bottom:6px;min-height:40px">
                <span style="font-size:13px;color:#374151;flex:1">${c.label}</span>
                <label style="position:relative;display:inline-flex;align-items:center;
                              width:38px;height:22px;flex-shrink:0;cursor:pointer">
                    <input type="checkbox" class="profil-public-toggle-check" data-champ="${c.id}"
                        ${actif ? 'checked' : ''}
                        style="opacity:0;width:0;height:0;position:absolute">
                    <span style="position:absolute;inset:0;border-radius:22px;cursor:pointer;
                                 background:${actif ? '#7c3aed' : '#d1d5db'};transition:background .2s">
                        <span style="position:absolute;top:3px;left:${actif ? '19px' : '3px'};
                                     width:16px;height:16px;border-radius:50%;background:#fff;
                                     transition:left .2s;display:block"></span>
                    </span>
                </label>
            </div>`;
        }).join('');
    } catch {
        liste.innerHTML = '<p style="color:#ef4444;font-size:13px">Erreur de chargement des préférences.</p>';
    }
}

// ── Mise à jour visuelle du toggle au clic ────────────────────
// FIX WIDGETS-TOGGLE (v1.69.8) : sélecteur étendu pour couvrir aussi
// les toggles "Mes widgets" (.widget-visible-check), en plus des
// toggles "Mon Profil Public" (.profil-public-toggle-check) déjà gérés.
document.addEventListener('change', e => {
    const cb = e.target.closest('.profil-public-toggle-check, .widget-visible-check');
    if (!cb) return;
    const track = cb.nextElementSibling;
    const thumb = track?.querySelector('span');
    if (track) track.style.background = cb.checked ? '#7c3aed' : '#d1d5db';
    if (thumb) thumb.style.left = cb.checked ? '19px' : '3px';
});

async function _sauvegarderProfilPublicToggles() {
    const user = getUser();
    const msg  = document.getElementById('profil-public-toggles-msg');
    if (!msg) return;
    msg.textContent = 'Sauvegarde...';
    msg.style.color = '#9ca3af';

    const checks = document.querySelectorAll('.profil-public-toggle-check');
    const champs = [];
    checks.forEach(c => {
        if (c.checked) champs.push(c.dataset.champ);
    });

    try {
        const r = await fetch('/api/profil/public-champs', {
            method  : 'PATCH',
            headers : {
                'Content-Type'  : 'application/json',
                'Authorization' : `Bearer ${user.token}`
            },
            body: JSON.stringify({ champs })
        });
        const d = await r.json();
        if (d.success) {
            msg.textContent = '✅ Préférences sauvegardées !';
            msg.style.color = '#10b981';
        } else {
            msg.textContent = '❌ ' + (d.message || 'Erreur.');
            msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau.';
        msg.style.color = '#ef4444';
    }
}

async function _socialOnglet(onglet) {
    const zone      = document.getElementById('social-tab-content');
    const btnMiens  = document.getElementById('social-tab-miens');
    const btnNouv   = document.getElementById('social-tab-nouveau');
    if (!zone) return;

    if (onglet === 'miens') {
        btnMiens.style.background = '#7c3aed'; btnMiens.style.color = '#fff';
        btnNouv.style.background  = '#f5f3ff'; btnNouv.style.color  = '#7c3aed';
    } else {
        btnNouv.style.background  = '#7c3aed'; btnNouv.style.color  = '#fff';
        btnMiens.style.background = '#f5f3ff'; btnMiens.style.color = '#7c3aed';
    }

    zone.innerHTML = '<p style="color:#9ca3af;font-size:13px">Chargement...</p>';

    if (typeof window._chargerSocialOnglet === 'function') {
        await window._chargerSocialOnglet(onglet, zone);
    } else {
        zone.innerHTML = '<p style="color:#9ca3af;font-size:13px">Fonctionnalité en cours de chargement.</p>';
    }

    // Injection de la section "Mon Profil Public" au-dessus du contenu social,
    // uniquement sur l'onglet "miens" (Ce que je partage), pour respecter le
    // placement demandé sans dupliquer sur l'onglet "Partager avec…".
    if (onglet === 'miens') {
        await _injecterProfilPublicToggles();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    chargerProfilHeader();
});
