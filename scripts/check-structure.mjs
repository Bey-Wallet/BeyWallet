import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const expectedRoutes = [
  '+html.tsx',
  '(modals)/+not-found.tsx',
  '(modals)/_layout.tsx',
  '(modals)/add-mint.tsx',
  '(modals)/backup-seed.tsx',
  '(modals)/contact-details.tsx',
  '(modals)/contact-search.tsx',
  '(modals)/discover-mints.tsx',
  '(modals)/melt.tsx',
  '(modals)/mint-details.tsx',
  '(modals)/mint-profile.tsx',
  '(modals)/mint.tsx',
  '(modals)/nfc-receive.tsx',
  '(modals)/nfc-send.tsx',
  '(modals)/nostr-activity.tsx',
  '(modals)/nostr-profile.tsx',
  '(modals)/nostr-settings.tsx',
  '(modals)/nostr-username.tsx',
  '(modals)/not-found.tsx',
  '(modals)/optimize-wallet.tsx',
  '(modals)/ota-update.tsx',
  '(modals)/proofs.tsx',
  '(modals)/receive.tsx',
  '(modals)/scanner.tsx',
  '(modals)/search.tsx',
  '(modals)/send.tsx',
  '(modals)/swap.tsx',
  '(modals)/token-details.tsx',
  '(modals)/txn-details.tsx',
  '(tabs)/_layout.tsx',
  '(tabs)/contacts.tsx',
  '(tabs)/history.tsx',
  '(tabs)/index.tsx',
  '(tabs)/settings.tsx',
  '_layout.tsx',
].sort();

const legacyPaths = [
  'scratch',
  'src/components',
  'src/context',
  'src/hooks',
  'src/lib',
  'src/screens',
  'src/services/core',
  'src/store',
];

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

const failures = [];
for (const legacyPath of legacyPaths) {
  if (fs.existsSync(path.join(root, legacyPath)))
    failures.push(`legacy path remains: ${legacyPath}`);
}

const routes = walk(path.join(root, 'src', 'app'))
  .filter((file) => /\.(?:ts|tsx)$/.test(file))
  .map((file) => path.relative(path.join(root, 'src', 'app'), file).replaceAll('\\', '/'))
  .sort();
if (JSON.stringify(routes) !== JSON.stringify(expectedRoutes)) {
  failures.push(`Expo route manifest changed:\n${routes.join('\n')}`);
}

const sourceFiles = walk(root).filter(
  (file) =>
    /\.(?:cjs|js|mjs|ts|tsx)$/.test(file) &&
    !file.includes(`${path.sep}node_modules${path.sep}`) &&
    !file.includes(`${path.sep}.git${path.sep}`) &&
    !file.includes(`${path.sep}.tmp${path.sep}`) &&
    !file.includes(`${path.sep}.yarn${path.sep}`),
);
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (/^(?:<<<<<<<|=======|>>>>>>>)/m.test(source)) failures.push(`conflict marker: ${relative}`);
  if (/from\s+['"]@\//.test(source) || /(?:require|import)\(\s*['"]@\//.test(source)) {
    failures.push(`invalid @/ alias: ${relative}`);
  }
  if (/['"]~\/(?:components|context|hooks|lib|screens|store)(?:\/|['"])/.test(source)) {
    failures.push(`legacy import path: ${relative}`);
  }
  if (/['"]~\/services\/core(?:\/|['"])/.test(source)) {
    failures.push(`legacy wallet service path: ${relative}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Structure check passed (${routes.length} Expo routes).`);
