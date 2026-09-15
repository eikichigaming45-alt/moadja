// ============================================================
// db/pool.js
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

async function initDB() {
    try {

        // ── Extension unaccent — requise pour la recherche insensible aux accents ──
        await pool.query(`CREATE EXTENSION IF NOT EXISTS unaccent;`);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id                   SERIAL PRIMARY KEY,
                username             VARCHAR(50)  UNIQUE NOT NULL,
                password             VARCHAR(255) NOT NULL,
                role                 VARCHAR(20)  NOT NULL,
                must_change_password BOOLEAN      DEFAULT FALSE,
                last_login           TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS profiles (
                id               SERIAL PRIMARY KEY,
                user_id          INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                prenom           VARCHAR(100),
                nom              VARCHAR(100),
                date_naissance   DATE,
                email            VARCHAR(150),
                telephone        VARCHAR(30),
                profession       VARCHAR(150),
                note             TEXT,
                photo            TEXT,
                widgets_visibles TEXT[],
                created_at       TIMESTAMP DEFAULT NOW(),
                updated_at       TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS widget_order (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                ordre      TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS taches (
                id           SERIAL PRIMARY KEY,
                user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
                titre        VARCHAR(255) NOT NULL,
                date         DATE,
                heure        TIME,
                recurrence   VARCHAR(20)  DEFAULT 'none',
                rappel_avant INTEGER      DEFAULT 0,
                faite        BOOLEAN      DEFAULT FALSE,
                created_at   TIMESTAMP    DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS anniversaires (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
                prenom     VARCHAR(100) NOT NULL,
                nom        VARCHAR(100),
                jour       INTEGER NOT NULL,
                mois       INTEGER NOT NULL,
                annee      INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id           SERIAL PRIMARY KEY,
                user_id      INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                subscription TEXT      NOT NULL,
                updated_at   TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_push_sub_user_endpoint
            ON push_subscriptions (user_id, (subscription::json->>'endpoint'));
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS cycles (
                id           SERIAL PRIMARY KEY,
                user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                date_debut   DATE    NOT NULL,
                duree_regles INTEGER DEFAULT 5,
                duree_cycle  INTEGER DEFAULT 28,
                notes        TEXT,
                created_at   TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS cycle_journal (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                date       DATE    NOT NULL,
                humeur     VARCHAR(50),
                symptomes  TEXT,
                notes      TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, date)
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS cycle_mood (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                date       DATE    NOT NULL,
                moods      TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, date)
            );
        `);

        // ── Agenda unifié ─────────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS agenda (
                id             SERIAL PRIMARY KEY,
                user_id        INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                titre          VARCHAR(255) NOT NULL,
                categorie      VARCHAR(100) NOT NULL,
                sous_categorie VARCHAR(100),
                date_debut     DATE         NOT NULL,
                date_fin       DATE,
                heure_debut    TIME,
                heure_fin      TIME,
                lieu           VARCHAR(255),
                notes          TEXT,
                rappel_avant   INTEGER      DEFAULT 0,
                created_at     TIMESTAMP    DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_agenda_user_date
            ON agenda (user_id, date_debut);
        `);

        // ── Catégories personnalisées mémorisées par user ─────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS agenda_categories (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                niveau     VARCHAR(10)  NOT NULL DEFAULT 'sub',
                nom        VARCHAR(100) NOT NULL,
                created_at TIMESTAMP    DEFAULT NOW(),
                UNIQUE(user_id, niveau, nom)
            );
        `);

        // ── Employeurs mémorisés (Travail / Mission) ──────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS agenda_employeurs (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                nom        VARCHAR(255) NOT NULL,
                adresse    VARCHAR(255),
                telephone  VARCHAR(50),
                created_at TIMESTAMP    DEFAULT NOW(),
                UNIQUE(user_id, nom)
            );
        `);

        // ── Migrations ────────────────────────────────────────
        await pool.query(`ALTER TABLE users    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN     DEFAULT FALSE;`);
        await pool.query(`ALTER TABLE users    ADD COLUMN IF NOT EXISTS last_login            TIMESTAMP;`);
        await pool.query(`ALTER TABLE users    ADD COLUMN IF NOT EXISTS created_at            TIMESTAMPTZ DEFAULT NOW();`);
        await pool.query(`ALTER TABLE taches   ADD COLUMN IF NOT EXISTS rappel_avant          INTEGER     DEFAULT 0;`);
        await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS widgets_visibles      TEXT[];`);
        await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signe_zodiaque        VARCHAR(20);`);
        await pool.query(`ALTER TABLE posts         ADD COLUMN IF NOT EXISTS mentions INTEGER[] DEFAULT '{}';`);
        await pool.query(`ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS mentions INTEGER[] DEFAULT '{}';`);

        await pool.query(`
            ALTER TABLE push_subscriptions
            DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_key;
        `);

        // ── Purge agenda > 12 mois ────────────────────────────
        await pool.query(`
            DELETE FROM agenda
            WHERE COALESCE(date_fin, date_debut) < NOW() - INTERVAL '12 months'
        `);

        console.log('[DB] Tables initialisées.');

    } catch (err) {
        console.error('[DB] Erreur initialisation :', err.message);
    }
}

module.exports = { pool, initDB };
