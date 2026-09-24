import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { isoToDanish, type ISODateString } from '../../../types/branded';
import {
  erEndeligtEETAfgoerelseAktiv,
  erMidlertidigtEETAfgoerelseAktiv,
  erVarigeMenAfgoerelseAktiv,
} from '../helpers/eoInputRelevance';

/**
 * En afgørelses- eller differencekravsdato efter «Opgørelse lavet den» (BB-242).
 *
 * Papiret bruger opgørelsens dato som sin status-dato («Der er den 1. februar 2025 ikke truffet afgørelse
 * om …»), så en afgørelse dateret EFTER den er en begivenhed, dokumentet ikke kan kende. Den sandsynlige
 * årsag er en tastefejl i året eller en «Opgørelse lavet den», der ikke er rettet frem, da sagen blev
 * genoptaget.
 *
 * IKKE-blokerende (udviklerafgørelse 2026-09-24): afgørelsen trykkes uændret – den er en relevant
 * orientering – og hverken beløb eller download påvirkes. Reglen spørger kun, om datoen er tastet rigtigt.
 * Samme tekst står som gul ring ved feltet og i «Fejl og advarsler».
 *
 * Virkningsdatoerne er bevidst udenfor: en virkningsdato kan lovligt ligge frem i tid.
 */
export type AesDatoEfterOpgoerelseFelt =
  | 'menAfgoerelseDato'
  | 'midlertidigEETAfgoerelseDato'
  | 'endeligEETAfgoerelseDato'
  | 'differencekravDato';

type AesDatoValues = Pick<
  ErstatningsopgoerelseValues,
  | 'opgørelseLavetDen'
  | 'varigeMenAfgorelse'
  | 'menAfgoerelseDato'
  | 'midlertidigtEETAfgorelse'
  | 'midlertidigEETAfgoerelseDato'
  | 'endeligtEETAfgorelse'
  | 'endeligEETAfgoerelseDato'
  | 'differencekravDato'
>;

/** Feltets dato – kun når feltet er synligt (et skjult felt er pr. definition ikke udfyldt, BB-222). */
const resolveSynligDato = (felt: AesDatoEfterOpgoerelseFelt, values: AesDatoValues): ISODateString | undefined => {
  switch (felt) {
    case 'menAfgoerelseDato':
      return erVarigeMenAfgoerelseAktiv(values) ? values.menAfgoerelseDato : undefined;
    case 'midlertidigEETAfgoerelseDato':
      return erMidlertidigtEETAfgoerelseAktiv(values) ? values.midlertidigEETAfgoerelseDato : undefined;
    case 'endeligEETAfgoerelseDato':
      return erEndeligtEETAfgoerelseAktiv(values) ? values.endeligEETAfgoerelseDato : undefined;
    case 'differencekravDato':
      return values.differencekravDato;
  }
};

export const resolveAesDatoEfterOpgoerelseMessage = (
  felt: AesDatoEfterOpgoerelseFelt,
  values: AesDatoValues
): string | undefined => {
  const dato = resolveSynligDato(felt, values);
  const opgoerelseDato = values.opgørelseLavetDen;
  if (dato === undefined || opgoerelseDato === undefined || dato <= opgoerelseDato) return undefined;
  const opgoerelseDatoTekst = isoToDanish(opgoerelseDato) ?? opgoerelseDato;
  return felt === 'differencekravDato'
    ? `Differencekravet er opgjort pr. en dato efter opgørelsens dato (${opgoerelseDatoTekst})`
    : `Afgørelsen er dateret efter opgørelsens dato (${opgoerelseDatoTekst})`;
};
