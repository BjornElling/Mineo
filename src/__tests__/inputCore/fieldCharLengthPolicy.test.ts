import { productionInputFields } from '../../inputCore/catalog/productionCatalog';
import {
  isTypedDraftFamily,
  resolveDraftLengthLimit,
} from '../../inputCore/react/fields/charLengthPolicy';
import { createIntegerFieldCodec, createOptionalTextFieldCodec } from '../../inputCore/fieldCodecs';
import { spliceDraftWithPaste } from '../../inputCore/react/pasteSplice';
import { isDraftWithinMaxLength } from '../../components/inputs/draftAdmission';
import type { FieldDescriptor, FieldRef } from '../../inputCore/fieldDescriptor';
import {
  stamdataAdvokatField,
  stamdataSagsbehandlerField,
  stamdataSkadelidteField,
} from '../../inputCore/catalog/stamdataDescriptors';

// VÆRN: ethvert felt, brugeren TASTER i, har en erklæret og virksom tegn-/længdegrænse.
//
// Baggrund. `input-field-behavior-contract.md` §1.2 erklærer reglen universelt: «Et inputfelt skal have en
// effektiv blokering mod, at der overhovedet kommer tegn ind i feltet, som ikke stemmer med feltets
// erklærede tegnsæt og maksimale længde.» Reglen var kun håndhævet dér, hvor nogen huskede den. Målingen
// 2026-08-15 fandt:
//
//   - 28 af 31 tekstfelter uden nogen grænse (bl.a. `Skadelidte`, `Journalnr.`, `Særlige kommentarer`
//     og alle syv bilagsnumre-felter). En indsat tekst på 50.000 tegn gik uændret ind i sagen.
//   - 8 af 12 heltalsfelter uden ciffergrænse — heriblandt `Méngrad`, hvis eget maksimum er 120.
//   - Brøk-, år- og ugefelternes grænse skrevet i hånden i komponenten frem for læst fra codecet;
//     `GridYearCell` greb ved en fejl DATO-konstanten (16 tegn) til et årsfelt, mens `YearField` brugte 4.
//
// Det er nøjagtig samme fejlmåde som datofelternes manglende grænser (`dateFieldsDeclareBounds.test.ts`,
// 31 af 54), og den er lukket på samme måde: erklæringen er gjort PÅKRÆVET i typen, og adfærden måles her.
//
// Værnet måler ADFÆRD, ikke kildekode: for hvert felt hentes den grænse, de to flader faktisk håndhæver,
// og der pastes en tekst, der er ét tegn for lang. Består feltet, er den overskydende tekst faktisk væk.

const typedFields = productionInputFields.filter((field) => isTypedDraftFamily(field.codec.family));

/** Binder feltet med et syntetisk række-id pr. entity-led, så også rækkefelter kan måles. */
const bindWithSyntheticRows = (field: FieldDescriptor<unknown>): FieldRef<unknown> =>
  field.bind(...field.template.path.flatMap((segment) => segment.kind === 'entity' ? ['row-1'] : []));

/**
 * Et loft, ingen indtastningsgrænse i programmet med rimelighed kan overstige.
 *
 * Kontrollen er bevidst grov: den skal fange et felt, der «erklærer» en grænse så høj, at den i praksis er
 * ingen grænse — ikke afgøre om 60 eller 100 er det rigtige tal. Beløbsudtryk har det højeste lovlige
 * loft (512 rå tegn, §2.2), og kommentarfelterne det samme.
 */
const ABSURD_LIMIT = 512;

describe('felter håndhæver deres erklærede tegn- og længdegrænse', () => {
  it('finder tastede felter i produktionskataloget (værnet kan ikke være grønt af tomhed)', () => {
    // Uden denne kontrol ville værnet bestå, hvis familielisten blev tømt eller kataloget forsvandt.
    expect(typedFields.length).toBeGreaterThanOrEqual(150);
    // Og hver af de familier, fundet handlede om, skal faktisk være med.
    const families = new Set(typedFields.map((field) => field.codec.family));
    for (const family of ['optionalText', 'integer', 'fraction', 'year', 'date', 'amount', 'percent']) {
      expect(families.has(family as never), `familien ${family} mangler i måleområdet`).toBe(true);
    }
  });

  it.each(typedFields.map((field) => [field.id, field] as const))(
    '%s erklærer en grænse, der faktisk afkorter et for langt paste',
    (_id, field) => {
      const ref = bindWithSyntheticRows(field);
      // Resolveren KASTER, hvis erklæringen mangler — det er selve værnet.
      const limit = resolveDraftLengthLimit(ref);

      expect(
        limit,
        `${field.id} (${field.codec.family}) har ingen erklæret længdegrænse. Erklær den på codecet, `
        + 'så begge flader håndhæver den samme (input-field-behavior-contract.md §1.2).',
      ).toBeDefined();
      if (limit === undefined) return;

      expect(limit).toBeGreaterThan(0);
      expect(
        limit,
        `${field.id} erklærer grænsen ${limit}, som i praksis er ingen grænse.`,
      ).toBeLessThanOrEqual(ABSURD_LIMIT);

      // ADFÆRDEN: den vej, en for lang tekst faktisk kommer ind ad. Uden `maxLength` ville splicen
      // skubbe draften vilkårligt langt forbi grænsen, fordi `onPaste` selv skriver draften (§1.2a).
      const overlong = 'x'.repeat(limit + 25);
      const spliced = spliceDraftWithPaste('', overlong, 0, 0, limit);
      expect(
        spliced.draft.length,
        `${field.id} tog imod ${spliced.draft.length} tegn, selv om grænsen er ${limit}.`,
      ).toBeLessThanOrEqual(limit);

      // Og den samme grænse skal afvise en direkte draft-ændring (skærmtastatur, autofyld, IME).
      expect(isDraftWithinMaxLength('x'.repeat(limit + 1), limit)).toBe(false);
      expect(isDraftWithinMaxLength('x'.repeat(limit), limit)).toBe(true);
    },
  );

  it('kontrollen kan FEJLE: et felt uden erklæring afvises af resolveren', () => {
    // Mutationstesten. Uden den ville testene ovenfor kunne være grønne af, at `resolveDraftLengthLimit`
    // altid svarede med et tal — og så ville en manglende erklæring aldrig blive fanget.
    const codecUdenGraense = {
      ...createOptionalTextFieldCodec({ maxLength: 10 }),
      maxLength: undefined,
    };
    const refUdenGraense = {
      descriptor: { id: 'test.udenGraense', codec: codecUdenGraense },
    } as unknown as FieldRef<string | undefined>;
    expect(() => resolveDraftLengthLimit(refUdenGraense)).toThrow(/mangler en erklæret maxLength/);

    const heltalUdenGraense = {
      descriptor: {
        id: 'test.heltalUdenGraense',
        codec: { ...createIntegerFieldCodec({ allowNegative: false, maxDigits: 3 }), maxDigits: undefined },
      },
    } as unknown as FieldRef<number | undefined>;
    expect(() => resolveDraftLengthLimit(heltalUdenGraense)).toThrow(/mangler et erklæret maxDigits/);
  });

  it('kontrollen måler den RIGTIGE mekanisme: uden grænse afkortes ingenting', () => {
    // Skelner måleopstillingen fra en konkurrerende forklaring? Samme splice UDEN grænse skal give hele
    // teksten igennem — ellers ville testen ovenfor kunne bestå af en helt anden begrænsning.
    const spliced = spliceDraftWithPaste('', 'x'.repeat(300), 0, 0, undefined);
    expect(spliced.draft.length).toBe(300);
  });

  it('grænsen blokerer LÆNGDE, ikke talværdi (§1.2)', () => {
    // Méngraden er det konkrete eksempel fra kontrakten: 121 skal fortsat kunne tastes og blive rødt,
    // mens et fjerde ciffer aldrig kommer ind i feltet.
    const mengrad = productionInputFields.find((field) => field.id === 'varigemen.mengrad');
    expect(mengrad).toBeDefined();
    if (mengrad === undefined) return;
    const limit = resolveDraftLengthLimit(bindWithSyntheticRows(mengrad));
    expect(limit).toBe(3);
    expect(spliceDraftWithPaste('', '121', 0, 0, limit).draft).toBe('121');
    expect(spliceDraftWithPaste('', '1210', 0, 0, limit).draft).toBe('121');
  });

  it('bruger det særskilte loft på seks tegn for Advokat og Sagsbehandler', () => {
    expect(stamdataAdvokatField.codec.maxLength).toBe(6);
    expect(stamdataSagsbehandlerField.codec.maxLength).toBe(6);
    expect(stamdataAdvokatField.codec.maxLength).not.toBe(stamdataSkadelidteField.codec.maxLength);
  });
});
