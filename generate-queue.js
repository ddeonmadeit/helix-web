#!/usr/bin/env node
/**
 * generate-queue.js — Syncs leads from VPS and writes QUEUE.md for the Claude session.
 *
 * Run this on the other computer before starting a build session.
 * It skips leads that already have a sites/[slug]/ folder in the repo.
 *
 * Usage:
 *   node generate-queue.js            # next 20 leads
 *   node generate-queue.js --count=50 # next 50 leads
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_DIR  = path.resolve(__dirname);
const SITES_DIR = path.join(REPO_DIR, 'sites');
const VPS       = 'root@187.77.184.36';
const SSH_KEY   = '/Users/juna/.ssh/helix_fresh';
const VPS_DB    = '/opt/helix-website-scraper/output/leads-db.json';
const COUNT     = parseInt(process.argv.find(a => a.startsWith('--count='))?.split('=')[1] ?? '20');

function slugify(name, location) {
  return (name + ' ' + (location || ''))
    .toLowerCase()
    .replace(/pty\s*ltd|inc\.?|llc|&\s*co\.?/gi, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Pull latest repo state so slug check is accurate
console.log('Pulling latest repo...');
try { execSync('git pull --ff-only', { cwd: REPO_DIR, stdio: 'pipe' }); } catch {}

// Sync leads from VPS
console.log('Syncing leads from VPS...');
const localDb = path.join(REPO_DIR, 'leads-db.json');
execSync(`scp -i ${SSH_KEY} -o StrictHostKeyChecking=no ${VPS}:${VPS_DB} ${localDb}`);
const leads = JSON.parse(fs.readFileSync(localDb, 'utf8'));
console.log(`Got ${leads.length} leads`);

// Find existing slugs in repo
const builtSlugs = new Set(
  fs.readdirSync(SITES_DIR).filter(s => fs.statSync(path.join(SITES_DIR, s)).isDirectory())
);

// Build queue — skip already-built, skip no-phone
const queue = [];
const seenSlugs = new Set(builtSlugs);
const seenPhones = new Set();

for (const lead of leads) {
  if (queue.length >= COUNT) break;
  if (!lead.phone) continue;

  const phone = lead.phone.replace(/\s/g, '');
  if (seenPhones.has(phone)) continue;

  const slug = slugify(lead.businessName || '', lead.location || '');
  if (!slug || seenSlugs.has(slug)) continue;

  seenPhones.add(phone);
  seenSlugs.add(slug); // prevent duplicate slugs within this batch
  queue.push({ ...lead, phone, slug });
}

if (!queue.length) {
  console.log('No unbuilt leads found — all done!');
  process.exit(0);
}

// Write QUEUE.md
const lines = [
  `# Site Build Queue — ${queue.length} leads`,
  '',
  'Build each site below using the CLAUDE.md workflow. For each one:',
  '- Use the business name, phone, location and industry provided',
  '- Follow the full CLAUDE.md design system',
  '- Commit and push when done',
  '- Move to the next',
  '',
  '---',
  '',
];

queue.forEach((lead, i) => {
  const parts = [`**${lead.businessName}**`];
  if (lead.location) parts.push(lead.location);
  if (lead.category || lead.industry) parts.push(lead.category || lead.industry);
  parts.push(`📞 ${lead.phone}`);
  if (lead.address) parts.push(`📍 ${lead.address}`);
  if (lead.rating) parts.push(`⭐ ${lead.rating}${lead.reviewCount ? ` (${lead.reviewCount} reviews)` : ''}`);

  lines.push(`${i + 1}. ${parts.join(' · ')}`);
});

const queuePath = path.join(REPO_DIR, 'QUEUE.md');
fs.writeFileSync(queuePath, lines.join('\n') + '\n');

console.log(`\nWrote ${queue.length} leads to QUEUE.md`);
console.log('Now tell your Claude session: "build all sites in QUEUE.md one by one"');
