// ============================================================
// public/js/animal-totem.js
// Widget Animal Totem — onglet Astral
// Récupère l'animal correspondant depuis /api/animal-totem
// et injecte le rendu dans #wc-animal-totem.
// ============================================================

async function chargerAnimalTotem() {
    const conteneur = document.getElementById('wc-animal-totem');
    if (!conteneur) return;

    conteneur.innerHTML = `
        <div class="at-loading">Chargement...</div>
    `;

    const user = getUser();
    if (!user?.token) return;

    try {
        const reponse = await fetch('/api/animal-totem', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const resultat = await reponse.json();

        if (!resultat.success) {
            if (resultat.code === 'NO_DATE' || resultat.code === 'NO_PROFILE') {
                conteneur.innerHTML = `
                    <div class="at-erreur">
                        Merci de renseigner ta date de naissance dans ton profil
                        pour découvrir ton animal totem.
                    </div>
                `;
            } else {
                conteneur.innerHTML = `
                    <div class="at-erreur">
                        Impossible de charger ton animal totem pour le moment.
                    </div>
                `;
            }
            return;
        }

        afficherAnimalTotem(conteneur, resultat.data);

    } catch (err) {
        console.error('[animal-totem] Erreur chargement :', err);
        conteneur.innerHTML = `
            <div class="at-erreur">
                Erreur serveur — réessaie plus tard.
            </div>
        `;
    }
}

function afficherAnimalTotem(conteneur, animal) {
    conteneur.innerHTML = `
        <div class="at-card">
            <div class="at-image-wrapper">
                <img src="${animal.image}" alt="${animal.nom}" class="at-image" loading="lazy">
            </div>
            <div class="at-contenu">
                <h3 class="at-nom">${animal.nom}</h3>
                <div class="at-badges">
                    <span class="at-badge at-badge-element">${animal.element}</span>
                    <span class="at-badge at-badge-trait">${animal.trait}</span>
                </div>
                <p class="at-description">${animal.description}</p>
                ${animal.credit ? `<p class="at-credit">${animal.credit}</p>` : ''}
                <p class="at-disclaimer">Symbolique traditionnelle, à visée inspirationnelle.</p>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('wc-animal-totem')) {
        chargerAnimalTotem();
    }
});
