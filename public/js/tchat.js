// ============================================================
// public/js/tchat.js
// ============================================================

(function () {
    'use strict';

    const LIMITE_PAR_PAGE = 40;

    const EMOJIS_SELECTEUR = [
        '😊','😂','😍','😘','😎','🤔','😢','😭','😠','😡',
        '🥰','😋','😜','😝','🤗','😴','🤩','🥳','😏','😒',
        '👍','👎','👏','🙌','🙏','💪','🤝','✌️','🤞','👋',
        '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕',
        '🔥','⭐','✨','🎉','🎂','🎁','🌹','🌸','🌙','☀️',
        '😈','😇','🤣','😅','😆','😁','😄','😃','😀','🙂',
        '💯','✅','❌','⚡','🌊','🍀','🦋','🐝','🌈','🎵','😮'
    ];

    function _convertirEmojis(texte) {
        const MAP = [
            ['>:-)',  '😈'], ['>:)',   '😈'],
            [":'(",   '😭'],
            [':-)',   '😊'], [':)',    '😊'],
            [':-(', '😢'],   [':(',   '😢'],
            [';-)',   '😉'], [';)',    '😉'],
            [':-D',  '😄'],  [':D',   '😄'],
            [':-P',  '😛'],  [':P',   '😛'],
            [':-p',  '😛'],  [':p',   '😛'],
            [':-O',  '😮'],  [':O',   '😮'],
            [':-o',  '😮'],  [':o',   '😮'],
            ['<3',   '❤️'],  ['^^',   '😊'],
            [':joy:',    '😂'], [':ok:',     '👍'],
            [':fire:',   '🔥'], [':heart:',  '❤️'],
            [':smile:',  '😊'], [':laugh:',  '😂'],
            [':wink:',   '😉'], [':cry:',    '😢'],
            [':sad:',    '😢'], [':angry:',  '😠'],
            [':love:',   '😍'], [':kiss:',   '😘'],
            [':cool:',   '😎'], [':think:',  '🤔'],
            [':wow:',    '😮'], [':clap:',   '👏'],
            [':star:',   '⭐'], [':sun:',    '☀️'],
            [':moon:',   '🌙'], [':wave:',   '👋'],
            [':pray:',   '🙏'], [':muscle:', '💪'],
            [':check:',  '✅'], [':x:',      '❌'],
            [':tada:',   '🎉'], [':cake:',   '🎂'],
            [':gift:',   '🎁'], [':rose:',   '🌹'],
            [':100:',    '💯'],
        ];
        let t = texte;
        for (const [s, e] of MAP) t = t.split(s).join(e);
        return t;
    }

    function _renderLiens(html) {
        return html
            .replace(
                /(https?:\/\/[^\s<>"']+)/g,
                '<a href="\$1" target="_blank" rel="noopener noreferrer" class="tchat-lien">\$1</a>'
            )
            .replace(
                /(?<![/"'=])\b(www\.[^\s<>"']+\.[^\s<>"']+)/g,
                '<a href="https://\$1" target="_blank" rel="noopener noreferrer" class="tchat-lien">\$1</a>'
            );
    }

    let _socket             = null;
    let _interlocuteurActif = null;
    let _plusAncienMsgId    = null;
    let _chargementEnCours  = false;
    let _ouvert             = false;
    let _vueActive          = 'liste';
    let _replyTo            = null;
    let _emojiOuvert        = false;
    let _usersEnLigne       = new Set();
    let _historyDepth       = 0;

    function _token() {
        try { return JSON.parse(localStorage.getItem('moadja_user'))?.token || ''; }
        catch { return ''; }
    }

    function _userId() {
        try { return JSON.parse(localStorage.getItem('moadja_user'))?.userId || null; }
        catch { return null; }
    }

    function _authHeaders() {
        return {
            'Content-Type' : 'application/json',
            'Authorization': `Bearer ${_token()}`
        };
    }

    function _roomName(u1, u2) {
        return `conv_${Math.min(u1, u2)}_${Math.max(u1, u2)}`;
    }

    function _trigramme(prenom, nom) {
        if (typeof construireTrigramme === 'function') {
            return construireTrigramme(prenom, nom) || '?';
        }
        const mots = [...(prenom || '').split(/\s+/), ...(nom || '').split(/\s+/)]
            .map(m => m.trim()).filter(Boolean);
        return mots.slice(0, 3).map(m => m[0].toUpperCase()).join('') || '?';
    }

    function _formatHeure(dateStr) {
        return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    function _formatDateSep(dateStr) {
        const d    = new Date(dateStr);
        const auj  = new Date();
        const hier = new Date(auj); hier.setDate(hier.getDate() - 1);
        if (d.toDateString() === auj.toDateString())  return "Aujourd'hui";
        if (d.toDateString() === hier.toDateString()) return 'Hier';
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    }

    // ── Point de présence ─────────────────────────────────────
    function _pointPresenceHTML(userId) {
        const enligne = _usersEnLigne.has(Number(userId));
        return `<span class="tchat-presence-dot ${enligne ? 'enligne' : 'hors-ligne'}"
                      data-presence-id="${userId}"></span>`;
    }

    function _mettreAJourPointsPresence(userId, enligne) {
        document.querySelectorAll(`[data-presence-id="${userId}"]`).forEach(dot => {
            dot.className = `tchat-presence-dot ${enligne ? 'enligne' : 'hors-ligne'}`;
        });
    }

    function _avatarHTML(photo, prenom, nom, taille = 42, userId = null) {
        const point = userId !== null ? _pointPresenceHTML(userId) : '';
        if (photo) {
            return `<img src="${photo}" alt="${_echapper(prenom || nom || '')}"
                style="width:${taille}px;height:${taille}px;border-radius:50%;object-fit:cover;position:absolute;top:2px;left:2px;">${point}`;
        }
        const trig = _trigramme(prenom, nom);
        return `<div class="tchat-avatar-initiale"
            style="width:${taille - 4}px;height:${taille - 4}px;font-size:${Math.round(taille * .28)}px;">
            ${trig}</div>${point}`;
    }

    function _echapper(str) {
        return (str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function _construireDom() {
        if (document.getElementById('tchat-bulle')) return;

        const bulle = document.createElement('button');
        bulle.id    = 'tchat-bulle';
        bulle.title = 'Tchat';
        bulle.setAttribute('aria-label', 'Ouvrir le tchat');
        bulle.innerHTML = `
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/>
            </svg>
            <span id="tchat-bulle-badge"></span>`;
        bulle.addEventListener('click', () => _ouvrirTchat());

        const overlay = document.createElement('div');
        overlay.id = 'tchat-overlay';
        overlay.addEventListener('click', () => _fermerTchat());

        const sheet = document.createElement('div');
        sheet.id = 'tchat-sheet';
        sheet.innerHTML = `
            <div id="tchat-sheet-handle"></div>
            <div id="tchat-header">
                <span id="tchat-header-titre">Tchat</span>
                <div id="tchat-header-actions">
                    <button id="tchat-btn-fermer" aria-label="Fermer">✕</button>
                </div>
            </div>
            <div id="tchat-vue-liste">
                <div id="tchat-liste-scroll"></div>
                <button id="tchat-btn-nouvelle-conv">+ Nouvelle conversation</button>
            </div>
            <div id="tchat-vue-conv">
                <div id="tchat-conv-header">
                    <button id="tchat-conv-back" aria-label="Retour">‹</button>
                    <div id="tchat-conv-avatar-wrap">
                        <span id="tchat-conv-avatar-img"></span>
                    </div>
                    <div id="tchat-conv-nom-dest">
                        <strong id="tchat-conv-nom-label"></strong>
                        <span id="tchat-conv-statut"></span>
                    </div>
                </div>
                <div id="tchat-messages-scroll">
                    <button id="tchat-btn-plus-anciens" style="display:none">
                        Charger les messages précédents
                    </button>
                </div>
                <div id="tchat-reply-preview" style="display:none">
                    <div id="tchat-reply-texte"></div>
                    <button id="tchat-reply-annuler" aria-label="Annuler réponse">✕</button>
                </div>
                <div id="tchat-emoji-panel" style="display:none"></div>
                <div id="tchat-saisie-wrap">
                    <button id="tchat-btn-emoji" type="button" aria-label="Emojis" title="Emojis">😊</button>
                    <button id="tchat-btn-image" type="button" aria-label="Envoyer une image" title="Envoyer une image">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                             stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
                            <rect x="3" y="3" width="18" height="18" rx="3"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                    </button>
                    <input type="file" id="tchat-input-image" accept="image/*" style="display:none">
                    <textarea id="tchat-input"
                              placeholder="Écrire un message…"
                              rows="1"
                              maxlength="2000"></textarea>
                    <button id="tchat-btn-envoyer" disabled aria-label="Envoyer">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                        </svg>
                    </button>
                </div>
            </div>`;

        document.body.appendChild(bulle);
        document.body.appendChild(overlay);
        document.body.appendChild(sheet);

        document.getElementById('tchat-btn-fermer').addEventListener('click', () => {
            if (_historyDepth > 0) {
                history.go(-_historyDepth);
            } else {
                _fermerTchat(true);
            }
        });
        
        document.getElementById('tchat-conv-back').addEventListener('click', () => {
            history.back();
        });

        document.getElementById('tchat-btn-nouvelle-conv').addEventListener('click', _ouvrirSelectUser);
        document.getElementById('tchat-btn-plus-anciens').addEventListener('click', _chargerPlusAnciens);
        document.getElementById('tchat-reply-annuler').addEventListener('click', _annulerReply);

        document.getElementById('tchat-btn-emoji').addEventListener('click', (e) => {
            e.stopPropagation();
            _toggleEmojiPanel();
        });

        document.addEventListener('click', (e) => {
            if (_emojiOuvert &&
                !e.target.closest('#tchat-emoji-panel') &&
                !e.target.closest('#tchat-btn-emoji')) {
                _fermerEmojiPanel();
            }
        });

        document.getElementById('tchat-btn-image').addEventListener('click', () => {
            document.getElementById('tchat-input-image').click();
        });

        document.getElementById('tchat-input-image').addEventListener('change', async (e) => {
            const file = e.target.files[0];
        if (!file || !_interlocuteurActif) return;
        e.target.value = '';
        await _envoyerImage(file);
    });

    const input  = document.getElementById('tchat-input');
    const btnEnv = document.getElementById('tchat-btn-envoyer');

    input.addEventListener('input', () => {
        btnEnv.disabled = !input.value.trim();
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!btnEnv.disabled) _envoyerMessage();
        }
    });

    btnEnv.addEventListener('click', _envoyerMessage);
}

function _toggleEmojiPanel() {
    _emojiOuvert ? _fermerEmojiPanel() : _ouvrirEmojiPanel();
}

function _ouvrirEmojiPanel() {
    const panel = document.getElementById('tchat-emoji-panel');
    if (!panel) return;
    panel.innerHTML = EMOJIS_SELECTEUR.map(e =>
        `<button class="tchat-emoji-item" type="button">${e}</button>`
    ).join('');
    panel.querySelectorAll('.tchat-emoji-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const input = document.getElementById('tchat-input');
            const pos   = input.selectionStart || input.value.length;
            input.value = input.value.slice(0, pos) + btn.textContent + input.value.slice(pos);
            input.dispatchEvent(new Event('input'));
            input.focus();
            const newPos = pos + btn.textContent.length;
            input.setSelectionRange(newPos, newPos);
        });
    });
    panel.style.display = 'grid';
    _emojiOuvert = true;
}

function _fermerEmojiPanel() {
    const panel = document.getElementById('tchat-emoji-panel');
    if (panel) panel.style.display = 'none';
    _emojiOuvert = false;
}

function _activerReply(msg) {
    _replyTo = msg;
    const preview = document.getElementById('tchat-reply-preview');
    const texte   = document.getElementById('tchat-reply-texte');
    const nom     = msg.sender_prenom || msg.sender_username || 'Message';
    texte.innerHTML = `<strong>${_echapper(nom)}</strong> ${_echapper((msg.content || '').substring(0, 80))}`;
    preview.style.display = 'flex';
    document.getElementById('tchat-input').focus();
}

function _annulerReply() {
    _replyTo = null;
    document.getElementById('tchat-reply-preview').style.display = 'none';
    document.getElementById('tchat-reply-texte').innerHTML = '';
}

function _confirmerSuppressionConversation(interlocuteurId, itemEl) {
    if (itemEl.querySelector('.tchat-confirm-conv')) return;

    const confirm = document.createElement('div');
    confirm.className = 'tchat-confirm-conv';
    confirm.innerHTML = `
        <span class="tchat-confirm-conv-texte">Supprimer cette conversation ?</span>
        <div class="tchat-confirm-conv-actions">
            <button class="btn-delete tchat-conv-suppr-oui">Supprimer</button>
            <button class="btn-cancel tchat-conv-suppr-non">Annuler</button>
        </div>`;

    itemEl.appendChild(confirm);

    confirm.querySelector('.tchat-conv-suppr-non').addEventListener('click', (e) => {
        e.stopPropagation();
        confirm.remove();
    });

    confirm.querySelector('.tchat-conv-suppr-oui').addEventListener('click', async (e) => {
        e.stopPropagation();
        confirm.remove();
        await _supprimerConversation(interlocuteurId);
    });
}

function _editerMessage(wrap, msg) {
    const bulle = wrap.querySelector('.tchat-msg-bulle');
    if (!bulle) return;

    const contenuOriginal = msg.content;
    const input = document.createElement('textarea');
    input.className = 'tchat-edit-input';
    input.value     = contenuOriginal;
    input.rows      = 2;

    const actions = document.createElement('div');
    actions.className = 'tchat-edit-actions';
    actions.innerHTML = `
        <button class="btn-cancel tchat-edit-annuler">Annuler</button>
        <button class="btn-send tchat-edit-valider">Sauvegarder</button>`;

    bulle.replaceWith(input);
    wrap.appendChild(actions);

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    actions.querySelector('.tchat-edit-annuler').addEventListener('click', () => {
        input.replaceWith(bulle);
        actions.remove();
    });

    actions.querySelector('.tchat-edit-valider').addEventListener('click', async () => {
        const nouveau = input.value.trim();
        if (!nouveau || nouveau === contenuOriginal) {
            input.replaceWith(bulle);
            actions.remove();
            return;
        }
        try {
            const r = await fetch(`/api/tchat/messages/${msg.id}`, {
                method : 'PATCH',
                headers: _authHeaders(),
                body   : JSON.stringify({ content: nouveau })
            });
            const d = await r.json();
            if (d.success) {
                msg.content   = nouveau;
                msg.edited_at = d.message.edited_at;
                bulle.innerHTML = _renderLiens(_convertirEmojis(_echapper(nouveau)));
                input.replaceWith(bulle);
                actions.remove();
                let modifTag = wrap.querySelector('.tchat-msg-modifie');
                if (!modifTag) {
                    modifTag             = document.createElement('span');
                    modifTag.className   = 'tchat-msg-modifie';
                    modifTag.textContent = 'modifié';
                    wrap.querySelector('.tchat-msg-meta')?.prepend(modifTag);
                }
            } else {
                input.replaceWith(bulle);
                actions.remove();
            }
        } catch {
            input.replaceWith(bulle);
            actions.remove();
        }
    });
}

function _supprimerMessageConfirm(wrap, msgId) {
    document.querySelectorAll('.tchat-confirm-suppr').forEach(el => el.remove());

    const sheet = document.getElementById('tchat-sheet');
    if (!sheet) return;

    const confirm = document.createElement('div');
    confirm.className = 'tchat-confirm-suppr';
    confirm.innerHTML = `
        <span class="tchat-confirm-suppr-texte">Supprimer ce message ?</span>
        <div class="tchat-confirm-suppr-actions">
            <button class="btn-delete tchat-suppr-oui">Supprimer</button>
            <button class="btn-cancel tchat-suppr-non">Annuler</button>
        </div>`;

    sheet.appendChild(confirm);

    const wrapRect  = wrap.getBoundingClientRect();
    const sheetRect = sheet.getBoundingClientRect();
    const topCalc   = wrapRect.top - sheetRect.top + wrapRect.height / 2 - confirm.offsetHeight / 2;
    const topFinal  = Math.max(60, Math.min(topCalc, sheetRect.height - confirm.offsetHeight - 16));

    confirm.style.top   = topFinal + 'px';
    confirm.style.right = '16px';
    confirm.style.left  = 'auto';

    confirm.querySelector('.tchat-suppr-non').addEventListener('click', (e) => {
        e.stopPropagation();
        confirm.remove();
    });

    confirm.querySelector('.tchat-suppr-oui').addEventListener('click', async (e) => {
        e.stopPropagation();
        confirm.remove();
        await _supprimerMessage(wrap, msgId);
    });

    const _fermerModale = (e) => {
        if (!confirm.contains(e.target)) {
            confirm.remove();
            document.removeEventListener('click', _fermerModale);
        }
    };
    setTimeout(() => document.addEventListener('click', _fermerModale), 0);
}

async function _supprimerMessage(wrap, msgId) {
    try {
        const r = await fetch(`/api/tchat/messages/${msgId}`, {
            method : 'DELETE',
            headers: _authHeaders()
        });
        const d = await r.json();
        if (d.success) {
            wrap.classList.add('tchat-msg-supprime');
            const bulle = wrap.querySelector('.tchat-msg-bulle');
            if (bulle) {
                bulle.innerHTML = '<em>Message supprimé</em>';
                bulle.classList.add('tchat-msg-bulle-supprime');
            }
            wrap.querySelectorAll('.tchat-msg-lu, .tchat-msg-modifie, .tchat-msg-actions').forEach(el => el.remove());
        }
    } catch (err) {
        console.error('[TCHAT] supprimerMessage :', err.message);
    }
}

async function _supprimerConversation(interlocuteurId) {
    try {
        const r = await fetch(`/api/tchat/conversations/${interlocuteurId}`, {
            method : 'DELETE',
            headers: _authHeaders()
        });
        const d = await r.json();
        if (d.success) _chargerConversations();
    } catch (err) {
        console.error('[TCHAT] supprimerConversation :', err.message);
    }
}

async function _envoyerImage(file) {
    if (!_interlocuteurActif) return;
    const formData = new FormData();
    formData.append('image', file);
    formData.append('receiver_id', _interlocuteurActif.id);
    if (_replyTo) formData.append('reply_to_id', _replyTo.id);

    try {
        const r = await fetch('/api/tchat/messages/image', {
            method : 'POST',
            headers: { 'Authorization': `Bearer ${_token()}` },
            body   : formData
        });
        const d = await r.json();
        if (d.success) {
            _annulerReply();
            if (!_socket?.connected) {
                _appendMessage(d.message);
                _scrollBasMessages();
            }
            _rafraichirBadgeBulle();
        }
    } catch (err) {
        console.error('[TCHAT] envoyerImage :', err.message);
    }
}

async function _chargerPresence() {
    try {
        const r = await fetch('/api/tchat/presence', { headers: _authHeaders() });
        const d = await r.json();
        if (!d.success) return;
        _usersEnLigne = new Set(d.enligne.map(Number));
    } catch { /* silencieux */ }
}

function _initSocket() {
    if (_socket) return;
    if (typeof io === 'undefined') return;

    _socket = io({ auth: { token: _token() } });

    _socket.on('connect', () => console.log('[TCHAT] Socket connecté'));

    _socket.on('tchat:presence', ({ userId, enligne }) => {
        const id = Number(userId);
        if (enligne) {
            _usersEnLigne.add(id);
        } else {
            _usersEnLigne.delete(id);
        }
        _mettreAJourPointsPresence(id, enligne);
        if (_interlocuteurActif && Number(_interlocuteurActif.id) === id) {
            const statut = document.getElementById('tchat-conv-statut');
            if (statut) {
                statut.textContent = enligne ? 'En ligne' : '';
                statut.className   = enligne ? 'tchat-conv-statut-enligne' : '';
            }
        }
    });

    _socket.on('tchat:message', (msg) => {
        const moi = _userId();
        if (
            _interlocuteurActif &&
            (
                (msg.sender_id === moi    && msg.receiver_id === _interlocuteurActif.id) ||
                (msg.sender_id === _interlocuteurActif.id && msg.receiver_id === moi)
            )
        ) {
            _appendMessage(msg);
            _scrollBasMessages();
            if (msg.sender_id !== moi) _marquerLu(_interlocuteurActif.id);
        }
        _chargerConversations();
        _rafraichirBadgeBulle();
    });

    _socket.on('tchat:lu', ({ par }) => {
        if (_interlocuteurActif && par === _interlocuteurActif.id) {
            document.querySelectorAll('.tchat-msg.sortant .tchat-msg-lu').forEach(el => {
                el.textContent = '✓✓';
                el.classList.remove('envoye');
            });
        }
    });

    _socket.on('tchat:modifie', (msg) => {
        const wrap = document.querySelector(`[data-msg-id="${msg.id}"]`);
        if (!wrap) return;
        const bulle = wrap.querySelector('.tchat-msg-bulle');
        if (bulle) bulle.innerHTML = _renderLiens(_convertirEmojis(_echapper(msg.content)));
        let modifTag = wrap.querySelector('.tchat-msg-modifie');
        if (!modifTag) {
            modifTag             = document.createElement('span');
            modifTag.className   = 'tchat-msg-modifie';
            modifTag.textContent = 'modifié';
            wrap.querySelector('.tchat-msg-meta')?.prepend(modifTag);
        }
    });

    _socket.on('tchat:supprime', ({ id, par }) => {
        const moi  = _userId();
        if (par === moi) return;
        const wrap = document.querySelector(`[data-msg-id="${id}"]`);
        if (!wrap) return;
        const bulle = wrap.querySelector('.tchat-msg-bulle');
        if (bulle) {
            bulle.innerHTML = '<em>Message supprimé</em>';
            bulle.classList.add('tchat-msg-bulle-supprime');
        }
        wrap.querySelectorAll('.tchat-msg-lu, .tchat-msg-modifie, .tchat-msg-actions').forEach(el => el.remove());
    });

    _socket.on('disconnect', () => console.log('[TCHAT] Socket déconnecté'));
}

function _rejoindreRoom(userId, interlocuteurId) {
    if (!_socket) return;
    _socket.emit('tchat:rejoindre', { room: _roomName(userId, interlocuteurId) });
}

function _quitterRoom(userId, interlocuteurId) {
    if (!_socket) return;
    _socket.emit('tchat:quitter', { room: _roomName(userId, interlocuteurId) });
}

// ── GESTION HISTORIQUE & NAVIGATION ──

function _toggleTchat() { 
    if (_ouvert) {
        if (_historyDepth > 0) history.go(-_historyDepth); // referme proprement en dépilant
        else _fermerTchat(true);
    } else {
        _ouvrirTchat(); 
    }
}

function _ouvrirTchat() {
    _ouvert = true;
    document.getElementById('tchat-sheet').classList.add('ouvert');
    document.getElementById('tchat-overlay').classList.add('visible');
    const bulle = document.getElementById('tchat-bulle');
    if (bulle) bulle.style.opacity = '0';
    
    _afficherVueListe(true); // true = push state avec hash
    _chargerConversations();
    _initSocket();
    _chargerPresence();
}

function _fermerTchat(skipHistory = false) {
    _ouvert = false;
    document.getElementById('tchat-sheet').classList.remove('ouvert');
    document.getElementById('tchat-overlay').classList.remove('visible');
    const bulle = document.getElementById('tchat-bulle');
    if (bulle) bulle.style.opacity = '1';
    if (_interlocuteurActif) {
        _quitterRoom(_userId(), _interlocuteurActif.id);
        _interlocuteurActif = null;
    }
    _annulerReply();
    _fermerEmojiPanel();
    
    _historyDepth = 0;
}

function _afficherVueListe(pushState = false) {
    _vueActive = 'liste';
    document.getElementById('tchat-vue-liste').style.display = 'flex';
    document.getElementById('tchat-vue-conv').classList.remove('active');
    document.getElementById('tchat-header-titre').textContent = 'Tchat';
    if (_interlocuteurActif) {
        _quitterRoom(_userId(), _interlocuteurActif.id);
        _interlocuteurActif = null;
    }
    _annulerReply();
    _fermerEmojiPanel();
    _chargerConversations();

    if (pushState) {
        // Ajout du hash pour forcer Android à reconnaitre la navigation
        history.pushState({ tchat: 'liste' }, '', '#tchat-liste');
        _historyDepth++;
    }
}

function _afficherVueConv(interlocuteur, pushState = true) {
    _vueActive          = 'conv';
    _interlocuteurActif = interlocuteur;
    _plusAncienMsgId    = null;

    document.getElementById('tchat-vue-liste').style.display = 'none';
    document.getElementById('tchat-vue-conv').classList.add('active');
    document.getElementById('tchat-header-titre').textContent = '';
    document.getElementById('tchat-conv-nom-label').textContent =
        interlocuteur.prenom
            ? `${interlocuteur.prenom}${interlocuteur.nom ? ' ' + interlocuteur.nom : ''}`
            : interlocuteur.username;

    const avatarWrap = document.getElementById('tchat-conv-avatar-wrap');
    avatarWrap.querySelector('#tchat-conv-avatar-img').innerHTML =
        _avatarHTML(interlocuteur.photo, interlocuteur.prenom, interlocuteur.nom, 36, interlocuteur.id);

    avatarWrap.style.cursor = 'pointer';
    avatarWrap.onclick = () => {
        if (typeof ouvrirProfilPublic === 'function') {
            ouvrirProfilPublic(interlocuteur.id);
        }
    };

    const statut = document.getElementById('tchat-conv-statut');
    const enligne = _usersEnLigne.has(Number(interlocuteur.id));
    statut.textContent = enligne ? 'En ligne' : '';
    statut.className   = enligne ? 'tchat-conv-statut-enligne' : '';

    const scroll = document.getElementById('tchat-messages-scroll');
    scroll.innerHTML = `
        <button id="tchat-btn-plus-anciens" style="display:none">
            Charger les messages précédents
        </button>`;
    document.getElementById('tchat-btn-plus-anciens').addEventListener('click', _chargerPlusAnciens);

    // Clic image => appel du Modal global (Feed)
    scroll.addEventListener('click', (e) => {
        const img = e.target.closest('[data-lightbox-src]');
        if (img) {
            if (typeof window.ouvrirPhoto === 'function') {
                window.ouvrirPhoto(img.dataset.lightboxSrc); 
            } else {
                console.error("Fonction ouvrirPhoto introuvable, impossible d'afficher l'image.");
            }
        }
    });

    _annulerReply();
    _fermerEmojiPanel();
    _rejoindreRoom(_userId(), interlocuteur.id);
    _chargerMessages();
    _marquerLu(interlocuteur.id);

    if (pushState) {
        // Ajout du hash pour la conversation
        history.pushState({ tchat: 'conv' }, '', '#tchat-conv');
        _historyDepth++;
    }
}

async function _chargerConversations() {
    const liste = document.getElementById('tchat-liste-scroll');
    if (!liste) return;
    try {
        const r = await fetch('/api/tchat/conversations', { headers: _authHeaders() });
        const d = await r.json();
        if (!d.success) return;

        if (!d.conversations.length) {
            liste.innerHTML = `
                <div class="tchat-vide">
                    <div class="tchat-vide-icone">💬</div>
                    <div class="tchat-vide-texte">Aucune conversation.<br>Commence à écrire !</div>
                </div>`;
            return;
        }

        liste.innerHTML = d.conversations.map(c => {
            const moi    = _userId();
            const nom    = c.prenom
                ? `${c.prenom}${c.nom ? ' ' + c.nom : ''}`
                : c.username;
            const apercu = c.dernier_message
                ? (c.dernier_sender_id === moi
                    ? `Vous : ${c.dernier_message}`
                    : c.dernier_message)
                : c.dernier_image_url ? (c.dernier_sender_id === moi ? 'Vous : 📷 Photo' : '📷 Photo')
                : 'Aucun message';
            const heure = c.dernier_message_at ? _formatHeure(c.dernier_message_at) : '';
            const nonLu = c.non_lus > 0;
            return `
                <div class="tchat-conv-item"
                     data-id="${c.interlocuteur_id}"
                     data-username="${_echapper(c.username)}"
                     data-prenom="${_echapper(c.prenom || '')}"
                     data-nom="${_echapper(c.nom || '')}"
                     data-photo="${_echapper(c.photo || '')}">
                    <div class="tchat-conv-avatar">
                        ${_avatarHTML(c.photo, c.prenom, c.nom, 42, c.interlocuteur_id)}
                    </div>
                    <div class="tchat-conv-infos">
                        <div class="tchat-conv-nom">${_echapper(nom)}</div>
                        <div class="tchat-conv-apercu${nonLu ? ' non-lu' : ''}">
                            ${_echapper(apercu.substring(0, 60))}
                        </div>
                    </div>
                    <div class="tchat-conv-meta">
                        <span class="tchat-conv-heure">${heure}</span>
                        ${nonLu ? `<span class="tchat-conv-badge">${c.non_lus}</span>` : ''}
                    </div>
                    <button class="tchat-conv-suppr" data-id="${c.interlocuteur_id}"
                            title="Supprimer la conversation"
                            aria-label="Supprimer la conversation">🗑️</button>
                </div>`;
        }).join('');

        liste.querySelectorAll('.tchat-conv-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.tchat-conv-suppr')) return;
                _afficherVueConv({
                    id      : parseInt(el.dataset.id, 10),
                    username: el.dataset.username,
                    prenom  : el.dataset.prenom || null,
                    nom     : el.dataset.nom    || null,
                    photo   : el.dataset.photo  || null
                }, true);
            });
        });

        liste.querySelectorAll('.tchat-conv-suppr').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemEl = btn.closest('.tchat-conv-item');
                _confirmerSuppressionConversation(parseInt(btn.dataset.id, 10), itemEl);
            });
        });

    } catch (err) {
        console.error('[TCHAT] chargerConversations :', err.message);
    }
}

async function _chargerMessages(avant = null) {
    if (_chargementEnCours || !_interlocuteurActif) return;
    _chargementEnCours = true;

    const scroll  = document.getElementById('tchat-messages-scroll');
    const btnPlus = document.getElementById('tchat-btn-plus-anciens');

    try {
        let url = `/api/tchat/messages/${_interlocuteurActif.id}`;
        if (avant) url += `?avant=${avant}`;

        const r = await fetch(url, { headers: _authHeaders() });
        const d = await r.json();
        if (!d.success) return;

        const msgs = d.messages;

        if (!msgs.length && !avant) {
            scroll.innerHTML = `
                <button id="tchat-btn-plus-anciens" style="display:none">
                    Charger les messages précédents
                </button>
                <div class="tchat-vide">
                    <div class="tchat-vide-icone">👋</div>
                    <div class="tchat-vide-texte">Dis bonjour !</div>
                </div>`;
            document.getElementById('tchat-btn-plus-anciens').addEventListener('click', _chargerPlusAnciens);
            return;
        }

        if (msgs.length === LIMITE_PAR_PAGE) {
            _plusAncienMsgId = msgs[0].id;
            if (btnPlus) btnPlus.style.display = 'flex';
        } else {
            if (btnPlus) btnPlus.style.display = 'none';
        }

        if (avant) {
            const ancreId  = scroll.querySelector('.tchat-msg')?.dataset.msgId;
            const fragment = _construireFragment(msgs);
            const ancre    = ancreId
                ? scroll.querySelector(`[data-msg-id="${ancreId}"]`)
                : null;
            if (ancre) scroll.insertBefore(fragment, ancre);
            else       scroll.appendChild(fragment);
        } else {
            const vide = scroll.querySelector('.tchat-vide');
            if (vide) vide.remove();
            scroll.appendChild(_construireFragment(msgs));
            _scrollBasMessages();
        }
    } catch (err) {
        console.error('[TCHAT] chargerMessages :', err.message);
    } finally {
        _chargementEnCours = false;
    }
}

function _chargerPlusAnciens() {
    if (_plusAncienMsgId) _chargerMessages(_plusAncienMsgId);
}

function _construireFragment(msgs) {
    const fragment = document.createDocumentFragment();
    const moi      = _userId();
    let   dernDate = null;

    msgs.forEach(msg => {
        const dateMsg = new Date(msg.created_at).toDateString();
        if (dateMsg !== dernDate) {
            dernDate = dateMsg;
            const sep       = document.createElement('div');
            sep.className   = 'tchat-date-sep';
            sep.textContent = _formatDateSep(msg.created_at);
            fragment.appendChild(sep);
        }
        fragment.appendChild(_creerBulleDom(msg, moi));
    });

    return fragment;
}

function _creerBulleDom(msg, moi) {
    const sortant  = Number(msg.sender_id) === Number(moi);
    const supprime = Array.isArray(msg.deleted_for) && msg.deleted_for.includes(Number(moi));
    const wrap     = document.createElement('div');
    wrap.className     = `tchat-msg ${sortant ? 'sortant' : 'entrant'}`;
    wrap.dataset.msgId = msg.id;

    const luHTML = sortant
        ? `<span class="tchat-msg-lu ${msg.seen ? '' : 'envoye'}">${msg.seen ? '✓✓' : '✓'}</span>`
        : '';

    const modifieHTML = msg.edited_at
        ? `<span class="tchat-msg-modifie">modifié</span>`
        : '';

    let replyHTML = '';
    if (msg.reply_to_id && msg.reply_content) {
        const replyNom = msg.reply_sender_prenom || msg.reply_sender_username || '';
        replyHTML = `
            <div class="tchat-reply-cite">
                <span class="tchat-reply-cite-nom">${_echapper(replyNom)}</span>
                <span class="tchat-reply-cite-texte">${_echapper((msg.reply_content || '').substring(0, 80))}</span>
            </div>`;
    }

    let contenu;
    if (supprime) {
        contenu = '<em class="tchat-msg-supprime-texte">Message supprimé</em>';
    } else if (msg.image_url) {
        // Clic droit désactivé sur les images du tchat, et cursor pointer car cliquable
        contenu = `<img src="${_echapper(msg.image_url)}"
            class="tchat-msg-image"
            alt="image"
            style="cursor:pointer;"
            data-lightbox-src="${_echapper(msg.image_url)}"
            oncontextmenu="return false;"
            onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<span style=\\'font-size:12px;color:#9ca3af;font-style:italic\\'>Image indisponible</span>')">`;
    } else {
        contenu = _renderLiens(_convertirEmojis(_echapper(msg.content || '')));
    }

    const actionsHTML = !supprime ? `
        <div class="tchat-msg-actions">
            <button class="tchat-msg-btn-reply" title="Répondre">↩</button>
            ${sortant && !msg.image_url ? `<button class="tchat-msg-btn-edit" title="Modifier">✏️</button>` : ''}
            <button class="tchat-msg-btn-del" title="Supprimer">🗑️</button>
        </div>` : '';

    wrap.innerHTML = `
        ${actionsHTML}
        <div class="tchat-msg-bulle">
            ${replyHTML}
            ${contenu}
        </div>
        <div class="tchat-msg-meta">
            ${modifieHTML}
            <span class="tchat-msg-heure">${_formatHeure(msg.created_at)}</span>
            ${luHTML}
        </div>`;

    if (!supprime) {
        wrap.querySelector('.tchat-msg-btn-reply')?.addEventListener('click', (e) => {
            e.stopPropagation();
            _activerReply(msg);
        });

        wrap.querySelector('.tchat-msg-btn-edit')?.addEventListener('click', (e) => {
            e.stopPropagation();
            _editerMessage(wrap, msg);
        });

        wrap.querySelector('.tchat-msg-btn-del')?.addEventListener('click', (e) => {
            e.stopPropagation();
            _supprimerMessageConfirm(wrap, msg.id);
        });
    }

    return wrap;
}

function _appendMessage(msg) {
    const scroll = document.getElementById('tchat-messages-scroll');
    if (!scroll) return;

    const vide = scroll.querySelector('.tchat-vide');
    if (vide) vide.remove();

    const moi       = _userId();
    const dernBulle = scroll.querySelectorAll('.tchat-msg');
    if (dernBulle.length) {
        const dernEl   = dernBulle[dernBulle.length - 1];
        const dernDate = new Date(parseInt(dernEl.dataset.msgId || 0));
        const nouvDate = new Date(msg.created_at);
        if (dernDate.toDateString() !== nouvDate.toDateString()) {
            const sep       = document.createElement('div');
            sep.className   = 'tchat-date-sep';
            sep.textContent = _formatDateSep(msg.created_at);
            scroll.appendChild(sep);
        }
    }

    scroll.appendChild(_creerBulleDom(msg, moi));
}

function _scrollBasMessages() {
    const scroll = document.getElementById('tchat-messages-scroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
}

async function _envoyerMessage() {
    const input  = document.getElementById('tchat-input');
    const btnEnv = document.getElementById('tchat-btn-envoyer');
    const texte  = input.value.trim();
    if (!texte || !_interlocuteurActif) return;

    input.value        = '';
    input.style.height = 'auto';
    btnEnv.disabled    = true;
    _fermerEmojiPanel();

    try {
        const body = { receiver_id: _interlocuteurActif.id, content: texte };
        if (_replyTo) body.reply_to_id = _replyTo.id;

        const r = await fetch('/api/tchat/messages', {
            method : 'POST',
            headers: _authHeaders(),
            body   : JSON.stringify(body)
        });
        const d = await r.json();
        if (!d.success) {
            input.value     = texte;
            btnEnv.disabled = false;
            return;
        }
        _annulerReply();
        if (!_socket?.connected) {
            _appendMessage(d.message);
            _scrollBasMessages();
        }
        _rafraichirBadgeBulle();
    } catch (err) {
        console.error('[TCHAT] envoyerMessage :', err.message);
        input.value     = texte;
        btnEnv.disabled = false;
    }
}

async function _marquerLu(interlocuteurId) {
    try {
        await fetch('/api/tchat/messages/lus', {
            method : 'POST',
            headers: _authHeaders(),
            body   : JSON.stringify({ interlocuteur_id: interlocuteurId })
        });
        _rafraichirBadgeBulle();
    } catch (err) {
        console.error('[TCHAT] marquerLu :', err.message);
    }
}

async function _ouvrirSelectUser() {
    try {
        // [NOUVEAU] On pousse un état pour la vue "recherche utilisateur"
        history.pushState({ tchat: 'select' }, '', '#tchat-select');
        _historyDepth++;

        const r = await fetch('/api/tchat/users', { headers: _authHeaders() });
        const d = await r.json();
        if (!d.success) return;

        const users = d.users;
        const liste = document.getElementById('tchat-liste-scroll');

        const _renderUsers = (liste_filtree) => {
            const zone = document.getElementById('tchat-select-user-liste');
            if (!zone) return;
            if (!liste_filtree.length) {
                zone.innerHTML = `<div class="tchat-vide" style="padding:20px 0">
                    <div class="tchat-vide-texte">Aucun résultat</div>
                </div>`;
                return;
            }
            zone.innerHTML = liste_filtree.map(u => {
                const affichage = u.prenom
                    ? `${u.prenom}${u.nom ? ' ' + u.nom : ''}`
                    : u.username;
                return `
                    <div class="tchat-conv-item"
                         data-id="${u.id}"
                         data-username="${_echapper(u.username)}"
                         data-prenom="${_echapper(u.prenom || '')}"
                         data-nom="${_echapper(u.nom || '')}"
                         data-photo="${_echapper(u.photo || '')}">
                        <div class="tchat-conv-avatar">
                            ${_avatarHTML(u.photo, u.prenom, u.nom, 42, u.id)}
                        </div>
                        <div class="tchat-conv-infos">
                            <div class="tchat-conv-nom">${_echapper(affichage)}</div>
                            <div class="tchat-conv-apercu">@${_echapper(u.username)}</div>
                        </div>
                    </div>`;
            }).join('');

            zone.querySelectorAll('.tchat-conv-item').forEach(el => {
                el.addEventListener('click', () => {
                    _afficherVueConv({
                        id      : parseInt(el.dataset.id, 10),
                        username: el.dataset.username,
                        prenom  : el.dataset.prenom || null,
                        nom     : el.dataset.nom    || null,
                        photo   : el.dataset.photo  || null
                    }, true);
                });
            });
        };

        liste.innerHTML = `
            <div class="tchat-select-user-header">
                <button id="tchat-retour-select">‹ Retour</button>
                <div class="tchat-select-user-titre">Nouvelle conversation</div>
                <div class="tchat-select-user-search-wrap">
                    <input type="text"
                           id="tchat-select-user-search"
                           class="tchat-select-user-search"
                           placeholder="Rechercher un membre…"
                           autocomplete="off">
                </div>
            </div>
            <div id="tchat-select-user-liste">
                <div class="tchat-vide" style="padding:20px 0">
                    <div class="tchat-vide-texte">Tape un prénom ou un pseudo…</div>
                </div>
            </div>`;

        document.getElementById('tchat-retour-select').addEventListener('click', () => {
            history.back(); // Utilisation de l'historique au lieu de forcer l'affichage
        });

        document.getElementById('tchat-select-user-search').addEventListener('input', (e) => {
            const q = e.target.value.trim().toLowerCase();
            if (!q) {
                const zone = document.getElementById('tchat-select-user-liste');
                if (zone) zone.innerHTML = `<div class="tchat-vide" style="padding:20px 0">
                    <div class="tchat-vide-texte">Tape un prénom ou un pseudo…</div>
                </div>`;
                return;
            }
            const filtres = users.filter(u => {
                const nom_complet = `${u.prenom || ''} ${u.nom || ''}`.toLowerCase();
                return nom_complet.includes(q) || u.username.toLowerCase().includes(q);
            });
            _renderUsers(filtres);
        });

    } catch (err) {
        console.error('[TCHAT] ouvrirSelectUser :', err.message);
    }
}

async function _rafraichirBadgeBulle() {
    try {
        const r = await fetch('/api/tchat/non-lus', { headers: _authHeaders() });
        const d = await r.json();
        if (!d.success) return;

        const badge = document.getElementById('tchat-bulle-badge');
        if (badge) {
            if (d.total > 0) {
                badge.textContent = d.total > 99 ? '99+' : d.total;
                badge.classList.add('visible');
            } else {
                badge.classList.remove('visible');
            }
        }

        const badgeTopbar = document.getElementById('tchat-topbar-badge');
        if (badgeTopbar) {
            if (d.total > 0) {
                badgeTopbar.textContent   = d.total > 99 ? '99+' : d.total;
                badgeTopbar.style.display = 'flex';
            } else {
                badgeTopbar.style.display = 'none';
            }
        }
    } catch { /* silencieux */ }
}

// ── INTERCEPTION DU BOUTON RETOUR (POPSTATE) ──
window.addEventListener('popstate', (e) => {
    if (_ouvert) {
        if (e.state && e.state.tchat === 'liste') {
            // On a fait "retour" depuis une conversation ou une recherche vers la liste
            _afficherVueListe(false);
            _historyDepth--;
        } else if (!e.state || !e.state.tchat) {
            // On a fait "retour" depuis la liste vers la fermeture du tchat
            _fermerTchat(true);
        }
    }
});

window.Tchat = {
    ouvrirConversation(interlocuteur) {
        if (!_ouvert) _ouvrirTchat();
        _afficherVueConv(interlocuteur, true);
    },
    toggle  : _toggleTchat,
    init() {
        _construireDom();
        _rafraichirBadgeBulle();
        setInterval(_rafraichirBadgeBulle, 30000);
    },
    rafraichirBadge: _rafraichirBadgeBulle
};

})();


