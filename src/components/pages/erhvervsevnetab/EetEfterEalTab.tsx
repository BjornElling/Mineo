import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { Download, ErrorOutline, WarningAmber } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ContentBox from '../../layout/ContentBox';
import type { ErhvervsevnetabValues } from '../../../schemas/formSchemas';
import { usePersistedSection } from '../../../hooks/usePersistedSection';
import { useFormFieldErrors } from '../../../hooks/useFormFieldErrors';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import { formatAsAmount } from '../../../utils/formatUtils';
import { aarsloenMax, erhvervsevnetabMax, reguleringssats } from '../../../data/regulationRates';
import {
  computeEetEalCalculation,
  formatDateShortForEet,
  formatPercentTrimmedFromRounded4,
  uniqIssues,
  type EetEalIssue,
} from '../../../domain/erhvervsevnetab/eetEalCalculation';

type Props = Readonly<{
  values: ErhvervsevnetabValues;
  onGoToEetOplysninger: () => void;
}>;

const formatKr = (value: number): string => `${formatAsAmount(value, 0)} kr.`;
const formatPct = (value: number): string => `${formatPercentTrimmedFromRounded4(value)} %`;

const toFieldIssue = (id: string, message: string | undefined): EetEalIssue | null => {
  if (!message || message.trim() === '') return null;
  return { id, severity: 'error', message: message.trim() };
};

type ErrorNavigation = Readonly<{
  pageName: string;
  sectionName: string;
  route: '/stamdata' | '/erhvervsevnetab';
  sectionId: string;
}>;

const resolveIssueNavigation = (issueId: string): ErrorNavigation | null => {
  if (
    issueId === 'fodselsdato-missing' ||
    issueId === 'skadesdato-missing' ||
    issueId === 'field-fodselsdato' ||
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
    issueId === 'eet-pct-missing' ||
    issueId === 'eal-eet-pct-invalid' ||
    issueId === 'field-eal-eet-pct'
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
    issueId === 'asl-identical-endelig'
  ) {
    return {
      pageName: 'EET oplysninger',
      sectionName: 'Arbejdsskadesikringsloven',
      route: '/erhvervsevnetab',
      sectionId: 'eet-oplysninger-asl',
    };
  }

  if (issueId === 'warn-eal-eet-under-15') {
    return {
      pageName: 'EET oplysninger',
      sectionName: 'Erstatningsansvarsloven',
      route: '/erhvervsevnetab',
      sectionId: 'eet-oplysninger-eal',
    };
  }

  if (issueId === 'warn-asl-eet-under-15') {
    return {
      pageName: 'EET oplysninger',
      sectionName: 'Arbejdsskadesikringsloven',
      route: '/erhvervsevnetab',
      sectionId: 'eet-oplysninger-asl',
    };
  }

  if (
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

  if (issueId === 'warn-asl-aarsloen-is-max') {
    return {
      pageName: 'EET oplysninger',
      sectionName: 'Arbejdsskadesikringsloven',
      route: '/erhvervsevnetab',
      sectionId: 'eet-oplysninger-asl',
    };
  }

  if (issueId === 'alder-unresolved') {
    // Afledt fejl: brugeren guides via de konkrete dato-felter på fane 1.
    return null;
  }

  return null;
};

const EetEfterEalTab: React.FC<Props> = ({ values, onGoToEetOplysninger }) => {
  const navigate = useNavigate();
  const stamdata = usePersistedSection('stamdata');
  const stamdataFieldErrors = useFormFieldErrors('stamdata');
  const eetFieldErrors = useFormFieldErrors('erhvervsevnetab');
  const pendingScrollRafRef = React.useRef<number | null>(null);

  const calculationResult = React.useMemo(
    () =>
      computeEetEalCalculation({
        erhvervsevnetab: values,
        skadesdato: stamdata?.skadesdato,
        fodselsdato: stamdata?.fodselsdato,
        reguleringssats,
        erhvervsevnetabMax,
        aarsloenMax,
      }),
    [stamdata?.fodselsdato, stamdata?.skadesdato, values]
  );

  const fieldIssues = React.useMemo(() => {
    return [
      toFieldIssue('field-beregningsdato', eetFieldErrors.beregningsdato?.message),
      toFieldIssue('field-eal-eet-pct', eetFieldErrors.ealEetPct?.message),
      toFieldIssue('field-aarsloen-eal', eetFieldErrors.ealAarsloen?.message),
      toFieldIssue('field-aarsloen-asl', eetFieldErrors.aslAarsloen?.message),
      toFieldIssue('field-fodselsdato', stamdataFieldErrors.fodselsdato?.message),
      toFieldIssue('field-skadesdato', stamdataFieldErrors.skadesdato?.message),
    ].filter((issue): issue is EetEalIssue => issue !== null);
  }, [
    eetFieldErrors.aslAarsloen?.message,
    eetFieldErrors.beregningsdato?.message,
    eetFieldErrors.ealAarsloen?.message,
    eetFieldErrors.ealEetPct?.message,
    stamdataFieldErrors.fodselsdato?.message,
    stamdataFieldErrors.skadesdato?.message,
  ]);

  const issues = React.useMemo(
    () => uniqIssues([...calculationResult.issues, ...fieldIssues]),
    [calculationResult.issues, fieldIssues]
  );

  const hasBlockingErrors = issues.some((issue) => issue.severity === 'error');
  const computation = calculationResult.computation;

  const aldersreduktionFormula = React.useMemo(() => {
    if (!computation) return '';
    if (computation.alderVedSkade <= 29) return '0 =';
    if (computation.alderVedSkade > 54) {
      const cappedAge = Math.min(computation.alderVedSkade, 69);
      return `(${cappedAge} - 29) + (${cappedAge} - 54) x 2 =`;
    }
    return `(${computation.alderVedSkade} - 29) =`;
  }, [computation]);

  const clearPendingScroll = React.useCallback(() => {
    if (pendingScrollRafRef.current !== null) {
      cancelAnimationFrame(pendingScrollRafRef.current);
      pendingScrollRafRef.current = null;
    }
  }, []);

  React.useEffect(() => clearPendingScroll, [clearPendingScroll]);

  const scrollToSectionWithRetry = React.useCallback((sectionId: string) => {
    clearPendingScroll();
    let attempts = 0;
    const maxAttempts = 60;

    const tick = () => {
      const target = document.querySelector<HTMLElement>(`[data-section-id="${sectionId}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        pendingScrollRafRef.current = null;
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        pendingScrollRafRef.current = requestAnimationFrame(tick);
      } else {
        pendingScrollRafRef.current = null;
      }
    };

    pendingScrollRafRef.current = requestAnimationFrame(tick);
  }, [clearPendingScroll]);

  const handleNavigate = React.useCallback((navigation: ErrorNavigation) => {
    if (navigation.route === '/erhvervsevnetab') {
      onGoToEetOplysninger();
      scrollToSectionWithRetry(navigation.sectionId);
      return;
    }

    navigate(navigation.route);
    scrollToSectionWithRetry(navigation.sectionId);
  }, [navigate, onGoToEetOplysninger, scrollToSectionWithRetry]);

  return (
    <Box>
      {issues.length > 0 && (
      <ContentBox className="content-box">
        <Typography className="section-header">Fejl og advarsler</Typography>

        {issues.map((issue) => {
          const navigation = resolveIssueNavigation(issue.id);
          return (
          <Box key={issue.id} className="row--label-right-hover">
            <Typography className="row--text">{issue.message}</Typography>
            <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
              {navigation && (
                <>
                  <Typography className="row--text">
                    {navigation.pageName} {'→'}{' '}
                  </Typography>
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

      {!hasBlockingErrors && computation && (
        <>
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
                    <Download
                      sx={{
                        fontSize: '24px',
                        color: 'text.disabled',
                      }}
                    />
                  </Box>
                </Tooltip>
              </Box>
            </Box>
          </ContentBox>

          <ContentBox className="content-box">
            <Typography className="section-header">Specifikation</Typography>

            <Typography className="row--subheading">Årsløn</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Årsløn på skadestidspunktet</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(computation.aarsloen)}</Typography>
              </Box>
            </Box>

            {computation.reguleringsaar.length > 0 && (
              <>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    Regulering fra skadesår {computation.skadesaar} til beregningsår {computation.beregningsaar}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">+ {formatPct(computation.reguleringsPctRounded4)}</Typography>
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    {`${formatKr(computation.aarsloen)} x (100 % + ${formatPct(computation.reguleringsPctRounded4)}) (afrundet) =`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatKr(computation.reguleretAarsloen)}</Typography>
                  </Box>
                </Box>
              </>
            )}

            <Typography className="row--subheading">Erhvervsevnetab</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Endeligt erhvervsevnetab</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatPct(computation.eetPct)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Kapitaliseringsfaktor</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{computation.kapitaliseringsfaktor}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">
                {`${formatKr(computation.reguleretAarsloen)} x 10 x ${formatPct(computation.eetPct)} =`}
              </Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(computation.eetBeregnet)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Maksimalt erhvervsevnetab i beregningsåret {computation.beregningsaar}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(computation.eetMaks)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">
                {computation.eetReduceretTilMaks
                  ? 'Skadelidtes erhvervsevnetab reduceres til det lovbestemte maksimum'
                  : 'Skadelidtes erhvervsevnetab skal ikke reduceres, dvs. udgør'}
              </Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(computation.eetAnvendt)}</Typography>
              </Box>
            </Box>

            <Typography className="row--subheading">Aldersreduktion</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Fødselsdato</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatDateShortForEet(computation.fodselsdato)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Alder på skadestidspunkt</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{`${computation.alderVedSkade} år`}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">{`Aldersreduktion ${aldersreduktionFormula}`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatPct(computation.aldersreduktionPct)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">
                {`${formatKr(computation.eetAnvendt)} x (- ${formatPct(computation.aldersreduktionPct)}) =`}
              </Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{`- ${formatKr(computation.aldersreduktionBeloeb)}`}</Typography>
              </Box>
            </Box>

            <Typography className="row--subheading">Beregnet EAL-krav</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">
                {`${formatKr(computation.eetAnvendt)} - ${formatKr(computation.aldersreduktionBeloeb)} =`}
              </Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(computation.ealKrav)}</Typography>
              </Box>
            </Box>
          </ContentBox>
        </>
      )}

    </Box>
  );
};

EetEfterEalTab.displayName = 'EetEfterEalTab';

export default EetEfterEalTab;
