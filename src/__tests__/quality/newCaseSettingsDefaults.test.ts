import { createProductionNewCaseSeed } from '../../domain/newCaseSeed';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { createNewCaseInput } from '../../inputCore/runtime/newCaseInput';
import {
  DEFAULT_APP_SETTINGS,
  NEW_CASE_DEFAULT_SETTINGS_KEYS,
  appSettingsSchema,
  type AppSettings,
  type NewCaseDefaultSettingKey,
} from '../../settings/appSettingsSchema';
import { deepEqual } from '../../utils/deepEqual';

/**
 * VÆRN: en indstilling, der lover brugeren en standardværdi, SKAL ændre noget.
 *
 * Fejlklassen er tavs af natur. Indstillingssiden viste "Udkast-stempel på nye dokumenter", brugeren slog den
 * til, og hver ny sag startede alligevel på schemaets 'Nej' – uden fejl, uden advarsel, uden noget at lægge
 * mærke til før PDF'en manglede sit vandmærke. Årsagen var, at den levende sag ikke læste AppSettings; kun en
 * new-case-fabrik uden produktionskaldere gjorde.
 *
 * Testen måler derfor virkningen, ikke koblingen: for hver erklæret ny-sags-indstilling ændres værdien, og
 * enten den nye sags indhold ELLER en nytilføjet rækkes indhold skal blive et andet. Hvor virkningen sker, er
 * indstillingens eget anliggende – at den udebliver helt, er fejlen.
 */

const catalog = getProductionInputCatalog();

const withSetting = <K extends NewCaseDefaultSettingKey>(key: K, value: AppSettings[K]): AppSettings =>
  appSettingsSchema.parse({ ...DEFAULT_APP_SETTINGS, [key]: value });

/**
 * En værdi forskellig fra defaulten for hver erklæret ny-sags-indstilling.
 *
 * `satisfies` gør listen udtømmende: en ny nøgle i `NEW_CASE_DEFAULT_SETTINGS_KEYS` uden en alternativ værdi
 * her er en compilerfejl, ikke et hul, testen tier om.
 */
const ALTERNATIVE_VALUE = {
  erstatningsopgoerelseAfsluttesMed: 'Underskrift-linje',
  defaultLoenIndtastesSom: 'uge',
  defaultFuldLoenUnderFerie: false,
  defaultLoenPaaHelligdage: 'Ingen',
  defaultOverenskomstLoenmodtager: 'FOA',
  defaultOverenskomstArbejdsgiver: 'KL',
  defaultSvieSmerteDelvisSygemeldingSats: 'fuld',
  defaultIndsaetUdkastStempel: false,
  defaultVisBilagsnumre: true,
} as const satisfies { [K in NewCaseDefaultSettingKey]: AppSettings[K] };

const newCaseSections = (settings: AppSettings): unknown =>
  createNewCaseInput(catalog, createProductionNewCaseSeed(settings)).sections;

/** Rækkefabrikkens output uden dets tilfældige id, så kun de settings-afledte felter sammenlignes. */
const newEmploymentRow = (settings: AppSettings): unknown => {
  const { id: _id, ...rest } = createDefaultLoenindkomstAnsaettelsesforhold(settings);
  return rest;
};

const affectsNewCase = (key: NewCaseDefaultSettingKey): boolean =>
  !deepEqual(newCaseSections(DEFAULT_APP_SETTINGS), newCaseSections(withSetting(key, ALTERNATIVE_VALUE[key])));

const affectsNewRow = (key: NewCaseDefaultSettingKey): boolean =>
  !deepEqual(newEmploymentRow(DEFAULT_APP_SETTINGS), newEmploymentRow(withSetting(key, ALTERNATIVE_VALUE[key])));

describe('ny-sags-indstillinger: hver erklæret standardværdi slår igennem et sted', () => {
  it.each(NEW_CASE_DEFAULT_SETTINGS_KEYS)('%s', (key) => {
    expect(
      affectsNewCase(key) || affectsNewRow(key),
      `Indstillingen '${key}' ændrer hverken den nye sag eller en nytilføjet række. Enten skal den kobles på `
      + 'ny-sags-seeden/rækkefabrikken, eller også skal den ud af NEW_CASE_DEFAULT_SETTINGS_KEYS.'
    ).toBe(true);
  });

  it('ingen `default*`-indstilling slipper udenom listen uden at være erklæret uden for sagsdata', () => {
    // Bevidst uden for kategori 2: en ren UI-præference om startside, og en device-lokal filplacering.
    const IKKE_SAGSDATA = ['defaultStartsideErStamdata', 'defaultDirectoryHandleId'];

    const uerklaerede = Object.keys(DEFAULT_APP_SETTINGS)
      .filter((key) => key.startsWith('default'))
      .filter((key) => !(NEW_CASE_DEFAULT_SETTINGS_KEYS as readonly string[]).includes(key))
      .filter((key) => !IKKE_SAGSDATA.includes(key))
      .sort();

    expect(
      uerklaerede,
      'Nye `default*`-indstillinger skal enten optages i NEW_CASE_DEFAULT_SETTINGS_KEYS eller erklæres '
      + 'eksplicit som ikke-sagsdata.'
    ).toEqual([]);
  });

  it('måler faktisk noget (ikke grøn af tomhed)', () => {
    expect(NEW_CASE_DEFAULT_SETTINGS_KEYS.length).toBeGreaterThan(5);
    // Begge virkningskanaler skal være i brug – ellers kunne testen bestå med kun én af dem koblet.
    expect(NEW_CASE_DEFAULT_SETTINGS_KEYS.filter(affectsNewCase).length).toBeGreaterThan(0);
    expect(NEW_CASE_DEFAULT_SETTINGS_KEYS.filter(affectsNewRow).length).toBeGreaterThan(0);
  });

  it('en frakoblet indstilling FANGES (mutationstest)', () => {
    // Mutationen rammer måle-mekanismen, ikke testdataene: `themeMode` er beviseligt ikke en ny-sags-default,
    // så begge kanaler skal svare "ingen virkning". Gør de ikke det, måler testen ovenfor ikke virkning.
    const muteret = appSettingsSchema.parse({ ...DEFAULT_APP_SETTINGS, themeMode: 'dark' });
    expect(deepEqual(newCaseSections(DEFAULT_APP_SETTINGS), newCaseSections(muteret))).toBe(true);
    expect(deepEqual(newEmploymentRow(DEFAULT_APP_SETTINGS), newEmploymentRow(muteret))).toBe(true);
  });

  it('AppSettings slår igennem på en NY sag – de fire EO-felter, brugeren møder', () => {
    // Den konkrete regression bag værnet: en bruger, der har vendt alle fire indstillinger, skal se sine egne
    // valg på en ny sag – ikke schemaets.
    const settings = appSettingsSchema.parse({
      ...DEFAULT_APP_SETTINGS,
      defaultIndsaetUdkastStempel: false,
      defaultVisBilagsnumre: true,
      erstatningsopgoerelseAfsluttesMed: 'Underskrift-linje',
      defaultSvieSmerteDelvisSygemeldingSats: 'fuld',
    });
    const sections = createNewCaseInput(catalog, createProductionNewCaseSeed(settings)).sections;
    const eo = (sections as Record<string, unknown>).erstatningsopgoerelse as Record<string, unknown>;

    expect(eo.indsaetUdkastStempel).toBe('Nej');
    expect(eo.visBilagsnumre).toBe('Ja');
    expect(eo.erstatningsopgoerelseAfsluttesMed).toBe('Underskrift-linje');
    expect(eo.svieSmerteDelvisSygemeldingSats).toBe('fuld');
  });
});
