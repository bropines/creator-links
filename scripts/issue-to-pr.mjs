// Turns an "Add a link" issue form into a change of data/<service>.json.
//
// Input comes from environment variables only (never from the command line or a shell):
//   ISSUE_BODY    the issue body
//   ISSUE_NUMBER  the issue number (digits)
// The issue text is treated as data: every field is matched against a strict pattern, nothing is
// executed, and messages never repeat what the author typed. Output for the workflow goes to
// $GITHUB_OUTPUT (changed, summary) and, on a rejected issue, to the file named by ERROR_FILE.
import { appendFileSync, writeFileSync } from 'node:fs';
import { SERVICES, SITES, checkCreator, readService, writeService } from './lib.mjs';

const HOST = /^(?:[a-z0-9-]+\.)?(?:kemono\.(?:su|cr|party)|coomer\.(?:su|st|party)|pawchive\.(?:pw|st))$/;

class Reject extends Error {}

/** "### Heading\n\nvalue" blocks of a GitHub issue form body. */
function sections(body) {
  const out = {};
  const parts = String(body).replace(/\r/g, '').split(/^### /m).slice(1);
  for (const part of parts) {
    const at = part.indexOf('\n');
    const heading = (at < 0 ? part : part.slice(0, at)).trim().toLowerCase();
    out[heading] = (at < 0 ? '' : part.slice(at + 1)).trim();
  }
  return out;
}

function creatorFrom(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Reject('The creator page URL is not a valid URL.');
  }
  const m = u.protocol === 'https:' && HOST.test(u.hostname) ? /^\/([a-z]+)\/user\/([A-Za-z0-9_.-]{1,64})(?:\/|$)/.exec(u.pathname) : null;
  if (!m || !SERVICES.includes(m[1])) {
    throw new Reject('The creator page URL must look like https://pawchive.pw/<service>/user/<id> (Kemono, Coomer and Pawchive are accepted).');
  }
  return { service: m[1], id: m[2] };
}

function clean(text) {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function parse(body) {
  const s = sections(body);
  const field = (name) => (s[name] && s[name] !== '_No response_' ? s[name] : '');
  const { service, id } = creatorFrom(field('creator page url').split('\n')[0].trim());

  const site = clean(field('site')).toLowerCase();
  if (!Object.hasOwn(SITES, site)) throw new Reject(`The site must be one of: ${Object.keys(SITES).join(', ')}.`);

  let value = clean(field('tag text or id')).toLowerCase();
  let type;
  if (SITES[site].types.length) {
    type = clean(field('link type')).toLowerCase();
    if (!SITES[site].types.includes(type)) throw new Reject(`The link type for ${site} must be one of: ${SITES[site].types.join(', ')}.`);
    value = value.replace(/^(?:artist|group):\s*/, '').replace(/^"(.*?)\$?"$/, '$1').trim();
  } else {
    const pixiv = /(?:pixiv\.net\/(?:en\/)?users\/|member\.php\?id=)(\d+)/.exec(value);
    if (pixiv) value = pixiv[1];
  }

  const name = clean(field('creator name'));
  const evidence = field('evidence url').split('\n')[0].trim();
  if (!/^https:\/\/[^\s`<>()[\]]{4,300}$/.test(evidence)) throw new Reject('The evidence must be a single https:// URL.');

  const link = { site, ...(type ? { type } : {}), value };
  return { service, id, name, link, evidence };
}

function fail(message) {
  const file = process.env.ERROR_FILE;
  if (file) writeFileSync(file, `${message}\n`);
  console.error(message);
  process.exit(1);
}

try {
  if (!/^\d+$/.test(process.env.ISSUE_NUMBER || '')) throw new Reject('Missing issue number.');
  const { service, id, name, link, evidence } = parse(process.env.ISSUE_BODY || '');
  const today = new Date().toISOString().slice(0, 10);

  const creators = readService(service);
  const existing = creators[id];
  const record = existing ?? { name, links: [] };
  const match = record.links.find((l) => l.site === link.site && l.type === link.type && l.value === link.value);
  let action;
  if (match) {
    match.confirmations = (match.confirmations ?? 1) + 1;
    action = 'confirmed an existing link';
  } else {
    record.links.push({ ...link, confirmations: 1, added: today });
    action = 'added a link';
  }
  creators[id] = record;

  const problems = checkCreator(`${service}:${id}`, record);
  if (problems.length) throw new Reject('The submitted values are not valid for this repository (see the rules in the README: lowercase tag text without quotes or "$", numeric Pixiv id, creator name on one line).');

  writeService(service, creators);
  const summary = [
    `Closes #${process.env.ISSUE_NUMBER}`,
    '',
    `Automated change from the add-link issue form: ${action}.`,
    '',
    `- creator: \`${service}:${id}\``,
    `- link: \`${link.site}${link.type ? ` ${link.type}` : ''}: ${link.value}\``,
    `- evidence: \`${evidence}\``,
    '',
    'The submitted text was validated by `scripts/validate.mjs` rules, not executed. A maintainer should check the evidence before merging.',
  ].join('\n');
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    appendFileSync(out, 'changed=true\n');
    appendFileSync(out, `creator=${service}-${id}\n`);
    appendFileSync(out, `title=${action === 'added a link' ? 'Add' : 'Confirm'} ${link.site} link for ${service}:${id}\n`);
  }
  if (process.env.SUMMARY_FILE) writeFileSync(process.env.SUMMARY_FILE, summary);
  console.log(`${action} for ${service}:${id}`);
} catch (error) {
  if (error instanceof Reject) fail(error.message);
  console.error(error);
  fail('The issue could not be processed. A maintainer will take a look.');
}
