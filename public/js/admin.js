/* ============================================================
   public/css/admin.css
   Styles dédiés au widget et à la modale Administration.
   ============================================================ */

/* ===================== WIDGET ============================= */
.wa-stats-row { display: flex; gap: 6px; margin-bottom: 12px; }
.wa-stat {
    flex: 1; border-radius: 12px; padding: 10px 6px;
    text-align: center; display: flex; flex-direction: column; gap: 2px;
    background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.5);
}
.wa-stat-blue   { background: rgba(219, 234, 254, 0.7); }
.wa-stat-purple { background: rgba(237, 233, 254, 0.7); }
.wa-stat-green  { background: rgba(209, 250, 229, 0.7); }
.wa-stat-orange { background: rgba(254, 243, 199, 0.7); }
.wa-stat-val { font-size: 20px; font-weight: 800; color: #1f2937; }
.wa-stat-lbl { font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase; }

.wa-activity-title {
    font-size: 11px; font-weight: 700; color: #9ca3af;
    text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px;
}
.wa-activity-row {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.4);
}
.wa-activity-row:last-child { border-bottom: none; }

.wa-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    font-size: 13px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.wa-avatar-admin { background: #ede9fe; color: #7c3aed; }
.wa-avatar-user  { background: #dbeafe; color: #2563eb; }

.wa-username {
    flex: 1; font-size: 12px; font-weight: 700; color: #1f2937;
    min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wa-badge { font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 8px; flex-shrink: 0; }
.badge-admin { background: rgba(237,233,254,0.8); color: #7c3aed; }
.badge-user  { background: rgba(219,234,254,0.8); color: #2563eb; }
.wa-date  { font-size: 11px; color: #6b7280; flex-shrink: 0; }
.wa-error { color: #ef4444; font-size: 13px; text-align: center; margin-top: 10px; }

/* ===================== MODALE — ONGLETS =================== */
.admin-tabs { 
    display: flex; gap: 8px; margin-bottom: 20px; border-bottom: none; 
    background: rgba(255, 255, 255, 0.4); padding: 6px; 
    border-radius: 50px; border: 1px solid rgba(255, 255, 255, 0.6);
}
.admin-tab {
    flex: 1; padding: 10px 16px; border: none; background: transparent;
    font-size: 13px; font-weight: 700; color: #6b7280;
    cursor: pointer; border-radius: 50px; transition: all 0.3s ease; margin-bottom: 0;
}
.admin-tab.active { 
    background: #fff; color: #7c3aed; 
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
.admin-tab-content { display: none; }
.admin-tab-content.active { display: block; animation: fadeInAdmin 0.3s ease-in-out; }
@keyframes fadeInAdmin { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

/* ===================== MODALE — STATS ===================== */
.as-section-title {
    font-size: 11px; font-weight: 800; color: #9ca3af;
    text-transform: uppercase; letter-spacing: .5px; margin-bottom: 12px;
}

/* Cartes chiffres */
.as-cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
.as-card {
    border-radius: 16px; padding: 16px;
    display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;
    background: rgba(255, 255, 255, 0.6) !important;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 4px 12px rgba(0,0,0,0.02);
}
.as-card-blue   { background: rgba(219, 234, 254, 0.6) !important; }
.as-card-purple { background: rgba(237, 233, 254, 0.6) !important; }
.as-card-green  { background: rgba(209, 250, 229, 0.6) !important; }
.as-card-red    { background: rgba(254, 226, 226, 0.6) !important; }
.as-card-icon { font-size: 24px; }
.as-card-val  { font-size: 24px; font-weight: 800; color: #1f2937; }
.as-card-lbl  { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; }

/* Barre profils remplis */
.as-progress-bloc { margin-bottom: 20px; background: rgba(255, 255, 255, 0.6); padding: 16px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.8); }
.as-progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.as-progress-label { font-size: 13px; font-weight: 700; color: #374151; }
.as-progress-pct   { font-size: 12px; color: #6b7280; font-weight: 600; }
.as-progress-bar   { height: 10px; background: rgba(229, 231, 235, 0.5); border-radius: 50px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05); }
.as-progress-fill  { height: 100%; border-radius: 50px; transition: width 0.6s ease; }
.as-fill-blue { background: linear-gradient(90deg, #8b5cf6, #c084fc); }

/* Top contributeurs */
.as-contrib-list { display: flex; flex-direction: column; gap: 10px; }
.as-contrib-row {
    display: flex; align-items: center; gap: 12px; padding: 12px 14px;
    background: rgba(255, 255, 255, 0.6) !important;
    border: 1px solid rgba(255, 255, 255, 0.8) !important;
    border-radius: 16px !important;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.02);
}
.as-contrib-medal  { font-size: 20px; width: 28px; text-align: center; flex-shrink: 0; }
.as-contrib-info   { flex: 1; min-width: 0; }
.as-contrib-name   {
    font-size: 14px; font-weight: 700; color: #1e1b4b;
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.as-contrib-detail { font-size: 12px; color: #6b7280; margin-top: 4px; font-weight: 500; }
.as-contrib-score  { font-size: 14px; font-weight: 800; color: #7c3aed; white-space: nowrap; flex-shrink: 0; background: rgba(124, 58, 237, 0.1); padding: 4px 10px; border-radius: 20px; }

/* Widgets populaires */
.as-widgets-list { display: flex; flex-direction: column; gap: 10px; background: rgba(255,255,255,0.6); padding: 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.8); }
.as-widget-row   { display: flex; align-items: center; gap: 12px; }
.as-widget-label {
    font-size: 13px; color: #374151; font-weight: 600;
    width: 140px; flex-shrink: 0;
}
.as-widget-bar-wrap { flex: 1; background: rgba(229, 231, 235, 0.5); border-radius: 50px; height: 10px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05); }
.as-widget-bar-fill { height: 100%; border-radius: 50px; transition: width .4s ease; }
.as-widget-count    { font-size: 12px; font-weight: 800; color: #6b7280; width: 40px; text-align: right; flex-shrink: 0; }

/* Dernière activité */
.as-logins-list { display: flex; flex-direction: column; gap: 10px; }
.as-login-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.6) !important;
    border: 1px solid rgba(255, 255, 255, 0.8) !important;
    border-radius: 16px !important;
    backdrop-filter: blur(8px);
}
.as-login-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    font-size: 15px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    box-shadow: 0 4px 10px rgba(0,0,0,0.05);
}
.as-av-admin { background: rgba(237, 233, 254, 0.8) !important; color: #7c3aed !important; }
.as-av-user  { background: rgba(219, 234, 254, 0.8) !important; color: #2563eb !important; }
.as-login-info     { flex: 1; min-width: 0; }
.as-login-name     { font-size: 14px; font-weight: 700; color: #1f2937; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.as-login-date     { font-size: 12px; color: #6b7280; margin-top: 4px; font-weight: 500; }
.as-login-relative { font-size: 12px; flex-shrink: 0; font-weight: 600; }
.as-badge       { font-size: 9px; font-weight: 700; padding: 4px 8px; border-radius: 12px; }
.as-badge-admin { background: rgba(237, 233, 254, 0.8) !important; color: #7c3aed !important; }
.as-badge-user  { background: rgba(219, 234, 254, 0.8) !important; color: #2563eb !important; }

/* ===================== MODALE — USERS (SURCHARGES GLASSMORPHISM) ===================== */
/* Ces règles utilisent !important pour écraser les styles bruts intégrés dans admin.js */

/* Barre de recherche */
#admin-search {
    background: rgba(255, 255, 255, 0.6) !important;
    backdrop-filter: blur(12px) !important;
    border: 1px solid rgba(255, 255, 255, 0.8) !important;
    border-radius: 50px !important;
    padding: 12px 18px !important;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02), 0 2px 10px rgba(0,0,0,0.02) !important;
    transition: all 0.3s ease !important;
    color: #1f2937 !important;
}
#admin-search:focus { 
    background: rgba(255, 255, 255, 0.9) !important; 
    box-shadow: 0 4px 12px rgba(124,58,237,0.1) !important; 
    border-color: rgba(124,58,237,0.3) !important; 
}

/* Bouton Créer un utilisateur */
#btn-creer-user {
    background: rgba(124, 58, 237, 0.85) !important;
    backdrop-filter: blur(8px) !important;
    border: 1px solid rgba(255, 255, 255, 0.3) !important;
    border-radius: 50px !important;
    padding: 12px !important;
    box-shadow: 0 8px 24px rgba(124, 58, 237, 0.25) !important;
    transition: all 0.3s ease !important;
}
#btn-creer-user:hover { 
    transform: translateY(-2px) !important; 
    box-shadow: 0 10px 28px rgba(124, 58, 237, 0.35) !important; 
    background: rgba(109, 40, 217, 0.9) !important;
}

/* Formulaire de création */
#admin-creer-form {
    background: rgba(255, 255, 255, 0.5) !important;
    backdrop-filter: blur(16px) !important;
    border: 1px solid rgba(255, 255, 255, 0.8) !important;
    border-radius: 24px !important;
    padding: 20px !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.05) !important;
}
#admin-creer-form input, #admin-creer-form select {
    background: rgba(255, 255, 255, 0.7) !important;
    border: 1.5px solid rgba(229, 231, 235, 0.6) !important;
    border-radius: 12px !important;
    padding: 12px 14px !important;
    color: #1f2937 !important;
    transition: all 0.2s ease !important;
}
#admin-creer-form input:focus, #admin-creer-form select:focus {
    background: #fff !important;
    border-color: #a78bfa !important;
}
#admin-creer-form .ua-btn {
    border-radius: 50px !important;
    padding: 12px !important;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25) !important;
}

/* Liste des utilisateurs (Lignes générées par JS) */
#admin-users-liste { display: flex !important; flex-direction: column !important; gap: 10px !important; margin-top: 16px !important; }
#admin-users-liste > div {
    background: rgba(255, 255, 255, 0.55) !important;
    backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(255, 255, 255, 0.9) !important;
    border-radius: 18px !important;
    padding: 14px 16px !important;
    margin-bottom: 0 !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.03) !important;
    transition: all 0.3s ease !important;
}
#admin-users-liste > div:hover { 
    background: rgba(255, 255, 255, 0.85) !important; 
    transform: translateY(-2px) !important; 
    box-shadow: 0 8px 24px rgba(0,0,0,0.06) !important; 
}

/* Boutons d'action rapides (Rôle, Clé, Éditer, Supprimer) */
.au-btn {
    width: 36px !important; height: 36px !important; 
    border-radius: 12px !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04) !important;
    transition: all 0.2s ease !important;
    backdrop-filter: blur(4px) !important;
}
.au-btn:hover { transform: translateY(-1px) !important; }
.au-btn-role       { background: rgba(237, 233, 254, 0.7) !important; color: #7c3aed !important; }
.au-btn-role:hover { background: rgba(221, 214, 254, 1) !important; }
.au-btn-key        { background: rgba(254, 243, 199, 0.7) !important; color: #d97706 !important; }
.au-btn-key:hover  { background: rgba(253, 230, 138, 1) !important; }
.au-btn-edit       { background: rgba(219, 234, 254, 0.7) !important; color: #2563eb !important; }
.au-btn-edit:hover { background: rgba(191, 219, 254, 1) !important; }
.au-btn-del        { background: rgba(254, 226, 226, 0.7) !important; color: #ef4444 !important; }
.au-btn-del:hover  { background: rgba(254, 202, 202, 1) !important; }

/* Modales internes d'édition et suppression (générées par JS) */
.user-card { 
    background: rgba(255, 255, 255, 0.65) !important; 
    backdrop-filter: blur(20px) !important; 
    border: 1px solid rgba(255, 255, 255, 0.9) !important; 
    border-radius: 24px !important; 
    padding: 24px !important; 
    box-shadow: 0 12px 40px rgba(0,0,0,0.08) !important; 
}

/* Modale de suppression spécifique (fond rouge) */
.user-card[style*="border-color:#fee2e2"] {
    background: rgba(254, 242, 242, 0.7) !important;
    border: 1px solid rgba(254, 226, 226, 0.9) !important;
    box-shadow: 0 12px 40px rgba(239, 68, 68, 0.1) !important;
}

/* Champs dans l'édition de profil */
.user-card input, .user-card textarea {
    background: rgba(255, 255, 255, 0.75) !important;
    border: 1.5px solid rgba(229, 231, 235, 0.6) !important;
    border-radius: 12px !important;
    padding: 12px 14px !important;
    color: #1f2937 !important;
    transition: all 0.2s ease !important;
}
.user-card input:focus, .user-card textarea:focus {
    background: #fff !important;
    border-color: #a78bfa !important;
}
.user-card label {
    font-size: 11px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
    font-weight: 700 !important;
    color: #6b7280 !important;
}
.user-card .section-title {
    font-size: 12px !important;
    font-weight: 800 !important;
    color: #9ca3af !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
    margin-bottom: 12px !important;
    margin-top: 16px !important;
}

/* Boutons principaux dans les cartes (Sauvegarder, Annuler, Confirmer) */
.ua-btn { 
    border-radius: 50px !important; 
    font-weight: 700 !important; 
    padding: 14px 20px !important; 
    border: none !important; 
    transition: all 0.3s ease !important;
}
.ua-btn-blue { 
    background: rgba(124, 58, 237, 0.85) !important; 
    box-shadow: 0 6px 20px rgba(124, 58, 237, 0.25) !important; 
}
.ua-btn-blue:hover { background: rgba(109, 40, 217, 1) !important; transform: translateY(-2px) !important; }

.ua-btn-red { 
    background: rgba(239, 68, 68, 0.9) !important; 
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.25) !important; 
}
.ua-btn-red:hover { background: rgba(220, 38, 38, 1) !important; transform: translateY(-2px) !important; }

/* Bouton Annuler (ciblé via son onclick dans le JS) */
.user-card button[onclick="chargerAdminUsers()"],
.user-card button[style*="background:#f3f4f6"] {
    background: rgba(255, 255, 255, 0.6) !important;
    border: 1px solid rgba(0,0,0,0.05) !important;
    color: #4b5563 !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.02) !important;
}
.user-card button[onclick="chargerAdminUsers()"]:hover {
    background: #fff !important;
    border-color: rgba(0,0,0,0.1) !important;
}

/* ===================== SCROLLBARS PERSONNALISÉES ===================== */
/* Pour s'intégrer parfaitement au style Glassmorphism */
#admin-users-liste, .admin-tab-content, .as-logins-list, .as-contrib-list, .as-widgets-list {
    max-height: 60vh;
    overflow-y: auto;
    padding-right: 4px;
}

#admin-users-liste::-webkit-scrollbar,
.admin-tab-content::-webkit-scrollbar,
.as-logins-list::-webkit-scrollbar,
.as-contrib-list::-webkit-scrollbar,
.as-widgets-list::-webkit-scrollbar {
    width: 6px;
}

#admin-users-liste::-webkit-scrollbar-track,
.admin-tab-content::-webkit-scrollbar-track,
.as-logins-list::-webkit-scrollbar-track,
.as-contrib-list::-webkit-scrollbar-track,
.as-widgets-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
}

#admin-users-liste::-webkit-scrollbar-thumb,
.admin-tab-content::-webkit-scrollbar-thumb,
.as-logins-list::-webkit-scrollbar-thumb,
.as-contrib-list::-webkit-scrollbar-thumb,
.as-widgets-list::-webkit-scrollbar-thumb {
    background: rgba(167, 139, 250, 0.4);
    border-radius: 10px;
}

#admin-users-liste::-webkit-scrollbar-thumb:hover,
.admin-tab-content::-webkit-scrollbar-thumb:hover,
.as-logins-list::-webkit-scrollbar-thumb:hover,
.as-contrib-list::-webkit-scrollbar-thumb:hover,
.as-widgets-list::-webkit-scrollbar-thumb:hover {
    background: rgba(139, 92, 246, 0.6);
}

/* ===================== CONTENEUR GLOBAL MODALE ADMIN ===================== */
/* Assure que le fond de la modale d'administration elle-même (si elle a une classe spécifique) 
   soit bien flouté et s'accorde avec le Glassmorphism V3 */
.modal-admin-container {
    background: rgba(255, 255, 255, 0.45) !important;
    backdrop-filter: blur(24px) !important;
    -webkit-backdrop-filter: blur(24px) !important;
    border: 1px solid rgba(255, 255, 255, 0.6) !important;
    box-shadow: 0 24px 48px rgba(31, 41, 55, 0.1) !important;
    border-radius: 24px !important;
}

/* ===================== RESPONSIVITÉ (MOBILE) ===================== */
@media (max-width: 600px) {
    .as-cards-grid { 
        grid-template-columns: 1fr; 
    }
    
    .wa-stats-row { 
        flex-wrap: wrap; 
    }
    
    .wa-stat { 
        min-width: 45%; 
    }
    
    .as-widget-label { 
        width: 100px; 
        font-size: 11px; 
    }
    
    /* Adaptation de la liste des utilisateurs sur petit écran */
    #admin-users-liste > div {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 12px !important;
    }
    
    #admin-users-liste > div > div:last-child {
        width: 100% !important;
        justify-content: space-between !important;
        background: rgba(255, 255, 255, 0.4) !important;
        padding: 8px !important;
        border-radius: 16px !important;
    }

    .as-contrib-row, .as-login-row {
        gap: 8px;
        padding: 10px;
    }
    
    .as-contrib-medal { 
        display: none; 
    }
    
    .user-card {
        padding: 16px !important;
    }
}

