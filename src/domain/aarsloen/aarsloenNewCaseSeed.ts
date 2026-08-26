import type { NewCaseSeed } from '../../inputCore/newCaseSections';
import { resolveAppSettings } from '../../settings/appSettingsParse';
import type { AppSettings, AppSettingsLoenIndtastesSomOption } from '../../settings/appSettingsSchema';
import type { LoenPaaHelligdage } from '../../types/loen';

// Ny-sags-defaults for `aarsloen` (§1.12/§2.11).
//
// **Kriteriet er ikke "kan værdien udtrykkes i schemaet".** Det stod her før og udelod
// `fuldLoenUnderFerie` og `loenPaaHelligdage`, fordi de HAR schema-defaults. Men en schema-default er et
// LOAD-fallback for en gammel `.eo`, hvor feltet helt mangler – ikke en ny sags værdi (se §2a i
// `aarsloen-contract.md`, som gør netop den sondring for `loenperiode`). De to felter slog derfor aldrig
// igennem på Årsløn, selv om indstillingerne hedder ORDRET det samme som sidens felter.
//
// Resultatet var værre end hvis ingen af dem virkede: at «Løn indtastes som» virkede, var netop beviset
// for, at boksen gjaldt siden – og så stod de to andre stille på noget andet. Brugerbeslutning
// 2026-08-26: standardværdier skal slå igennem på nye sager og ved «Slet alt» ALLE de steder i
// programmet, hvor de pågældende felter anvendes. Kriteriet er derfor: har indstillingen et felt her,
// gælder den her.

/** De årsløn-felter, en ny sag tager fra brugerens standardværdier. */
export type AarsloenNewCaseDefaults = Readonly<{
  loenperiode: AppSettingsLoenIndtastesSomOption;
  fuldLoenUnderFerie: boolean;
  loenPaaHelligdage: LoenPaaHelligdage;
}>;

export const resolveAarsloenNewCaseDefaults = (settings?: AppSettings): AarsloenNewCaseDefaults => {
  const resolved = resolveAppSettings(settings);
  return Object.freeze({
    loenperiode: resolved.defaultLoenIndtastesSom,
    fuldLoenUnderFerie: resolved.defaultFuldLoenUnderFerie,
    loenPaaHelligdage: resolved.defaultLoenPaaHelligdage,
  });
};

export const createAarsloenNewCaseSeed = (settings?: AppSettings): NewCaseSeed => () => ({
  aarsloen: {
    // Sektionens eneste ikke-defaultede felt: en ny sag har ingen lønperioderækker.
    tableData: [],
    ...resolveAarsloenNewCaseDefaults(settings),
  },
});
