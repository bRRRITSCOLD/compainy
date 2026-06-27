#!/usr/bin/env node
// validate.mjs — zero-dep ESM plugin validator
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

let failures = 0;

function ok(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); failures++; }

function readJSON(rel) {
  const abs = join(ROOT, rel);
  try {
    const text = readFileSync(abs, 'utf8');
    return JSON.parse(text);
  } catch (e) {
    fail(`${rel}: ${e.message}`);
    return null;
  }
}

function extractFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;
  return lines.slice(1, end).join('\n');
}

function getFrontmatterName(fm) {
  const m = fm.match(/^name:\s*(\S+)/m);
  return m ? m[1] : null;
}

// ── JSON files ───────────────────────────────────────────────────────────────
console.log('\n── JSON files ──');

const plugin = readJSON('.claude-plugin/plugin.json');
if (plugin) {
  ok('.claude-plugin/plugin.json parses');
  if (typeof plugin.name === 'string') ok('plugin.json has name');
  else fail('plugin.json missing string name');
  if (/^\d+\.\d+\.\d+$/.test(plugin.version)) ok(`plugin.json version ${plugin.version} is semver`);
  else fail(`plugin.json version "${plugin.version}" is not semver`);
}

const market = readJSON('.claude-plugin/marketplace.json');
if (market) {
  ok('.claude-plugin/marketplace.json parses');
  const entry = Array.isArray(market.plugins) &&
    market.plugins.find(p => p.name === 'ai' && p.source === './');
  if (entry) ok('marketplace.json plugins[] has ai entry with source "./"');
  else fail('marketplace.json plugins[] missing entry {name:"ai", source:"./"}');
}

const hooks = readJSON('hooks/hooks.json');
if (hooks) ok('hooks/hooks.json parses');

// ── agents/*.md ──────────────────────────────────────────────────────────────
console.log('\n── agents/*.md ──');

const agentDir = join(ROOT, 'agents');
for (const file of readdirSync(agentDir).filter(f => f.endsWith('.md'))) {
  const expected = basename(file, '.md');
  const text = readFileSync(join(agentDir, file), 'utf8');
  const fm = extractFrontmatter(text);
  if (!fm) { fail(`agents/${file}: no YAML frontmatter`); continue; }
  const declared = getFrontmatterName(fm);
  if (declared === expected) ok(`agents/${file} name matches`);
  else fail(`agents/${file}: name "${declared}" ≠ "${expected}"`);
}

// ── skills/*/SKILL.md ────────────────────────────────────────────────────────
console.log('\n── skills/*/SKILL.md ──');

const skillsDir = join(ROOT, 'skills');
for (const dir of readdirSync(skillsDir)) {
  const skillFile = join(skillsDir, dir, 'SKILL.md');
  try {
    const text = readFileSync(skillFile, 'utf8');
    const fm = extractFrontmatter(text);
    if (!fm) { fail(`skills/${dir}/SKILL.md: no YAML frontmatter`); continue; }
    const declared = getFrontmatterName(fm);
    if (declared === dir) ok(`skills/${dir}/SKILL.md name matches`);
    else fail(`skills/${dir}/SKILL.md: name "${declared}" ≠ "${dir}"`);
  } catch (e) {
    fail(`skills/${dir}/SKILL.md: ${e.message}`);
  }
}

// ── summary ──────────────────────────────────────────────────────────────────
console.log('');
if (failures === 0) {
  console.log('✓ all checks passed');
  process.exit(0);
} else {
  console.error(`✗ ${failures} check(s) failed`);
  process.exit(1);
}
