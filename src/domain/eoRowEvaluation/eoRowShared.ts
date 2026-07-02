import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { FieldErrorBySource } from '../../types/fieldErrors';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString, dateToISO, parseISODate } from '../../types/branded';
import { formatAsAmountTrimmed } from '../../utils/formatUtils';
import { addDays, addMonths } from '../../utils/dateUtils';
import type { EoRowStatus } from './eoRowTypes';

/**
 * Række-id skal være stabilt og semantisk knyttet til feltets identitet (ikke label-tekst eller array-rækkefølge).
 *
 * Dette beskytter React-key-stabilitet og gør kontrol-output auditerbart.
 */
export type EoRowId =
  | 'erstatningsopgoerelse.eoNummer'
  | 'erstatningsopgoerelse.foersteErstatningsopgoerelse'
  | 'erstatningsopgoerelse.eoLedsagetekst'
  | 'erstatningsopgoerelse.revideretOpgoerelse'
  | 'erstatningsopgoerelse.vedroererPeriode'
  | 'erstatningsopgoerelse.opgørelseLavetDen'
  | 'erstatningsopgoerelse.helbredsstatus'
  | 'erstatningsopgoerelse.arbejdsstatus'
  | 'forlig.ansvarsgrad'
  | 'forlig.beregnetAnsvarsgrad'
  | 'forlig.dato'
  | 'aes.varigeMenAfgorelse'
  | 'aes.menAfgoerelseDato'
  | 'aes.midlertidigtEETAfgorelse'
  | 'aes.midlertidigEETAfgoerelseDato'
  | 'aes.midlertidigEETVirkningsdato'
  | 'aes.beregnetMidlertidigEETStartdato'
  | 'aes.endeligtEETAfgorelse'
  | 'aes.endeligEETAfgoerelseDato'
  | 'aes.endeligEETVirkningsdato'
  | 'aes.beregnetEndeligEETStartdato'
  | 'aes.verserendeKlageEet'
  | 'aes.differencekravDato'
  | 'sviesmerte.tidligereSsMax'
  | `sviesmerte.periode.${string}`
  | 'sviesmerte.satserAar'
  | 'sviesmerte.delvisSygemeldingSats'
  | 'sviesmerte.satserPerDagMax'
  | 'sviesmerte.tidligereTotal'
  | 'sviesmerte.aktuelPeriode'
  | 'sviesmerte.beregnetPeriode'
  | 'sviesmerte.antalDage'
  | 'sviesmerte.beregnetBeloeb'
  | 'sviesmerte.ophoerSkyldes'
  | 'taf.beregningsgrundlag.beregnesUdFra'
  | 'taf.beregningsgrundlag.beregningsperiode'
  | `taf.beregningsgrundlag.ferie.${string}`
  | 'taf.beregningsgrundlag.uspecificeredeFerieFridage'
  | 'taf.beregningsgrundlag.oevrigtFravaerUdenLoen'
  | 'taf.beregningsgrundlag.oevrigeFravaersdage'
  | 'taf.beregningsgrundlag.oevrigeFravaersdageBeskrivelse'
  | 'taf.beregningsgrundlag.maanedsloen'
  | 'taf.beregningsgrundlag.dagsloen'
  | 'taf.beregningsgrundlag.loenBaseretPaa'
  | 'taf.beregningsgrundlag.indkomst'
  | 'taf.beregningsgrundlag.angivetLoenOpreguleresFraDato'
  | 'taf.beregningsgrundlag.arbejdsdage'
  | 'taf.beregningsgrundlag.maaneder'
  | 'taf.beregnesSom'
  | 'taf.ophoerSkyldes'
  | 'taf.ingenTafIEoPerioden'
  | `taf.periode.${string}`
  | `taf.folkepensionsalder.${string}`
  | `taf.ferie.${string}`
  | 'taf.tidligereModtagetTaf'
  | `loenindkomst.${string}.arbejdsstedNavn`
  | `loenindkomst.${string}.satserSkadestidspunkt`
  | `loenindkomst.${string}.loenoplysninger`
  | `loenindkomst.${string}.regulering.valgt`
  | `loenindkomst.${string}.regulering.navn`
  | `loenindkomst.${string}.regulering.alleVaerdier`
  | `loenindkomst.${string}.loenEfterOphoer`
  | `offentligeYdelser.${string}`
  | `sfgg.beregningskilde.${string}`
  | `sfgg.overenskomst.${string}`
  | `sfgg.overenskomstensReferenceperiode.${string}`
  | `sfgg.satsvalg.${string}`
  | `sfgg.beregnesFra.${string}`
  | `sfgg.foerstEfterSygeloen.${string}`
  | `sfgg.varighedsbegraenset.${string}`
  | `sfgg.ansaettelsesforholdOphoert.${string}`
  | `sfgg.periode.${string}`
  | `sfgg.referenceperiode.${string}`
  | `sfgg.referenceperiodeantal.${string}`
  | `sfgg.referencesats.${string}`
  | `sfgg.dagssats.${string}`
  | `sfgg.tabel.${string}`
  | `sfgg.eftertabel.feriepengeHvisIkkeSkade.${string}`
  | `sfgg.eftertabel.feriepengeModtaget.${string}`
  | `sfgg.eftertabel.alleredeBetalt.${string}`
  | `sfgg.eftertabel.beregnet.${string}`
  | `sfgg.forklaring.${string}`
  | `sfgg.advarsel.seksmaaneder.${string}`
  | `oevrigekrav.${string}`
  | 'saerligekommentarer'
  | 'bilagsnumre.ingen'
  | 'bilagsnumre.menAfgoerelse'
  | 'bilagsnumre.eetAfgoerelser'
  | 'bilagsnumre.svieSmerteDokumentation'
  | 'bilagsnumre.beregningsgrundlagTaf'
  | 'bilagsnumre.loenISygeperioden'
  | 'bilagsnumre.offentligeYdelser'
  | 'bilagsnumre.oevrigeErstatningskrav'
  | 'midlertidigtEetKonsistens.ydelerUdenAfgorelse'
  | 'midlertidigtEetKonsistens.afgorelseUdenYdelser';

// Kanoniske id-prefikser for SFGG-rækker bygget efter sygeferiegodtgørelses-tabellen.
// Predikaterne ligger her sammen med byggeren der emitterer id'erne, så ingen
// render-komponent gen-koder `sfgg.eftertabel.`-grammatikken parallelt.
const SFGG_EFTERTABEL_ID_PREFIX = 'sfgg.eftertabel.';
const SFGG_EFTERTABEL_BEREGNET_ID_PREFIX = 'sfgg.eftertabel.beregnet.';

/** Sand for SFGG-rækker der hører efter selve sygeferiegodtgørelses-tabellen. */
export const isSfggPostTableRowId = (id: string): boolean => id.startsWith(SFGG_EFTERTABEL_ID_PREFIX);

/** Sand for den beregnede SFGG-totalrække (vises med fed skrift). */
export const isSfggComputedTotalRowId = (id: string): boolean => id.startsWith(SFGG_EFTERTABEL_BEREGNET_ID_PREFIX);

export type ErstatningsopgoerelseValues = PersistedSectionMap['erstatningsopgoerelse'];
export type ErstatningsopgoerelseFieldName = Extract<keyof ErstatningsopgoerelseValues, string>;
export type ErstatningsopgoerelseFieldErrorsBySource = Partial<Record<ErstatningsopgoerelseFieldName, FieldErrorBySource>>;
export type StamdataValues = PersistedSectionMap['stamdata'];

export const formatRowCount = (value: number): string => formatAsAmountTrimmed(value, 0);
export const formatRowMonths = (value: number): string => formatAsAmountTrimmed(value, 4);

export const formatStatusMessage = (status: EoRowStatus, message: string): string => {
  if (status === 'ok') return '-';
  const trimmed = message.trim();
  if (trimmed === '' || trimmed === '-') {
    return status === 'error' ? 'Fejl (Indtastning mangler)' : 'Advarsel (Indtastning mangler)';
  }
  return `${status === 'error' ? 'Fejl' : 'Advarsel'} (${trimmed})`;
};

export type ReguleringsRange = Readonly<{
  min?: ISODateString;
  max?: ISODateString;
}>;

export const parseDanishToIso = (value: string | undefined): ISODateString | undefined => {
  if (!value || value.trim() === '') return undefined;
  return coerceToISODateString(value.trim());
};

export const getRangeForManualRegulering = (
  baseIso: ISODateString | undefined,
  rows: ReadonlyArray<{ dato?: string | undefined }>
): ReguleringsRange => {
  const dates: ISODateString[] = [];
  if (baseIso) dates.push(baseIso);

  rows.forEach((row) => {
    const iso = parseDanishToIso(row.dato);
    if (iso) dates.push(iso);
  });

  if (dates.length === 0) return {};

  let min = dates[0];
  let max = dates[0];
  for (const iso of dates) {
    if (iso < min) min = iso;
    if (iso > max) max = iso;
  }

  const maxDate = parseISODate(max);
  if (!maxDate) return { min };

  const adjustedMax = dateToISO(addDays(addMonths(maxDate, 12), -1));
  return { min, max: adjustedMax };
};

export const calculateElapsedWholeMonths = (fromIso: ISODateString, toIso: ISODateString): number => {
  if (toIso <= fromIso) return 0;
  const fromDate = parseISODate(fromIso);
  const toDate = parseISODate(toIso);
  if (!fromDate || !toDate) return 0;

  let months =
    (toDate.getUTCFullYear() - fromDate.getUTCFullYear()) * 12 +
    (toDate.getUTCMonth() - fromDate.getUTCMonth());
  if (toDate.getUTCDate() < fromDate.getUTCDate()) {
    months -= 1;
  }

  return Math.max(0, months);
};

export const buildReguleringsMangelMessage = (
  status: EoRowStatus,
  displayValue: string
): string | undefined => {
  if (status === 'ok') return undefined;
  const trimmed = displayValue.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === 'Nej') return 'er ikke angivet';
  if (trimmed.startsWith('Nej')) return `er ikke angivet${trimmed.slice(3)}`;
  return trimmed;
};
