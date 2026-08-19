// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import {
  erstatningsopgoerelseSchema,
  stamdataSchema,
  type ErhvervsevnetabComposedValues,
} from '../../../schemas/formSchemas';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot as computeEoSnapshotRaw } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import {
  buildEoValuesWithTransientMidlertidigtEet,
  buildMidlertidigtEetImportContext,
  buildMidlertidigtEetCalculationRows,
  buildMidlertidigtEetSourceResult,
} from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetTransientInjection';
import {
  buildMidlertidigtEetPdfGroupsForTafRanges,
  sumMidlertidigtEetBeregnetEetKronerForTafRanges,
} from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetBilagGroups';
import { buildIncomeForRanges, buildTafRanges } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { fromKroner, roundHeleKroner, toKroner } from '../../../domain/money/money';
import type { MidlertidigtEetAfgoerelseGroup } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { toISODateString } from '../../../types/branded';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';
import {
  buildEetImportContext,
  type EetImportSource,
} from '../../../domain/erhvervsevnetab/eetImportPort';

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

type EetImportTestSource = Omit<EetImportSource, 'revision'> & Readonly<{ revision?: string }>;
type EoSnapshotWithImportArgs = Omit<Parameters<typeof computeEoSnapshotRaw>[0], 'midlertidigtEetImportContext'>
  & Readonly<{ eetImportSource?: EetImportTestSource }>;

const computeEoSnapshot = (args: EoSnapshotWithImportArgs) => {
  const { eetImportSource, ...baseArgs } = args;
  const parsedEo = erstatningsopgoerelseSchema.safeParse(args.eoValues);
  const parsedStamdata = stamdataSchema.safeParse(args.stamdataValues);
  if (!parsedEo.success || !parsedStamdata.success || parsedEo.data.midlertidigtEetFraEetSiden !== 'Ja') {
    return computeEoSnapshotRaw(baseArgs);
  }

  const source = eetImportSource
    ? { ...eetImportSource, revision: eetImportSource.revision ?? args.revision }
    : undefined;
  const midlertidigtEetImportContext = source
    ? buildMidlertidigtEetImportContext(
      source,
      buildTafRanges(parsedEo.data, { skadedatoISO: parsedStamdata.data.skadedato })
    )
    : undefined;
  return computeEoSnapshotRaw({ ...baseArgs, midlertidigtEetImportContext });
};

const stableGoldenHash = (value: unknown): string => {
  const sort = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(sort);
    if (entry === null || typeof entry !== 'object') return entry;

    const record = entry as Readonly<Record<string, unknown>>;
    // AmountValue er EO-porten for den transiente række. Normalisér både den nuværende
    // kronevariant og en MoneyOre-variant til samme semantiske kroneværdi.
    if (record.kind === 'number' && typeof record.value === 'number') {
      return { kind: 'amount-kroner', value: record.value };
    }
    if ((record.kind === 'moneyOre' || record.kind === 'ore') && typeof record.value === 'number') {
      return { kind: 'amount-kroner', value: record.value / 100 };
    }

    return Object.fromEntries(
      Object.entries(record)
        .map(([key, nested]) => key.endsWith('Ore')
          ? [key.slice(0, -3), typeof nested === 'number' ? nested / 100 : nested] as const
          : [key, nested] as const)
        // Kode-enheds-ordning (ikke localeCompare): golden-hashen skal være byte-identisk på tværs
        // af platforme. localeCompare afhænger af værtens ICU/locale og gør hashen platform-afhængig.
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, sort(nested)])
    );
  };
  return createHash('sha256').update(JSON.stringify(sort(value))).digest('hex');
};

const createValidEoBase = () => {
  const initial = createErstatningsopgoerelseInitialValues();
  return withSfggIngenForEmployments({
    ...initial,
    beregnesUdFra: 'Angivet månedsløn' as const,
    maanedsloenenUdgoer: asAmountValue(30000),
    kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
    vedroererPeriodeFra: iso('2024-01-01'),
    vedroererPeriodeTil: iso('2024-12-31'),
    tafPerioder: [
      { id: 'taf-1', fra: iso('2024-02-01'), til: iso('2024-04-30'), loseFeriedage: 0 },
    ],
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
    offentligeYdelserRows: [],
  });
};

const stamdata = {
  ...STAMDATA_INITIAL_VALUES,
  skadestype: 'Arbejdsulykke' as const,
  skadedato: iso('2024-01-01'),
  skadelidteFodselsdato: iso('1980-01-01'),
};

const eetValues: ErhvervsevnetabComposedValues = {
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  beregningsdato: iso('2024-12-31'),
  koen: undefined,
  aslAfgoerelser: [
    {
      id: 'asl-1',
      afgoerelsesDato: toISODateString('2024-02-01'),
      virkningsDato: toISODateString('2024-01-01'),
      eetPct: 20,
      kapDato: undefined,
      kapPct: undefined,
      afgoerelseType: 'Midlertidig',
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Nej',
    },
  ],
  ealEetPct: undefined,
  eetDifferencekravBilagSelection: {
    loebendeYdelser: true,
    kapitalisering: true,
    eetEfterEal: true,
    proformaKapitalisering: true,
    merErstatningPensionsalder: false,
    visUdvidetSpecifikation: false,
    visUdvidetSpecifikationLoebendeYdelserBilag: false,
  },
  aslAarsloen: asAmountValue(300000),
  ealAarsloen: undefined,
  skadelidteFodselsdato: stamdata.skadelidteFodselsdato,
};

describe('midlertidigt EET transient injection', () => {
  it('bevarer det midlertidige EET-bilag for en midlertidig og delvist endelig afgørelse med de rapporterede datoer', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
      vedroererPeriodeFra: iso('2023-06-22'),
      vedroererPeriodeTil: iso('2026-09-30'),
      tafPerioder: [{ id: 'taf-1', fra: iso('2023-10-09'), til: iso('2025-08-28'), loseFeriedage: 0 }],
    };
    const reportedStamdata = { ...stamdata, skadedato: iso('2023-06-22') };
    const reportedEetValues: ErhvervsevnetabComposedValues = {
      ...eetValues,
      beregningsdato: iso('2026-08-11'),
      aslAarsloen: asAmountValue(588000),
      aslAfgoerelser: [
        {
          id: 'midlertidig',
          afgoerelsesDato: iso('2025-07-16'),
          virkningsDato: iso('2025-01-13'),
          eetPct: 25,
          afgoerelseType: 'Midlertidig',
          kapDato: undefined,
          kapPct: undefined,
          tidlKapDato: undefined,
          fsTilbageholdtEet: 'Ja',
        },
        {
          id: 'delvist-endelig',
          afgoerelsesDato: iso('2025-08-29'),
          virkningsDato: iso('2024-09-04'),
          eetPct: 25,
          afgoerelseType: 'Delvist endelig',
          kapDato: iso('2025-08-29'),
          kapPct: 15,
          tidlKapDato: undefined,
          fsTilbageholdtEet: 'Nej',
        },
      ],
      skadelidteFodselsdato: reportedStamdata.skadelidteFodselsdato,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-rapporteret-sag',
      stamdataValues: reportedStamdata,
      eoValues,
      eetImportSource: { eetValues: reportedEetValues, skadedato: reportedStamdata.skadedato },
    });

    const bilagGroups = buildMidlertidigtEetPdfGroupsForTafRanges(
      snapshot.data?.midlertidigtEetGroups ?? [],
      snapshot.data?.canonicalOutput.periodiseringer.tafPerioder ?? []
    );
    expect(bilagGroups).toHaveLength(1);
    expect(bilagGroups[0]?.afgoerelsesdato).toBe(iso('2025-08-29'));
    expect(bilagGroups[0]?.perioder).toContainEqual(expect.objectContaining({
      fra: iso('2024-09-04'),
      til: iso('2025-08-28'),
    }));
    expect(bilagGroups[0]?.perioder.at(-1)?.til).toBe(iso('2025-08-28'));
  });

  it('ignorerer EET-kilden når togglen er slået fra', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Nej' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-off',
      stamdataValues: stamdata,
      eoValues,
      eetImportSource: {
        eetValues,
        skadedato: stamdata.skadedato,
      },
    });

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.some((entry) => entry.label === 'Midlertidigt EET')).toBe(false);
    expect(snapshot.input.erstatningsopgoerelse?.offentligeYdelserRows).toEqual([]);
  });

  it('injicerer EET-rækker transient i TAF-fradraget når togglen er slået til', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-on',
      stamdataValues: stamdata,
      eoValues,
      eetImportSource: {
        eetValues,
        skadedato: stamdata.skadedato,
      },
    });

    const midlertidigtEetEntry = snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.find(
      (entry) => entry.label === 'Midlertidigt EET'
    );

    expect(snapshot.data).not.toBeNull();
    expect(midlertidigtEetEntry?.amountOre).toBeGreaterThan(0);
    expect(snapshot.inspektionSnapshot?.eoValues.offentligeYdelserRows.some((row) => row.ydelsestype === 'midlertidigt_eet')).toBe(true);
    expect(snapshot.input.erstatningsopgoerelse?.offentligeYdelserRows).toEqual([]);

    expect(stableGoldenHash({
      groups: snapshot.data?.midlertidigtEetGroups.map((group) => ({
        afgoerelsesdato: group.afgoerelsesdato,
        eetPct: group.eetPct,
        perioder: group.perioder,
        rows: group.rows.map(({ id: _id, ...row }) => row),
      })),
      importedRows: snapshot.inspektionSnapshot?.eoValues.offentligeYdelserRows.filter(
        (row) => row.ydelsestype === 'midlertidigt_eet'
      ).map(({ id: _id, ...row }) => row),
      tafEntry: midlertidigtEetEntry,
    })).toBe('0a78ce9402dfbf4aa5cb6cbad4a3159eb7a85ec4f0f5f46d7a358353ab89059f');
  });

  it('fordeler importeret midlertidigt EET efter faktisk månedsbrøk ved delvist overlap', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };
    const groups = [{
      afgoerelsesdato: iso('2024-01-01'),
      eetPct: 20,
      rows: [],
      perioder: [{
        fra: iso('2024-01-01'),
        til: iso('2024-02-29'),
        satsAar: 2024,
        maanederPraecis: 2,
        grundydelseAfrundetOre: fromKroner(12000),
        reguleringPct: 0,
        maanedligYdelseOre: fromKroner(1000),
        beregnetEetOre: fromKroner(2000),
      }],
    }];

    const effectiveValues = buildEoValuesWithTransientMidlertidigtEet(eoValues, groups);
    const income = buildIncomeForRanges(effectiveValues, [{ fra: iso('2024-01-11'), til: iso('2024-01-12') }]);
    const midlertidigtEet = income.benefits.find((entry) => entry.typeKey === 'midlertidigt_eet');

    expect(midlertidigtEet?.amount).toBeCloseTo(1000 * (2 / 31), 10);
  });

  it('afgrænser importeret midlertidigt EET efter TAF-periodens udløb og ikke EET-beregningsdatoen', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-taf-slutdato',
      stamdataValues: stamdata,
      eoValues,
      eetImportSource: {
        eetValues: {
          ...eetValues,
          beregningsdato: iso('2024-02-29'),
        },
        skadedato: stamdata.skadedato,
      },
    });
    const importedRows = snapshot.inspektionSnapshot?.eoValues.offentligeYdelserRows.filter(
      (row) => row.ydelsestype === 'midlertidigt_eet'
    ) ?? [];

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.data?.midlertidigtEetGroups.flatMap((group) => group.perioder).at(-1)?.til).toBe(toISODateString('2024-04-30'));
    expect(importedRows.at(-1)?.tilDato).toBe(toISODateString('2024-04-30'));
  });

  it('importerer midlertidigt EET uden EET-beregningsdato ved at bruge TAF-slutdatoen som fallback', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-uden-beregningsdato',
      stamdataValues: stamdata,
      eoValues,
      eetImportSource: {
        eetValues: {
          ...eetValues,
          beregningsdato: undefined,
        },
        skadedato: stamdata.skadedato,
      },
    });
    const importedRows = snapshot.inspektionSnapshot?.eoValues.offentligeYdelserRows.filter(
      (row) => row.ydelsestype === 'midlertidigt_eet'
    ) ?? [];

    // Manglende EET-beregningsdato må ikke længere blokere EO-importen.
    expect(snapshot.data).not.toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id === 'midlertidigt_eet_source:beregningsdato-missing')).toBe(false);
    // De importerede rækker afgrænses af TAF-periodens slutdato (capped af EO-periodens slutdato).
    expect(snapshot.data?.midlertidigtEetGroups.flatMap((group) => group.perioder).length).toBeGreaterThan(0);
    expect(snapshot.data?.midlertidigtEetGroups.flatMap((group) => group.perioder).at(-1)?.til).toBe(toISODateString('2024-04-30'));
    expect(importedRows.at(-1)?.tilDato).toBe(toISODateString('2024-04-30'));
  });

  it('blokerer fortsat midlertidigt EET-import uden beregningsdato når der ingen TAF-periode findes til fallback', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
      tafPerioder: [],
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-uden-beregningsdato-uden-taf',
      stamdataValues: stamdata,
      eoValues,
      eetImportSource: {
        eetValues: {
          ...eetValues,
          beregningsdato: undefined,
        },
        skadedato: stamdata.skadedato,
      },
    });

    // Uden TAF-periode findes ingen fallback-slutdato; importen fail-closer på manglende beregningsdato.
    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants).toContainEqual(expect.objectContaining({
      id: 'midlertidigt_eet_source:beregningsdato-missing',
      severity: 'error',
      blocksAuthoritativeComputation: true,
    }));
  });

  it('holder Midlertidig EET-bilagets sammentælling identisk med TAF-fradraget', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };
    const source = {
      eetValues,
      skadedato: stamdata.skadedato,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-pdf-parity',
      stamdataValues: stamdata,
      eoValues,
      eetImportSource: source,
    });
    const pdfGroups = buildMidlertidigtEetPdfGroupsForTafRanges(
      snapshot.data?.midlertidigtEetGroups ?? [],
      snapshot.data?.canonicalOutput.periodiseringer.tafPerioder ?? []
    );
    const pdfTotalKroner = pdfGroups
      .flatMap((group) => group.perioder)
      .reduce((sum, row) => sum + toKroner(row.beregnetEetOre), 0);
    const tafEntry = snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.find(
      (entry) => entry.label === 'Midlertidigt EET'
    );

    expect(snapshot.data).not.toBeNull();
    expect(tafEntry).toBeDefined();
    expect(pdfTotalKroner * 100).toBe(tafEntry?.amountOre);
  });

  it('gør fradraget lig bilagets pr.-periode-sum, ikke den totalrundede råsum (42.791 vs 42.790)', () => {
    // Reproducerer brugerens sag: en kort sub-måneds-periode + en flermåneders periode, hvor
    // pr.-periode-afrunding (bilag) og total-afrunding (rå fradrag) divergerer med 1 kr.
    const groups: MidlertidigtEetAfgoerelseGroup[] = [
      {
        afgoerelsesdato: iso('2025-07-16'),
        eetPct: 60,
        rows: [],
        perioder: [{
          fra: iso('2025-01-11'),
          til: iso('2025-01-12'),
          satsAar: 2025,
          maanederPraecis: 2 / 31,
          grundydelseAfrundetOre: fromKroner(0),
          reguleringPct: 3.9,
          maanedligYdelseOre: fromKroner(21539),
          beregnetEetOre: fromKroner(0),
        }],
      },
      {
        afgoerelsesdato: iso('2025-08-29'),
        eetPct: 25,
        rows: [],
        perioder: [{
          fra: iso('2025-01-13'),
          til: iso('2025-05-31'),
          satsAar: 2025,
          maanederPraecis: 0,
          grundydelseAfrundetOre: fromKroner(0),
          reguleringPct: 3.9,
          maanedligYdelseOre: fromKroner(8975),
          beregnetEetOre: fromKroner(0),
        }],
      },
    ];
    const tafRanges = [{ fra: iso('2025-01-11'), til: iso('2025-05-31') }];

    // Bilaget runder pr. periode: 1.390 + 41.401 = 42.791.
    const bilag = buildMidlertidigtEetPdfGroupsForTafRanges(groups, tafRanges);
    expect(bilag.flatMap((g) => g.perioder).map((p) => p.beregnetEetOre)).toEqual([
      fromKroner(1390),
      fromKroner(41401),
    ]);

    // Den kanoniske fradragskilde giver netop bilagssummen.
    expect(sumMidlertidigtEetBeregnetEetKronerForTafRanges(groups, tafRanges)).toBe(42791);

    // Den gamle rå vej (injicerede rækker → periodisering → runding én gang) gav 42.790.
    const eoValues = { ...createErstatningsopgoerelseInitialValues(), midlertidigtEetFraEetSiden: 'Ja' as const };
    const rows = buildMidlertidigtEetCalculationRows(groups);
    const income = buildIncomeForRanges({ ...eoValues, offentligeYdelserRows: [...rows] }, tafRanges);
    const raw = income.benefits.find((b) => b.typeKey === 'midlertidigt_eet')?.amount ?? 0;
    expect(roundHeleKroner(raw)).toBe(42790);
    // Divergensen er reel – derfor må fradraget bruge den kanoniske kilde, ikke råvejen.
    expect(sumMidlertidigtEetBeregnetEetKronerForTafRanges(groups, tafRanges)).not.toBe(roundHeleKroner(raw));
  });

  it('bevarer 2-decimal-afrunding af manuelle midlertidigt_eet-rækker når togglen er slået fra', () => {
    const eoValues = {
      ...createValidEoBase(),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-05'), loseFeriedage: 0 },
      ],
      midlertidigtEetFraEetSiden: 'Nej' as const,
      offentligeYdelserRows: [{
        id: 'midlertidigt-eet-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-10'),
        ydelsestype: 'midlertidigt_eet' as const,
        ydelse: asAmountValue(101),
        tillaeg: undefined,
      }],
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-two-decimal-when-toggle-off',
      stamdataValues: stamdata,
      eoValues,
    });
    const tafEntry = snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.find(
      (entry) => entry.label === 'Midlertidigt EET'
    );

    expect(snapshot.data).not.toBeNull();
    // 50,50 kr = 5050 øre (2-decimal-afrunding bevares for manuelle rækker)
    expect(tafEntry?.amountOre).toBe(5050);
  });

  it('afrunder Midlertidigt EET under Indtægter i hele kroner når togglen er slået til', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-whole-kroner-when-toggle-on',
      stamdataValues: stamdata,
      eoValues,
      eetImportSource: {
        eetValues,
        skadedato: stamdata.skadedato,
      },
    });
    const tafEntry = snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.find(
      (entry) => entry.label === 'Midlertidigt EET'
    );

    expect(snapshot.data).not.toBeNull();
    expect(tafEntry).toBeDefined();
    // amountOre delt med 100 giver kroner; ved hele-kroner-afrunding er modulo 100 = 0.
    expect((tafEntry?.amountOre ?? 0) % 100).toBe(0);
  });

  it('ignorerer endelige EET-afgørelser når togglen er slået til', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-endelig-ignored',
      stamdataValues: stamdata,
      eoValues,
      eetImportSource: {
        eetValues: {
          ...eetValues,
          aslAfgoerelser: eetValues.aslAfgoerelser.map((row) => ({
            ...row,
            afgoerelseType: 'Endelig' as const,
          })),
        },
        skadedato: stamdata.skadedato,
      },
    });

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.data?.engines.tafNetto.tafIndtaegter?.entries.some((entry) => entry.label === 'Midlertidigt EET')).toBe(false);
    expect(snapshot.inspektionSnapshot?.eoValues.offentligeYdelserRows.some((row) => row.ydelsestype === 'midlertidigt_eet')).toBe(false);
    expect(snapshot.input.erstatningsopgoerelse?.offentligeYdelserRows).toEqual([]);
  });

  it('lader EO-beregningen fortsætte uden EET-issues når EET-siden er tom', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-empty-source',
      stamdataValues: stamdata,
      eoValues,
      eetImportSource: {
        eetValues: {
          ...eetValues,
          beregningsdato: undefined,
          aslAfgoerelser: [],
          aslAarsloen: undefined,
          skadelidteFodselsdato: undefined,
        },
        skadedato: undefined,
      },
    });

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id.startsWith('midlertidigt_eet_source:'))).toBe(false);
    expect(snapshot.data?.midlertidigtEetGroups).toEqual([]);
  });

  it('ignorerer EET-kildefejl når der kun findes endelige afgørelser, som ikke kan importeres', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-final-only-source',
      stamdataValues: stamdata,
      eoValues,
      eetImportSource: {
        eetValues: {
          ...eetValues,
          aslAarsloen: undefined,
          aslAfgoerelser: eetValues.aslAfgoerelser.map((row) => ({
            ...row,
            afgoerelseType: 'Endelig' as const,
          })),
        },
        skadedato: stamdata.skadedato,
      },
    });

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id.startsWith('midlertidigt_eet_source:'))).toBe(false);
    expect(snapshot.data?.midlertidigtEetGroups).toEqual([]);
  });

  it('blokerer autoritativ EO-beregning når den aktive EET-kilde har blokerende fejl', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-source-error',
      stamdataValues: stamdata,
      eoValues,
      eetImportSource: {
        eetValues: {
          ...eetValues,
          aslAarsloen: undefined,
        },
        skadedato: stamdata.skadedato,
      },
    });

    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants).toContainEqual(expect.objectContaining({
      id: 'midlertidigt_eet_source:aarsloen-missing',
      severity: 'error',
      blocksAuthoritativeComputation: true,
    }));
  });

  it('undertrykker de beregningsdato-relative advarsler i EO-importen, men beholder øvrige EET-advarsler', () => {
    const result = buildMidlertidigtEetSourceResult(buildEetImportContext(
      {
        revision: 'warning-filter',
        eetValues: {
          ...eetValues,
          beregningsdato: undefined,
          aslAfgoerelser: [
            {
              id: 'asl-1',
              afgoerelsesDato: iso('2024-02-01'),
              // Virkningsdato efter den effektive beregningsdato (TAF-slutdato) → udløser
              // warn-virkningsdato-after-beregningsdato, som skal undertrykkes i EO-konteksten.
              virkningsDato: iso('2024-05-01'),
              // EET under 15 % → udløser warn-asl-eet-under-15, som er kontekst-uafhængig og bevares.
              eetPct: 10,
              kapDato: undefined,
              kapPct: undefined,
              afgoerelseType: 'Midlertidig',
              tidlKapDato: undefined,
              fsTilbageholdtEet: 'Nej',
            },
          ],
        },
        skadedato: iso('2024-01-01'),
      },
      iso('2024-04-30')
    ));

    expect(result.issues.some((issue) => issue.id === 'warn-virkningsdato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-afgoerelsesdato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-kap-dato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-asl-eet-under-15')).toBe(true);
  });

  it('blokerer autoritativ EO-beregning når EET-kilden ikke matcher schema', () => {
    const eoValues = {
      ...createValidEoBase(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
    };

    const snapshot = computeEoSnapshot({
      revision: 'midlertidigt-eet-source-schema-invalid',
      stamdataValues: stamdata,
      eoValues,
      eetImportSource: {
        eetValues,
        skadedato: stamdata.skadedato,
        issues: [{
          id: 'midlertidigt-eet-source-schema-invalid',
          severity: 'error',
          message: 'Der mangler en afgørelse med EET-procent.',
        }],
      },
    });

    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants).toContainEqual(expect.objectContaining({
      id: 'midlertidigt_eet_source:midlertidigt-eet-source-schema-invalid',
      severity: 'error',
      message: 'Der mangler en afgørelse med EET-procent.',
      blocksAuthoritativeComputation: true,
    }));
  });
});
