import { composeNewCaseSeeds, type NewCaseSeed } from '../inputCore/newCaseSections';
import type { AppSettings } from '../settings/appSettingsSchema';
import { createAarsloenNewCaseSeed } from './aarsloen/aarsloenNewCaseSeed';
import { createErstatningsopgoerelseNewCaseSeed } from './erstatningsopgoerelse/erstatningsopgoerelseNewCaseSeed';
import { seedSatserNewCase } from './satser/satserNewCaseSeed';

// Domænets samlede svar på "hvad indeholder en helt ny sag?" (§1.12/§2.11).
//
// Der er ét sådant svar, og det bruges tre steder: ved bootstrap af en frisk session, ved `Slet alt`, og som
// den baseline `hasAnyData` afgør "har brugeren indtastet noget?" imod. Ville de tre kunne svare forskelligt,
// ville brugeren møde en sag, hvis udgangspunkt afhang af, hvordan den blev født.
//
// `composeNewCaseSeeds` kaster, hvis to slices vil eje samme sektion, så hver sektions ny-sags-værdi har
// præcis én ejer.

/**
 * Bygger produktionens ny-sags-seed ud fra de aktuelle programindstillinger.
 *
 * Seeden EVALUERES først, når sagen faktisk oprettes — ikke her. En session, der står åben over et årsskifte,
 * skal seede det nye år i den næste nye sag.
 */
export const createProductionNewCaseSeed = (settings?: AppSettings): NewCaseSeed => composeNewCaseSeeds(
  seedSatserNewCase,
  createAarsloenNewCaseSeed(settings),
  createErstatningsopgoerelseNewCaseSeed(settings)
);
