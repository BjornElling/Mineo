import { isoToDanish, type ISODateString } from '../../types/branded';
import type { CanonicalView, FieldDescriptor, FieldRef, FieldValidator } from '../fieldDescriptor';
import { hasDateOrderError } from '../../utils/dateOrderValidation';
import { parseWeekString } from '../../utils/dateUtils';

// Kronologireglen for et dato-par: ét sted, alle fra/til-par arver.
//
// Reglen lå tidligere UDELUKKENDE i række-evaluerings-motoren
// (`validation/tafPeriodeValidation.ts` m.fl.), som producerer `{ message, field: 'fra' | 'til' }`. Et
// kolonne-hint er ikke en feltadresse, og en rød ring kræver et fuldt `FieldIssue` med en strukturel
// `FieldRef` (§1.8). Derfor kunne rækkefølgefejlen vises i "Fejl og advarsler" og endda scrolle til det
// rigtige felt – uden at feltet nogensinde blev rødt.
//
// Reglen hører til på descriptoren, fordi den kan afgøres af feltet plus dets søskendefelt alene.
// Overlap mellem rækker og cutoff mod BEREGNEDE datoer kan den derimod ikke afgøre; de forbliver
// henholdsvis rækkeissue og projekteret domæne-issue. Se `docs/architecture/input-architecture.md`.

/**
 * BEGGE felter i parret markeres, og hver tooltip navngiver den MODGÅENDE dato.
 *
 * Det er ikke kosmetik. En kronologifejl er én regel om to værdier, og brugeren kan rette den fra begge
 * sider; markeres kun det ene felt, udpeger programmet vilkårligt den ene af to lovlige datoer som "den
 * forkerte". Modpartens dato står i beskeden, fordi tooltippet læses ved markøren i ét felt, mens fejlen
 * kun giver mening som et forhold mellem to.
 *
 * `reason: 'rule'` – ikke `'bounds'`. Konsekvensen er synlig for brugeren: `resolveFieldIssueTooltip`
 * viser `rule`-beskeder ORDRET (§4), mens en generisk «Fejl i indtastning» ville skjule netop den
 * modgående dato, der gør fejlen forståelig.
 */
export const buildDateOrderMessage = (
  role: 'fra' | 'til',
  counterpart: ISODateString
): string => {
  const counterpartText = isoToDanish(counterpart) ?? counterpart;
  return role === 'fra'
    ? `Fra-dato skal være før til-dato (${counterpartText})`
    : `Til-dato skal være efter fra-dato (${counterpartText})`;
};

/**
 * Fra/til-parret som ét objekt, så et kaldssted ikke kan registrere de to halvdele med hver sin
 * modpartsreference. Descriptorerne bindes dovent (`() => FieldDescriptor`), fordi de to felter
 * refererer hinanden og derfor ikke begge kan være initialiseret på erklæringstidspunktet.
 */
type PairBinding<V> = Readonly<{
  fra: () => FieldDescriptor<V | undefined>;
  til: () => FieldDescriptor<V | undefined>;
  /** Entity-id'er modparten skal bindes med. Tom for skalar-par (fx «Vedrører perioden»). */
  bindIds?: <T>(field: FieldRef<T>) => readonly string[];
}>;

export type DatePairBinding = PairBinding<ISODateString>;

/** Uge-parret («UU/ÅÅÅÅ») i en periodetabel – samme binding som dato-parret. */
export type WeekPairBinding = PairBinding<string>;

const counterpartDescriptor = <V>(pair: PairBinding<V>, role: 'fra' | 'til'): FieldDescriptor<V | undefined> =>
  role === 'fra' ? pair.til() : pair.fra();

const readCounterpart = <T, V>(
  field: FieldRef<T>,
  view: CanonicalView,
  pair: PairBinding<V>,
  role: 'fra' | 'til'
): V | undefined => {
  const ids = pair.bindIds?.(field) ?? [];
  return view.readCanonical(counterpartDescriptor(pair, role).bind(...ids));
};

/**
 * Kronologivalidatoren for den ene halvdel af et dato-par.
 *
 * Sammenligningen er STRENG (`fra > til`): et éndags-interval, hvor fra og til er samme dag, er lovligt
 * og bruges i praksis. Grænserne clampes bevidst IKKE her – clamping mod modpartens dato hører til i
 * motoren. Lod validatoren `til.min` clampe mod `fra`, ville bounds-reglen spise kronologireglen, og
 * beskeden ville skifte til en intervaltekst, der ikke nævner det egentlige problem. Præcis den
 * indbyrdes maskering gjorde fejlen ustabil.
 */
export const dateOrderValidator = (
  role: 'fra' | 'til',
  pair: DatePairBinding
): FieldValidator<ISODateString | undefined> => (value, field, view) => {
  if (value === undefined) return undefined;
  const counterpart = readCounterpart(field, view, pair, role);
  if (counterpart === undefined) return undefined;
  const fra = role === 'fra' ? value : counterpart;
  const til = role === 'til' ? value : counterpart;
  if (!hasDateOrderError(fra, til)) return undefined;
  return {
    reason: 'rule',
    code: `${field.descriptor.id}.dateOrder`,
    message: buildDateOrderMessage(role, counterpart),
    detail: { counterpart },
  };
};

/**
 * Uge-parrets tekst: hver celle navngiver sin egen udvej med modpartens uge (BB-107/BB-295). Ordet «dato»
 * står bevidst ikke i en ugefejl, og feltnavnene er descriptorernes egne labels («Uge fra»/«Uge til»), så
 * teksten følger kolonneoverskriften.
 */
export const buildWeekOrderMessage = (
  role: 'fra' | 'til',
  ownLabel: string,
  counterpartLabel: string,
  counterpart: string
): string => {
  const counterpartName = counterpartLabel.toLocaleLowerCase('da-DK');
  return role === 'fra'
    ? `${ownLabel} skal ligge før eller i ${counterpartName} (${counterpart})`
    : `${ownLabel} skal ligge efter eller i ${counterpartName} (${counterpart})`;
};

/**
 * Kronologivalidatoren for den ene halvdel af et uge-par. Samme uge i begge felter er lovligt (én uges løn).
 * Ugeværdien er canonical «UU/ÅÅÅÅ»; kan en af dem ikke tolkes som uge, bærer den selv sin formatfejl, og
 * rækkefølgen vurderes ikke.
 *
 * Reglen lå tidligere kun i rækkeevalueringen (`indkomstRowValidation.ts`) for EO, så ingen celle blev rød,
 * og boksen sagde «Ugyldig værdi i Uge fra» om en gyldig uge (BB-295); Årsløn havde en egen kopi med den
 * fælles dato-tekst (BB-107).
 */
export const weekOrderValidator = (
  role: 'fra' | 'til',
  pair: WeekPairBinding
): FieldValidator<string | undefined> => (value, field, view) => {
  if (value === undefined || value.trim() === '') return undefined;
  const counterpart = readCounterpart(field, view, pair, role);
  if (counterpart === undefined || counterpart.trim() === '') return undefined;
  const fra = parseWeekString(role === 'fra' ? value : counterpart);
  const til = parseWeekString(role === 'til' ? value : counterpart);
  if (fra === null || til === null || fra.start <= til.end) return undefined;
  return {
    reason: 'rule',
    code: `${field.descriptor.id}.weekOrder`,
    message: buildWeekOrderMessage(
      role,
      field.descriptor.label,
      counterpartDescriptor(pair, role).label,
      counterpart
    ),
    detail: { counterpart },
  };
};
