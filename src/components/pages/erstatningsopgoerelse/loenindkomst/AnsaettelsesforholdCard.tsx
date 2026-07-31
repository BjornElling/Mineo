import { Box, IconButton, MenuItem, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import DocumentDownloadButton from '../../../inputs/DocumentDownloadButton';
import DocumentOutcomeMessage from '../../../inputs/DocumentOutcomeMessage';
import TextField from '../../../../inputCore/react/fields/TextField';
import DateField from '../../../../inputCore/react/fields/DateField';
import ChoiceField, { ChoiceDivider } from '../../../../inputCore/react/fields/ChoiceField';
import AmountField from '../../../../inputCore/react/fields/AmountField';
import PercentField, { DerivedPercentField } from '../../../../inputCore/react/fields/PercentField';
import RadioField from '../../../../inputCore/react/fields/RadioField';
import ToggleField from '../../../../inputCore/react/fields/ToggleField';
import MappedToggleField from '../../../../inputCore/react/fields/MappedToggleField';
import IntegerField from '../../../../inputCore/react/fields/IntegerField';
import LoenudviklingManuelTable from '../../../tables/LoenudviklingManuelTable';
import LoenudviklingManuelProcentsatsTable from '../../../tables/LoenudviklingManuelProcentsatsTable';
import StandardLoenTable from '../../../tables/StandardLoenTable';
import {
  eoEmploymentFields,
  eoEmploymentFilterFields,
  eoEmploymentManual,
} from '../../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { serializeFieldAddress, type CollectionRef } from '../../../../inputCore/fieldAddress';
import type { FieldRef } from '../../../../inputCore/fieldDescriptor';
import { createEoStandardLoenFieldSet } from '../../../../domain/erstatningsopgoerelse/eoStandardLoenFieldSet';
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
  resolveAnvendtReguleringsdatoReferenceText,
  resolveSkadeEllerAnmeldelsesdatoReference,
} from '../../../../domain/erstatningsopgoerelse/helpers/eoDateReferenceText';
import {
  formatOverenskomstMetaDisplay,
  getOverenskomstMetaById,
  getOverenskomstSfggPolicy,
  getReguleringsDatoIntervalForOverenskomst,
  isOffentligOverenskomstId,
  resolveOverenskomstDisplay,
} from '../../../../data/overenskomstRates';
import {
  ASL_AARSLOENSMAKSIMUM_MODEL_LABEL,
  getReguleringsDatoIntervalForStatistikModel,
} from '../../../../data/statistiskeRates';
import { getReguleringsDatoIntervalForKRL, type KRLSatstabelId } from '../../../../data/krlRates';
import { getReguleringsDatoIntervalForKlLoenaftaler } from '../../../../data/klLoenaftaler';
import {
  isOverenskomstSatsFieldLocked,
  type OverenskomstSatsField,
} from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstSatser';
import { hasSfggSelectedOverenskomst } from '../../../../domain/erstatningsopgoerelse/engines/sfggKilde';
import SygeferiegodtgoerelseSection from './SygeferiegodtgoerelseSection';
import { useLoenindkomstVm } from './loenindkomstContext';
import { useReguleringDocumentAction } from '../../../../domain/erstatningsopgoerelse/react/useReguleringDocumentAction';
import { APP_ROUTES } from '../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../config/eoTabKeys';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

type ReguleringsDatoInterval = Readonly<{ fraDato: string; tilDato: string }>;

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
    satsIssues,
    manualBaseRowErrorsByAfId,
    loentrinFinder,
    alleLoenmodtagerOrg,
    alleArbejdsgiverOrg,
    // Løntabellens per-ansættelsesforhold-input: satsrækken og den afledte rækkeberegner slås op på `af.id`
    // og gives til `StandardLoenTable` nedenfor.
    satserByAfId,
    derivedCalculatorByAfId,
    totalAnsaettelsesforhold,
    cannotAddMore,
    showDeleteButton,
    setAddDialogOpen,
    setDeleteDialogOpen,
    setDeleteTargetId,
    getAnvendtReguleringsdatoForAnsaettelsesforhold,
    getLoenudviklingBaseDate,
    resolveOverenskomstLabel,
    getFilteredOverenskomsterForAnsaettelsesforhold,
    showSygeferiegodtgoerelseSection: showSygeferiegodtgoerelseSectionFor,
    getSfggRowForAf,
    handleMoveUp,
    handleMoveDown,
  } = useLoenindkomstVm();

  /**
   * Reguleringssats-downloaden for NETOP dette ansættelsesforhold. Requesten er ren
   * identitet (`af.id`); alle værdier — grundlag, overenskomst, satsvalg, interval — genlæses friskt
   * i definitionen efter commit-barrieren. Tidligere læste kortet dem ved klik og sendte dem med,
   * så en åben, ikke-settlet editor gav et dokument på de gamle tal.
   */
  const reguleringDocument = useReguleringDocumentAction(
    React.useMemo(() => ({ scope: 'employment' as const, employmentId: af.id }), [af.id])
  );
  const { openLoentrinFinder } = loentrinFinder;

  const field = <T,>(descriptor: { bind: (...ids: readonly string[]) => T }): T => descriptor.bind(af.id);
  // route + tabKey er eksplicit navigation-metadata (§3.7); ansættelsesforholdets felter bor på Lønindkomstfanen.
  const location = (name: string) => ({
    locationId: `erstatningsopgoerelse.loenindkomstAnsaettelsesforhold:${af.id}:${name}`,
    route: APP_ROUTES.erstatningsopgoerelse,
    tabKey: EO_TAB_KEYS.LOENINDKOMST,
  });
  const standardLoenFieldSet = React.useMemo(() => createEoStandardLoenFieldSet(af.id), [af.id]);

  /**
   * Slår satsvurderingens kryds-felt-issue op på den SAMME bundne reference, feltet selv bruger. Ét
   * bindingssted: divergerede opslags-adressen fra feltets egen, ville markeringen forsvinde lydløst fra
   * feltet.
   */
  const satsIssueFor = (descriptor: { bind: (...ids: readonly string[]) => FieldRef<number | undefined> }) =>
    satsIssues.get(serializeFieldAddress(field(descriptor).address));
  const feriePctIssue = satsIssueFor(eoEmploymentFields.feriePct);

  const showOverenskomst = af.harOverenskomst;
  const showMedlemOpsagt = af.ansatPaaSkadestidspunktet;
  const showSidsteArbejdsdag = showMedlemOpsagt && af.ansaettelsesforholdOphoert;
  const isLastAnsaettelsesforhold = index === totalAnsaettelsesforhold - 1;
  const displayNumber = index + 1;
  const anvendtReguleringsdato = getAnvendtReguleringsdatoForAnsaettelsesforhold(af);
  const skadeEllerAnmeldelsesdato = resolveSkadeEllerAnmeldelsesdatoReference(skadestype);
  const anvendtReguleringsdatoReferenceText = resolveAnvendtReguleringsdatoReferenceText({
    anvendtReguleringsdato,
    skadedato,
    skadestype,
    beregnesUdFra,
    beregningsperiodeTil: tafBeregningsperiodeTil,
    saerligFraDatoRegulering: af.saerligFraDatoRegulering,
  });
  const satserHeading = resolveSatserHeading({
    anvendtReguleringsdato,
    skadedato: skadedato,
    skadestype: skadestype,
    beregnesUdFra,
    beregningsperiodeTil: tafBeregningsperiodeTil,
    saerligFraDatoRegulering: af.saerligFraDatoRegulering,
  });
  const loenudviklingBasis = af.loenudviklingBeregningsgrundlag;
  /**
   * Satsfelt der er BRUGERINPUT når det er frit, og AFLEDT når overenskomsten låser det.
   *
   * Den låste gren læser `af[satsField]` — altså reader-projektionen, som allerede har kørt
   * `applyAutoSatsFields` og dermed bærer overenskomstens sats. Præcis samme vej som
   * `storeBededagPct`, der hele tiden var koblet rigtigt.
   *
   * Fejlen dette lukker: kortet brugte låsningen KUN til `disabled` og lod `PercentField` hente
   * værdien gennem sin `FieldRef`, dvs. fra input-readeren, hvor brugerens (tomme) input står.
   * Feltet stod derfor blankt og låst, mens beregningen kørte på overenskomstens sats (SH/SO 7 %,
   * pension 10,15 %) — to kilder til ét tal, hvor kun den forkerte var synlig. Et låst felt må
   * aldrig bindes til readeren; det er projektionen der ejer værdien.
   */
  const renderSatsField = (satsField: OverenskomstSatsField) => {
    const shared = {
      name: `${af.id}:${satsField}`,
      placeholder: '0',
      sx: LOCKED_SATS_FIELD_SX,
    } as const;
    return isOverenskomstSatsFieldLocked(af, anvendtReguleringsdato, satsField)
      ? <DerivedPercentField value={af[satsField]} {...shared} />
      : (
        <PercentField
          field={field(eoEmploymentFields[satsField])}
          location={location(satsField)}
          {...shared}
        />
      );
  };
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
          <TextField
            field={field(eoEmploymentFields.navnPaaArbejdssted)}
            location={location('navnPaaArbejdssted')}
            name={`${af.id}:navnPaaArbejdssted`}
            width={300}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">{`Ansat på ${skadeEllerAnmeldelsesdato.labelLower}`}</Typography>
        <Box className="row--label-right-hover__content">
          <ToggleField
            field={field(eoEmploymentFields.ansatPaaSkadestidspunktet)}
            location={location('ansatPaaSkadestidspunktet')}
            name={`${af.id}:ansatPaaSkadestidspunktet`}
          />
        </Box>
      </Box>

      {showMedlemOpsagt ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Opsagt fra stillingen</Typography>
          <Box className="row--label-right-hover__content">
            <ToggleField
              field={field(eoEmploymentFields.ansaettelsesforholdOphoert)}
              location={location('ansaettelsesforholdOphoert')}
              name={`${af.id}:ansaettelsesforholdOphoert`}
            />
          </Box>
        </Box>
      ) : null}

      <Box sx={{ display: showSidsteArbejdsdag ? 'block' : 'none' }}>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Sidste dag i ansættelsesforholdet</Typography>
          <Box className="row--label-right-hover__content">
            <DateField field={field(eoEmploymentFields.sidsteArbejdsdag)} location={location('sidsteArbejdsdag')} name={`${af.id}:sidsteArbejdsdag`} />
          </Box>
        </Box>
      </Box>

      <Typography className="row--subheading">Lønforhold</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Overenskomst</Typography>
        <Box className="row--label-right-hover__content">
          <ToggleField field={field(eoEmploymentFields.harOverenskomst)} location={location('harOverenskomst')} name={`${af.id}:harOverenskomst`} />
        </Box>
      </Box>

      <Box sx={{ display: showOverenskomst ? 'block' : 'none' }}>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Vælg overenskomst</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Lønmodtager filter dropdown - UI viser 'ALLE', domæne bruger undefined */}
              <Typography sx={{ fontSize: '11px', lineHeight: '24px' }}>L:</Typography>
              <ChoiceField
                field={field(eoEmploymentFilterFields.loenmodtager)}
                location={location('overenskomstFilter.loenmodtager')}
                name={`${af.id}:overenskomstFilter.loenmodtager`}
                emptyUiValue="ALLE"
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
              </ChoiceField>

              {/* Arbejdsgiver filter dropdown - UI viser 'ALLE', domæne bruger undefined */}
              <Typography sx={{ fontSize: '11px', lineHeight: '24px' }}>A:</Typography>
              <ChoiceField
                field={field(eoEmploymentFilterFields.arbejdsgiver)}
                location={location('overenskomstFilter.arbejdsgiver')}
                name={`${af.id}:overenskomstFilter.arbejdsgiver`}
                emptyUiValue="ALLE"
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
              </ChoiceField>

              <ChoiceField
                field={field(eoEmploymentFields.overenskomstId)}
                location={location('overenskomstId')}
                name={`${af.id}:overenskomstId`}
                width={460}
                placeholder="Vælg overenskomst..."
                allowEmpty={true}
                getOptionLabel={(id) => resolveOverenskomstDisplay(typeof id === 'string' ? id : String(id))}
              >
                {getFilteredOverenskomsterForAnsaettelsesforhold(af).map((meta) => (
                  <MenuItem key={meta.id} value={meta.id}>
                    {formatOverenskomstMetaDisplay(meta)}
                  </MenuItem>
                ))}
              </ChoiceField>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Fuld løn under ferie:</Typography>
        <Box className="row--label-right-hover__content">
          <MappedToggleField
            field={field(eoEmploymentFields.fuldLoenUnderFerie)}
            location={location('fuldLoenUnderFerie')}
            checkedValue="Ja"
            uncheckedValue="Nej"
            name={`${af.id}:fuldLoenUnderFerie`}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Løn på helligdage:</Typography>
        <Box className="row--label-right-hover__content">
          <ChoiceField
            field={field(eoEmploymentFields.loenPaaHelligdage)}
            location={location('loenPaaHelligdage')}
            name={`${af.id}:loenPaaHelligdage`}
            width={185}
            allowEmpty={false}
          >
            <MenuItem value="Almindelig løn">Almindelig løn</MenuItem>
            <MenuItem value="SH-udbetaling">SH-udbetaling</MenuItem>
            <MenuItem value="Ingen">Ingen</MenuItem>
          </ChoiceField>
        </Box>
      </Box>

      {beregnesUdFra === 'Beregningsperiode' && (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. særlig fra-dato for regulering</Typography>
          <Box className="row--label-right-hover__content">
            <DateField
              field={field(eoEmploymentFields.saerligFraDatoRegulering)}
              location={location('saerligFraDatoRegulering')}
              name={`${af.id}:saerligFraDatoRegulering`}
            />
          </Box>
        </Box>
      )}

      <Box className="row--label-right-hover">
        <Typography className="row--text">Løn indtastes som:</Typography>
        <Box className="row--label-right-hover__content">
          <RadioField
            field={field(eoEmploymentFields.loenperiode)}
            location={location('loenperiode')}
            name={`${af.id}:loenperiode`}
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
          <ChoiceField
            field={field(eoEmploymentFields.tillaegAngivesSom)}
            location={location('tillaegAngivesSom')}
            name={`${af.id}:tillaegAngivesSom`}
            width={185}
            allowEmpty={false}
          >
            <MenuItem value={TILLAEG_ANGIVES_SOM.PROCENT}>Procent</MenuItem>
            <MenuItem value={TILLAEG_ANGIVES_SOM.BELOEB}>Beløb</MenuItem>
          </ChoiceField>
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
                <PercentField
                  field={field(eoEmploymentFields.feriePct)}
                  location={location('feriePct')}
                  name={`${af.id}:feriePct`}
                  placeholder="0"
                  {...(feriePctIssue === undefined ? {} : { crossFieldIssue: feriePctIssue })}
                  sx={{ width: '100px' }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '60px' }}>Fritvalg:</Typography>
                {renderSatsField('fritvalgPct')}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '140px' }}>
                  SH/SO-sats:
                </Typography>
                {renderSatsField('shSoPct')}
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
                <DerivedPercentField
                  value={af.storeBededagPct}
                  name={`${af.id}:storeBededagPct`}
                  placeholder="0"
                  sx={LOCKED_SATS_FIELD_SX}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '190px' }}>
                  Arbejdsgivers pensionsbidrag:
                </Typography>
                {renderSatsField('pensionPct')}
              </Box>
            </Box>
          </Box>
        </>
      ) : null}

      <Typography className="row--subheading">Indtægtsoplysninger</Typography>
      <StandardLoenTable
        fieldSet={standardLoenFieldSet}
        loenperiode={af.loenperiode}
        tillaegAngivesSom={af.tillaegAngivesSom}
        satser={satserByAfId.get(af.id) ?? {}}
        calculateDerivedRow={derivedCalculatorByAfId.get(af.id)}
        useSmallFont={true}
        saveOrderPath={`erstatningsopgoerelse.loenindkomstAnsaettelsesforhold.${af.id}.indtaegtsoplysningerTableData`}
        // route + tabKey er eksplicit navigation-metadata (§3.7); tabellen bor på Lønindkomstfanen.
        locationNav={{ route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.LOENINDKOMST }}
      />

      {beregnesUdFra === 'Beregningsperiode' ? (
        <>
      <Typography className="row--subheading">Lønudvikling</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Lønudvikling beregnes ud fra</Typography>
        <Box className="row--label-right-hover__content">
          <ChoiceField
            field={field(eoEmploymentFields.loenudviklingBeregningsgrundlag)}
            location={location('loenudviklingBeregningsgrundlag')}
            name={`${af.id}:loenudviklingBeregningsgrundlag`}
            width={220}
            allowEmpty={true}
            placeholder="Vælg..."
          >
            <MenuItem value="Overenskomst">Overenskomst</MenuItem>
            <MenuItem value="Statistik">Statistik</MenuItem>
            <MenuItem value="KRL satstabel">KRL satstabel</MenuItem>
            <MenuItem value="KL-lønaftaler">KL-lønaftaler</MenuItem>
            <ChoiceDivider />
            <MenuItem value="Manuelt angivet">Manuelt angivet</MenuItem>
            <MenuItem value="Manuel procentsats">Manuel procentsats</MenuItem>
            <ChoiceDivider />
            <MenuItem value="Ingen">Ingen</MenuItem>
          </ChoiceField>
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
                <ChoiceField
                  field={field(eoEmploymentFields.offentligLoenType)}
                  location={location('offentligLoenType')}
                  name={`${af.id}:offentligLoenType`}
                  width={160}
                  allowEmpty={false}
                >
                  {offentligLoenTypeEnum.options.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </ChoiceField>
                <Typography className="row--text">Løntrin</Typography>
                <IntegerField
                  field={field(eoEmploymentFields.offentligLoenTrin)}
                  location={location('offentligLoenTrin')}
                  name={`${af.id}:offentligLoenTrin`}
                  width={80}
                />
                <Typography className="row--text">Gruppe</Typography>
                <IntegerField
                  field={field(eoEmploymentFields.offentligLoenGruppe)}
                  location={location('offentligLoenGruppe')}
                  name={`${af.id}:offentligLoenGruppe`}
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
                <AmountField
                  field={field(eoEmploymentFields.offentligLoenEkstraGrundloen)}
                  location={location('offentligLoenEkstraGrundloen')}
                  name={`${af.id}:offentligLoenEkstraGrundloen`}
                  width={160}
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
            <ChoiceField
              field={field(eoEmploymentFields.loenudviklingStatistikModel)}
              location={location('loenudviklingStatistikModel')}
              name={`${af.id}:loenudviklingStatistikModel`}
              width={270}
              allowEmpty={true}
              placeholder="Vælg..."
            >
              <MenuItem value={ASL_AARSLOENSMAKSIMUM_MODEL_LABEL}>{ASL_AARSLOENSMAKSIMUM_MODEL_LABEL}</MenuItem>
              <MenuItem value="ILON12 (Danmarks Statistik)">ILON12 (Danmarks Statistik)</MenuItem>
              <MenuItem value="SBLON2 (Danmarks Statistik)">SBLON2 (Danmarks Statistik)</MenuItem>
            </ChoiceField>
          </Box>
        </Box>
      ) : null}

      {loenudviklingBasis === 'KRL satstabel' ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Satstabel</Typography>
          <Box className="row--label-right-hover__content">
            <ChoiceField
              field={field(eoEmploymentFields.loenudviklingKRLSatstabel)}
              location={location('loenudviklingKRLSatstabel')}
              name={`${af.id}:loenudviklingKRLSatstabel`}
              width={270}
              allowEmpty={true}
              placeholder="Vælg..."
            >
              {krlSatstabelEnum.options.map((satstabel) => (
                <MenuItem key={satstabel} value={satstabel}>
                  {satstabel}
                </MenuItem>
              ))}
            </ChoiceField>
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
                : resolveAnvendtReguleringsdatoReferenceText({
                    anvendtReguleringsdato,
                    skadedato,
                    skadestype,
                    beregnesUdFra,
                    beregningsperiodeTil: tafBeregningsperiodeTil,
                    saerligFraDatoRegulering: af.saerligFraDatoRegulering,
                  });
            return (
              <>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">Navn på reguleringsform</Typography>
                  <Box className="row--label-right-hover__content">
                    <TextField
                      field={field(eoEmploymentFields.loenudviklingManuelNavn)}
                      location={location('loenudviklingManuelNavn')}
                      name={`${af.id}:loenudviklingManuelNavn`}
                      width={350}
                    />
                  </Box>
                </Box>
                <LoenudviklingManuelTable
                  bindings={eoEmploymentManual}
                  collection={{
                    ...eoEmploymentManual.manualCollection.template,
                    path: [{ kind: 'entity', collection: 'loenindkomstAnsaettelsesforhold', entityId: af.id }],
                  } as CollectionRef}
                  committedRows={af.loenudviklingManuelTableData}
                  locationPrefix={`erstatningsopgoerelse.loenindkomstAnsaettelsesforhold:${af.id}:loenudviklingManuelTableData`}
                  baseDateDisplay={loenudviklingBaseDate.display}
                  baseDateISO={loenudviklingBaseDate.iso}
                  baseDateErrorMessage={loenudviklingBaseDate.display === '' ? loenudviklingBaseDate.errorMessage : undefined}
                  baseDateInfoTooltipText={baseDateTooltipText}
                  baseRowPercentErrors={manualBaseRowErrorsByAfId[af.id]}
                  // Procent-tilstand spejler satsfelterne ovenfor. I Beløb-tilstand er de skjulte,
                  // og brugeren indtaster basisrækkens tillægsprocenter direkte i tabellen.
                  readOnlyBaseRowPercentFields={af.tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB}
                  useSmallFont={true}
                  // route + tabKey er eksplicit navigation-metadata (§3.7); tabellen bor på Lønindkomstfanen.
                  locationNav={{ route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.LOENINDKOMST }}
                />
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
                : resolveAnvendtReguleringsdatoReferenceText({
                    anvendtReguleringsdato,
                    skadedato,
                    skadestype,
                    beregnesUdFra,
                    beregningsperiodeTil: tafBeregningsperiodeTil,
                    saerligFraDatoRegulering: af.saerligFraDatoRegulering,
                  });
            return (
                <LoenudviklingManuelProcentsatsTable
                  bindings={eoEmploymentManual}
                  collection={{
                    ...eoEmploymentManual.manualPercentCollection.template,
                    path: [{ kind: 'entity', collection: 'loenindkomstAnsaettelsesforhold', entityId: af.id }],
                  } as CollectionRef}
                  committedRows={af.loenudviklingManuelProcentsatsTableData}
                  locationPrefix={`erstatningsopgoerelse.loenindkomstAnsaettelsesforhold:${af.id}:loenudviklingManuelProcentsatsTableData`}
                  baseDateDisplay={loenudviklingBaseDate.display}
                  baseDateISO={loenudviklingBaseDate.iso}
                  baseDateErrorMessage={loenudviklingBaseDate.display === '' ? loenudviklingBaseDate.errorMessage : undefined}
                  baseDateInfoTooltipText={baseDateTooltipText}
                  useSmallFont={true}
                  // route + tabKey er eksplicit navigation-metadata (§3.7); tabellen bor på Lønindkomstfanen.
                  locationNav={{ route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.LOENINDKOMST }}
                />
            );
          })()}
        </Box>
      ) : null}

      {shouldShowReguleringsDatoInterval ? (
        <>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Tilgængelige reguleringssatser</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'flex-end', gap: 1 }}>
              {/*
                Knaptilstand OG outputvalg kommer fra `reguleringDocument`. Den side-lokale
                `canDownload`-IIFE (som var skrevet med en ANDEN formel end sagsniveauets) og
                `loenudviklingBasis`-switchen ved klik er erstattet af den fælles resolver.
              */}
              <Typography className="row--text" sx={{ textAlign: 'right' }}>
                {reguleringsDatoInterval}
              </Typography>
              <Box>
                <DocumentDownloadButton
                  disabled={!reguleringDocument.canDownload}
                  disabledReason={reguleringDocument.disabledReason}
                  onClick={() => { void reguleringDocument.download(); }}
                />
              </Box>
            </Box>
          </Box>
        </Box>
        {/*
          Gate-årsagen findes her KUN i knappens tooltip, så beskeden vises rå — ellers ville en
          blokeret aktivering være helt usynlig for brugeren.
        */}
        <DocumentOutcomeMessage message={reguleringDocument.errorMessage} />
        </>
      ) : null}
        </>
      ) : null}

      {showAnciennitetstillaegSection ? (
        <>
          <Typography className="row--subheading">Anciennitetstillæg</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">
              {`Ville skadelidte have opnået anciennitetstillæg efter ${anvendtReguleringsdatoReferenceText}`}
            </Typography>
            <Box className="row--label-right-hover__content">
              <ToggleField
                field={field(eoEmploymentFields.harAnciennitetstillaegEfterSkadedatoen)}
                location={location('harAnciennitetstillaegEfterSkadedatoen')}
                name={`${af.id}:harAnciennitetstillaegEfterSkadedatoen`}
              />
            </Box>
          </Box>

          {af.harAnciennitetstillaegEfterSkadedatoen ? (
            <>
              <Box className="row--label-right-hover">
                <Typography className="row--text">Dato for opnået anciennitetstillæg</Typography>
                <Box className="row--label-right-hover__content">
                  <DateField
                    field={field(eoEmploymentFields.anciennitetstillaegDato)}
                    location={location('anciennitetstillaegDato')}
                    name={`${af.id}:anciennitetstillaegDato`}
                  />
                </Box>
              </Box>

              <Box className="row--label-right-hover">
                <Typography className="row--text">Satsen angives per</Typography>
                <Box className="row--label-right-hover__content">
                  <ChoiceField
                    field={field(eoEmploymentFields.anciennitetstillaegSatsAngivesPer)}
                    location={location('anciennitetstillaegSatsAngivesPer')}
                    name={`${af.id}:anciennitetstillaegSatsAngivesPer`}
                    width={160}
                    allowEmpty={false}
                  >
                    <MenuItem value="Time">Time</MenuItem>
                    <MenuItem value="Måned">Måned</MenuItem>
                  </ChoiceField>
                </Box>
              </Box>

              <Box className="row--label-right-hover">
                <Typography className="row--text">{`Sats per ${anciennitetSatsPerTekst}`}</Typography>
                <Box className="row--label-right-hover__content">
                  <AmountField
                    field={field(eoEmploymentFields.anciennitetstillaegSats)}
                    location={location('anciennitetstillaegSats')}
                    name={`${af.id}:anciennitetstillaegSats`}
                    width={160}
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
        onNavigateToTabtArbejdsfortjeneste={onNavigateToTabtArbejdsfortjeneste}
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
import * as React from 'react';
