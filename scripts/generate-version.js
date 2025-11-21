#!/usr/bin/env node

/**
 * Automatisk versionsgenerator
 * Format: YYYY.MM.BUILD
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const VERSION_FILE = path.join(__dirname, "../src/config/version.js");
const README_FILE = path.join(__dirname, "../README.md");
const FALLBACK_VERSION = "0.0.0-dev";

/** Hjælpefunktion til sikre git-kald */
function run(command) {
  try {
    return execSync(command, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

/** Generér version baseret på git */
function generateVersion() {
  // Er vi i et git repo?
  if (!run("git rev-parse --is-inside-work-tree")) {
    console.warn("⚠️ Ikke i et git repository. Bruger fallback-version.");
    return FALLBACK_VERSION;
  }

  // Har vi overhovedet commits?
  const hasCommits = run("git rev-parse HEAD");
  if (!hasCommits) {
    console.warn("⚠️ Ingen commits endnu. Bruger fallback-version.");
    return FALLBACK_VERSION;
  }

  // Et samlet kald for performance
  const commitDate = run("git log -1 --format=%cd --date=format:%Y.%m");
  const commitCount = run("git rev-list --count HEAD");

  if (!commitDate || !commitCount) {
    console.warn("⚠️ Kunne ikke hente git metadata. Bruger fallback-version.");
    return FALLBACK_VERSION;
  }

  const buildNumber = parseInt(commitCount, 10) + 1;
  return `${commitDate}.${buildNumber}`;
}

/** Opdater version.js */
function updateVersionFile(version) {
  const buildDate = new Date().toISOString();

  const content = `/**
 * Version Configuration (autogenereret)
 *
 * Redigér IKKE filen manuelt.
 * Format: YYYY.MM.BUILD
 */

export const VERSION = '${version}';
export const BUILD_DATE = '${buildDate}';

/**
 * Filformat version - ændres kun hvis datastrukturen ændres.
 * Bruges til at validere kompatibilitet mellem forskellige versioner af programmet.
 */
export const FILE_FORMAT_VERSION = '1.0.0';

/**
 * Maksimum filstørrelse for .eo filer (1 MB).
 * Beskytter mod memory-problemer ved indlæsning af store filer.
 * .eo filer indeholder kun tekstdata og forventes at være < 100 KB.
 */
export const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB i bytes
`;

  try {
    fs.writeFileSync(VERSION_FILE, content, "utf8");
    console.log(`✅ Version updated to: ${version}`);
  } catch (err) {
    console.error("❌ Kunne ikke skrive til version.js:", err.message);
    process.exit(1);
  }
}

/** Opdater README.md med ny version */
function updateReadme(version) {
  try {
    let content = fs.readFileSync(README_FILE, "utf8");

    // Find og erstat version-linjen
    content = content.replace(
      /\*\*Version\*\*: .+/,
      `**Version**: ${version}`
    );

    fs.writeFileSync(README_FILE, content, "utf8");
    console.log(`✅ README.md updated with version: ${version}`);
  } catch (err) {
    console.warn(`⚠️ Kunne ikke opdatere README.md: ${err.message}`);
    // Vi fortsætter selv hvis README-opdatering fejler
  }
}

// Programflow
const version = generateVersion();
updateVersionFile(version);
updateReadme(version);
