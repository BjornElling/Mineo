// @vitest-environment jsdom
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { neutralizeIrrelevantEoInputs } from '../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { erstatningsopgoerelseSchema } from '../../../schemas/formSchemas';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { nullToUndefinedDeep } from '../../../utils/nullToUndefinedDeep';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

/**
 * Krav: indtastninger i SKJULTE felter må aldrig gå tabt ved F5 eller .eo-save, men de må
 * heller aldrig påvirke beregninger. Disse to krav skal være afkoblet:
 *  - Save/F5 persisterer RÅ committed input (ingen neutralisering) → skjulte værdier bevares.
 *  - Beregningen læser effectiveEoValues (neutraliseret) → skjulte værdier ignoreres.
 *
 * `.eo`-save/load og F5-sessionStorage deler præcis samme serialiserings-/parse-kerne:
 *   canonical sektion → `JSON.stringify` (containeren/envelopen) → `JSON.parse`
 *   → `nullToUndefinedDeep` (inbound-transformens første trin, §3.1a) → `schema.parse`.
 * Vi kører den kerne her som én round-trip og hævder, at hvert skjult felt overlever.
 *
 * Kæden bar tidligere et ekstra `serializeFormValues`-trin (undefined→null), som produktionen IKKE
 * udfører: `encodeEoFile`/current-session-envelopen stringify'er den schema-parsede sektion direkte, og
 * `JSON.stringify` DROPPER `undefined`-nøgler frem for at nulle dem. Den gamle udgave gjorde derfor
 * round-trippen lettere end virkeligheden — et felt, hvis schema kun tolererer `null` men ikke fravær,
 * ville bestå her og fejle i produktionen. Trinnet fulgte med GM-F09's slettede `buildPersistedSection`
 * (se INC-F15).
 */
const roundTripSaveLoad = (values: ErstatningsopgoerelseValues): ErstatningsopgoerelseValues => {
  const throughFile = JSON.parse(JSON.stringify(values)) as unknown;
  const restored = nullToUndefinedDeep(throughFile);
  return erstatningsopgoerelseSchema.parse(restored);
};

/**
 * Alle synligheds-toggles står i den tilstand, der SKJULER deres afhængige felter — men
 * felterne er udfyldt. En korrekt persistens må bevare dem alle.
 */
const makeAllHiddenButFilled = (): ErstatningsopgoerelseValues => ({
  ...structuredClone(createErstatningsopgoerelseInitialValues()),

  // Varige mén-afgørelse slået fra, men dato + klage udfyldt
  varigeMenAfgorelse: 'Nej',
  menAfgoerelseDato: iso('2024-03-01'),
  verserendeKlageMen: 'Ja',

  // EET-afgørelser slået fra, men datoer + klage udfyldt
  midlertidigtEETAfgorelse: 'Nej',
  midlertidigEETAfgoerelseDato: iso('2024-04-01'),
  midlertidigEETVirkningsdato: iso('2024-04-15'),
  endeligtEETAfgorelse: 'Nej',
  endeligEETAfgoerelseDato: iso('2024-05-01'),
  endeligEETVirkningsdato: iso('2024-05-15'),
  verserendeKlageEet: 'Ja',

  // Svie/smerte: sektion slået fra (skjuler alt), men periodeinput + tidligere-total udfyldt
  kravPaaSvieSmerteGodtgoerelse: 'Nej',
  tidligereSsMax: 'Ja',
  svieSmertePerioder: [{ id: 's1', fra: iso('2024-01-01'), til: iso('2024-02-01'), tilstand: 'sygemeldt' }],
  svieSmerteSatserAar: 2025,
  svieSmerteTidligereTotal: amount(50_000),
  svieSmerteAktuelPeriode: amount(12_000),

  // TAF: sektion slået fra, men perioder + ferie + tidligere-modtaget udfyldt
  kravPaaTabtArbejdsfortjeneste: 'Nej',
  tafPerioder: [{ id: 't1', fra: iso('2024-01-01'), til: iso('2024-02-01'), loseFeriedage: 3 }],
  ferieperioder: [{ id: 'f1', fra: iso('2024-01-10'), til: iso('2024-01-12') }],
  tidligereModtagetTaf: amount(8_000),

  // Øvrige krav: slået fra, men rækker udfyldt
  kravPaaOevrigeErstatningskrav: 'Nej',
  oevrigeKravPerioder: [{ id: 'o1', dato: iso('2024-01-01'), udgiftTil: 'Medicin', beloeb: amount(450) }],

  // Bilagsnumre skjult, men felter udfyldt
  visBilagsnumre: 'Nej',
  bilagsnumreMenAfgoerelse: 'B1',
  bilagsnumreEetAfgoerelser: 'B2',
  bilagsnumreSvieSmerteDokumentation: 'B3',
  bilagsnumreBeregningsgrundlagTaf: 'B4',
  bilagsnumreLoenISygeperioden: 'B5',
  bilagsnumreOffentligeYdelser: 'B6',
  bilagsnumreOevrigeErstatningskrav: 'B7',
});

describe('EO skjulte felters persistens (krav 1) vs. beregnings-neutralisering (krav 2)', () => {
  describe('krav 1 — save/load + F5 bevarer skjulte felters værdier', () => {
    it('bevarer ALLE skjulte felter gennem save→load-round-trip', () => {
      const original = makeAllHiddenButFilled();
      const restored = roundTripSaveLoad(original);

      expect(restored.menAfgoerelseDato).toBe(original.menAfgoerelseDato);
      expect(restored.verserendeKlageMen).toBe('Ja');
      expect(restored.midlertidigEETAfgoerelseDato).toBe(original.midlertidigEETAfgoerelseDato);
      expect(restored.midlertidigEETVirkningsdato).toBe(original.midlertidigEETVirkningsdato);
      expect(restored.endeligEETAfgoerelseDato).toBe(original.endeligEETAfgoerelseDato);
      expect(restored.endeligEETVirkningsdato).toBe(original.endeligEETVirkningsdato);
      expect(restored.verserendeKlageEet).toBe('Ja');

      expect(restored.svieSmertePerioder).toEqual(original.svieSmertePerioder);
      expect(restored.svieSmerteSatserAar).toBe(2025);
      expect(restored.svieSmerteTidligereTotal).toEqual(amount(50_000));
      expect(restored.svieSmerteAktuelPeriode).toEqual(amount(12_000));

      expect(restored.tafPerioder).toEqual(original.tafPerioder);
      expect(restored.ferieperioder).toEqual(original.ferieperioder);
      expect(restored.tidligereModtagetTaf).toEqual(amount(8_000));

      expect(restored.oevrigeKravPerioder).toEqual(original.oevrigeKravPerioder);

      expect(restored.bilagsnumreMenAfgoerelse).toBe('B1');
      expect(restored.bilagsnumreEetAfgoerelser).toBe('B2');
      expect(restored.bilagsnumreSvieSmerteDokumentation).toBe('B3');
      expect(restored.bilagsnumreBeregningsgrundlagTaf).toBe('B4');
      expect(restored.bilagsnumreLoenISygeperioden).toBe('B5');
      expect(restored.bilagsnumreOffentligeYdelser).toBe('B6');
      expect(restored.bilagsnumreOevrigeErstatningskrav).toBe('B7');
    });

    it('bevarer skjulte sygeferiegodtgørelse-rækkefelter (per-række relevans)', () => {
      const original: ErstatningsopgoerelseValues = {
        ...makeAllHiddenButFilled(),
        sfggAnsaettelsesforhold: [
          {
            ansaettelsesforholdId: 'a1',
            // kilde 'Manuelt angivet' skjuler reference-periode-felterne i UI'en
            sfggBeregningskilde: 'Manuelt angivet',
            sfggReferenceperiodeFra: iso('2023-01-01'),
            sfggReferenceperiodeTil: iso('2023-06-30'),
            sfggReferenceperiodeFravaersdageUdenLoen: 5,
            sfggManuelDagssats: amount(1_200),
            sfggManuelBeloebIHenholdTil: 'Aftale',
            sfggManuelFoerstEfterSygeloen: 'Ja',
            sfggSatsvalg: undefined,
            sfggAlleredeBetaltBeloeb: amount(3_000),
          },
        ],
      };
      const restored = roundTripSaveLoad(original);
      expect(restored.sfggAnsaettelsesforhold).toEqual(original.sfggAnsaettelsesforhold);
    });
  });

  describe('krav 2 — beregningen neutraliserer de samme skjulte felter (save-stien er upåvirket)', () => {
    it('neutralizeIrrelevantEoInputs blanker talfødende skjulte felter, men muterer ikke originalen', () => {
      const original = makeAllHiddenButFilled();
      const effective = neutralizeIrrelevantEoInputs(original);

      // Talfødende skjulte felter er neutraliseret i beregningskopien
      expect(effective.svieSmertePerioder).toEqual([]);
      expect(effective.svieSmerteSatserAar).toBeUndefined();
      expect(effective.svieSmerteTidligereTotal).toBeUndefined();
      expect(effective.svieSmerteAktuelPeriode).toBeUndefined();
      expect(effective.tafPerioder).toEqual([]);
      expect(effective.ferieperioder).toEqual([]);
      expect(effective.tidligereModtagetTaf).toBeUndefined();
      expect(effective.oevrigeKravPerioder).toEqual([]);

      // Originalen (= det der persisteres) er uændret
      expect(original.svieSmertePerioder).toHaveLength(1);
      expect(original.tafPerioder).toHaveLength(1);
      expect(original.tidligereModtagetTaf).toEqual(amount(8_000));
    });
  });
});
