// Validates data/*.json: schema, allowed services and sites, sorted keys and links, no duplicates,
// tag text charset, canonical formatting. Exit code 1 with a list of problems.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CREATOR_ID, DATA_DIR, SERVICES, checkCreator, compare, compareLinks, dataFiles, normalizeCreators, stringify } from './lib.mjs';

const problems = [];
for (const file of dataFiles()) {
  const service = file.replace(/\.json$/, '');
  if (!SERVICES.includes(service)) {
    problems.push(`data/${file}: "${service}" is not an allowed service (${SERVICES.join(', ')})`);
    continue;
  }
  const text = readFileSync(join(DATA_DIR, file), 'utf8');
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    problems.push(`data/${file}: invalid JSON (${error.message})`);
    continue;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    problems.push(`data/${file}: must be an object keyed by creator id`);
    continue;
  }
  const ids = Object.keys(data);
  if (ids.join('\n') !== [...ids].sort(compare).join('\n')) problems.push(`data/${file}: creator ids are not sorted`);
  let clean = true;
  for (const id of ids) {
    if (!CREATOR_ID.test(id)) {
      problems.push(`data/${file}: bad creator id "${id.slice(0, 40)}"`);
      clean = false;
      continue;
    }
    const found = checkCreator(`${service}:${id}`, data[id]);
    if (found.length) clean = false;
    problems.push(...found);
    const links = data[id]?.links;
    if (!found.length && links.some((l, i) => i && compareLinks(links[i - 1], l) > 0)) {
      problems.push(`${service}:${id}: links are not sorted by site, type, value`);
      clean = false;
    }
  }
  if (clean && text !== stringify(normalizeCreators(data)) && ids.join('\n') === [...ids].sort(compare).join('\n')) {
    problems.push(`data/${file}: not in canonical form (2-space JSON, field order site/type/value/confirmations/added, trailing newline)`);
  }
}

if (problems.length) {
  console.error(problems.map((p) => `- ${p}`).join('\n'));
  console.error(`\n${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`OK: ${dataFiles().length} data file(s) valid.`);
