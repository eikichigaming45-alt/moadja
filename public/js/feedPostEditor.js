// ============================================================
// public/js/feedPostEditor.js
// Fil social — Module Édition de post (extrait de feed.js)
// Modales "Nouveau post" (LOC1) et "Éditer post" (LOC3 + LOC1).
// Dépend de : feed.js (getUser, closeModal, chargerFeed, escapeHtml),
//             feedMentions.js (initMentions),
//             feedLocation.js (_initLieuAutocomplete, rechercherLieuGeoloc)
// ============================================================

window._editSupprimerPhoto = false;

// ── MODAL NOUVEAU POST (LOC1) ─────────────────────────────────
function ouvrirModalPost() {
    window._editSupprimerPhoto = false;
    document.getElementById('overlay').classList.add('on');
    document.getElementById('modal-title').textContent = 'Nouveau post';

    // CORRECTION BUG 1 : Application du Glassmorphism V3
    document.getElementById('modal-body').innerHTML = `
        <div id="new-post-wrap" style="position:relative">
            <textarea id="post-contenu" placeholder="Quoi de neuf ? (@Prénom NOM pour mentionner)" rows="4" style="width:100%;padding:14px;background:rgba(255,255,255,0.6);border:var(--glass-border, 1px solid rgba(255,255,255,0.8));border-radius:16px;backdrop-filter:blur(8px);font-size:14px;resize:vertical;box-sizing:border-box;outline:none;font-family:inherit;transition:all .2s;"></textarea>
        </div>
        <div id="new-loc-wrap" class="loc-input-wrap" style="margin-top:12px">
            <button type="button" class="loc-input-icone" onclick="rechercherLieuGeoloc('post-lieu', 'post-lat', 'post-lon', 'new-loc-wrap')" title="Me géolocaliser" style="border-radius:12px;">📍</button>
            <input type="text" id="post-lieu" class="loc-input" placeholder="Lieu (optionnel)" style="border-radius:12px;">
            <input type="hidden" id="post-lat" value="">
            <input type="hidden" id="post-lon" value="">
        </div>
        <div style="margin-top:16px">            <label style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;display:block;margin-bottom:8px">Photo (optionnelle)</label>
            <label for="post-photo" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:rgba(255,255,255,0.6);border:1px dashed #7c3aed;border-radius:16px;cursor:pointer;color:#7c3aed;font-weight:600;font-size:13px;transition:all .2s;">
                📸 <span id="post-photo-name">Choisir une image</span>
            </label>
            <input type="file" id="post-photo" accept="image/*" style="display:none">
        </div>
        <div id="post-preview" style="margin-top:12px"></div>
        <button onclick="publierPost()" style="width:100%;margin-top:20px;padding:14px;background:rgba(167,139,250,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:white;border:1px solid rgba(255,255,255,0.5);border-radius:50px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(167,139,250,0.25);transition:all .2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">Publier</button>
        <div id="post-msg" style="text-align:center;margin-top:12px;font-size:13px;min-height:18px"></div>
    `;
    const ta = document.getElementById('post-contenu'), wrap = document.getElementById('new-post-wrap'); initMentions(ta, wrap);
    _initLieuAutocomplete('post-lieu', 'post-lat', 'post-lon', 'new-loc-wrap');

    document.getElementById('post-photo').addEventListener('change', e => { 
        const file = e.target.files[0]; 
        const preview = document.getElementById('post-preview'); 
        const nameSpan = document.getElementById('post-photo-name');
        if (file) { 
            nameSpan.textContent = file.name;
            preview.innerHTML = `<img src="${URL.createObjectURL(file)}" style="width:100%;border-radius:12px;max-height:200px;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.05);">`; 
        } else { 
            nameSpan.textContent = 'Choisir une image';
            preview.innerHTML = ''; 
        } 
    });
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

// ── ÉDITER POST (LOC3 + LOC1) ─────────────────────────────────
function editerPost(postId) {
    const contenuActuel = document.getElementById(`post-contenu-${postId}`)?.textContent || '';
    const photoActuelle = document.getElementById(`post-${postId}`)?.dataset.photoUrl || '';
    const lieuActuel = document.getElementById(`post-lieu-raw-${postId}`)?.textContent || '';
    const lieuLatActuel = document.getElementById(`post-lieulat-raw-${postId}`)?.textContent || '';
    const lieuLonActuel = document.getElementById(`post-lieulon-raw-${postId}`)?.textContent || '';

    window._editSupprimerPhoto = false;
    document.getElementById('modal-title').textContent = 'Modifier le post';

    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px; width:100%; box-sizing:border-box;">
            
            <div id="edit-post-wrap" style="position:relative; width:100%;">
                <textarea id="edit-post-contenu" rows="4" style="width:100%;padding:14px;background:rgba(255,255,255,0.6);border:var(--glass-border, 1px solid rgba(255,255,255,0.8));border-radius:16px;backdrop-filter:blur(8px);font-size:14px;resize:vertical;box-sizing:border-box;outline:none;font-family:inherit;transition:all .2s; margin:0; display:block;"></textarea>
            </div>
            
            <div id="edit-loc-wrap" class="loc-input-wrap" style="width:100%;">
                <button type="button" class="loc-input-icone" onclick="rechercherLieuGeoloc('edit-post-lieu', 'edit-post-lat', 'edit-post-lon', 'edit-loc-wrap')" title="Me géolocaliser" style="border-radius:12px;flex-shrink:0;">📍</button>
                <input type="text" id="edit-post-lieu" class="loc-input" placeholder="Lieu (optionnel)" value="${escapeHtml(lieuActuel)}" style="border-radius:12px; margin:0;">
                <input type="hidden" id="edit-post-lat" value="${lieuLatActuel}">
                <input type="hidden" id="edit-post-lon" value="${lieuLonActuel}">
                        </div>
            
            <div style="width:100%; background:rgba(255,255,255,0.4); border:1px solid rgba(255,255,255,0.6); border-radius:16px; padding:16px; box-sizing:border-box;">
                <div style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;margin-bottom:12px;padding-left:4px;">Photo du post</div>
                
                ${photoActuelle ? `
                <div id="edit-photo-actuelle">
                    <img src="${photoActuelle}" style="width:100%;border-radius:12px;max-height:200px;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.05);margin-bottom:12px;display:block;">
                    
                    <div id="edit-photo-actions" style="display:flex; flex-direction:row; gap:8px; width:100%;">
                        <label for="edit-post-photo" style="flex:1; display:flex; align-items:center; justify-content:center; height:42px; margin:0; padding:0; background:rgba(255,255,255,0.6); border:1.5px dashed #7c3aed; border-radius:50px; cursor:pointer; color:#7c3aed; font-weight:600; font-size:12px; transition:all .2s; box-sizing:border-box;">
                            🔄 Remplacer
                        </label>
                        <button onclick="confirmerSuppressionPhotoInline()" style="flex:1; display:flex; align-items:center; justify-content:center; height:42px; margin:0; padding:0; background:rgba(239,68,68,0.1); color:#ef4444; border:1.5px solid rgba(239,68,68,0.2); border-radius:50px; font-size:12px; font-weight:600; cursor:pointer; transition:all .2s; box-sizing:border-box;">
                            🗑️ Retirer l'image
                        </button>
                    </div>
                </div>
                ` : `
                <label for="edit-post-photo" style="display:flex;align-items:center;justify-content:center;gap:8px;height:42px;background:rgba(255,255,255,0.6);border:1.5px dashed #7c3aed;border-radius:12px;cursor:pointer;color:#7c3aed;font-weight:600;font-size:13px;transition:all .2s; margin:0; box-sizing:border-box;">
                    📸 <span id="edit-post-photo-name">Ajouter une image</span>
                </label>
                `}
                <input type="file" id="edit-post-photo" accept="image/*" style="display:none">
                <div id="edit-post-preview" style="margin-top:12px"></div>
            </div>

            <button onclick="sauvegarderEditionPost(${postId})" style="width:100%; height:46px; display:flex; align-items:center; justify-content:center; background:rgba(167,139,250,0.85); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); color:white; border:1px solid rgba(255,255,255,0.5); border-radius:50px; font-size:15px; font-weight:600; cursor:pointer; box-shadow:0 8px 24px rgba(167,139,250,0.25); transition:all .2s; margin:0; box-sizing:border-box;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">Sauvegarder</button>
            <div id="edit-post-msg" style="text-align:center;font-size:13px;min-height:18px"></div>
        </div>
    `;

    const ta = document.getElementById('edit-post-contenu'); 
    const wrap = document.getElementById('edit-post-wrap'); 
    ta.value = contenuActuel; 
    initMentions(ta, wrap);

    _initLieuAutocomplete('edit-post-lieu', 'edit-post-lat', 'edit-post-lon', 'edit-loc-wrap');

    document.getElementById('edit-post-photo').addEventListener('change', e => { 
        const file = e.target.files[0]; 
        const preview = document.getElementById('edit-post-preview'); 
        const nameSpan = document.getElementById('edit-post-photo-name');

        window._editSupprimerPhoto = false; 

        if (file) { 
            if(nameSpan) nameSpan.textContent = file.name;
            const blocActuel = document.getElementById('edit-photo-actuelle');
            if(blocActuel) blocActuel.style.display = 'none'; 
            preview.innerHTML = `<img src="${URL.createObjectURL(file)}" style="width:100%;border-radius:12px;max-height:200px;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.05); display:block; margin:0;">`; 
        } else { 
            if(nameSpan) nameSpan.textContent = 'Ajouter une image';
            const blocActuel = document.getElementById('edit-photo-actuelle');
            if(blocActuel) blocActuel.style.display = 'block'; 
            preview.innerHTML = ''; 
        } 
    });

    document.getElementById('overlay').classList.add('on');
}

function confirmerSuppressionPhotoInline() {
    const actions = document.getElementById('edit-photo-actions');
    if (actions) {
        actions.innerHTML = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; text-align:center; background:rgba(255,255,255,0.8); border-radius:12px; padding:10px; box-sizing:border-box;">
                <div style="font-size:12px;color:#374151;font-weight:600;">Retirer l'image du post ?</div>
                <div style="display:flex; flex-direction:row; gap:8px; justify-content:center; width:100%;">
                    <button onclick="marquerSuppressionPhoto()" style="flex:1; display:flex; align-items:center; justify-content:center; height:36px; margin:0; padding:0; background:#ef4444; color:white; border:none; border-radius:50px; font-size:12px; font-weight:600; cursor:pointer; box-sizing:border-box;">Oui</button>
                    <button onclick="annulerSuppressionPhotoInline()" style="flex:1; display:flex; align-items:center; justify-content:center; height:36px; margin:0; padding:0; background:#f3f4f6; color:#374151; border:none; border-radius:50px; font-size:12px; font-weight:600; cursor:pointer; box-sizing:border-box;">Annuler</button>
                </div>
            </div>
        `;
    }
}

function annulerSuppressionPhotoInline() {
    const actions = document.getElementById('edit-photo-actions');
    if(actions) {
        actions.innerHTML = `
            <label for="edit-post-photo" style="flex:1; display:flex; align-items:center; justify-content:center; height:42px; margin:0; padding:0; background:rgba(255,255,255,0.6); border:1.5px dashed #7c3aed; border-radius:50px; cursor:pointer; color:#7c3aed; font-weight:600; font-size:12px; transition:all .2s; box-sizing:border-box;">
                🔄 Remplacer
            </label>
            <button onclick="confirmerSuppressionPhotoInline()" style="flex:1; display:flex; align-items:center; justify-content:center; height:42px; margin:0; padding:0; background:rgba(239,68,68,0.1); color:#ef4444; border:1.5px solid rgba(239,68,68,0.2); border-radius:50px; font-size:12px; font-weight:600; cursor:pointer; transition:all .2s; box-sizing:border-box;">
                🗑️ Retirer l'image
            </button>
        `;
    }
}

function marquerSuppressionPhoto() { 
    window._editSupprimerPhoto = true; 
    const bloc = document.getElementById('edit-photo-actuelle'); 
    if (bloc) {
        bloc.innerHTML = `<div style="font-size:13px;color:#ef4444;font-weight:600;padding:12px;text-align:center;background:rgba(239,68,68,0.1);border-radius:12px;margin-bottom:12px;border:1px solid rgba(239,68,68,0.2);">Image retirée (sera validé à la sauvegarde)</div>`;
    }
    const fileInput = document.getElementById('edit-post-photo');
    if (fileInput) fileInput.value = '';
    const preview = document.getElementById('edit-post-preview');
    if (preview) preview.innerHTML = '';
}

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
