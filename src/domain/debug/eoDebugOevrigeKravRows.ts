import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import { formatCurrency } from '../../utils/formatUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { isNonEmptyString } from './eoDebugCommon';
import type { DebugRowModel, DebugStatus } from './eoDebugTypes';
import { clampTafRange, getValidTafRange, resolveTafConstraintBounds, resolveMidlertidigEetDatoHvisAktiv } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';
import { buildIncomeForRanges, buildTafRanges } from '../erstatningsopgoerelse/helpers/indtaegtPerioder';
import { resolveOevrigeKravIntroLinjer } from '../erstatningsopgoerelse/helpers/oevrigeKravIntro';
import { resolveBilagWarning } from '../erstatningsopgoerelse/helpers/bilagWarnings';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import type { ErstatningsopgoerelseValues, ErstatningsopgoerelseFieldErrorsBySource } from './eoDebugEoShared';

/**
 * Bygger debug-rækker for Øvrige erstatningskrav
 */
export const buildEODebugOevrigeKravRows = (
  values: ErstatningsopgoerelseValues,
  _errors: ErstatningsopgoerelseFieldErrorsBySource,
  canonicalOutput?: EoCanonicalOutput
): DebugRowModel[] => {
  const rows: DebugRowModel[] = [];
  const tafRanges = canonicalOutput?.periodiseringer.tafPerioder ?? buildTafRanges(values);
  const oevrigeKravForbeholdYdelsestyper = Array.from(
    new Set(
      buildIncomeForRanges(values, tafRanges).benefits
        .map((entry) => entry.typeKey)
        .filter((typeKey) => typeKey === 'kontanthjaelp' || typeKey === 'ressourceforloebsydelse')
    )
  );
  const introLinjer = resolveOevrigeKravIntroLinjer({
    eoValues: values,
    ydelser: oevrigeKravForbeholdYdelsestyper,
  });

  introLinjer.forEach((linje, index) => {
    rows.push({
      id: `oevrigekrav.intro.${index + 1}`,
      label: linje,
      displayValue: '-',
      status: 'ok',
    });
  });

  const oevrigeKrav = values.oevrigeKravPerioder ?? [];
  const harKrav = oevrigeKrav.length > 0 && oevrigeKrav.some((k) => k.dato || k.udgiftTil || k.beloeb);

  if (!harKrav && introLinjer.length === 0) {
    rows.push({
      id: 'oevrigekrav.empty',
      label: 'Ingen',
      displayValue: '-',
      status: 'ok',
    });
  } else {
    oevrigeKrav.forEach((krav) => {
      const hasDato = isNonEmptyString(krav.dato);
      const hasUdgiftTil = isNonEmptyString(krav.udgiftTil);
      const hasBeloeb = krav.beloeb !== undefined;

      // Tæl hvor mange felter der er udfyldt
      const filledCount = [hasDato, hasUdgiftTil, hasBeloeb].filter(Boolean).length;
      const noneFilled = filledCount === 0;

      // Spring over rækker hvor intet er udfyldt
      if (noneFilled) return;

      // Konverter dato til dansk format
      const datoDanish = hasDato ? isoToDanish(krav.dato) : undefined;

      // Tjek om udgiftTil og beløb begge er udfyldt
      const udgiftOgBeloebUdfyldt = hasUdgiftTil && hasBeloeb;

      // Status er fejl hvis udgiftTil ELLER beløb mangler (når der er noget udfyldt i rækken)
      // Status er advarsel hvis kun dato mangler
      let status: DebugStatus = 'ok';
      let label = '';
      let displayValue = '';

      if (!udgiftOgBeloebUdfyldt) {
        // Fejl: Enten beskrivelse eller beløb mangler
        status = 'error';

        if (!hasUdgiftTil && !hasBeloeb) {
          // Begge mangler
          label = 'Fejl: Beskrivelse mangler';
          displayValue = 'Fejl: Beløb mangler';
        } else if (!hasUdgiftTil) {
          // Kun beskrivelse mangler
          label = 'Fejl: Beskrivelse mangler';
          displayValue = formatCurrency(amountValueToNumber(krav.beloeb));
        } else {
          // Kun beløb mangler
          label = krav.udgiftTil ?? '';
          displayValue = 'Fejl: Beløb mangler';
        }
      } else if (!hasDato) {
        // Advarsel: Kun dato mangler
        status = 'warning';
        label = `${krav.udgiftTil} (dato mangler)`;
        displayValue = formatCurrency(amountValueToNumber(krav.beloeb));
      } else {
        // Alt udfyldt korrekt
        label = `${krav.udgiftTil} (${datoDanish})`;
        displayValue = formatCurrency(amountValueToNumber(krav.beloeb));
      }

      rows.push({
        id: `oevrigekrav.${krav.id}`,
        label,
        displayValue,
        status,
      });
    });
  }

  return rows;
};

/**
 * Bygger debug-række for Særlige kommentarer
 */
export const buildEODebugSaerligeKommentarerRows = (
  values: ErstatningsopgoerelseValues,
  _errors: ErstatningsopgoerelseFieldErrorsBySource
): DebugRowModel[] => {
  const kommentarer = values.saerligeKommentarer;
  const harKommentarer = isNonEmptyString(kommentarer);

  return [
    {
      id: 'saerligekommentarer',
      label: harKommentarer ? 'Kommentar:' : 'Ingen',
      displayValue: harKommentarer ? kommentarer.trim() : '-',
      status: 'ok',
    },
  ];
};

// =============================================================================
// BILAGSNUMRE
// =============================================================================

type BilagEntry = {
  id: string;
  fieldName: string;
  label: string;
  value: string | undefined;
};

/**
 * Bygger debug-rækker for Bilagsnumre.
 * Returnerer tom liste hvis visBilagsnumre !== 'Ja'.
 */
export const buildEODebugBilagsnumreRows = (
  values: ErstatningsopgoerelseValues
): DebugRowModel[] => {
  if (values.visBilagsnumre !== 'Ja') return [];

  const entries: BilagEntry[] = [
    { id: 'bilagsnumre.menAfgoerelse', fieldName: 'bilagsnumreMenAfgoerelse', label: 'Ménafgørelse', value: values.bilagsnumreMenAfgoerelse },
    { id: 'bilagsnumre.eetAfgoerelser', fieldName: 'bilagsnumreEetAfgoerelser', label: 'EET-afgørelser', value: values.bilagsnumreEetAfgoerelser },
    { id: 'bilagsnumre.svieSmerteDokumentation', fieldName: 'bilagsnumreSvieSmerteDokumentation', label: 'Svie/smerte-dokumentation', value: values.bilagsnumreSvieSmerteDokumentation },
    { id: 'bilagsnumre.beregningsgrundlagTaf', fieldName: 'bilagsnumreBeregningsgrundlagTaf', label: 'Beregningsgrundlag for TAF', value: values.bilagsnumreBeregningsgrundlagTaf },
    { id: 'bilagsnumre.loenISygeperioden', fieldName: 'bilagsnumreLoenISygeperioden', label: 'Løn i sygeperioden', value: values.bilagsnumreLoenISygeperioden },
    { id: 'bilagsnumre.offentligeYdelser', fieldName: 'bilagsnumreOffentligeYdelser', label: 'Offentlige ydelser', value: values.bilagsnumreOffentligeYdelser },
    { id: 'bilagsnumre.oevrigeErstatningskrav', fieldName: 'bilagsnumreOevrigeErstatningskrav', label: 'Øvrige erstatningskrav', value: values.bilagsnumreOevrigeErstatningskrav },
  ];

  const filledEntries = entries.filter((e) => isNonEmptyString(e.value));

  if (filledEntries.length === 0) {
    return [{ id: 'bilagsnumre.ingen', label: 'Ingen', displayValue: '-', status: 'ok' }];
  }

  return filledEntries.map((entry) => {
    const warning = resolveBilagWarning(values, entry.fieldName, entry.value);
    if (warning) {
      return {
        id: entry.id,
        label: entry.label,
        displayValue: warning,
        status: 'warning' as DebugStatus,
        message: warning,
        summaryDisplay: 'messageOnly' as const,
      };
    }
    return {
      id: entry.id,
      label: entry.label,
      displayValue: entry.value!.trim(),
      status: 'ok' as DebugStatus,
    };
  });
};

export const buildEODebugMidlertidigtEetKonsistensRows = (
  values: ErstatningsopgoerelseValues,
  skadedatoISO: ISODateString | undefined
): DebugRowModel[] => {
  // Kun relevant hvis afgørelse er 'Ja' og virkningsdato kan bestemmes
  if (values.midlertidigtEETAfgorelse !== 'Ja') return [];

  const midlertidigEETBeregnetDato = resolveMidlertidigEetDatoHvisAktiv({
    ...values,
    skadedatoISO,
  });
  if (!midlertidigEETBeregnetDato) return [];

  // Find TAF-slutdato (sidste dag i det sidst registrerede TAF-krav)
  const tafBounds = resolveTafConstraintBounds(values, { skadedatoISO });
  let lastTafKravDato: ISODateString | undefined = undefined;
  for (const periode of values.tafPerioder ?? []) {
    const valid = getValidTafRange(periode);
    if (!valid) continue;
    const clamped = clampTafRange(valid, tafBounds);
    if (!clamped) continue;
    if (!lastTafKravDato || clamped.til > lastTafKravDato) lastTafKravDato = clamped.til;
  }

  if (!lastTafKravDato) return [];

  // TAF-slutdato er efter EET-virkningsdato → der burde være midlertidige EET-ydelser
  if (lastTafKravDato < midlertidigEETBeregnetDato) return [];

  const harMidlertidigtEetYdelser = (values.offentligeYdelserRows ?? []).some((row) => {
    if (row.ydelsestype?.trim() !== 'midlertidigt_eet') return false;
    const ydelseBeloeb = amountValueToNumber(row.ydelse) ?? 0;
    const tillaegBeloeb = amountValueToNumber(row.tillaeg) ?? 0;
    return ydelseBeloeb + tillaegBeloeb > 0;
  });

  if (harMidlertidigtEetYdelser) return [];

  return [
    {
      id: 'midlertidigtEetKonsistens.afgorelseUdenYdelser',
      label: 'Advarsel',
      displayValue: 'Advarsel (Der er angivet en midlertidig EET-afgørelse men ikke indtastet ydelser)',
      status: 'warning',
      summaryDisplay: 'messageOnly',
    },
  ];
};
