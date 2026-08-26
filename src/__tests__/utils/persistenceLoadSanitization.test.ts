import { stripUnknownFieldsBySchema } from '../../utils/persistenceLoadSanitization';
import { erstatningsopgoerelseSchema, stamdataSchema } from '../../schemas/formSchemas';
import { z } from 'zod';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { PERSISTED_SECTION_KEYS, persistenceSchemas } from '../../config/persistenceRegistry';
import { optionalAmountValueSchema } from '../../schemas/amountExpressionSchema';
import { migratePersistedSectionValue } from '../../utils/persistenceMigrations';

describe('persistenceLoadSanitization', () => {
  // Guard mod Zod-opgradering: hvis unwrapSchema lydløst no-op'er på en ny `.def`-pipe-struktur, ville
  // ukendte felter IKKE blive strippet (jf. ADVARSEL i persistenceLoadSanitization.ts). Denne test fanger
  // det for HVER persisteret sektion ved at kræve at en probe-nøgle altid rapporteres som ukendt.
  it.each([...PERSISTED_SECTION_KEYS])('unwrapSchema når frem til ZodObject for sektionen %s', (pageKey) => {
    const result = stripUnknownFieldsBySchema(persistenceSchemas[pageKey], {
      __mineoUnknownProbe__: 'x',
    });
    expect(result.unknownPaths).toContainEqual(['__mineoUnknownProbe__']);
  });

  it('stripper ukendte felter og rapporterer deres stier', () => {
    const result = stripUnknownFieldsBySchema(stamdataSchema, {
      journalnr: 'J-1',
      skadelidte: 'Test',
      uventetFelt: 'fjern mig',
    });

    expect(result.unknownPaths).toContainEqual(['uventetFelt']);
    expect(result.sanitized).toEqual({
      journalnr: 'J-1',
      skadelidte: 'Test',
    });
  });

  it('stripper ukendte felter gennem pipe-wrappere som preprocess/transform bruger i Zod v4', () => {
    const schema = z.preprocess(
      (value) => value,
      z.object({
        navn: z.string(),
      }).strict()
    );

    const result = stripUnknownFieldsBySchema(schema, {
      navn: 'Test',
      uventetFelt: true,
    });

    expect(result.unknownPaths).toContainEqual(['uventetFelt']);
    expect(result.sanitized).toEqual({
      navn: 'Test',
    });
  });

  it('stripper ukendte felter i objekter inde i et array og rapporterer indekserede stier', () => {
    const schema = z.object({
      items: z.array(
        z.object({
          id: z.string(),
          value: z.number(),
        })
      ),
    });

    const result = stripUnknownFieldsBySchema(schema, {
      items: [
        { id: 'a', value: 1, uventetFelt: 'fjern' },
        { id: 'b', value: 2 },
        { id: 'c', value: 3, etAndetUventetFelt: true },
      ],
    });

    expect(result.unknownPaths).toContainEqual(['items', 0, 'uventetFelt']);
    expect(result.unknownPaths).toContainEqual(['items', 2, 'etAndetUventetFelt']);
    expect(result.unknownPaths).toHaveLength(2);

    const sanitized = result.sanitized as { items: Array<Record<string, unknown>> };
    expect(sanitized.items[0]).toEqual({ id: 'a', value: 1 });
    expect(sanitized.items[1]).toEqual({ id: 'b', value: 2 });
    expect(sanitized.items[2]).toEqual({ id: 'c', value: 3 });
  });

  it('stripper og rapporterer ukendte felter i den valgte gren af en ZodUnion', () => {
    const result = stripUnknownFieldsBySchema(optionalAmountValueSchema, {
      kind: 'expression',
      expression: '1+1',
      value: 2,
      fremtidigtFelt: true,
    });

    expect(result.unknownPaths).toContainEqual(['fremtidigtFelt']);
    expect(result.sanitized).toEqual({
      kind: 'expression',
      expression: '1+1',
      value: 2,
    });
  });

  it('stripper fjernede EO-felter før strict load-parse af gamle filer', () => {
    const legacyPayload = {
      ...createErstatningsopgoerelseInitialValues(),
      sfggAlleSygeperioderErTafPerioder: true,
    };

    const result = stripUnknownFieldsBySchema(erstatningsopgoerelseSchema, legacyPayload);

    expect(result.unknownPaths).toContainEqual(['sfggAlleSygeperioderErTafPerioder']);
    expect(erstatningsopgoerelseSchema.safeParse(result.sanitized).success).toBe(true);
  });

  // Regression for de historiske schemaændringer 2026-06-03 (PERSISTED_DATA_VERSION 1.9 → 3.3):
  // De gamle Ja/Nej-feltnavne skal migreres til de nye tre-tilstands-navne. De fire
  // øvrige historiske felter/tabeller er godkendt som udviklingsrester, der ignoreres uden preflight.
  it('migrerer historiske EO-feltnavne og ignorerer gamle udviklingsdata', () => {
    const init = createErstatningsopgoerelseInitialValues() as Record<string, unknown>;
    // Simulér en ældre .eo-fil: de nye feltnavne findes ikke endnu, men de gamle gør.
    delete init.kravPaaSvieSmerteGodtgoerelse;
    delete init.kravPaaTabtArbejdsfortjeneste;
    delete init.kravPaaOevrigeErstatningskrav;
    delete init.offentligeYdelserKommentarer;
    const legacyPayload = {
      ...init,
      beregnesSvieSmerteGodtgoerelse: 'Nej',
      beregnesTabtArbejdsfortjeneste: 'Nej',
      allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true,
      allowReguleringMedUdloebMedMaaneder: false,
      opsagtFraStilling: 'Ja',
      sfggSygeperioderFoer2015: [{ id: 'sfg-1', fra: '2014-01-01', til: '2014-01-15' }],
    };

    const migrated = migratePersistedSectionValue('erstatningsopgoerelse', legacyPayload, '2.0');
    const result = stripUnknownFieldsBySchema(erstatningsopgoerelseSchema, migrated.value);

    expect(result.unknownPaths).not.toContainEqual(['beregnesSvieSmerteGodtgoerelse']);
    expect(result.unknownPaths).not.toContainEqual(['beregnesTabtArbejdsfortjeneste']);
    expect(result.unknownPaths).not.toContainEqual(['allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden']);
    expect(result.unknownPaths).not.toContainEqual(['allowReguleringMedUdloebMedMaaneder']);
    expect(result.unknownPaths).not.toContainEqual(['opsagtFraStilling']);
    expect(result.unknownPaths).not.toContainEqual(['sfggSygeperioderFoer2015']);

    const parsed = erstatningsopgoerelseSchema.safeParse(result.sanitized);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    // Den gamle 'Nej'-værdi følger med gennem loadet, selv om feltet nu også understøtter 'Skjul'.
    expect(parsed.data.kravPaaSvieSmerteGodtgoerelse).toBe('Nej');
    expect(parsed.data.kravPaaTabtArbejdsfortjeneste).toBe('Nej');
    expect(parsed.data.kravPaaOevrigeErstatningskrav).toBe('Ja');
    expect(parsed.data.offentligeYdelserKommentarer).toBeUndefined();
  });

  // En fremtids-/nutidsfil med de nye tre-tilstands-værdier skal kunne loades uændret,
  // inkl. 'Skjul'-værdien der blev introduceret i samme bump (jaNejSkjulEnum).
  it('bevarer nye tre-tilstands-værdier (inkl. Skjul) ved load uden at stripe dem', () => {
    const payload = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaSvieSmerteGodtgoerelse: 'Skjul',
      kravPaaTabtArbejdsfortjeneste: 'Nej',
      kravPaaOevrigeErstatningskrav: 'Skjul',
      erstatningsopgoerelseAfsluttesMed: 'Ingen',
    };

    const result = stripUnknownFieldsBySchema(erstatningsopgoerelseSchema, payload);

    expect(result.unknownPaths).toHaveLength(0);
    const parsed = erstatningsopgoerelseSchema.safeParse(result.sanitized);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.kravPaaSvieSmerteGodtgoerelse).toBe('Skjul');
    expect(parsed.data.kravPaaTabtArbejdsfortjeneste).toBe('Nej');
    expect(parsed.data.kravPaaOevrigeErstatningskrav).toBe('Skjul');
    expect(parsed.data.erstatningsopgoerelseAfsluttesMed).toBe('Ingen');
  });
});
