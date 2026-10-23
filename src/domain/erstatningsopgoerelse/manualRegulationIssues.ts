import { toAnyFieldRef, type AnyFieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import type {
  ErstatningsopgoerelseValues,
  LoenudviklingManuelProcentsatsRow,
  LoenudviklingManuelRow,
  StamdataValues,
} from '../../schemas/formSchemas';
import { isoToDanish, type ISODateString } from '../../types/branded';
import {
  eoAngivetLoenManual,
  eoEmploymentManual,
  type ManualBindings,
} from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { formatKr } from '../../utils/formatUtils';
import { formatPercentDisplay } from '../../utils/percentDraftCore';
import { EO_ANGIVET_LOEN_ID, getAngivetLoenOpreguleresFraDato } from './helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from './helpers/eoSharedUtils';
import { erAngivetLoenLoenudviklingRelevant } from './helpers/eoInputRelevance';
import {
  hasFinitePct,
  isManualRegulationDateOnOrBeforeBasis,
  isManuelProcentsatsRowAktiv,
} from './helpers/manuelReguleringRowPredicates';
import { getRangeForManualRegulering, calculateElapsedWholeMonths } from '../eoRowEvaluation/eoRowShared';

// De to manuelle reguleringsformer – «Manuelt angivet» og «Manuel procentsats» – er samme slags tabel: en låst
// basisrække på reguleringsdatoen og brugerens efterfølgende rækker. Reglerne for dem bor derfor ét sted og
// gælder begge former og begge ejere (ansættelsesforholdet ved «Beregningsperiode» og den angivne løn). Før
// havde de hver sin håndfuld regler, og de afveg uden grund (BB-302, BB-303, BB-311).
//
//  - Røde fejl (spærrer): en dato på eller før basisdatoen, og to rækker med samme dato (BB-311).
//  - Gule advarsler (spærrer ikke): ingen ændringer i lang tid (BB-302), en procentsats over 10 % og en
//    grundløn over ti gange rækken før (BB-313).

export type ManualRegulationBasis = 'Manuelt angivet' | 'Manuel procentsats';

type ManualRow = LoenudviklingManuelRow | LoenudviklingManuelProcentsatsRow;

/** Én aktiv manuel tabel: den valgte form for en ejer, hvis lønudvikling vises. */
export type ActiveManualRegulationTable = Readonly<{
  /** Ansættelsesforholdets id, eller den angivne løns faste id. */
  ownerKey: string;
  basis: ManualRegulationBasis;
  rows: readonly ManualRow[];
  anvendtReguleringsdato: ISODateString | undefined;
  bindings: ManualBindings;
  bindIds: (rowId: string) => readonly string[];
}>;

/** Navnet på formen i en linje i «Fejl og advarsler». */
export const manualRegulationFormPrefix = (basis: ManualRegulationBasis): string =>
  basis === 'Manuel procentsats' ? 'Manuel procentsats' : 'Manuel regulering';

/** «række 01-04-2019» – eller, uden en gyldig dato, rækkens plads i tabellen («række 3»). */
export const formatManualRegulationRowName = (
  row: Pick<ManualRow, 'dato'> | undefined,
  rowIndex: number,
): string => {
  const dato = row?.dato === undefined ? undefined : isoToDanish(row.dato);
  return dato === undefined ? `række ${rowIndex + 1}` : `række ${dato}`;
};

export const resolveActiveManualRegulationTables = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato'>,
): readonly ActiveManualRegulationTable[] => {
  const tables: ActiveManualRegulationTable[] = [];
  const angivetLoenOpreguleresFraDato = getAngivetLoenOpreguleresFraDato(values);
  const isManual = (basis: string | undefined): basis is ManualRegulationBasis =>
    basis === 'Manuelt angivet' || basis === 'Manuel procentsats';

  if (values.beregnesUdFra === 'Beregningsperiode') {
    for (const employment of values.loenindkomstAnsaettelsesforhold) {
      const basis = employment.loenudviklingBeregningsgrundlag;
      if (!isManual(basis)) continue;
      tables.push({
        ownerKey: employment.id,
        basis,
        rows: basis === 'Manuel procentsats'
          ? employment.loenudviklingManuelProcentsatsTableData
          : employment.loenudviklingManuelTableData,
        anvendtReguleringsdato: resolveAnvendtReguleringsdato({
          beregnesUdFra: values.beregnesUdFra,
          angivetLoenMetodeOpreguleresFraDato: angivetLoenOpreguleresFraDato,
          saerligFraDatoRegulering: employment.saerligFraDatoRegulering,
          beregningsperiodeTil: values.tafBeregningsperiodeTil,
          skadedato: stamdata.skadedato,
        }),
        bindings: eoEmploymentManual,
        bindIds: (rowId) => [employment.id, rowId],
      });
    }
  }

  const eoLoen = values.eoAngivetLoenLoenudvikling;
  const eoBasis = eoLoen.loenudviklingBeregningsgrundlag;
  if (erAngivetLoenLoenudviklingRelevant(values) && isManual(eoBasis)) {
    tables.push({
      ownerKey: EO_ANGIVET_LOEN_ID,
      basis: eoBasis,
      rows: eoBasis === 'Manuel procentsats'
        ? eoLoen.loenudviklingManuelProcentsatsTableData
        : eoLoen.loenudviklingManuelTableData,
      anvendtReguleringsdato: resolveAnvendtReguleringsdato({
        beregnesUdFra: values.beregnesUdFra,
        angivetLoenMetodeOpreguleresFraDato: angivetLoenOpreguleresFraDato,
        saerligFraDatoRegulering: undefined,
        beregningsperiodeTil: values.tafBeregningsperiodeTil,
        skadedato: stamdata.skadedato,
      }),
      bindings: eoAngivetLoenManual,
      bindIds: (rowId) => [rowId],
    });
  }
  return tables;
};

const dateFieldOf = (table: ActiveManualRegulationTable) =>
  table.basis === 'Manuel procentsats' ? table.bindings.manualPercentFields.dato : table.bindings.manualFields.dato;

const ruleIssue = (
  field: AnyFieldRef, code: string, message: string, detail?: Readonly<Record<string, string | number | boolean>>,
): FieldIssue =>
  Object.freeze({
    kind: 'field' as const,
    code,
    severity: 'error' as const,
    field,
    reason: 'rule' as const,
    message,
    ...(detail === undefined ? {} : { detail: Object.freeze(detail) }),
  });

/**
 * Datofejlene i den aktive manuelle tabel, adresseret til de berørte datoceller. En inaktiv tabels bevarede
 * input må ikke blokere sagen (relevansen giver dens celler tomme), men begge former følger samme regler.
 */
export const collectManualRegulationIssues = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato'>,
): readonly FieldIssue[] => {
  const issues: FieldIssue[] = [];
  for (const table of resolveActiveManualRegulationTables(values, stamdata)) {
    const dateField = dateFieldOf(table);
    const basisdato = table.anvendtReguleringsdato;
    const seenDates = new Set<ISODateString>();
    // Første række er programmets låste basisrække; kun brugerens efterfølgende rækker er omfattet.
    table.rows.slice(1).forEach((row) => {
      const field = toAnyFieldRef(dateField.bind(...table.bindIds(row.id)));
      if (basisdato !== undefined && isManualRegulationDateOnOrBeforeBasis(row.dato, basisdato)) {
        const basisDisplay = isoToDanish(basisdato) ?? basisdato;
        issues.push(ruleIssue(
          field,
          `${field.descriptor.id}.dato.afterAnvendtRegulering`,
          `Datoen skal være senere end datoen i den låste første række (${basisDisplay})`,
          { anvendtReguleringsdato: basisdato },
        ));
        return;
      }
      if (row.dato === undefined) return;
      // To reguleringer på samme dag kan ikke begge gælde: lønnen ville få to værdier, og procentsatserne blev
      // lagt oven i hinanden. Den senere række i tabellen er den røde (BB-311).
      if (seenDates.has(row.dato)) {
        issues.push(ruleIssue(
          field,
          `${field.descriptor.id}.dato.dublet`,
          `Der er allerede en række pr. ${isoToDanish(row.dato) ?? row.dato}`,
        ));
        return;
      }
      seenDates.add(row.dato);
    });
  }
  return Object.freeze(issues);
};

// ── Gule advarsler ─────────────────────────────────────────────────────────────────────────────

/** En procentsats over denne grænse pr. række er næsten altid en tastefejl (`10` for `1,0`, BB-313). */
export const MANUEL_PROCENTSATS_ADVARSELSGRAENSE = 10;
/** En grundløn over så mange gange rækken før er sandsynligvis et nul for meget (BB-313, som BB-297). */
export const MANUEL_GRUNDLOEN_SPRING_FAKTOR = 10;

export type ManualRegulationWarningKind = 'udloeb' | 'storProcentsats' | 'grundloenSpring';

export type ManualRegulationWarning = Readonly<{
  ownerKey: string;
  basis: ManualRegulationBasis;
  kind: ManualRegulationWarningKind;
  rowId: string;
  /** Linjen i «Fejl og advarsler». */
  summaryMessage: string;
  /** Tooltip på den gule celle. */
  cellMessage: string;
  cells: readonly AnyFieldRef[];
}>;

/**
 * En manuel lønudvikling har ingen kilde, der udløber – den gælder, til brugeren ændrer den. Programmet regner
 * lønnen uændret efter sidste række. Har tabellen ikke været ændret i over et år (plus Indstillingernes
 * tolerance) ved TAF-periodens slutning, gør advarslen opmærksom på det; den spærrede før med «'Reguleringsværdi
 * på slut-dato for TAF' er ikke angivet» (udviklerafgørelse 2026-10-23, BB-302 valg b).
 */
const resolveUdloebWarning = (
  table: ActiveManualRegulationTable,
  tafSlut: ISODateString | undefined,
  udloebToleranceMaaneder: number,
): ManualRegulationWarning | undefined => {
  if (tafSlut === undefined || table.anvendtReguleringsdato === undefined) return undefined;
  const range = getRangeForManualRegulering(table.anvendtReguleringsdato, table.rows.slice(1));
  if (range.max === undefined || range.max >= tafSlut) return undefined;
  if (calculateElapsedWholeMonths(range.max, tafSlut) < udloebToleranceMaaneder) return undefined;

  // Seneste gyldige række efter basisdatoen – eller basisrækken selv.
  const basisdato = table.anvendtReguleringsdato;
  const senesteRaekke = table.rows.slice(1).reduce<ManualRow | undefined>((seneste, row) => {
    if (row.dato === undefined || row.dato <= basisdato) return seneste;
    return seneste?.dato !== undefined && seneste.dato >= row.dato ? seneste : row;
  }, undefined);
  const senesteDato = senesteRaekke?.dato ?? basisdato;
  const senesteDisplay = isoToDanish(senesteDato) ?? senesteDato;
  const tafSlutDisplay = isoToDanish(tafSlut) ?? tafSlut;

  // Ringen sidder på den række, ændringen mangler efter. Er basisrækken den eneste, er dens værdi cellen.
  const baseRow = table.rows[0];
  const cell = senesteRaekke !== undefined
    ? toAnyFieldRef(dateFieldOf(table).bind(...table.bindIds(senesteRaekke.id)))
    : baseRow !== undefined && table.basis === 'Manuelt angivet'
      ? toAnyFieldRef(table.bindings.manualFields.grundloen.bind(...table.bindIds(baseRow.id)))
      : undefined;
  return {
    ownerKey: table.ownerKey,
    basis: table.basis,
    kind: 'udloeb',
    rowId: senesteRaekke?.id ?? baseRow?.id ?? '',
    summaryMessage:
      `Den manuelle lønudvikling har ingen ændringer efter ${senesteDisplay} – lønnen er regnet uændret frem til ${tafSlutDisplay}`,
    cellMessage: `Ingen ændringer efter denne række – lønnen er regnet uændret frem til ${tafSlutDisplay}`,
    cells: cell === undefined ? [] : [cell],
  };
};

const resolveProcentsatsWarnings = (table: ActiveManualRegulationTable): ManualRegulationWarning[] =>
  (table.rows.slice(1) as readonly LoenudviklingManuelProcentsatsRow[]).flatMap((row, index) => {
    if (!isManuelProcentsatsRowAktiv(row) || !hasFinitePct(row.procent)) return [];
    if (row.procent <= MANUEL_PROCENTSATS_ADVARSELSGRAENSE) return [];
    const sats = `${formatPercentDisplay(row.procent, true)} %`;
    return [{
      ownerKey: table.ownerKey,
      basis: table.basis,
      kind: 'storProcentsats' as const,
      rowId: row.id,
      summaryMessage: `${manualRegulationFormPrefix(table.basis)}, ${formatManualRegulationRowName(row, index + 1)}: `
        + `Satsen ${sats} er usædvanligt stor – kontrollér satsen`,
      cellMessage: 'Usædvanligt stor regulering – kontrollér satsen',
      cells: [toAnyFieldRef(table.bindings.manualPercentFields.procent.bind(...table.bindIds(row.id)))],
    }];
  });

/**
 * En grundløn over ti gange den forrige række (i datoorden, basisrækken medregnet). Kun et spring OP: et fald er
 * sjældent en tastefejl af denne slags, og BB-297's tilsvarende kontrol er også kun «større».
 */
const resolveGrundloenWarnings = (table: ActiveManualRegulationTable): ManualRegulationWarning[] => {
  const rows = table.rows as readonly LoenudviklingManuelRow[];
  const baseRow = rows[0];
  if (baseRow === undefined || table.anvendtReguleringsdato === undefined) return [];
  const basisdato = table.anvendtReguleringsdato;
  const ordered = [
    { row: baseRow, index: 0, dato: basisdato },
    ...rows.slice(1)
      .map((row, offset) => ({ row, index: offset + 1, dato: row.dato }))
      .filter((entry): entry is { row: LoenudviklingManuelRow; index: number; dato: ISODateString } =>
        entry.dato !== undefined && entry.dato > basisdato)
      .sort((a, b) => a.dato.localeCompare(b.dato)),
  ];
  const warnings: ManualRegulationWarning[] = [];
  let forrige: number | undefined;
  for (const entry of ordered) {
    const grundloen = amountValueToNumber(entry.row.grundloen);
    if (grundloen === undefined || !Number.isFinite(grundloen)) continue;
    if (forrige !== undefined && forrige > 0 && grundloen > forrige * MANUEL_GRUNDLOEN_SPRING_FAKTOR) {
      warnings.push({
        ownerKey: table.ownerKey,
        basis: table.basis,
        kind: 'grundloenSpring',
        rowId: entry.row.id,
        summaryMessage: `${manualRegulationFormPrefix(table.basis)}, ${formatManualRegulationRowName(entry.row, entry.index)}: `
          + `Grundlønnen er over ti gange højere end rækken før (${formatKr(forrige, 2)}) – kontrollér beløbet`,
        cellMessage: 'Grundlønnen er over ti gange højere end rækken før – kontrollér beløbet',
        cells: [toAnyFieldRef(table.bindings.manualFields.grundloen.bind(...table.bindIds(entry.row.id)))],
      });
    }
    forrige = grundloen;
  }
  return warnings;
};

/**
 * De manuelle tabellers gule advarsler. Rene funktioner af input og indstillingens tolerance, så rækkebyggeren
 * (linjen i «Fejl og advarsler») og fladen (den gule ring) får præcis samme svar.
 *
 * @param tafSlut TAF-periodens sidste dag i erstatningsperioden (samme grænse, som kontrolrækkerne bruger).
 * @param udloebToleranceMaaneder Indstillingernes «regnes for dækkende indtil N måneder efter udløb».
 */
export const resolveManualRegulationWarnings = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato'>,
  tafSlut: ISODateString | undefined,
  udloebToleranceMaaneder: number,
): readonly ManualRegulationWarning[] =>
  resolveActiveManualRegulationTables(values, stamdata).flatMap((table) => {
    const udloeb = resolveUdloebWarning(table, tafSlut, udloebToleranceMaaneder);
    return [
      ...(table.basis === 'Manuel procentsats' ? resolveProcentsatsWarnings(table) : resolveGrundloenWarnings(table)),
      ...(udloeb === undefined ? [] : [udloeb]),
    ];
  });
