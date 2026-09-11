// ============================================================
// public/js/modal.js
// Modales : météo, prière, islam, tâches, anniversaires,
// cycle, profil, admin, astrologie, theme-astral, agenda-unifie.
// ============================================================

const JOURS_MODAL = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// ── ÉCOUTEUR RETOUR ANDROID (HISTORY API) ──
window.addEventListener('popstate', (e) => {
    // Si l'utilisateur fait "Retour" (geste ou bouton) et qu'une modale est ouverte
    if (document.body.classList.contains('modal-open')) {
        closeModal(true); // true = bypass l'appel history.back() car on y est déjà
    }
});

// ── ÉCOUTEUR TOUCHE ÉCHAP (Correctif v1.83.3) ──
// Nouveau moyen de fermeture volontaire d'une modale, en remplacement
// du clic extérieur (désormais désactivé, voir closeOutside() plus bas)
// pour éviter toute perte de saisie accidentelle.
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('modal-open')) {
        closeModal();
    }
});

// ===================== OUVERTURE MODALE ======================

async function openModal(type) {
    document.getElementById('overlay').classList.add('on');
    document.body.classList.add('modal-open');

    // Ajout d'une entrée dans l'historique pour intercepter le retour Android
    history.pushState({ modalOpen: true }, '', '');

    const titres = {
        meteo          : 'Météo du jour',
        priere         : 'Prière du jour',
        islam          : 'Prières & Hadiths',
        taches         : 'Tâches du jour',
        anniversaires  : 'Anniversaires',
        profil         : 'Mon Profil',
        admin          : 'Administration',
        cycle          : 'Suivi du cycle',
        astrologie     : 'Astrologie',
        'theme-astral' : 'Thème Astral',
        'agenda-unifie': 'Mon Agenda',
    };
    document.getElementById('modal-title').textContent = titres[type] || type;

    // ── Météo ─────────────────────────────────────────────────
    if (type === 'meteo') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        _ouvrirModaleMeteo();

    // ── Prière ────────────────────────────────────────────────
    } else if (type === 'priere') {
        document.getElementById('modal-body').innerHTML = priere ? `
            <div class="islam-modal">
                <div style="display:flex;justify-content:space-between;align-items:center;
                            background:linear-gradient(135deg,#fef3c7,#fde68a);
                            border-radius:12px;padding:12px 16px;margin-bottom:16px;
                            border-left:4px solid #d97706;">
                    ${priere.titre
                        ? `<div style="font-size:13px;font-weight:700;color:#78350f;line-height:1.4">📖 ${priere.titre}</div>`
                        : '<div></div>'}
                    <button onclick="lirePriereModal(event)" id="btn-speaker-modal"
                        style="background:rgba(167,139,250,0.85);border:1px solid rgba(255,255,255,0.5);border-radius:50px;
                               width:40px;height:40px;cursor:pointer;font-size:16px;color:#fff;
                               display:flex;align-items:center;justify-content:center;
                               box-shadow:0 8px 24px rgba(167,139,250,0.25);backdrop-filter:blur(8px);
                               flex-shrink:0;margin-left:10px;transition:all 0.2s">
                        🔊
                    </button>
                </div>
                ${priere.evangile ? `
                <div style="margin-bottom:14px">
                    <div class="islam-modal-titre-section">Évangile du jour</div>
                    <div style="background:#fffbeb;border-radius:10px;padding:14px 16px;
                                border-left:4px solid #d97706;
                                font-size:13px;color:#444;line-height:1.8;
                                max-height:260px;overflow-y:auto">
                        ${priere.evangile.replace(/\n/g, '<br>')}
                    </div>
                </div>` : `
                <div style="margin-bottom:14px">
                    <div style="background:#fffbeb;border-radius:10px;padding:14px 16px;
                                border-left:4px solid #d97706;
                                font-size:13px;color:#444;line-height:1.8;font-style:italic">
                        "${priere.texte}"<br><br><em>— ${priere.ref}</em>
                    </div>
                </div>`}
                ${priere.lecture1 ? `
                <div style="margin-bottom:14px">
                    <div class="islam-modal-titre-section">Première lecture</div>
                    <div style="background:#f0f9ff;border-radius:10px;padding:14px 16px;
                                border-left:4px solid #0369a1;
                                font-size:13px;color:#444;line-height:1.8;
                                max-height:200px;overflow-y:auto">
                        ${priere.lecture1.replace(/\n/g, '<br>')}
                    </div>
                </div>` : ''}
            </div>
        ` : '<p style="color:#9ca3af;text-align:center;padding:20px">Chargement...</p>';

    // ── Islam ─────────────────────────────────────────────────
    } else if (type === 'islam') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px 0">Chargement...</p>';
        if (!window._islamData) {
            if (typeof window.chargerIslam === 'function') window.chargerIslam();
            await new Promise(resolve => {
                let tries = 0;
                const iv = setInterval(() => {
                    tries++;
                    if (window._islamData || tries >= 15) { clearInterval(iv); resolve(); }
                }, 200);
            });
        }
        const d     = window._islamData;
        const toMin = hhmm => { if (!hhmm) return null; const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
        const now   = new Date().getHours() * 60 + new Date().getMinutes();
        const listePrieres = [
            { nom:'Fajr',    label:'Fajr (Aube)',       heure: d?.fajr    },
            { nom:'Dhuhr',   label:'Dhuhr (Midi)',      heure: d?.dhuhr   },
            { nom:'Asr',     label:'Asr (Après-midi)',  heure: d?.asr     },
            { nom:'Maghrib', label:'Maghrib (Coucher)', heure: d?.maghrib },
            { nom:'Isha',    label:'Isha (Nuit)',       heure: d?.isha    },
        ];
        const prochaine = d ? (listePrieres.find(x => toMin(x.heure) > now) || listePrieres[0]) : null;
        let coords = { ville: 'Paris' };
        try { coords = JSON.parse(localStorage.getItem('islam_coords')) || coords; } catch {}

        document.getElementById('modal-body').innerHTML = (d && !d.erreur) ? `
            <div class="islam-modal">
                <div class="islam-modal-header">
                    <div class="islam-modal-date">${d.date || ''}</div>
                    <div style="text-align:center;margin-top:6px;">
                        <span style="font-size:12px;color:#059669;font-weight:600;">📍 ${coords.ville}</span>
                        <button onclick="window._islamChangerVille()" style="margin-left:10px;background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.3);color:rgb(167, 139, 250);border-radius:50px;padding:4px 12px;font-size:11px;cursor:pointer;font-weight:600;backdrop-filter:blur(5px);">Changer</button>
                    </div>
                </div>
                <div id="islam-ville-form" style="display:none;background:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.8);backdrop-filter:blur(10px);border-radius:16px;padding:14px;margin:10px 0;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                    <div style="font-weight:700;font-size:13px;color:#333;margin-bottom:10px;">Changer la localisation</div>
                    <button class="add-btn" onclick="window._islamGeolocate()" style="margin-bottom:12px;">📍 Utiliser ma position GPS</button>
                    <div style="display:flex;gap:8px;">
                        <input id="islam-ville-input" placeholder="Nom de la ville..." style="flex:1;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:50px;font-size:13px;outline:none;">
                        <button class="btn-save" onclick="window._islamRechercherVille()">OK</button>
                    </div>
                    <div id="islam-ville-msg" style="font-size:12px;color:#ef4444;margin-top:6px;min-height:16px;padding-left:10px;"></div>
                </div>
                <div class="islam-modal-prieres">
                    <div class="islam-modal-titre-section">Horaires des prières</div>
                    ${listePrieres.map(p => {
                        const actif = prochaine && p.nom === prochaine.nom;
                        return `
                            <div class="islam-modal-priere-row ${actif ? 'islam-modal-priere-actif' : ''}">
                                <span class="islam-modal-priere-nom">${p.label}</span>
                                <span class="islam-modal-priere-heure">${p.heure}</span>
                                ${actif ? '<span class="islam-modal-priere-badge">Prochaine</span>' : ''}
                            </div>`;
                    }).join('')}
                </div>
                ${d.hadithFr ? `
                <div class="islam-modal-hadith">
                    <div class="islam-modal-titre-section">Hadith du jour</div>
                    ${d.hadithAr ? `<div class="islam-modal-hadith-arabe">${d.hadithAr}</div>` : ''}
                    <div class="islam-modal-hadith-fr">"${d.hadithFr}"</div>
                    <div class="islam-modal-hadith-ref">${d.hadithRef || ''}</div>
                </div>` : ''}
                ${d.douaFr ? `
                <div class="islam-modal-doua">
                    <div class="islam-modal-titre-section">Invocation (Doua)</div>
                    ${d.douaAr ? `<div class="islam-modal-doua-arabe">${d.douaAr}</div>` : ''}
                    <div class="islam-modal-doua-fr">"${d.douaFr}"</div>
                    ${d.douaRef ? `<div class="islam-modal-hadith-ref">${d.douaRef}</div>` : ''}
                </div>` : ''}
            </div>
        ` : '<p style="color:#ef4444;text-align:center;padding:20px 0">Horaires indisponibles pour le moment.</p>';

    // ── Tâches ────────────────────────────────────────────────
    } else if (type === 'taches') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        await chargerModalTaches();

    // ── Anniversaires ─────────────────────────────────────────
    } else if (type === 'anniversaires') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        await chargerModalAnniversaires();

    // ── Cycle ─────────────────────────────────────────────────
    } else if (type === 'cycle') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        await Cycle.ouvrirModalCalendrier();

    // ── Agenda unifié ─────────────────────────────────────────
    } else if (type === 'agenda-unifie') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px">Chargement...</p>';
        await ouvrirModaleAgenda();

    // ── Thème Astral ──────────────────────────────────────────
    } else if (type === 'theme-astral') {
        await ouvrirModaleThemeAstral();

    // ── Profil ────────────────────────────────────────────────
    } else if (type === 'profil') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        const user = getUser();
        if (!user?.token) {
            document.getElementById('modal-body').innerHTML = '<p>Erreur : utilisateur non identifié.</p>';
            return;
        }
        try {
            const r = await fetch('/api/profil', {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const d = await r.json();
            const p = d.profil || {};
            profilCache     = p;
            const photoSrc  = p.photo || '';
            const initiales = construireTrigramme(p.prenom, p.nom) || '👤';

            document.getElementById('modal-body').innerHTML = `
                <style>
                    @media (max-width: 480px) {
                        .profil-tab-label { display: none; }
                    }
                </style>
                <div id="profil-modal">
                <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid #f3f4f6;">
                    <button class="profil-tab active" data-tab="infos"
                        style="flex:1;padding:10px 4px;border:none;background:none;cursor:pointer;
                               font-size:12px;font-weight:600;color:#4f46e5;
                               border-bottom:2px solid #4f46e5;margin-bottom:-2px">
                        👤 <span class="profil-tab-label">Profil</span>
                    </button>
                    <button class="profil-tab" data-tab="sante"
                        style="flex:1;padding:10px 4px;border:none;background:none;cursor:pointer;
                               font-size:12px;font-weight:600;color:#9ca3af;
                               border-bottom:2px solid transparent;margin-bottom:-2px">
                        🏥 <span class="profil-tab-label">Santé</span>
                    </button>
                    <button class="profil-tab" data-tab="securite"
                        style="flex:1;padding:10px 4px;border:none;background:none;cursor:pointer;
                               font-size:12px;font-weight:600;color:#9ca3af;
                               border-bottom:2px solid transparent;margin-bottom:-2px">
                        🔑 <span class="profil-tab-label">Sécurité</span>
                    </button>
                    <button class="profil-tab" data-tab="widgets"
                        style="flex:1;padding:10px 4px;border:none;background:none;cursor:pointer;
                               font-size:12px;font-weight:600;color:#9ca3af;
                               border-bottom:2px solid transparent;margin-bottom:-2px">
                        📱 <span class="profil-tab-label">Widgets</span>
                    </button>
                    <button class="profil-tab" data-tab="social"
                        style="flex:1;padding:10px 4px;border:none;background:none;cursor:pointer;
                               font-size:12px;font-weight:600;color:#9ca3af;
                               border-bottom:2px solid transparent;margin-bottom:-2px">
                        🤝 <span class="profil-tab-label">Social</span>
                    </button>
                </div>

                <!-- ── ONGLET PROFIL ── -->
                <div id="profil-tab-infos" class="profil-tab-content">
                    <div style="background:rgba(255,255,255,0.92); border:1px solid rgba(255,255,255,0.95); backdrop-filter:blur(10px); border-radius:24px; padding:20px; box-shadow:0 8px 32px rgba(0,0,0,0.08);">
                        <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:20px">
                            ${photoSrc
                                ? `<img id="profil-photo-preview" src="${photoSrc}"
                                    style="width:90px;height:90px;border-radius:50%;object-fit:cover;
                                           border:3px solid #8b5cf6;cursor:pointer;
                                           box-shadow:0 4px 12px rgba(139,92,246,0.3)"
                                    onclick="document.getElementById('photo-input').click()">`
                                : `<div class="profil-widget-initiales"
                                        style="width:90px;height:90px;font-size:24px;cursor:pointer;
                                               box-shadow:0 4px 12px rgba(139,92,246,0.3)"
                                        onclick="document.getElementById('photo-input').click()">${initiales}</div>`
                            }
                            <input type="file" id="photo-input" accept="image/*" style="display:none"
                                onchange="previewPhoto(event)">
                            <span style="font-size:11px;color:#9ca3af;margin-top:8px">Appuyez sur la photo pour changer</span>
                            ${photoSrc
                                ? `<button id="btn-supprimer-photo" onclick="supprimerPhoto()" class="btn-delete" style="margin-top:12px; width:auto;">
                                    🗑️ Supprimer la photo
                                   </button>`
                                : ''
                            }
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                            <div>
                                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Prénom</label>
                                <input id="p-prenom" placeholder="Prénom" value="${p.prenom||''}"
                                    style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                            </div>
                                                        <div>
                                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Nom</label>
                                <input id="p-nom" placeholder="Nom" value="${p.nom||''}"
                                    style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                            <div>
                                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Date de naissance</label>
                                <input id="p-naissance" type="date" value="${p.date_naissance ? p.date_naissance.split('T')[0] : ''}"
                                    style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                            </div>
                                                        <div>
                                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Heure de naissance</label>
                                <input id="p-heure-naissance" type="time" value="${p.heure_naissance ? p.heure_naissance.slice(0,5) : ''}"
                                    style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                            </div>
                        </div>
                        <div style="margin-bottom:10px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Lieu de naissance</label>
                            <input id="p-lieu-naissance" type="text" placeholder="Ville de naissance"
                                value="${p.lieu_naissance||''}"
                                onblur="geocoderLieuNaissance()"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                                                        <input type="hidden" id="p-naissance-lat" value="${p.naissance_lat||''}">
                            <input type="hidden" id="p-naissance-lon" value="${p.naissance_lon||''}">
                            <div id="p-lieu-naissance-msg" style="font-size:12px;                                margin-top:4px;min-height:16px;
                                ${p.naissance_lat ? 'color:#10b981' : 'color:#9ca3af'}">
                                ${p.naissance_lat ? '✅ Coordonnées enregistrées' : ''}
                            </div>
                        </div>

                        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                                    letter-spacing:.5px;margin-bottom:10px;margin-top:4px">Astrologie</div>
                        <div style="margin-bottom:16px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Signe du zodiaque</label>
                            <select id="p-signe"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                                <option value="">— Laisser calculer depuis la date de naissance —</option>
                                <option value="belier"     ${p.signe_zodiaque==='belier'     ? 'selected':''}>♈ Bélier</option>
                                <option value="taureau"    ${p.signe_zodiaque==='taureau'    ? 'selected':''}>♉ Taureau</option>
                                <option value="gemeaux"    ${p.signe_zodiaque==='gemeaux'    ? 'selected':''}>♊ Gémeaux</option>
                                <option value="cancer"     ${p.signe_zodiaque==='cancer'     ? 'selected':''}>♋ Cancer</option>
                                                                <option value="lion"       ${p.signe_zodiaque==='lion'       ? 'selected':''}>♌ Lion</option>
                                <option value="vierge"     ${p.signe_zodiaque==='vierge'     ? 'selected':''}>♍ Vierge</option>
                                <option value="balance"    ${p.signe_zodiaque==='balance'    ? 'selected':''}>♎ Balance</option>
                                <option value="scorpion"   ${p.signe_zodiaque==='scorpion'   ? 'selected':''}>♏ Scorpion</option>
                                <option value="sagittaire" ${p.signe_zodiaque==='sagittaire' ? 'selected':''}>♐ Sagittaire</option>
                                <option value="capricorne" ${p.signe_zodiaque==='capricorne' ? 'selected':''}>♑ Capricorne</option>
                                <option value="verseau"    ${p.signe_zodiaque==='verseau'    ? 'selected':''}>♒ Verseau</option>
                                <option value="poissons"   ${p.signe_zodiaque==='poissons'   ? 'selected':''}>♓ Poissons</option>
                            </select>
                            <div style="font-size:11px;color:#9ca3af;margin-top:4px">
                                Utile uniquement si vous n'avez pas renseigné de date de naissance.
                            </div>
                        </div>

                        <div style="margin-bottom:10px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Email</label>
                            <input id="p-email" placeholder="Email" value="${p.email||''}"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                            <div>
                                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Téléphone</label>
                                <input id="p-tel" placeholder="Téléphone" value="${p.telephone||''}"
                                    style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                            </div>
                            <div>
                                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Profession</label>
                                <input id="p-prof" placeholder="Profession" value="${p.profession||''}"
                                    style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                            </div>
                        </div>
                        <div style="margin-bottom:10px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Site internet</label>
                            <input id="p-site-web" type="url" placeholder="https://..." value="${p.site_web||''}"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                        </div>
                        <div style="margin-bottom:16px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Note personnelle</label>
                            <textarea id="p-note" placeholder="Note personnelle..." rows="3"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;
                                       font-size:14px;box-sizing:border-box;resize:none;outline:none;background:rgba(255,255,255,0.8)">${p.note||''}</textarea>
                        </div>
                        <button class="btn-save" onclick="sauvegarderProfil()" style="width:100%;">
                            💾 Sauvegarder le profil
                        </button>
                        <div id="profil-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>
                    </div>
                </div>

                <!-- ── ONGLET SANTÉ ── -->
                <div id="profil-tab-sante" class="profil-tab-content" style="display:none">
                    <div style="background:rgba(255,255,255,0.92); border:1px solid rgba(255,255,255,0.95); backdrop-filter:blur(10px); border-radius:24px; padding:20px; box-shadow:0 8px 32px rgba(0,0,0,0.08);">
                        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                                    letter-spacing:.5px;margin-bottom:10px">Identité biologique</div>
                        <div style="margin-bottom:10px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Sexe</label>
                            <select id="p-sexe"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                                <option value="">— Non renseigné —</option>
                                <option value="femme"     ${p.sexe === 'femme'     ? 'selected' : ''}>Femme</option>
                                <option value="homme"     ${p.sexe === 'homme'     ? 'selected' : ''}>Homme</option>
                                <option value="intersexe" ${p.sexe === 'intersexe' ? 'selected' : ''}>Intersexe</option>
                            </select>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                            <div>
                                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Taille (cm)</label>
                                <input id="p-taille" type="number" min="50" max="250" placeholder="170"
                                    value="${p.taille||''}"
                                    style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                            </div>
                            <div>
                                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Poids (kg)</label>
                                <input id="p-poids" type="number" min="20" max="300" step="0.1" placeholder="65"
                                    value="${p.poids||''}"
                                    style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                            </div>
                        </div>
                        <div style="margin-bottom:16px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Groupe sanguin</label>
                            <select id="p-groupe-sanguin"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                                <option value="">— Non renseigné —</option>
                                ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g =>
                                    `<option value="${g}" ${p.groupe_sanguin === g ? 'selected' : ''}>${g}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                                    letter-spacing:.5px;margin-bottom:10px;margin-top:4px">Activité & Objectif</div>
                        <div style="margin-bottom:10px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Niveau d'activité</label>
                            <select id="p-niveau-activite"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                                <option value="">— Non renseigné —</option>
                                <option value="sedentaire" ${p.niveau_activite === 'sedentaire' ? 'selected' : ''}>Sédentaire (bureau, peu de sport)</option>
                                <option value="leger"      ${p.niveau_activite === 'leger'      ? 'selected' : ''}>Légèrement actif (1–3 séances/sem)</option>
                                <option value="modere"     ${p.niveau_activite === 'modere'     ? 'selected' : ''}>Modérément actif (3–5 séances/sem)</option>
                                <option value="actif"      ${p.niveau_activite === 'actif'      ? 'selected' : ''}>Actif (6–7 séances/sem)</option>
                                <option value="tres_actif" ${p.niveau_activite === 'tres_actif' ? 'selected' : ''}>Très actif (sport intensif quotidien)</option>
                            </select>
                        </div>
                        <div style="margin-bottom:16px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Objectif à atteindre</label>
                            <select id="p-objectif-sante"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                                <option value="">— Non renseigné —</option>
                                <option value="perte_rapide"       ${p.objectif_sante === 'perte_rapide'       ? 'selected' : ''}>🔥 Perte de poids rapide (−500 kcal/j)</option>
                                <option value="perte_moderee"      ${p.objectif_sante === 'perte_moderee'      ? 'selected' : ''}>📉 Perte de poids modérée (−300 kcal/j)</option>
                                <option value="maintien"           ${p.objectif_sante === 'maintien'           ? 'selected' : ''}>⚖️ Maintien du poids (0 kcal)</option>
                                <option value="prise_masse"        ${p.objectif_sante === 'prise_masse'        ? 'selected' : ''}>💪 Prise de masse (+300 kcal/j)</option>
                                <option value="prise_masse_rapide" ${p.objectif_sante === 'prise_masse_rapide' ? 'selected' : ''}>🏋️ Prise de masse rapide (+500 kcal/j)</option>
                            </select>
                        </div>

                        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                                    letter-spacing:.5px;margin-bottom:10px;margin-top:4px">Alimentation</div>
                        <div style="margin-bottom:10px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">
                                Allergies <span style="font-size:11px;color:#9ca3af;text-transform:none">(séparées par des virgules)</span>
                            </label>
                            <input type="text" id="p-allergies"
                                placeholder="gluten, arachides, lactose"
                                value="${Array.isArray(p.allergies) ? p.allergies.join(', ') : ''}"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                        </div>
                        <div style="margin-bottom:16px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">
                                Aliments exclus <span style="font-size:11px;color:#9ca3af;text-transform:none">(séparés par des virgules)</span>
                            </label>
                            <input type="text" id="p-aliments-exclus"
                                placeholder="porc, alcool, café"
                                value="${Array.isArray(p.aliments_exclus) ? p.aliments_exclus.join(', ') : ''}"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                        </div>

                        <button class="btn-save" onclick="sauvegarderSante()" style="width:100%;">
                            💾 Sauvegarder la santé
                        </button>
                        <div id="sante-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>
                    </div>
                </div>

                                <!-- ── ONGLET SÉCURITÉ ── -->
                <div id="profil-tab-securite" class="profil-tab-content" style="display:none">
                    <div style="background:rgba(255,255,255,0.92); border:1px solid rgba(255,255,255,0.95); backdrop-filter:blur(10px); border-radius:24px; padding:20px; box-shadow:0 8px 32px rgba(0,0,0,0.08);">
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
                            <div style="width:48px;height:48px;background:linear-gradient(135deg,#fcd34d,#fbbf24);
                                        border-radius:14px;display:flex;align-items:center;justify-content:center;
                                        font-size:22px;box-shadow:0 4px 10px rgba(245,158,11,0.2)">🔑</div>
                            <div>
                                <div style="font-weight:700;color:#111;font-size:15px">Changer le mot de passe</div>
                                <div style="font-size:12px;color:#9ca3af;margin-top:2px">8 car. min · majuscule · minuscule · chiffre · caractère spécial</div>
                            </div>
                        </div>
                        <div style="margin-bottom:10px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Ancien mot de passe</label>
                            <input type="password" id="mdp-ancien" placeholder="••••••••"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                        </div>
                        <div style="margin-bottom:10px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Nouveau mot de passe</label>
                            <input type="password" id="mdp-nouveau" placeholder="••••••••"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                        </div>
                        <div style="margin-bottom:20px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Confirmer le mot de passe</label>
                            <input type="password" id="mdp-confirm" placeholder="••••••••"
                                style="width:100%;padding:10px 12px;border:1.5px solid rgba(229,231,235,0.7);border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.8)">
                        </div>
                        <button class="btn-save" onclick="changerMdp()" style="width:100%;">
                            🔑 Changer le mot de passe
                        </button>
                        <div id="mdp-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>
                    </div>
                </div>

                <!-- ── ONGLET WIDGETS ── -->
                <div id="profil-tab-widgets" class="profil-tab-content" style="display:none">
                    <div style="background:rgba(255,255,255,0.92); border:1px solid rgba(255,255,255,0.95); backdrop-filter:blur(10px); border-radius:24px; padding:20px; box-shadow:0 8px 32px rgba(0,0,0,0.08);">
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
                            <div style="width:48px;height:48px;background:linear-gradient(135deg,#34d399,#10b981);
                                        border-radius:14px;display:flex;align-items:center;justify-content:center;
                                        font-size:22px;box-shadow:0 4px 10px rgba(16,185,129,0.3)">📱</div>
                            <div>
                                <div style="font-weight:700;color:#111;font-size:15px">Mes widgets</div>
                                <div style="font-size:12px;color:#9ca3af;margin-top:2px">Choisis ce qui s'affiche sur ton tableau de bord</div>
                            </div>
                        </div>
                        <div id="widgets-choix" class="widgets-choix-grid">
                            <p style="color:#9ca3af;font-size:13px">Chargement...</p>
                        </div>
                        <button class="btn-save" onclick="sauvegarderWidgetsVisibles()" style="width:100%; margin-top:16px;">
                            💾 Sauvegarder mes widgets
                        </button>
                        <div id="widgets-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>
                    </div>
                </div>

                <!-- ── ONGLET SOCIAL ── -->
                <div id="profil-tab-social" class="profil-tab-content" style="display:none">
                    <div style="display:flex;gap:8px;margin-bottom:20px;background:rgba(255,255,255,0.4);border:1px solid rgba(255,255,255,0.6);border-radius:50px;padding:4px;backdrop-filter:blur(10px);">
                        <button id="social-tab-miens"
                            data-action="social-onglet"
                            data-onglet="miens"
                            style="flex:1;padding:12px;border:none;background:rgba(167,139,250,0.85);
                                   color:#fff;font-size:13px;font-weight:600;cursor:pointer;border-radius:50px;
                                   box-shadow:0 8px 24px rgba(167,139,250,0.25);backdrop-filter:blur(8px);transition:all 0.3s ease;">
                            Ce que je partage
                        </button>
                                                <button id="social-tab-nouveau"
                            data-action="social-onglet"
                            data-onglet="nouveau"
                            style="flex:1;padding:12px;border:none;background:transparent;
                                   color:#6b7280;font-size:13px;font-weight:600;cursor:pointer;border-radius:50px;transition:all 0.3s ease;">
                            Partager avec…
                        </button>
                    </div>
                    <div id="social-tab-content" style="background:rgba(255,255,255,0.92); border:1px solid rgba(255,255,255,0.95); backdrop-filter:blur(10px); border-radius:24px; padding:20px; box-shadow:0 8px 32px rgba(0,0,0,0.08);"></div>
                </div>
                </div>
            `;

                        // ── Injection V3 : Bloc "Suivi Médical" dans l'onglet Santé ──
            // Ajouté ici car openModal() reconstruit tout le HTML de la modale
            // (avec le "p" déjà récupéré ci-dessus par le fetch de cette fonction).
            _injecterChampsAllergies(p);

                        // ── Listeners onglets profil ───────────────────────────
            document.querySelectorAll('.profil-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.profil-tab').forEach(t => {
                        t.style.color             = '#9ca3af';
                        t.style.borderBottomColor = 'transparent';
                    });
                    tab.style.color             = '#4f46e5';
                    tab.style.borderBottomColor = '#4f46e5';
                    document.querySelectorAll('.profil-tab-content').forEach(c => c.style.display = 'none');
                    const cible = document.getElementById(`profil-tab-${tab.dataset.tab}`);
                    if (cible) cible.style.display = 'block';
                    if (tab.dataset.tab === 'widgets') afficherSectionWidgets();
                    if (tab.dataset.tab === 'social')  _socialOnglet('miens');
                });
            });

            // ── Listeners onglets social ──────────────────────────
            document.querySelectorAll('[data-action="social-onglet"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    // Mettre à jour visuellement les boutons pillules (charte violet V3)
                                        document.getElementById('social-tab-nouveau').style.background = 'transparent';
                    document.getElementById('social-tab-nouveau').style.color = '#6b7280';
                    document.getElementById('social-tab-nouveau').style.boxShadow = 'none';
                    document.getElementById('social-tab-nouveau').style.backdropFilter = 'none';
                    
                    btn.style.background = 'rgba(167,139,250,0.85)';
                    btn.style.color = '#fff';
                    btn.style.boxShadow = '0 8px 24px rgba(167,139,250,0.25)';
                    btn.style.backdropFilter = 'blur(8px)';
                    
                    _socialOnglet(btn.dataset.onglet);
                });
            });

            await afficherSectionWidgets();
        } catch {
            document.getElementById('modal-body').innerHTML = '<p>Erreur de chargement du profil.</p>';
        }

    // ── Astrologie ────────────────────────────────────────────
    } else if (type === 'astrologie') {
        await ouvrirModaleAstrologie();

    // ── Admin ─────────────────────────────────────────────────
    } else if (type === 'admin') {
        document.getElementById('modal-body').innerHTML = `
            <div class="admin-tabs" style="display:flex;gap:8px;margin-bottom:20px;background:rgba(255,255,255,0.4);border:1px solid rgba(255,255,255,0.6);border-radius:50px;padding:4px;backdrop-filter:blur(10px);">
                <button class="admin-tab active" data-tab="stats" onclick="switchAdminTab('stats')" style="flex:1;border-radius:50px;border:none;">📊 Stats</button>
                <button class="admin-tab" data-tab="users"  onclick="switchAdminTab('users')" style="flex:1;border-radius:50px;border:none;">👥 Utilisateurs</button>
            </div>
            <div id="admin-tab-stats" class="admin-tab-content active" style="background:rgba(255,255,255,0.92); border:1px solid rgba(255,255,255,0.95); backdrop-filter:blur(10px); border-radius:24px; padding:20px; box-shadow:0 8px 32px rgba(0,0,0,0.08);"><p style="color:#9ca3af">Chargement...</p></div>
            <div id="admin-tab-users" class="admin-tab-content" style="background:rgba(255,255,255,0.92); border:1px solid rgba(255,255,255,0.95); backdrop-filter:blur(10px); border-radius:24px; padding:20px; box-shadow:0 8px 32px rgba(0,0,0,0.08);"><p style="color:#9ca3af">Chargement...</p></div>
        `;
        chargerAdminStats();
        chargerAdminUsers();

    } else {
        document.getElementById('modal-body').innerHTML = '<p>En construction — disponible prochainement.</p>';
    }
}

// ===================== LECTURE VOCALE PRIÈRE =================

function lirePriereModal(e) {
    if (!('speechSynthesis' in window)) {
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#ef4444;font-size:15px;margin-bottom:20px">La synthèse vocale n'est pas supportée par votre navigateur.</p>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="openModal('priere')" style="border-radius:50px;">Retour</button>
            </div>`;
        return;
    }
    const synth = window.speechSynthesis;
    if (synth.speaking) {
        synth.cancel();
        if (e?.currentTarget) e.currentTarget.textContent = '🔊';
        return;
    }
    const texteALire = `${priere.titre || ''}. ${priere.evangile || priere.texte || ''} ${priere.ref || ''}`;
    const utterance  = new SpeechSynthesisUtterance(texteALire);
    utterance.lang   = 'fr-FR';
    utterance.rate   = 0.9;
    utterance.pitch  = 0.7;
    const lancerLecture = () => {
        const voix     = synth.getVoices();
        const voixMasc = voix.find(v =>
            v.lang.startsWith('fr') && (
                v.name.toLowerCase().includes('thomas')  ||
                v.name.toLowerCase().includes('nicolas') ||
                v.name.toLowerCase().includes('pierre')  ||
                v.name.toLowerCase().includes('jean')    ||
                v.name.toLowerCase().includes('male')    ||
                v.name.toLowerCase().includes('man')
            )
        ) || voix.find(v => v.lang.startsWith('fr'));
        if (voixMasc) utterance.voice = voixMasc;

        const btn = e?.currentTarget || document.getElementById('btn-speaker-modal');
        if (btn) btn.textContent = '⏹️';
        utterance.onend   = () => { if (btn) btn.textContent = '🔊'; };
        utterance.onerror = () => { if (btn) btn.textContent = '🔊'; };

        synth.speak(utterance);
    };
    if (synth.getVoices().length === 0) synth.onvoiceschanged = lancerLecture;
    else lancerLecture();
}

// ===================== FERMETURE MODALE ======================

// Note : skipHistory=true permet de ne pas faire `history.back()` si l'appel vient déjà du bouton retour (popstate)
function closeModal(skipHistory = false) {
    window.speechSynthesis?.cancel();
    document.getElementById('overlay').classList.remove('on');
    document.body.classList.remove('modal-open');
    document.querySelector('.modal.modal-lightbox')?.classList.remove('modal-lightbox');

    // Si la modale est fermée via la croix (ou le fond) et non par le bouton retour Android,
    // on retire l'état de l'historique pour ne pas casser la navigation.
    if (!skipHistory && history.state && history.state.modalOpen) {
        history.back();
    }
}

// Correctif v1.83.3 : le clic sur l'overlay (en dehors de la modale) ne ferme
// plus la fenêtre. Cela évite la perte de saisie en cas de clic accidentel
// pendant une saisie de formulaire (Profil, Widgets, création utilisateur...).
// Fermeture désormais possible uniquement via le bouton ✕, la touche Échap,
// ou le bouton retour Android (gérés ailleurs dans ce fichier).
function closeOutside(e) {
    // Volontairement neutralisé — ne fait plus rien.
}
