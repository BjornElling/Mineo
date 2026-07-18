import * as React from 'react';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../../schemas/formSchemas';
import { useAppSettings } from '../../../../contexts/useAppSettings';
import { useEoLoentrinFinder } from './useEoLoentrinFinder';
import { calculateKalenderdageInclusive } from '../../../../domain/erstatningsopgoerelse/engines/tafCalculations';
import { calculateFerieHverdageMinusSHDage } from '../../../../domain/erstatningsopgoerelse/engines/ferieCalculations';
import { buildTafDerived } from '../../../../domain/erstatningsopgoerelse/helpers/tafRowDerived';
import { evaluateForligAnsvarsgradRules } from '../../../../domain/erstatningsopgoerelse/validation/forligAnsvarsgradRules';
import { resolveMidlertidigEetDatoHvisAktiv } from '../../../../domain/erstatningsopgoerelse/validation/tafPeriodConstraints';
import { erDetteFoersteErstatningsopgoerelse } from '../../../../domain/erstatningsopgoerelse/validation/eoNummerValidering';
import { resolveAnvendtReguleringsdatoReferenceText, resolveSkadeEllerAnmeldelsesdatoReference } from '../../../../domain/erstatningsopgoerelse/helpers/eoDateReferenceText';
import { parseISODate } from '../../../../types/branded';
import { formatDanishDate } from '../../../../utils/dateUtils';
import { isoDateToDate } from '../../../../domain/dates/isoDate';
import { MONTH_NAMES_DA } from '../../../../utils/dateFormatting';
import { getAlleArbejdsgiverOrg, getAlleLoenmodtagerOrg, getOverenskomsterByOrg, getReguleringsDatoIntervalForOverenskomst, isOffentligOverenskomstId } from '../../../../data/overenskomstRates';
import { getReguleringsDatoIntervalForStatistikModel } from '../../../../data/statistiskeRates';
import { getReguleringsDatoIntervalForKRL, type KRLSatstabelId } from '../../../../data/krlRates';
import { getReguleringsDatoIntervalForKlLoenaftaler } from '../../../../data/klLoenaftaler';
import { downloadKlLoenaftalerDokument, downloadKrlDokument, downloadReguleringDokument, type ReguleringDocumentInput } from '../../../../document/service/documentService';

type ReguleringsDatoInterval = Readonly<{ fraDato: string; tilDato: string }>;
const formatLabelDayAfterIsoDate = (defaultLabel: string, tilDato: ErstatningsopgoerelseValues['vedroererPeriodeTil'], prefix: string): string => {
  if (tilDato === undefined) return defaultLabel;
  const parsedDate = isoDateToDate(tilDato);
  if (parsedDate === undefined) return defaultLabel;
  const nextDay = new Date(parsedDate.getTime());
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return `${prefix} den ${nextDay.getUTCDate()}. ${MONTH_NAMES_DA[nextDay.getUTCMonth()]} ${nextDay.getUTCFullYear()}:`;
};

/** Reader-afledt præsentationsmodel for EO-oplysninger; modellen ejer ingen persisted writekanal. */
export function useGreenfieldEoOplysningerViewModel(values: ErstatningsopgoerelseValues, stamdataValues: StamdataValues) {
  const { settings } = useAppSettings();
  const skadedatoISO = stamdataValues.skadedato;
  const eoLoenudvikling = values.eoAngivetLoenLoenudvikling;
  const loentrinFinder = useEoLoentrinFinder(eoLoenudvikling.overenskomstId, eoLoenudvikling.offentligLoenType);
  const svie = React.useMemo(() => ({
    derivedById: Object.fromEntries(values.svieSmertePerioder.map((row) => {
      const hasRangeError = row.fra !== undefined && row.til !== undefined && row.fra > row.til;
      return [row.id, { hasRangeError, antalDage: hasRangeError ? null : calculateKalenderdageInclusive(row.fra, row.til) }];
    })),
  }), [values.svieSmertePerioder]);
  const tafDerived = React.useMemo(() => buildTafDerived({ values, tafPerioder: values.tafPerioder, ferieperioder: values.ferieperioder, skadedatoISO }), [skadedatoISO, values]);
  const ferieFeriedageById = React.useMemo(() => Object.fromEntries(values.ferieperioder.map((row) => [row.id, calculateFerieHverdageMinusSHDage(row.fra, row.til)])), [values.ferieperioder]);
  const fravaerFeriedageById = React.useMemo(() => Object.fromEntries(values.fravaerPerioder.map((row) => [row.id, calculateFerieHverdageMinusSHDage(row.fra, row.til)])), [values.fravaerPerioder]);
  const forligEvaluation = React.useMemo(() => evaluateForligAnsvarsgradRules(values), [values]);
  const forligFejl = React.useMemo(() => ({ harFejl: forligEvaluation.beggeUdfyldt, fejlbesked: forligEvaluation.beggeUdfyldtFejl ?? '' }), [forligEvaluation]);
  const visLoenudviklingFraEO = values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn';
  const loenudviklingBasis = eoLoenudvikling.loenudviklingBeregningsgrundlag;
  const filteredOverenskomster = React.useMemo(() => getOverenskomsterByOrg(eoLoenudvikling.overenskomstFilter.loenmodtager, eoLoenudvikling.overenskomstFilter.arbejdsgiver), [eoLoenudvikling.overenskomstFilter]);
  const erOffentligOverenskomst = Boolean(eoLoenudvikling.overenskomstId && isOffentligOverenskomstId(eoLoenudvikling.overenskomstId));
  const aktivAngivetLoenOpreguleresFraDato = values.beregnesUdFra === 'Angivet månedsløn' ? values.angivetMaanedsloenOpreguleresFraDato : values.beregnesUdFra === 'Angivet dagsløn' ? values.angivetDagsloenOpreguleresFraDato : undefined;
  const loenudviklingBaseDateISO = React.useMemo(() => {
    const value = aktivAngivetLoenOpreguleresFraDato || skadedatoISO;
    return value !== undefined && parseISODate(value) ? value : undefined;
  }, [aktivAngivetLoenOpreguleresFraDato, skadedatoISO]);
  const loenudviklingBaseDateDisplay = React.useMemo(() => {
    const parsed = loenudviklingBaseDateISO === undefined ? null : parseISODate(loenudviklingBaseDateISO);
    return parsed == null ? '' : formatDanishDate(parsed);
  }, [loenudviklingBaseDateISO]);
  const referencedato = resolveSkadeEllerAnmeldelsesdatoReference(stamdataValues.skadestype);
  const shouldShowReguleringsDatoInterval = loenudviklingBasis === 'Overenskomst' || (loenudviklingBasis === 'Statistik' && Boolean(eoLoenudvikling.loenudviklingStatistikModel)) || (loenudviklingBasis === 'KRL satstabel' && Boolean(eoLoenudvikling.loenudviklingKRLSatstabel)) || loenudviklingBasis === 'KL-lønaftaler';
  const reguleringsDatoIntervalData: ReguleringsDatoInterval | undefined = React.useMemo(() => {
    if (loenudviklingBasis === 'Overenskomst') return getReguleringsDatoIntervalForOverenskomst(eoLoenudvikling.overenskomstId ?? '');
    if (loenudviklingBasis === 'Statistik') return getReguleringsDatoIntervalForStatistikModel(eoLoenudvikling.loenudviklingStatistikModel ?? '');
    if (loenudviklingBasis === 'KRL satstabel' && eoLoenudvikling.loenudviklingKRLSatstabel) return getReguleringsDatoIntervalForKRL(eoLoenudvikling.loenudviklingKRLSatstabel as KRLSatstabelId);
    if (loenudviklingBasis === 'KL-lønaftaler') return getReguleringsDatoIntervalForKlLoenaftaler();
    return undefined;
  }, [eoLoenudvikling, loenudviklingBasis]);
  const documentContext = React.useMemo(() => ({ settings, persistedStamdata: stamdataValues }), [settings, stamdataValues]);
  const opgoerelseLavetDenInputRef = React.useRef<HTMLInputElement>(null);

  return {
    values, skadedatoISO, erErhvervssygdom: stamdataValues.skadestype === 'Erhvervssygdom', forligFejl,
    svie, tafDerived, ferieFeriedageById, fravaerFeriedageById,
    fravaer: { committedRowsEnsured: values.fravaerPerioder }, opgoerelseLavetDenInputRef,
    statusSubheaderLabel: formatLabelDayAfterIsoDate('Status ved erstatningsperiodens udløb', values.vedroererPeriodeTil, 'Status').replace(/:$/, ''),
    menAfgoerelseDatoForTabel: values.varigeMenAfgorelse === 'Ja' ? values.menAfgoerelseDato : undefined,
    endeligEETBeregnetDato: values.endeligtEETAfgorelse === 'Ja' ? (values.endeligEETVirkningsdato || values.endeligEETAfgoerelseDato) : undefined,
    midlertidigEETBeregnetDato: resolveMidlertidigEetDatoHvisAktiv({ ...values, skadedatoISO }),
    verserendeKlageMen: values.verserendeKlageMen === 'Ja', verserendeKlageEet: values.verserendeKlageEet === 'Ja',
    skalKomprimereIndtaegtFoerSkaden: !erDetteFoersteErstatningsopgoerelse(values.eoNummer) && values.komprimerBeregningEfterFoersteOpgoerelse === 'Ja',
    indtaegtFoerSkadenSectionTitle: `Indtægt før ${referencedato.labelLower}`,
    angivetLoenOpreguleringLabel: `Det angivne beløb afspejler ${values.beregnesUdFra === 'Angivet månedsløn' ? 'månedsløn' : 'dagsløn'}en per dato (hvis forskellige fra skadedato)`,
    aktivAngivetLoenOpreguleresFraDato, visLoenudviklingFraEO, eoLoenudvikling, loentrinFinder,
    alleLoenmodtagerOrg: getAlleLoenmodtagerOrg(), alleArbejdsgiverOrg: getAlleArbejdsgiverOrg(), filteredOverenskomster,
    loenudviklingBasis, erOffentligOverenskomst,
    offentligLoenEkstraGrundloenSuffix: eoLoenudvikling.offentligLoenType === 'Timeløn' ? '/ time' : '/ måned',
    eoAnciennitetSatsPerTekst: values.beregnesUdFra === 'Angivet dagsløn' ? 'time' : 'måned',
    showEoAnciennitetstillaegSection: visLoenudviklingFraEO && loenudviklingBasis === 'Overenskomst' && Boolean(eoLoenudvikling.overenskomstId?.trim()),
    loenudviklingBaseDateISO, loenudviklingBaseDateDisplay,
    loenudviklingBaseDateErrorMessage: `${referencedato.label} er ikke udfyldt`,
    loenudviklingBaseDateReferenceText: resolveAnvendtReguleringsdatoReferenceText({ anvendtReguleringsdato: loenudviklingBaseDateISO, skadedato: skadedatoISO, skadestype: stamdataValues.skadestype, beregnesUdFra: values.beregnesUdFra, beregningsperiodeTil: values.tafBeregningsperiodeTil, saerligFraDatoRegulering: undefined, angivetLoenMetodeOpreguleresFraDato: aktivAngivetLoenOpreguleresFraDato }),
    shouldShowReguleringsDatoInterval, reguleringsDatoIntervalData,
    reguleringsDatoIntervalDisplay: reguleringsDatoIntervalData ? `${reguleringsDatoIntervalData.fraDato} - ${reguleringsDatoIntervalData.tilDato}` : '',
    handleDownloadReguleringPdf: async (input: ReguleringDocumentInput) => downloadReguleringDokument({ input, ...documentContext }),
    handleDownloadKRLPdf: async () => downloadKrlDokument(documentContext),
    handleDownloadKlLoenaftalerPdf: async () => downloadKlLoenaftalerDokument(documentContext),
  };
}
