import type { NewCaseSeed, NewCaseSeedSections } from '../../inputCore/newCaseSections';
import { resolveAppSettings } from '../../settings/appSettingsParse';
import { resolveDefaultOverenskomstFilter, type AppSettings } from '../../settings/appSettingsSchema';

// Ny-sags-defaults for `erstatningsopgoerelse` (§1.12/§2.11).
//
// Her – og kun her – står de EO-felter, hvis værdi på en NY sag er noget andet end det persisterede schemas
// default. Der er to grunde til, at et felt hører hjemme her frem for i schemaet:
//
//  1. **Værdien er brugerens.** Programindstillingerne har en kategori "standardværdier til ny sagsdata"
//     (`src/contracts/app-settings.md`). Et schema kan ikke udtrykke dem: schemaet er sagsdata-formen og må
//     ikke afhænge af device-lokale indstillinger.
//  2. **Schemaets default tjener load-tolerance, ikke en ny sag.** `offentligLoenType` er bevidst `undefined`
//     i schemaet, så ældre `.eo`-filer uden feltet kan indlæses; en ny sag skal alligevel starte på
//     "Månedsløn".
//
// Modstykket er lige så vigtigt: dette er IKKE stedet for felter, hvis ny-sags-værdi allerede ER schemaets
// default. De ville blot blive en andenudgave af sandheden, som kunne drifte fra schemaet i tavshed.

/** De EO-felter, en ny sag afviger fra schemaets defaults på. Resten udfylder schemaet. */
export type ErstatningsopgoerelseNewCaseDefaults = NonNullable<NewCaseSeedSections['erstatningsopgoerelse']>;

/**
 * De ny-sags-defaults, både den levende sag og new-case-fabrikken bygger på.
 *
 * `settings` valideres ved grænsefladen til sagsdata, så ugyldige device-lokale indstillinger aldrig kan
 * påvirke en sag. KONTRAKT: må KUN anvendes ved oprettelse af en NY sag – aldrig ved load/merge af en
 * eksisterende, hvor den ville overskrive brugerens egne valg med maskinens indstillinger.
 */
export const resolveErstatningsopgoerelseNewCaseDefaults = (
  settings?: AppSettings
): ErstatningsopgoerelseNewCaseDefaults => {
  const safeSettings = resolveAppSettings(settings);

  return {
    // Sektionens eneste ikke-defaultede felt: en ny sag har ingen ansættelsesforhold.
    loenindkomstAnsaettelsesforhold: [],
    indsaetUdkastStempel: safeSettings.defaultIndsaetUdkastStempel ? 'Ja' : 'Nej',
    erstatningsopgoerelseAfsluttesMed: safeSettings.erstatningsopgoerelseAfsluttesMed,
    svieSmerteDelvisSygemeldingSats: safeSettings.defaultSvieSmerteDelvisSygemeldingSats,
    visBilagsnumre: safeSettings.defaultVisBilagsnumre ? 'Ja' : 'Nej',
    // Bevidst designbeslutning: nye sager starter med øvrige krav skjult, til forskel fra svie/smerte og TAF,
    // der starter på 'Ja'. Lad ikke dette "rette tilbage" for at matche de andre krav – det er tilsigtet.
    // Schema-defaulten 'Ja' gælder kun sanering af ældre persisterede sager, hvor feltet mangler.
    kravPaaOevrigeErstatningskrav: 'Skjul',
    eoAngivetLoenLoenudvikling: {
      loenPaaHelligdage: safeSettings.defaultLoenPaaHelligdage,
      // Schema-defaulten er bevidst `undefined` af hensyn til load-tolerance for ældre `.eo`-filer.
      offentligLoenType: 'Månedsløn',
      overenskomstFilter: resolveDefaultOverenskomstFilter(safeSettings),
    },
  };
};

/** Seeder EO-sektionen på en ny sag. Schemaet udfylder alle øvrige felter med deres egne defaults. */
export const createErstatningsopgoerelseNewCaseSeed = (settings?: AppSettings): NewCaseSeed => () => ({
  erstatningsopgoerelse: resolveErstatningsopgoerelseNewCaseDefaults(settings),
});
