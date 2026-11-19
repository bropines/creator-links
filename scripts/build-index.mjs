// Builds index.json from data/*.json. The version goes up only when the creators change.
//   node scripts/build-index.mjs           write index.json
//   node scripts/build-index.mjs --check   fail when index.json does not match the data (no write)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { INDEX_FILE, buildCreators } from './lib.mjs';

const check = process.argv.includes('--check');
const creators = buildCreators();
const previous = existsSync(INDEX_FILE) ? JSON.parse(readFileSync(INDEX_FILE, 'utf8')) : null;
const same = previous && JSON.stringify(previous.creators) === JSON.stringify(creators);

if (check) {
  if (!same) {
    console.error('index.json is out of date: run `node scripts/build-index.mjs`.');
    process.exit(1);
  }
  console.log('index.json is up to date.');
} else if (same) {
  console.log(`index.json unchanged (version ${previous.version}, ${Object.keys(creators).length} creators).`);
} else {
  const index = {
    version: (previous?.version ?? 0) + 1,
    updated: new Date().toISOString().slice(0, 10),
    creators,
  };
  writeFileSync(INDEX_FILE, JSON.stringify(index) + '\n');
  console.log(`index.json written: version ${index.version}, ${Object.keys(creators).length} creators.`);
}
