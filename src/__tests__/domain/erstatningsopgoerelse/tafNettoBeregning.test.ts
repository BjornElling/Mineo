import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { computeTafNettoBeregning } from '../../../domain/erstatningsopgoerelse/tafNettoBeregning';
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

describe('computeTafNettoBeregning', () => {
  it('giver SFGG adgang til per-ansættelse reguleringssegmenter ved beregningsperiode', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Beregningsperiode';
    values.periodeTilBeregningFra = iso('2023-12-01');
    values.periodeTilBeregningTil = iso('2023-12-31');
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
      { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2024-02-26'), til: iso('2024-03-05') }] }
    );

    expect(result.loenudvikling?.perAnsaettelse).toHaveLength(1);
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments).toHaveLength(2);
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        fra: iso('2024-02-26'),
        til: iso('2024-02-29'),
        reguleringsindeks: 100,
      })
    );
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments[1]).toEqual(
      expect.objectContaining({
        fra: iso('2024-03-01'),
        til: iso('2024-03-05'),
        reguleringsindeks: 105.08,
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
      { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
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
});
