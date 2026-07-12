import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import StyledCheckbox from '../../inputs/StyledCheckbox';
import StyledToggleSwitch from '../../inputs/StyledToggleSwitch';
import StyledPercentField from '../../inputs/StyledPercentField';
import StyledFractionField from '../../inputs/StyledFractionField';
import StyledDateField from '../../inputs/StyledDateField';
import type { CommitEvent } from '../../../types/fieldEvents';
import type { ErhvervsevnetabComposedValues, ErhvervsevnetabValues, ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { coerceToISODateString, type ISODateString } from '../../../types/branded';
import { computeSkadedatoMinRule, dateRanges_erstatningsopgoerelse } from '../../../config/dateRanges';
import type { ReportableFieldError } from '../../../types/fieldErrors';
import { useFormFieldErrorReporter } from '../../../hooks/useFormFieldErrors';
import { buildBeregnetDifferencekravLabel } from '../../../domain/erhvervsevnetab/eetDifferencekravPresentation';
import { buildForligIndgaaetSaetning } from '../../../domain/erstatningsopgoerelse/engines/forligsgrad';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { formatIsoDateLong, formatISOToDanish } from '../../../utils/dateFormatting';
import { formatAsAmountTrimmed } from '../../../utils/formatUtils';
import {
  type EetDifferencekravProformaKapitalisering,
} from '../../../domain/erhvervsevnetab/eetDifferencekravCalculation';
import type {
  MerErstatningPensionsalderComputation,
  MerErstatningPensionsalderEvent,
} from '../../../domain/erhvervsevnetab/eetMerErstatningPensionsalderCalculation';
import { formatPct as formatKapPct } from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import {
  buildKapitaliseringAarsydelseExpression,
  buildKapitaliseringGrundydelseExpression,
  buildKapitaliseringGrundydelseLabel,
  buildKapitaliseringOpreguleringTil2024Expression,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringPresentation';
import { downloadDifferencekravDokument } from '../../../document/service/documentService';
import EetIssuesBox from './EetIssuesBox';
import HoverRow from './HoverRow';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import InfoTooltipIcon from '../../common/InfoTooltipIcon';
import { useShakeFlag } from '../../../hooks/useShakeFlag';
import { useForligAnsvarsgradValidation } from '../../../hooks/useForligAnsvarsgradValidation';
import { formatFaktor, formatJaNej } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { type SetValuesUpdater } from '../../../hooks/usePersistedForm';
import type { EetSnapshot } from '../../../domain/erhvervsevnetab/eetSnapshot';
import { formatKr } from '../../../utils/formatUtils';
import { toKroner } from '../../../domain/money/money';

type ForligValues = Pick<ErstatningsopgoerelseValues, 'forligAnsvarsgradProcent' | 'forligAnsvarsgradBroek' | 'forligDato'>;

type Props = Readonly<{
  values: ErhvervsevnetabComposedValues;
  setValues: SetValuesUpdater<ErhvervsevnetabValues>;
  // Forlig om ansvarsgrad er delt kilde med EO-fanen (felterne bor i erstatningsopgoerelse-sektionen).
  forligValues: ForligValues;
  setForligValues: SetValuesUpdater<ErstatningsopgoerelseValues>;
  onGoToEetOplysninger: () => void;
  stamdata: StamdataValues | null;
  snapshot: EetSnapshot['differencekrav'];
}>;

type ProformaBoxProps = Readonly<{
  pk: EetDifferencekravProformaKapitalisering;
  koen: ErhvervsevnetabValues['koen'];
}>;

const formatMaaneder = (value: number): string => formatAsAmountTrimmed(value, 4);

const EetProformaKapitaliseringBox = ({ pk, koen }: ProformaBoxProps) => (
  <ContentBox className="content-box">
    <Typography className="section-header">Proformakapitalisering af rest-EET</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Kapitaliseringsdato</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatISOToDanish(pk.kapitaliseringsdato)}</Typography>
      </Box>
    </Box>

    <Typography className="row--subheading">Grundydelse og regulering</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Proformakapitalisering</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKapPct(pk.loebendeEetPct)}</Typography>
      </Box>
    </Box>

    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {buildKapitaliseringGrundydelseLabel(
          formatKapPct(pk.loebendeEetPct),
          pk.amBidragPct
        )}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">
          {buildKapitaliseringGrundydelseExpression(
            formatKr(toKroner(pk.grundloenOre), 0),
            formatKapPct(pk.loebendeEetPct),
            pk.erstatningsniveauPct,
            pk.amBidragPct,
            formatKr(toKroner(pk.grundydelseOre), 2)
          )}
        </Typography>
      </Box>
    </Box>

    {pk.grundydelse2024Ore !== null && pk.opreguleringTil2024PctRounded4 !== null && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {buildKapitaliseringOpreguleringTil2024Expression(
            formatKr(toKroner(pk.grundydelseOre), 2),
            formatAsAmountTrimmed(1 + pk.opreguleringTil2024PctRounded4 / 100, 4),
            `${formatAsAmountTrimmed(pk.opreguleringTil2024PctRounded4, 4)} %`
          )}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatKr(toKroner(pk.grundydelse2024Ore), 2)}</Typography>
        </Box>
      </Box>
    )}

    {pk.aarsydelseReguleringsPctRounded4 !== null && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {`Reguleringsprocent (${formatIsoDateLong(pk.kapitaliseringsdato)})`}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{`${formatAsAmountTrimmed(pk.aarsydelseReguleringsPctRounded4, 4)} %`}</Typography>
        </Box>
      </Box>
    )}

    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {buildKapitaliseringAarsydelseExpression(
          formatKr(toKroner(pk.aarsydelseGrundlagOre), 2),
          pk.aarsydelseReguleringsPctRounded4 === null
            ? null
            : `${formatAsAmountTrimmed(100 + pk.aarsydelseReguleringsPctRounded4, 4)} %`
        )}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(toKroner(pk.aarsydelseOre), 2)}</Typography>
      </Box>
    </Box>

    <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitaliseringsbekendtgørelse og tabel</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Kapitaliseringsbekendtgørelse</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{pk.kapitaliseringsbekendtgoerelseLabel}</Typography>
      </Box>
    </Box>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Alder ved proformakapitalisering</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{`${pk.alderAar} år, ${pk.alderMaaneder} måneder`}</Typography>
      </Box>
    </Box>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Folkepensionsalder</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{pk.folkepensionsalderLabel}</Typography>
      </Box>
    </Box>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Kapitaliseret pga. &lt; 2 år til folkepension?</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatJaNej(pk.kapitaliseretPgaUnderToAarTilFp)}</Typography>
      </Box>
    </Box>

    {pk.kapitaliseretPgaUnderToAarTilFp && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">Særfaktor (&lt; 2 år til folkepension)</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{pk.saerfaktor === null ? '-' : formatFaktor(pk.saerfaktor)}</Typography>
        </Box>
      </Box>
    )}

    {!pk.kapitaliseretPgaUnderToAarTilFp && (
      <>
        <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitaliseringsfaktor</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Faktor måneds-afhængig?</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text">{formatJaNej(pk.faktorMaanedsAfhaengig)}</Typography>
          </Box>
        </Box>

        {pk.koenOpdelt && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Køn</Typography>
            <Box className="row--label-right-hover__content">
              {/* koenOpdelt forudsætter at køn er sat; ?? '' undgår at vise teksten "undefined" hvis typen er løs. */}
              <Typography className="row--text">{koen ?? ''}</Typography>
            </Box>
          </Box>
        )}

        <Box className="row--label-right-hover">
          <Typography className="row--text">Kapitaliseringsfaktor</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text">{formatFaktor(pk.kapitaliseringsfaktor)}</Typography>
          </Box>
        </Box>
      </>
    )}

    <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitalbeløb</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {`Beregnet proformakapitalisering (${formatKr(toKroner(pk.aarsydelseOre), 2)} x ${formatFaktor(pk.kapitaliseringsfaktor)})`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text text-bold">{formatKr(toKroner(pk.proformaBeloebOre))}</Typography>
      </Box>
    </Box>
  </ContentBox>
);

type MerErstatningBoxProps = Readonly<{
  computation: MerErstatningPensionsalderComputation;
  koen: ErhvervsevnetabValues['koen'];
}>;

const EetMerErstatningEventRows = ({ event, koen }: { event: MerErstatningPensionsalderEvent; koen: ErhvervsevnetabValues['koen'] }) => (
  <>
    <HoverRow underlined
      text={`Forhøjelse pr. ${formatIsoDateLong(event.forhoejelsesdato)} (${event.gammelAlderLabel} → ${event.nyAlderLabel})`}
    />

    <Typography className="row--subheading">Løbende ydelse</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {buildKapitaliseringGrundydelseLabel(formatKapPct(event.kapitaliseringspct), event.amBidragPct)}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">
          {buildKapitaliseringGrundydelseExpression(
            formatKr(toKroner(event.grundloenOre), 0),
            formatKapPct(event.kapitaliseringspct),
            event.erstatningsniveauPct,
            event.amBidragPct,
            formatKr(toKroner(event.grundydelseOre), 2)
          )}
        </Typography>
      </Box>
    </Box>

    {event.grundydelse2024Ore !== null && event.opreguleringTil2024PctRounded4 !== null && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {buildKapitaliseringOpreguleringTil2024Expression(
            formatKr(toKroner(event.grundydelseOre), 2),
            formatAsAmountTrimmed(1 + event.opreguleringTil2024PctRounded4 / 100, 4),
            `${formatAsAmountTrimmed(event.opreguleringTil2024PctRounded4, 4)} %`
          )}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatKr(toKroner(event.grundydelse2024Ore), 2)}</Typography>
        </Box>
      </Box>
    )}

    {event.aarsydelseReguleringsPctRounded4 !== null && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">{`Reguleringsprocent (${event.satsAar})`}</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{`${formatAsAmountTrimmed(event.aarsydelseReguleringsPctRounded4, 4)} %`}</Typography>
        </Box>
      </Box>
    )}

    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {buildKapitaliseringAarsydelseExpression(
          formatKr(toKroner(event.aarsydelseGrundlagOre), 2),
          event.aarsydelseReguleringsPctRounded4 === null
            ? null
            : `${formatAsAmountTrimmed(100 + event.aarsydelseReguleringsPctRounded4, 4)} %`
        )}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(toKroner(event.aarsydelseOre), 2)}</Typography>
      </Box>
    </Box>

    <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitalværdi til hidtidig folkepensionsalder ({event.gammelAlderLabel})</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">{event.gammel.kapitaliseringsbekendtgoerelseLabel}</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatFaktor(event.gammel.kapitaliseringsfaktor)}</Typography>
      </Box>
    </Box>
    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {`Kapitalværdi (${formatKr(toKroner(event.aarsydelseOre), 2)} × ${formatFaktor(event.gammel.kapitaliseringsfaktor)})`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(toKroner(event.gammel.kapitalvaerdiOre), 2)}</Typography>
      </Box>
    </Box>

    <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitalværdi til forhøjet folkepensionsalder ({event.nyAlderLabel})</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">{event.ny.kapitaliseringsbekendtgoerelseLabel}</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatFaktor(event.ny.kapitaliseringsfaktor)}</Typography>
      </Box>
    </Box>
    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {`Kapitalværdi (${formatKr(toKroner(event.aarsydelseOre), 2)} × ${formatFaktor(event.ny.kapitaliseringsfaktor)})`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(toKroner(event.ny.kapitalvaerdiOre), 2)}</Typography>
      </Box>
    </Box>

    {event.koenOpdelt && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">Køn</Typography>
        <Box className="row--label-right-hover__content">
          {/* koenOpdelt forudsætter at køn er sat; ?? '' undgår at vise teksten "undefined" hvis typen er løs. */}
          <Typography className="row--text">{koen ?? ''}</Typography>
        </Box>
      </Box>
    )}

    <Box className="row--label-right-hover" sx={{ mt: 1 }}>
      <Typography className="row--text">
        {`Mer-erstatning (${formatKr(toKroner(event.ny.kapitalvaerdiOre), 2)} − ${formatKr(toKroner(event.gammel.kapitalvaerdiOre), 2)})`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text text-bold">{formatKr(toKroner(event.merErstatningOre))}</Typography>
      </Box>
    </Box>
  </>
);

const EetMerErstatningPensionsalderBox = ({ computation, koen }: MerErstatningBoxProps) => (
  <ContentBox className="content-box">
    <Typography className="section-header">Mer-erstatning ved forhøjet folkepensionsalder</Typography>

    {computation.events.map((event, index) => (
      <Box key={`${event.rowId}-${event.forhoejelsesdato}`} sx={{ mt: index === 0 ? 0 : 2 }}>
        <EetMerErstatningEventRows event={event} koen={koen} />
      </Box>
    ))}

    {computation.events.length > 1 && (
      <Box className="row--label-right-hover" sx={{ mt: 2 }}>
        <Typography className="row--text">Samlet mer-erstatning</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text text-bold">{formatKr(toKroner(computation.samletMerErstatningOre))}</Typography>
        </Box>
      </Box>
    )}
  </ContentBox>
);

const EetDifferencekravTab = ({ values, setValues, forligValues, setForligValues, onGoToEetOplysninger, stamdata, snapshot }: Props) => {
  const { settings } = useAppSettings();
  const { shake: downloadShake, triggerShake: triggerDownloadShake } = useShakeFlag();
  const issues = snapshot.issues;
  const hasBlockingErrors = snapshot.hasBlockingErrors;
  const computation = snapshot.computation;
  const bilagSelection = values.eetDifferencekravBilagSelection;

  const updateBilag = React.useCallback(
    (key: keyof typeof bilagSelection, checked: boolean) => {
      // fieldPath = bilag-nøglen (matcher checkboxens name) → undo/redo lander fokus på den rette checkbox
      // (jf. mineo-field-pattern.md). Samme konvention som visUdvidetSpecifikation...-toggle nedenfor.
      return setValues((prev) => ({
        ...prev,
        eetDifferencekravBilagSelection: {
          ...prev.eetDifferencekravBilagSelection,
          [key]: checked,
        },
      }), { fieldPath: key });
    },
    [setValues]
  );

  const handlePdfDownload = React.useCallback(async () => {
    if (!computation) {
      triggerDownloadShake();
      return;
    }
    await downloadDifferencekravDokument({
      computation,
      koen: values.koen ?? undefined,
      bilagSelection,
      settings,
      persistedStamdata: stamdata,
    });
  }, [bilagSelection, computation, settings, stamdata, triggerDownloadShake, values.koen]);

  const handleExtendedSpecificationCommit = React.useCallback(
    (event: CommitEvent<boolean>) => {
      return setValues((prev) => ({
        ...prev,
        eetDifferencekravBilagSelection: {
          ...prev.eetDifferencekravBilagSelection,
          visUdvidetSpecifikationLoebendeYdelserBilag: event.target.value,
        },
      }), { fieldPath: 'visUdvidetSpecifikationLoebendeYdelserBilag' });
    },
    [setValues]
  );

  const createBilagCommitHandler = React.useCallback(
    (key: keyof typeof bilagSelection) =>
      (event: CommitEvent<boolean>) => {
        return updateBilag(key, event.target.value);
      },
    [updateBilag]
  );

  const handleTilbagevirkendeKraftCommit = React.useCallback(
    (event: CommitEvent<boolean>) => {
      return setValues((prev) => ({
        ...prev,
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: event.target.value,
      }), { fieldPath: 'endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft' });
    },
    [setValues]
  );

  const handleMerErstatningPensionsalderCommit = React.useCallback(
    (event: CommitEvent<boolean>) => {
      return setValues((prev) => ({
        ...prev,
        indregnMerErstatningVedForhoejetPensionsalder: event.target.value,
      }), { fieldPath: 'indregnMerErstatningVedForhoejetPensionsalder' });
    },
    [setValues]
  );

  // ─── Forlig om ansvarsgrad (delt kilde med EO-fanen) ──────────────────────
  // Felterne skriver til erstatningsopgoerelse-sektionen, så ændringer her slår igennem på EO-fanen
  // og omvendt. Fejlrapportering bindes til samme (sektion, felt), så ugyldige rå drafts persisteres
  // i den fælles invalidDrafts-kanal og indgår i Gem-spærringen.
  const reportForligAnsvarsgradProcentInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'forligAnsvarsgradProcent', {
    severity: 'error',
    source: 'input',
  });
  const reportForligAnsvarsgradBroekInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'forligAnsvarsgradBroek', {
    severity: 'error',
    source: 'input',
  });

  const handleForligProcentCommit = React.useCallback(
    (event: CommitEvent<number | undefined>) => {
      return setForligValues((prev) => ({ ...prev, forligAnsvarsgradProcent: event.target.value }), {
        fieldPath: 'forligAnsvarsgradProcent',
      });
    },
    [setForligValues]
  );

  const handleForligBroekCommit = React.useCallback(
    (event: CommitEvent<string | undefined>) => {
      // StyledFractionField trimmer allerede draft ved commit (normalizeDraftOnCommit) og mapper tom streng
      // til undefined i parseren, så committed-værdien er kanonisk. Ingen ekstra trim nødvendig (jf. EO-fanen,
      // der committer den rå commit-værdi direkte).
      return setForligValues((prev) => ({ ...prev, forligAnsvarsgradBroek: event.target.value }), {
        fieldPath: 'forligAnsvarsgradBroek',
      });
    },
    [setForligValues]
  );

  // Forligs-validering via den fælles hook (samme enhed som EOOplysningerTab, jf. domain-boundary-contract.md §10).
  // Den rapporterer de to blokerende regler (begge udfyldt / dato uden ansvarsgrad) til den centrale
  // fejl-model under pageKey `erstatningsopgoerelse`, så Gem nu også blokeres fra denne fane, og returnerer
  // den visuelle "begge udfyldt"-fejl (rød ring + tooltip på procent/brøk-felterne).
  const forligFejl = useForligAnsvarsgradValidation({
    forligAnsvarsgradProcent: forligValues.forligAnsvarsgradProcent,
    forligAnsvarsgradBroek: forligValues.forligAnsvarsgradBroek,
    forligDato: forligValues.forligDato,
  });

  // Forligsdato (delt kilde med EO). Samme dato-grænser som EOOplysningerTab, så rød ring/tooltip
  // for ugyldige datoer er identisk på tværs af fanerne.
  const skadedatoISO = stamdata?.skadedato;
  const erErhvervssygdom = (stamdata?.skadestype ?? '') === 'Erhvervssygdom';
  const forligDatoMinRule = React.useMemo(
    () =>
      computeSkadedatoMinRule({
        skadedatoISO,
        erErhvervssygdom,
        fallbackMin: dateRanges_erstatningsopgoerelse.forligDato.fallbackMin,
      }),
    [erErhvervssygdom, skadedatoISO]
  );
  const reportForligDatoInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'forligDato', {
    severity: 'error',
    source: 'input',
  });
  const reportForligDatoInputErrorSafe = React.useCallback(
    (errorMsg: ReportableFieldError | undefined) => {
      const hasValue = typeof forligValues.forligDato === 'string' && forligValues.forligDato.trim() !== '';
      reportForligDatoInputError(hasValue ? errorMsg : undefined);
    },
    [forligValues.forligDato, reportForligDatoInputError]
  );
  const handleForligDatoCommit = React.useCallback(
    (event: CommitEvent<ISODateString | undefined>) => {
      const nextValue = coerceToISODateString(event.target.value ?? undefined);
      return setForligValues((prev) => ({ ...prev, forligDato: nextValue }), { fieldPath: 'forligDato' });
    },
    [setForligValues]
  );

  return (
    <Box>
      <EetIssuesBox
        issues={issues}
        onGoToEetOplysninger={onGoToEetOplysninger}
      />

      {/* Beregning */}
      {!hasBlockingErrors && computation && (
        <ContentBox className="content-box">
          <Typography className="section-header">Beregning</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Beregningsdato</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatIsoDateLong(computation.beregningsdato)}</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Download specifikation</Typography>
            <Box className="row--label-right-hover__content">
              <DocumentDownloadButton onClick={handlePdfDownload} shake={downloadShake} />
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Bilag, der indsættes</Typography>
            <Box className="row--label-right-hover__content">
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <StyledCheckbox
                  name="loebendeYdelser"
                  checked={bilagSelection.loebendeYdelser}
                  onCommit={createBilagCommitHandler('loebendeYdelser')}
                  label="Løbende ydelser"
                />
                <StyledCheckbox
                  name="kapitalisering"
                  checked={bilagSelection.kapitalisering}
                  onCommit={createBilagCommitHandler('kapitalisering')}
                  label="Kapitalisering"
                />
                <StyledCheckbox
                  name="eetEfterEal"
                  checked={bilagSelection.eetEfterEal}
                  onCommit={createBilagCommitHandler('eetEfterEal')}
                  label="EET efter EAL"
                />
                {computation.proformaKapitalisering && (
                  <StyledCheckbox
                    name="proformaKapitalisering"
                    checked={bilagSelection.proformaKapitalisering}
                    onCommit={createBilagCommitHandler('proformaKapitalisering')}
                    label="Proformakap. af rest-EET"
                  />
                )}
                {computation.merErstatningPensionsalder && (
                  <StyledCheckbox
                    name="merErstatningPensionsalder"
                    checked={bilagSelection.merErstatningPensionsalder}
                    onCommit={createBilagCommitHandler('merErstatningPensionsalder')}
                    label="Mer-erstatning forhøjet folkepension"
                  />
                )}
              </Box>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Medtag udvidet specifikation på løbende ydelser</Typography>
            <Box className="row--label-right-hover__content">
              <StyledToggleSwitch
                name="visUdvidetSpecifikationLoebendeYdelserBilag"
                checked={bilagSelection.visUdvidetSpecifikationLoebendeYdelserBilag}
                onCommit={handleExtendedSpecificationCommit}
              />
            </Box>
          </Box>
        </ContentBox>
      )}

      {/* Valgmuligheder */}
      <ContentBox className="content-box">
        <Typography className="section-header">Valgmuligheder</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            Endelig EET-afgørelse kan gøre tidligere udbetalt midl. EET til endeligt med tilbagevirkende kraft
            <InfoTooltipIcon title="Opstår ved endelig afgørelse, der får virkning for en periode, der tidligere er udbetalt midlertidig EET for" />
          </Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft"
              checked={values.endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft}
              onCommit={handleTilbagevirkendeKraftCommit}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            Indregn mer-erstatning ved forhøjet pensionsalder
          </Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="indregnMerErstatningVedForhoejetPensionsalder"
              checked={values.indregnMerErstatningVedForhoejetPensionsalder}
              onCommit={handleMerErstatningPensionsalderCommit}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Forlig om ansvarsgrad</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">Procent</Typography>
              <StyledPercentField
                name="forligAnsvarsgradProcent"
                width={100}
                value={forligValues.forligAnsvarsgradProcent}
                onCommit={handleForligProcentCommit}
                onFieldError={reportForligAnsvarsgradProcentInputError}
                useDefaultPercentRange
                // En ansvarsgrad på 0 % er ikke gyldig: 0 afvises straks i feltet med rød ring
                // + tooltip via enforceRange — samme kanoniske vej som en værdi over 100 %.
                minValue={1}
                error={forligFejl.harFejl}
                helperText={forligFejl.fejlbesked}
              />
              <Typography className="row--text">eller brøk</Typography>
              <StyledFractionField
                name="forligAnsvarsgradBroek"
                width={120}
                value={forligValues.forligAnsvarsgradBroek}
                onCommit={handleForligBroekCommit}
                onFieldError={reportForligAnsvarsgradBroekInputError}
                error={forligFejl.harFejl}
                helperText={forligFejl.fejlbesked}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. dato for forlig</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDateField
              name="forligDato"
              value={forligValues.forligDato}
              onCommit={handleForligDatoCommit}
              onFieldError={reportForligDatoInputErrorSafe}
              minDate={forligDatoMinRule.minDate}
              maxDate={dateRanges_erstatningsopgoerelse.forligDato.max}
              specialRangeErrors={{
                minBoundKind: forligDatoMinRule.minBoundKind,
                minBoundReferenceISO: forligDatoMinRule.minBoundReferenceISO,
              }}
            />
          </Box>
        </Box>
      </ContentBox>

      {/* Specifikation */}
      {!hasBlockingErrors && computation && (
        <ContentBox className="content-box">
          <Typography className="section-header">Specifikation</Typography>

          {/* EAL-krav */}
          <Typography className="row--subheading">EAL-krav</Typography>
          <HoverRow text={`Erhvervsevnetabet udgør ${formatKapPct(computation.ealEetPct)}.`} />
          <Box className="row--label-right-hover">
            <Typography className="row--text">Det svarer til et beregnet erhvervsevnetab på:</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatKr(toKroner(computation.ealKravOre))}</Typography>
            </Box>
          </Box>

          {/* Løbende ASL-ydelser */}
          <Typography className="row--subheading" sx={{ mt: 2 }}>Løbende ASL-ydelser</Typography>

          {computation.fradragGaelderForFoer2011 ? (
            <>
              <HoverRow text="Skaden er indtrådt før 16. juni 2011." />
              <HoverRow text="Der foretages derfor fradrag i differencekravet med midlertidige EET-ydelser." />
            </>
          ) : (
            <>
              <HoverRow text="Skaden er indtrådt den 16. juni 2011 eller senere." />
              <HoverRow text="Der foretages derfor ikke fradrag i differencekravet med midlertidige EET-ydelser." />
            </>
          )}

          {computation.afgoerelser.map((afgoerelse) => {
            const foretages = afgoerelse.fradragForetages;
            const pctLabel = foretages ? ` (${formatKapPct(afgoerelse.eetPct)})` : '';
            const tvk = afgoerelse.tilbagevirkendeKraftFradrag;
            const typeLabel = (() => {
              if (afgoerelse.afgoerelseType === 'Midlertidig') {
                if (foretages) return `Midlertidig afgørelse${pctLabel}`;
                if (tvk) return `Midlertidig afgørelse (gjort endelig fra ${formatISOToDanish(tvk.endeligVirkningsdato)})`;
                return 'Midlertidig afgørelse';
              }
              if (afgoerelse.afgoerelseType === 'Delvist endelig') return `Delvist endelig afgørelse${foretages ? pctLabel : ''}`;
              return `Endelig afgørelse (${formatKapPct(afgoerelse.eetPct)})`;
            })();

            return (
              <Box key={afgoerelse.rowId} sx={{ mt: 1 }}>
                <HoverRow underlined text={`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`} />
                <HoverRow text={typeLabel} />

                {foretages && afgoerelse.beloebOre > 0 && (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {`Løbende ydelser (${formatISOToDanish(afgoerelse.virkningsdato)} - ${formatISOToDanish(afgoerelse.fradragesTil)}):`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{`- ${formatKr(toKroner(afgoerelse.beloebOre))}`}</Typography>
                    </Box>
                  </Box>
                )}

                {!foretages && tvk && (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {`Løbende ydelser (${formatISOToDanish(tvk.fra)} - ${formatISOToDanish(tvk.til)}):`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{`- ${formatKr(toKroner(tvk.beloebOre))}`}</Typography>
                    </Box>
                  </Box>
                )}

                {!foretages && !tvk && afgoerelse.afgoerelseType !== 'Midlertidig' && (
                  <HoverRow text="Løbende ydelser derfor ikke relevante." />
                )}

                {foretages && afgoerelse.beloebOre === 0 && (
                  <HoverRow text="Ingen løbende ydelser." />
                )}
              </Box>
            );
          })}

          {computation.afgoerelser.length === 0 && (
            <HoverRow text="Ingen afgørelser." />
          )}

          {/* Kapitaliserede ASL-beløb */}
          <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitaliserede ASL-beløb</Typography>
          <HoverRow text="Værdien af modtagne kapitalbeløb fratrækkes." />

          {computation.kapitaliseringerAfgoerelser.map((afgoerelse) => (
            <Box key={afgoerelse.rowId} sx={{ mt: 1 }}>
              <HoverRow underlined text={`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`} />
              {afgoerelse.kapitalbelobOre !== null && afgoerelse.kapitaliseringsdato !== null && afgoerelse.kapitaliseringspct !== null ? (
                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    {`Kapitaliseret (${formatKapPct(afgoerelse.kapitaliseringspct)}) den ${formatISOToDanish(afgoerelse.kapitaliseringsdato)}:`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{`- ${formatKr(toKroner(afgoerelse.kapitalbelobOre))}`}</Typography>
                  </Box>
                </Box>
              ) : afgoerelse.kapitaliseringEfterBeregningsdato ? (
                <HoverRow text="Ikke kapitaliseret på beregningsdatoen." />
              ) : (
                <HoverRow text="Ikke kapitaliseret." />
              )}
            </Box>
          ))}

          {computation.kapitaliseringerAfgoerelser.length === 0 && (
            <HoverRow text="Ingen afgørelser." />
          )}

          {/* Resterende erhvervsevnetab */}
          {(computation.proformaKapitalisering || computation.resterendeLoebendeYdelser) && (
            <>
              <Typography className="row--subheading" sx={{ mt: 2 }}>Resterende erhvervsevnetab</Typography>
              {computation.resterendeLoebendeYdelser ? (
                <>
                  <HoverRow text="De tilbageværende løbende ydelser frem til folkepensionsalderen fratrækkes." />
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {`${formatMaaneder(computation.resterendeLoebendeYdelser.tilbageraevendeMaaneder)} mdr. × ${formatKr(toKroner(computation.resterendeLoebendeYdelser.maanedligYdelseOre))}/md.`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{`- ${formatKr(toKroner(computation.resterendeLoebendeYdelser.fradragBeloebOre))}`}</Typography>
                    </Box>
                  </Box>
                </>
              ) : computation.proformaKapitalisering ? (
                <>
                  <HoverRow text="Der foretages fradrag med kapitaliseringsværdien af resterende EET." />
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {`Proformakapitalisering (${formatKapPct(computation.proformaKapitalisering.loebendeEetPct)}) den ${formatISOToDanish(computation.proformaKapitalisering.kapitaliseringsdato)}:`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{`- ${formatKr(toKroner(computation.proformaKapitalisering.proformaBeloebOre))}`}</Typography>
                    </Box>
                  </Box>
                </>
              ) : null}
            </>
          )}

          {/* Mer-erstatning ved forhøjet folkepensionsalder */}
          {computation.merErstatningPensionsalder && (
            <>
              <Typography className="row--subheading" sx={{ mt: 2 }}>Mer-erstatning ved forhøjet folkepensionsalder</Typography>
              {computation.merErstatningPensionsalder.events.map((event) => (
                <Box key={`${event.rowId}-${event.forhoejelsesdato}`} className="row--label-right-hover">
                  <Typography className="row--text">
                    {`Forhøjelse pr. ${formatISOToDanish(event.forhoejelsesdato)} (${event.gammelAlderLabel} → ${event.nyAlderLabel}):`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{`- ${formatKr(toKroner(event.merErstatningOre))}`}</Typography>
                  </Box>
                </Box>
              ))}
            </>
          )}

          {/* Differencekrav */}
          <Typography className="row--subheading" sx={{ mt: 2 }}>Differencekrav</Typography>
          {computation.forligLabel !== null && (
            <HoverRow
              text={buildForligIndgaaetSaetning(
                computation.forligLabel,
                computation.forligDato ? formatIsoDateLong(computation.forligDato) : null
              )}
            />
          )}
          <Box className="row--label-right-hover">
            <Typography className="row--text">
              {buildBeregnetDifferencekravLabel(computation.forligLabel, formatKr(toKroner(computation.differencekravFoerForligOre)))}
            </Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text text-bold">{formatKr(toKroner(computation.differencekravOre))}</Typography>
            </Box>
          </Box>
        </ContentBox>
      )}

      {/* Proformakapitalisering af rest-EET */}
      {!hasBlockingErrors && computation?.proformaKapitalisering && (
        <EetProformaKapitaliseringBox
          pk={computation.proformaKapitalisering}
          koen={values.koen}
        />
      )}

      {/* Mer-erstatning ved forhøjet folkepensionsalder */}
      {!hasBlockingErrors && computation?.merErstatningPensionsalder && (
        <EetMerErstatningPensionsalderBox
          computation={computation.merErstatningPensionsalder}
          koen={values.koen}
        />
      )}
    </Box>
  );
};

EetDifferencekravTab.displayName = 'EetDifferencekravTab';

export default EetDifferencekravTab;
