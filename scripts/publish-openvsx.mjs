#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = pkg.version;
const explicitVsix = process.argv[2];
const vsixName = explicitVsix && explicitVsix.trim() ? explicitVsix.trim() : `sxl-resolver-${version}.vsix`;
const vsixPath = path.resolve(rootDir, vsixName);
const pat = process.env.OVSX_PAT;

if (!pat) {
  console.error('OVSX_PAT is not set. Export token first: export OVSX_PAT="<token>"');
  process.exit(1);
}

if (!fs.existsSync(vsixPath)) {
  console.error(`VSIX file not found: ${vsixPath}`);
  console.error('Run `npm run package:vsix` first or pass explicit file path.');
  process.exit(1);
}

const maxAttempts = Number(process.env.OVSX_PUBLISH_ATTEMPTS ?? 6);
const baseDelayMs = Number(process.env.OVSX_PUBLISH_RETRY_MS ?? 30000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriable(output) {
  return /status\s+(405|429)\b/i.test(output) || /Unknown Error/i.test(output);
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  console.log(`OpenVSX publish: attempt ${attempt}/${maxAttempts}`);
  const args = ['ovsx', 'publish', vsixPath, '-p', pat, '--skip-duplicate'];
  const result = spawnSync('npx', args, {
    cwd: rootDir,
    encoding: 'utf8',
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  if (result.status === 0) {
    process.exit(0);
  }

  const merged = `${stdout}\n${stderr}`;
  if (attempt < maxAttempts && isRetriable(merged)) {
    const delay = baseDelayMs * attempt;
    console.warn(`Transient OpenVSX error detected. Retrying in ${Math.round(delay / 1000)}s...`);
    // eslint-disable-next-line no-await-in-loop
    await sleep(delay);
    continue;
  }

  process.exit(result.status ?? 1);
}

process.exit(1);
