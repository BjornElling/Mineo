import type { ISODateString } from '../types/branded';

/**
 * Det kanoniske LUKKEDE datointerval og dets overlapsprædikat.
 *
 * "Lukket" betyder at både `fra` og `til` er MED i intervallet – en periode 01-01 til 01-01 dækker den ene
 * dag. Det er den semantik hele domænet bruger (TAF-perioder, ferie, fravær, beregningsperioder), og derfor
 * er uligheden `a.fra <= b.til && b.fra <= a.til` og ikke en halvåben variant.
 *
 * Primitivet lå tidligere i fire udgaver: én eksporteret i `beregningsperiodeTafOverlap`, to lokale kopier i
 * TAF-motoren og dagsæt-modulet, og én inlinet ulighed på et callsite. Alle fire var enige – men en enkelt
 * fremtidig rettelse ét sted (fx en halvåben grænse) ville have gjort dem uenige uden at noget blev rødt.
 * Ét sted, alle bruger, gør uenigheden umulig.
 *
 * Modulet ligger i `utils/` og ikke i et domæne, fordi intervalalgebra ikke er EO-specifik.
 */

export type ClosedDateRange = Readonly<{
  fra: ISODateString;
  til: ISODateString;
}>;

export type OptionalClosedDateRange = Readonly<{
  fra: ISODateString | undefined;
  til: ISODateString | undefined;
}>;

/**
 * Er intervallet komplet OG velordnet? Type-guarden er halvdelen af pointen: den lader et callsite gå fra
 * "måske-interval" til `ClosedDateRange` i typen, så `rangesOverlap` ikke kan kaldes med et halvt interval.
 */
export const isValidClosedDateRange = (range: OptionalClosedDateRange): range is ClosedDateRange =>
  range.fra !== undefined && range.til !== undefined && range.fra <= range.til;

/**
 * Overlapper to LUKKEDE intervaller? To perioder, der blot deler en endedato, overlapper.
 *
 * Callsitet er ansvarligt for, at begge intervaller er gyldige – brug `isValidClosedDateRange` først, når
 * det ikke allerede er bevist af typen. Prædikatet gætter bevidst IKKE på gyldighed: et ugyldigt interval
 * ville da lydløst kunne blive "intet overlap" i stedet for at blive afvist, hvor det opstod.
 */
export const rangesOverlap = (a: ClosedDateRange, b: ClosedDateRange): boolean =>
  a.fra <= b.til && b.fra <= a.til;
