// @vitest-environment jsdom
import { collectSammentaellingControlMismatchMessages } from '../../../domain/erstatningsopgoerelse/control/eoControlMismatch';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { persistedErstatningsopgoerelseSchema, type ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import { runEoPage } from '../erstatningsopgoerelse/helpers/eoRuntimePage';
import { createSfggIngenRow } from '../../utils/sfggTestSupport';

const iso = toISODateString;
const scenarios: readonly [string, Partial<ErstatningsopgoerelseValues>][] = [
  ['udgangspunkt', {}],
  ['tom TAF', { tafPerioder: [] }],
  ['delvis TAF', { tafPerioder: [{ id: 'taf', fra: iso('2024-01-01') }] }],
  ['omvendt TAF', { tafPerioder: [{ id: 'taf', fra: iso('2024-02-01'), til: iso('2024-01-01') }] }],
  ['negativ TAF-ferie', { tafPerioder: [{ id: 'taf', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: -2 }] }],
  ['for meget TAF-ferie i én af to perioder', { tafPerioder: [
    { id: 'taf1', fra: iso('2024-01-01'), til: iso('2024-01-05'), loseFeriedage: 100 },
    { id: 'taf2', fra: iso('2024-02-01'), til: iso('2024-02-29') },
  ] }],
  ['tilstødende TAF-perioder med løs ferie', { tafPerioder: [
    { id: 'taf1', fra: iso('2024-01-01'), til: iso('2024-01-15'), loseFeriedage: 2 },
    { id: 'taf2', fra: iso('2024-01-16'), til: iso('2024-01-31'), loseFeriedage: 3 },
  ] }],
  ['overlappende TAF-perioder med løs ferie', { tafPerioder: [
    { id: 'taf1', fra: iso('2024-01-01'), til: iso('2024-01-20'), loseFeriedage: 2 },
    { id: 'taf2', fra: iso('2024-01-15'), til: iso('2024-01-31'), loseFeriedage: 3 },
  ] }],
  ['TAF afkortet af endeligt EET', {
    endeligtEETAfgorelse: 'Ja', endeligEETAfgoerelseDato: iso('2024-01-16'),
    endeligEETVirkningsdato: iso('2024-01-16'), verserendeKlageEet: 'Nej',
    tafPerioder: [{ id: 'taf', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: 2 }],
  }],
  ['tom beregningsperiode', { tafBeregningsperiodeFra: undefined, tafBeregningsperiodeTil: undefined }],
  ['delvis beregningsperiode', { tafBeregningsperiodeTil: undefined }],
  ['omvendt beregningsperiode', { tafBeregningsperiodeFra: iso('2023-12-31'), tafBeregningsperiodeTil: iso('2023-01-01') }],
  ['manglende øvrigt fravær', { oevrigtFravaerUdenLoen: 'Ja', oevrigeFravaersdage: undefined }],
  ['negativt øvrigt fravær', { oevrigtFravaerUdenLoen: 'Ja', oevrigeFravaersdage: -2 }],
  ['for meget øvrigt fravær', { oevrigtFravaerUdenLoen: 'Ja', oevrigeFravaersdage: 1000 }],
  ['negativ løs ferie', { uspecificeredeFerieFridage: -2 }],
  ['for meget løs ferie', { uspecificeredeFerieFridage: 1000 }],
  ['overlappende ferie', { fravaerPerioder: [
    { id: 'ferie1', fra: iso('2023-01-01'), til: iso('2023-01-10') },
    { id: 'ferie2', fra: iso('2023-01-05'), til: iso('2023-01-15') },
  ] }],
  ['delvis sygdom', { svieSmertePerioder: [{ id: 'ss', fra: iso('2024-01-01') }] }],
  ['omvendt sygdom', { svieSmertePerioder: [{ id: 'ss', fra: iso('2024-01-31'), til: iso('2024-01-01'), tilstand: 'sygemeldt' }] }],
  ['overlappende sygdom', { svieSmertePerioder: [
    { id: 'ss1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' },
    { id: 'ss2', fra: iso('2024-01-05'), til: iso('2024-01-15'), tilstand: 'delvist-sygemeldt' },
  ] }],
  ['delvis erstatningsperiode', { vedroererPeriodeTil: undefined }],
  ['omvendt erstatningsperiode', { vedroererPeriodeFra: iso('2024-12-31'), vedroererPeriodeTil: iso('2024-01-01') }],
  ['SFGG uden valgt grundlag', { sfggAnsaettelsesforhold: [{ ...createSfggIngenRow('employment'), sfggBeregningskilde: undefined }] }],
  ['SFGG uden manuel sats', { sfggAnsaettelsesforhold: [{ ...createSfggIngenRow('employment'), sfggBeregningskilde: 'Manuelt angivet' }] }],
  ['SFGG med negativ manuel sats', { sfggAnsaettelsesforhold: [{ ...createSfggIngenRow('employment'), sfggBeregningskilde: 'Manuelt angivet', sfggManuelDagssats: { kind: 'number', value: -100 } }] }],
];

describe.each(['Ja', 'Nej'] as const)('dagkontrollens inputparitet med fuld løn under ferie=%s', (fuldLoenUnderFerie) => {
  it.each(scenarios)('%s', (_name, patch) => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      beregnesUdFra: 'Beregningsperiode',
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: iso('2023-12-31'),
      tafPerioder: [{ id: 'taf', fra: iso('2024-01-01'), til: iso('2024-01-31') }],
      kravPaaSvieSmerteGodtgoerelse: 'Ja',
      tidligereSsMax: 'Nej',
      svieSmerteSatserAar: 2024,
      svieSmertePerioder: [{ id: 'ss', fra: iso('2024-01-01'), til: iso('2024-01-31'), tilstand: 'sygemeldt' }],
      loenindkomstAnsaettelsesforhold: [{
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'employment',
        loenperiode: 'maaned',
        fuldLoenUnderFerie,
        loenPaaHelligdage: 'Almindelig løn',
        indtaegtsoplysningerTableData: [{ id: 'loen', col0_maaned: '1', col1_maaned: '2023', col2: { kind: 'number', value: 1000 } }],
      }],
      sfggAnsaettelsesforhold: [createSfggIngenRow('employment')],
      ...patch,
    };
    const snapshot = computeEoSnapshot({ revision: 'paritet', stamdataValues: STAMDATA_INITIAL_VALUES, eoValues: values });
    expect(snapshot.failClosedReason).toBeUndefined();
    expect(snapshot.inspektionSnapshot).not.toBeNull();
    if (_name === 'udgangspunkt') {
      expect(snapshot.inspektionSnapshot?.sammentaelling.beregningsperiode.beregnetValue).toBeGreaterThan(0);
      expect(snapshot.inspektionSnapshot?.sammentaelling.taf.beregnetValue).toBeGreaterThan(0);
      expect(snapshot.inspektionSnapshot?.sammentaelling.svieSmerteSygedage.beregnetValue).toBe(31);
    }
    expect(collectSammentaellingControlMismatchMessages([
      ...(snapshot.inspektionSnapshot?.sammentaellingTables.basis ?? []),
      ...(snapshot.inspektionSnapshot?.sammentaellingTables.sfgg ?? []),
    ])).toEqual([]);
    // Readeren skal også bevare pariteten efter maskering af røde felter og blokering af deres afhængigheder.
    expect(runEoPage({
      seed: 0,
      stamdata: STAMDATA_INITIAL_VALUES,
      erstatningsopgoerelse: persistedErstatningsopgoerelseSchema.parse(values),
    })).toEqual([]);
  });
});
