# Changelog MoaDja

---

## v1.69.5 - 05-09-2026

### ✨ Nouveau
- Nouvelles icônes météo, plus douces et plus lisibles (soleil, nuages, pluie, neige, orage)

### 🔧 Corrections
- Dans certains cas, la météo du jour affichait une icône et un texte différents entre la vignette d'accueil et la fenêtre détaillée (par exemple "pluie" à un endroit et "ciel dégagé" à un autre) - l'affichage est désormais toujours cohérent, y compris dans le récapitulatif des 6 prochains jours

---

## v1.69.2 - 05-09-2026

### ✨ Nouveau
- Possibilité d'ajouter un lieu à ses publications dans le fil d'actualité, avec recherche par nom de ville ou détection automatique de sa position
- Un badge affichant le lieu apparaît désormais sur les publications concernées, à côté du nom de l'auteur, et ouvre une carte interactive au clic
- Nouveau bouton "Envoyer un message" directement depuis la fiche d'un membre, en plus du bouton "Suivre"

---

## v1.65 - 04-09-2026

### ✨ Nouveau
- Ajout d'un champ Site internet dans le profil, avec affichage automatique sur le profil privé

---

## v1.64 - 04-09-2026

### 🔧 Corrections
- Double défilement gênant dans le sélecteur d'émojis du tchat - corrigé

---

## v1.63 - 02-09-2026

### ✨ Nouveau
- Indicateur de présence en ligne/hors ligne - point vert sur l'avatar d'un membre quand il est connecté, gris quand il est absent
- Statut "En ligne" affiché sous le prénom de l'interlocuteur dans la fenêtre de conversation
- La présence se met à jour instantanément pour tout le monde à la connexion et à la déconnexion

### 🔧 Corrections
- "Nouvelle conversation" affichait tous les membres sans avoir rien tapé - la liste démarre désormais vide, les résultats apparaissent à partir du 1er caractère saisi
- L'ascendant astral était calculé avec une mauvaise heure pour les dates d'hiver françaises - il affiche désormais la valeur correcte
- Le thème astral de tous les membres sera recalculé automatiquement à leur prochaine visite

---

## v1.62 - 01-09-2026

### ✨ Nouveau
- Sélecteur d'emojis dans le tchat
- Envoi de photos dans le tchat
- Les liens dans les messages du tchat sont maintenant cliquables
- Recherche instantanée dans la liste des contacts lors d'une nouvelle conversation

### 🔧 Corrections
- Les boutons d'action sur les messages du tchat apparaissent correctement sur tous les messages
- Les messages contenant uniquement un emoji s'affichent correctement dans leur bulle
- Les modales de confirmation de suppression respectent désormais la charte visuelle
- Avatar des profils dans le feed : affichage corrigé - trigramme au lieu d'une simple initiale

---

## v1.59 - 31-08-2026

### ✨ Nouveau
- Tchat temps réel Socket.io - conversations privées entre utilisateurs
- Bulle flottante bas-droite sur desktop · icône 💬 dans la topbar sur mobile
- Bottom sheet plein écran sur mobile · tiroir latéral translucide sur desktop
- Aura arc-en-ciel sur les avatars des interlocuteurs
- Pagination infinie vers le haut (charger les messages précédents)
- Marquage automatique des messages comme lus à l'ouverture d'une conversation
- Badge non-lus en temps réel sur la bulle et l'icône topbar
- Notification push "coucou" vers le destinataire si non connecté au Socket

### 🔧 Corrections
- Bug C (push inter-users) : un appareil = un seul user à la fois
- Bug D : purge des anciens `post_likes` sans type - 5 entrées supprimées
- Bug F : séparation desktop/mobile dans les résonances - tap photo ouvre uniquement la photo sur mobile
- Bug G : rappels agenda reçus par tous - confirmé propre suite à la correction Bug C

---

## v1.58 - 31-08-2026

### ✨ Nouveau
- Résonances : nouveau système de réactions - Douceur 🩷 · Énergie ⚡ · Calme 🌙 · Inspiration ✨
- Pills colorées sous les posts affichant le décompte par type de résonance
- Champ Lieu optionnel sur les posts
- Éclats : stories 24h - upload photo, 2 bandeaux scrollables dans l'onglet Accueil, expiration automatique

### 🔧 Corrections
- Labels widgets stats admin corrigés
- Purge BDD : 18 entrées orphelines supprimées

---

## v1.56 - 30-08-2026

### ✨ Nouveau
- Cliquer sur une notification redirige vers l'onglet concerné
- Les rappels push ouvrent directement l'onglet Quotidien au tap

### 🔧 Corrections
- Fichier parasite supprimé du VPS

---

## v1.55 - 30-08-2026

### ✨ Nouveau
- Message retard conditionnel selon les rapports non protégés en base

---

## v1.54 - 30-08-2026

### ✨ Nouveau
- Message bienveillant permanent dans le bandeau de retard
- "Signaler un retard" enregistre silencieusement dans le journal

### 🔧 Corrections
- Durée des règles calculée depuis l'historique
- Doublon du bouton enregistrer les règles supprimé

---

## v1.48 - 30-08-2026

### ✨ Nouveau
- Champ Praticien pour les événements Médicaux
- Champ Lieu disponible pour toutes les catégories
- Liste déroulante des employeurs existants

### 🔧 Corrections
- Route agenda interceptée par l'identifiant - corrigée
- "Repos - Repos" masqué dans le détail et le widget Social
- Champ Employeur repositionné dans le formulaire

---

## v1.47 - 30-08-2026 🏷️ Stable

### ✨ Nouveau
- Agenda unifié : Planning et Rendez-vous fusionnés
- Catégories avec sous-catégories mémorisées et réutilisables
- Vue calendrier mensuel avec code couleur
- Rappels push couvrent toutes les entrées agenda

### 🔧 Corrections
- Références aux anciennes tables supprimées dans admin et push

---

## v1.46 - 30-08-2026 🏷️ Stable

### ✨ Nouveau
- Météo : mémorisation du mode et des coordonnées, rafraîchissement auto

---

## v1.45 - 29-08-2026

### ✨ Nouveau
- Widget Prière Islam : bandeau si coordonnées GPS manquantes

---

## v1.44 - 29-08-2026

### ✨ Nouveau
- Hashtags cliquables dans le feed avec filtre actif

### 🔧 Corrections
- Mentions @Tout le monde cassées après l'ajout des hashtags - corrigé

---

## v1.43 - 29-08-2026

### ✨ Nouveau
- Thème Astral : bouton de calcul au premier affichage
- Astrologie : bouton si date de naissance manquante

### 🔧 Corrections
- Photo post Android : galerie proposée par défaut
- Icônes météo manquantes sur conditions rares corrigées
- Widget Santé : bandeau profil incomplet au lieu d'une erreur

---

## v1.42 - 29-08-2026 🏷️ Stable

### ✨ Nouveau
- Thème Astral : Milieu du Ciel, Ascendant, Lune, Soleil affichés

### 🔧 Corrections
- Milieu du Ciel affichait "Heure requise" à tort - corrigé
- Variables d'environnement non chargées au démarrage - corrigé

---

## v1.41 - 28-08-2026 🏷️ Stable

### ✨ Nouveau
- Thème astral calculé une seule fois à vie
- Notifications limitées à 6 par défaut avec bouton "Voir plus"
- Cloche et menu profil se ferment mutuellement

### 🔧 Corrections
- Icônes widgets absentes dans l'administration - corrigé
- @Tout le monde s'affichait en noir au lieu de violet - corrigé

---

## v1.37 - 27-08-2026 🏷️ Stable

### ✨ Nouveau
- Photos de profil hébergées sur nos serveurs

---

## v1.36 - 27-08-2026 🏷️ Stable

### ✨ Nouveau
- Application renommée MoaDja, accessible sur moadja.fr
- @toutlemonde disponible pour les administrateurs

### 🔧 Corrections
- Calendrier du cycle réparé
- Statistiques administration corrigées

---

## v1.30 - 26-08-2026 🏷️ Stable

### ✨ Nouveau
- Administration : activité récente, top 5 membres, widgets les plus utilisés

---

## v1.28 - 26-08-2026 🏷️ Stable

### ✨ Nouveau
- Module Santé : IMC, calories, macros calculés depuis le profil
- Plan repas et activités généré chaque jour par l'IA

---

## v1.13 - 25-08-2026

### 🔧 Corrections
- Notifications manquantes sur certains appareils, expéditeur absent, mentions incorrectes, date décalée en soirée, session déconnectée entre visites - tout corrigé

---

## v1.08 - 24-08-2026

### ✨ Nouveau
- Mentions @nom avec suggestions temps réel et clic vers le profil public

---

## v1.06 - 25-08-2026

### ✨ Nouveau
- Cloche notifications avec badge, sections Aujourd'hui / Plus tôt

---

## v1.00 - 24-08-2026 🏷️ Stable

### ✨ Nouveau
- Lancement de MoaDja - Profil, Feed, Planning, Tâches, Rendez-vous, Anniversaires, Cycle, Islam, Prières, Astrologie, Social, Push, Administration - PWA installable
