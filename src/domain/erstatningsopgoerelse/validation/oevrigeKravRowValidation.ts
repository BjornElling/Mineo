import { isoToDanish, type ISODateString } from '../../../types/branded';
import { formatCurrency } from '../../../utils/formatUtils';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import type { OevrigeKravRow } from '../../../schemas/formSchemas';
import type { FieldIssue } from '../../../inputCore/inputIssue';

/**
 * Én øvrige krav-rækkes vurdering – den ENE kilde til, hvad der er galt med en række, og hvordan det siges.
 *
 * Sektionen havde to lag, der vurderede samme række hver for sig (M-33): rækkebyggeren og validatoren. De var
 * uenige om ordlyd, alvor, relevans og om datoen var påkrævet, og brugeren fik begge svar – én tom datocelle
 * gav en rød linje uden link OG en gul med (BB-229). Nu vurderes rækken her, og begge lag læser resultatet:
 *
 *  - **«Udgift til» og «Beløb» er påkrævede**, datoen er VALGFRI (udviklerafgørelse 2026-09-23): en udgift kan
 *    mangle en nøjagtig dato og trykkes da uden datopræfiks.
 *  - **En rød celle meldes med sin egen tekst**, aldrig som tom. Readeren maskerer en rød værdi til tom, så
 *    en ugyldig dato blev før meldt som «Dato mangler» oveni sin egen fejl (BB-230).
 *  - **Én linje pr. række, med rækkens navn og alle dens mangler**, så to rækker med samme mangel aldrig
 *    giver ens tekst og foldes til én (BB-231), og så en række med tre mangler ikke giver tre linjer.
 *
 * Feltnavnene står i «» (udviklerafgørelse 2026-09-23, BB-237): «Udgift til» og «Beløb» er også almindelige
 * ord, og brugeren skal kunne se, at de henviser til en kolonne på siden.
 */

export const OEVRIGE_KRAV_UDGIFT_TIL_MANGLER_MESSAGE = '«Udgift til» er ikke udfyldt';
export const OEVRIGE_KRAV_BELOEB_MANGLER_MESSAGE = '«Beløb» er ikke udfyldt';
const OEVRIGE_KRAV_BEGGE_MANGLER_MESSAGE = '«Udgift til» og «Beløb» er ikke udfyldt';

/** Kolonnerne i skærmens rækkefølge; linkets mål er den første, der har en mangel. */
export type OevrigeKravColumn = 'dato' | 'udgiftTil' | 'beloeb';

export type OevrigeKravCellIssues = Readonly<Partial<Record<OevrigeKravColumn, FieldIssue>>>;

export type OevrigeKravPeriode = Readonly<{ fra: ISODateString; til: ISODateString }>;

export type OevrigeKravRowAssessment =
  | Readonly<{ kind: 'empty' }>
  | Readonly<{ kind: 'ok' }>
  | Readonly<{ kind: 'error' | 'warning'; message: string; focusColumn: OevrigeKravColumn }>;

const hasText = (value: string | undefined): value is string => typeof value === 'string' && value.trim() !== '';

/**
 * Rækkens navn i en besked. Beskrivelsen er brugerens eget navn for udgiften; mangler den, bruges det, der
 * står i rækken, så linjen stadig kan skelnes fra de andre. `kvalificeret` tilføjer dato og beløb også til en
 * beskrivelse – til to rækker med samme beskrivelse, som ellers ville give ordret samme linje.
 */
const rowName = (row: OevrigeKravRow, beloeb: number | undefined, kvalificeret: boolean): string => {
  const kendt = [
    row.dato === undefined ? undefined : isoToDanish(row.dato),
    beloeb === undefined ? undefined : `${formatCurrency(beloeb)} kr.`,
  ].filter((part): part is string => part !== undefined && part !== '');
  const detaljer = kendt.length === 0 ? '' : ` (${kendt.join(', ')})`;
  if (hasText(row.udgiftTil)) return kvalificeret ? `${row.udgiftTil.trim()}${detaljer}` : row.udgiftTil.trim();
  return `Øvrigt krav${detaljer}`;
};

const isRedIssue = (issue: FieldIssue | undefined): issue is FieldIssue =>
  issue !== undefined && issue.severity === 'error' && issue.message.trim() !== '';

/**
 * Vurderer én række. `cellIssues` er cellernes aktive feltissues; en celle med et rødt issue er udfyldt, men
 * forkert, selv om readeren giver den som tom.
 *
 * `periode` er opgørelsens «Vedrører perioden». En dato uden for den er en IKKE-blokerende advarsel
 * (udviklerafgørelse 2026-09-23, BB-235): en kvittering for fx medicin fra en tidligere erstatningsperiode
 * kan legitimt først blive sendt senere og medregnes i en senere opgørelse. Advarslen må derfor ALDRIG
 * gøres blokerende; den spørger kun, om datoen er tastet rigtigt.
 */
export const assessOevrigeKravRow = (
  row: OevrigeKravRow,
  cellIssues: OevrigeKravCellIssues,
  periode: OevrigeKravPeriode | undefined,
  options: Readonly<{ kvalificeretNavn?: boolean }> = {},
): OevrigeKravRowAssessment => {
  const beloeb = amountValueToNumber(row.beloeb);
  const harDato = row.dato !== undefined || isRedIssue(cellIssues.dato);
  const harUdgiftTil = hasText(row.udgiftTil) || isRedIssue(cellIssues.udgiftTil);
  const harBeloeb = beloeb !== undefined || isRedIssue(cellIssues.beloeb);
  if (!harDato && !harUdgiftTil && !harBeloeb) return { kind: 'empty' };

  const name = rowName(row, beloeb, options.kvalificeretNavn === true);
  const dele: string[] = [];
  let focusColumn: OevrigeKravColumn | undefined;
  const noter = (column: OevrigeKravColumn, message: string): void => {
    dele.push(message);
    focusColumn ??= column;
  };

  if (isRedIssue(cellIssues.dato)) noter('dato', cellIssues.dato.message.trim());

  const udgiftTilMangler = !harUdgiftTil;
  const beloebMangler = !harBeloeb;
  if (isRedIssue(cellIssues.udgiftTil)) noter('udgiftTil', cellIssues.udgiftTil.message.trim());
  if (udgiftTilMangler && beloebMangler) {
    noter('udgiftTil', OEVRIGE_KRAV_BEGGE_MANGLER_MESSAGE);
  } else if (udgiftTilMangler) {
    noter('udgiftTil', OEVRIGE_KRAV_UDGIFT_TIL_MANGLER_MESSAGE);
  }
  if (isRedIssue(cellIssues.beloeb)) {
    noter('beloeb', cellIssues.beloeb.message.trim());
  } else if (beloebMangler && !udgiftTilMangler) {
    noter('beloeb', OEVRIGE_KRAV_BELOEB_MANGLER_MESSAGE);
  }

  if (focusColumn !== undefined) {
    return { kind: 'error', message: `${name}: ${dele.join('; ')}`, focusColumn };
  }

  if (periode !== undefined && row.dato !== undefined && (row.dato < periode.fra || row.dato > periode.til)) {
    return {
      kind: 'warning',
      message: `${name}: Datoen ligger uden for opgørelsens periode (${isoToDanish(periode.fra)} - ${isoToDanish(periode.til)})`,
      focusColumn: 'dato',
    };
  }

  return { kind: 'ok' };
};
