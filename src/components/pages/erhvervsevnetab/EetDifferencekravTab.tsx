import React from 'react';
import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import ContentBox from '../../layout/ContentBox';
import StyledToggleSwitch from '../../inputs/StyledToggleSwitch';
import type { CommitEvent } from '../../inputs/fieldEvents';
import type { ErhvervsevnetabValues } from '../../../schemas/formSchemas';
import { usePersistedSection } from '../../../hooks/usePersistedSection';
import { useFormFieldErrors } from '../../../hooks/useFormFieldErrors';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { formatIsoDateLong, formatIsoDateShort } from '../../../utils/dateFormatting';
import { formatAsAmount, formatAsAmountTrimmed } from '../../../utils/formatUtils';
import { dedupeIssuesBySeverityAndMessage } from '../../../utils/issueUtils';
import {
  computeEetDifferencekravCalculation,
  formatKapPct,
} from '../../../domain/erhvervsevnetab/eetDifferencekravCalculation';
import { downloadDifferencekravPdf } from '../../../utils/pdf/pdfService';
import EetIssuesBox from './EetIssuesBox';
import TextHoverRow from './TextHoverRow';
import UnderlinedHoverRow from './UnderlinedHoverRow';
import { formatKr, navigationSortKey, toFieldIssue } from './eetTabSharedUtils';

type Props = Readonly<{
  values: ErhvervsevnetabValues;
  setValues: (values: ErhvervsevnetabValues) => void;
  onGoToEetOplysninger: () => void;
}>;

const formatFaktor = (value: number): string => formatAsAmountTrimmed(value, 3);


const EetDifferencekravTab: React.FC<Props> = ({ values, setValues, onGoToEetOplysninger }) => {
  const stamdata = usePersistedSection('stamdata');
  const stamdataFieldErrors = useFormFieldErrors('stamdata');
  const eetFieldErrors = useFormFieldErrors('erhvervsevnetab');
  const { settings } = useAppSettings();
  const [downloadShake, setDownloadShake] = React.useState(false);

  const calculationResult = React.useMemo(
    () =>
      computeEetDifferencekravCalculation({
        erhvervsevnetab: values,
        skadesdato: stamdata?.skadesdato,
        fodselsdato: stamdata?.fodselsdato,
      }),
    [stamdata?.fodselsdato, stamdata?.skadesdato, values]
  );

  const fieldIssues = React.useMemo(() => {
    return [
      toFieldIssue('field-beregningsdato', eetFieldErrors.beregningsdato?.message),
      toFieldIssue('field-aarsloen-asl', eetFieldErrors.aslAarsloen?.message),
      toFieldIssue('field-asl-afgoerelser', eetFieldErrors.aslAfgoerelser?.message),
      toFieldIssue('field-fodselsdato', stamdataFieldErrors.fodselsdato?.message),
      toFieldIssue('field-skadesdato', stamdataFieldErrors.skadesdato?.message),
    ].filter((issue): issue is NonNullable<typeof issue> => issue !== null);
  }, [
    eetFieldErrors.aslAarsloen?.message,
    eetFieldErrors.aslAfgoerelser?.message,
    eetFieldErrors.beregningsdato?.message,
    stamdataFieldErrors.fodselsdato?.message,
    stamdataFieldErrors.skadesdato?.message,
  ]);

  const issues = React.useMemo(
    () =>
      dedupeIssuesBySeverityAndMessage([...calculationResult.issues, ...fieldIssues])
        .sort((a, b) => navigationSortKey(a.id) - navigationSortKey(b.id)),
    [calculationResult.issues, fieldIssues]
  );

  const hasBlockingErrors = calculationResult.hasBlockingErrors;

  const computation = calculationResult.computation;
  const bilagSelection = values.eetDifferencekravBilagSelection;

  const updateBilag = React.useCallback(
    (key: keyof typeof bilagSelection, checked: boolean) => {
      setValues({
        ...values,
        eetDifferencekravBilagSelection: {
          ...bilagSelection,
          [key]: checked,
        },
      });
    },
    [bilagSelection, setValues, values]
  );

  const handlePdfDownload = React.useCallback(async () => {
    if (!computation) {
      setDownloadShake(true);
      setTimeout(() => setDownloadShake(false), 500);
      return;
    }
    await downloadDifferencekravPdf({
      computation,
      koen: values.koen ?? undefined,
      bilagSelection,
      settings,
      persistedStamdata: stamdata,
    });
  }, [computation, values.koen, bilagSelection, settings, stamdata]);

  const handleExtendedSpecificationCommit = React.useCallback(
    (event: CommitEvent<boolean>) => {
      setValues({
        ...values,
        eetDifferencekravBilagSelection: {
          ...values.eetDifferencekravBilagSelection,
          visUdvidetSpecifikationLoebendeYdelserBilag: event.target.value,
        },
      });
    },
    [setValues, values]
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
              <Box
                onClick={handlePdfDownload}
                tabIndex={-1}
                sx={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  animation: downloadShake ? 'shake 0.5s' : 'none',
                  '&:hover': { backgroundColor: '#e3f2fd' },
                  '&:active': { backgroundColor: '#bbdefb' },
                  '@keyframes shake': {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
                    '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
                  },
                }}
              >
                <Download sx={{ fontSize: '24px', color: 'primary.main' }} />
              </Box>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Bilag, der indsættes</Typography>
            <Box className="row--label-right-hover__content">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <FormControlLabel
                    control={(
                      <Checkbox
                        checked={bilagSelection.loebendeYdelser}
                        onChange={(e) => updateBilag('loebendeYdelser', e.target.checked)}
                        size="small"
                      />
                    )}
                    label="Løbende ydelser"
                  />
                  <FormControlLabel
                    control={(
                      <Checkbox
                        checked={bilagSelection.kapitalisering}
                        onChange={(e) => updateBilag('kapitalisering', e.target.checked)}
                        size="small"
                      />
                    )}
                    label="Kapitalisering"
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <FormControlLabel
                    control={(
                      <Checkbox
                        checked={bilagSelection.eetEfterEal}
                        onChange={(e) => updateBilag('eetEfterEal', e.target.checked)}
                        size="small"
                      />
                    )}
                    label="EET efter EAL"
                  />
                  <FormControlLabel
                    control={(
                      <Checkbox
                        checked={bilagSelection.proformaKapitalisering}
                        onChange={(e) => updateBilag('proformaKapitalisering', e.target.checked)}
                        size="small"
                      />
                    )}
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

          {computation.skadesdato < '2011-06-16' ? (
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
                  {`Proformakapitalisering (${formatKapPct(computation.proformaKapitalisering.loebendeEetPct)}) per ${formatIsoDateLong(computation.proformaKapitalisering.kapitaliseringsdato)}:`}
                </Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{`- ${formatKr(computation.proformaBeloeb)}`}</Typography>
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
        <ContentBox className="content-box">
          <Typography className="section-header">Proformakapitalisering af rest-EET</Typography>

          {(() => {
            const pk = computation.proformaKapitalisering!;
            return (
              <>
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
                    {`Grundydelse (${formatKapPct(pk.loebendeEetPct)}): Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag)`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatKr(pk.grundydelse, 2)}</Typography>
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
                    <Typography className="row--text">{`${formatAsAmount(pk.aarsydelse, 2)} kr.`}</Typography>
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
                    <Typography className="row--text">{pk.kapitaliseretPgaUnderToAarTilFp ? 'Ja' : 'Nej'}</Typography>
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
                        <Typography className="row--text">{pk.faktorMaanedsAfhaengig ? 'Ja' : 'Nej'}</Typography>
                      </Box>
                    </Box>

                    {pk.koenOpdelt && (
                      <Box className="row--label-right-hover">
                        <Typography className="row--text">Køn</Typography>
                        <Box className="row--label-right-hover__content">
                          <Typography className="row--text">{values.koen}</Typography>
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
                    {`Beregnet proformakapitalisering (${formatAsAmount(pk.aarsydelse, 2)} kr. x ${formatFaktor(pk.kapitaliseringsfaktor)})`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text text-bold">{formatKr(pk.proformaBeloeb)}</Typography>
                  </Box>
                </Box>
              </>
            );
          })()}
        </ContentBox>
      )}
    </Box>
  );
};

EetDifferencekravTab.displayName = 'EetDifferencekravTab';

export default EetDifferencekravTab;
