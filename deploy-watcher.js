#!/usr/bin/env node
/**
 * deploy-watcher.js — Watches GitHub for new sites built by the other Claude session,
 * deploys them to VPS, and appends to sms-queue.csv for the Python SMS script.
 *
 * Flow (runs every 5 minutes):
 *   1. git pull — pick up anything the other Claude account just pushed
 *   2. Diff sites/ against deployed.json — find new slugs
 *   3. For each new slug:
 *      a. Read brief.md → extract phone + business name
 *      b. rsync deploy to VPS
 *      c. Remove brief.md + SOURCES.md from VPS
 *      d. Verify 200 OK
 *      e. Append to sms-queue.csv
 *      f. Mark as deployed in deployed.json
 *
 * Usage:
 *   node deploy-watcher.js          # run continuously (polls every 5 min)
 *   node deploy-watcher.js --once   # run one check then exit (good for cron)
 *
 * No env vars required — uses existing SSH key and VPS config.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const fetch = require('node-fetch');

// ── Config ────────────────────────────────────────────────────────────────────
const REPO_DIR      = path.resolve(__dirname);
const SITES_DIR     = path.join(REPO_DIR, 'sites');
const DEPLOYED_FILE  = path.join(REPO_DIR, 'deployed.json');
const SMS_QUEUE      = path.join(REPO_DIR, 'personalised-leads.csv');
const TEMPLATE_FILE  = path.join(REPO_DIR, 'sms-template.txt');
const PIPELINE_FILE  = path.join(REPO_DIR, 'pipeline.json');
const VPS           = 'root@187.77.184.36';
const SSH_KEY       = '/Users/juna/.ssh/helix_fresh';
const VPS_DEPLOY    = '/var/www/buildquote/public';
const VPS_PIPELINE  = '/opt/helix-sms/data/pipeline.json';
const LIVE_BASE     = 'https://helixsolution.au';
const POLL_MS       = 5 * 60 * 1000; // 5 minutes
const ONCE          = process.argv.includes('--once');

// ── Helpers ───────────────────────────────────────────────────────────────────
const log = (msg) => console.log(`[${new Date().toTimeString().slice(0, 8)}] ${msg}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function exec(cmd) {
  return execSync(cmd, { cwd: REPO_DIR, encoding: 'utf8', stdio: 'pipe' });
}

// ── Load / save deployed state ────────────────────────────────────────────────
function loadDeployed() {
  try { return JSON.parse(fs.readFileSync(DEPLOYED_FILE, 'utf8')); }
  catch { return {}; }
}
function saveDeployed(state) {
  fs.writeFileSync(DEPLOYED_FILE, JSON.stringify(state, null, 2));
}

// ── Parse brief.md for phone + business name ──────────────────────────────────
function parseBrief(briefPath) {
  if (!fs.existsSync(briefPath)) return { name: null, phone: null };
  const text = fs.readFileSync(briefPath, 'utf8');

  // Name: first H1
  const nameMatch = text.match(/^#\s+Brief\s+[—-]+\s+(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : null;

  // Phone — handles both: "**Phone:** +61..." and "Phone: **0435...**"
  const phoneMatch = text.match(/phone[^\n+\d]*([+\d][\d\s()\-]{5,18})/i);
  let phone = phoneMatch ? phoneMatch[1].replace(/[^+\d]/g, '') : null;

  // Normalise AU mobile to E.164
  if (phone && phone.startsWith('04') && phone.length === 10) {
    phone = '+61' + phone.slice(1);
  }
  // Sanity check — must be at least 10 digits
  if (phone && phone.replace(/\D/g, '').length < 10) phone = null;

  return { name, phone };
}

// ── Convert phone to 04xx format ─────────────────────────────────────────────
function toAuMobile(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('614')) return '0' + digits.slice(2);   // +614... → 04...
  if (digits.startsWith('61'))  return '0' + digits.slice(2);   // 61...   → 0...
  if (digits.startsWith('04'))  return digits;                   // already 04xx
  return digits;
}

// ── Load CRM pipeline phones (skip already-contacted leads) ──────────────────
function loadPipelinePhones() {
  try {
    execSync(
      `scp -i ${SSH_KEY} -o StrictHostKeyChecking=no ${VPS}:${VPS_PIPELINE} ${PIPELINE_FILE}`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
  } catch {}
  try {
    const data = JSON.parse(fs.readFileSync(PIPELINE_FILE, 'utf8'));
    const phones = new Set(Object.keys(data).map(p => p.replace(/\D/g, '')));
    log(`CRM pipeline: ${phones.size} leads excluded from SMS queue`);
    return phones;
  } catch {
    return new Set();
  }
}

// ── Load SMS template ─────────────────────────────────────────────────────────
function loadTemplate() {
  if (!fs.existsSync(TEMPLATE_FILE)) return null;
  return fs.readFileSync(TEMPLATE_FILE, 'utf8').trim();
}

// ── Append to personalised-leads.csv ─────────────────────────────────────────
function appendToSmsQueue(businessName, phone, url, pipelinePhones) {
  if (!businessName || !phone) return;

  // Skip if this lead is already in the CRM pipeline
  const normalised = phone.replace(/\D/g, '');
  if (pipelinePhones && pipelinePhones.has(normalised)) {
    log(`  ⏭  Skipping SMS (already in CRM pipeline): ${businessName}`);
    return;
  }

  const mobilePhone = toAuMobile(phone);
  const template = loadTemplate();

  // Build message — fill template if available, otherwise skip message column
  const message = template
    ? template.replace(/\{businessName\}/gi, businessName).replace(/\{url\}/gi, url)
    : url;

  const header = 'Phone,Message\n';
  const row = `"${mobilePhone}","${message.replace(/"/g, '""')}"\n`;
  if (!fs.existsSync(SMS_QUEUE)) fs.writeFileSync(SMS_QUEUE, header);
  fs.appendFileSync(SMS_QUEUE, row);
  log(`  📱 SMS queued: ${businessName} → ${mobilePhone}`);
}

// ── Deploy one slug ────────────────────────────────────────────────────────────
async function deploySite(slug, pipelinePhones) {
  const siteDir  = path.join(SITES_DIR, slug);
  const briefPath = path.join(siteDir, 'brief.md');
  const liveUrl  = `${LIVE_BASE}/${slug}/`;

  log(`Deploying: ${slug}`);

  // Read brief before deploying (brief gets removed from VPS but stays in repo)
  const { name, phone } = parseBrief(briefPath);
  if (name) log(`  Business: ${name} | Phone: ${phone || 'not found'}`);

  // rsync to VPS
  execSync(
    `rsync -a --delete -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no" ` +
    `${siteDir}/ ${VPS}:${VPS_DEPLOY}/${slug}/`,
    { encoding: 'utf8' }
  );

  // Clean up files that shouldn't be public
  execSync(
    `ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${VPS} ` +
    `"rm -f ${VPS_DEPLOY}/${slug}/brief.md ` +
    `${VPS_DEPLOY}/${slug}/images/SOURCES.md ` +
    `${VPS_DEPLOY}/${slug}/images/hero-raw.jpg"`,
    { encoding: 'utf8' }
  );

  // Verify live
  const res = await fetch(liveUrl, { method: 'HEAD' });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  log(`  ✓ Live: ${liveUrl}`);

  // Queue SMS (skips if phone is in CRM pipeline)
  appendToSmsQueue(name, phone, liveUrl, pipelinePhones);

  return { name, phone, liveUrl };
}

// ── Main poll loop ─────────────────────────────────────────────────────────────
async function poll() {
  // 1. Pull latest
  log('Pulling from GitHub...');
  try {
    const out = exec('git pull --ff-only 2>&1').trim();
    log(out.split('\n')[0]); // first line only
  } catch (err) {
    log(`git pull failed: ${err.message.split('\n')[0]}`);
    return;
  }

  // 2. Find all site slugs in repo
  const allSlugs = fs.readdirSync(SITES_DIR)
    .filter(s => fs.statSync(path.join(SITES_DIR, s)).isDirectory());

  const deployed = loadDeployed();

  // 3. Find new/updated slugs (in repo but not yet deployed, or has new commit since last deploy)
  const toDeployCommitTimes = {};
  for (const slug of allSlugs) {
    try {
      // Get last commit time for this slug's folder
      const lastCommit = exec(`git log -1 --format="%ct" -- sites/${slug}/`).trim();
      if (!lastCommit) continue;
      const commitTs = parseInt(lastCommit);

      const lastDeployTs = deployed[slug]?.deployedAt
        ? Math.floor(new Date(deployed[slug].deployedAt).getTime() / 1000)
        : 0;

      if (commitTs > lastDeployTs) {
        toDeployCommitTimes[slug] = commitTs;
      }
    } catch {}
  }

  const newSlugs = Object.keys(toDeployCommitTimes);
  if (!newSlugs.length) {
    log('No new sites to deploy.');
    return;
  }

  log(`Found ${newSlugs.length} site(s) to deploy: ${newSlugs.join(', ')}`);

  // Load pipeline phones once per poll so we don't SCP for every site
  const pipelinePhones = loadPipelinePhones();

  let deployed_count = 0, failed_count = 0;
  for (const slug of newSlugs) {
    try {
      const result = await deploySite(slug, pipelinePhones);
      const updatedDeployed = loadDeployed();
      updatedDeployed[slug] = {
        deployedAt: new Date().toISOString(),
        url: result.liveUrl,
        businessName: result.name,
        phone: result.phone,
      };
      saveDeployed(updatedDeployed);
      deployed_count++;
    } catch (err) {
      log(`✗ Failed: ${slug} — ${err.message}`);
      failed_count++;
    }
  }

  log(`Done. Deployed: ${deployed_count} | Failed: ${failed_count}`);
}

// ── Entry point ────────────────────────────────────────────────────────────────
async function main() {
  log('Deploy watcher started');
  log(`Mode: ${ONCE ? 'single run' : `polling every ${POLL_MS / 60000} min`}`);

  if (ONCE) {
    await poll();
    return;
  }

  // Continuous loop
  while (true) {
    try {
      await poll();
    } catch (err) {
      log(`Poll error: ${err.message}`);
    }
    log(`Next check in ${POLL_MS / 60000} min...`);
    await sleep(POLL_MS);
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
