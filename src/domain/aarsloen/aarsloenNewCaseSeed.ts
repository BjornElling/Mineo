import type { NewCaseSeed } from '../../inputCore/newCaseSections';
import { resolveAppSettings } from '../../settings/appSettingsParse';
import type { AppSettings, AppSettingsLoenIndtastesSomOption } from '../../settings/appSettingsSchema';

// Ny-sags-defaults for `aarsloen` (§1.12/§2.11). Se `erstatningsopgoerelseNewCaseSeed.ts` for kriteriet:
// kun felter, hvis ny-sags-værdi IKKE kan udtrykkes i det persisterede schema.
//
// Årslønssiden har ét sådant felt. "Løn indtastes som" er en programindstilling, og siden har sit eget
// `loenperiode`-felt; new-case-fabrikken har altid erklæret koblingen, men fabrikken kaldes ikke af nogen
// produktionssti, så indstillingen slog i praksis aldrig igennem på en ny sag.

/** De årsløn-felter, en ny sag afviger fra schemaets defaults på. */
export type AarsloenNewCaseDefaults = Readonly<{ loenperiode: AppSettingsLoenIndtastesSomOption }>;

export const resolveAarsloenNewCaseDefaults = (settings?: AppSettings): AarsloenNewCaseDefaults =>
  Object.freeze({ loenperiode: resolveAppSettings(settings).defaultLoenIndtastesSom });

export const createAarsloenNewCaseSeed = (settings?: AppSettings): NewCaseSeed => () => ({
  aarsloen: {
    // Sektionens eneste ikke-defaultede felt: en ny sag har ingen lønperioderækker.
    tableData: [],
    ...resolveAarsloenNewCaseDefaults(settings),
  },
});
