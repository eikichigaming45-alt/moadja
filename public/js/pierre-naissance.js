// ============================================================
// public/js/pierre-naissance.js
// Widget Pierre de naissance — onglet Astral
// Récupère la pierre correspondante depuis /api/pierre-naissance
// et injecte le rendu dans #wc-pierre-naissance.
// ============================================================

async function chargerPierreNaissance() {
    const conteneur = document.getElementById('wc-pierre-naissance');
    if (!conteneur) return;

    conteneur.innerHTML = `
        <div class="pn-loading">Chargement...</div>
    `;

    try {
        const token = localStorage.getItem('token');
        const reponse = await fetch('/api/pierre-naissance', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const resultat = await reponse.json();

        if (!resultat.success) {
            if (resultat.code === 'NO_DATE' || resultat.code === 'NO_PROFILE') {
                conteneur.innerHTML = `
                    <div class="pn-erreur">
                        Merci de renseigner ta date de naissance dans ton profil
                        pour découvrir ta pierre de naissance.
                    </div>
                `;
            } else {
                conteneur.innerHTML = `
                    <div class="pn-erreur">
                        Impossible de charger ta pierre de naissance pour le moment.
                    </div>
                `;
            }
            return;
        }

        afficherPierreNaissance(conteneur, resultat.data);

    } catch (err) {
        console.error('[pierre-naissance] Erreur chargement :', err);
        conteneur.innerHTML = `
            <div class="pn-erreur">
                Erreur serveur — réessaie plus tard.
            </div>
        `;
    }
}

function afficherPierreNaissance(conteneur, pierre) {
    conteneur.innerHTML = `
        <div class="pn-card">
            <div class="pn-image-wrapper">
                <img src="${pierre.image}" alt="${pierre.nom}" class="pn-image" loading="lazy">
            </div>
            <div class="pn-contenu">
                <h3 class="pn-nom">${pierre.nom}</h3>
                <div class="pn-badges">
                    <span class="pn-badge pn-badge-statut">${pierre.statut}</span>
                    <span class="pn-badge pn-badge-chakra">${pierre.chakra}</span>
                </div>
                <p class="pn-description">${pierre.description}</p>
                ${pierre.credit ? `<p class="pn-credit">${pierre.credit}</p>` : ''}
                <p class="pn-disclaimer">Symbolique traditionnelle, à visée inspirationnelle.</p>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('wc-pierre-naissance')) {
        chargerPierreNaissance();
    }
});
