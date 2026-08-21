/**
 * Gaten for de tre reguleringssats-outputs.
 *
 * To ting pinnes her, begge BRUGERGODKENDT 2026-07-26:
 *
 * 1. **Offentlig-løn-tjekket gælder KUN ved grundlaget `Overenskomst`.** Skjulte felter bevares
 *    bevidst ved grundlagsskift (`loenindkomstStateCleanup.ts`), så et tomt løntrin fra et tidligere
 *    valgt offentligt overenskomst-grundlag må ALDRIG blokere et Statistik-, KRL- eller
 *    KL-dokument, som slet ikke bruger løntrinnet.
 * 2. **Inden for Overenskomst er reglen den strenge:** et løntrin, opslaget ikke kender, blokerer –
 *    på BEGGE scopes. Et sagsniveau, der kun ser efter, at feltet er et tal, er ikke tilstrækkeligt.
 */
import {
  createEvaluationSourceToken,
  createInputEvaluation,
  createInputRevision,
  createSettingsRevision,
  reduceInputCommand,
  settleField,
  type FieldRef,
  type SettledInput,
} from '../../../inputCore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { eoAngivetLoenFields } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { isOffentligOverenskomstId } from '../../../data/overenskomstRates';
import { createDocumentSourceContext } from '../../../document/definition/documentSourceContext';
import { __createTestSourceSettings } from '../../../settings/sourceSettings';
import {
  projectMineoDocumentGateSettings,
  type MineoDocumentGateSettings,
} from '../../../document/definition/mineoDocumentDefinition';
import {
  klLoenaftalerDocumentDefinition,
  reguleringDocumentAction,
  reguleringDocumentDefinition,
  resolveReguleringDocumentOutputId,
} from '../../../domain/erstatningsopgoerelse/reguleringDocumentDefinitions';

const catalog = getProductionInputCatalog();

// Bygges gennem projektoren; gate-settings er nominel. Formatet findes ikke i
// projektionskonteksten, mens brevhovedflaget afgør stamdataafhængigheden. Se `documentGateMatrix.test.ts`.
const GATE_SETTINGS: MineoDocumentGateSettings = projectMineoDocumentGateSettings(__createTestSourceSettings({
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: false,
  allowReguleringMedUdloebMedMaaneder: 0,
}));

const CASE_REQUEST = { scope: 'case' } as const;

const empty = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
    varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

type AnyInputCommand = Parameters<typeof reduceInputCommand>[1];

const dispatch = (input: SettledInput, command: AnyInputCommand): SettledInput => {
  const result = reduceInputCommand(input, command, catalog);
  return result.changed ? result.input : input;
};

const settle = <T>(field: FieldRef<T>, raw: string): AnyInputCommand => settleField(field, raw) as AnyInputCommand;

const contextOf = (input: SettledInput) => {
  const evaluation = createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  });
  return createDocumentSourceContext(evaluation, GATE_SETTINGS);
};

/**
 * Et konkret offentligt overenskomst-id. Listen over offentlige overenskomster er modul-privat i
 * `overenskomstRates.ts`, så id'et navngives her – men testen VERIFICERER mod den offentlige
 * `isOffentligOverenskomstId`, at forudsætningen holder, i stedet for at antage det. Forsvinder
 * id'et fra datagrundlaget, fejler testen med en forklarende besked frem for at blive tavst tom.
 */
const OFFENTLIG_OVERENSKOMST_ID = 'kl-overenskomst';

describe('reguleringssats-gaten – offentlig-løn-tjekket er bundet til grundlaget', () => {
  it('testforudsætning: det valgte id ER en offentlig overenskomst', () => {
    expect(isOffentligOverenskomstId(OFFENTLIG_OVERENSKOMST_ID)).toBe(true);
  });

  /**
   * Den situation reviewet fandt: brugeren vælger Overenskomst + en offentlig overenskomst uden at
   * udfylde løntrin, skifter derefter til KL-lønaftaler. De skjulte felter bevares.
   */
  const offentligUdenLoentrinDerefterKl = (): SettledInput => {
    let input = dispatch(empty(), settle(eoAngivetLoenFields.overenskomstId.bind(), OFFENTLIG_OVERENSKOMST_ID));
    // Ingen løntrin/gruppe udfyldt.
    return dispatch(input, settle(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(), 'KL-lønaftaler'));
  };

  it('KL-lønaftaler kan hentes, selv om et bevaret offentligt overenskomst-valg mangler løntrin', () => {
    const context = contextOf(offentligUdenLoentrinDerefterKl());

    expect(resolveReguleringDocumentOutputId(context, CASE_REQUEST)).toBe('kl-loenaftaler');
    const result = klLoenaftalerDocumentDefinition.project(context, CASE_REQUEST);
    // KL-lønaftaler bruger hverken løntrin eller gruppe; en blokering ville være på et felt, det
    // valgte dokument slet ikke læser.
    expect(result.status).toBe('ready');

    // Samme resolve bruges af livscyklussen efter settle; React har ingen separat outputvælger.
    const action = reguleringDocumentAction.resolve(context, CASE_REQUEST);
    expect(action.status).toBe('ready');
    if (action.status === 'ready') expect(action.document.id).toBe('kl-loenaftaler');
  });

  it('Statistik blokeres heller ikke af det bevarede offentlige overenskomst-valg', () => {
    let input = dispatch(empty(), settle(eoAngivetLoenFields.overenskomstId.bind(), OFFENTLIG_OVERENSKOMST_ID));
    input = dispatch(input, settle(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(), 'Statistik'));
    const context = contextOf(input);

    const result = reguleringDocumentDefinition.project(context, CASE_REQUEST);
    // Statistik kan stadig blokere af ANDRE grunde (fx manglende model → intet interval), men
    // ALDRIG med offentlig-løn-årsagen.
    if (result.status === 'blocked') {
      expect(result.reasons[0].code).not.toBe('regulering:offentlig-loen-incomplete');
    }
  });

  it('ved grundlaget Overenskomst blokerer et manglende løntrin fortsat', () => {
    let input = dispatch(empty(), settle(eoAngivetLoenFields.overenskomstId.bind(), OFFENTLIG_OVERENSKOMST_ID));
    input = dispatch(input, settle(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(), 'Overenskomst'));
    const context = contextOf(input);

    const result = reguleringDocumentDefinition.project(context, CASE_REQUEST);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons[0].code).toBe('regulering:offentlig-loen-incomplete');
  });

  it('ved Overenskomst blokerer et løntrin UDEN FOR 1..55 – det afvises allerede af feltet', () => {
    // §1.6: bounds-validatoren afviser værdien, så den når aldrig `values`; gaten ser et manglende
    // løntrin. Det er DEN kæde, der beskytter opslaget – ikke `toLoentrin`-kaldet i gaten, som har
    // præcis samme 1..55-grænse og derfor aldrig kan afvise en værdi, der slap forbi feltet.
    let input = dispatch(empty(), settle(eoAngivetLoenFields.overenskomstId.bind(), OFFENTLIG_OVERENSKOMST_ID));
    input = dispatch(input, settle(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(), 'Overenskomst'));
    input = dispatch(input, settle(eoAngivetLoenFields.offentligLoenTrin.bind(), '99'));
    input = dispatch(input, settle(eoAngivetLoenFields.offentligLoenGruppe.bind(), '1'));
    const context = contextOf(input);

    const result = reguleringDocumentDefinition.project(context, CASE_REQUEST);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons[0].code).toBe('regulering:offentlig-loen-incomplete');
  });

  it('et komplet offentligt Overenskomst-valg giver ready', () => {
    let input = dispatch(empty(), settle(eoAngivetLoenFields.overenskomstId.bind(), OFFENTLIG_OVERENSKOMST_ID));
    input = dispatch(input, settle(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(), 'Overenskomst'));
    input = dispatch(input, settle(eoAngivetLoenFields.offentligLoenTrin.bind(), '43'));
    input = dispatch(input, settle(eoAngivetLoenFields.offentligLoenGruppe.bind(), '1'));

    // BASELINE: uden denne case kunne testene ovenfor bestå, blot fordi gaten altid blokerer.
    expect(reguleringDocumentDefinition.project(contextOf(input), CASE_REQUEST).status).toBe('ready');
  });
});
