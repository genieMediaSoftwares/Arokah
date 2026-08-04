'use strict';

/**
 * One-way migration: Firebase Realtime Database -> MongoDB.
 *
 * Two ways to supply the data:
 *
 *   1. Straight from Firebase (needs a database secret from
 *      Firebase console -> Project settings -> Service accounts -> Database secrets):
 *
 *        FIREBASE_DATABASE_URL=https://<project>-default-rtdb.<region>.firebasedatabase.app
 *        FIREBASE_DATABASE_SECRET=<secret>
 *        npm run migrate:firebase
 *
 *   2. From a JSON export (Firebase console -> Realtime Database -> ... -> Export JSON),
 *      which needs no credentials at all:
 *
 *        npm run migrate:firebase -- --file ./firebase-export.json
 *
 * Useful flags:
 *   --dry-run   Report what would be written without touching MongoDB.
 *   --wipe      Delete existing events/home content first (destructive; asks to confirm).
 *
 * The script is idempotent: every event is matched on its Firebase push key
 * (stored as `legacyId`), so re-running it updates rather than duplicates.
 */

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Event = require('../src/models/Event');
const HomeContent = require('../src/models/HomeContent');

const { SINGLETON_KEY } = HomeContent;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${question} (yes/no) `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

/** Reads the whole RTDB tree over its REST API — no Firebase SDK required. */
async function fetchFromFirebase() {
  const baseUrl = process.env.FIREBASE_DATABASE_URL;
  const secret = process.env.FIREBASE_DATABASE_SECRET;

  if (!baseUrl) {
    throw new Error(
      'Set FIREBASE_DATABASE_URL in backend/.env, or pass --file <export.json> to migrate from a JSON export.'
    );
  }

  const url = new URL('/.json', baseUrl.replace(/\/$/, ''));
  if (secret) url.searchParams.set('auth', secret);

  console.log(`Reading ${url.origin}/.json …`);
  const response = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Firebase responded ${response.status}. ${
        response.status === 401
          ? 'The database rules likely require auth — set FIREBASE_DATABASE_SECRET.'
          : body.slice(0, 300)
      }`
    );
  }

  return response.json();
}

async function readFromFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  console.log(`Reading ${resolved} …`);
  const raw = await fs.readFile(resolved, 'utf8');
  return JSON.parse(raw);
}

const asString = (value) => (value === undefined || value === null ? '' : String(value).trim());

const VALID_STATUSES = new Set(['upcoming', 'live', 'completed', 'cancelled']);
const VALID_CATEGORIES = new Set(['game', 'food', 'music', 'other']);

/**
 * Firebase stored arrays loosely: sometimes a real array, sometimes an object
 * keyed by index, sometimes absent. Normalise all three into an array.
 */
function toArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined);
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean);
  return [];
}

function mapExtras(rawExtras) {
  return toArray(rawExtras)
    .filter((extra) => extra && (extra.name || extra.imageURL))
    .map((extra) => ({
      key: asString(extra.id || extra.key) || crypto.randomUUID(),
      category: VALID_CATEGORIES.has(extra.category) ? extra.category : 'other',
      name: asString(extra.name),
      description: asString(extra.description),
      price: asString(extra.price),
      imageURL: asString(extra.imageURL),
    }));
}

function mapEvent(pushKey, raw) {
  const mainImage = asString(raw.mainImage || raw.imageURL || raw.image);

  // mainImage is required by the schema; skip anything that has none rather
  // than inventing a placeholder.
  if (!asString(raw.title) || !mainImage) {
    return { skip: true, reason: !asString(raw.title) ? 'missing title' : 'missing mainImage' };
  }

  return {
    skip: false,
    doc: {
      legacyId: pushKey,
      title: asString(raw.title).slice(0, 200),
      type: asString(raw.type).slice(0, 100),
      price: asString(raw.price).slice(0, 50),
      phone: asString(raw.phone).slice(0, 20),
      location: asString(raw.location),
      eventDate: asString(raw.eventDate),
      startTime: asString(raw.startTime),
      endTime: asString(raw.endTime),
      startTime12h: asString(raw.startTime12h),
      endTime12h: asString(raw.endTime12h),
      description: asString(raw.description),
      mainImage,
      extras: mapExtras(raw.extras || raw.extraFields),
      status: VALID_STATUSES.has(raw.status) ? raw.status : 'upcoming',
      // Preserve the original timestamps so ordering survives the move.
      createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
    },
  };
}

async function migrateEvents(snapshot, { dryRun }) {
  const events = snapshot?.events;
  if (!events || typeof events !== 'object') {
    console.log('No `events` node found — nothing to migrate.');
    return { created: 0, updated: 0, skipped: 0 };
  }

  const stats = { created: 0, updated: 0, skipped: 0 };

  for (const [pushKey, raw] of Object.entries(events)) {
    if (!raw || typeof raw !== 'object') {
      stats.skipped += 1;
      continue;
    }

    const mapped = mapEvent(pushKey, raw);
    if (mapped.skip) {
      console.log(`  skip  ${pushKey} (${mapped.reason})`);
      stats.skipped += 1;
      continue;
    }

    const existing = await Event.findOne({ legacyId: pushKey });

    if (dryRun) {
      console.log(`  ${existing ? 'would update' : 'would create'}  ${mapped.doc.title}`);
      stats[existing ? 'updated' : 'created'] += 1;
      continue;
    }

    if (existing) {
      Object.assign(existing, mapped.doc);
      await existing.save();
      console.log(`  update  ${mapped.doc.title}`);
      stats.updated += 1;
    } else {
      // `timestamps: true` would overwrite createdAt/updatedAt on a normal
      // create, so bypass it to keep the original Firebase timestamps.
      const doc = new Event(mapped.doc);
      await doc.save({ timestamps: false });
      console.log(`  create  ${mapped.doc.title}`);
      stats.created += 1;
    }
  }

  return stats;
}

async function migrateHomeContent(snapshot, { dryRun }) {
  const content = snapshot?.homePage?.mainContent;
  if (!content || typeof content !== 'object') {
    console.log('No `homePage/mainContent` node found — nothing to migrate.');
    return false;
  }

  const heroSlides = toArray(content.heroSlides).map(asString);
  while (heroSlides.length < 5) heroSlides.push('');

  const payload = {
    key: SINGLETON_KEY,
    heroSlides,
    galleryImages: toArray(content.galleryImages).map(asString).filter(Boolean),
    pricingImage: asString(content.pricingImage),
    promotionImage: asString(content.promotionImage),
    aboutText: asString(content.aboutText),
    extraSections: toArray(content.extraSections)
      .filter((section) => section && (section.label || section.imageURL))
      .map((section) => ({
        key: asString(section.id || section.key) || crypto.randomUUID(),
        label: asString(section.label),
        imageURL: asString(section.imageURL),
      })),
    storySection: {
      title: asString(content.storySection?.title),
      description1: asString(content.storySection?.description1),
      description2: asString(content.storySection?.description2),
      image1: asString(content.storySection?.image1),
      image2: asString(content.storySection?.image2),
    },
  };

  console.log(
    `  hero slides: ${payload.heroSlides.filter(Boolean).length}, ` +
      `gallery: ${payload.galleryImages.length}, portfolio: ${payload.extraSections.length}`
  );

  if (dryRun) {
    console.log('  would upsert homePage/mainContent');
    return true;
  }

  await HomeContent.findOneAndUpdate({ key: SINGLETON_KEY }, { $set: payload }, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
  console.log('  upserted homePage/mainContent');
  return true;
}

function reportUnmigrated(snapshot) {
  const known = new Set(['events', 'homePage']);
  const others = Object.keys(snapshot || {}).filter((key) => !known.has(key));
  if (others.length > 0) {
    console.log(
      `\nNote: these top-level Firebase nodes were found but have no MongoDB target and were NOT migrated:\n  ${others.join(
        ', '
      )}\nAdd a mapping above if any of them still matter.`
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args['dry-run']);

  const snapshot = args.file ? await readFromFile(args.file) : await fetchFromFirebase();
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('The Firebase snapshot is empty or not an object.');
  }

  await connectDatabase();

  if (args.wipe) {
    if (dryRun) {
      console.log('--wipe ignored during a dry run.');
    } else {
      const ok = await confirm('This will DELETE all existing events and home content in MongoDB. Continue?');
      if (!ok) {
        console.log('Aborted.');
        return;
      }
      const removed = await Event.deleteMany({});
      await HomeContent.deleteMany({});
      console.log(`Wiped ${removed.deletedCount} event(s) and the home content document.`);
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Migrating events…`);
  const eventStats = await migrateEvents(snapshot, { dryRun });

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Migrating home page content…`);
  await migrateHomeContent(snapshot, { dryRun });

  reportUnmigrated(snapshot);

  console.log('\n─── Summary ───');
  console.log(`  events created: ${eventStats.created}`);
  console.log(`  events updated: ${eventStats.updated}`);
  console.log(`  events skipped: ${eventStats.skipped}`);
  if (dryRun) console.log('\nDry run — nothing was written. Re-run without --dry-run to apply.');
  console.log('');
}

main()
  .catch((err) => {
    console.error(`\n[migrate-firebase] ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => {});
    process.exit(process.exitCode || 0);
  });
