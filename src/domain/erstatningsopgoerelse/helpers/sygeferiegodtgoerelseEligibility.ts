import type { ErstatningsopgoerelseValues, LoenindkomstAnsaettelsesforhold } from '../../../schemas/formSchemas';

export function shouldRequireSygeferiegodtgoerelseInput(
  values: Pick<ErstatningsopgoerelseValues, 'kravPaaTabtArbejdsfortjeneste'>,
  employment: Pick<LoenindkomstAnsaettelsesforhold, 'ansatPaaSkadestidspunktet'>
): boolean {
  return values.kravPaaTabtArbejdsfortjeneste === 'Ja' && employment.ansatPaaSkadestidspunktet;
}
