// ============================================================
// routes/sport-traduction-fr.js
// Traductions FR des exercices du catalogue, par catégorie.
// Valeur "null" = doublon masqué (fiche identique conservée
// ailleurs, en priorité celle avec une image).
// Clé absente = exercice non traduit, affiché tel quel.
// ============================================================

const SPORT_TRADUCTION_FR = {

    // ── Cardio ──
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
    'Stationary bike cardio' : { nom: 'Vélo RPM',                  type: 'duree'  },

    // ── Squats (Jambes) ──
    // Squats masqué (doublon de Bodyweight Squat HD), Pistol squats right
    // masqué (doublon de Pistol Squat, fiche avec image).
    'Barbell Hack Squats'                 : { nom: 'Squat hack (barre)',              type: 'series' },
    'Braced Squat'                        : { nom: 'Squat avec appui',                type: 'series' },
    'Dumbbell Goblet Squat'               : { nom: 'Squat gobelet (haltère)',         type: 'series' },
    'Front Squats'                        : { nom: 'Squat avant',                    type: 'series' },
    'Hindu Squats'                        : { nom: 'Squats hindous',                 type: 'series' },
    'Squats on Multipress'                : { nom: 'Squat au multipress',            type: 'series' },
    'Low Box Squat - Wide Stance'         : { nom: 'Squat sur box (jambes écartées)', type: 'series' },
    'Overhead Squat'                      : { nom: 'Squat overhead',                 type: 'series' },
    'Pistol Squat'                        : { nom: 'Squat pistolet',                 type: 'series' },
    'Squat Jumps'                         : { nom: 'Squats sautés',                  type: 'series' },
    'Squats'                              : null,
    'Squat Thrust'                        : { nom: 'Squat thrust',                   type: 'series' },
    'Sumo Squats'                         : { nom: 'Squat sumo',                     type: 'series' },
    'Wall Squat'                          : { nom: 'Squat contre le mur',            type: 'duree'  },
    'Box squat'                           : { nom: 'Squat sur box',                  type: 'series' },
    'Side split squats left'              : { nom: 'Squat écarté latéral (gauche)',  type: 'series' },
    'Side split squats right'             : { nom: 'Squat écarté latéral (droite)',  type: 'series' },
    'Bulgarian split squats left'         : { nom: 'Squat bulgare (gauche)',         type: 'series' },
    'Bulgarian split squats right'        : { nom: 'Squat bulgare (droite)',         type: 'series' },
    'Split squats left'                   : { nom: 'Squat fendu (gauche)',           type: 'series' },
    'Split squats right'                  : { nom: 'Squat fendu (droite)',           type: 'series' },
    'Pistol squats right'                 : null,
    'Side Slides + Squats'                : { nom: 'Glissades latérales + squats',   type: 'series' },
    'Dragon squat'                        : { nom: 'Squat dragon',                   type: 'series' },
    'Prisoner Squat'                      : { nom: 'Squat prisonnier',               type: 'series' },
    'Bodyweight Squat HD'                 : { nom: 'Squat au poids du corps',        type: 'series' },
    'Double Kettlebell Front Squat'       : { nom: 'Squat avant double kettlebell',  type: 'series' },
    'Dumbbell Split Squat'                : { nom: 'Squat fendu (haltères)',         type: 'series' },
    'Cossack squat'                       : { nom: 'Squat cosaque',                 type: 'series' },
    'Hack Squats'                         : { nom: 'Squat hack',                    type: 'series' },
    'Pin Squat'                           : { nom: 'Squat sur pin',                 type: 'series' },
    'Pause Hack Squats'                   : { nom: 'Squat hack avec pause',         type: 'series' },
    'Calf Raise using Hack Squat Machine' : { nom: 'Mollets (machine hack squat)',  type: 'series' },
    'Pendulum Squat'                      : { nom: 'Squat pendulaire',              type: 'series' },

    // ── Gainage / Plank (Abdominaux) ──
    // Front Plank masqué (doublon de Plank, déjà conservé).
    'Plank'                                   : { nom: 'Gainage (Planche)',                  type: 'duree'  },
    'Front Plank'                             : null,
    'Side Plank'                              : { nom: 'Gainage latéral',                    type: 'duree'  },
    'High plank'                              : { nom: 'Gainage haut (bras tendus)',         type: 'duree'  },
    'Side plank right'                        : { nom: 'Gainage latéral (droite)',           type: 'duree'  },
    'Reverse Plank'                           : { nom: 'Gainage inversé',                    type: 'duree'  },
    'Incline Plank With Alternate Floor Touch': { nom: 'Gainage incliné + touchers de sol',  type: 'series' },
    'Single Arm Plank to Row'                 : { nom: 'Gainage + rowing un bras',           type: 'series' },
    'Plank Shoulder Taps'                     : { nom: 'Gainage + touchers épaules',         type: 'series' },
    'Dynamic side plank'                      : { nom: 'Gainage latéral dynamique',          type: 'series' },
    'Plank-to-Elbow Extension'                : { nom: 'Gainage + extension coude',          type: 'series' },
    'Plank with Alternating Leg Lift'         : { nom: 'Gainage + levers de jambe alternés', type: 'series' },
    'Plank Jacks'                             : { nom: 'Gainage jumping jacks',              type: 'series' },
    'Plank Reach'                             : { nom: 'Gainage + extension de bras',        type: 'series' },
    'Cat Plank'                               : { nom: 'Gainage du chat',                    type: 'series' }
};

module.exports = { SPORT_TRADUCTION_FR };
