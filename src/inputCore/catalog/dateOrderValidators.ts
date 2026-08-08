import { isoToDanish, type ISODateString } from '../../types/branded';
import type { CanonicalView, FieldDescriptor, FieldRef, FieldValidator } from '../fieldDescriptor';
import { hasDateOrderError } from '../../utils/dateOrderValidation';

// Kronologireglen for et dato-par (BF-028/BF-031): ét sted, alle fra/til-par arver.
//
// Reglen lå tidligere UDELUKKENDE i række-evaluerings-motoren
// (`validation/tafPeriodeValidation.ts` m.fl.), som producerer `{ message, field: 'fra' | 'til' }`. Et
// kolonne-hint er ikke en feltadresse, og en rød ring kræver et fuldt `FieldIssue` med en strukturel
// `FieldRef` (§1.8). Derfor kunne rækkefølgefejlen vises i "Fejl og advarsler" og endda scrolle til det
// rigtige felt — uden at feltet nogensinde blev rødt.
//
// Reglen hører til på descriptoren, fordi den kan afgøres af feltet plus dets søskendefelt alene.
// Overlap mellem rækker og cutoff mod BEREGNEDE datoer kan den derimod ikke afgøre; de forbliver
// henholdsvis rækkeissue og projekteret domæne-issue. Se `docs/architecture/input-architecture.md`.

/**
 * BF-028: BEGGE felter i parret markeres, og hver tooltip navngiver den MODGÅENDE dato.
 *
 * Det er ikke kosmetik. En kronologifejl er én regel om to værdier, og brugeren kan rette den fra begge
 * sider; markeres kun det ene felt, udpeger programmet vilkårligt den ene af to lovlige datoer som "den
 * forkerte". Modpartens dato står i beskeden, fordi tooltippet læses ved markøren i ét felt, mens fejlen
 * kun giver mening som et forhold mellem to.
 *
 * `reason: 'rule'` — ikke `'bounds'`. Konsekvensen er synlig for brugeren: `resolveFieldIssueTooltip`
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
export type DatePairBinding = Readonly<{
  fra: () => FieldDescriptor<ISODateString | undefined>;
  til: () => FieldDescriptor<ISODateString | undefined>;
  /** Entity-id'er modparten skal bindes med. Tom for skalar-par (fx «Vedrører perioden»). */
  bindIds?: <T>(field: FieldRef<T>) => readonly string[];
}>;

const readCounterpart = <T>(
  field: FieldRef<T>,
  view: CanonicalView,
  pair: DatePairBinding,
  role: 'fra' | 'til'
): ISODateString | undefined => {
  const descriptor = role === 'fra' ? pair.til() : pair.fra();
  const ids = pair.bindIds?.(field) ?? [];
  return view.readCanonical(descriptor.bind(...ids));
};

/**
 * Kronologivalidatoren for den ene halvdel af et dato-par.
 *
 * Sammenligningen er STRENG (`fra > til`): et éndags-interval, hvor fra og til er samme dag, er lovligt
 * og bruges i praksis. Grænserne clampes bevidst IKKE her — clamping mod modpartens dato hører til i
 * motoren. Lod validatoren `til.min` clampe mod `fra`, ville bounds-reglen spise kronologireglen, og
 * beskeden ville skifte til en intervaltekst, der ikke nævner det egentlige problem. Præcis den
 * indbyrdes maskering gjorde fejlen ustabil (BF-031).
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
