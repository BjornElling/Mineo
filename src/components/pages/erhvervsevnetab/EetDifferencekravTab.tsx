import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import StyledCheckbox from '../../inputs/StyledCheckbox';
import StyledToggleSwitch from '../../inputs/StyledToggleSwitch';
import type { CommitEvent } from '../../../types/fieldEvents';
import type { ErhvervsevnetabComposedValues, ErhvervsevnetabValues, StamdataValues } from '../../../schemas/formSchemas';
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
import { downloadDifferencekravPdf } from '../../../pdf/infrastructure/pdfService';
import EetIssuesBox from './EetIssuesBox';
import TextHoverRow from './TextHoverRow';
import UnderlinedHoverRow from './UnderlinedHoverRow';
import PdfDownloadButton from '../../inputs/PdfDownloadButton';
import InfoTooltipIcon from '../../common/InfoTooltipIcon';
import { useEetShakeFlag } from '../../../hooks/useShakeFlag';
import { formatFaktor, formatJaNej } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { type SetValuesUpdater } from '../../../hooks/usePersistedForm';
import type { EetSnapshot } from '../../../domain/erhvervsevnetab/eetSnapshot';
import { formatKr } from '../../../utils/formatUtils';

type Props = Readonly<{
  values: ErhvervsevnetabComposedValues;
  setValues: SetValuesUpdater<ErhvervsevnetabValues>;
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
            formatKr(pk.grundloen, 0),
            formatKapPct(pk.loebendeEetPct),
            pk.erstatningsniveauPct,
            pk.amBidragPct,
            formatKr(pk.grundydelse, 2)
          )}
        </Typography>
      </Box>
    </Box>

    {pk.grundydelse2024 !== null && pk.opreguleringTil2024PctRounded4 !== null && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {buildKapitaliseringOpreguleringTil2024Expression(
            formatKr(pk.grundydelse, 2),
            formatAsAmountTrimmed(1 + pk.opreguleringTil2024PctRounded4 / 100, 4),
            `${formatAsAmountTrimmed(pk.opreguleringTil2024PctRounded4, 4)} %`
          )}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatKr(pk.grundydelse2024, 2)}</Typography>
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
          formatKr(pk.aarsydelseGrundlag, 2),
          pk.aarsydelseReguleringsPctRounded4 === null
            ? null
            : `${formatAsAmountTrimmed(100 + pk.aarsydelseReguleringsPctRounded4, 4)} %`
        )}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(pk.aarsydelse, 2)}</Typography>
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
              <Typography className="row--text">{koen}</Typography>
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
        {`Beregnet proformakapitalisering (${formatKr(pk.aarsydelse, 2)} x ${formatFaktor(pk.kapitaliseringsfaktor)})`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text text-bold">{formatKr(pk.proformaBeloeb)}</Typography>
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
    <UnderlinedHoverRow
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
            formatKr(event.grundloen, 0),
            formatKapPct(event.kapitaliseringspct),
            event.erstatningsniveauPct,
            event.amBidragPct,
            formatKr(event.grundydelse, 2)
          )}
        </Typography>
      </Box>
    </Box>

    {event.grundydelse2024 !== null && event.opreguleringTil2024PctRounded4 !== null && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {buildKapitaliseringOpreguleringTil2024Expression(
            formatKr(event.grundydelse, 2),
            formatAsAmountTrimmed(1 + event.opreguleringTil2024PctRounded4 / 100, 4),
            `${formatAsAmountTrimmed(event.opreguleringTil2024PctRounded4, 4)} %`
          )}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatKr(event.grundydelse2024, 2)}</Typography>
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
          formatKr(event.aarsydelseGrundlag, 2),
          event.aarsydelseReguleringsPctRounded4 === null
            ? null
            : `${formatAsAmountTrimmed(100 + event.aarsydelseReguleringsPctRounded4, 4)} %`
        )}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(event.aarsydelse, 2)}</Typography>
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
        {`Kapitalværdi (${formatKr(event.aarsydelse, 2)} × ${formatFaktor(event.gammel.kapitaliseringsfaktor)})`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(event.gammel.kapitalvaerdi, 2)}</Typography>
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
        {`Kapitalværdi (${formatKr(event.aarsydelse, 2)} × ${formatFaktor(event.ny.kapitaliseringsfaktor)})`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatKr(event.ny.kapitalvaerdi, 2)}</Typography>
      </Box>
    </Box>

    {event.koenOpdelt && (
      <Box className="row--label-right-hover">
        <Typography className="row--text">Køn</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{koen}</Typography>
        </Box>
      </Box>
    )}

    <Box className="row--label-right-hover" sx={{ mt: 1 }}>
      <Typography className="row--text">
        {`Mer-erstatning (${formatKr(event.ny.kapitalvaerdi, 2)} − ${formatKr(event.gammel.kapitalvaerdi, 2)})`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text text-bold">{formatKr(event.merErstatning)}</Typography>
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
          <Typography className="row--text text-bold">{formatKr(computation.samletMerErstatning)}</Typography>
        </Box>
      </Box>
    )}
  </ContentBox>
);

const EetDifferencekravTab = ({ values, setValues, onGoToEetOplysninger, stamdata, snapshot }: Props) => {
  const { settings } = useAppSettings();
  const { shake: downloadShake, triggerShake: triggerDownloadShake } = useEetShakeFlag();
  const issues = snapshot.issues;
  const hasBlockingErrors = snapshot.hasBlockingErrors;
  const computation = snapshot.computation;
  const bilagSelection = values.eetDifferencekravBilagSelection;

  const updateBilag = React.useCallback(
    (key: keyof typeof bilagSelection, checked: boolean) => {
      setValues((prev) => ({
        ...prev,
        eetDifferencekravBilagSelection: {
          ...prev.eetDifferencekravBilagSelection,
          [key]: checked,
        },
      }));
    },
    [setValues]
  );

  const handlePdfDownload = React.useCallback(async () => {
    if (!computation) {
      triggerDownloadShake();
      return;
    }
    await downloadDifferencekravPdf({
      computation,
      koen: values.koen ?? undefined,
      bilagSelection,
      settings,
      persistedStamdata: stamdata,
    });
  }, [bilagSelection, computation, settings, stamdata, triggerDownloadShake, values.koen]);

  const handleExtendedSpecificationCommit = React.useCallback(
    (event: CommitEvent<boolean>) => {
      setValues((prev) => ({
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
        updateBilag(key, event.target.value);
      },
    [updateBilag]
  );

  const handleTilbagevirkendeKraftCommit = React.useCallback(
    (event: CommitEvent<boolean>) => {
      setValues((prev) => ({
        ...prev,
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: event.target.value,
      }), { fieldPath: 'endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft' });
    },
    [setValues]
  );

  const handleMerErstatningPensionsalderCommit = React.useCallback(
    (event: CommitEvent<boolean>) => {
      setValues((prev) => ({
        ...prev,
        indregnMerErstatningVedForhoejetPensionsalder: event.target.value,
      }), { fieldPath: 'indregnMerErstatningVedForhoejetPensionsalder' });
    },
    [setValues]
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
              <PdfDownloadButton onClick={handlePdfDownload} shake={downloadShake} />
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Bilag, der indsættes</Typography>
            <Box className="row--label-right-hover__content">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <StyledCheckbox
                    checked={bilagSelection.loebendeYdelser}
                    onCommit={createBilagCommitHandler('loebendeYdelser')}
                    label="Løbende ydelser"
                  />
                  <StyledCheckbox
                    checked={bilagSelection.kapitalisering}
                    onCommit={createBilagCommitHandler('kapitalisering')}
                    label="Kapitalisering"
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <StyledCheckbox
                    checked={bilagSelection.eetEfterEal}
                    onCommit={createBilagCommitHandler('eetEfterEal')}
                    label="EET efter EAL"
                  />
                  {computation.proformaKapitalisering && (
                    <StyledCheckbox
                      checked={bilagSelection.proformaKapitalisering}
                      onCommit={createBilagCommitHandler('proformaKapitalisering')}
                      label="Proformakap. af rest-EET"
                    />
                  )}
                  {computation.merErstatningPensionsalder && (
                    <StyledCheckbox
                      checked={bilagSelection.merErstatningPensionsalder}
                      onCommit={createBilagCommitHandler('merErstatningPensionsalder')}
                      label="Mer-erstatning forhøjet folkepension"
                    />
                  )}
                </Box>
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
      </ContentBox>

      {/* Specifikation */}
      {!hasBlockingErrors && computation && (
        <ContentBox className="content-box">
          <Typography className="section-header">Specifikation</Typography>

          {/* EAL-krav */}
          <Typography className="row--subheading">EAL-krav</Typography>
          <TextHoverRow text={`Erhvervsevnetabet udgør ${formatKapPct(computation.ealEetPct)}.`} />
          <Box className="row--label-right-hover">
            <Typography className="row--text">Det svarer til et beregnet erhvervsevnetab på:</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatKr(computation.ealKrav)}</Typography>
            </Box>
          </Box>

          {/* Løbende ASL-ydelser */}
          <Typography className="row--subheading" sx={{ mt: 2 }}>Løbende ASL-ydelser</Typography>

          {computation.fradragGaelderForFoer2011 ? (
            <>
              <TextHoverRow text="Skaden er indtrådt før 16. juni 2011." />
              <TextHoverRow text="Der foretages derfor fradrag i differencekravet med midlertidige EET-ydelser." />
            </>
          ) : (
            <>
              <TextHoverRow text="Skaden er indtrådt den 16. juni 2011 eller senere." />
              <TextHoverRow text="Der foretages derfor ikke fradrag i differencekravet med midlertidige EET-ydelser." />
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
                <UnderlinedHoverRow text={`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`} />
                <TextHoverRow text={typeLabel} />

                {foretages && afgoerelse.beloeb > 0 && (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {`Løbende ydelser (${formatISOToDanish(afgoerelse.virkningsdato)} - ${formatISOToDanish(afgoerelse.fradragesTil)}):`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{`- ${formatKr(afgoerelse.beloeb)}`}</Typography>
                    </Box>
                  </Box>
                )}

                {!foretages && tvk && (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {`Løbende ydelser (${formatISOToDanish(tvk.fra)} - ${formatISOToDanish(tvk.til)}):`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{`- ${formatKr(tvk.beloeb)}`}</Typography>
                    </Box>
                  </Box>
                )}

                {!foretages && !tvk && afgoerelse.afgoerelseType !== 'Midlertidig' && (
                  <TextHoverRow text="Løbende ydelser derfor ikke relevante." />
                )}

                {foretages && afgoerelse.beloeb === 0 && (
                  <TextHoverRow text="Ingen løbende ydelser." />
                )}
              </Box>
            );
          })}

          {computation.afgoerelser.length === 0 && (
            <TextHoverRow text="Ingen afgørelser." />
          )}

          {/* Kapitaliserede ASL-beløb */}
          <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitaliserede ASL-beløb</Typography>
          <TextHoverRow text="Værdien af modtagne kapitalbeløb fratrækkes." />

          {computation.kapitaliseringerAfgoerelser.map((afgoerelse) => (
            <Box key={afgoerelse.rowId} sx={{ mt: 1 }}>
              <UnderlinedHoverRow text={`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`} />
              {afgoerelse.kapitalbelob !== null && afgoerelse.kapitaliseringsdato !== null && afgoerelse.kapitaliseringspct !== null ? (
                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    {`Kapitaliseret (${formatKapPct(afgoerelse.kapitaliseringspct)}) den ${formatISOToDanish(afgoerelse.kapitaliseringsdato)}:`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{`- ${formatKr(afgoerelse.kapitalbelob)}`}</Typography>
                  </Box>
                </Box>
              ) : afgoerelse.kapitaliseringEfterBeregningsdato ? (
                <TextHoverRow text="Ikke kapitaliseret på beregningsdatoen." />
              ) : (
                <TextHoverRow text="Ikke kapitaliseret." />
              )}
            </Box>
          ))}

          {computation.kapitaliseringerAfgoerelser.length === 0 && (
            <TextHoverRow text="Ingen afgørelser." />
          )}

          {/* Resterende erhvervsevnetab */}
          {(computation.proformaKapitalisering || computation.resterendeLoebendeYdelser) && (
            <>
              <Typography className="row--subheading" sx={{ mt: 2 }}>Resterende erhvervsevnetab</Typography>
              {computation.resterendeLoebendeYdelser ? (
                <>
                  <TextHoverRow text="De tilbageværende løbende ydelser frem til folkepensionsalderen fratrækkes." />
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {`${formatMaaneder(computation.resterendeLoebendeYdelser.tilbageraevendeMaaneder)} mdr. × ${formatKr(computation.resterendeLoebendeYdelser.maanedligYdelse)}/md.`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{`- ${formatKr(computation.resterendeLoebendeYdelser.fradragBeloeb)}`}</Typography>
                    </Box>
                  </Box>
                </>
              ) : computation.proformaKapitalisering ? (
                <>
                  <TextHoverRow text="Der foretages fradrag med kapitaliseringsværdien af resterende EET." />
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {`Proformakapitalisering (${formatKapPct(computation.proformaKapitalisering.loebendeEetPct)}) den ${formatISOToDanish(computation.proformaKapitalisering.kapitaliseringsdato)}:`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{`- ${formatKr(computation.proformaKapitalisering.proformaBeloeb)}`}</Typography>
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
                    <Typography className="row--text">{`- ${formatKr(event.merErstatning)}`}</Typography>
                  </Box>
                </Box>
              ))}
            </>
          )}

          {/* Differencekrav */}
          <Typography className="row--subheading" sx={{ mt: 2 }}>Differencekrav</Typography>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Beregnet differencekrav</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text text-bold">{formatKr(computation.differencekrav)}</Typography>
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
