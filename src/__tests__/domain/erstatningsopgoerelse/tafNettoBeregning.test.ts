import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import * as indtaegtPerioderModule from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { buildIndkomstSkadestidspunkt } from '../../../domain/erstatningsopgoerelse/engines/indkomstSkadestidspunktBeregning';
import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { computeSygeferiegodtgoerelse } from '../../../domain/erstatningsopgoerelse/engines/sygeferiegodtgoerelse';
import { computeTafNettoBeregning } from '../../../domain/erstatningsopgoerelse/engines/tafNettoBeregning';
import { buildSfggLoenudviklingMap } from '../../../domain/erstatningsopgoerelse/engines/tafNettoBeregning';
import { computeTafBeregningsenhed } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
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
  harAnciennitetstillaegEfterSkadedatoen: patch.harAnciennitetstillaegEfterSkadedatoen ?? false,
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

describe('computeTafNettoBeregning', () => {
  it('giver SFGG adgang til per-ansættelse reguleringssegmenter ved beregningsperiode', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2023-12-01');
    values.tafBeregningsperiodeTil = iso('2023-12-31');
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'industriens-overenskomst',
      feriePct: 16.95,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      indtaegtsoplysningerTableData: [{
        id: 'loen-dec-2023',
        col0_maaned: '12',
        col1_maaned: '2023',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(2666.28),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Overenskomst',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2023-12-01'),
      sfggReferenceperiodeTil: iso('2023-12-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2024-02-26'), til: iso('2024-03-05') }] }
    );

    expect(result.loenudvikling?.perAnsaettelse).toHaveLength(1);
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments).toHaveLength(2);
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        fra: iso('2024-02-26'),
        til: iso('2024-02-29'),
        reguleringsindeks: 100.36,
      })
    );
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments[1]).toEqual(
      expect.objectContaining({
        fra: iso('2024-03-01'),
        til: iso('2024-03-05'),
        reguleringsindeks: 105.46,
      })
    );
  });

  it('holder loenudvikling.perAnsaettelse tom ved globalt angivet loen-grundlag men giver stadig SFGG shared segmenter', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      overenskomstId: 'industriens-overenskomst',
      loenudviklingBeregningsgrundlag: 'Overenskomst',
    };
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      id: 'af-global',
      harOverenskomst: true,
      overenskomstId: 'industriens-overenskomst',
      feriePct: 16.95,
      indtaegtsoplysningerTableData: [{
        id: 'loen-dec-2023',
        col0_maaned: '12',
        col1_maaned: '2023',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(2666.28),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-global',
      sfggBeregningskilde: 'Overenskomst',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2023-12-01'),
      sfggReferenceperiodeTil: iso('2023-12-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2024-02-26'), til: iso('2024-03-05') }] }
    );

    expect(result.loenudvikling?.perAnsaettelse).toEqual([]);
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments).toHaveLength(2);
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments[1]).toEqual(
      expect.objectContaining({
        fra: iso('2024-03-01'),
        til: iso('2024-03-05'),
        reguleringsindeks: 105.34,
      })
    );
  });

  it('genbruger beregningsperiode-indkomsten mellem indkomstskadestidspunkt og loenudvikling', () => {
    const buildIncomeForRangesSpy = vi.spyOn(indtaegtPerioderModule, 'buildIncomeForRanges');
    try {
      const values = createErstatningsopgoerelseInitialValues();
      values.eoNummer = '2';
      values.beregnesUdFra = 'Beregningsperiode';
      values.tafBeregningsperiodeFra = iso('2024-01-01');
      values.tafBeregningsperiodeTil = iso('2024-01-31');
      values.loenindkomstAnsaettelsesforhold = [
        createEmployment({
          id: 'af-1',
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [{
            id: 'loen-jan-2024',
            col0_maaned: '1',
            col1_maaned: '2024',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: asAmount(30000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          }],
        }),
        createEmployment({
          id: 'af-2',
          navnPaaArbejdssted: 'Arbejdssted 2',
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [{
            id: 'loen-jan-2024-af-2',
            col0_maaned: '1',
            col1_maaned: '2024',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: asAmount(15000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          }],
        }),
      ];

      computeTafNettoBeregning(
        values,
        { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-02-01') },
        { tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-29') }] }
      );

      const beregningsperiodeCalls = buildIncomeForRangesSpy.mock.calls.filter(
        ([callValues, ranges]) =>
          callValues === values
          && ranges.length === 1
          && ranges[0]?.fra === iso('2024-01-01')
          && ranges[0]?.til === iso('2024-01-31')
      );
      expect(beregningsperiodeCalls).toHaveLength(1);
    } finally {
      buildIncomeForRangesSpy.mockRestore();
    }
  });

  it('bevarer samme resultat som en ukachet beregning ved flere ansættelsesforhold', () => {
    const values = createErstatningsopgoerelseInitialValues();
    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-02-01') };
    const tafRanges = [{ fra: iso('2024-02-01'), til: iso('2024-02-29') }] as const;

    values.eoNummer = '2';
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2024-01-01');
    values.tafBeregningsperiodeTil = iso('2024-01-31');
    values.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        feriePct: 12.5,
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [{
          id: 'loen-jan-2024-af-1',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmount(30000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        }],
      }),
      createEmployment({
        id: 'af-2',
        navnPaaArbejdssted: 'Arbejdssted 2',
        feriePct: 12.5,
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [{
          id: 'loen-jan-2024-af-2',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmount(15000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        }],
      }),
    ];
    values.sfggAnsaettelsesforhold = values.loenindkomstAnsaettelsesforhold.map((employment) => ({
      ansaettelsesforholdId: employment.id,
      sfggBeregningskilde: 'Ferieloven',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2024-01-01'),
      sfggReferenceperiodeTil: iso('2024-01-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }));

    const result = computeTafNettoBeregning(values, stamdata, { tafRanges });

    const tafBeregningsenhed = computeTafBeregningsenhed(values);
    const expectedIndkomstSkadestidspunkt = buildIndkomstSkadestidspunkt(values, stamdata, tafBeregningsenhed);
    const expectedLoenudvikling = buildLoenudviklingModel(
      values,
      stamdata,
      tafBeregningsenhed,
      expectedIndkomstSkadestidspunkt,
      { tafRanges }
    );
    const expectedSygeferiegodtgoerelse = computeSygeferiegodtgoerelse({
      values,
      stamdata,
      tafRanges,
      loenudviklingPerAnsaettelse: buildSfggLoenudviklingMap(values, expectedLoenudvikling),
    });

    expect(result.indkomstSkadestidspunkt).toEqual(expectedIndkomstSkadestidspunkt);
    expect(result.loenudvikling).toEqual(expectedLoenudvikling);
    expect(result.sygeferiegodtgoerelse).toEqual(expectedSygeferiegodtgoerelse);
  });
});
