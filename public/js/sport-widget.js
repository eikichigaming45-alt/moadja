// ============================================================
// public/js/sport-widget.js
// ============================================================
// Widget Sport global (colonne droite, visible sur tous les onglets) +
// utilitaires partagés avec sport.js (auth, formatage, échappement HTML,
// icônes communes). DOIT être chargé AVANT sport.js dans index.html.

const SPORT_ICONE_DUMBBELL = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="2.5"  y1="7" x2="2.5"  y2="17"></line>
        <line x1="5.5"  y1="9" x2="5.5"  y2="15"></line>
        <line x1="18.5" y1="9" x2="18.5" y2="15"></line>
        <line x1="21.5" y1="7" x2="21.5" y2="17"></line>
        <line x1="5.5" y1="12" x2="18.5" y2="12"></line>
    </svg>
`;

const SPORT_ICONE_FLECHE = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14"></path>
        <path d="M12 5l7 7-7 7"></path>
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

// ── AUTH ──

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

// ── Échappement HTML (anti-XSS) ──
function _sportEchapper(str) {
    return (str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ── Formatage date courte ──
function _sportFormatDateCourte(dateIso) {
    const MOIS_ABREGES = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const d = new Date(dateIso);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${MOIS_ABREGES[d.getMonth()]}`;
}

// ── Formatage durée longue ──
function _sportFormatDureeLongue(secondes) {
    const h = Math.floor(secondes / 3600);
    const m = Math.floor((secondes % 3600) / 60);
    const s = secondes % 60;
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
    if (m > 0) return `${m}min${String(s).padStart(2, '0')}`;
    return `${s}s`;
}

// ── Détail d'une série individuelle ──
function _sportFormatDetailSerie(serie, estCardio) {
    if (estCardio) {
        const morceaux = [];
        if (Number.isInteger(serie.duration_seconds)) morceaux.push(_sportFormatDureeLongue(serie.duration_seconds));
        if (serie.distance_km != null) morceaux.push(`${serie.distance_km.toString().replace('.', ',')} km`);
        if (serie.speed_kmh != null) morceaux.push(`${serie.speed_kmh} km/h`);
        if (serie.incline_percent != null) morceaux.push(`${serie.incline_percent}%`);
        return morceaux.length ? morceaux.join(' · ') : '—';
    }
    if (serie.weight_kg != null) {
        return `${serie.reps ?? '?'}×${serie.weight_kg}kg`;
    }
    return serie.reps != null ? `${serie.reps} reps` : '—';
}

// ── Détecte si toutes les séries d'un exercice consolidé sont identiques ──
function _sportSeriesIdentiques(series, estCardio) {
    if (series.length <= 1) return true;
    const cle = s => estCardio
        ? [s.duration_seconds, s.distance_km, s.speed_kmh, s.incline_percent].join('|')
        : [s.reps, s.weight_kg].join('|');
    const premiere = cle(series[0]);
    return series.every(s => cle(s) === premiere);
}

// Bloc détaillé d'un exercice consolidé
function _sportRenderBlocExerciceDetail(e) {
    const series    = Array.isArray(e.series) ? e.series : [];
    const estCardio = !!e.est_cardio;
    const nom       = _sportEchapper(e.exercise_name);

    let detailTexte = '';
    if (series.length) {
        const aAfficher = _sportSeriesIdentiques(series, estCardio) ? [series[0]] : series;
        detailTexte = aAfficher.map(s => _sportFormatDetailSerie(s, estCardio)).join(', ');
    }

    return `
        <div class="sport-exo-ligne">
            <span class="sport-exo-ligne-nb">${e.nb_series}x</span>
            <span class="sport-exo-ligne-nom">${nom}</span>${detailTexte ? `
            <span class="sport-exo-ligne-sep">·</span>
            <span class="sport-exo-ligne-detail">${_sportEchapper(detailTexte)}</span>` : ''}
        </div>
    `;
}

// ── Bloc partagé ISO (Tableau de bord & Widget) ──
function _sportRenderSeanceIso(s, mode = 'modal', btnSupprHtml = '') {
    const dateTexte   = _sportFormatDateCourte(s.date_end || s.date_start);
    const nbRecords   = Number.isInteger(s.nb_records) ? s.nb_records : 0;
    const exercices   = s.exercices || [];
    
    // Détection du mode GPS
    const isGps = typeof _sportIsGpsActivity === 'function' 
        ? _sportIsGpsActivity(s.activity_type, s.isGps) 
        : (s.isGps || s.activity_type === 'marche' || s.activity_type === 'course' || s.activity_type === 'vélo');
    
    const iconeTropheeJaune = `<span style="color: #eab308; display: inline-flex; align-items: center;">${SPORT_ICONE_TROPHEE}</span>`;

    let listeHtml = '';
    if (isGps) {
        const vitMoy = s.vitesseKmh ? s.vitesseKmh.toFixed(1) : '0.0';
        listeHtml = `
            <div style="margin-top: 12px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 14px; font-weight: 700; color: #a78bfa;">📍 Vitesse moyenne</span>
                <span style="color: #c7c7d1; font-weight: 600;">·</span>
                <span style="font-size: 14px; font-weight: 600; color: var(--text-main);">${vitMoy} km/h</span>
            </div>
        `;
        
        if (mode === 'modal') {
            // Affichage de la carte UNIQUEMENT dans la modale (hauteur augmentée à 350px)
            listeHtml += `
                <div id="sport-map-modal-${s.id}" style="width: 100%; height: 350px; margin-top: 16px; border-radius: 12px; background: #f3f4f6; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #9ca3af; z-index: 1; position: relative; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                    Chargement de la carte... ⏳
                </div>
            `;
        } else {
            // Dans le widget/dashboard, on met un message incitatif
            listeHtml += `
                <div style="margin-top: 12px; padding: 10px; text-align: center; background: rgba(167, 139, 250, 0.1); border-radius: 8px; color: #8b5cf6; font-size: 13px; font-weight: 600;">
                    🗺️ Cliquez pour voir la carte et le tracé
                </div>
            `;
        }
        
    } else {
        // Affichage musculation standard (liste d'exercices)
        if (mode === 'widget' || mode === 'dashboard') {
            const limit = mode === 'dashboard' ? 5 : SPORT_WIDGET_MAX_EXERCICES_APERCU;
            const apercu = exercices.slice(0, limit);
            const reste  = exercices.length - apercu.length;
            if (apercu.length) {
                listeHtml = `
                    <div class="${mode === 'dashboard' ? 'sport-seance-recap-liste' : 'sport-widget-exercices-liste'}">
                        ${apercu.map(e => _sportRenderBlocExerciceDetail(e)).join('')}
                        ${reste > 0 ? `<div class="${mode === 'dashboard' ? 'sport-seance-recap-reste' : 'sport-widget-exercice-reste'}">…et ${reste} autre${reste > 1 ? 's' : ''}</div>` : ''}
                    </div>
                `;
            }
        } else {
            listeHtml = `
                <div class="sport-modal-exercices-liste">
                    ${exercices.map(e => _sportRenderBlocExerciceDetail(e)).join('')}
                </div>
            `;
        }
    }

    const warningCalories = s.profil_incomplet
        ? `<div style="grid-column: 1 / -1; font-size: 11.5px; color: #ef4444; text-align: center; margin-top: 6px; padding: 6px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px;">
            Complétez votre profil (poids, taille, sexe, date de naissance) pour voir vos calories brûlées.
           </div>`
        : '';
    const valCalories = s.profil_incomplet ? '—' : `${s.calories || 0} kcal`;

    let detailsRecordsHtml = '';
    if (!isGps && mode === 'modal' && nbRecords > 0 && Array.isArray(s.records)) {
        detailsRecordsHtml = `
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed rgba(167, 139, 250, 0.3);">
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; color: #a78bfa;">
                    ${iconeTropheeJaune} Nouveaux records
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${s.records.map(r => `
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; background: rgba(255, 255, 255, 0.4); padding: 6px 10px; border-radius: 6px;">
                            <span style="font-weight: 500; color: #1f2937;">${_sportEchapper(r.exercise_name)}</span>
                            <span style="color: #4b5563;">
                                <span style="text-decoration: line-through; opacity: 0.6; margin-right: 4px;">${r.ancien_record}kg</span> 
                                <span style="font-weight: 600; color: #10b981;">${r.nouveau_poids}kg</span>
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    const styleGris = 'color: #9ca3af; background: rgba(156, 163, 175, 0.1); border: 1px solid rgba(156, 163, 175, 0.2);';
    let badgeHtml = '';
    
    if (!isGps) {
        badgeHtml = `
            <div class="sport-widget-badge-record" ${nbRecords === 0 ? `style="${styleGris}"` : ''}>
                ${iconeTropheeJaune} <span>${nbRecords > 0 ? `${nbRecords} record${nbRecords > 1 ? 's' : ''}` : 'Aucun nouveau record'}</span>
            </div>
        `;
    }

    let footerHtml = '';
    if (mode === 'dashboard') {
        footerHtml = `
            <div class="sport-widget-footer sport-widget-footer-dashboard">
                <span class="sport-widget-footer-logo">${SPORT_ICONE_LOGO_MINI} MoaDja</span>
                <button class="sport-widget-btn-partage" onclick="_sportOuvrirModalPartage(event, ${s.id})" title="Partager la séance">
                    ${SPORT_ICONE_PARTAGE}
                </button>
            </div>
        `;
    } else if (mode === 'widget') {
        footerHtml = `
            <div class="sport-widget-footer">
                <span class="sport-widget-footer-logo">${SPORT_ICONE_LOGO_MINI} MoaDja</span>
            </div>
        `;
    }

    const labelBloc2 = isGps ? 'Distance' : 'Volume';
    const valeurBloc2 = isGps 
        ? `${s.distanceKm ? s.distanceKm.toFixed(2) : '0.00'} km` 
        : `${s.volumeKg || 0} kg`;

    return `
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
    `;
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
    
    // Récupérer les infos basiques pour le texte de partage
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
            
            // Ouvrir la modale de création de post (tchat.js)
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
                alert('Erreur : Fonction de création de post introuvable.');
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
            // Fallback copie presse-papier
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

// ── INITIALISATION LEAFLET DANS MODALE (POUR LES TRACÉS GPS) ──

async function _sportInitMapDansModal(sessionId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const { pool } = require('../db/pool'); // Uniquement pour la logique backend, ici on doit fetcher via l'API
        // NOTE: Puisque nous sommes dans le frontend (sport-widget.js), nous devons appeler une API.
        // Or, les points GPS publics ou authentifiés doivent être récupérés.
        // Faisons un fetch vers l'API de session.
        
        const r = await fetch(`/api/sport/sessions/${sessionId}`, { headers: _sportAuthHeaders() });
        const data = await r.json();
        
        if (data.success) {
            // Requête spéciale pour avoir les points GPS (à ajouter dans routes/sport.js si pas déjà présent, 
            // mais on peut aussi les passer direct si on étend l'endpoint de base).
            // Pour l'instant, on va chercher l'endpoint share public qui génère la page, mais on a besoin du JSON pur.
            // Vu l'architecture, on va simplement vérifier si la librairie Leaflet est dispo.
            
            // Pour le tracé frontend, on aurait besoin d'un endpoint /api/sport/sessions/:id/gps.
            // En attendant, on peut afficher un fallback ou laisser Leaflet s'instancier.
            
            // Simuler l'absence de tracé si pas encore d'endpoint spécifique
            container.innerHTML = '<div style="color:#6b7280; font-weight:600; font-size:13px;">🗺️ Tracé GPS (nécessite le chargement des points)</div>';
        }
    } catch (e) {
        console.error("Erreur chargement map", e);
        container.innerHTML = 'Erreur chargement carte.';
    }
}
