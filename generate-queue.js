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

const REPO_DIR        = path.resolve(__dirname);
const SITES_DIR       = path.join(REPO_DIR, 'sites');
const VPS             = 'root@187.77.184.36';
const SSH_KEY         = '/Users/juna/.ssh/helix_fresh';
const VPS_DB          = '/opt/helix-website-scraper/output/leads-db.json';
const VPS_PIPELINE    = '/opt/helix-sms/data/pipeline.json';
const QUEUED_FILE     = path.join(REPO_DIR, 'queued-phones.json');
const COUNT           = parseInt(process.argv.find(a => a.startsWith('--count='))?.split('=')[1] ?? '20');

function slugify(name, location) {
  return (name + ' ' + (location || ''))
    .toLowerCase()
    .replace(/pty\s*ltd|inc\.?|llc|&\s*co\.?/gi, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Fetch latest from remote (works even with unstaged local changes, unlike git pull)
console.log('Fetching from GitHub...');
try { execSync('git fetch origin', { cwd: REPO_DIR, stdio: 'pipe' }); } catch (e) {
  console.warn('git fetch failed:', e.message);
}

// Sync leads from VPS
console.log('Syncing leads from VPS...');
const localDb = path.join(REPO_DIR, 'leads-db.json');
execSync(`scp -i ${SSH_KEY} -o StrictHostKeyChecking=no ${VPS}:${VPS_DB} ${localDb}`);
const leads = JSON.parse(fs.readFileSync(localDb, 'utf8'));
console.log(`Got ${leads.length} leads`);

// Sync CRM pipeline from VPS — skip anyone already contacted
console.log('Syncing CRM pipeline from VPS...');
const localPipeline = path.join(REPO_DIR, 'pipeline.json');
const pipelinePhones = new Set();
try {
  execSync(`scp -i ${SSH_KEY} -o StrictHostKeyChecking=no ${VPS}:${VPS_PIPELINE} ${localPipeline}`, { stdio: 'pipe' });
  const pipeline = JSON.parse(fs.readFileSync(localPipeline, 'utf8'));
  for (const phone of Object.keys(pipeline)) {
    pipelinePhones.add(phone.replace(/\D/g, '')); // normalise to digits only for comparison
  }
  console.log(`Skipping ${pipelinePhones.size} leads already in CRM pipeline`);
} catch (e) {
  console.warn('Could not sync pipeline.json — proceeding without CRM filter:', e.message);
}

// Get built slugs from REMOTE (accurate even when local pull failed)
const BRANCH = 'claude/one-page-website-designer-vpSDS';
let remoteSlugs = new Set();
try {
  const out = execSync(`git ls-tree -d --name-only origin/${BRANCH} sites/`, { cwd: REPO_DIR, encoding: 'utf8' });
  remoteSlugs = new Set(out.trim().split('\n').filter(Boolean));
  console.log(`Remote has ${remoteSlugs.size} built sites`);
} catch (e) {
  console.warn('Could not read remote slugs:', e.message);
}

// Also include local slugs in case remote fetch failed
const localSlugs = new Set(
  fs.readdirSync(SITES_DIR).filter(s => fs.statSync(path.join(SITES_DIR, s)).isDirectory())
);

const builtSlugs = new Set([...remoteSlugs, ...localSlugs]);

// Load deployed.json — definitive record of every built phone (git-state-independent)
const deployedPhones = new Set();
try {
  const deployed = JSON.parse(fs.readFileSync(path.join(REPO_DIR, 'deployed.json'), 'utf8'));
  for (const data of Object.values(deployed)) {
    if (data.phone) deployedPhones.add(data.phone.replace(/\D/g, ''));
  }
  console.log(`Already deployed: ${deployedPhones.size} phones — skipping these`);
} catch {}

// Load queued-phones.json — phones already queued but not yet built (prevents re-queuing mid-build)
const queuedPhones = new Set();
try {
  const arr = JSON.parse(fs.readFileSync(QUEUED_FILE, 'utf8'));
  for (const p of arr) queuedPhones.add(p);
  console.log(`Already queued (pending build): ${queuedPhones.size} phones — skipping these`);
} catch {}

// Build queue — skip already-built, skip no-phone
const queue = [];
const seenSlugs = new Set(builtSlugs);
const seenPhones = new Set();

for (const lead of leads) {
  if (queue.length >= COUNT) break;
  if (!lead.phone) continue;

  const phone = lead.phone.replace(/\s/g, '');
  if (seenPhones.has(phone)) continue;

  const phoneDigits = phone.replace(/\D/g, '');

  // Skip if already deployed (phone match — git-state-independent)
  if (deployedPhones.has(phoneDigits)) continue;

  // Skip if already queued but not yet built
  if (queuedPhones.has(phoneDigits)) continue;

  // Skip leads already in CRM pipeline (any stage, including not_interested)
  if (pipelinePhones.has(phoneDigits)) continue;

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
  'For each entry below: open the Google Maps link, then run the normal "new website" workflow.',
  'Build, commit and push, then move to the next.',
  '',
  '---',
  '',
];

queue.forEach((lead, i) => {
  // Build a specific Maps search URL from name + location
  const query = encodeURIComponent(`${lead.businessName} ${lead.location || ''}`.trim());
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;

  const meta = [];
  if (lead.category || lead.industry) meta.push(lead.category || lead.industry);
  if (lead.phone) meta.push(`📞 ${lead.phone}`);
  if (lead.address) meta.push(`📍 ${lead.address}`);

  lines.push(`${i + 1}. **${lead.businessName}** · ${lead.location || ''}`);
  if (meta.length) lines.push(`   ${meta.join(' · ')}`);
  lines.push(`   ${mapsUrl}`);
  lines.push('');
});

const queuePath = path.join(REPO_DIR, 'QUEUE.md');
fs.writeFileSync(queuePath, lines.join('\n') + '\n');

// Persist queued phones so next run won't re-queue them before they're built
const allQueued = new Set([...queuedPhones, ...queue.map(l => l.phone.replace(/\D/g, ''))]);
fs.writeFileSync(QUEUED_FILE, JSON.stringify([...allQueued], null, 2));
console.log(`Saved ${allQueued.size} total queued phones to queued-phones.json`);

console.log(`\nWrote ${queue.length} leads to QUEUE.md`);
console.log('Now tell your Claude session: "build all sites in QUEUE.md one by one"');
