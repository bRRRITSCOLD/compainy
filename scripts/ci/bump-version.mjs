#!/usr/bin/env node
// bump-version.mjs — zero-dep ESM semver bumper for plugin.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const PLUGIN_JSON = join(ROOT, '.claude-plugin/plugin.json');

const bumpType = process.argv[2];
if (!['major', 'minor', 'patch'].includes(bumpType)) {
  console.error(`Usage: bump-version.mjs <major|minor|patch>`);
  process.exit(1);
}

const raw = readFileSync(PLUGIN_JSON, 'utf8');
const data = JSON.parse(raw);

const [major, minor, patch] = data.version.split('.').map(Number);

let newVersion;
if (bumpType === 'major') newVersion = `${major + 1}.0.0`;
else if (bumpType === 'minor') newVersion = `${major}.${minor + 1}.0`;
else newVersion = `${major}.${minor}.${patch + 1}`;

data.version = newVersion;
writeFileSync(PLUGIN_JSON, JSON.stringify(data, null, 2) + '\n');

process.stdout.write(newVersion + '\n');
