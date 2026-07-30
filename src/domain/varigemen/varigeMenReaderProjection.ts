import type { InputReader } from '../../inputCore/inputReader';
import type { FieldRef } from '../../inputCore/fieldDescriptor';
import { mapReadyProjection, runProjection, type ProjectionResult } from '../../inputCore/projection';
import type { ISODateString } from '../../types/branded';
import { varigeMenPrGrad } from '../../data/lovbestemteRates';
import {
  varigeMenBeregningsdatoField,
  varigeMenMengradField,
} from '../../inputCore/catalog/varigeMenDescriptors';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../inputCore/catalog/stamdataDescriptors';
import { computeVarigeMenEngine } from './varigeMenEngine';
import type { VarigeMenBeregningResult } from './varigeMenCalculations';

// Varige mén-projektionen (§3.4/§5.4). En ALMINDELIG ren funktion over den
// offentlige `InputReader`. Den afløste `MenberegningTab`s rå `usePersistedForm`/`usePersistedSectionSelector`-
// læsning + `useFormFieldErrors`-gating. Den er den ENE kanoniske projektion til både sidevisning og
// dokumentgaten.
//
//  - Alle beregningsinputs (méngrad, beregningsdato, samt de tværsektionelle skadedato/fødselsdato fra stamdata)
//    læses gennem readeren. En rød feltfejl (rejected format ELLER canonical bounds — méngrad 1..120,
//    dato-orden/-range) skjules af readeren og bliver til en blokerende issue via `require`.
//  - Datoordenen (skadedato ≥ fødselsdato) er allerede en feltvalidator på begge stamdata-datoer, så
//    en byttet orden giver en rød feltfejl på skadedato/fødselsdato → projektionen blokerer uden en separat
//    `resolveStamdataDateOrder`-relation her.
//  - `require` på méngrad/beregningsdato/skadedato/fødselsdato giver en `missing`-consumerfejl, når feltet er tomt
//    (§1.7) — vises i contentboxen, blokerer kun denne consumer, ingen rød feltmarkering.
//  - `computeVarigeMenEngine` køres UÆNDRET på de reader-læste værdier → nul talændring (§5.4 hårdt stop). Et
//    gyldigt input uden lovsats for beregningsåret giver `beregningsResultat: null` inden for en `ready`
//    projektion (ingen rød fejl, ingen missing), så visningen bliver tom.

const mengradRef: FieldRef<number | undefined> = varigeMenMengradField.bind();
const beregningsdatoRef: FieldRef<ISODateString | undefined> = varigeMenBeregningsdatoField.bind();
const skadedatoRef: FieldRef<ISODateString | undefined> = stamdataSkadedatoField.bind();
const fodselsdatoRef: FieldRef<ISODateString | undefined> = stamdataSkadelidteFodselsdatoField.bind();

/**
 * Motorens typede input. At det er en NAVNGIVEN type frem for fire lokale variabler er hele pointen: den
 * gør `ready`-overgangen til en typegrænse. Kan et fremtidigt read ikke leveres, findes typen ikke, og
 * motorkaldet kompilerer ikke — modsat en lokal `if`-guard, som skal huskes udvidet.
 */
type VarigeMenEngineInput = Readonly<{
  mengrad: number;
  beregningsdato: ISODateString;
  fodselsdato: ISODateString;
  skadedato: ISODateString;
}>;

export type VarigeMenProjectionData = VarigeMenEngineInput & Readonly<{
  /** Den autoritative beregning; `null` når et gyldigt input alligevel ikke kan give et resultat. */
  beregningsResultat: VarigeMenBeregningResult | null;
}>;

export type VarigeMenReaderProjection = ProjectionResult<VarigeMenProjectionData>;

const VARIGE_MEN_DOCUMENT_CONSUMER_ID = 'document.varigemen';

/**
 * Bygger den kanoniske reader-afledte projektion for Varige mén. Enhver rød feltfejl på et læst felt
 * (méngrad-bounds, dato-range/-orden, format) blokerer; et tomt påkrævet felt giver en `missing`-consumerfejl;
 * kun `ready` fører méngrad + datoer til den autoritative engine.
 */
export const buildVarigeMenReaderProjection = (reader: InputReader): VarigeMenReaderProjection =>
  // Trin 1: `runProjection` læser motorinput og afgør ready|blocked. Trin 2: `mapReadyProjection` kalder
  // motoren KUN i ready-grenen. Motoren ligger BEVIDST uden for kroppen: kroppen udføres, FØR statussen er
  // afgjort, så et motorkald derinde ville køre også når projektionen ender blokeret (§3.9). Tidligere lå
  // kaldet inde i kroppen bag fire manuelle undefined-guards; de dækkede de fire aktuelle dependencies, men
  // sikkerheden hvilede på, at et fremtidigt read også blev tilføjet til guarden.
  mapReadyProjection(
    runProjection(reader, VARIGE_MEN_DOCUMENT_CONSUMER_ID, (collector): VarigeMenEngineInput | undefined => {
      // require registrerer en rød feltfejl som blocker OG et tomt felt som `missing`. En `unavailable`-læsning
      // efterlader projektionen blokeret uanset hvad kroppen returnerer (den returnerede værdi bruges så aldrig).
      const mengrad = collector.require(mengradRef);
      const beregningsdato = collector.require(beregningsdatoRef);
      const fodselsdato = collector.require(fodselsdatoRef);
      const skadedato = collector.require(skadedatoRef);

      if (
        mengrad.status !== 'usable'
        || beregningsdato.status !== 'usable'
        || fodselsdato.status !== 'usable'
        || skadedato.status !== 'usable'
      ) {
        // Blokeret; `require` har allerede registreret den røde fejl eller det manglende felt.
        return undefined;
      }

      return {
        mengrad: mengrad.value,
        beregningsdato: beregningsdato.value,
        fodselsdato: fodselsdato.value,
        skadedato: skadedato.value,
      };
    }),
    // Engine kører UÆNDRET (§5.4). Den returnerer null for domæneugyldigt input (fx manglende sats for
    // beregningsåret); méngrad uden for 1..120 er allerede fanget som rød bounds-fejl i trin 1.
    (input): VarigeMenProjectionData => ({
      ...input,
      beregningsResultat: computeVarigeMenEngine({
        varigemen: { mengrad: input.mengrad, beregningsdato: input.beregningsdato },
        skadestidspunkt: input.skadedato,
        rates: varigeMenPrGrad,
        fodselsdato: input.fodselsdato,
      }).result,
    })
  );
