import type {
  ErstatningsopgoerelseValues,
  LoenindkomstAnsaettelsesforhold,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../../schemas/formSchemas';
import { getOverenskomstSfggPolicy } from '../../../data/overenskomstRates';
import { hasSfggSelectedOverenskomst } from '../engines/sfggKilde';
import { shouldRequireSygeferiegodtgoerelseInput } from './sygeferiegodtgoerelseEligibility';

/**
 * Synlighed og relevans for sygeferiegodtgørelsens felter på et ansættelsesforhold (Lønindkomst-fanen).
 *
 * BAGGRUND: Felterne stod før KUN bag JSX-betingelser i `SygeferiegodtgoerelseSection`, mens descriptorerne var
 * relevante altid. En rød referenceperiode bag «Manuelt angivet», eller 400 fraværsdage bag et slukket TAF-krav,
 * blev derfor ved med at spærre opgørelsen med en linje om et felt, brugeren ikke kunne se (BB-228-familien).
 *
 * Modulet er den ENESTE kilde til, hvornår et SFGG-felt vises: VM'en (`getSfggPresentation`) afleder sektionens
 * flag herfra, og descriptorernes `relevance` kalder {@link erSfggFeltRelevant} med de samme input. Dermed kan
 * «vist» og «læst» ikke divergere: en relevans smallere end synligheden ville lade en synlig værdi forsvinde, en
 * bredere ville lade en skjult værdi spærre.
 *
 * Beregningskilden selv er ikke omfattet: den er et valg uden fejltilstand, og den styrer bilagsvalgets
 * tilgængelighed også uden for sektionen. Felterne bag den er derimod relevante efter kilden, som den vises.
 *
 * Bemærk den ene bevidste forskel mod motorens kildeopløsning (`resolveSfggSource`): ved «Overenskomst» UDEN en
 * aktiv overenskomst regner motoren videre i ferielov-sporet, men sektionen skjuler referenceperioden, og
 * validatoren spærrer opgørelsen med «Der skal være valgt en overenskomst …». Referenceperioden er da skjult og
 * dermed ikke udfyldt; den spærrede tilstand leverer intet dokument, så intet leveret tal ændrer sig.
 */

/** Et felt (eller en feltgruppe) i SFGG-sektionen, opdelt efter den betingelse, der viser det. */
export type SfggFelt =
  /** «Referenceperiode» (fra/til) og «Evt. ferie- og fraværsdage i referenceperioden uden løn». */
  | 'referenceperiode'
  /** «Angiv skadelidtes uddannelse og arbejdssted». */
  | 'satsvalg'
  /** Dagssats, «Beløbet er i henhold til» og «Først sygeferiegodtgørelse efter ophør af sygeløn». */
  | 'manuel'
  /** «Evt. allerede betalt sygeferiegodtgørelse i denne erstatningsperiode». */
  | 'alleredeBetalt';

export type SfggRelevansInput = Readonly<{
  kravPaaTabtArbejdsfortjeneste: ErstatningsopgoerelseValues['kravPaaTabtArbejdsfortjeneste'];
  /** Ansættelsesforholdet, SFGG-rækken hører til – `undefined` for en række uden ansættelsesforhold. */
  employment: Pick<LoenindkomstAnsaettelsesforhold, 'ansatPaaSkadestidspunktet' | 'harOverenskomst' | 'overenskomstId'> | undefined;
  sfggBeregningskilde: SygeferiegodtgoerelseAnsaettelsesforholdRow['sfggBeregningskilde'];
}>;

export type SfggSynlighed = Readonly<{
  /** Sektionen vises: TAF-kravet er «Ja», og skadelidte var ansat på skadestidspunktet. */
  sektionVist: boolean;
  /** «Overenskomst» er valgt, og ansættelsesforholdet har en aktiv overenskomst. */
  harValgtOverenskomst: boolean;
  policy: ReturnType<typeof getOverenskomstSfggPolicy> | undefined;
  /** Overenskomstens detaljer kan vises: kilden er ikke «Overenskomst», eller der er en aktiv overenskomst. */
  overenskomstDetaljerVist: boolean;
  kraeverReferenceperiode: boolean;
  satsvalgVist: boolean;
}>;

export const resolveSfggSynlighed = (input: SfggRelevansInput): SfggSynlighed => {
  const { employment, sfggBeregningskilde: kilde } = input;
  const sektionVist = employment !== undefined && shouldRequireSygeferiegodtgoerelseInput(input, employment);
  const harValgtOverenskomst = employment !== undefined
    && hasSfggSelectedOverenskomst({ sfggBeregningskilde: kilde }, employment);
  const policy = employment?.overenskomstId ? getOverenskomstSfggPolicy(employment.overenskomstId) : undefined;
  return {
    sektionVist,
    harValgtOverenskomst,
    policy,
    overenskomstDetaljerVist: kilde !== 'Overenskomst' || harValgtOverenskomst,
    kraeverReferenceperiode: kilde === 'Ferieloven'
      || (kilde === 'Overenskomst' && harValgtOverenskomst && policy?.model !== 'direkte_sats'),
    satsvalgVist: kilde === 'Overenskomst'
      && harValgtOverenskomst
      && policy?.model === 'direkte_sats'
      && policy.direkteSatsErDifferentieret,
  };
};

/** Om feltet vises – og dermed læses – i den aktuelle tilstand. Samme betingelser som `SygeferiegodtgoerelseSection`. */
export const erSfggFeltRelevantForSynlighed = (felt: SfggFelt, synlighed: SfggSynlighed, kilde: SfggRelevansInput['sfggBeregningskilde']): boolean => {
  if (!synlighed.sektionVist) return false;
  switch (felt) {
    case 'referenceperiode':
      return synlighed.overenskomstDetaljerVist && synlighed.kraeverReferenceperiode;
    case 'satsvalg':
      return synlighed.overenskomstDetaljerVist && synlighed.satsvalgVist;
    case 'manuel':
      return kilde === 'Manuelt angivet';
    case 'alleredeBetalt':
      return kilde !== undefined && kilde !== 'Ingen' && synlighed.overenskomstDetaljerVist;
    default: {
      const _exhaustive: never = felt;
      return _exhaustive;
    }
  }
};

export const erSfggFeltRelevant = (felt: SfggFelt, input: SfggRelevansInput): boolean =>
  erSfggFeltRelevantForSynlighed(felt, resolveSfggSynlighed(input), input.sfggBeregningskilde);
