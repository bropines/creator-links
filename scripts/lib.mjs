// Shared rules and helpers. Node 20+, no dependencies.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = join(ROOT, 'data');
export const INDEX_FILE = join(ROOT, 'index.json');

/** Kemono / Coomer / Pawchive service slugs. */
export const SERVICES = [
  'afdian', 'boosty', 'candfans', 'discord', 'dlsite', 'fanbox', 'fansly',
  'fantia', 'gumroad', 'onlyfans', 'patreon', 'subscribestar',
];

/** Target sites a creator can be linked to. `types` empty = no type. */
export const SITES = {
  'e-hentai': { types: ['artist', 'group'], value: /^[\p{Ll}\p{N}][\p{Ll}\p{N} .'&+_-]{0,79}$/u },
  pixiv: { types: [], value: /^[1-9][0-9]{0,11}$/ },
};

export const CREATOR_ID = /^[A-Za-z0-9_.-]{1,64}$/;
export const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Canonical file text: 2-space JSON and a trailing newline. */
export const stringify = (value) => JSON.stringify(value, null, 2) + '\n';

export const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export const linkKey = (l) => [l.site, l.type ?? '', l.value].join('\u0000');
export const compareLinks = (a, b) => compare(linkKey(a), linkKey(b));

export function sortedObject(object) {
  return Object.fromEntries(Object.keys(object).sort(compare).map((k) => [k, object[k]]));
}

/** Puts creators and their links in canonical order, with a fixed field order. */
export function normalizeCreators(creators) {
  const out = {};
  for (const id of Object.keys(creators).sort(compare)) {
    const c = creators[id];
    out[id] = {
      name: c.name,
      links: [...c.links].sort(compareLinks).map((l) => {
        const link = { site: l.site };
        if (l.type !== undefined) link.type = l.type;
        link.value = l.value;
        if (l.confirmations !== undefined) link.confirmations = l.confirmations;
        if (l.added !== undefined) link.added = l.added;
        return link;
      }),
    };
  }
  return out;
}

export const dataFiles = () =>
  existsSync(DATA_DIR) ? readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).sort(compare) : [];

export function readService(service) {
  const file = join(DATA_DIR, `${service}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

export function writeService(service, creators) {
  writeFileSync(join(DATA_DIR, `${service}.json`), stringify(normalizeCreators(creators)));
}

/** Checks one creator record; returns a list of problems. */
export function checkCreator(where, record) {
  const problems = [];
  const bad = (msg) => problems.push(`${where}: ${msg}`);
  if (!record || typeof record !== 'object' || Array.isArray(record)) return [`${where}: not an object`];
  for (const key of Object.keys(record)) if (key !== 'name' && key !== 'links') bad(`unknown field "${key}"`);
  if (typeof record.name !== 'string' || !record.name.trim() || record.name.length > 120 || /[\u0000-\u001f]/.test(record.name)) {
    bad('"name" must be a non-empty single-line string of at most 120 characters');
  }
  if (!Array.isArray(record.links) || !record.links.length) {
    bad('"links" must be a non-empty array');
    return problems;
  }
  const seen = new Set();
  record.links.forEach((link, i) => {
    const at = `${where} link #${i + 1}`;
    if (!link || typeof link !== 'object' || Array.isArray(link)) return problems.push(`${at}: not an object`);
    for (const key of Object.keys(link)) {
      if (!['site', 'type', 'value', 'confirmations', 'added'].includes(key)) problems.push(`${at}: unknown field "${key}"`);
    }
    const site = Object.hasOwn(SITES, link.site) ? SITES[link.site] : null;
    if (!site) return problems.push(`${at}: site is not allowed (${Object.keys(SITES).join(', ')})`);
    if (site.types.length) {
      if (!site.types.includes(link.type)) problems.push(`${at}: type must be one of ${site.types.join(', ')}`);
    } else if (link.type !== undefined) problems.push(`${at}: ${link.site} links have no "type"`);
    if (typeof link.value !== 'string' || !site.value.test(link.value) || / {2}/.test(link.value) || /[ .'&+_-]$/.test(link.value)) {
      problems.push(`${at}: "value" is not valid for ${link.site}`);
    }
    if (link.confirmations !== undefined && !(Number.isInteger(link.confirmations) && link.confirmations >= 1 && link.confirmations <= 9999)) {
      problems.push(`${at}: "confirmations" must be an integer of at least 1`);
    }
    if (link.added !== undefined && !(typeof link.added === 'string' && DATE.test(link.added) && !Number.isNaN(Date.parse(link.added)))) {
      problems.push(`${at}: "added" must be YYYY-MM-DD`);
    }
    const key = linkKey(link);
    if (seen.has(key)) problems.push(`${at}: duplicate of an earlier link`);
    seen.add(key);
  });
  return problems;
}

/** Compact index body built from every data file: "service:id" -> [[site, type, value], ...]. */
export function buildCreators() {
  const creators = {};
  for (const file of dataFiles()) {
    const service = file.replace(/\.json$/, '');
    const data = readService(service);
    for (const id of Object.keys(data)) {
      creators[`${service}:${id}`] = data[id].links
        .slice()
        .sort(compareLinks)
        .map((l) => [l.site, l.type ?? '', l.value]);
    }
  }
  return sortedObject(creators);
}
