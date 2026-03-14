import React from 'react';
import { Box, Checkbox, FormControlLabel, Tooltip, Typography } from '@mui/material';
import { Download, ErrorOutline, WarningAmber } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ContentBox from '../../layout/ContentBox';
import type { ErhvervsevnetabValues } from '../../../schemas/formSchemas';
import { usePersistedSection } from '../../../hooks/usePersistedSection';
import { useFormFieldErrors } from '../../../hooks/useFormFieldErrors';
import { useScrollToSectionWithRetry } from '../../../hooks/useScrollToSectionWithRetry';
import { formatIsoDateLong, formatIsoDateShort } from '../../../utils/dateFormatting';
import { formatAsAmount, formatAsAmountTrimmed } from '../../../utils/formatUtils';
import { dedupeIssuesBySeverityAndMessage } from '../../../utils/issueUtils';
import {
  computeEetDifferencekravCalculation,
  formatKapPct,
  type EetDifferencekravIssue,
} from '../../../domain/erhvervsevnetab/eetDifferencekravCalculation';

type Props = Readonly<{
  values: ErhvervsevnetabValues;
  setValues: (values: ErhvervsevnetabValues) => void;
  onGoToEetOplysninger: () => void;
}>;

type ErrorNavigation = Readonly<{
  pageName: string;
  sectionName: string;
  route: '/stamdata' | '/erhvervsevnetab';
  sectionId: string;
}>;

const formatKr = (value: number): string => `${formatAsAmount(value, 0)} kr.`;
const formatFaktor = (value: number): string => formatAsAmountTrimmed(value, 3);

const TextHoverRow: React.FC<Readonly<{ text: string }>> = ({ text }) => (
  <Box className="row--label-right-hover">
    <Typography className="row--text">{text}</Typography>
    <Box className="row--label-right-hover__content" />
  </Box>
);

const UnderlinedHoverRow: React.FC<Readonly<{ text: string }>> = ({ text }) => (
  <Box className="row--label-right-hover">
    <Typography className="row--subheading-underlined">{text}</Typography>
    <Box className="row--label-right-hover__content" />
  </Box>
);

const toFieldIssue = (id: string, message: string | undefined): EetDifferencekravIssue | null => {
  if (!message || message.trim() === '') return null;
  return { id, severity: 'error', message: message.trim() };
};

const resolveIssueNavigation = (issueId: string): ErrorNavigation | null => {
  if (
    issueId === 'fodselsdato-missing' ||
    issueId === 'field-fodselsdato' ||
    issueId === 'skadesdato-missing' ||
    issueId === 'field-skadesdato'
  ) {
    return {
      pageName: 'Stamdata',
      sectionName: 'Skadelidte',
      route: '/stamdata',
      sectionId: 'stamdata-skadelidte',
    };
  }

  if (issueId === 'beregningsdato-missing' || issueId === 'field-beregningsdato') {
    return {
      pageName: 'EET oplysninger',
      sectionName: 'Stamdata',
      route: '/erhvervsevnetab',
      sectionId: 'eet-oplysninger-stamdata',
    };
  }

  if (
    issueId === 'aarsloen-missing' ||
    issueId === 'field-aarsloen-asl' ||
    issueId === 'field-aarsloen-eal'
  ) {
    return {
      pageName: 'EET oplysninger',
      sectionName: 'Arbejdsskadesikringsloven',
      route: '/erhvervsevnetab',
      sectionId: 'eet-oplysninger-asl',
    };
  }

  if (
    issueId === 'eal-eet-pct-invalid' ||
    issueId === 'warn-eal-eet-under-15' ||
    issueId === 'warn-eal-aarsloen-is-max' ||
    issueId === 'warn-eal-aarsloen-empty-for-2024-07-01'
  ) {
    return {
      pageName: 'EET oplysninger',
      sectionName: 'Erstatningsansvarsloven',
      route: '/erhvervsevnetab',
      sectionId: 'eet-oplysninger-eal',
    };
  }

  if (
    issueId === 'asl-selected-eet-pct-invalid' ||
    issueId === 'asl-identical-endelig' ||
    issueId === 'asl-afgoerelser-empty' ||
    issueId === 'warn-asl-eet-under-15' ||
    issueId === 'warn-invalid-eet-pct-after-2024-07-01' ||
    issueId === 'warn-non-endelig-after-endelig' ||
    issueId === 'warn-afgoerelsesdato-after-beregningsdato' ||
    issueId === 'warn-virkningsdato-after-beregningsdato' ||
    issueId === 'warn-kap-dato-after-beregningsdato'
  ) {
    return {
      pageName: 'EET oplysninger',
      sectionName: 'Arbejdsskadesikringsloven',
      route: '/erhvervsevnetab',
      sectionId: 'eet-oplysninger-asl',
    };
  }

  return null;
};

const NAVIGATION_SORT_ORDER: Record<string, number> = {
  'stamdata-skadelidte': 0,
  'eet-oplysninger-stamdata': 1,
  'eet-oplysninger-asl': 2,
  'eet-oplysninger-eal': 3,
};

const navigationSortKey = (issueId: string): number => {
  const nav = resolveIssueNavigation(issueId);
  return nav !== null ? (NAVIGATION_SORT_ORDER[nav.sectionId] ?? 99) : 99;
};

// Issue-IDs der undertrykkes på fane 5 — enten fordi de ikke er relevante for differencekrav,
// eller fordi de allerede dækkes af et andet issue på fane 5:
// - 'eet-pct-missing', 'field-eal-eet-pct', 'field-aarsloen-eal': EAL-felterne er valgfrie på
//   fane 5 (beregningen falder tilbage på ASL-værdier) og dækkes af 'asl-afgoerelser-empty' /
//   'aarsloen-missing', der begge peger på ASL-sektionen.
const SUPPRESSED_ISSUE_IDS_FANE5 = new Set(['eet-pct-missing', 'field-eal-eet-pct', 'field-aarsloen-eal']);

const EetDifferencekravTab: React.FC<Props> = ({ values, setValues, onGoToEetOplysninger }) => {
  const navigate = useNavigate();
  const stamdata = usePersistedSection('stamdata');
  const stamdataFieldErrors = useFormFieldErrors('stamdata');
  const eetFieldErrors = useFormFieldErrors('erhvervsevnetab');
  const scrollToSectionWithRetry = useScrollToSectionWithRetry();

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
      toFieldIssue('field-fodselsdato', stamdataFieldErrors.fodselsdato?.message),
      toFieldIssue('field-skadesdato', stamdataFieldErrors.skadesdato?.message),
    ].filter((issue): issue is EetDifferencekravIssue => issue !== null);
  }, [
    eetFieldErrors.beregningsdato?.message,
    eetFieldErrors.aslAarsloen?.message,
    stamdataFieldErrors.fodselsdato?.message,
    stamdataFieldErrors.skadesdato?.message,
  ]);

  const issues = React.useMemo(
    () =>
      dedupeIssuesBySeverityAndMessage([...calculationResult.issues, ...fieldIssues])
        .filter((issue) => !SUPPRESSED_ISSUE_IDS_FANE5.has(issue.id))
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

  const handleNavigate = React.useCallback(
    (navigation: ErrorNavigation) => {
      if (navigation.route === '/erhvervsevnetab') {
        onGoToEetOplysninger();
        scrollToSectionWithRetry(navigation.sectionId);
        return;
      }
      navigate(navigation.route);
      scrollToSectionWithRetry(navigation.sectionId);
    },
    [navigate, onGoToEetOplysninger, scrollToSectionWithRetry]
  );

  return (
    <Box>
      {/* Fejl og advarsler */}
      {issues.length > 0 && (
        <ContentBox className="content-box">
          <Typography className="section-header">Fejl og advarsler</Typography>

          {issues.map((issue) => {
            const navigation = resolveIssueNavigation(issue.id);
            return (
              <Box key={`${issue.severity}-${issue.id}-${issue.message}`} className="row--label-right-hover">
                <Typography className="row--text">{issue.message}</Typography>
                <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
                  {navigation && (
                    <>
                      <Typography className="row--text">{navigation.pageName} {'→'} </Typography>
                      <Typography
                        className="row--text icon-text-link"
                        component="button"
                        type="button"
                        onClick={() => handleNavigate(navigation)}
                        sx={{
                          cursor: 'pointer',
                          border: 0,
                          background: 'transparent',
                          p: 0,
                          m: 0,
                          font: 'inherit',
                        }}
                      >
                        {navigation.sectionName}
                      </Typography>
                    </>
                  )}
                  {issue.severity === 'error' ? (
                    <ErrorOutline sx={{ color: 'red', fontSize: 20 }} />
                  ) : (
                    <WarningAmber sx={{ color: 'orange', fontSize: 20 }} />
                  )}
                </Box>
              </Box>
            );
          })}
        </ContentBox>
      )}

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
              <Tooltip
                title="Download bliver tilgængelig, når PDF-specifikationen er defineret"
                arrow
                placement="top"
              >
                <Box
                  tabIndex={-1}
                  sx={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'default',
                  }}
                >
                  <Download sx={{ fontSize: '24px', color: 'text.disabled' }} />
                </Box>
              </Tooltip>
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
                    <Typography className="row--text">{`${formatAsAmount(pk.grundydelse, 2)} kr.`}</Typography>
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
                    {`Årlig ydelse (${formatAsAmount(pk.grundydelse, 2)} kr. x ${formatAsAmountTrimmed(100 + pk.reguleringsPctRounded4, 4)} %)`}
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
                        <Typography className="row--text">Ja</Typography>
                      </Box>
                    </Box>

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
