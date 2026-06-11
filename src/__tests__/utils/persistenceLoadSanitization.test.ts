import { stripUnknownFieldsBySchema } from '../../utils/persistenceLoadSanitization';
import { erstatningsopgoerelseSchema, stamdataSchema } from '../../schemas/formSchemas';
import { z } from 'zod';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { PERSISTED_SECTION_KEYS, persistenceSchemas } from '../../config/persistenceRegistry';

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

  it('stripper fjernede EO-felter før strict load-parse af gamle filer', () => {
    const legacyPayload = {
      ...createErstatningsopgoerelseInitialValues(),
      sfggAlleSygeperioderErTafPerioder: true,
    };

    const result = stripUnknownFieldsBySchema(erstatningsopgoerelseSchema, legacyPayload);

    expect(result.unknownPaths).toContainEqual(['sfggAlleSygeperioderErTafPerioder']);
    expect(erstatningsopgoerelseSchema.safeParse(result.sanitized).success).toBe(true);
  });

  // Regression for de bevidste breaking schema-ændringer 2026-06-03 (PERSISTED_DATA_VERSION 1.9 → 3.3):
  // - rename: beregnesSvieSmerteGodtgoerelse → kravPaaSvieSmerteGodtgoerelse (jaNej → jaNejSkjul)
  // - rename: beregnesTabtArbejdsfortjeneste → kravPaaTabtArbejdsfortjeneste (jaNej → jaNejSkjul)
  // - fjernet: allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden + allowReguleringMedUdloebMedMaaneder
  //   (flyttet til device-lokale appSettings)
  // Kontrakt: schema-evolution.md §3.1a — gammel værdi tabes bevidst (ingen migrator),
  // de gamle feltnavne strippes som ukendte, og de nye tre-tilstands-felter loades med default 'Ja'.
  it('strippper omdøbte og fjernede EO-felter fra 2026-06-03-bumpet og loader nye felter med default', () => {
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
    };

    const result = stripUnknownFieldsBySchema(erstatningsopgoerelseSchema, legacyPayload);

    expect(result.unknownPaths).toContainEqual(['beregnesSvieSmerteGodtgoerelse']);
    expect(result.unknownPaths).toContainEqual(['beregnesTabtArbejdsfortjeneste']);
    expect(result.unknownPaths).toContainEqual(['allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden']);
    expect(result.unknownPaths).toContainEqual(['allowReguleringMedUdloebMedMaaneder']);

    const parsed = erstatningsopgoerelseSchema.safeParse(result.sanitized);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    // Bevidst tab: den gamle 'Nej'-værdi videreføres IKKE; de nye felter får schema-default 'Ja'.
    expect(parsed.data.kravPaaSvieSmerteGodtgoerelse).toBe('Ja');
    expect(parsed.data.kravPaaTabtArbejdsfortjeneste).toBe('Ja');
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
