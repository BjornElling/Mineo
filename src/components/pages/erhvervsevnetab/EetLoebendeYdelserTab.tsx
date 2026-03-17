import React from 'react';
import { Box, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import ContentBox from '../../layout/ContentBox';
import StyledToggleSwitch from '../../inputs/StyledToggleSwitch';
import type { CommitEvent } from '../../inputs/fieldEvents';
import StandardDisplayTable, { type StandardDisplayTableColumn, type StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import type { ErhvervsevnetabValues } from '../../../schemas/formSchemas';
import { usePersistedSection } from '../../../hooks/usePersistedSection';
import { useFormFieldErrors } from '../../../hooks/useFormFieldErrors';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { downloadLoebendeYdelserPdf } from '../../../utils/pdf/pdfService';
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
} from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import { roundByMethod } from '../../../utils/rounding';
import EetIssuesBox from './EetIssuesBox';
import TextHoverRow from './TextHoverRow';
import UnderlinedHoverRow from './UnderlinedHoverRow';
import { formatKr, navigationSortKey, toFieldIssue } from './eetTabSharedUtils';

type Props = Readonly<{
  values: ErhvervsevnetabValues;
  setValues: (values: ErhvervsevnetabValues) => void;
  onGoToEetOplysninger: () => void;
}>;

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
  { header: 'Ydelse/md.', align: 'right', width: '14%' },
  { header: 'Beregnet EET', align: 'right', width: '18%' },
];


const EetLoebendeYdelserTab: React.FC<Props> = ({ values, setValues, onGoToEetOplysninger }) => {
  const stamdata = usePersistedSection('stamdata');
  const stamdataFieldErrors = useFormFieldErrors('stamdata');
  const eetFieldErrors = useFormFieldErrors('erhvervsevnetab');
  const { settings } = useAppSettings();
  const showExtendedSpecification = values.eetDifferencekravBilagSelection.visUdvidetSpecifikation;
  const [downloadShake, setDownloadShake] = React.useState(false);

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
    ].filter((issue): issue is NonNullable<typeof issue> => issue !== null);
  }, [
    eetFieldErrors.aslAfgoerelser?.message,
    eetFieldErrors.aslAarsloen?.message,
    eetFieldErrors.beregningsdato?.message,
    stamdataFieldErrors.fodselsdato?.message,
    stamdataFieldErrors.skadesdato?.message,
  ]);

  const issues = React.useMemo(
    () =>
      dedupeIssuesBySeverityAndMessage([...calculationResult.issues, ...fieldIssues]).sort(
        (a, b) => navigationSortKey(a.id) - navigationSortKey(b.id)
      ),
    [calculationResult.issues, fieldIssues]
  );

  const hasBlockingErrors = issues.some((issue) => issue.severity === 'error');
  const computation = calculationResult.computation;
  const afgoerelser = computation?.afgoerelser ?? [];

  const handleExtendedSpecificationCommit = React.useCallback(
    (event: CommitEvent<boolean>) => {
      setValues({
        ...values,
        eetDifferencekravBilagSelection: {
          ...values.eetDifferencekravBilagSelection,
          visUdvidetSpecifikation: event.target.value,
        },
      });
    },
    [setValues, values]
  );

  const handlePdfDownload = React.useCallback(async () => {
    if (!computation) {
      setDownloadShake(true);
      setTimeout(() => setDownloadShake(false), 500);
      return;
    }
    await downloadLoebendeYdelserPdf({
      computation,
      visUdvidetSpecifikation: showExtendedSpecification,
      settings,
      persistedStamdata: stamdata,
    });
  }, [computation, showExtendedSpecification, settings, stamdata]);

  return (
    <Box>
      <EetIssuesBox
        issues={issues}
        onGoToEetOplysninger={onGoToEetOplysninger}
      />

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
                  onCommit={handleExtendedSpecificationCommit}
                />
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
          </ContentBox>

          {afgoerelser.map((afgoerelse) => {
            const hasRowsBefore2024 = afgoerelse.perioder.some((row) => row.satsAar <= 2023);
            const hasRowsFrom2024 = afgoerelse.perioder.some((row) => row.satsAar >= 2024);
            const viserGrundydelseNiveauSkift =
              computation.grundloenNiveau === '2003' && hasRowsBefore2024 && hasRowsFrom2024;
            const ingenLoebendeYdelse = afgoerelse.iAltBeregnetEet === 0;
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
                {viserGrundydelseNiveauSkift && (
                  <TextHoverRow text="Frem til 1. januar 2024 beregnes grundydelsen i 2003-niveau og derefter i 2024-niveau." />
                )}
                {ingenLoebendeYdelse && (
                  <TextHoverRow text="Afgørelsen giver ingen løbende ydelse i den valgte periode." />
                )}

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

            <Typography className="row--subheading">Ydelsesniveau</Typography>

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

            {afgoerelser.map((afgoerelse) => {
              const reguleringFoer2024Pct = reguleringsprocentErhvervsevnetabFoer2024[2024] ?? 0;
              const reguleringFoer2024FaktorTekst = formatAsAmount(
                roundByMethod(1 + reguleringFoer2024Pct / 100, 3, 'halfAwayFromZero'),
                3
              );
              const hasYdelseFrom2024 = afgoerelse.perioder.some((row) => row.satsAar >= 2024);
              const show2024ConversionBlock = computation.grundloenNiveau === '2003' && hasYdelseFrom2024;
              const showSplitHeading = show2024ConversionBlock;
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
              const showRest2003 = hasRestSection && (!show2024ConversionBlock || !kapitaliseringFra2024);
              const showRest2024 = show2024ConversionBlock && hasRestSection && kapitaliseringFra2024;
              const restEetExpression = `${formatPctTal(afgoerelse.eetPctFoerAktuelKap)} - ${formatPct(
                afgoerelse.kapPctAktuel
              )} = ${formatPct(afgoerelse.restEetPct)}`;
              const restTextPrefix =
                afgoerelse.kapitaliseringsdato !== null
                  ? `Resterende EET (${restEetExpression}) efter kapitalisering ${formatIsoDateShort(afgoerelse.kapitaliseringsdato)}`
                  : 'Resterende EET efter kapitalisering';
              const grundydelseFormula =
                computation.erstatningsniveauPct === 83
                  ? `Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag) = ${formatKr(computation.grundloen)} × ${formatEetFormulaFactor(afgoerelse.eetPct, afgoerelse.priorKapPct)} × 83 % × 92 % =`
                  : `Grundløn × EET × Erstatningsniveau = ${formatKr(computation.grundloen)} × ${formatEetFormulaFactor(afgoerelse.eetPct, afgoerelse.priorKapPct)} × 80 % =`;

              const primaryGrundydelse =
                computation.grundloenNiveau === '2024'
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

                  <UnderlinedHoverRow
                    text={
                      showSplitHeading
                        ? 'Grundydelse før 1. januar 2024'
                        : show2024ConversionBlock
                          ? 'Grundydelse fra 1. januar 2024'
                          : 'Grundydelse'
                    }
                  />
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
