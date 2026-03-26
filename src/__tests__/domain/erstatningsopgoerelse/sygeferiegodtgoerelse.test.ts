import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { computeSygeferiegodtgoerelse, findSfggSixMonthWarningEmploymentIds } from '../../../domain/erstatningsopgoerelse/sygeferiegodtgoerelse';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

const createEmployment = (
  patch: Partial<ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]> = {}
): ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number] => ({
  id: patch.id ?? 'af-1',
  navnPaaArbejdssted: patch.navnPaaArbejdssted ?? 'Arbejdssted 1',
  harOverenskomst: patch.harOverenskomst ?? false,
  overenskomstId: patch.overenskomstId,
  overenskomstFilter: patch.overenskomstFilter ?? { loenmodtager: undefined, arbejdsgiver: undefined },
  ansatPaaSkadestidspunktet: patch.ansatPaaSkadestidspunktet ?? true,
  ansaettelsesforholdOphoert: patch.ansaettelsesforholdOphoert ?? false,
  sidsteArbejdsdag: patch.sidsteArbejdsdag,
  feriePct: patch.feriePct,
  fritvalgPct: patch.fritvalgPct,
  shSoPct: patch.shSoPct,
  storeBededagPct: patch.storeBededagPct,
  pensionPct: patch.pensionPct ?? 0,
  loenperiode: patch.loenperiode ?? 'maaned',
  fuldLoenUnderFerie: patch.fuldLoenUnderFerie ?? 'Ja',
  harAnciennitetstillaegEfterSkadesdatoen: patch.harAnciennitetstillaegEfterSkadesdatoen ?? false,
  anciennitetstillaegDato: patch.anciennitetstillaegDato,
  anciennitetstillaegSatsAngivesPer: patch.anciennitetstillaegSatsAngivesPer ?? 'Måned',
  anciennitetstillaegSats: patch.anciennitetstillaegSats,
  loenPaaHelligdage: patch.loenPaaHelligdage ?? 'Almindelig løn',
  saerligFraDatoRegulering: patch.saerligFraDatoRegulering,
  loenudviklingBeregningsgrundlag: patch.loenudviklingBeregningsgrundlag,
  loenudviklingStatistikModel: patch.loenudviklingStatistikModel,
  loenudviklingKRLSatstabel: patch.loenudviklingKRLSatstabel,
  loenudviklingManuelNavn: patch.loenudviklingManuelNavn ?? '',
  loenudviklingManuelTableData: patch.loenudviklingManuelTableData ?? [],
  offentligLoenType: patch.offentligLoenType ?? 'Månedsløn',
  offentligLoenTrin: patch.offentligLoenTrin,
  offentligLoenGruppe: patch.offentligLoenGruppe,
  offentligLoenEkstraGrundloen: patch.offentligLoenEkstraGrundloen,
  indtaegtsoplysningerTableData: patch.indtaegtsoplysningerTableData ?? [],
  ...patch,
});

describe('computeSygeferiegodtgoerelse', () => {
  it('beregner referencesatsen ud fra ferieberettiget løn og kun FP-satsen', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      feriePct: 12.5,
      fritvalgPct: 5,
      shSoPct: 4,
      storeBededagPct: 1,
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      beregnesUdFra: 'Ferieloven',
      manuelDagssats: undefined,
      manuelBeloebIHenholdTil: undefined,
      manuelFoerstEfterSygeloen: 'Nej',
      referenceperiodeFra: iso('2024-01-01'),
      referenceperiodeTil: iso('2024-01-31'),
      referenceperiodeFravaersdageUdenLoen: 0,
      satsvalg: undefined,
      alleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.referenceSats.status).toBe('ok');
    if (result.perAnsaettelsesforhold[0]?.referenceSats.status !== 'ok') {
      throw new Error('ReferenceSats forventedes beregnelig');
    }
    expect(result.perAnsaettelsesforhold[0].referenceSats.value).toBe(5682);
    expect(result.perAnsaettelsesforhold[0].referenceSatsFormula).toEqual({
      ferieberettigetLoenKroner: 10000,
      feriePctDecimal: 0.125,
      feriepengeKroner: 1250,
      divisorDage: 22,
      divisorLabel: 'arbejdsdage',
      hverdage: 23,
      shDage: 1,
      feriedage: 0,
      oevrigeFravaersdage: 0,
    });
  });

  it('fratrækker kun feriepenge af sygeløn efter FP-satsen i SFGG-perioden', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      feriePct: 12.5,
      fritvalgPct: 5,
      shSoPct: 4,
      storeBededagPct: 1,
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      beregnesUdFra: 'Manuelt angivet',
      manuelDagssats: asAmount(100),
      manuelBeloebIHenholdTil: undefined,
      manuelFoerstEfterSygeloen: 'Nej',
      referenceperiodeFra: undefined,
      referenceperiodeTil: undefined,
      referenceperiodeFravaersdageUdenLoen: 0, // 0 svarer til parsed schema-default (ingen fraværsdage uden løn)
      satsvalg: undefined,
      alleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.feriepengekravOre).toBe(10000);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.feriepengeAfSygeloenOre).toBe(5682);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.beregnetSfggoereOre).toBe(4318);
  });

  it('samler SFGG-segmenter på tværs af weekender når satsen er uændret', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold = [createEmployment()];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      beregnesUdFra: 'Manuelt angivet',
      manuelDagssats: asAmount(100),
      manuelBeloebIHenholdTil: undefined,
      manuelFoerstEfterSygeloen: 'Nej',
      referenceperiodeFra: undefined,
      referenceperiodeTil: undefined,
      referenceperiodeFravaersdageUdenLoen: 0, // 0 svarer til parsed schema-default (ingen fraværsdage uden løn)
      satsvalg: undefined,
      alleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-29'), til: iso('2024-02-09') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.fra).toBe(iso('2024-01-29'));
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.til).toBe(iso('2024-02-09'));
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.antalDage).toBe(10);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.feriepengekravOre).toBe(100000);
    expect(result.perAnsaettelsesforhold[0]?.feriepengekravTotalOre).toBe(100000);
    expect(result.perAnsaettelsesforhold[0]?.totalOre).toBe(100000);
  });

  it('udelader den første TAF-dag ved første erstatningsopgørelse fra og med 1. januar 2015', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createEmployment()];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      beregnesUdFra: 'Manuelt angivet',
      manuelDagssats: asAmount(100),
      manuelBeloebIHenholdTil: undefined,
      manuelFoerstEfterSygeloen: 'Nej',
      referenceperiodeFra: undefined,
      referenceperiodeTil: undefined,
      referenceperiodeFravaersdageUdenLoen: 0, // 0 svarer til parsed schema-default (ingen fraværsdage uden løn)
      satsvalg: undefined,
      alleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2025-01-06') },
      tafRanges: [{ fra: iso('2025-01-06'), til: iso('2025-01-10') }],
    });

    expect(result.firstExcludedDate).toBe(iso('2025-01-06'));
    expect(result.totalOre).toBe(40000);
    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.antalDage).toBe(4);
  });

  it('afkorter præ-2015-forløb ved 4 måneder beregnet på kalenderdage når TAF beregnes som måneder', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment()];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      beregnesUdFra: 'Manuelt angivet',
      manuelDagssats: asAmount(100),
      manuelBeloebIHenholdTil: undefined,
      manuelFoerstEfterSygeloen: 'Nej',
      referenceperiodeFra: undefined,
      referenceperiodeTil: undefined,
      referenceperiodeFravaersdageUdenLoen: 0, // 0 svarer til parsed schema-default (ingen fraværsdage uden løn)
      satsvalg: undefined,
      alleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2014-01-01') },
      tafRanges: [{ fra: iso('2014-01-01'), til: iso('2014-12-31') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.capReachedDate).toBe(iso('2014-04-30'));
    expect(result.perAnsaettelsesforhold[0]?.capRows).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.fra).toBe(iso('2014-01-02'));
    expect(result.perAnsaettelsesforhold[0]?.segments.at(-1)?.til).toBe(iso('2014-04-30'));
  });
});

describe('findSfggSixMonthWarningEmploymentIds', () => {
  it('markerer ansættelsesforhold hvor SFGG fortsætter mere end 6 måneder efter sidste lønindkomst', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      beregnesUdFra: 'Manuelt angivet',
      manuelDagssats: asAmount(100),
      manuelBeloebIHenholdTil: undefined,
      manuelFoerstEfterSygeloen: 'Nej',
      referenceperiodeFra: undefined,
      referenceperiodeTil: undefined,
      referenceperiodeFravaersdageUdenLoen: 0, // 0 svarer til parsed schema-default (ingen fraværsdage uden løn)
      satsvalg: undefined,
      alleredeBetaltBeloeb: undefined,
    }];

    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') };
    const tafRanges = [{ fra: iso('2024-08-01'), til: iso('2024-08-31') }];
    const sfggResult = computeSygeferiegodtgoerelse({ values, stamdata, tafRanges, loenudviklingPerAnsaettelse: new Map() });
    const warningIds = findSfggSixMonthWarningEmploymentIds({
      values,
      result: sfggResult,
    });

    expect(warningIds).toEqual(['af-1']);
  });
});
