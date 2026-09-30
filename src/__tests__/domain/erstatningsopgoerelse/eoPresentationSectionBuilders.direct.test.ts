import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import {
  buildOevrigeKravModel,
  buildSvieSmerteModel,
  buildTabtArbejdsfortjenesteModel,
} from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationSectionBuilders';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { moneyOre } from '../../../domain/money/money';
import { toISODateString } from '../../../types/branded';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

const buildFixture = () => {
  const initial = createErstatningsopgoerelseInitialValues();
  const values = withSfggIngenForEmployments({
    ...initial,
    beregnesUdFra: 'Angivet månedsløn' as const,
    maanedsloenenUdgoer: asAmountValue(30000),
    kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
    tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-06-30'), loseFeriedage: 0 }],
    loenindkomstAnsaettelsesforhold: [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        loenudviklingBeregningsgrundlag: 'Ingen' as const,
        indtaegtsoplysningerTableData: [],
      },
    ],
    eoAngivetLoenLoenudvikling: {
      ...initial.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Ingen' as const,
    },
  });
  const stamdata = {
    ...STAMDATA_INITIAL_VALUES,
    skadestype: 'Arbejdsulykke' as const,
    skadedato: iso('2024-01-01'),
  };
  const snapshot = computeEoSnapshot({ revision: 'presentation-direct-test', stamdataValues: stamdata, eoValues: values });
  if (!snapshot.data) throw new Error('Forventede beregnet EO-fixture');
  return {
    values,
    data: snapshot.data,
    tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-06-30') }],
  };
};

describe('eoPresentationSectionBuilders – direkte partitioner', () => {
  it.each([
    ['Sygemeldt', 'fortsat sygemeldt', true],
    ['Delvist Sygemeldt', 'fortsat delvist sygemeldt', true],
    ['Raskmeldt', 'blev skadelidte raskmeldt', true],
    ['Raskmeldt', 'var skadelidte raskmeldt', false],
  ] as const)('projekterer helbredsstatus %s på den korrekte datolinje', (status, expected, opgjortFremTilPeriodeTil) => {
    const { values, data } = buildFixture();
    const engine = {
      ...data.engines.svieSmerte,
      constrainedPeriods: [{ fra: iso('2024-01-01'), til: iso('2024-01-31'), isDelvist: false }],
      harPerioder: true,
      satserPerDagOre: moneyOre(100),
      satserMaxOre: moneyOre(1000),
      satserPerDagFoerForligOre: moneyOre(100),
      satserMaxFoerForligOre: moneyOre(1000),
      tidligereOre: moneyOre(10),
      aktuelOre: moneyOre(20),
      delvisFaktor: 0.5 as const,
      opgjortFremTilPeriodeTil,
    };
    const model = buildSvieSmerteModel({
      ...values,
      vedroererPeriodeTil: iso('2024-01-31'),
      svieSmerteHelbredsstatus: status,
      varigeMenAfgorelse: 'Ja',
      menAfgoerelseDato: iso('2024-02-01'),
      verserendeKlageMen: 'Nej',
    }, { engine });

    expect(model.statusLinjer.some((line) => line.includes(expected))).toBe(true);
    expect(model.statusLinjer).toContain('Afgørelsen bringer retten til svie- og smertegodtgørelse til ophør.');
    expect(model.periodeHeading).toBe('Sygeperiode med svie- og smertegodtgørelse');

    const udenMen = buildSvieSmerteModel({
      ...values,
      vedroererPeriodeTil: undefined,
      varigeMenAfgorelse: 'Nej',
      opgørelseLavetDen: iso('2024-07-01'),
    }, { engine });
    expect(udenMen.statusLinjer.some((line) => line.includes('ikke truffet afgørelse om varige mén'))).toBe(true);
  });

  it('viser ikke-beregnelige satser og tolker nul tidligere beløb som ikke angivet', () => {
    const { values, data } = buildFixture();
    const model = buildSvieSmerteModel({
      ...values,
      kravPaaSvieSmerteGodtgoerelse: 'Skjul',
      tidligereSsMax: 'Nej',
      vedroererPeriodeTil: undefined,
    }, {
      engine: {
        ...data.engines.svieSmerte,
        constrainedPeriods: [],
        satserPerDagOre: null,
        satserMaxOre: null,
        satserPerDagFoerForligOre: null,
        satserMaxFoerForligOre: null,
        tidligereOre: moneyOre(0),
        aktuelOre: null,
        maxApplied: false,
        maksimumOpbrugtFoerPerioden: false,
      },
    });

    expect(model.beregnes).toBe(false);
    expect(model.ingenBeloebAarsag).toBe('ikkeRejst');
    expect(model.satserPerDag.status).toBe('not_calculable');
    expect(model.delvisSatsPerDagFoerForlig.status).toBe('not_calculable');
    expect(model.tidligere).toEqual({ status: 'not_calculable', reason: 'Ikke angivet' });
    expect(model.aktuel).toEqual({ status: 'not_calculable', reason: 'Ikke angivet' });
  });

  it('håndterer TAF uden beregning, feriefravær og manglende EET-afgørelse', () => {
    const { values, data, tafRanges } = buildFixture();
    const ingenTaf = buildTabtArbejdsfortjenesteModel({
      ...values,
      kravPaaTabtArbejdsfortjeneste: 'Skjul',
    }, { tafNetto: data.engines.tafNetto, tafRanges: [] });
    expect(ingenTaf.beregnes).toBe(false);
    expect(ingenTaf.skjul).toBe(true);
    expect(ingenTaf.eetLinjer).toEqual([]);

    const ingenEet = buildTabtArbejdsfortjenesteModel({
      ...values,
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      tafPerioder: [],
      opgørelseLavetDen: iso('2024-07-01'),
      endeligtEETAfgorelse: 'Nej',
      midlertidigtEETAfgorelse: 'Nej',
    }, { tafNetto: data.engines.tafNetto, tafRanges: [] });
    expect(ingenEet.eetLinjer.some((line) => line.includes('ikke truffet afgørelse'))).toBe(true);

    const ferieValues: ErstatningsopgoerelseValues = {
      ...values,
      beregnesUdFra: 'Angivet dagsløn',
      maanedsloenenUdgoer: undefined,
      dagsloenenUdgoer: asAmountValue(1000),
      tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: 2 }],
      ferieperioder: [{ id: 'ferie-1', fra: iso('2024-01-08'), til: iso('2024-01-10') }],
    };
    const ferie = buildTabtArbejdsfortjenesteModel(ferieValues, {
      tafNetto: { ...data.engines.tafNetto, tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE },
      tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }],
    });
    expect(ferie.ferieFravaerLinje).toContain('I perioden blev der afholdt');
    expect(ferie.tafPerioderLinjer).toEqual([
      `${'01-01-2024'} - ${'31-01-2024'}`,
    ]);

    const ferieOgIngenLoese = buildTabtArbejdsfortjenesteModel({
      ...ferieValues,
      tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: 0 }],
    }, {
      tafNetto: { ...data.engines.tafNetto, tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE },
      tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }],
    });
    expect(ferieOgIngenLoese.ferieFravaerLinje).toBe('I perioden blev der afholdt ferie 08-01-2024 - 10-01-2024.');

    const kunLoese = buildTabtArbejdsfortjenesteModel({
      ...ferieValues,
      ferieperioder: [],
    }, {
      tafNetto: { ...data.engines.tafNetto, tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE },
      tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }],
    });
    expect(kunLoese.ferieFravaerLinje).toContain('løse ferie-/feriefridage');

    const ingenFerie = buildTabtArbejdsfortjenesteModel({
      ...ferieValues,
      ferieperioder: [],
      tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: 0 }],
    }, {
      tafNetto: { ...data.engines.tafNetto, tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE },
      tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }],
    });
    expect(ingenFerie.ferieFravaerLinje).toBeNull();
    expect(tafRanges).toHaveLength(1);
  });

  it('projekterer øvrige krav med valgfri dato, springer tom beskrivelse over og lukker ugyldigt beløb', () => {
    const valid = buildOevrigeKravModel({
      kravPaaOevrigeErstatningskrav: 'Ja',
      oevrigeKravPerioder: [
        { id: 'empty', dato: iso('2024-01-01'), udgiftTil: '', beloeb: asAmountValue(100) },
        { id: 'dated', dato: iso('2024-01-02'), udgiftTil: 'Behandling', beloeb: asAmountValue(100.5) },
        { id: 'undated', dato: undefined, udgiftTil: 'Transport', beloeb: asAmountValue(50) },
      ],
    });
    expect(valid.entries).toHaveLength(2);
    expect(valid.entries[0]?.dateText).toBe('02-01-2024');
    expect(valid.entries[1]?.dateText).toBe('');
    expect(valid.totalFoerForligOre).toBe(25050);

    const invalid = buildOevrigeKravModel({
      kravPaaOevrigeErstatningskrav: 'Ja',
      oevrigeKravPerioder: [
        { id: 'invalid', dato: undefined, udgiftTil: 'Ugyldigt', beloeb: asAmountValue(-1) },
      ],
    });
    expect(invalid.entries).toEqual([]);
    expect(invalid.totalFoerForligOre).toBe(0);

    expect(buildOevrigeKravModel({
      kravPaaOevrigeErstatningskrav: 'Nej',
      oevrigeKravPerioder: [],
    })).toEqual({ beregnes: false, skjul: false, entries: [], totalFoerForligOre: 0 });
  });
});
