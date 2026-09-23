import { isoToDanish } from '../../types/branded';
import { formatCurrency } from '../../utils/formatUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { isNonEmptyString } from '../erstatningsopgoerelse/validation/eoDateRangeMessages';
import type { EoRowModel, EoRowStatus } from './eoRowTypes';
import { activeFieldIssue, type FieldIssue } from '../../inputCore/inputIssue';
import { serializeFieldAddress } from '../../inputCore/fieldAddress';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import {
  eoOevrigeKravBeloebField,
  eoOevrigeKravDatoField,
  eoOevrigeKravUdgiftTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { assessOevrigeKravRow } from '../erstatningsopgoerelse/validation/oevrigeKravRowValidation';
import { erOevrigeKravSektionAktiv } from '../erstatningsopgoerelse/helpers/eoInputRelevance';
import { resolveBilagWarning } from '../erstatningsopgoerelse/helpers/bilagWarnings';
import type { ErstatningsopgoerelseValues, ErstatningsopgoerelseFieldIssues } from './eoRowShared';
import type { OevrigeKravRow } from '../../schemas/formSchemas';

const cellIssue = <T>(
  errors: ErstatningsopgoerelseFieldIssues,
  descriptor: FieldDescriptor<T>,
  rowId: string
): FieldIssue | undefined => activeFieldIssue(errors, serializeFieldAddress(descriptor.bind(rowId).address));

const COLUMN_DESCRIPTORS = {
  dato: eoOevrigeKravDatoField,
  udgiftTil: eoOevrigeKravUdgiftTilField,
  beloeb: eoOevrigeKravBeloebField,
} as const;

/**
 * Bygger EO-rækker for Øvrige erstatningskrav.
 *
 * Hver tabelrække giver højst ÉN linje i «Fejl og advarsler», som nævner alle rækkens mangler og linker til
 * den første celle, der skal rettes. Vurderingen ligger i `assessOevrigeKravRow`, som validatoren deler.
 */
export const buildEoOevrigeKravRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldIssues
): EoRowModel[] => {
  const rows: EoRowModel[] = [];
  const periode = values.vedroererPeriodeFra !== undefined && values.vedroererPeriodeTil !== undefined
    ? { fra: values.vedroererPeriodeFra, til: values.vedroererPeriodeTil }
    : undefined;
  const vurder = (krav: OevrigeKravRow, kvalificeretNavn: boolean) => assessOevrigeKravRow(
    krav,
    {
      dato: cellIssue(errors, eoOevrigeKravDatoField, krav.id),
      udgiftTil: cellIssue(errors, eoOevrigeKravUdgiftTilField, krav.id),
      beloeb: cellIssue(errors, eoOevrigeKravBeloebField, krav.id),
    },
    periode,
    { kvalificeretNavn }
  );
  const foersteVurderinger = (values.oevrigeKravPerioder ?? []).map((krav) => ({ krav, vurdering: vurder(krav, false) }));
  // «Fejl og advarsler» folder ordret ens linjer til én (BB-218). To rækker med samme beskrivelse og samme
  // mangel ville derfor blive til én linje, og den anden række ville først vise sig, når den første var rettet
  // (BB-231). Sådanne rækker navngives med dato og beløb, så hver række har sin egen linje.
  const beskedAntal = new Map<string, number>();
  for (const { vurdering } of foersteVurderinger) {
    if (vurdering.kind === 'error' || vurdering.kind === 'warning') {
      beskedAntal.set(vurdering.message, (beskedAntal.get(vurdering.message) ?? 0) + 1);
    }
  }
  const vurderinger = foersteVurderinger.map(({ krav, vurdering }) =>
    (vurdering.kind === 'error' || vurdering.kind === 'warning') && (beskedAntal.get(vurdering.message) ?? 0) > 1
      ? { krav, vurdering: vurder(krav, true) }
      : { krav, vurdering });
  const udfyldte = vurderinger.filter(({ vurdering }) => vurdering.kind !== 'empty');

  if (udfyldte.length === 0) {
    if (erOevrigeKravSektionAktiv(values)) {
      // «Ja» er et svar om, at der ER øvrige krav; en tabel uden en eneste post lod en glemt tabel
      // passere som et færdigt krav (BB-236). Advarslen blokerer ikke.
      rows.push({
        id: 'oevrigekrav.empty',
        label: 'Ingen',
        displayValue: '-',
        status: 'warning',
        message: 'Der er ikke indtastet øvrige krav',
        summaryDisplay: 'messageOnly',
        focusTarget: { kind: 'collectionField', template: eoOevrigeKravUdgiftTilField.template },
      });
    } else {
      rows.push({
        id: 'oevrigekrav.empty',
        label: 'Ingen',
        displayValue: '-',
        status: 'ok',
      });
    }
    return rows;
  }

  for (const { krav, vurdering } of udfyldte) {
    if (vurdering.kind === 'empty') continue;
    const udgiftTil = (krav.udgiftTil ?? '').trim();
    const datoDanish = krav.dato === undefined ? undefined : isoToDanish(krav.dato);
    const beloebText = formatCurrency(amountValueToNumber(krav.beloeb));
    if (vurdering.kind === 'ok') {
      rows.push({
        id: `oevrigekrav.${krav.id}`,
        label: datoDanish ? `${udgiftTil} (${datoDanish})` : udgiftTil,
        displayValue: beloebText,
        status: 'ok',
      });
      continue;
    }
    // Beskeden står i `message` (ikke bagt ind i label/displayValue med et «Fejl:»-præfiks): «Fejl og
    // advarsler» viser den som en selvstændig sætning, og det højrestillede link angiver placeringen.
    rows.push({
      id: `oevrigekrav.${krav.id}`,
      label: udgiftTil === '' ? 'Øvrigt erstatningskrav' : udgiftTil,
      displayValue: vurdering.kind === 'error' ? `Fejl (${vurdering.message})` : beloebText,
      status: vurdering.kind,
      message: vurdering.message,
      summaryDisplay: 'messageOnly',
      focusTarget: {
        kind: 'fieldAddress',
        address: COLUMN_DESCRIPTORS[vurdering.focusColumn].bind(krav.id).address,
      },
    });
  }

  return rows;
};

/**
 * Bygger kontrol-række for Særlige bemærkninger
 */
export const buildEoSaerligeKommentarerRows = (
  values: ErstatningsopgoerelseValues,
  _errors: ErstatningsopgoerelseFieldIssues
): EoRowModel[] => {
  const kommentarer = values.saerligeKommentarer;
  const harKommentarer = isNonEmptyString(kommentarer);

  return [
    {
      id: 'saerligekommentarer',
      label: harKommentarer ? 'Bemærkning:' : 'Ingen',
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
