import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { Download, ErrorOutline, WarningAmber } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ContentBox from '../../layout/ContentBox';
import StyledToggleSwitch from '../../inputs/StyledToggleSwitch';
import StandardDisplayTable, { type StandardDisplayTableColumn, type StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import type { ErhvervsevnetabValues } from '../../../schemas/formSchemas';
import { usePersistedSection } from '../../../hooks/usePersistedSection';
import { useFormFieldErrors } from '../../../hooks/useFormFieldErrors';
import { useScrollToSectionWithRetry } from '../../../hooks/useScrollToSectionWithRetry';
import { formatIsoDateLong, formatIsoDateShort } from '../../../utils/dateFormatting';
import { formatAsAmount } from '../../../utils/formatUtils';
import { dedupeIssuesBySeverityAndMessage } from '../../../utils/issueUtils';
import {
  ASL_MAX_AARSLOEN_2003,
  ASL_MAX_AARSLOEN_2024,
  reguleringsprocentErhvervsevnetabFoer2024,
} from '../../../data/regulationRates';
import {
  computeEetLoebendeYdelser,
  formatPct,
  formatSkadesdatoCompact,
  toAfgoerelseTypeLabel,
  toOphoerAarsagLabel,
  type EetLoebendeIssue,
} from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import { roundByMethod } from '../../../utils/rounding';

type Props = Readonly<{
  values: ErhvervsevnetabValues;
  onGoToEetOplysninger: () => void;
}>;

type ErrorNavigation = Readonly<{
  pageName: string;
  sectionName: string;
  route: '/stamdata' | '/erhvervsevnetab';
  sectionId: string;
}>;

const formatKr = (value: number, precision: 0 | 2 = 0): string => `${formatAsAmount(value, precision)} kr.`;
const formatMaaneder = (value: number): string => formatAsAmount(roundByMethod(value, 4, 'halfAwayFromZero'), 4);
const formatJaNej = (value: boolean): string => (value ? 'Ja' : 'Nej');
const formatRegulering = (value: number): string => `${value >= 0 ? '+' : '-'} ${formatPct(Math.abs(value))}`;
const formatPctTal = (value: number): string => formatPct(value).replace(' %', '');
const formatEetHoverLabel = (eetPct: number, priorKapPct: number): string =>
  priorKapPct > 0
    ? `Erhvervsevnetab (${formatPct(eetPct)} - ${formatPct(priorKapPct)} tidligere kap.) =`
    : 'Erhvervsevnetab';
const formatEetHoverValue = (eetPct: number, priorKapPct: number): string =>
  priorKapPct > 0 ? formatPct(Math.max(0, eetPct - priorKapPct)) : formatPct(eetPct);
const formatEetFormulaFactor = (eetPct: number, priorKapPct: number): string =>
  priorKapPct > 0 ? formatPct(Math.max(0, eetPct - priorKapPct)) : formatPct(eetPct);

const YDELSER_TABLE_COLUMNS: readonly StandardDisplayTableColumn[] = [
  { header: 'Fra o.m.', align: 'center', width: '14%' },
  { header: 'Til o.m.', align: 'center', width: '14%' },
  { header: 'Mdr.', align: 'right', width: '10%' },
  { header: 'Grundydelse', align: 'right', width: '18%' },
  { header: 'Regulering', align: 'right', width: '12%' },
  { header: 'Ydelse/md. (afr.)', align: 'right', width: '14%' },
  { header: 'Beregnet EET', align: 'right', width: '18%' },
];

const TextHoverRow: React.FC<Readonly<{ text: string }>> = ({ text }) => (
  <Box className="row--label-right-hover">
    <Typography className="row--text">{text}</Typography>
    <Box className="row--label-right-hover__content" />
  </Box>
);

const UnderlinedHoverRow: React.FC<Readonly<{ text: string }>> = ({ text }) => (
  <Box className="row--label-right-hover">
    <Typography className="row--subheading-underlined">
      {text}
    </Typography>
    <Box className="row--label-right-hover__content" />
  </Box>
);

const toFieldIssue = (id: string, message: string | undefined): EetLoebendeIssue | null => {
  if (!message || message.trim() === '') return null;
  return { id, severity: 'error', message: message.trim() };
};

const resolveIssueNavigation = (issueId: string): ErrorNavigation | null => {
  if (issueId === 'fodselsdato-missing' || issueId === 'field-fodselsdato' || issueId === 'skadesdato-missing' || issueId === 'field-skadesdato') {
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

  return {
    pageName: 'EET oplysninger',
    sectionName: 'Arbejdsskadesikringsloven',
    route: '/erhvervsevnetab',
    sectionId: 'eet-oplysninger-asl',
  };
};

const EetLoebendeYdelserTab: React.FC<Props> = ({ values, onGoToEetOplysninger }) => {
  const navigate = useNavigate();
  const stamdata = usePersistedSection('stamdata');
  const stamdataFieldErrors = useFormFieldErrors('stamdata');
  const eetFieldErrors = useFormFieldErrors('erhvervsevnetab');
  const [showExtendedSpecification, setShowExtendedSpecification] = React.useState(false);
  const scrollToSectionWithRetry = useScrollToSectionWithRetry();

  const calculationResult = React.useMemo(
    () =>
      computeEetLoebendeYdelser({
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
    ].filter((issue): issue is EetLoebendeIssue => issue !== null);
  }, [
    eetFieldErrors.aslAfgoerelser?.message,
    eetFieldErrors.aslAarsloen?.message,
    eetFieldErrors.beregningsdato?.message,
    stamdataFieldErrors.fodselsdato?.message,
    stamdataFieldErrors.skadesdato?.message,
  ]);

  const issues = React.useMemo(
    () => dedupeIssuesBySeverityAndMessage([...calculationResult.issues, ...fieldIssues]),
    [calculationResult.issues, fieldIssues]
  );

  const hasBlockingErrors = issues.some((issue) => issue.severity === 'error');
  const computation = calculationResult.computation;

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
                      <Typography className="row--text">{navigation.pageName} {'->'} </Typography>
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
              <Typography className="row--text">Medtag udvidet specifikation i PDF</Typography>
              <Box className="row--label-right-hover__content">
                <StyledToggleSwitch
                  checked={showExtendedSpecification}
                  onCommit={(event) => setShowExtendedSpecification(event.target.value)}
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Download specifikation</Typography>
              <Box className="row--label-right-hover__content">
                <Tooltip title="Download bliver tilgængelig, når PDF-specifikationen er defineret" arrow placement="top">
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
          </ContentBox>

          {computation.afgoerelser.map((afgoerelse) => {
            return (
              <ContentBox key={afgoerelse.rowId} className="content-box">
                <Typography className="section-header">{`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`}</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Type</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">
                      {toAfgoerelseTypeLabel(
                        afgoerelse.afgoerelseType,
                        afgoerelse.harRestSektion,
                        afgoerelse.harKapitalisering
                      )}
                    </Typography>
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    {formatEetHoverLabel(afgoerelse.eetPct, afgoerelse.priorKapPct)}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">
                      {formatEetHoverValue(afgoerelse.eetPct, afgoerelse.priorKapPct)}
                    </Typography>
                  </Box>
                </Box>

                {afgoerelse.harKapitalisering && afgoerelse.kapitaliseringsdato && (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {afgoerelse.harRestSektion
                        ? `Delvist kapitaliseret (${formatPct(afgoerelse.kapPctAktuel)})`
                        : 'Kapitaliseret'}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{formatIsoDateShort(afgoerelse.kapitaliseringsdato)}</Typography>
                    </Box>
                  </Box>
                )}

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Årsløn</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatKr(computation.benyttetAarsloen)}</Typography>
                  </Box>
                </Box>

                <Typography className="row--subheading">Periodeafgrænsning</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Afgørelsesdato</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatIsoDateShort(afgoerelse.afgoerelsesdato)}</Typography>
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Virkningsdato</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatIsoDateShort(afgoerelse.virkningsdato)}</Typography>
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Afgørelse med tilbagevirkende kraft?</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatJaNej(afgoerelse.tilbagevirkendeKraft)}</Typography>
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Løbende ydelse ophører</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatIsoDateShort(afgoerelse.ophoerDato)}</Typography>
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Ophør skyldes</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{toOphoerAarsagLabel(afgoerelse.ophoerAarsag)}</Typography>
                  </Box>
                </Box>

                <Typography className="row--subheading">Beregnede ydelser</Typography>

                <StandardDisplayTable
                  columns={YDELSER_TABLE_COLUMNS}
                  rows={[
                    ...afgoerelse.perioder.map((row): StandardDisplayTableRow => ({
                      key: `${row.fra}-${row.til}-${row.satsAar}`,
                      cells: [
                        formatIsoDateShort(row.fra),
                        formatIsoDateShort(row.til),
                        formatMaaneder(row.maanederPraecis),
                        formatKr(row.grundydelseAfrundet, 2),
                        formatRegulering(row.reguleringPct),
                        formatKr(row.maanedligYdelse),
                        formatKr(row.beregnetEet),
                      ],
                    })),
                    {
                      key: `${afgoerelse.rowId}-i-alt`,
                      cells: ['I alt', '', '', '', '', '', formatKr(afgoerelse.iAltBeregnetEet)],
                      rowSx: { '& .MuiTableCell-root': { fontWeight: 700 } },
                    },
                  ]}
                  containerSx={{ width: '100%' }}
                  tableSx={{ width: '100%' }}
                />
              </ContentBox>
            );
          })}

          <ContentBox className="content-box">
            <Typography className="section-header">Udvidet specifikation</Typography>

            <Typography className="row--subheading">Årsløn</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">
                {`ASL årsløn (afrundet til nærmeste 1000 og maks. ${formatAsAmount(computation.maxAarsloenISkadesaar, 0)} kr.)`}
              </Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(computation.benyttetAarsloen)}</Typography>
              </Box>
            </Box>

            <Typography className="row--subheading">Grundløn</Typography>

            {computation.grundloenNiveau === '2003' ? (
              <>
                <TextHoverRow text="Skaden er sket før 1. juli 2024, og grundlønnen beregnes derfor i 2003-niveau." />
                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    {`Årsløn × (Maks. årsløn 1/1-2003 / Maks. årsløn ${formatSkadesdatoCompact(computation.skadesdato)}) = ${formatKr(computation.benyttetAarsloen)} × (${formatAsAmount(ASL_MAX_AARSLOEN_2003, 0)} / ${formatAsAmount(computation.maxAarsloenISkadesaar, 0)}) =`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatKr(computation.grundloen)}</Typography>
                  </Box>
                </Box>
              </>
            ) : (
              <>
                <TextHoverRow text="Skaden er sket fra 1. juli 2024, og grundlønnen beregnes derfor i 2024-niveau." />
                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    {`Årsløn × (Maks. årsløn 1/1-2024 / Maks. årsløn ${formatSkadesdatoCompact(computation.skadesdato)}) = ${formatKr(computation.benyttetAarsloen)} × (${formatAsAmount(ASL_MAX_AARSLOEN_2024, 0)} / ${formatAsAmount(computation.maxAarsloenISkadesaar, 0)}) =`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatKr(computation.grundloen)}</Typography>
                  </Box>
                </Box>
              </>
            )}

            <Typography className="row--subheading">Regulering</Typography>

            {computation.erstatningsniveauPct === 83 ? (
              <>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">Da skaden er sket 1/1-2011 eller senere, udgør erstatningsniveauet</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">83 %</Typography>
                  </Box>
                </Box>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">Der trækkes AM-bidrag (8 %) fra årslønnen og sker dermed yderligere regulering til</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">92 %</Typography>
                  </Box>
                </Box>
              </>
            ) : (
              <>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">Da skaden er før 1/1-2011, udgør erstatningsniveauet</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">80 %</Typography>
                  </Box>
                </Box>
                <TextHoverRow text="Der trækkes ikke AM-bidrag fra årslønnen." />
              </>
            )}

            {computation.afgoerelser.map((afgoerelse) => {
              const reguleringFoer2024Pct = reguleringsprocentErhvervsevnetabFoer2024[2024] ?? 0;
              const reguleringFoer2024FaktorTekst = formatAsAmount(
                roundByMethod(1 + reguleringFoer2024Pct / 100, 3, 'halfAwayFromZero'),
                3
              );
              const hasYdelseFrom2024 = afgoerelse.perioder.some((row) => row.fra >= '2024-01-01');
              const showSplitHeading = computation.grundloenNiveau === '2003' && hasYdelseFrom2024;
              const uses2024GrundloenEquation = computation.grundloenNiveau === '2024';
              const hasKapitaliseringsdato = afgoerelse.kapitaliseringsdato !== null;
              const hasRestSection = afgoerelse.harRestSektion && hasKapitaliseringsdato;
              const kapitaliseringFra2024 =
                afgoerelse.kapitaliseringsdato !== null &&
                afgoerelse.kapitaliseringsdato >= '2024-01-01';
              const hasRestAfterKapBefore2024 = Boolean(
                hasRestSection &&
                afgoerelse.kapitaliseringsdato &&
                afgoerelse.kapitaliseringsdato < '2024-01-01'
              );
              const showRest2003 = hasRestSection && (!showSplitHeading || !kapitaliseringFra2024);
              const showRest2024 = showSplitHeading && hasRestSection && kapitaliseringFra2024;
              const restEetExpression = `${formatPctTal(afgoerelse.eetPctFoerAktuelKap)} - ${formatPct(
                afgoerelse.kapPctAktuel
              )} = ${formatPct(afgoerelse.restEetPct)}`;
              const restTextPrefix =
                afgoerelse.kapitaliseringsdato !== null
                  ? `Resterende EET (${restEetExpression}) efter kapitalisering ${formatIsoDateShort(afgoerelse.kapitaliseringsdato)}`
                  : 'Resterende EET efter kapitalisering';
              const grundloen2024Niveau =
                computation.grundloenNiveau === '2003'
                  ? roundByMethod(
                      computation.grundloen * (1 + reguleringFoer2024Pct / 100),
                      0,
                      'halfAwayFromZero'
                    )
                  : computation.grundloen;

              const grundydelseFormula = uses2024GrundloenEquation
                ? (
                    computation.erstatningsniveauPct === 83
                      ? `Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag) = ${formatKr(grundloen2024Niveau)} × ${formatEetFormulaFactor(afgoerelse.eetPct, afgoerelse.priorKapPct)} × 83 % × 92 % =`
                      : `Grundløn × EET × Erstatningsniveau = ${formatKr(grundloen2024Niveau)} × ${formatEetFormulaFactor(afgoerelse.eetPct, afgoerelse.priorKapPct)} × 80 % =`
                  )
                : (
                    computation.erstatningsniveauPct === 83
                      ? `Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag) = ${formatKr(computation.grundloen)} × ${formatEetFormulaFactor(afgoerelse.eetPct, afgoerelse.priorKapPct)} × 83 % × 92 % =`
                      : `Grundløn × EET × Erstatningsniveau = ${formatKr(computation.grundloen)} × ${formatEetFormulaFactor(afgoerelse.eetPct, afgoerelse.priorKapPct)} × 80 % =`
                  );

              const primaryGrundydelse = uses2024GrundloenEquation
                ? afgoerelse.grundydelse2024Fuld
                : afgoerelse.grundydelseFuld;
              const restGrundydelse2003 = afgoerelse.grundydelseRest ?? afgoerelse.grundydelseFuld;
              const restGrundydelse2024 = afgoerelse.grundydelse2024Rest ?? afgoerelse.grundydelse2024Fuld;
              const grundydelse2003BaseFor2024 = hasRestAfterKapBefore2024
                ? restGrundydelse2003
                : afgoerelse.grundydelseFuld;
              const grundydelse2024Result = hasRestAfterKapBefore2024
                ? restGrundydelse2024
                : afgoerelse.grundydelse2024Fuld;

              return (
                <Box key={`grundydelse-${afgoerelse.rowId}`} sx={{ mt: 2 }}>
                  <Typography className="row--subheading">
                    {`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`}
                  </Typography>

                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {formatEetHoverLabel(afgoerelse.eetPct, afgoerelse.priorKapPct)}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">
                        {formatEetHoverValue(afgoerelse.eetPct, afgoerelse.priorKapPct)}
                      </Typography>
                    </Box>
                  </Box>

                  <UnderlinedHoverRow text={showSplitHeading ? 'Grundydelse før 1. januar 2024' : 'Grundydelse'} />
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">{grundydelseFormula}</Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{formatKr(primaryGrundydelse, 2)}</Typography>
                    </Box>
                  </Box>
                  {showRest2003 && (
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">
                        {restTextPrefix}
                      </Typography>
                      <Box className="row--label-right-hover__content">
                        <Typography className="row--text">{formatKr(restGrundydelse2003, 2)}</Typography>
                      </Box>
                    </Box>
                  )}

                  {showSplitHeading && (
                    <>
                      <UnderlinedHoverRow text="Grundydelse fra 1. januar 2024" />
                      <Box className="row--label-right-hover">
                        <Typography className="row--text">{`Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ ${formatPct(reguleringFoer2024Pct)}): ${formatKr(grundydelse2003BaseFor2024, 2)} × ${reguleringFoer2024FaktorTekst} =`}</Typography>
                        <Box className="row--label-right-hover__content">
                          <Typography className="row--text">{formatKr(grundydelse2024Result, 2)}</Typography>
                        </Box>
                      </Box>
                      {showRest2024 && (
                        <Box className="row--label-right-hover">
                          <Typography className="row--text">
                            {restTextPrefix}
                          </Typography>
                          <Box className="row--label-right-hover__content">
                            <Typography className="row--text">{formatKr(restGrundydelse2024, 2)}</Typography>
                          </Box>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              );
            })}
          </ContentBox>
        </>
      )}
    </Box>
  );
};

EetLoebendeYdelserTab.displayName = 'EetLoebendeYdelserTab';

export default EetLoebendeYdelserTab;
