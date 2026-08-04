'use strict';

/**
 * Applies the SQL files in backend/migrations/ in filename order.
 *
 *   npm run db:migrate              apply everything pending
 *   npm run db:migrate -- --dry-run show what would run
 *   npm run db:migrate -- --status  list applied vs pending
 *
 * Each file is recorded in `schema_migrations` once applied, so re-running is
 * safe. The DDL itself also uses IF NOT EXISTS, which makes it idempotent even
 * if that table is lost.
 *
 * phpMyAdmin is an equally valid way to apply these — see docs/HOSTINGER.md.
 * This script exists so the same thing can be done from CI or a shell.
 */

const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    status: argv.includes('--status'),
  };
}

/**
 * Splits a file into individual statements.
 *
 * `multipleStatements` is deliberately off on the app pool (it enables stacked
 * SQL injection), so statements are sent one at a time. This splitter is aware
 * of quoted strings and comments so a semicolon inside a string literal does
 * not split a statement in half.
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];
    const prev = sql[i - 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      else continue;
    } else if (inBlockComment) {
      if (char === '*' && next === '/') { inBlockComment = false; i += 1; }
      continue;
    } else if (!inSingle && !inDouble && !inBacktick) {
      if (char === '-' && next === '-') { inLineComment = true; continue; }
      if (char === '/' && next === '*') { inBlockComment = true; i += 1; continue; }
    }

    if (char === "'" && prev !== '\\' && !inDouble && !inBacktick) inSingle = !inSingle;
    else if (char === '"' && prev !== '\\' && !inSingle && !inBacktick) inDouble = !inDouble;
    else if (char === '`' && !inSingle && !inDouble) inBacktick = !inBacktick;

    if (char === ';' && !inSingle && !inDouble && !inBacktick) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }
    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

/** Errors that mean "already done" rather than "broken". */
function isBenign(err) {
  return [
    'ER_TABLE_EXISTS_ERROR',
    'ER_DUP_KEYNAME',
    'ER_DUP_FIELDNAME',
    'ER_EVENT_ALREADY_EXISTS',
  ].includes(err.code);
}

/** Shared hosting frequently withholds these; they are not fatal. */
function isPrivilege(err) {
  return ['ER_SPECIFIC_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_EVENT_DROP_FAILED'].includes(err.code)
    || /access denied/i.test(err.message || '');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 20000,
    multipleStatements: false,
    charset: 'utf8mb4_unicode_ci',
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) NOT NULL,
        applied_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    const [applied] = await connection.query('SELECT filename FROM schema_migrations');
    const done = new Set(applied.map((r) => r.filename));

    if (args.status) {
      console.log('\nMigrations:');
      files.forEach((f) => console.log(`  ${done.has(f) ? '[applied]' : '[pending]'}  ${f}`));
      console.log('');
      return;
    }

    const pending = files.filter((f) => !done.has(f));
    if (pending.length === 0) {
      console.log('Nothing to apply — the schema is up to date.');
      return;
    }

    for (const file of pending) {
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      const statements = splitStatements(sql);

      console.log(`\n${args.dryRun ? '[DRY RUN] ' : ''}${file} — ${statements.length} statement(s)`);

      if (args.dryRun) {
        statements.forEach((s, i) => console.log(`  ${i + 1}. ${s.split('\n')[0].slice(0, 90)}…`));
        continue;
      }

      let ok = 0;
      let skipped = 0;

      for (const statement of statements) {
        const label = statement.replace(/\s+/g, ' ').slice(0, 70);
        try {
          await connection.query(statement);
          ok += 1;
        } catch (err) {
          if (isBenign(err)) {
            skipped += 1;
          } else if (isPrivilege(err) && /CREATE EVENT/i.test(statement)) {
            // Expected on shared hosting; the app sweeps expired tokens itself.
            console.log(`  note   scheduler not permitted — the application will sweep expired tokens instead`);
            skipped += 1;
          } else {
            console.error(`\n  FAILED on: ${label}…`);
            console.error(`  ${err.code}: ${err.message}\n`);
            throw err;
          }
        }
      }

      await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
      console.log(`  applied ${ok}, skipped ${skipped}`);
    }

    console.log('\nSchema is up to date.\n');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(`\n[db-migrate] ${err.message}\n`);
  process.exitCode = 1;
});
