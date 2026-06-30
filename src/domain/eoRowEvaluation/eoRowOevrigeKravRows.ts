import { isoToDanish } from '../../types/branded';
import { formatCurrency } from '../../utils/formatUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { isNonEmptyString } from './eoRowCommon';
import type { EoRowModel, EoRowStatus } from './eoRowTypes';
import { buildIncomeForRanges, buildTafRanges } from '../erstatningsopgoerelse/helpers/indtaegtPerioder';
import { resolveOevrigeKravIntroLinjer } from '../erstatningsopgoerelse/helpers/oevrigeKravIntro';
import { resolveBilagWarning } from '../erstatningsopgoerelse/helpers/bilagWarnings';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import type { ErstatningsopgoerelseValues, ErstatningsopgoerelseFieldErrorsBySource } from './eoRowShared';

/**
 * Bygger EO-rækker for Øvrige erstatningskrav.
 */
export const buildEoOevrigeKravRows = (
  values: ErstatningsopgoerelseValues,
  _errors: ErstatningsopgoerelseFieldErrorsBySource,
  canonicalOutput?: EoCanonicalOutput
): EoRowModel[] => {
  const rows: EoRowModel[] = [];
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
      // Status er advarsel hvis kun dato mangler.
      // Selve fejl-/advarselsteksten lægges i `message` (ikke bagt ind i label/displayValue med
      // et "Fejl:"-præfiks): "Fejl og advarsler" viser `message` som en selvstændig, specifik
      // sætning, og det højrestillede link angiver placeringen. `messageOnly` sikrer, at netop
      // `message` vises uden label-præfiks.
      let status: EoRowStatus = 'ok';
      let label = '';
      let displayValue = '';
      let message: string | undefined;

      if (!udgiftOgBeloebUdfyldt) {
        // Fejl: Enten beskrivelse eller beløb (eller begge) mangler
        status = 'error';

        if (!hasUdgiftTil && !hasBeloeb) {
          label = 'Øvrigt erstatningskrav';
          message = 'Beskrivelse og beløb er ikke udfyldt';
        } else if (!hasUdgiftTil) {
          label = 'Øvrigt erstatningskrav';
          message = 'Beskrivelse er ikke udfyldt';
        } else {
          label = krav.udgiftTil ?? 'Øvrigt erstatningskrav';
          message = 'Beløb er ikke angivet';
        }
        displayValue = `Fejl (${message})`;
      } else if (!hasDato) {
        // Advarsel: Kun dato mangler
        status = 'warning';
        label = krav.udgiftTil ?? 'Øvrigt erstatningskrav';
        message = 'Dato er ikke angivet';
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
        message,
        summaryDisplay: status !== 'ok' ? 'messageOnly' : undefined,
      });
    });
  }

  return rows;
};

/**
 * Bygger debug-række for Særlige kommentarer
 */
export const buildEoSaerligeKommentarerRows = (
  values: ErstatningsopgoerelseValues,
  _errors: ErstatningsopgoerelseFieldErrorsBySource
): EoRowModel[] => {
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
 * Bygger EO-rækker for Bilagsnumre.
 * Returnerer tom liste hvis visBilagsnumre !== 'Ja'.
 */
export const buildEoBilagsnumreRows = (
  values: ErstatningsopgoerelseValues
): EoRowModel[] => {
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
        status: 'warning' as EoRowStatus,
        message: warning,
        summaryDisplay: 'messageOnly' as const,
      };
    }
    return {
      id: entry.id,
      label: entry.label,
      displayValue: entry.value!.trim(),
      status: 'ok' as EoRowStatus,
    };
  });
};
