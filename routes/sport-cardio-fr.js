// ============================================================
// routes/sport-cardio-fr.js
// Table de correspondance pour la catégorie WGER "Cardio" (id 15) :
// nom anglais WGER (nettoyé, sans le texte entre parenthèses) =>
// nom français retenu + type de suivi (durée ou séries×reps).
// Utilisée uniquement par routes/sport.js, dans GET /wger/exercises,
// quand category.id === 15.
//
// Valeur "null" = exercice volontairement masqué (doublon écarté
// au profit d'une autre fiche WGER désignant la même activité).
// Toute clé absente de cette table = exercice cardio non couvert,
// laissé tel quel par routes/sport.js (aucune traduction inventée).
// ============================================================

const SPORT_CARDIO_FR = {
    'Cycling'                : { nom: 'Cyclisme',                  type: 'duree'  },
    'High Knee Jumps'        : { nom: 'Sauts genoux hauts',        type: 'series' },
    'Jogging'                : { nom: 'Jogging',                   type: 'duree'  },
    'Run'                    : { nom: 'Course à pied',             type: 'duree'  },
    'Run - Interval Training': { nom: 'Course fractionnée',        type: 'duree'  },
    'Run - Treadmill'        : { nom: 'Course sur tapis',          type: 'duree'  },
    'Skipping - Standard'    : { nom: 'Corde à sauter',            type: 'duree'  },
    'Stationary Bike'        : null,
    'Zone 2 Running'         : { nom: 'Course zone 2',             type: 'duree'  },
    'Suspended crossess'     : { nom: 'Croisés suspendus',         type: 'series' },
    'Swimming 50m sprints'   : { nom: 'Natation — sprints 50m',    type: 'duree'  },
    'Elliptical'             : { nom: 'Vélo elliptique',           type: 'duree'  },
    'High knees'             : { nom: 'Montées de genoux',         type: 'series' },
    'Jump rope: basic jumps' : null,
    'Bag training'           : { nom: 'Sac de frappe',             type: 'duree'  },
    'Rowing Machine'         : { nom: 'Rameur',                    type: 'duree'  },
    'Walking'                : { nom: 'Marche',                    type: 'duree'  },
    '3D lunge warmup'        : { nom: 'Échauffement fentes 3D',    type: 'series' },
    'Cycling cardio session' : { nom: 'Séance cardio vélo',        type: 'duree'  },
    'Talons fesses'          : { nom: 'Talons fesses',             type: 'series' },
    'Stationary bike cardio' : { nom: 'Vélo RPM',                  type: 'duree'  }
};

module.exports = { SPORT_CARDIO_FR };
