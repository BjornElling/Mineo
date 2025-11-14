#!/usr/bin/env node

/**
 * Version Generator Script
 *
 * Genererer automatisk versionsnummer baseret på git commit history.
 * Format: yyyy.mm.build hvor:
 * - yyyy: År for seneste commit
 * - mm: Måned for seneste commit
 * - build: Totalt antal commits (kontinuerligt stigende)
 *
 * Køres automatisk ved hver commit via git pre-commit hook.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, '../src/config/version.js');
const FALLBACK_VERSION = '0.0.0-dev';

/**
 * Kør git kommando og returner output
 */
function runGitCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Generer versionsnummer fra git
 */
function generateVersion() {
  // Tjek om vi er i et git repository
  const isGitRepo = runGitCommand('git rev-parse --is-inside-work-tree');
  if (!isGitRepo) {
    console.warn('⚠️  Not in a git repository. Using fallback version.');
    return FALLBACK_VERSION;
  }

  // Hent totalt antal commits (build number)
  // Tilføj 1 fordi vi er i pre-commit hook - denne commit er ikke talt endnu
  const currentCount = runGitCommand('git rev-list --count HEAD');
  if (!currentCount) {
    console.warn('⚠️  Could not get commit count. Using fallback version.');
    return FALLBACK_VERSION;
  }
  const buildNumber = parseInt(currentCount) + 1;

  // Hent dato for seneste commit
  const commitDate = runGitCommand('git log -1 --format=%cd --date=format:%Y.%m');
  if (!commitDate) {
    console.warn('⚠️  Could not get commit date. Using fallback version.');
    return FALLBACK_VERSION;
  }

  // Generer version: yyyy.mm.build
  return `${commitDate}.${buildNumber}`;
}

/**
 * Opdater version.js fil
 */
function updateVersionFile(version) {
  const buildDate = new Date().toISOString();

  const content = `/**
 * Version Configuration
 *
 * Dette fil genereres automatisk ved hver commit via git pre-commit hook.
 * Format: yyyy.mm.build hvor build er totalt antal commits.
 *
 * Redigér IKKE denne fil manuelt!
 */

export const VERSION = '${version}';
export const BUILD_DATE = '${buildDate}';
`;

  fs.writeFileSync(VERSION_FILE, content, 'utf8');
  console.log(`✅ Version updated to: ${version}`);
}

// Main execution
try {
  const version = generateVersion();
  updateVersionFile(version);
  process.exit(0);
} catch (error) {
  console.error('❌ Error generating version:', error.message);
  process.exit(1);
}
