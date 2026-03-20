import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import StyledCheckbox from '../../inputs/StyledCheckbox';
import StyledToggleSwitch from '../../inputs/StyledToggleSwitch';
import type { CommitEvent } from '../../../types/fieldEvents';
import type { ErhvervsevnetabComposedValues, ErhvervsevnetabValues } from '../../../schemas/formSchemas';
import { usePersistedSection } from '../../../hooks/usePersistedSection';
import { useFormFieldErrors } from '../../../hooks/useFormFieldErrors';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { formatIsoDateLong, formatIsoDateShort } from '../../../utils/dateFormatting';
import { formatAsAmountTrimmed } from '../../../utils/formatUtils';
import { dedupeIssuesBySeverityAndMessage } from '../../../utils/issueUtils';
import {
  computeEetDifferencekravCalculation,
  type EetDifferencekravProformaKapitalisering,
} from '../../../domain/erhvervsevnetab/eetDifferencekravCalculation';
import { formatPct as formatKapPct } from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import {
  buildKapitaliseringGrundydelseExpression,
  buildKapitaliseringGrundydelseLabel,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringPresentation';
import { downloadDifferencekravPdf } from '../../../utils/pdf/pdfService';
import EetIssuesBox from './EetIssuesBox';
import TextHoverRow from './TextHoverRow';
import UnderlinedHoverRow from './UnderlinedHoverRow';
import PdfDownloadButton from '../../inputs/PdfDownloadButton';
import { useEetShakeFlag } from '../../../hooks/useShakeFlag';
import { formatFaktor, formatJaNej, formatKr, navigationSortKey, toFieldIssue } from './eetFormatUtils';

type Props = Readonly<{
  values: ErhvervsevnetabComposedValues;
  setValues: React.Dispatch<React.SetStateAction<ErhvervsevnetabValues>>;
  onGoToEetOplysninger: () => void;
}>;

type ProformaBoxProps = Readonly<{
  pk: EetDifferencekravProformaKapitalisering;
  koen: ErhvervsevnetabValues['koen'];
}>;

const EetProformaKapitaliseringBox = ({ pk, koen }: ProformaBoxProps) => (
  <ContentBox className="content-box">
    <Typography className="section-header">Proformakapitalisering af rest-EET</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Kapitaliseringsdato</Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{formatIsoDateShort(pk.kapitaliseringsdato)}</Typography>
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

    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {`Reguleringsprocent (${formatIsoDateLong(pk.kapitaliseringsdato)})`}
      </Typography>
      <Box className="row--label-right-hover__content">
        <Typography className="row--text">{`${formatAsAmountTrimmed(pk.reguleringsPctRounded4, 4)} %`}</Typography>
      </Box>
    </Box>

    <Box className="row--label-right-hover">
      <Typography className="row--text">
        {`Årlig ydelse (${formatKr(pk.grundydelse, 2)} x ${formatAsAmountTrimmed(100 + pk.reguleringsPctRounded4, 4)} %)`}
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


const EetDifferencekravTab = ({ values, setValues, onGoToEetOplysninger }: Props) => {
  const stamdata = usePersistedSection('stamdata');
  const stamdataFieldErrors = useFormFieldErrors('stamdata');
  const eetFieldErrors = useFormFieldErrors('erhvervsevnetab');
  const faellesAarsloenFieldErrors = useFormFieldErrors('faellesAarsloen');
  const faellesPersondataFieldErrors = useFormFieldErrors('faellesPersondata');
  const { settings } = useAppSettings();
  const { shake: downloadShake, triggerShake: triggerDownloadShake } = useEetShakeFlag();

  const calculationResult = React.useMemo(
    () =>
      computeEetDifferencekravCalculation({
        erhvervsevnetab: values,
        skadesdato: stamdata?.skadesdato,
        skadelidteFodselsdato: values.skadelidteFodselsdato,
      }),
    [stamdata?.skadesdato, values]
  );

  const fieldIssues = React.useMemo(() => {
    return [
      toFieldIssue('field-beregningsdato', eetFieldErrors.beregningsdato?.message),
      toFieldIssue('field-aarsloen-asl', faellesAarsloenFieldErrors.aslAarsloen?.message),
      toFieldIssue('field-asl-afgoerelser', eetFieldErrors.aslAfgoerelser?.message),
      toFieldIssue('field-skadelidte-fodselsdato', faellesPersondataFieldErrors.skadelidteFodselsdato?.message),
      toFieldIssue('field-skadesdato', stamdataFieldErrors.skadesdato?.message),
    ].filter((issue): issue is NonNullable<typeof issue> => issue !== null);
  }, [
    eetFieldErrors.aslAfgoerelser?.message,
    eetFieldErrors.beregningsdato?.message,
    faellesPersondataFieldErrors.skadelidteFodselsdato?.message,
    faellesAarsloenFieldErrors.aslAarsloen?.message,
    stamdataFieldErrors.skadesdato?.message,
  ]);

  const issues = React.useMemo(
    () =>
      dedupeIssuesBySeverityAndMessage([...calculationResult.issues, ...fieldIssues])
        .sort((a, b) => navigationSortKey(a.id) - navigationSortKey(b.id)),
    [calculationResult.issues, fieldIssues]
  );

  const hasBlockingErrors = issues.some((issue) => issue.severity === 'error');

  const computation = calculationResult.computation;
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
      }));
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
                  <StyledCheckbox
                    checked={bilagSelection.proformaKapitalisering}
                    onCommit={createBilagCommitHandler('proformaKapitalisering')}
                    label="Proformakap. af rest-EET"
                  />
                </Box>
              </Box>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Medtag udvidet specifikation på løbende ydelser</Typography>
            <Box className="row--label-right-hover__content">
              <StyledToggleSwitch
                checked={bilagSelection.visUdvidetSpecifikationLoebendeYdelserBilag}
                onCommit={handleExtendedSpecificationCommit}
              />
            </Box>
          </Box>
        </ContentBox>
      )}

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
            const typeLabel = (() => {
              if (afgoerelse.afgoerelseType === 'Midlertidig') return `Midlertidig afgørelse${foretages ? pctLabel : ''}`;
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
                      {`Løbende ydelser (${formatIsoDateShort(afgoerelse.virkningsdato)} - ${formatIsoDateShort(afgoerelse.fradragesTil)}):`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{`- ${formatKr(afgoerelse.beloeb)}`}</Typography>
                    </Box>
                  </Box>
                )}

                {!foretages && (
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
                    {`Kapitaliseret (${formatKapPct(afgoerelse.kapitaliseringspct)}) den ${formatIsoDateShort(afgoerelse.kapitaliseringsdato)}:`}
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
          {computation.proformaKapitalisering && (
            <>
              <Typography className="row--subheading" sx={{ mt: 2 }}>Resterende erhvervsevnetab</Typography>
              <TextHoverRow text="Der foretages fradrag med kapitaliseringsværdien af resterende EET." />
              <Box className="row--label-right-hover">
                <Typography className="row--text">
                  {`Proformakapitalisering (${formatKapPct(computation.proformaKapitalisering.loebendeEetPct)}) den ${formatIsoDateShort(computation.proformaKapitalisering.kapitaliseringsdato)}:`}
                </Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{`- ${formatKr(computation.proformaKapitalisering.proformaBeloeb)}`}</Typography>
                </Box>
              </Box>
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
    </Box>
  );
};

EetDifferencekravTab.displayName = 'EetDifferencekravTab';

export default EetDifferencekravTab;
