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
      referenceperiodeFravaersdageUdenLoen: undefined,
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
      referenceperiodeFravaersdageUdenLoen: undefined,
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
      referenceperiodeFravaersdageUdenLoen: undefined,
      satsvalg: undefined,
      alleredeBetaltBeloeb: undefined,
    }];

    const warningIds = findSfggSixMonthWarningEmploymentIds({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-08-01'), til: iso('2024-08-31') }],
    });

    expect(warningIds).toEqual(['af-1']);
  });
});
