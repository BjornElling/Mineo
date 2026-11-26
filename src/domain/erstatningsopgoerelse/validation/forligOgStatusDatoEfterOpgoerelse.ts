import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { isoToDanish, type ISODateString } from '../../../types/branded';
import { getDayAfterIso } from '../../../utils/isoDateHelpers';

/**
 * Forligsdato og statusdato efter «Opgørelse lavet den».
 *
 * Samme mekanisme som AES-datoernes advarsel (`aesDatoEfterOpgoerelse.ts`): dokumentet er dateret
 * «Opgørelse lavet den», så et forlig eller en status dateret senere står som en begivenhed, papiret
 * beskriver som sket. Reglerne er bevidst IKKE-blokerende: dokument, beløb og download er
 * uændrede – en revideret opgørelse kan legitimt bære den oprindelige opgørelsesdato, og en opgørelse kan
 * opgøres fremad. Samme tekst står som gul ring ved feltet og i «Fejl og advarsler».
 *
 * Kun Erstatningsopgørelsen har en dokumentdato at sammenligne med. Forligsfelterne deles med
 * Erhvervsevnetab → EET oplysninger, men EET-dokumenterne dateres med dags dato i brevhovedet, og
 * forligsdatoen kan ikke ligge efter dags dato; EET's «Beregningsdato» er en beregningsreference, ikke
 * dokumentets dato.
 */

const formatOpgoerelseDato = (dato: ISODateString): string => isoToDanish(dato) ?? dato;

const erEfterOpgoerelse = (
  dato: ISODateString | undefined,
  opgoerelseDato: ISODateString | undefined
): opgoerelseDato is ISODateString => dato !== undefined && opgoerelseDato !== undefined && dato > opgoerelseDato;

type ForligDatoValues = Pick<ErstatningsopgoerelseValues, 'opgørelseLavetDen' | 'forligDato'>;

export const resolveForligDatoEfterOpgoerelseMessage = (values: ForligDatoValues): string | undefined => {
  const opgoerelseDato = values.opgørelseLavetDen;
  if (!erEfterOpgoerelse(values.forligDato, opgoerelseDato)) return undefined;
  return `Forliget er dateret efter opgørelsens dato (${formatOpgoerelseDato(opgoerelseDato)})`;
};

/** De to statusfelter under «Status den …». */
export type StatusDatoEfterOpgoerelseFelt = 'svieSmerteHelbredsstatus' | 'tafArbejdsstatus';

type StatusDatoValues = Pick<
  ErstatningsopgoerelseValues,
  | 'opgørelseLavetDen'
  | 'vedroererPeriodeTil'
  | 'svieSmerteHelbredsstatus'
  | 'tafArbejdsstatus'
  | 'kravPaaSvieSmerteGodtgoerelse'
  | 'kravPaaTabtArbejdsfortjeneste'
>;

/**
 * Statusfeltets krav: «Helbredsforhold» trykkes kun i svie/smerte-afsnittet og «Arbejdssituation» kun i
 * TAF-afsnittet. Samme relevans som Beregning-rækkernes (`eoRowAggregator`), så feltet og «Fejl og
 * advarsler» aldrig siger to forskellige ting.
 */
const erStatusKravRejst = (felt: StatusDatoEfterOpgoerelseFelt, values: StatusDatoValues): boolean =>
  felt === 'svieSmerteHelbredsstatus'
    ? values.kravPaaSvieSmerteGodtgoerelse === 'Ja'
    : values.kravPaaTabtArbejdsfortjeneste === 'Ja';

/**
 * Statusdatoen er dagen efter erstatningsperiodens slutdato (dag-efter-reglen) – samme udledning som
 * underoverskriften «Status den …» og dokumentets statuslinjer. Advarslen kræver en valgt status: et tomt
 * statusfelt giver ingen tekst i dokumentet og dermed ingen modsætning. Ved lighed er der ingen advarsel.
 */
export const resolveStatusDatoEfterOpgoerelseMessage = (
  felt: StatusDatoEfterOpgoerelseFelt,
  values: StatusDatoValues
): string | undefined => {
  if (values[felt] === undefined || !erStatusKravRejst(felt, values)) return undefined;
  const opgoerelseDato = values.opgørelseLavetDen;
  if (!erEfterOpgoerelse(getDayAfterIso(values.vedroererPeriodeTil), opgoerelseDato)) return undefined;
  return `Statusdatoen ligger efter opgørelsens dato (${formatOpgoerelseDato(opgoerelseDato)})`;
};
