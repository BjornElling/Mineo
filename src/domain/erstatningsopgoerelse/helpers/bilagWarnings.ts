import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { isOevrigeKravRowEmpty } from './rowEmpty';
import { hasIndtastetLoenoplysninger } from './loenoplysningerInput';
import { getOffentligeYdelserRowFilledState } from '../validation/offentligeYdelserTableValidation';

/**
 * Returnerer en advarselstekst hvis konteksten er inkonsistent med at bilagsnummeret er sat
 * (fx bilagsnummer for ménafgørelse sat, men ingen afgørelse truffet).
 *
 * Returnerer null hvis konteksten er konsistent, hvis value er tom/undefined,
 * eller hvis fieldName ikke er kendt.
 */
export function resolveBilagWarning(values: ErstatningsopgoerelseValues, fieldName: string, value: string | undefined): string | null {
  if (!value || value.trim() === '') return null;
  switch (fieldName) {
    case 'bilagsnumreMenAfgoerelse':
      return values.varigeMenAfgorelse !== 'Ja'
        ? 'Der er angivet bilagsnummer for ménafgørelse, men angivet at der ikke er truffet afgørelse'
        : null;
    case 'bilagsnumreEetAfgoerelser':
      return values.midlertidigtEETAfgorelse !== 'Ja' && values.endeligtEETAfgorelse !== 'Ja'
        ? 'Der er angivet bilagsnummer for EET-afgørelser, men angivet at der ikke er truffet afgørelse'
        : null;
    case 'bilagsnumreSvieSmerteDokumentation':
      return values.beregnesSvieSmerteGodtgoerelse !== 'Ja'
        ? 'Der er angivet bilagsnummer for svie/smerte dokumentation, men angivet at svie/smerte ikke beregnes'
        : null;
    case 'bilagsnumreBeregningsgrundlagTaf':
      return values.beregnesTabtArbejdsfortjeneste !== 'Ja'
        ? 'Der er angivet bilagsnummer for Beregningsgrundlag for TAF, men angivet at tabt arbejdsfortjeneste ikke beregnes'
        : null;
    case 'bilagsnumreLoenISygeperioden': {
      if (values.beregnesTabtArbejdsfortjeneste !== 'Ja') {
        return 'Der er angivet bilagsnummer for Løn i sygeperioden, men angivet at tabt arbejdsfortjeneste ikke beregnes';
      }
      const harLoenoplysninger = values.loenindkomstAnsaettelsesforhold.some(
        (af) => hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData)
      );
      return harLoenoplysninger
        ? null
        : 'Der er angivet bilagsnummer for Løn i sygeperioden, men der er ikke indtastet lønoplysninger';
    }
    case 'bilagsnumreOffentligeYdelser': {
      if (values.beregnesTabtArbejdsfortjeneste !== 'Ja') {
        return 'Der er angivet bilagsnummer for Offentlige ydelser, men angivet at tabt arbejdsfortjeneste ikke beregnes';
      }
      const harUdfyldteYdelser = values.offentligeYdelserRows.some(
        (row) => getOffentligeYdelserRowFilledState(row).hasAnyFilled
      );
      return harUdfyldteYdelser
        ? null
        : 'Der er angivet bilagsnummer for offentlige ydelser, men der er ikke indtastet offentlige ydelser';
    }
    case 'bilagsnumreOevrigeErstatningskrav': {
      // Øvrige erstatningskrav er ikke TAF-afhængige; kun faktisk udfyldte krav styrer advarslen.
      const harOevrigeKrav = values.oevrigeKravPerioder.some((row) => !isOevrigeKravRowEmpty(row));
      return harOevrigeKrav
        ? null
        : 'Der er angivet bilagsnummer for øvrige erstatningskrav, men der er ikke indtastet øvrige krav';
    }
    default:
      return null;
  }
}
