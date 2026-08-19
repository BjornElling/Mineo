import { createProductionNewCaseSeed } from '../../domain/newCaseSeed';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { clearCase, reduceInputCommand, settleField } from '../../inputCore/inputReducer';
import { createNewCaseInput } from '../../inputCore/runtime/newCaseInput';
import { eoNummerField } from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { DEFAULT_APP_SETTINGS, appSettingsSchema } from '../../settings/appSettingsSchema';

/**
 * VÆRN: en ny sag skal se ens ud, uanset HVORDAN den blev født.
 *
 * En sag kan opstå to steder: ved bootstrap af en frisk session, og ved brugerens `Slet alt`. Kun den første
 * havde tidligere en seed, så `Slet alt` ryddede til bar `null` – og de standardværdier, brugeren netop havde
 * fået, forsvandt permanent for resten af sessionen. Ingen fejl, ingen advarsel; blot to forskellige
 * udgangspunkter for det, brugeren opfatter som den samme handling.
 *
 * Sammenligningen sker på den PERSISTEREDE form: bootstrap-sagen er round-trippet gennem envelopen, og det er
 * enhver commit – herunder `Slet alt` – også. Reduceren alene er det ikke, så begge sider normaliseres.
 */

const catalog = getProductionInputCatalog();

const asPersisted = (value: unknown): unknown => JSON.parse(JSON.stringify(value)) as unknown;

const clearedSections = (seed: ReturnType<typeof createProductionNewCaseSeed>): unknown => {
  // Start fra en sag med brugerdata, så `Slet alt` faktisk har noget at kassere.
  const touched = reduceInputCommand(
    createNewCaseInput(catalog, seed),
    settleField(eoNummerField.bind(), '12345'),
    catalog
  ).input;
  return reduceInputCommand(touched, clearCase(seed), catalog).input.sections;
};

describe('ny sag: bootstrap og "Slet alt" giver samme udgangspunkt', () => {
  it('med standardindstillinger', () => {
    const seed = createProductionNewCaseSeed(DEFAULT_APP_SETTINGS);
    expect(asPersisted(clearedSections(seed)))
      .toEqual(asPersisted(createNewCaseInput(catalog, seed).sections));
  });

  it('med brugerens egne standardværdier', () => {
    const seed = createProductionNewCaseSeed(appSettingsSchema.parse({
      ...DEFAULT_APP_SETTINGS,
      defaultIndsaetUdkastStempel: false,
      defaultVisBilagsnumre: true,
      defaultLoenIndtastesSom: 'uge',
    }));
    expect(asPersisted(clearedSections(seed)))
      .toEqual(asPersisted(createNewCaseInput(catalog, seed).sections));
  });

  it('målingen kan skelne en seedet fra en useedet clear (mutationstest)', () => {
    // Mutationen rammer mekanismen: uden seeden rydder `Slet alt` til bar `null`. Er de to udfald ens, måler
    // testene ovenfor ikke, om seeden faktisk når kommandoen.
    const seed = createProductionNewCaseSeed(DEFAULT_APP_SETTINGS);
    expect(asPersisted(clearedSections(seed))).not.toEqual(asPersisted(clearedSections(() => undefined)));
  });

  it('sagen ER ryddet – brugerdata overlever ikke (ikke grøn af tomhed)', () => {
    const seed = createProductionNewCaseSeed(DEFAULT_APP_SETTINGS);
    const eo = (clearedSections(seed) as Record<string, unknown>).erstatningsopgoerelse as Record<string, unknown>;
    expect(eo.eoNummer).toBeUndefined();
    expect(eo.indsaetUdkastStempel).toBe('Ja');
  });
});
