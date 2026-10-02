import * as React from 'react';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../../schemas/formSchemas';
import { useLoentrinFinder } from '../shared/useLoentrinFinder';
import { calculateKalenderdageInclusive } from '../../../../domain/erstatningsopgoerelse/engines/tafCalculations';
import {
  buildFerieFeriedageById,
  buildTafDerived,
  resolveBeregningsperiodeFerieRamme,
  resolveTafFerieRamme,
} from '../../../../domain/erstatningsopgoerelse/helpers/tafRowDerived';
import { erBeregningsperiodeFerieRelevant, erTafLoseFeriedageRelevant } from '../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { computeTafBeregningsenhed } from '../../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import {
  evaluateBeregningsgrundlagFradragAdvarsel,
  resolveBeregningsgrundlagFradrag,
} from '../../../../domain/erstatningsopgoerelse/validation/beregningsgrundlagFradragRules';
import {
  resolveAngivetLoenAdvarsel,
  resolveOevrigeFravaersdageAdvarsel,
  resolveOevrigtFravaerAarsagAdvarsel,
} from '../../../../domain/erstatningsopgoerelse/validation/beregningsgrundlagFeltAdvarsler';
import { createFieldWarning, type FieldWarning } from '../../../../inputCore/fieldWarning';
import { evaluateForligAnsvarsgradRules } from '../../../../domain/erstatningsopgoerelse/validation/forligAnsvarsgradRules';
import { resolveMidlertidigEetDatoHvisAktiv } from '../../../../domain/erstatningsopgoerelse/validation/tafPeriodConstraints';
import { clampSvieSmerteRange, resolveSvieSmerteEoPeriodeBounds } from '../../../../domain/erstatningsopgoerelse/validation/svieSmerteConstraints';
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
import { useReguleringDocumentAction } from '../../../../domain/erstatningsopgoerelse/react/useReguleringDocumentAction';

type ReguleringsDatoInterval = Readonly<{ fraDato: string; tilDato: string }>;

/** Sagsniveauets aktiveringsidentitet. Modul-konstant, så resolverens memo ikke invalideres pr. render. */
const CASE_REGULERING_REQUEST = { scope: 'case' } as const;

const formatLabelDayAfterIsoDate = (defaultLabel: string, tilDato: ErstatningsopgoerelseValues['vedroererPeriodeTil'], prefix: string): string => {
  if (tilDato === undefined) return defaultLabel;
  const parsedDate = isoDateToDate(tilDato);
  if (parsedDate === undefined) return defaultLabel;
  const nextDay = new Date(parsedDate.getTime());
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return `${prefix} den ${nextDay.getUTCDate()}. ${MONTH_NAMES_DA[nextDay.getUTCMonth()]} ${nextDay.getUTCFullYear()}:`;
};

/** Reader-afledt præsentationsmodel for EO-oplysninger; modellen ejer ingen persisted writekanal. */
export function useEoOplysningerViewModel(values: ErstatningsopgoerelseValues, stamdataValues: StamdataValues) {
  const skadedatoISO = stamdataValues.skadedato;
  const eoLoenudvikling = values.eoAngivetLoenLoenudvikling;
  const loentrinFinder = useLoentrinFinder();
  // "Antal dage" viser rækkens bidrag til opgørelsen – altså dagene INDEN FOR EO-perioden, ikke
  // rækkens egen længde. Opgørelsen betaler kun for det afgrænsede, og kolonnen er det eneste tal,
  // brugeren ser mens han taster (BB-217). Kolonneoverskriften bærer årsagen, så det lavere tal
  // ikke fremstår som en tavs reduktion.
  // Der clampes mod EO-perioden ALENE – ikke mod ménafgørelsens cutoff, som er en fejlgivende
  // grænse med rød celle og egen besked; den skal ikke også tælle dage ned bag om ryggen.
  // Engineens `constrainedPeriods` kan ikke bruges her: den fletter overlappende/tilstødende
  // perioder og sorterer dem, så rækkeidentiteten går tabt.
  const eoPeriodeBounds = React.useMemo(
    () => resolveSvieSmerteEoPeriodeBounds({
      vedroererPeriodeFra: values.vedroererPeriodeFra,
      vedroererPeriodeTil: values.vedroererPeriodeTil,
    }),
    [values.vedroererPeriodeFra, values.vedroererPeriodeTil],
  );
  const svie = React.useMemo(() => ({
    derivedById: Object.fromEntries(values.svieSmertePerioder.map((row) => {
      const hasRangeError = row.fra !== undefined && row.til !== undefined && row.fra > row.til;
      if (hasRangeError) return [row.id, { hasRangeError, antalDage: null }];
      if (row.fra === undefined || row.til === undefined) {
        return [row.id, { hasRangeError, antalDage: calculateKalenderdageInclusive(row.fra, row.til) }];
      }
      const clamped = clampSvieSmerteRange({ fra: row.fra, til: row.til }, eoPeriodeBounds);
      // Helt uden for perioden: rækken bidrager med 0, ikke med sin egen længde.
      if (clamped === null) return [row.id, { hasRangeError, antalDage: 0 }];
      return [row.id, { hasRangeError, antalDage: calculateKalenderdageInclusive(clamped.fra, clamped.til) }];
    })),
  }), [values.svieSmertePerioder, eoPeriodeBounds]);
  const tafDerived = React.useMemo(() => buildTafDerived({ values, tafPerioder: values.tafPerioder, ferieperioder: values.ferieperioder, skadedatoISO }), [skadedatoISO, values]);
  // Ferietabellernes kolonne tæller de feriedage, beregningen fradrager – inden for TAF-perioderne hhv.
  // beregningsperioden – og overskriften siger rammen (BB-249).
  const ferieFeriedageById = React.useMemo(
    () => buildFerieFeriedageById(values.ferieperioder, resolveTafFerieRamme(values, skadedatoISO)),
    [skadedatoISO, values],
  );
  const fravaerFeriedageById = React.useMemo(
    () => buildFerieFeriedageById(values.fravaerPerioder, resolveBeregningsperiodeFerieRamme(values)),
    [values],
  );
  const visTafLoseFeriedage = erTafLoseFeriedageRelevant(values);
  // Beregningsperiodens ferie og løse dage virker kun i arbejdsdage og skjules ellers (BB-263).
  const visBeregningsperiodeFerie = erBeregningsperiodeFerieRelevant(values);
  // Beregningsgrundlagets gule ringe – samme regler og tekster som linjerne i «Fejl og advarsler» (BB-259,
  // BB-268, BB-269). Fradragsadvarslen sidder på hvert indtastet fradrag, der æder perioden.
  const beregningsgrundlagAdvarsler = React.useMemo(() => {
    const fradrag = evaluateBeregningsgrundlagFradragAdvarsel(
      resolveBeregningsgrundlagFradrag(values, computeTafBeregningsenhed(values)),
    );
    const warning = (message: string | undefined): FieldWarning | undefined =>
      message === undefined ? undefined : createFieldWarning(message);
    return {
      loseFeriedage: warning(fradrag?.felter.includes('loseFeriedage') ? fradrag.message : undefined),
      fravaersdage: warning(
        resolveOevrigeFravaersdageAdvarsel(values)
        ?? (fradrag?.felter.includes('fravaersdage') ? fradrag.message : undefined),
      ),
      aarsag: warning(resolveOevrigtFravaerAarsagAdvarsel(values)),
      angivetLoen: warning(resolveAngivetLoenAdvarsel(values)),
    };
  }, [values]);
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
  // Reguleringssats-downloaden på SAGSNIVEAU. Resolveren ejer både knaptilstanden og
  // valget mellem regulering/KRL/KL-lønaftaler, og den vælger først EFTER commit-barrieren – så et
  // grundlagsskifte i en åben editor ikke kan levere det forrige grundlags dokument.
  const reguleringDocument = useReguleringDocumentAction(CASE_REGULERING_REQUEST);
  return {
    values, skadedatoISO, erErhvervssygdom: stamdataValues.skadestype === 'Erhvervssygdom', forligFejl,
    svie, tafDerived, ferieFeriedageById, fravaerFeriedageById, visTafLoseFeriedage, visBeregningsperiodeFerie,
    beregningsgrundlagAdvarsler,
    fravaer: { committedRowsEnsured: values.fravaerPerioder },
    statusSubheaderLabel: formatLabelDayAfterIsoDate('Status ved erstatningsperiodens udløb', values.vedroererPeriodeTil, 'Status').replace(/:$/, ''),
    menAfgoerelseDatoForTabel: values.varigeMenAfgorelse === 'Ja' ? values.menAfgoerelseDato : undefined,
    endeligEETBeregnetDato: values.endeligtEETAfgorelse === 'Ja' ? (values.endeligEETVirkningsdato || values.endeligEETAfgoerelseDato) : undefined,
    midlertidigEETBeregnetDato: resolveMidlertidigEetDatoHvisAktiv({ ...values, skadedatoISO }),
    verserendeKlageMen: values.verserendeKlageMen === 'Ja', verserendeKlageEet: values.verserendeKlageEet === 'Ja',
    skalKomprimereIndtaegtFoerSkaden: !erDetteFoersteErstatningsopgoerelse(values.eoNummer) && values.komprimerBeregningEfterFoersteOpgoerelse === 'Ja',
    indtaegtFoerSkadenSectionTitle: `Indtægt før ${referencedato.labelLower}`,
    // Bestemt form af både lønnen og referencedatoen (BB-271): «månedslønnen» og «skadedatoen». En bøjning
    // ved strengsammensætning (`'månedsløn' + 'en'`) gav før «månedslønen».
    angivetLoenOpreguleringLabel: `Det angivne beløb afspejler ${values.beregnesUdFra === 'Angivet månedsløn' ? 'månedslønnen' : 'dagslønnen'} per dato (hvis forskellig fra ${referencedato.labelLower})`,
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
    reguleringDocument,
  };
}
