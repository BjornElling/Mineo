import {
  omitDerivedLoenindkomstSatser,
  projectLoenindkomstSatser,
} from '../../../domain/erstatningsopgoerelse/loenindkomstSatsProjection';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  erstatningsopgoerelseSchema,
  persistedErstatningsopgoerelseSchema,
  type LoenudviklingManuelRow,
  type ErstatningsopgoerelseValues,
} from '../../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../../types/branded';
import { parseInboundPersistedSection } from '../../../utils/inboundPersistedSection';

const createValues = (
  employment: Partial<ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]>
): ErstatningsopgoerelseValues => erstatningsopgoerelseSchema.parse({
  tafBeregningsperiodeTil: toISODateString('2024-06-30'),
  loenindkomstAnsaettelsesforhold: [{
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    storeBededagPct: 0,
    id: 'af-1',
    harOverenskomst: true,
    overenskomstId: 'bygge-anlaeg',
    loenPaaHelligdage: 'Almindelig løn',
    beregnStoreBededagstillaeg: true,
    ...employment,
  }],
});

describe('projectLoenindkomstSatser', () => {
  it('returnerer samme input, når sagen ikke har ansættelsesforhold', () => {
    const input = erstatningsopgoerelseSchema.parse({ loenindkomstAnsaettelsesforhold: [] });

    expect(projectLoenindkomstSatser(input, {})).toBe(input);
  });

  it('udleder låste satser uden at mutere det persisterede input', () => {
    const input = createValues({ fritvalgPct: 3.5, storeBededagPct: 9.9 });

    const projected = projectLoenindkomstSatser(input, {
      skadedato: toISODateString('2024-06-01'),
    });

    expect(input.loenindkomstAnsaettelsesforhold[0]?.fritvalgPct).toBe(3.5);
    expect(input.loenindkomstAnsaettelsesforhold[0]?.storeBededagPct).toBe(9.9);
    expect(projected.loenindkomstAnsaettelsesforhold[0]?.fritvalgPct).toBe(0);
    expect(projected.loenindkomstAnsaettelsesforhold[0]?.storeBededagPct).toBeGreaterThan(0);
  });

  it('bevarer brugerens sats, når den ikke er låst', () => {
    const input = createValues({ harOverenskomst: false, fritvalgPct: 3.5 });

    const projected = projectLoenindkomstSatser(input, {
      skadedato: toISODateString('2024-06-01'),
    });

    expect(projected.loenindkomstAnsaettelsesforhold[0]?.fritvalgPct).toBe(3.5);
  });

  it('genbruger værdien, når en allerede projiceret ansættelse er uændret', () => {
    const input = createValues({ fritvalgPct: 3.5, storeBededagPct: 9.9 });
    const projected = projectLoenindkomstSatser(input, {
      skadedato: toISODateString('2024-06-01'),
    });
    const repeated = projectLoenindkomstSatser(projected, {
      skadedato: toISODateString('2024-06-01'),
    });

    expect(repeated).toBe(projected);
  });

  it('bevarer en tom manuel tabel uden at materialisere en basisrække', () => {
    const input = createValues({
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [],
    });

    const projected = projectLoenindkomstSatser(input, {
      skadedato: toISODateString('2024-06-01'),
    });

    expect(projected.loenindkomstAnsaettelsesforhold[0]?.loenudviklingManuelTableData).toEqual([]);
  });

  it('spejler en eksisterende manuel basisrække med samme række-id', () => {
    const manualRow: LoenudviklingManuelRow = {
      id: 'manual-base-projection',
      dato: undefined,
      grundloen: { kind: 'number', value: 30_000 },
      feriepenge: undefined,
      shSoSats: undefined,
      fritvalg: undefined,
      agPension: undefined,
    };
    const input = createValues({
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [manualRow, {
        ...manualRow,
        id: 'manual-next-procent',
        dato: toISODateString('2024-01-01'),
      }],
    });

    const projected = projectLoenindkomstSatser(input, {
      skadedato: toISODateString('2024-06-01'),
    });

    expect(projected.loenindkomstAnsaettelsesforhold[0]?.loenudviklingManuelTableData[0]?.id)
      .toBe('manual-base-projection');
  });

  it('udelader låste satser fra persistence men bevarer en redigerbar sats', () => {
    const locked = createValues({ fritvalgPct: 3.5, storeBededagPct: 9.9 });
    const unlocked = createValues({ harOverenskomst: false, fritvalgPct: 3.5 });

    const lockedSave = omitDerivedLoenindkomstSatser(locked, {
      skadedato: toISODateString('2024-06-01'),
    });
    const unlockedSave = omitDerivedLoenindkomstSatser(unlocked, {
      skadedato: toISODateString('2024-06-01'),
    });

    expect(lockedSave.loenindkomstAnsaettelsesforhold[0]?.fritvalgPct).toBeUndefined();
    expect(unlockedSave.loenindkomstAnsaettelsesforhold[0]?.fritvalgPct).toBe(3.5);
  });

  it('fjerner låste tillæg fra første manuelt angivne basisrække', () => {
    const manualRow: LoenudviklingManuelRow = {
      id: 'manual-base',
      dato: undefined,
      grundloen: { kind: 'number', value: 30_000 },
      feriepenge: 12.5,
      shSoSats: 5,
      fritvalg: 3,
      agPension: 8,
    };
    const input = createValues({
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [manualRow, {
        ...manualRow,
        id: 'manual-next-procent',
        dato: toISODateString('2024-01-01'),
      }],
    });

    const persisted = omitDerivedLoenindkomstSatser(input, {
      skadedato: toISODateString('2024-06-01'),
    });
    const row = persisted.loenindkomstAnsaettelsesforhold[0]?.loenudviklingManuelTableData[0];

    expect(row).toEqual({
      ...manualRow,
      feriepenge: undefined,
      shSoSats: undefined,
      fritvalg: undefined,
      agPension: undefined,
    });
    expect(persisted.loenindkomstAnsaettelsesforhold[0]?.loenudviklingManuelTableData[1]).toEqual({
      ...manualRow,
      id: 'manual-next-procent',
      dato: toISODateString('2024-01-01'),
    });
  });

  it('bevarer tillægsfelterne i første basisrække i Beløb-tilstand', () => {
    const manualRow: LoenudviklingManuelRow = {
      id: 'manual-base-beloeb',
      dato: undefined,
      grundloen: { kind: 'number', value: 30_000 },
      feriepenge: 12.5,
      shSoSats: 5,
      fritvalg: 3,
      agPension: 8,
    };
    const input = createValues({
      tillaegAngivesSom: 'beloeb',
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [manualRow, {
        ...manualRow,
        id: 'manual-next-beloeb',
        dato: toISODateString('2024-01-01'),
      }],
    });

    const persisted = omitDerivedLoenindkomstSatser(input, {
      skadedato: toISODateString('2024-06-01'),
    });

    expect(persisted.loenindkomstAnsaettelsesforhold[0]?.loenudviklingManuelTableData).toEqual([
      manualRow,
      {
        ...manualRow,
        id: 'manual-next-beloeb',
        dato: toISODateString('2024-01-01'),
      },
    ]);
  });

  it('bruger beregningsperiodens dato, når en særlig reguleringsdato er runtime-ugyldig', () => {
    const input = createValues({ saerligFraDatoRegulering: undefined });
    input.loenindkomstAnsaettelsesforhold[0]!.saerligFraDatoRegulering = 'ikke-en-dato' as ISODateString;

    const projected = projectLoenindkomstSatser(input, {
      skadedato: toISODateString('2024-06-01'),
    });
    const persisted = omitDerivedLoenindkomstSatser(input, {
      skadedato: toISODateString('2024-06-01'),
    });

    expect(projected.loenindkomstAnsaettelsesforhold[0]?.storeBededagPct).toBeGreaterThan(0);
    expect(persisted.loenindkomstAnsaettelsesforhold[0]?.fritvalgPct).toBeUndefined();
  });

  it('bruger en gyldig særlig reguleringsdato og tåler manglende skadedato', () => {
    const input = createValues({ saerligFraDatoRegulering: toISODateString('2023-01-01') });

    const projected = projectLoenindkomstSatser(input, {});
    const persisted = omitDerivedLoenindkomstSatser(input, {});

    expect(projected.loenindkomstAnsaettelsesforhold[0]?.storeBededagPct).toBe(0);
    expect(persisted.loenindkomstAnsaettelsesforhold[0]?.fritvalgPct).toBeUndefined();
  });

  it('fjerner et historisk Store Bededag-slot inbound UDEN at rapportere det som tabt data', () => {
    // Stripningen ejes af sektionsmigratoren – IKKE af en `.transform()` på schemaet. En transform ville
    // gøre ansættelses-arrayet uigennemsigtigt for `z.toJSONSchema` og dermed usynligt for ledger-,
    // inventar- og fingerprint-værnene. Migratorvejen bevarer samtidig tabsrapporteringens betydning:
    // satsen genudledes, så den må ikke tælles som en tabt indtastning.
    const legacy = parseInboundPersistedSection(
      'erstatningsopgoerelse',
      createValues({ storeBededagPct: 9.9 }),
      '3.10'
    );

    expect(legacy.ok).toBe(true);
    expect(legacy.unknownPaths).toEqual([]);
    expect(
      legacy.ok && Object.hasOwn(legacy.data.loenindkomstAnsaettelsesforhold[0] ?? {}, 'storeBededagPct')
    ).toBe(false);
  });

  it('afviser slottet direkte mod det aktuelle persisterede schema', () => {
    // Det aktuelle schema er `.strict()` og kender ikke slottet. Det er netop derfor migratoren skal fjerne
    // det: uden migrationen ville en ældre `.eo` fejle sektionsvalidering og blive droppet som helhed.
    const parsed = persistedErstatningsopgoerelseSchema.safeParse(createValues({ storeBededagPct: 9.9 }));
    expect(parsed.success).toBe(false);
  });
});
