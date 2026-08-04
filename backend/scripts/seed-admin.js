'use strict';

/**
 * Creates (or promotes) the first admin account.
 *
 *   cd backend
 *   npm run seed:admin -- --email you@example.com --password 'StrongPass123' --name 'Site Admin'
 */

const readline = require('readline');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const userRepository = require('../src/repositories/user.repository');

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

function prompt(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

    if (hidden) {
      process.stdout.write(question);
      // eslint-disable-next-line no-underscore-dangle
      rl._writeToOutput = () => {};
      rl.question('', (answer) => {
        rl.close();
        process.stdout.write('\n');
        resolve(answer.trim());
      });
      return;
    }

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function validatePassword(password) {
  const problems = [];
  if (password.length < 8) problems.push('at least 8 characters');
  if (!/[a-z]/.test(password)) problems.push('a lowercase letter');
  if (!/[A-Z]/.test(password)) problems.push('an uppercase letter');
  if (!/\d/.test(password)) problems.push('a number');
  return problems;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const rawEmail = args.email || process.env.SEED_ADMIN_EMAIL || (await prompt('Admin email: '));
  const email = String(rawEmail || '').toLowerCase();
  const name = args.name || process.env.SEED_ADMIN_NAME || (await prompt('Admin name: '));
  const password =
    args.password || process.env.SEED_ADMIN_PASSWORD || (await prompt('Admin password: ', { hidden: true }));

  if (!name) throw new Error('An admin name is required (--name)');

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('A valid --email is required');
  }

  const problems = validatePassword(password || '');
  if (problems.length > 0) {
    throw new Error(`Password must contain ${problems.join(', ')}`);
  }

  await connectDatabase();

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    await userRepository.update(existing.id, { name, role: 'admin', isActive: true });
    if (args['reset-password'] || password) {
      await userRepository.updatePassword(existing.id, password);
      console.log(`Password set/reset for ${email}`);
    }
    console.log(`Existing account ${email} updated to admin.`);
  } else {
    await userRepository.create({ name, email, password, role: 'admin', isActive: true });
    console.log(`Admin account created: ${email}`);
  }

  console.log('\nSign in at /admin in the frontend with these credentials.');
}

main()
  .catch((err) => {
    console.error(`\n[seed-admin] ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => {});
    process.exit(process.exitCode || 0);
  });
