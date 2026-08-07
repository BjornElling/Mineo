import type { Calculable } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { MoneyOre } from '../../../domain/money/money';
import { formatCurrencyFromOre, formatCurrencyFromOreTrimmed, NBSP } from '../../layout/documentFormatUtils';

// Beløbstekst for EO-dokumentet, hvor værdierne er `Calculable` — de kan være
// uberegnelige, og dokumentet skal så vise en tankestreg (eller en eksplicit fejl)
// frem for et tal. De rene `MoneyOre`-formattere bor i documentFormatUtils; dette er
// det Calculable-bevidste lag ovenpå.
//
// Modulet findes, fordi funktionerne før blev sendt ned i sektionerne som felter på et
// ctx-objekt. De er rene og har ingen kalder-specifik tilstand, så sektionerne
// importerer dem nu direkte.

const renderMoney = (value: Calculable<MoneyOre>): string =>
  value.status === 'ok' ? formatCurrencyFromOre(value.value) : '—';

export const renderMoneyWithKr = (value: Calculable<MoneyOre>): string => {
  const rendered = renderMoney(value);
  return rendered === '—' ? '—' : `${rendered}${NBSP}kr.`;
};

/** Som `renderMoneyWithKr`, men viser årsagen frem for en tankestreg ved fejl. */
export const renderMoneyWithKrOrError = (value: Calculable<MoneyOre>): string => {
  if (value.status === 'ok') return `${formatCurrencyFromOre(value.value)}${NBSP}kr.`;
  return `Fejl (${value.reason})`;
};

export const renderMoneyWithKrTrimmed = (value: Calculable<MoneyOre>): string => {
  if (value.status !== 'ok') return '—';
  return `${formatCurrencyFromOreTrimmed(value.value)}${NBSP}kr.`;
};
