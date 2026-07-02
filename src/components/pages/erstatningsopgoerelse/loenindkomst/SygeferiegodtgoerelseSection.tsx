import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';
import StyledTextField from '../../../inputs/StyledTextField';
import StyledDateField from '../../../inputs/StyledDateField';
import StyledDropdown, { type StyledDropdownChangeEvent } from '../../../inputs/StyledDropdown';
import StyledAmountField from '../../../inputs/StyledAmountField';
import StyledToggleSwitch from '../../../inputs/StyledToggleSwitch';
import StyledIntegerField from '../../../inputs/StyledIntegerField';
import InfoTooltipIcon from '../../../common/InfoTooltipIcon';
import { DAY_COUNT_MAX } from '../../../../schemas/formSchemas/baseSchemas';
import type { ErstatningsopgoerelseValues } from '../../../../schemas/formSchemas';
import type { ISODateString } from '../../../../types/branded';
import type { OverenskomstSfggPolicy } from '../../../../data/overenskomstRates';
import { applySfggBeregningskildeChange } from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstStateCleanup';
import { normalizeOptionalFreeText } from '../../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
type SfggRow = ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number];

type Props = Readonly<{
  show: boolean;
  af: Ansaettelsesforhold;
  sfggRow: SfggRow | undefined;
  sfggPolicy: OverenskomstSfggPolicy | undefined;
  showSharedSfggBefore2015: boolean;
  showSfggSixMonthWarning: boolean;
  sfggSelectedOverenskomstLabel: string;
  canShowSfggOverenskomstDetails: boolean;
  requiresReferenceperiode: boolean;
  showSatsvalg: boolean;
  referenceperiodeErrorText: string;
  firstTafFraDato: ISODateString | undefined;
  sfggReferenceperiodeMaxDate: ISODateString | undefined;
  sfggReferenceperiodeFravaersdageMax: number | undefined;
  onNavigateToTabtArbejdsfortjeneste: () => void;
  updateSfggAnsaettelsesforhold: (
    ansaettelsesforholdId: string,
    updater: (current: SfggRow) => SfggRow,
    origin?: { fieldPath?: string }
  ) => void;
}>;

/**
 * Page-lokal sektion for sygeferiegodtgørelse (SFGG) i ét ansættelsesforhold.
 *
 * Rent præsentationslag: modtager committed værdier + afledte flags top-down (jf.
 * page-component-contract §6.3) og committer via den ene `updateSfggAnsaettelsesforhold`-callback.
 */
const SygeferiegodtgoerelseSection = ({
  show,
  af,
  sfggRow,
  sfggPolicy,
  showSharedSfggBefore2015,
  showSfggSixMonthWarning,
  sfggSelectedOverenskomstLabel,
  canShowSfggOverenskomstDetails,
  requiresReferenceperiode,
  showSatsvalg,
  referenceperiodeErrorText,
  firstTafFraDato,
  sfggReferenceperiodeMaxDate,
  sfggReferenceperiodeFravaersdageMax,
  onNavigateToTabtArbejdsfortjeneste,
  updateSfggAnsaettelsesforhold,
}: Props) => {
  if (!show) return null;

  return (
    <>
      <Typography className="row--subheading">Sygeferiegodtgørelse</Typography>

      {showSfggSixMonthWarning ? (
        <Box className="row--label-right-hover">
          <Box className="row--label-right-hover__content" sx={{ width: '100%', justifyContent: 'flex-start' }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <Typography className="row--text">
                Bemærk: Sygeferiegodtgørelsen i dette ansættelsesforhold løber mere end 6 måneder efter sidste indkomst. Kontrollér, om perioden er korrekt.
              </Typography>
            </Box>
          </Box>
        </Box>
      ) : null}

      {showSharedSfggBefore2015 ? (
        <Box className="row--label-right-hover">
          <Box className="row--label-right-hover__content" sx={{ width: '100%', justifyContent: 'flex-start' }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <Typography className="row--text">
                Bemærk, at da skaden er før 01-01-2015, er det afgørende, at samtlige TAF-perioder siden skaden er indtastet på
              </Typography>
              <Typography className="row--text">&nbsp;</Typography>
              <Typography
                className="row--text icon-text-link"
                component="button"
                type="button"
                onClick={onNavigateToTabtArbejdsfortjeneste}
                sx={{
                  cursor: 'pointer',
                  border: 0,
                  background: 'transparent',
                  p: 0,
                  m: 0,
                  font: 'inherit',
                }}
              >
                fanen med EO Oplysninger
              </Typography>
              <Typography className="row--text">.</Typography>
            </Box>
          </Box>
        </Box>
      ) : null}

      <Box className="row--label-right-hover">
        <Typography className="row--text">Sygeferiegodtgørelse beregnes ud fra</Typography>
        <Box className="row--label-right-hover__content">
          <StyledDropdown
            name={`${af.id}:sfggBeregningskilde`}
            width={200}
            value={sfggRow?.sfggBeregningskilde}
            placeholder="Vælg..."
            allowEmpty={true}
            onChange={(event: StyledDropdownChangeEvent<string | undefined>) => {
              const nextValue = event.target.value;
              const nextBeregningskilde =
                nextValue === 'Overenskomst' || nextValue === 'Manuelt angivet' || nextValue === 'Ferieloven' || nextValue === 'Ingen'
                  ? nextValue
                  : undefined;
              updateSfggAnsaettelsesforhold(
                af.id,
                (current) => applySfggBeregningskildeChange(current, nextBeregningskilde),
                { fieldPath: `${af.id}:sfggBeregningskilde` }
              );
            }}
          >
            <MenuItem value="Overenskomst">Overenskomst</MenuItem>
            <MenuItem value="Ferieloven">Ferieloven</MenuItem>
            <MenuItem value="Manuelt angivet">Manuelt angivet</MenuItem>
            <StyledDropdown.Divider />
            <MenuItem value="Ingen">Ingen</MenuItem>
          </StyledDropdown>
        </Box>
      </Box>

      {sfggRow?.sfggBeregningskilde === 'Overenskomst' ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Overenskomst (angivet ovenfor)</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text" sx={{ textAlign: 'right', maxWidth: '520px' }}>
              {sfggSelectedOverenskomstLabel}
            </Typography>
          </Box>
        </Box>
      ) : null}

      {sfggRow?.sfggBeregningskilde === 'Overenskomst' && canShowSfggOverenskomstDetails && sfggPolicy?.model !== 'direkte_sats' ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Overenskomstens referenceperiode</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text" sx={{ textAlign: 'right', maxWidth: '520px' }}>
              {`Følger ferieloven${sfggPolicy?.referenceperiodeLabel ? ` (${sfggPolicy.referenceperiodeLabel})` : ''}`}
            </Typography>
          </Box>
        </Box>
      ) : null}

      {canShowSfggOverenskomstDetails && showSatsvalg ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Angiv skadelidtes uddannelse og arbejdssted</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              name={`${af.id}:sfggSatsvalg`}
              width={220}
              value={sfggRow?.sfggSatsvalg}
              placeholder="Vælg..."
              allowEmpty={true}
              onChange={(event: StyledDropdownChangeEvent<string | undefined>) => {
                const nextValue = event.target.value;
                updateSfggAnsaettelsesforhold(af.id, (current) => ({
                  ...current,
                  sfggSatsvalg:
                    nextValue === 'Faglaert-Koebenhavn' ||
                    nextValue === 'Faglaert-Provinsen' ||
                    nextValue === 'Ufaglaert-Koebenhavn' ||
                    nextValue === 'Ufaglaert-Provinsen'
                      ? nextValue
                      : undefined,
                }), { fieldPath: `${af.id}:sfggSatsvalg` });
              }}
            >
              <MenuItem value="Faglaert-Koebenhavn">Faglært-København</MenuItem>
              <MenuItem value="Faglaert-Provinsen">Faglært-Provinsen</MenuItem>
              <MenuItem value="Ufaglaert-Koebenhavn">Ufaglært-København</MenuItem>
              <MenuItem value="Ufaglaert-Provinsen">Ufaglært-Provinsen</MenuItem>
            </StyledDropdown>
          </Box>
        </Box>
      ) : null}

      {canShowSfggOverenskomstDetails && requiresReferenceperiode ? (
        <>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Referenceperiode</Typography>
            <Box className="row--label-right-hover__content">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StyledDateField
                  name={`${af.id}:sfggReferenceperiodeFra`}
                  value={sfggRow?.sfggReferenceperiodeFra}
                  maxDate={
                    sfggRow?.sfggReferenceperiodeTil && sfggReferenceperiodeMaxDate
                      ? (sfggRow.sfggReferenceperiodeTil < sfggReferenceperiodeMaxDate ? sfggRow.sfggReferenceperiodeTil : sfggReferenceperiodeMaxDate)
                      : (sfggRow?.sfggReferenceperiodeTil ?? sfggReferenceperiodeMaxDate)
                  }
                  specialRangeErrors={{
                    fraTilRole: 'fra',
                    maxBoundKind: sfggReferenceperiodeMaxDate ? 'foerFoersteTafFraDato' : undefined,
                    maxBoundReferenceISO: firstTafFraDato,
                  }}
                  error={referenceperiodeErrorText !== ''}
                  helperText={referenceperiodeErrorText}
                  onCommit={(event) => {
                    updateSfggAnsaettelsesforhold(af.id, (current) => ({
                      ...current,
                      sfggReferenceperiodeFra: event.target.value,
                    }));
                  }}
                />
                <Typography className="row--text">til og med</Typography>
                <StyledDateField
                  name={`${af.id}:sfggReferenceperiodeTil`}
                  value={sfggRow?.sfggReferenceperiodeTil}
                  minDate={sfggRow?.sfggReferenceperiodeFra}
                  maxDate={sfggReferenceperiodeMaxDate}
                  specialRangeErrors={{
                    fraTilRole: 'til',
                    maxBoundKind: sfggReferenceperiodeMaxDate ? 'foerFoersteTafFraDato' : undefined,
                    maxBoundReferenceISO: firstTafFraDato,
                  }}
                  error={referenceperiodeErrorText !== ''}
                  helperText={referenceperiodeErrorText}
                  onCommit={(event) => {
                    updateSfggAnsaettelsesforhold(af.id, (current) => ({
                      ...current,
                      sfggReferenceperiodeTil: event.target.value,
                    }));
                  }}
                />
              </Box>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Evt. ferie- og fraværsdage i referenceperioden uden løn</Typography>
            <Box className="row--label-right-hover__content">
              <StyledIntegerField
                name={`${af.id}:sfggReferenceperiodeFravaersdageUdenLoen`}
                width={100}
                minValue={0}
                maxValue={sfggReferenceperiodeFravaersdageMax ?? DAY_COUNT_MAX}
                value={sfggRow?.sfggReferenceperiodeFravaersdageUdenLoen}
                placeholder="0"
                onCommit={(event) => {
                  updateSfggAnsaettelsesforhold(af.id, (current) => ({
                    ...current,
                    sfggReferenceperiodeFravaersdageUdenLoen: event.target.value,
                  }));
                }}
              />
            </Box>
          </Box>

        </>
      ) : null}

      {sfggRow?.sfggBeregningskilde === 'Overenskomst' && canShowSfggOverenskomstDetails && sfggPolicy?.model === 'direkte_sats' && !showSatsvalg ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Referencesats</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text">Fastlægges automatisk af overenskomsten</Typography>
          </Box>
        </Box>
      ) : null}

      {sfggRow?.sfggBeregningskilde === 'Manuelt angivet' ? (
        <>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Dagssats for sygeferiegodtgørelse (mandag-fredag)</Typography>
            <Box className="row--label-right-hover__content">
              <StyledAmountField
                name={`${af.id}:sfggManuelDagssats`}
                width={150}
                value={sfggRow?.sfggManuelDagssats}
                allowNegative={false}
                onCommit={(event) => {
                  updateSfggAnsaettelsesforhold(af.id, (current) => ({
                    ...current,
                    sfggManuelDagssats: event.target.value,
                  }));
                }}
              />
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Beløbet er i henhold til</Typography>
            <Box className="row--label-right-hover__content">
              <StyledTextField
                name={`${af.id}:sfggManuelBeloebIHenholdTil`}
                width={260}
                value={sfggRow?.sfggManuelBeloebIHenholdTil ?? ''}
                onCommit={(event) => {
                  updateSfggAnsaettelsesforhold(af.id, (current) => ({
                    ...current,
                    sfggManuelBeloebIHenholdTil: normalizeOptionalFreeText(event.target.value),
                  }));
                }}
              />
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Først sygeferiegodtgørelse efter ophør af sygeløn</Typography>
            <Box className="row--label-right-hover__content">
              <StyledToggleSwitch
                name={`${af.id}:sfggManuelFoerstEfterSygeloen`}
                checked={sfggRow?.sfggManuelFoerstEfterSygeloen === 'Ja'}
                onCommit={(event) => {
                  updateSfggAnsaettelsesforhold(af.id, (current) => ({
                    ...current,
                    sfggManuelFoerstEfterSygeloen: event.target.value ? 'Ja' : 'Nej',
                  }), { fieldPath: `${af.id}:sfggManuelFoerstEfterSygeloen` });
                }}
              />
            </Box>
          </Box>
        </>
      ) : null}

      {sfggRow?.sfggBeregningskilde !== undefined && sfggRow.sfggBeregningskilde !== 'Ingen' && canShowSfggOverenskomstDetails ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. allerede betalt sygeferiegodtgørelse i denne erstatningsperiode<InfoTooltipIcon title="Angiv kun faktisk SFGG. Feriegodtgørelse af sygeløn beregnes automatisk." /></Typography>
          <Box className="row--label-right-hover__content">
            <StyledAmountField
              name={`${af.id}:sfggAlleredeBetaltBeloeb`}
              width={150}
              value={sfggRow?.sfggAlleredeBetaltBeloeb}
              allowNegative={false}
              onCommit={(event) => {
                updateSfggAnsaettelsesforhold(af.id, (current) => ({
                  ...current,
                  sfggAlleredeBetaltBeloeb: event.target.value,
                }));
              }}
            />
          </Box>
        </Box>
      ) : null}
    </>
  );
};

export default SygeferiegodtgoerelseSection;
