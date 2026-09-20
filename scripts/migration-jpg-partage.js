// ============================================================
// scripts/migration-jpg-partage.js
// Script ponctuel : régénère un .jpg jumeau (1200x630) pour chaque
// .webp existant dans public/uploads/posts.
// ============================================================

const path  = require('path');
const fs    = require('fs');
const sharp = require('sharp');

const UPLOADS_DIR = path.join(__dirname, '../public/uploads/posts');

async function migrer() {
    if (!fs.existsSync(UPLOADS_DIR)) {
        console.log('Dossier introuvable :', UPLOADS_DIR);
        return;
    }

    const fichiers = fs.readdirSync(UPLOADS_DIR).filter(f => f.toLowerCase().endsWith('.webp'));
    console.log(`${fichiers.length} fichier(s) .webp trouvé(s).`);

    let crees = 0;
    let deja  = 0;
    let echecs = 0;

    for (const fichier of fichiers) {
        const cheminWebp = path.join(UPLOADS_DIR, fichier);
        const nomJpg     = fichier.replace(/\.webp$/i, '.jpg');
        const cheminJpg  = path.join(UPLOADS_DIR, nomJpg);

        if (fs.existsSync(cheminJpg)) {
            deja++;
            continue;
        }

        try {
            await sharp(cheminWebp)
                .resize(1200, 630, { fit: 'cover', position: 'center' })
                .jpeg({ quality: 80 })
                .toFile(cheminJpg);
            crees++;
            console.log(`✓ ${nomJpg} créé (1200x630)`);
        } catch (e) {
            echecs++;
            console.error(`✗ Échec pour ${fichier} :`, e.message);
        }
    }

    console.log('--- Résumé ---');
    console.log(`Créés   : ${crees}`);
    console.log(`Déjà OK : ${deja}`);
    console.log(`Échecs  : ${echecs}`);
}

migrer();
