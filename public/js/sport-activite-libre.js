// ============================================================
// public/js/sport-activite-libre.js
// ============================================================
// Module dédié au bouton "Activité libre" de la carte Dashboard Sport
// (icône altère). Isolé de sport.js pour ne pas alourdir ce fichier.
// Provisoire : le vrai tracking GPS (Mode Poche) n'est pas encore
// développé (Étape 2 à venir). Pour l'instant, affiche une information
// à l'utilisateur au clic.
// Dépend de sport.js chargé AVANT (fonction _sportOuvrirConfirmationInfo).

function _sportActiviteLibreOuvrir() {
    _sportOuvrirConfirmationInfo(
        "Le suivi GPS des activités (marche, course) arrive bientôt !"
    );
}
