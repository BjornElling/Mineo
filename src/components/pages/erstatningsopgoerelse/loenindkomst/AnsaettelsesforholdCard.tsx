import { Box, IconButton, MenuItem, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/Delete';
import Download from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import StyledTextField from '../../../inputs/StyledTextField';
import StyledDateField from '../../../inputs/StyledDateField';
import StyledDropdown, { type StyledDropdownChangeEvent } from '../../../inputs/StyledDropdown';
import StyledAmountField from '../../../inputs/StyledAmountField';
import StyledPercentField from '../../../inputs/StyledPercentField';
import StyledRadioButton from '../../../inputs/StyledRadioButton';
import StyledToggleSwitch from '../../../inputs/StyledToggleSwitch';
import StyledIntegerField from '../../../inputs/StyledIntegerField';
import StandardLoenTable from '../../../tables/StandardLoenTable';
import LoenudviklingManuelTable from '../../../tables/LoenudviklingManuelTable';
import LoenudviklingManuelProcentsatsTable from '../../../tables/LoenudviklingManuelProcentsatsTable';
import { CellInvalidDraftScopeProvider } from '../../../../contexts/CellInvalidDraftScopeContext';
import { CELL_TABLE_IDS } from '../../../../config/cellInvalidDraftScopes';
import FloatingActionButton from '../../../ui/FloatingActionButton';
import ContentBox from '../../../layout/ContentBox';
import {
  krlSatstabelEnum,
  offentligLoenTypeEnum,
  type ErstatningsopgoerelseValues,
} from '../../../../schemas/formSchemas';
import { LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../../../types/loen';
import { resolveSatserHeading } from './resolveSatserHeading';
import {
  resolveAnvendtReguleringsdatoReference,
  resolveSkadeEllerAnmeldelsesdatoReference,
} from '../../../../domain/erstatningsopgoerelse/helpers/eoDateReferenceText';
import { amountValueToNumber } from '../../../../utils/expressionAmount';
import {
  getOverenskomstMetaById,
  getOverenskomstSfggPolicy,
  getReguleringsDatoIntervalForOverenskomst,
  isOffentligOverenskomstId,
} from '../../../../data/overenskomstRates';
import {
  ASL_AARSLOENSMAKSIMUM_MODEL_LABEL,
  getReguleringsDatoIntervalForStatistikModel,
} from '../../../../data/statistiskeRates';
import { getReguleringsDatoIntervalForKRL, type KRLSatstabelId } from '../../../../data/krlRates';
import { getReguleringsDatoIntervalForKlLoenaftaler } from '../../../../data/klLoenaftaler';
import { isOverenskomstSatsFieldLocked } from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstSatser';
import { hasSfggSelectedOverenskomst } from '../../../../domain/erstatningsopgoerelse/engines/sygeferiegodtgoerelseKilde';
import { DAY_COUNT_MAX } from '../../../../schemas/formSchemas/baseSchemas';
import { getDayAfterIso } from '../../../../utils/isoDateHelpers';
import SygeferiegodtgoerelseSection from './SygeferiegodtgoerelseSection';
import { useLoenindkomstVm } from './loenindkomstContext';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

type ReguleringsDatoInterval = Readonly<{ fraDato: string; tilDato: string }>;

const EMPTY_CELL_ERROR_MESSAGES: Readonly<Record<string, string>> = {};

const getCheckedJaNej = (value: 'Ja' | 'Nej'): boolean => value === 'Ja';

const formatReguleringsDatoInterval = (interval?: { fraDato: string; tilDato: string }): string => {
  if (!interval) return '';
  return `${interval.fraDato} - ${interval.tilDato}`;
};

const getOffentligLoenEkstraGrundloenSuffix = (
  offentligLoenType: Ansaettelsesforhold['offentligLoenType']
): string => (offentligLoenType === 'Timeløn' ? '/ time' : '/ måned');

const LOCKED_SATS_FIELD_SX = { width: '100px' } as const;

type Props = Readonly<{
  af: Ansaettelsesforhold;
  index: number;
}>;

/**
 * Ét ansættelsesforhold-kort på Loenindkomst-fanen. Forbruger den delte view-model via
 * `useLoenindkomstVm()` (jf. A1 — ingen prop-boring); kun de per-række-værdier `af` og `index`
 * gives som props. Adfærdsbevarende: markup'en er flyttet uændret ud af `LoenindkomstTab`'s
 * tidligere inline-`.map`-krop.
 */
export default function AnsaettelsesforholdCard({ af, index }: Props) {
  const {
    beregnesUdFra,
    tafBeregningsperiodeTil,
    sfggSixMonthWarningEmploymentIds,
    onNavigateToTabtArbejdsfortjeneste,
    skadedato,
    skadestype,
    satsErrors,
    manualBaseRowErrorsByAfId,
    aarsloenExternalCellErrorMessagesByAfId,
    loentrinFinder,
    alleLoenmodtagerOrg,
    alleArbejdsgiverOrg,
    satserByAfId,
    derivedCalculatorByAfId,
    tableDataChangeByAfId,
    validationChangeByAfId,
    totalAnsaettelsesforhold,
    cannotAddMore,
    showDeleteButton,
    setAddDialogOpen,
    setDeleteDialogOpen,
    setDeleteTargetId,
    getAnvendtReguleringsdatoForAnsaettelsesforhold,
    getSfggReferenceperiodeAvailability,
    getLoenudviklingBaseDate,
    isOffentligLoenSelectionReady,
    resolveOverenskomstLabel,
    getFilteredOverenskomsterForAnsaettelsesforhold,
    showSygeferiegodtgoerelseSection: showSygeferiegodtgoerelseSectionFor,
    getSfggRowForAf,
    firstTafFraDato,
    sfggReferenceperiodeMaxDate,
    updateSfggAnsaettelsesforhold,
    handleTextCommit,
    handleToggleChange,
    handleOverenskomstChange,
    handleOffentligLoenTypeChange,
    handleOffentligLoenTrinCommit,
    handleOffentligLoenGruppeCommit,
    handleOffentligLoenEkstraGrundloenCommit,
    handleSidsteArbejdsdagCommit,
    handleSaerligFraDatoReguleringCommit,
    handleAnciennitetstillaegDatoCommit,
    handleAnciennitetstillaegSatsAngivesPerChange,
    handleAnciennitetstillaegSatsCommit,
    handleFeriePctCommit,
    handleValidatedSatsCommit,
    handleLoenperiodeChange,
    handleTillaegAngivesSomChange,
    handleFuldLoenUnderFerieChange,
    handleLoenPaaHelligdageChange,
    handleLoenudviklingBeregningsgrundlagChange,
    handleLoenudviklingStatistikModelChange,
    handleLoenudviklingKRLSatstabelChange,
    handleLoenudviklingManuelTableChange,
    handleLoenudviklingManuelProcentsatsTableChange,
    handleManuelReguleringInputErrorChange,
    handleFilterChange,
    handleMoveUp,
    handleMoveDown,
    handleDownloadReguleringPdf,
    handleDownloadKRLPdf,
    handleDownloadKlLoenaftalerPdf,
  } = useLoenindkomstVm();
  const { openLoentrinFinder } = loentrinFinder;

  const showOverenskomst = af.harOverenskomst;
  const showMedlemOpsagt = af.ansatPaaSkadestidspunktet;
  const showSidsteArbejdsdag = showMedlemOpsagt && af.ansaettelsesforholdOphoert;
  const isLastAnsaettelsesforhold = index === totalAnsaettelsesforhold - 1;
  const displayNumber = index + 1;
  const anvendtReguleringsdato = getAnvendtReguleringsdatoForAnsaettelsesforhold(af);
  const anciennitetstillaegMinDato = getDayAfterIso(anvendtReguleringsdato);
  const skadeEllerAnmeldelsesdato = resolveSkadeEllerAnmeldelsesdatoReference(skadestype);
  const satserHeading = resolveSatserHeading({
    anvendtReguleringsdato,
    skadedato: skadedato,
    skadestype: skadestype,
    beregnesUdFra,
    beregningsperiodeTil: tafBeregningsperiodeTil,
    saerligFraDatoRegulering: af.saerligFraDatoRegulering,
  });
  const loenudviklingBasis = af.loenudviklingBeregningsgrundlag;
  const fritvalgLocked = isOverenskomstSatsFieldLocked(af, anvendtReguleringsdato, 'fritvalgPct');
  const shSoLocked = isOverenskomstSatsFieldLocked(af, anvendtReguleringsdato, 'shSoPct');
  const pensionLocked = isOverenskomstSatsFieldLocked(af, anvendtReguleringsdato, 'pensionPct');
  const erOffentligOverenskomst = Boolean(
    af.overenskomstId && isOffentligOverenskomstId(af.overenskomstId)
  );
  const loenudviklingBaseDate = getLoenudviklingBaseDate(af);
  const anciennitetSatsPerTekst = af.anciennitetstillaegSatsAngivesPer === 'Time' ? 'time' : 'måned';
  const showAnciennitetstillaegSection = beregnesUdFra === 'Beregningsperiode'
    && loenudviklingBasis === 'Overenskomst'
    && Boolean(af.overenskomstId?.trim());
  const shouldShowReguleringsDatoInterval =
    loenudviklingBasis === 'Overenskomst' ||
    (loenudviklingBasis === 'Statistik' && Boolean(af.loenudviklingStatistikModel)) ||
    (loenudviklingBasis === 'KRL satstabel' && Boolean(af.loenudviklingKRLSatstabel)) ||
    loenudviklingBasis === 'KL-lønaftaler';

  const reguleringsDatoIntervalData: ReguleringsDatoInterval | undefined = (() => {
    if (!shouldShowReguleringsDatoInterval) return undefined;
    if (loenudviklingBasis === 'Overenskomst') {
      return getReguleringsDatoIntervalForOverenskomst(af.overenskomstId ?? '');
    }
    if (loenudviklingBasis === 'Statistik') {
      return getReguleringsDatoIntervalForStatistikModel(af.loenudviklingStatistikModel ?? '');
    }
    if (loenudviklingBasis === 'KRL satstabel' && af.loenudviklingKRLSatstabel) {
      return getReguleringsDatoIntervalForKRL(af.loenudviklingKRLSatstabel as KRLSatstabelId);
    }
    if (loenudviklingBasis === 'KL-lønaftaler') {
      return getReguleringsDatoIntervalForKlLoenaftaler();
    }
    return undefined;
  })();
  const reguleringsDatoInterval = formatReguleringsDatoInterval(reguleringsDatoIntervalData);
  const hasReguleringsDatoInterval =
    Boolean(reguleringsDatoIntervalData?.fraDato) && Boolean(reguleringsDatoIntervalData?.tilDato);

  const baseHeaderText = `Ansættelsesforhold ${displayNumber}`;

  const headerText = af.navnPaaArbejdssted
    ? `${baseHeaderText} (${af.navnPaaArbejdssted})`
    : baseHeaderText;
  const showSygeferiegodtgoerelseSection = showSygeferiegodtgoerelseSectionFor(af);
  const sfggRow = getSfggRowForAf(af);
  const sfggPolicy = af.overenskomstId
    ? getOverenskomstSfggPolicy(af.overenskomstId)
    : undefined;
  const sfggOverenskomstMeta = af.overenskomstId
    ? getOverenskomstMetaById(af.overenskomstId)
    : undefined;
  const hasSfggOverenskomst = hasSfggSelectedOverenskomst(sfggRow, af);
  const sfggSelectedOverenskomstLabel = hasSfggOverenskomst
    ? (sfggOverenskomstMeta?.navn ?? af.overenskomstId!.trim())
    : 'Ingen overenskomst valgt';
  const canShowSfggOverenskomstDetails =
    sfggRow?.sfggBeregningskilde !== 'Overenskomst' || hasSfggOverenskomst;
  const requiresReferenceperiode =
    sfggRow?.sfggBeregningskilde === 'Ferieloven'
    || (
      sfggRow?.sfggBeregningskilde === 'Overenskomst'
      && hasSfggOverenskomst
      && sfggPolicy?.model !== 'direkte_sats'
    );
  const showSatsvalg =
    sfggRow?.sfggBeregningskilde === 'Overenskomst'
    && hasSfggOverenskomst
    && sfggPolicy?.model === 'direkte_sats'
    && sfggPolicy.direkteSatsErDifferentieret;
  const referenceperiodeAvailability = getSfggReferenceperiodeAvailability(af, sfggRow);
  const referenceperiodeErrorText = referenceperiodeAvailability.hasNoRelevantDaysError
    ? referenceperiodeAvailability.dayLabel === 'kalenderdage'
      ? 'Referenceperioden indeholder ingen kalenderdage.'
      : 'Referenceperioden indeholder ingen arbejdsdage.'
    : '';
  const sfggReferenceperiodeFravaersdageMax = Math.min(
    referenceperiodeAvailability.maxFravaersdage ?? DAY_COUNT_MAX,
    DAY_COUNT_MAX
  );
  const showSharedSfggBefore2015 = Boolean(
    skadedato && skadedato < '2015-01-01'
  );
  const showSfggSixMonthWarning = sfggSixMonthWarningEmploymentIds.includes(af.id);

  return (
    <ContentBox
      className="content-box"
      data-mineo-row-id={af.id}
      sx={{ position: 'relative', marginBottom: isLastAnsaettelsesforhold ? '60px' : '40px' }}
    >
      <Typography className="section-header">{headerText}</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Navn på arbejdssted</Typography>
        <Box className="row--label-right-hover__content">
          <StyledTextField
            name={`${af.id}:navnPaaArbejdssted`}
            width={300}
            value={af.navnPaaArbejdssted || ''}
            onCommit={handleTextCommit(af.id, 'navnPaaArbejdssted')}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">{`Ansat på ${skadeEllerAnmeldelsesdato.labelLower}`}</Typography>
        <Box className="row--label-right-hover__content">
          <StyledToggleSwitch
            name={`${af.id}:ansatPaaSkadestidspunktet`}
            checked={af.ansatPaaSkadestidspunktet}
            onCommit={handleToggleChange(af.id, 'ansatPaaSkadestidspunktet')}
          />
        </Box>
      </Box>

      {showMedlemOpsagt ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Opsagt fra stillingen</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name={`${af.id}:ansaettelsesforholdOphoert`}
              checked={af.ansaettelsesforholdOphoert}
              onCommit={handleToggleChange(af.id, 'ansaettelsesforholdOphoert')}
            />
          </Box>
        </Box>
      ) : null}

      <Box sx={{ display: showSidsteArbejdsdag ? 'block' : 'none' }}>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Sidste dag i ansættelsesforholdet</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDateField name={`${af.id}:sidsteArbejdsdag`} value={af.sidsteArbejdsdag} onCommit={handleSidsteArbejdsdagCommit(af.id)} />
          </Box>
        </Box>
      </Box>

      <Typography className="row--subheading">Lønforhold</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Overenskomst</Typography>
        <Box className="row--label-right-hover__content">
          <StyledToggleSwitch name={`${af.id}:harOverenskomst`} checked={af.harOverenskomst} onCommit={handleToggleChange(af.id, 'harOverenskomst')} />
        </Box>
      </Box>

      <Box sx={{ display: showOverenskomst ? 'block' : 'none' }}>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Vælg overenskomst</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Lønmodtager filter dropdown - UI viser 'ALLE', domæne bruger undefined */}
              <Typography sx={{ fontSize: '11px', lineHeight: '24px' }}>L:</Typography>
              <StyledDropdown
                name={`${af.id}:overenskomstFilter.loenmodtager`}
                value={af.overenskomstFilter.loenmodtager ?? 'ALLE'}
                onChange={(e: StyledDropdownChangeEvent<string>) => {
                  const uiValue = e.target.value;
                  // Normalisér UI-værdi → domæne-værdi i dropdown-laget
                  handleFilterChange(af.id, 'loenmodtager', uiValue === 'ALLE' ? undefined : uiValue);
                }}
                width={120}
                allowEmpty={false}
                sx={{
                  '& .MuiInputBase-root': {
                    height: '24px !important',
                    minHeight: '24px !important',
                    paddingRight: '20px !important',
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '11px !important',
                    padding: '0 4px 0 8px !important',
                    lineHeight: '24px',
                  },
                  '& .MuiSvgIcon-root': {
                    fontSize: '12px !important',
                  },
                }}
                iconSx={{
                  fontSize: '16px',
                  right: 2,
                }}
                optionSx={{
                  fontSize: '11px',
                  minHeight: '24px',
                  padding: '3px 8px',
                }}
              >
                <MenuItem value="ALLE">Alle</MenuItem>
                {alleLoenmodtagerOrg.map((org) => (
                  <MenuItem key={org} value={org}>
                    {org}
                  </MenuItem>
                ))}
              </StyledDropdown>

              {/* Arbejdsgiver filter dropdown - UI viser 'ALLE', domæne bruger undefined */}
              <Typography sx={{ fontSize: '11px', lineHeight: '24px' }}>A:</Typography>
              <StyledDropdown
                name={`${af.id}:overenskomstFilter.arbejdsgiver`}
                value={af.overenskomstFilter.arbejdsgiver ?? 'ALLE'}
                onChange={(e: StyledDropdownChangeEvent<string>) => {
                  const uiValue = e.target.value;
                  // Normalisér UI-værdi → domæne-værdi i dropdown-laget
                  handleFilterChange(af.id, 'arbejdsgiver', uiValue === 'ALLE' ? undefined : uiValue);
                }}
                width={120}
                allowEmpty={false}
                sx={{
                  '& .MuiInputBase-root': {
                    height: '24px !important',
                    minHeight: '24px !important',
                    paddingRight: '20px !important',
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '11px !important',
                    padding: '0 4px 0 8px !important',
                    lineHeight: '24px',
                  },
                  '& .MuiSvgIcon-root': {
                    fontSize: '12px !important',
                  },
                }}
                iconSx={{
                  fontSize: '16px',
                  right: 2,
                }}
                optionSx={{
                  fontSize: '11px',
                  minHeight: '24px',
                  padding: '3px 8px',
                }}
              >
                <MenuItem value="ALLE">Alle</MenuItem>
                {alleArbejdsgiverOrg.map((org) => (
                  <MenuItem key={org} value={org}>
                    {org}
                  </MenuItem>
                ))}
              </StyledDropdown>

              <StyledDropdown
                name={`${af.id}:overenskomstId`}
                value={af.overenskomstId || undefined}
                onChange={handleOverenskomstChange(af.id)}
                width={460}
                placeholder="Vælg overenskomst..."
                allowEmpty={true}
                getOptionLabel={(id) => {
                  const asString = typeof id === 'string' ? id : String(id);
                  const meta = getOverenskomstMetaById(asString);
                  if (!meta) return asString;
                  const loenPart = meta.loenmodtagerOrg[0] || '';
                  const arbPart = meta.arbejdsgiverOrg[0] || '';
                  return `${meta.navn} (${loenPart} / ${arbPart})`;
                }}
              >
                {getFilteredOverenskomsterForAnsaettelsesforhold(af).map((meta) => {
                  const loenPart = meta.loenmodtagerOrg[0] || '';
                  const arbPart = meta.arbejdsgiverOrg[0] || '';
                  return (
                    <MenuItem key={meta.id} value={meta.id}>
                      {meta.navn} ({loenPart} / {arbPart})
                    </MenuItem>
                  );
                })}
              </StyledDropdown>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Fuld løn under ferie:</Typography>
        <Box className="row--label-right-hover__content">
          <StyledToggleSwitch
            name={`${af.id}:fuldLoenUnderFerie`}
            checked={getCheckedJaNej(af.fuldLoenUnderFerie)}
            onCommit={handleFuldLoenUnderFerieChange(af.id)}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Løn på helligdage:</Typography>
        <Box className="row--label-right-hover__content">
          <StyledDropdown
            name={`${af.id}:loenPaaHelligdage`}
            width={185}
            value={af.loenPaaHelligdage}
            onChange={handleLoenPaaHelligdageChange(af.id)}
            allowEmpty={false}
          >
            <MenuItem value="Almindelig løn">Almindelig løn</MenuItem>
            <MenuItem value="SH-udbetaling">SH-udbetaling</MenuItem>
            <MenuItem value="Ingen">Ingen</MenuItem>
          </StyledDropdown>
        </Box>
      </Box>

      {beregnesUdFra === 'Beregningsperiode' && (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. særlig fra-dato for regulering</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDateField
              name={`${af.id}:saerligFraDatoRegulering`}
              value={af.saerligFraDatoRegulering}
              onCommit={handleSaerligFraDatoReguleringCommit(af.id)}
            />
          </Box>
        </Box>
      )}

      <Box className="row--label-right-hover">
        <Typography className="row--text">Løn indtastes som:</Typography>
        <Box className="row--label-right-hover__content">
          <StyledRadioButton
            name={`${af.id}:loenperiode`}
            value={af.loenperiode}
            onChange={handleLoenperiodeChange(af.id)}
            row={true}
            options={[
              { value: LOENPERIODE.MAANED, label: 'Måned' },
              { value: LOENPERIODE.UGE, label: 'Uge' },
              { value: LOENPERIODE.DAG, label: 'Dato' },
            ]}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Tillæg angives som</Typography>
        <Box className="row--label-right-hover__content">
          <StyledDropdown
            name={`${af.id}:tillaegAngivesSom`}
            width={185}
            value={af.tillaegAngivesSom}
            onChange={handleTillaegAngivesSomChange(af.id)}
            allowEmpty={false}
          >
            <MenuItem value={TILLAEG_ANGIVES_SOM.PROCENT}>Procent</MenuItem>
            <MenuItem value={TILLAEG_ANGIVES_SOM.BELOEB}>Beløb</MenuItem>
          </StyledDropdown>
        </Box>
      </Box>

      {af.tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB ? (
        <>
          <Typography className="row--subheading">{satserHeading}</Typography>

          {/* Første række: 3 felter */}
          <Box className="row--label-right-hover">
            <Box
              sx={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '160px' }}>
                  Feriegodtgørelse/-tillæg:
                </Typography>
                <StyledPercentField
                  name={`${af.id}:feriePct`}
                  value={af.feriePct}
                  onCommit={handleFeriePctCommit(af.id)}
                  placeholder="0"
                  useDefaultPercentRange
                  error={Boolean(satsErrors[af.id]?.feriePct)}
                  helperText={satsErrors[af.id]?.feriePct}
                  sx={{ width: '100px' }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '60px' }}>Fritvalg:</Typography>
                <StyledPercentField
                  name={`${af.id}:fritvalgPct`}
                  value={af.fritvalgPct}
                  onCommit={handleValidatedSatsCommit(af.id, 'fritvalgPct')}
                  placeholder="0"
                  useDefaultPercentRange
                  disabled={fritvalgLocked}
                  disabledAppearance={fritvalgLocked ? 'locked' : 'default'}
                  error={Boolean(satsErrors[af.id]?.fritvalgPct)}
                  helperText={satsErrors[af.id]?.fritvalgPct}
                  sx={LOCKED_SATS_FIELD_SX}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '140px' }}>
                  SH/SO-sats:
                </Typography>
                <StyledPercentField
                  name={`${af.id}:shSoPct`}
                  value={af.shSoPct}
                  onCommit={handleValidatedSatsCommit(af.id, 'shSoPct')}
                  placeholder="0"
                  useDefaultPercentRange
                  disabled={shSoLocked}
                  disabledAppearance={shSoLocked ? 'locked' : 'default'}
                  error={Boolean(satsErrors[af.id]?.shSoPct)}
                  helperText={satsErrors[af.id]?.shSoPct}
                  sx={LOCKED_SATS_FIELD_SX}
                />
              </Box>
            </Box>
          </Box>

          {/* Anden række: 2 felter */}
          <Box className="row--label-right-hover">
            <Box
              sx={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '160px' }}>
                  Store Bededagstillæg:
                </Typography>
                <StyledPercentField
                  name={`${af.id}:storeBededagPct`}
                  value={af.storeBededagPct}
                  onCommit={undefined}
                  placeholder="0"
                  useDefaultPercentRange
                  disabled
                  disabledAppearance="locked"
                  error={Boolean(satsErrors[af.id]?.storeBededagPct)}
                  helperText={satsErrors[af.id]?.storeBededagPct}
                  sx={LOCKED_SATS_FIELD_SX}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '190px' }}>
                  Arbejdsgivers pensionsbidrag:
                </Typography>
                <StyledPercentField
                  name={`${af.id}:pensionPct`}
                  value={af.pensionPct}
                  onCommit={handleValidatedSatsCommit(af.id, 'pensionPct')}
                  placeholder="0"
                  useDefaultPercentRange
                  disabled={pensionLocked}
                  disabledAppearance={pensionLocked ? 'locked' : 'default'}
                  error={Boolean(satsErrors[af.id]?.pensionPct)}
                  helperText={satsErrors[af.id]?.pensionPct}
                  sx={LOCKED_SATS_FIELD_SX}
                />
              </Box>
            </Box>
          </Box>
        </>
      ) : null}

      <Typography className="row--subheading">Indtægtsoplysninger</Typography>

      <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoStandardLoen} rowScope={af.id}>
      <StandardLoenTable
        loenperiode={af.loenperiode}
        tillaegAngivesSom={af.tillaegAngivesSom}
        satser={satserByAfId.get(af.id)!}
        tableData={af.indtaegtsoplysningerTableData}
        onTableDataChange={tableDataChangeByAfId.get(af.id)}
        onValidationChange={validationChangeByAfId.get(af.id)}
        externalCellErrorMessagesByCellKey={aarsloenExternalCellErrorMessagesByAfId[af.id] ?? EMPTY_CELL_ERROR_MESSAGES}
        useSmallFont={true}
        saveOrderPath={`erstatningsopgoerelse.ansaettelsesforhold.${index}.indtaegtsoplysningerTableData`}
        calculateDerivedRow={derivedCalculatorByAfId.get(af.id)}
      />
      </CellInvalidDraftScopeProvider>

      {beregnesUdFra === 'Beregningsperiode' ? (
        <>
      <Typography className="row--subheading">Lønudvikling</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Lønudvikling beregnes ud fra</Typography>
        <Box className="row--label-right-hover__content">
          <StyledDropdown
            name={`${af.id}:loenudviklingBeregningsgrundlag`}
            width={220}
            value={loenudviklingBasis}
            onChange={handleLoenudviklingBeregningsgrundlagChange(af.id)}
            allowEmpty={true}
            placeholder="Vælg..."
          >
            <MenuItem value="Overenskomst">Overenskomst</MenuItem>
            <MenuItem value="Statistik">Statistik</MenuItem>
            <MenuItem value="KRL satstabel">KRL satstabel</MenuItem>
            <MenuItem value="KL-lønaftaler">KL-lønaftaler</MenuItem>
            <StyledDropdown.Divider />
            <MenuItem value="Manuelt angivet">Manuelt angivet</MenuItem>
            <MenuItem value="Manuel procentsats">Manuel procentsats</MenuItem>
            <StyledDropdown.Divider />
            <MenuItem value="Ingen">Ingen</MenuItem>
          </StyledDropdown>
        </Box>
      </Box>

      {loenudviklingBasis === 'Overenskomst' ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Overenskomst</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text">{resolveOverenskomstLabel(af.overenskomstId)}</Typography>
          </Box>
        </Box>
      ) : null}

      {loenudviklingBasis === 'Overenskomst' && erOffentligOverenskomst ? (
        <>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Lønoplysninger</Typography>
            <Box className="row--label-right-hover__content">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography className="row--text">Ansættelse</Typography>
                <StyledDropdown
                  name={`${af.id}:offentligLoenType`}
                  width={160}
                  value={af.offentligLoenType ?? 'Månedsløn'}
                  onChange={handleOffentligLoenTypeChange(af.id)}
                  allowEmpty={false}
                >
                  {offentligLoenTypeEnum.options.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </StyledDropdown>
                <Typography className="row--text">Løntrin</Typography>
                <StyledIntegerField
                  name={`${af.id}:offentligLoenTrin`}
                  value={af.offentligLoenTrin}
                  onCommit={handleOffentligLoenTrinCommit(af.id)}
                  minValue={1}
                  maxValue={55}
                  maxDigits={2}
                  width={80}
                />
                <Typography className="row--text">Gruppe</Typography>
                <StyledIntegerField
                  name={`${af.id}:offentligLoenGruppe`}
                  value={af.offentligLoenGruppe}
                  onCommit={handleOffentligLoenGruppeCommit(af.id)}
                  minValue={0}
                  maxValue={4}
                  maxDigits={1}
                  width={70}
                />
                <Tooltip title="Find løntrin" arrow>
                  <IconButton
                    onClick={() => openLoentrinFinder(af)}
                    tabIndex={-1}
                    aria-label="Find løntrin"
                    sx={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      transition: 'background-color 0.2s',
                      '&:hover': {
                        backgroundColor: 'var(--color-icon-action-hover)',
                      },
                      '&:active': {
                        backgroundColor: 'var(--color-icon-action-active)',
                      },
                    }}
                  >
                    <SearchIcon
                      sx={{
                        fontSize: '24px',
                        color: 'primary.main',
                      }}
                    />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Evt. forhøjet grundløn udover løntrin</Typography>
            <Box className="row--label-right-hover__content">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StyledAmountField
                  name={`${af.id}:offentligLoenEkstraGrundloen`}
                  width={160}
                  value={af.offentligLoenEkstraGrundloen}
                  allowNegative={false}
                  onCommit={handleOffentligLoenEkstraGrundloenCommit(af.id)}
                />
                <Typography className="row--text">{getOffentligLoenEkstraGrundloenSuffix(af.offentligLoenType)}</Typography>
              </Box>
            </Box>
          </Box>
        </>
      ) : null}

      {loenudviklingBasis === 'Statistik' ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Statistisk beregningsmodel</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              name={`${af.id}:loenudviklingStatistikModel`}
              width={270}
              value={af.loenudviklingStatistikModel}
              onChange={handleLoenudviklingStatistikModelChange(af.id)}
              allowEmpty={true}
              placeholder="Vælg..."
            >
              <MenuItem value={ASL_AARSLOENSMAKSIMUM_MODEL_LABEL}>{ASL_AARSLOENSMAKSIMUM_MODEL_LABEL}</MenuItem>
              <MenuItem value="ILON12 (Danmarks Statistik)">ILON12 (Danmarks Statistik)</MenuItem>
              <MenuItem value="SBLON2 (Danmarks Statistik)">SBLON2 (Danmarks Statistik)</MenuItem>
            </StyledDropdown>
          </Box>
        </Box>
      ) : null}

      {loenudviklingBasis === 'KRL satstabel' ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Satstabel</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              name={`${af.id}:loenudviklingKRLSatstabel`}
              width={270}
              value={af.loenudviklingKRLSatstabel}
              onChange={handleLoenudviklingKRLSatstabelChange(af.id)}
              allowEmpty={true}
              placeholder="Vælg..."
            >
              {krlSatstabelEnum.options.map((satstabel) => (
                <MenuItem key={satstabel} value={satstabel}>
                  {satstabel}
                </MenuItem>
              ))}
            </StyledDropdown>
          </Box>
        </Box>
      ) : null}

      {loenudviklingBasis === 'Manuelt angivet' ? (
        <Box sx={{ mt: 1 }}>
          {(() => {
            const anvendtReguleringsdato = getAnvendtReguleringsdatoForAnsaettelsesforhold(af);
            const baseDateTooltipText =
              loenudviklingBaseDate.display === '' || !anvendtReguleringsdato
                ? undefined
                : resolveAnvendtReguleringsdatoReference({
                    anvendtReguleringsdato,
                    skadedato,
                    skadestype,
                    beregnesUdFra,
                    beregningsperiodeTil: tafBeregningsperiodeTil,
                    saerligFraDatoRegulering: af.saerligFraDatoRegulering,
                  }).label;
            return (
              <>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">Navn på reguleringsform</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledTextField
                      name={`${af.id}:loenudviklingManuelNavn`}
                      width={350}
                      value={af.loenudviklingManuelNavn || ''}
                      onCommit={handleTextCommit(af.id, 'loenudviklingManuelNavn')}
                    />
                  </Box>
                </Box>
                <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoLoenudvikling} rowScope={af.id}>
                <LoenudviklingManuelTable
                  tableData={af.loenudviklingManuelTableData}
                  onTableDataChange={handleLoenudviklingManuelTableChange(af.id)}
                  onInputErrorChange={handleManuelReguleringInputErrorChange(af.id)}
                  baseDateDisplay={loenudviklingBaseDate.display}
                  baseDateISO={loenudviklingBaseDate.iso}
                  baseDateErrorMessage={loenudviklingBaseDate.display === '' ? loenudviklingBaseDate.errorMessage : undefined}
                  baseDateInfoTooltipText={baseDateTooltipText}
                  baseRowPercentErrors={manualBaseRowErrorsByAfId[af.id]}
                  // Procent-tilstand spejler satsfelterne ovenfor. I Beløb-tilstand er de skjulte,
                  // og brugeren indtaster basisrækkens tillægsprocenter direkte i tabellen.
                  readOnlyBaseRowPercentFields={af.tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB}
                  useSmallFont={true}
                />
                </CellInvalidDraftScopeProvider>
              </>
            );
          })()}
        </Box>
      ) : null}

      {loenudviklingBasis === 'Manuel procentsats' ? (
        <Box sx={{ mt: 1 }}>
          {(() => {
            const anvendtReguleringsdato = getAnvendtReguleringsdatoForAnsaettelsesforhold(af);
            const baseDateTooltipText =
              loenudviklingBaseDate.display === '' || !anvendtReguleringsdato
                ? undefined
                : resolveAnvendtReguleringsdatoReference({
                    anvendtReguleringsdato,
                    skadedato,
                    skadestype,
                    beregnesUdFra,
                    beregningsperiodeTil: tafBeregningsperiodeTil,
                    saerligFraDatoRegulering: af.saerligFraDatoRegulering,
                  }).label;
            return (
              <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoLoenudviklingManuelProcentsats} rowScope={af.id}>
                <LoenudviklingManuelProcentsatsTable
                  tableData={af.loenudviklingManuelProcentsatsTableData}
                  onTableDataChange={handleLoenudviklingManuelProcentsatsTableChange(af.id)}
                  onInputErrorChange={handleManuelReguleringInputErrorChange(af.id)}
                  baseDateDisplay={loenudviklingBaseDate.display}
                  baseDateISO={loenudviklingBaseDate.iso}
                  baseDateErrorMessage={loenudviklingBaseDate.display === '' ? loenudviklingBaseDate.errorMessage : undefined}
                  baseDateInfoTooltipText={baseDateTooltipText}
                  useSmallFont={true}
                />
              </CellInvalidDraftScopeProvider>
            );
          })()}
        </Box>
      ) : null}

      {shouldShowReguleringsDatoInterval ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Tilgængelige reguleringssatser</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'flex-end', gap: 1 }}>
              {(() => {
                const offentligReady = isOffentligLoenSelectionReady(af);
                const canDownload =
                  hasReguleringsDatoInterval &&
                  (loenudviklingBasis !== 'Overenskomst' || !erOffentligOverenskomst || offentligReady);
                return (
                  <>
                    <Typography className="row--text" sx={{ textAlign: 'right' }}>
                      {reguleringsDatoInterval}
                    </Typography>
                    <Box>
                      <Box
                        onClick={() => {
                          if (!canDownload) return;
                          if (!reguleringsDatoIntervalData) return;
                          if (loenudviklingBasis === 'KRL satstabel') {
                            void handleDownloadKRLPdf();
                            return;
                          }
                          if (loenudviklingBasis === 'KL-lønaftaler') {
                            void handleDownloadKlLoenaftalerPdf();
                            return;
                          }
                          if (
                            loenudviklingBasis !== 'Overenskomst' &&
                            loenudviklingBasis !== 'Statistik'
                          ) {
                            return;
                          }
                          void handleDownloadReguleringPdf({
                            overenskomstLabel: resolveOverenskomstLabel(af.overenskomstId),
                            loenudviklingBasis,
                            overenskomstId: af.overenskomstId,
                            statistikModelLabel: af.loenudviklingStatistikModel,
                            interval: reguleringsDatoIntervalData,
                            applyAlmindeligLoenPaaShDageRegel: af.loenPaaHelligdage === 'Almindelig løn',
                            offentligLoenType: af.offentligLoenType,
                            offentligLoenTrin: af.offentligLoenTrin,
                            offentligLoenGruppe: af.offentligLoenGruppe,
                            offentligLoenEkstraGrundloen: amountValueToNumber(af.offentligLoenEkstraGrundloen),
                          });
                        }}
                        tabIndex={-1}
                        sx={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: canDownload ? 'pointer' : 'default',
                          transition: 'background-color 0.2s',
                          ...(canDownload && {
                            '&:hover': {
                              backgroundColor: 'var(--color-icon-action-hover)',
                            },
                            '&:active': {
                              backgroundColor: 'var(--color-icon-action-active)',
                            },
                          }),
                        }}
                      >
                        <Download
                          sx={{
                            fontSize: '24px',
                            color: canDownload ? 'primary.main' : 'grey.500',
                          }}
                        />
                      </Box>
                    </Box>
                  </>
                );
              })()}
            </Box>
          </Box>
        </Box>
      ) : null}
        </>
      ) : null}

      {showAnciennitetstillaegSection ? (
        <>
          <Typography className="row--subheading">Anciennitetstillæg</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Ville skadelidte have opnået anciennitetstillæg efter anvendt reguleringsdato</Typography>
            <Box className="row--label-right-hover__content">
              <StyledToggleSwitch
                name={`${af.id}:harAnciennitetstillaegEfterSkadedatoen`}
                checked={af.harAnciennitetstillaegEfterSkadedatoen}
                onCommit={handleToggleChange(af.id, 'harAnciennitetstillaegEfterSkadedatoen')}
              />
            </Box>
          </Box>

          {af.harAnciennitetstillaegEfterSkadedatoen ? (
            <>
              <Box className="row--label-right-hover">
                <Typography className="row--text">Dato for opnået anciennitetstillæg</Typography>
                <Box className="row--label-right-hover__content">
                  <StyledDateField
                    name={`${af.id}:anciennitetstillaegDato`}
                    value={af.anciennitetstillaegDato}
                    minDate={anciennitetstillaegMinDato}
                    specialRangeErrors={{
                      minBoundKind: anvendtReguleringsdato ? 'efterAnvendtReguleringsdato' : undefined,
                      minBoundReferenceISO: anvendtReguleringsdato,
                    }}
                    onCommit={handleAnciennitetstillaegDatoCommit(af.id)}
                  />
                </Box>
              </Box>

              <Box className="row--label-right-hover">
                <Typography className="row--text">Satsen angives per</Typography>
                <Box className="row--label-right-hover__content">
                  <StyledDropdown
                    name={`${af.id}:anciennitetstillaegSatsAngivesPer`}
                    width={160}
                    value={af.anciennitetstillaegSatsAngivesPer}
                    onChange={handleAnciennitetstillaegSatsAngivesPerChange(af.id)}
                    allowEmpty={false}
                  >
                    <MenuItem value="Time">Time</MenuItem>
                    <MenuItem value="Måned">Måned</MenuItem>
                  </StyledDropdown>
                </Box>
              </Box>

              <Box className="row--label-right-hover">
                <Typography className="row--text">{`Sats per ${anciennitetSatsPerTekst}`}</Typography>
                <Box className="row--label-right-hover__content">
                  <StyledAmountField
                    name={`${af.id}:anciennitetstillaegSats`}
                    width={160}
                    value={af.anciennitetstillaegSats}
                    allowNegative={false}
                    onCommit={handleAnciennitetstillaegSatsCommit(af.id)}
                  />
                </Box>
              </Box>
            </>
          ) : null}
        </>
      ) : null}

      <SygeferiegodtgoerelseSection
        show={showSygeferiegodtgoerelseSection}
        af={af}
        sfggRow={sfggRow}
        sfggPolicy={sfggPolicy}
        showSharedSfggBefore2015={showSharedSfggBefore2015}
        showSfggSixMonthWarning={showSfggSixMonthWarning}
        sfggSelectedOverenskomstLabel={sfggSelectedOverenskomstLabel}
        canShowSfggOverenskomstDetails={canShowSfggOverenskomstDetails}
        requiresReferenceperiode={requiresReferenceperiode}
        showSatsvalg={showSatsvalg}
        referenceperiodeErrorText={referenceperiodeErrorText}
        firstTafFraDato={firstTafFraDato}
        sfggReferenceperiodeMaxDate={sfggReferenceperiodeMaxDate}
        sfggReferenceperiodeFravaersdageMax={sfggReferenceperiodeFravaersdageMax}
        onNavigateToTabtArbejdsfortjeneste={onNavigateToTabtArbejdsfortjeneste}
        updateSfggAnsaettelsesforhold={updateSfggAnsaettelsesforhold}
      />

      {/* Handlingsknapper – flex-container der fylder ud fra højre */}
      <Box sx={{ position: 'absolute', bottom: -28, right: 44, display: 'flex', gap: '14px' }}>
        {isLastAnsaettelsesforhold && (
          <FloatingActionButton
            icon={<AddIcon />}
            color="primary"
            disabled={cannotAddMore}
            tooltip={cannotAddMore ? 'Maksimalt 10 ansættelsesforhold' : 'Tilføj nyt ansættelsesforhold'}
            shake={cannotAddMore}
            onClick={() => {
              setAddDialogOpen(true);
            }}
          />
        )}

        {/* Flyt op (kun synlig hvis >1 Ansættelsesforhold og ikke det første) */}
        {totalAnsaettelsesforhold > 1 && index > 0 && (
          <FloatingActionButton
            icon={<ArrowUpwardIcon />}
            color="primary"
            tooltip="Flyt ansættelsesforhold op"
            onClick={() => handleMoveUp(af.id)}
          />
        )}

        {/* Flyt ned (kun synlig hvis >1 Ansættelsesforhold og ikke det sidste) */}
        {totalAnsaettelsesforhold > 1 && !isLastAnsaettelsesforhold && (
          <FloatingActionButton
            icon={<ArrowDownwardIcon />}
            color="primary"
            tooltip="Flyt ansættelsesforhold ned"
            onClick={() => handleMoveDown(af.id)}
          />
        )}

        {/* Slet (kun synlig hvis der er mere end ét Ansættelsesforhold) */}
        {showDeleteButton && (
          <FloatingActionButton
            icon={<DeleteIcon />}
            color="error"
            tooltip="Slet ansættelsesforhold"
            onClick={() => {
              setDeleteTargetId(af.id);
              setDeleteDialogOpen(true);
            }}
          />
        )}

      </Box>
    </ContentBox>
  );
}
