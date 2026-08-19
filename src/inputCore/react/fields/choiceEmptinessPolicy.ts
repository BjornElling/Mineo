import type { FieldRef } from '../../fieldDescriptor';

/**
 * Om en valg-kontrol må tilbyde det tomme placeholder-valg – udledt af feltets codec.
 *
 * **Hvorfor politikken skal komme fra codecet.** Reglen «denne dropdown må ikke være tom» var udtrykt som
 * en håndskrevet `allowEmpty={false}` på hvert enkelt kaldssted – 23 steder. Descriptoren VED det allerede:
 * et `requiredChoice`-codec oversætter tom tekst til en gyldig default ('dage', 'maaned', 'Nej' …) og har
 * dermed pr. konstruktion ingen tom tilstand. Men intet bandt de to sammen, så en glemt prop lod brugeren
 * rydde et påkrævet felt med Delete – og fejlen viste sig først som et kast et helt andet sted, når
 * værdien faktisk blev `undefined`.
 *
 * Det er samme fejlmåde som fortegns- og længdepolitikken (`signPolicy.ts`, `charLengthPolicy.ts`): en
 * egenskab, der ER erklæret på codecet, havde ingen vej frem til det sted, den skal virke.
 *
 * **Proppen kan skærpe, aldrig løsne.** Et valgfrit felt kan godt have en domæneregel om, at et valg er
 * påkrævet – den må kaldsstedet fortsat udtrykke. Men et `requiredChoice`-felt kan ikke gøres tømbart;
 * dét afvises, fordi resultatet ville være en tilstand, feltets eget codec erklærer umulig.
 */
export const resolveChoiceAllowEmpty = <T>(
  field: FieldRef<T>,
  explicit: boolean | undefined,
  controlName: string
): boolean => {
  const isRequiredChoice = field.descriptor.codec.family === 'requiredChoice';
  if (isRequiredChoice) {
    if (explicit === true) {
      throw new Error(
        `${controlName}(${field.descriptor.id}): feltet har et requiredChoice-codec med en gyldig `
        + 'tomværdi og kan derfor ikke tilbyde et tomt valg. Fjern allowEmpty.'
      );
    }
    return false;
  }
  return explicit ?? true;
};
