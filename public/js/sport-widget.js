// ============================================================
// public/js/sport-widget.js
// ============================================================

const SPORT_ICONE_DUMBBELL = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="2.5"  y1="7" x2="2.5"  y2="17"></line>
        <line x1="5.5"  y1="9" x2="5.5"  y2="15"></line>
        <line x1="18.5" y1="9" x2="18.5" y2="15"></line>
        <line x1="21.5" y1="7" x2="21.5" y2="17"></line>
        <line x1="5.5" y1="12" x2="18.5" y2="12"></line>
    </svg>
`;

const SPORT_ICONE_TROPHEE = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 21h8"></path>
        <path d="M12 17v4"></path>
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4z"></path>
        <path d="M7 5H5a2 2 0 0 0 0 4h1"></path>
        <path d="M17 5h2a2 2 0 0 1 0 4h-1"></path>
    </svg>
`;

const SPORT_ICONE_PARTAGE = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
    </svg>
`;

const SPORT_ICONE_LOGO_MINI = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="2.5"  y1="7" x2="2.5"  y2="17"></line>
        <line x1="5.5"  y1="9" x2="5.5"  y2="15"></line>
        <line x1="18.5" y1="9" x2="18.5" y2="15"></line>
        <line x1="21.5" y1="7" x2="21.5" y2="17"></line>
        <line x1="5.5" y1="12" x2="18.5" y2="12"></line>
    </svg>
`;

const SPORT_WIDGET_MAX_EXERCICES_APERCU = 3;

function _sportToken() {
    try { return JSON.parse(localStorage.getItem('moadja_user'))?.token || ''; }
    catch { return ''; }
}

function _sportAuthHeaders() {
    return {
        'Content-Type' : 'application/json',
        'Authorization': `Bearer ${_sportToken()}`
    };
}

function _sportEchapper(str) {
    return (str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _sportFormatDateCourte(dateIso) {
    const MOIS_ABREGES = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const d = new Date(dateIso);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${MOIS_ABREGES[d.getMonth()]}`;
}

function _sportFormatDureeLongue(secondes) {
    const h = Math.floor(secondes / 3600);
    const m = Math.floor((secondes % 3600) / 60);
    const s = secondes % 60;
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
    if (m > 0) return `${m}min${String(s).padStart(2, '0')}`;
    return `${s}s`;
}

function _sportFormatDetailSerie(serie, estCardio) {
    if (estCardio) {
        const morceaux = [];
        if (Number.isInteger(serie.duration_seconds)) morceaux.push(_sportFormatDureeLongue(serie.duration_seconds));
        if (serie.distance_km != null) morceaux.push(`${serie.distance_km.toString().replace('.', ',')} km`);
        if (serie.speed_kmh != null) morceaux.push(`${serie.speed_kmh.toString().replace('.', ',')} km/h`);
        return morceaux.join(' - ');
    }
    const m = [];
    if (serie.weight_kg != null && serie.weight_kg > 0) m.push(`${serie.weight_kg} kg`);
    if (serie.reps != null) m.push(`${serie.reps} reps`);
    if (serie.duration_seconds != null && serie.duration_seconds > 0) m.push(_sportFormatDureeLongue(serie.duration_seconds));
    return m.join(' - ');
}

function _sportRenderSeanceIso(s) {
    const estGPS = s.activity_type === 'marche' || s.activity_type === 'course' || s.activity_type === 'vélo';
    const dateTexte = _sportFormatDateCourte(s.date_end || s.date_start);
    
    let labelBloc2 = estGPS ? 'DISTANCE' : 'VOLUME';
    let valeurBloc2 = estGPS 
        ? (s.distanceKm ? `${s.distanceKm.toFixed(2)} km` : '0 km')
        : (s.volumeKg ? `${s.volumeKg} kg` : '0 kg');
        
    let valCalories = s.calories ? `${s.calories} kcal` : '—';
    let warningCalories = (!s.calories && estGPS) 
        ? `<div style="font-size:11px;color:#ef4444;margin-top:4px;">⚠️ Poids introuvable, calories non calculées</div>` 
        : '';

    let badgeHtml = '';
    if (s.records_battus && s.records_battus > 0) {
        badgeHtml = `<div class="sport-widget-record-badge">🏆 ${s.records_battus} record${s.records_battus > 1 ? 's' : ''} battu${s.records_battus > 1 ? 's' : ''} !</div>`;
    } else if (!estGPS) {
        badgeHtml = `<div class="sport-widget-norecord-badge">🏆 Aucun nouveau record</div>`;
    }

    let listeHtml = '';
    if (estGPS) {
        let vitMoy = s.vitesseMoyenneKmh ? `${s.vitesseMoyenneKmh.toFixed(1)} km/h` : '—';
        listeHtml = `
        <div style="font-size:13px; color:#4b5563; margin-top:12px; display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d8b4fe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span style="color:#7c3aed;">Vitesse moyenne</span> <span style="font-weight:600;">${vitMoy}</span>
        </div>
        <div style="margin-top:12px; background:#f3f4f6; border-radius:8px; padding:10px; display:flex; align-items:center; justify-content:center; gap:8px; color:#6b7280; font-size:12px; font-weight:600;">
            🗺️ Cliquez pour voir la carte et le tracé
        </div>`;
    } else if (s.exercices && s.exercices.length > 0) {
        listeHtml = '<div class="sport-widget-exo-list">';
        const nbExos = s.exercices.length;
        const exosAffiches = s.exercices.slice(0, SPORT_WIDGET_MAX_EXERCICES_APERCU);
        
        exosAffiches.forEach(exo => {
            let infos = [];
            if (exo.is_cardio) {
                if (exo.distance_km) infos.push(`${exo.distance_km} km`);
                if (exo.duration_seconds) infos.push(_sportFormatDureeLongue(exo.duration_seconds));
            } else {
                if (exo.series && exo.series.length > 0) {
                    const maxPoids = Math.max(...exo.series.map(ser => ser.weight_kg || 0));
                    const totalReps = exo.series.reduce((sum, ser) => sum + (ser.reps || 0), 0);
                    if (maxPoids > 0) infos.push(`${maxPoids} kg`);
                    if (totalReps > 0) infos.push(`${totalReps} reps`);
                }
            }
            const setLabel = (exo.series && exo.series.length > 0) ? `${exo.series.length}x ` : '';
            listeHtml += `<div class="sport-widget-exo-item">
                <span class="sport-widget-exo-item-name"><span style="color:#7c3aed;font-weight:700;">${setLabel}</span>${_sportEchapper(exo.exercise_name)}</span>
                ${infos.length > 0 ? `<span class="sport-widget-exo-item-meta">· ${infos.join(' · ')}</span>` : ''}
            </div>`;
        });
        
        if (nbExos > SPORT_WIDGET_MAX_EXERCICES_APERCU) {
            listeHtml += `<div class="sport-widget-exo-more">...et ${nbExos - SPORT_WIDGET_MAX_EXERCICES_APERCU} autres</div>`;
        }
        listeHtml += '</div>';
    }

    let detailsRecordsHtml = '';
    if (s.details_records && s.details_records.length > 0) {
        detailsRecordsHtml = `<div class="sport-widget-records-list">`;
        s.details_records.forEach(r => {
            let val = '';
            if (r.record_type === 'max_weight') val = `${r.record_value} kg`;
            else if (r.record_type === 'max_reps') val = `${r.record_value} reps`;
            else if (r.record_type === 'max_volume') val = `${r.record_value} kg vol.`;
            else if (r.record_type === 'max_duration') val = _sportFormatDureeLongue(r.record_value);
            else if (r.record_type === 'max_distance') val = `${r.record_value} km`;
            else if (r.record_type === 'max_speed') val = `${r.record_value} km/h`;
            
            detailsRecordsHtml += `<div class="sport-widget-record-item">
                ${SPORT_ICONE_TROPHEE}
                <span><strong>${_sportEchapper(r.exercise_name)}</strong> : ${val}</span>
            </div>`;
        });
        detailsRecordsHtml += `</div>`;
    }

    let btnSupprHtml = '';
    if (typeof window.sportSupprimerSeance === 'function') {
        btnSupprHtml = `<button class="sport-widget-btn-suppr" onclick="event.stopPropagation(); sportSupprimerSeance(${s.id})" title="Supprimer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        </button>`;
    }

    let footerHtml = `
        <div class="sport-widget-recap-footer">
            <div class="sport-widget-recap-footer-logo">${SPORT_ICONE_LOGO_MINI} MoaDja</div>
            <button class="sport-widget-btn-partage" onclick="_sportOuvrirModalPartage(event, ${s.id})" title="Partager">
                ${SPORT_ICONE_PARTAGE}
            </button>
        </div>
    `;

    // L'ATTRIBUT ONCLICK OUVRE LA MODALE DE STATS
    return `
    <div class="sport-widget-recap-card" data-id="${s.id}" onclick="if(typeof openModalStatsSport === 'function') openModalStatsSport(${s.id})">
        <div class="sport-widget-recap-title-row">
            <span class="sport-widget-recap-name">${_sportEchapper(s.workout_name)}</span>
            <span style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <span class="sport-widget-recap-date">${dateTexte}</span>
                ${btnSupprHtml}
            </span>
        </div>

        ${badgeHtml}

        <div class="sport-widget-stats-grid">
            <div class="sport-widget-stat-box">
                <span class="sport-widget-stat-label">DURÉE</span>
                <span class="sport-widget-stat-value">${_sportFormatDureeLongue(s.dureeSecondes)}</span>
            </div>
            <div class="sport-widget-stat-box">
                <span class="sport-widget-stat-label">${labelBloc2.toUpperCase()}</span>
                <span class="sport-widget-stat-value">${valeurBloc2}</span>
            </div>
            <div class="sport-widget-stat-box">
                <span class="sport-widget-stat-label">CALORIES</span>
                <span class="sport-widget-stat-value" style="color:#ef4444;">${valCalories}</span>
            </div>
        </div>

        ${listeHtml}
        ${detailsRecordsHtml}
        ${warningCalories}
        ${footerHtml}
    </div>`;
}

// ── PARTAGE : MODALE DE CHOIX ET GÉNÉRATION ──

function _sportFermerModalGenerique(id) {
    const m = document.getElementById(id);
    if (m) m.remove();
}

async function _sportOuvrirModalPartage(event, sessionId) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    let workoutName = "Séance";
    let textStats = "";
    try {
        const r = await fetch(`/api/sport/dashboard-stats`, { headers: _sportAuthHeaders() });
        const data = await r.json();
        if (data.success) {
            const seance = [...(data.dernieres_seances || [])].find(s => s.id === sessionId);
            if (seance) {
                workoutName = seance.workout_name || "Séance";
                const duree = _sportFormatDureeLongue(seance.dureeSecondes || 0);
                const isGps = seance.isGps || seance.activity_type === 'marche' || seance.activity_type === 'course' || seance.activity_type === 'vélo';
                const bloc2 = isGps 
                    ? `Distance : ${seance.distanceKm ? seance.distanceKm.toFixed(2) : '0'} km`
                    : `Volume : ${seance.volumeKg || 0} kg`;
                textStats = `\n⏱️ ${duree} | 📊 ${bloc2}`;
            }
        }
    } catch (e) {
        console.error(e);
    }

    const modalHtml = `
        <div id="sport-modal-partage-choix" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px); animation: fadeIn 0.2s ease;">
            <div style="background:#fff;border-radius:20px;padding:24px;width:90%;max-width:400px;box-shadow:0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);position:relative;">
                <button onclick="_sportFermerModalGenerique('sport-modal-partage-choix')" style="position:absolute;top:16px;right:16px;background:rgba(243,244,246,0.8);border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#4b5563;transition:all 0.2s;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                
                <h3 style="margin:0 0 8px 0;font-size:18px;font-weight:700;color:#111827;">Partager la séance</h3>
                <p style="margin:0 0 24px 0;font-size:13px;color:#6b7280;">Comment souhaitez-vous partager <strong>${_sportEchapper(workoutName)}</strong> ?</p>
                
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <button onclick="_sportExecuterPartageInterne(${sessionId}, '${_sportEchapper(workoutName)}')" style="width:100%;padding:14px;background:#b49afa;color:#fff;border:none;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background 0.2s;">
                        🎉 Publier sur le fil social
                    </button>
                    
                    <button onclick="_sportExecuterPartageExterne(${sessionId}, '${_sportEchapper(workoutName)}', \`${_sportEchapper(textStats)}\`)" style="width:100%;padding:14px;background:#374151;color:#fff;border:none;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background 0.2s;">
                        🌐 Partager (WhatsApp, etc.)
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function _sportExecuterPartageInterne(sessionId, workoutName) {
    const btn = document.querySelector('#sport-modal-partage-choix button:nth-child(1)');
    if (btn) {
        btn.innerHTML = 'Génération... ⏳';
        btn.style.opacity = '0.7';
        btn.style.pointerEvents = 'none';
    }

    try {
        const r = await fetch(`/api/sport/sessions/${sessionId}/generate-share`, {
            method: 'POST',
            headers: _sportAuthHeaders()
        });
        const data = await r.json();

        if (data.success && data.imageUrl) {
            _sportFermerModalGenerique('sport-modal-partage-choix');
            
            // Tente d'appeler la fonction native de création de post
            // Ajustez ce nom si la vôtre s'appelle differemment (ex: openCreatePostModal, showPostModal...)
            if (typeof window.openCreatePostModal === 'function') {
                window.openCreatePostModal();
                setTimeout(() => {
                    const textZone = document.getElementById('postText');
                    if (textZone) textZone.value = `🏋️‍♂️ Séance terminée : ${workoutName} !`;
                    
                    const urlInput = document.getElementById('postImageUrl');
                    if (urlInput) {
                        urlInput.value = data.imageUrl;
                        const ev = new Event('input', { bubbles: true });
                        urlInput.dispatchEvent(ev);
                    }
                }, 300);
            } else {
                // Fallback sécurisé : si la fonction n'est pas trouvée, on copie l'URL de l'image
                await navigator.clipboard.writeText(`${window.location.origin}${data.imageUrl}`);
                alert('L\'image de votre séance a été générée ! Le lien a été copié dans votre presse-papier. Collez-le dans un nouveau post.');
            }
        } else {
            alert('Erreur lors de la génération : ' + (data.message || 'Inconnue'));
            if (btn) {
                btn.innerHTML = '🎉 Publier sur le fil social';
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        }
    } catch (e) {
        console.error(e);
        alert('Erreur réseau.');
        _sportFermerModalGenerique('sport-modal-partage-choix');
    }
}

async function _sportExecuterPartageExterne(sessionId, workoutName, textStats) {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/share/seance/${sessionId}`;
    
    const shareData = {
        title: `Séance MoaDja : ${workoutName}`,
        text: `🏋️‍♂️ Découvrez ma séance de sport "${workoutName}" sur MoaDja !${textStats}\n\n`,
        url: shareUrl
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
            alert('Lien et résumé copiés dans le presse-papier !');
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('Erreur partage', e);
        }
    }
    _sportFermerModalGenerique('sport-modal-partage-choix');
}

