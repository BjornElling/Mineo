import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import ToggleField from '../../../inputCore/react/fields/ToggleField';
import StandardDisplayTable, { type StandardDisplayTableColumn, type StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { formatIsoDateLong, formatISOToDanish } from '../../../utils/dateFormatting';
import { formatAsAmount } from '../../../utils/formatUtils';
import {
  ASL_MAX_AARSLOEN_2003,
  ASL_MAX_AARSLOEN_2024,
} from '../../../data/lovbestemteRates';
import {
  formatSkadedatoCompact,
  resolveLoebendeAfgoerelseRestVisning,
  toAfgoerelseTypeLabel,
  toOphoerAarsagLabel,
  visGrundydelseNiveauSkift,
} from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import { roundByMethod } from '../../../utils/rounding';
import EetIssuesBox from './EetIssuesBox';
import HoverRow from './HoverRow';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import DocumentOutcomeMessage from '../../inputs/DocumentOutcomeMessage';
import { formatJaNej, formatPct } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { formatKr } from '../../../utils/formatUtils';
import { getDocumentFormatLabel } from '../../../document/documentFormat';
import { toKroner } from '../../../domain/money/money';
import type { ErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { ERHVERVSEVNETAB_TAB_KEYS } from '../../../domain/erhvervsevnetab/eetIssueNavigation';
import { APP_ROUTES } from '../../../config/pageNavigation';
import { visibleDocumentFailureMessage, type DocumentDownloadHandle } from '../../../document/definition/react/useDocumentDownload';
import { erhvervsevnetabBilagVisUdvidetSpecifikationField } from '../../../inputCore/catalog/erhvervsevnetabDescriptors';

type Props = Readonly<{
  onGoToEetOplysninger: () => void;
  projection: ErhvervsevnetabReaderProjection;
  /** Dokumentoutputtet, komponeret af siden. Fanen aktiverer det; den konfigurerer det ikke. */
  download: DocumentDownloadHandle<void>;
}>;

const extendedSpecificationRef = erhvervsevnetabBilagVisUdvidetSpecifikationField.bind();
// route + tabKey er eksplicit navigation-metadata (§3.7); feltet bor på løbende-ydelser-fanen.
const EXTENDED_SPECIFICATION_LOCATION = { locationId: 'erhvervsevnetab:loebendeYdelser:visUdvidetSpecifikation', route: APP_ROUTES.erhvervsevnetab, tabKey: ERHVERVSEVNETAB_TAB_KEYS.LOEBENDE_YDELSER } as const;

const formatMaaneder = (value: number): string => formatAsAmount(roundByMethod(value, 4, 'halfAwayFromZero'), 4);
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


const EetLoebendeYdelserTab = ({ onGoToEetOplysninger, projection, download }: Props) => {
  const { settings } = useAppSettings();
  const documentFormatLabel = getDocumentFormatLabel(settings.documentDownloadFormat);
  const snapshot = projection.snapshot.loebendeYdelser;
  const issues = snapshot.issues;
  const hasBlockingErrors = snapshot.hasBlockingErrors;
  const computation = snapshot.computation;
  const afgoerelser = computation?.afgoerelser ?? [];

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
              <Typography className="row--text">Medtag udvidet specifikation i {documentFormatLabel}</Typography>
              <Box className="row--label-right-hover__content">
                <ToggleField
                  field={extendedSpecificationRef}
                  location={EXTENDED_SPECIFICATION_LOCATION}
                  name="visUdvidetSpecifikation"
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Download specifikation</Typography>
              <Box className="row--label-right-hover__content">
                <DocumentDownloadButton
                  onClick={() => void download.download(undefined)}
                  disabled={!download.canDownload}
                  disabledReason={download.disabledReason}
                />
              </Box>
            </Box>

            {/*
              Gate-blokeringer står allerede i `EetIssuesBox` ovenfor (og skjuler denne boks helt), så de
              vises ikke igen her. Tilbage er stale-afbrud og DEV-serverfejl, som ellers var lydløse.
            */}
            <DocumentOutcomeMessage message={visibleDocumentFailureMessage(download)} />
          </ContentBox>

          {afgoerelser.map((afgoerelse) => {
            const viserGrundydelseNiveauSkift = visGrundydelseNiveauSkift(afgoerelse, computation.grundloenNiveau);
            const ingenLoebendeYdelse = afgoerelse.perioder.length === 0;
            return (
              <ContentBox key={afgoerelse.rowId} className="content-box">
                <Typography className="section-header">{`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)} (${formatPct(afgoerelse.eetPct)})`}</Typography>

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
                      <Typography className="row--text">{formatISOToDanish(afgoerelse.kapitaliseringsdato)}</Typography>
                    </Box>
                  </Box>
                )}

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Årsløn</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatKr(toKroner(computation.benyttetAarsloenOre))}</Typography>
                  </Box>
                </Box>

                <Typography className="row--subheading">Periodeafgrænsning</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Afgørelsesdato</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatISOToDanish(afgoerelse.afgoerelsesdato)}</Typography>
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Virkningsdato</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatISOToDanish(afgoerelse.virkningsdato)}</Typography>
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
                    <Typography className="row--text">{formatISOToDanish(afgoerelse.ophoerDato)}</Typography>
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
                  <HoverRow text="Frem til 1. januar 2024 beregnes grundydelsen i 2003-niveau og derefter i 2024-niveau." />
                )}
                {ingenLoebendeYdelse && (
                  <HoverRow text="Afgørelsen giver ingen løbende ydelse i den valgte periode." />
                )}

                {!ingenLoebendeYdelse && (
                  <StandardDisplayTable
                    columns={YDELSER_TABLE_COLUMNS}
                    rows={[
                      ...afgoerelse.perioder.map((row): StandardDisplayTableRow => ({
                        key: `${row.fra}-${row.til}-${row.satsAar}`,
                        cells: [
                          formatISOToDanish(row.fra),
                          formatISOToDanish(row.til),
                          formatMaaneder(row.maanederPraecis),
                          formatKr(toKroner(row.grundydelseAfrundetOre), 2),
                          formatRegulering(row.reguleringPct),
                          formatKr(toKroner(row.maanedligYdelseOre)),
                          formatKr(toKroner(row.beregnetEetOre)),
                        ],
                      })),
                      {
                        key: `${afgoerelse.rowId}-i-alt`,
                        cells: ['I alt', '', '', '', '', '', formatKr(toKroner(afgoerelse.iAltBeregnetEetOre))],
                        rowSx: { '& .MuiTableCell-root': { fontWeight: 700 } },
                      },
                    ]}
                  />
                )}
              </ContentBox>
            );
          })}

          <ContentBox className="content-box">
            <Typography className="section-header">Udvidet specifikation</Typography>

            <Typography className="row--subheading">Årsløn</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">ASL-årsløn</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(toKroner(computation.benyttetAarsloenOre))}</Typography>
              </Box>
            </Box>

            <Typography className="row--subheading">Grundløn</Typography>

            {computation.grundloenNiveau === '2003' ? (
              <>
                <HoverRow text="Skaden er sket før 1. juli 2024, og grundlønnen beregnes derfor i 2003-niveau." />
                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    {`Årsløn × (Maks. årsløn 1/1-2003 / Maks. årsløn ${formatSkadedatoCompact(computation.skadedato)}) = ${formatKr(toKroner(computation.benyttetAarsloenOre))} × (${formatAsAmount(ASL_MAX_AARSLOEN_2003, 0)} / ${formatAsAmount(toKroner(computation.maxAarsloenISkadesaarOre), 0)}) =`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatKr(toKroner(computation.grundloenOre))}</Typography>
                  </Box>
                </Box>
              </>
            ) : (
              <>
                <HoverRow text="Skaden er sket fra 1. juli 2024, og grundlønnen beregnes derfor i 2024-niveau." />
                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    {`Årsløn × (Maks. årsløn 1/1-2024 / Maks. årsløn ${formatSkadedatoCompact(computation.skadedato)}) = ${formatKr(toKroner(computation.benyttetAarsloenOre))} × (${formatAsAmount(ASL_MAX_AARSLOEN_2024, 0)} / ${formatAsAmount(toKroner(computation.maxAarsloenISkadesaarOre), 0)}) =`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatKr(toKroner(computation.grundloenOre))}</Typography>
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
                <HoverRow text="Der trækkes ikke AM-bidrag fra årslønnen." />
              </>
            )}

            {afgoerelser.map((afgoerelse) => {
              const reguleringFoer2024Pct = computation.reguleringFoer2024Pct;
              const reguleringFoer2024FaktorTekst = formatAsAmount(
                roundByMethod(1 + reguleringFoer2024Pct / 100, 3, 'halfAwayFromZero'),
                3
              );
              const { show2024ConversionBlock, hasRestAfterKapBefore2024, showRest2003, showRest2024 } =
                resolveLoebendeAfgoerelseRestVisning(afgoerelse, computation.grundloenNiveau);
              const showSplitHeading = show2024ConversionBlock;
              const restEetExpression = `${formatPctTal(afgoerelse.eetPctFoerAktuelKap)} - ${formatPct(
                afgoerelse.kapPctAktuel
              )} = ${formatPct(afgoerelse.restEetPct)}`;
              const restTextPrefix =
                afgoerelse.kapitaliseringsdato !== null
                  ? `Resterende EET (${restEetExpression}) efter kapitalisering ${formatISOToDanish(afgoerelse.kapitaliseringsdato)}`
                  : 'Resterende EET efter kapitalisering';
              const grundydelseFormula =
                computation.erstatningsniveauPct === 83
                  ? `Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag) = ${formatKr(toKroner(computation.grundloenOre))} × ${formatEetFormulaFactor(afgoerelse.eetPct, afgoerelse.priorKapPct)} × 83 % × 92 % =`
                  : `Grundløn × EET × Erstatningsniveau = ${formatKr(toKroner(computation.grundloenOre))} × ${formatEetFormulaFactor(afgoerelse.eetPct, afgoerelse.priorKapPct)} × 80 % =`;

              const primaryGrundydelse =
                computation.grundloenNiveau === '2024'
                  ? afgoerelse.grundydelse2024FuldOre
                  : afgoerelse.grundydelseFuldOre;
              const restGrundydelse2003 = afgoerelse.grundydelseRestOre ?? afgoerelse.grundydelseFuldOre;
              const restGrundydelse2024 = afgoerelse.grundydelse2024RestOre ?? afgoerelse.grundydelse2024FuldOre;
              const grundydelse2003BaseFor2024 = hasRestAfterKapBefore2024
                ? restGrundydelse2003
                : afgoerelse.grundydelseFuldOre;
              const grundydelse2024Result = hasRestAfterKapBefore2024
                ? restGrundydelse2024
                : afgoerelse.grundydelse2024FuldOre;

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

                  <HoverRow underlined
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
                      <Typography className="row--text">{formatKr(toKroner(primaryGrundydelse), 2)}</Typography>
                    </Box>
                  </Box>
                  {showRest2003 && (
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">
                        {restTextPrefix}
                      </Typography>
                      <Box className="row--label-right-hover__content">
                        <Typography className="row--text">{formatKr(toKroner(restGrundydelse2003), 2)}</Typography>
                      </Box>
                    </Box>
                  )}

                  {showSplitHeading && (
                    <>
                      <HoverRow underlined text="Grundydelse fra 1. januar 2024" />
                      <Box className="row--label-right-hover">
                        <Typography className="row--text">{`Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ ${formatPct(reguleringFoer2024Pct)}): ${formatKr(toKroner(grundydelse2003BaseFor2024), 2)} × ${reguleringFoer2024FaktorTekst} =`}</Typography>
                        <Box className="row--label-right-hover__content">
                          <Typography className="row--text">{formatKr(toKroner(grundydelse2024Result), 2)}</Typography>
                        </Box>
                      </Box>
                      {showRest2024 && (
                        <Box className="row--label-right-hover">
                          <Typography className="row--text">
                            {restTextPrefix}
                          </Typography>
                          <Box className="row--label-right-hover__content">
                            <Typography className="row--text">{formatKr(toKroner(restGrundydelse2024), 2)}</Typography>
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
