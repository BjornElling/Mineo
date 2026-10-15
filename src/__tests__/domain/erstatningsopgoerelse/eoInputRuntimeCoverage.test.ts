import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type {
  ErstatningsopgoerelseValues,
  OffentligeYdelserRow,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const runtimeReason = (values: ErstatningsopgoerelseValues, revision: string): string | undefined => {
  const snapshot = computeEoSnapshot({
    revision,
    stamdataValues: STAMDATA_INITIAL_VALUES,
    eoValues: values,
  });
  return snapshot.failClosedReason === 'runtime_exception'
    ? snapshot.invariants.find((invariant) => invariant.id === 'eo_snapshot:runtime_exception')?.message
      ?? 'Ukendt runtimefejl'
    : undefined;
};

const withCommonTafInput = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.kravPaaTabtArbejdsfortjeneste = 'Ja';
  values.vedroererPeriodeFra = iso('2024-01-01');
  values.vedroererPeriodeTil = iso('2024-12-31');
  values.opgørelseLavetDen = iso('2024-12-31');
  values.tafBeregningsperiodeFra = iso('2023-01-01');
  values.tafBeregningsperiodeTil = iso('2023-12-31');
  values.tafPerioder = [{
    id: 'taf-1',
    fra: iso('2024-01-01'),
    til: iso('2024-12-31'),
    loseFeriedage: undefined,
  }];
  return values;
};

const publicBenefitRows: readonly OffentligeYdelserRow[] = [
  {
    id: 'ydelse-tom',
    fraDato: undefined,
    tilDato: undefined,
    ydelse: undefined,
    tillaeg: undefined,
    ydelsestype: '',
  },
  {
    id: 'ydelse-kun-fra',
    fraDato: iso('2024-02-01'),
    tilDato: undefined,
    ydelse: amount(1000),
    tillaeg: undefined,
    ydelsestype: 'dagpenge',
  },
  {
    id: 'ydelse-kun-belob',
    fraDato: undefined,
    tilDato: undefined,
    ydelse: undefined,
    tillaeg: amount(200),
    ydelsestype: '',
  },
  {
    id: 'ydelse-fuld',
    fraDato: iso('2024-02-01'),
    tilDato: iso('2024-02-29'),
    ydelse: amount(1000),
    tillaeg: amount(200),
    ydelsestype: 'dagpenge',
  },
];

const buildEmployment = () => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'af-1',
  navnPaaArbejdssted: undefined,
  harOverenskomst: false,
});

const sfggRows: readonly SygeferiegodtgoerelseAnsaettelsesforholdRow[] = [
  {
    ansaettelsesforholdId: 'af-1',
    sfggBeregningskilde: undefined,
    sfggReferenceperiodeFra: undefined,
    sfggReferenceperiodeTil: undefined,
    sfggReferenceperiodeFravaersdageUdenLoen: undefined,
    sfggManuelDagssats: undefined,
    sfggManuelBeloebIHenholdTil: undefined,
    sfggManuelFoerstEfterSygeloen: 'Nej',
    sfggSatsvalg: undefined,
    sfggAlleredeBetaltBeloeb: undefined,
  },
  {
    ansaettelsesforholdId: 'af-1',
    sfggBeregningskilde: 'Ingen',
    sfggReferenceperiodeFra: undefined,
    sfggReferenceperiodeTil: undefined,
    sfggReferenceperiodeFravaersdageUdenLoen: undefined,
    sfggManuelDagssats: undefined,
    sfggManuelBeloebIHenholdTil: undefined,
    sfggManuelFoerstEfterSygeloen: 'Nej',
    sfggSatsvalg: undefined,
    sfggAlleredeBetaltBeloeb: undefined,
  },
  {
    ansaettelsesforholdId: 'af-1',
    sfggBeregningskilde: 'Manuelt angivet',
    sfggReferenceperiodeFra: undefined,
    sfggReferenceperiodeTil: undefined,
    sfggReferenceperiodeFravaersdageUdenLoen: undefined,
    sfggManuelDagssats: undefined,
    sfggManuelBeloebIHenholdTil: undefined,
    sfggManuelFoerstEfterSygeloen: 'Nej',
    sfggSatsvalg: undefined,
    sfggAlleredeBetaltBeloeb: undefined,
  },
  {
    ansaettelsesforholdId: 'af-1',
    sfggBeregningskilde: 'Overenskomst',
    sfggReferenceperiodeFra: undefined,
    sfggReferenceperiodeTil: undefined,
    sfggReferenceperiodeFravaersdageUdenLoen: undefined,
    sfggManuelDagssats: undefined,
    sfggManuelBeloebIHenholdTil: undefined,
    sfggManuelFoerstEfterSygeloen: 'Nej',
    sfggSatsvalg: undefined,
    sfggAlleredeBetaltBeloeb: undefined,
  },
];

describe('EO-inputfelter – runtime-dækning for delvise rækker og toggles', () => {
  it('udløser ikke runtime_exception i offentlige ydelser og SFGG', () => {
    const runtimeCases: string[] = [];

    for (const [rowIndex, offentligeYdelserRow] of publicBenefitRows.entries()) {
      for (const [sfggIndex, sfggRow] of sfggRows.entries()) {
        const values = withCommonTafInput();
        values.loenindkomstAnsaettelsesforhold = [buildEmployment()];
        values.offentligeYdelserRows = [offentligeYdelserRow];
        values.sfggAnsaettelsesforhold = [sfggRow];

        const reason = runtimeReason(values, `ydelse-sfgg-${rowIndex}-${sfggIndex}`);
        if (reason !== undefined) runtimeCases.push(`${rowIndex}/${sfggIndex}: ${reason}`);
      }
    }

    expect(runtimeCases).toEqual([]);
  });

  it('udløser ikke runtime_exception når AES-afgørelser aktiveres uden deres datoer', () => {
    const runtimeCases: string[] = [];
    const yesNo: readonly ['Nej' | 'Ja', 'Nej' | 'Ja', 'Nej' | 'Ja'][] = [
      ['Nej', 'Nej', 'Nej'],
      ['Ja', 'Nej', 'Nej'],
      ['Nej', 'Ja', 'Nej'],
      ['Nej', 'Nej', 'Ja'],
      ['Ja', 'Ja', 'Nej'],
      ['Ja', 'Nej', 'Ja'],
      ['Nej', 'Ja', 'Ja'],
      ['Ja', 'Ja', 'Ja'],
    ];

    for (const [index, [men, midlertidigtEet, endeligtEet]] of yesNo.entries()) {
      const values = withCommonTafInput();
      values.varigeMenAfgorelse = men;
      values.midlertidigtEETAfgorelse = midlertidigtEet;
      values.endeligtEETAfgorelse = endeligtEet;
      values.menAfgoerelseDato = undefined;
      values.midlertidigEETAfgoerelseDato = undefined;
      values.midlertidigEETVirkningsdato = undefined;
      values.endeligEETAfgoerelseDato = undefined;
      values.endeligEETVirkningsdato = undefined;

      const reason = runtimeReason(values, `aes-${index}`);
      if (reason !== undefined) runtimeCases.push(`${index}: ${reason}`);
    }

    expect(runtimeCases).toEqual([]);
  });
});

describe('EO-lønregulering – ufuldstændige kilder ender i valideringsfejl, ikke i runtime_exception', () => {
  const stamdata = { ...STAMDATA_INITIAL_VALUES, skadestype: 'Arbejdsulykke' as const, skadedato: iso('2023-06-01') };

  const angivetMaanedsloen = (
    loenudvikling: Partial<ErstatningsopgoerelseValues['eoAngivetLoenLoenudvikling']>
  ): ErstatningsopgoerelseValues => {
    const values = withCommonTafInput();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = amount(30_000);
    values.loenindkomstAnsaettelsesforhold = [];
    values.eoAngivetLoenLoenudvikling = { ...values.eoAngivetLoenLoenudvikling, ...loenudvikling };
    return values;
  };

  const snapshotFor = (values: ErstatningsopgoerelseValues) => computeEoSnapshot({
    revision: 'loenregulering-kilde',
    stamdataValues: stamdata,
    eoValues: values,
  });

  it('kræver grundløn i den manuelle basisrække, også når rækken ellers står tom', () => {
    const snapshot = snapshotFor(angivetMaanedsloen({
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [
        { id: 'basis' },
        { id: 'stigning', dato: iso('2024-04-01'), grundloen: amount(31_000) },
      ],
    }));

    expect(snapshot.failClosedReason).toBeUndefined();
    expect(snapshot.status).toBe('error');
    expect(snapshot.invariants.map((invariant) => invariant.message))
      .toContain('Grundløn skal udfyldes på alle manuelle reguleringsrækker');
  });

  it('afviser en overenskomst, der ikke findes i overenskomstdataene (ældre .eo)', () => {
    const snapshot = snapshotFor(angivetMaanedsloen({
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      overenskomstId: 'nedlagt-overenskomst',
    }));

    expect(snapshot.failClosedReason).toBeUndefined();
    expect(snapshot.status).toBe('error');
    expect(snapshot.invariants.map((invariant) => invariant.message))
      .toContain('Den valgte overenskomst findes ikke i Mineo – vælg overenskomsten igen');
  });
});
