import type { InputReader } from '../../inputCore/inputReader';
import type { FieldRef } from '../../inputCore/fieldDescriptor';
import { runProjection, type ProjectionResult } from '../../inputCore/projection';
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

// Greenfield Varige mén-projektion (§3.4/§5.4, Fase 3 Varige mén-slice). En ALMINDELIG ren funktion over den
// offentlige `InputReader`, der erstatter MenberegningTab's rå `usePersistedForm`/`usePersistedSectionSelector`-
// læsning + `useFormFieldErrors`-gating. Den er den ENE kanoniske projektion til både sidevisning og
// dokumentgaten.
//
//  - Alle beregningsinputs (méngrad, beregningsdato, samt de tværsektionelle skadedato/fødselsdato fra stamdata)
//    læses gennem readeren. En rød feltfejl (rejected format ELLER canonical bounds — méngrad 1..120,
//    dato-orden/-range) skjules af readeren og bliver til en blokerende issue via `require`.
//  - Datoordenen (skadedato ≥ fødselsdato) er allerede en greenfield feltvalidator på begge stamdata-datoer, så
//    en byttet orden giver en rød feltfejl på skadedato/fødselsdato → projektionen blokerer uden en separat
//    `resolveStamdataDateOrder`-relation her.
//  - `require` på méngrad/beregningsdato/skadedato/fødselsdato giver en `missing`-consumerfejl, når feltet er tomt
//    (§1.7) — vises i contentboxen, blokerer kun denne consumer, ingen rød feltmarkering.
//  - `computeVarigeMenEngine` køres UÆNDRET på de reader-læste værdier → nul talændring (§5.4 hårdt stop). Et
//    gyldigt input uden lovsats for beregningsåret giver `beregningsResultat: null` inden for en `ready`
//    projektion (ingen rød fejl, ingen missing), præcis som legacy viste et tomt resultat.

const mengradRef: FieldRef<number | undefined> = varigeMenMengradField.bind();
const beregningsdatoRef: FieldRef<ISODateString | undefined> = varigeMenBeregningsdatoField.bind();
const skadedatoRef: FieldRef<ISODateString | undefined> = stamdataSkadedatoField.bind();
const fodselsdatoRef: FieldRef<ISODateString | undefined> = stamdataSkadelidteFodselsdatoField.bind();

export type VarigeMenProjectionData = Readonly<{
  mengrad: number;
  beregningsdato: ISODateString;
  fodselsdato: ISODateString;
  skadedato: ISODateString;
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
  runProjection(reader, VARIGE_MEN_DOCUMENT_CONSUMER_ID, (collector): VarigeMenProjectionData | undefined => {
    // require registrerer en rød feltfejl som blocker OG et tomt felt som `missing`. En `unavailable`-læsning
    // efterlader projektionen blokeret uanset hvad kroppen returnerer (den returnerede værdi bruges så aldrig).
    const mengradRead = collector.require(mengradRef);
    const beregningsdatoRead = collector.require(beregningsdatoRef);
    const fodselsdatoRead = collector.require(fodselsdatoRef);
    const skadedatoRead = collector.require(skadedatoRef);

    const mengrad = mengradRead.status === 'usable' ? mengradRead.value : undefined;
    const beregningsdato = beregningsdatoRead.status === 'usable' ? beregningsdatoRead.value : undefined;
    const fodselsdato = fodselsdatoRead.status === 'usable' ? fodselsdatoRead.value : undefined;
    const skadedato = skadedatoRead.status === 'usable' ? skadedatoRead.value : undefined;

    if (
      mengrad === undefined
      || beregningsdato === undefined
      || fodselsdato === undefined
      || skadedato === undefined
    ) {
      // Blokeret (rød fejl eller missing er registreret af `require`). `require` garanterer allerede ikke-tomhed
      // ved `usable`; denne guard narrower blot typen for de fire krævede felter.
      return undefined;
    }

    // Engine kører UÆNDRET (§5.4). Den returnerer null for domæneugyldigt input (fx méngrad uden for 1..120 —
    // her allerede fanget som rød bounds-fejl, eller manglende sats for beregningsåret).
    const { result } = computeVarigeMenEngine({
      varigemen: { mengrad, beregningsdato },
      skadestidspunkt: skadedato,
      rates: varigeMenPrGrad,
      fodselsdato,
    });

    return { mengrad, beregningsdato, fodselsdato, skadedato, beregningsResultat: result };
  });
