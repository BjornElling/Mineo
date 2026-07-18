import { Box, MenuItem, Typography } from '@mui/material';
import GreenfieldTextField from '../../../../inputCore/react/fields/GreenfieldTextField';
import GreenfieldDateField from '../../../../inputCore/react/fields/GreenfieldDateField';
import GreenfieldChoiceField, { GreenfieldChoiceDivider } from '../../../../inputCore/react/fields/GreenfieldChoiceField';
import GreenfieldEntityChoiceField from '../../../../inputCore/react/fields/GreenfieldEntityChoiceField';
import GreenfieldAmountField from '../../../../inputCore/react/fields/GreenfieldAmountField';
import GreenfieldMappedToggleField from '../../../../inputCore/react/fields/GreenfieldMappedToggleField';
import GreenfieldIntegerField from '../../../../inputCore/react/fields/GreenfieldIntegerField';
import {
  eoSfggAlleredeBetaltBeloebField,
  eoSfggBeregningskildeField,
  eoSfggManuelBeloebIHenholdTilField,
  eoSfggManuelDagssatsField,
  eoSfggManuelFoerstEfterSygeloenField,
  eoSfggReferenceperiodeFraField,
  eoSfggReferenceperiodeFravaersdageUdenLoenField,
  eoSfggReferenceperiodeTilField,
  eoSfggSatsvalgField,
  eoSfggAnsaettelsesforholdCollection,
} from '../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { CollectionRef } from '../../../../inputCore/fieldAddress';
import InfoTooltipIcon from '../../../common/InfoTooltipIcon';
import type { ErstatningsopgoerelseValues } from '../../../../schemas/formSchemas';
import type { OverenskomstSfggPolicy } from '../../../../data/overenskomstRates';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
type SfggRow = ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number];
const createEmptySfggRow = (ansaettelsesforholdId: string): SfggRow => ({
  ansaettelsesforholdId,
  sfggBeregningskilde: undefined,
  sfggReferenceperiodeFra: undefined,
  sfggReferenceperiodeTil: undefined,
  sfggReferenceperiodeFravaersdageUdenLoen: undefined,
  sfggManuelDagssats: undefined,
  sfggManuelBeloebIHenholdTil: undefined,
  sfggManuelFoerstEfterSygeloen: 'Nej',
  sfggSatsvalg: undefined,
  sfggAlleredeBetaltBeloeb: undefined,
});

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
  onNavigateToTabtArbejdsfortjeneste: () => void;
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
  onNavigateToTabtArbejdsfortjeneste,
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
          <GreenfieldEntityChoiceField
            descriptor={eoSfggBeregningskildeField}
            collection={eoSfggAnsaettelsesforholdCollection.template as CollectionRef}
            entity={createEmptySfggRow(af.id)}
            entityId={af.id}
            entityExists={sfggRow !== undefined}
            location={{ locationId: `erstatningsopgoerelse.sfggAnsaettelsesforhold:${af.id}:sfggBeregningskilde` }}
            name={`${af.id}:sfggBeregningskilde`}
            width={200}
            placeholder="Vælg..."
          >
            <MenuItem value="Overenskomst">Overenskomst</MenuItem>
            <MenuItem value="Ferieloven">Ferieloven</MenuItem>
            <MenuItem value="Manuelt angivet">Manuelt angivet</MenuItem>
            <GreenfieldChoiceDivider />
            <MenuItem value="Ingen">Ingen</MenuItem>
          </GreenfieldEntityChoiceField>
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
            <GreenfieldChoiceField
              field={eoSfggSatsvalgField.bind(af.id)}
              location={{ locationId: `erstatningsopgoerelse.sfggAnsaettelsesforhold:${af.id}:sfggSatsvalg` }}
              name={`${af.id}:sfggSatsvalg`}
              width={220}
              placeholder="Vælg..."
              allowEmpty={true}
            >
              <MenuItem value="Faglaert-Koebenhavn">Faglært-København</MenuItem>
              <MenuItem value="Faglaert-Provinsen">Faglært-Provinsen</MenuItem>
              <MenuItem value="Ufaglaert-Koebenhavn">Ufaglært-København</MenuItem>
              <MenuItem value="Ufaglaert-Provinsen">Ufaglært-Provinsen</MenuItem>
            </GreenfieldChoiceField>
          </Box>
        </Box>
      ) : null}

      {canShowSfggOverenskomstDetails && requiresReferenceperiode ? (
        <>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Referenceperiode</Typography>
            <Box className="row--label-right-hover__content">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GreenfieldDateField
                  field={eoSfggReferenceperiodeFraField.bind(af.id)}
                  location={{ locationId: `erstatningsopgoerelse.sfggAnsaettelsesforhold:${af.id}:sfggReferenceperiodeFra` }}
                  name={`${af.id}:sfggReferenceperiodeFra`}
                />
                <Typography className="row--text">til og med</Typography>
                <GreenfieldDateField
                  field={eoSfggReferenceperiodeTilField.bind(af.id)}
                  location={{ locationId: `erstatningsopgoerelse.sfggAnsaettelsesforhold:${af.id}:sfggReferenceperiodeTil` }}
                  name={`${af.id}:sfggReferenceperiodeTil`}
                />
              </Box>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Evt. ferie- og fraværsdage i referenceperioden uden løn</Typography>
            <Box className="row--label-right-hover__content">
              <GreenfieldIntegerField
                field={eoSfggReferenceperiodeFravaersdageUdenLoenField.bind(af.id)}
                location={{ locationId: `erstatningsopgoerelse.sfggAnsaettelsesforhold:${af.id}:sfggReferenceperiodeFravaersdageUdenLoen` }}
                name={`${af.id}:sfggReferenceperiodeFravaersdageUdenLoen`}
                width={100}
                placeholder="0"
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
              <GreenfieldAmountField
                field={eoSfggManuelDagssatsField.bind(af.id)}
                location={{ locationId: `erstatningsopgoerelse.sfggAnsaettelsesforhold:${af.id}:sfggManuelDagssats` }}
                name={`${af.id}:sfggManuelDagssats`}
                width={150}
              />
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Beløbet er i henhold til</Typography>
            <Box className="row--label-right-hover__content">
              <GreenfieldTextField
                field={eoSfggManuelBeloebIHenholdTilField.bind(af.id)}
                location={{ locationId: `erstatningsopgoerelse.sfggAnsaettelsesforhold:${af.id}:sfggManuelBeloebIHenholdTil` }}
                name={`${af.id}:sfggManuelBeloebIHenholdTil`}
                width={260}
              />
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Først sygeferiegodtgørelse efter ophør af sygeløn</Typography>
            <Box className="row--label-right-hover__content">
              <GreenfieldMappedToggleField
                field={eoSfggManuelFoerstEfterSygeloenField.bind(af.id)}
                location={{ locationId: `erstatningsopgoerelse.sfggAnsaettelsesforhold:${af.id}:sfggManuelFoerstEfterSygeloen` }}
                checkedValue="Ja"
                uncheckedValue="Nej"
                name={`${af.id}:sfggManuelFoerstEfterSygeloen`}
              />
            </Box>
          </Box>
        </>
      ) : null}

      {sfggRow?.sfggBeregningskilde !== undefined && sfggRow.sfggBeregningskilde !== 'Ingen' && canShowSfggOverenskomstDetails ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. allerede betalt sygeferiegodtgørelse i denne erstatningsperiode<InfoTooltipIcon title="Angiv kun faktisk SFGG. Feriegodtgørelse af sygeløn beregnes automatisk." /></Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldAmountField
              field={eoSfggAlleredeBetaltBeloebField.bind(af.id)}
              location={{ locationId: `erstatningsopgoerelse.sfggAnsaettelsesforhold:${af.id}:sfggAlleredeBetaltBeloeb` }}
              name={`${af.id}:sfggAlleredeBetaltBeloeb`}
              width={150}
            />
          </Box>
        </Box>
      ) : null}
    </>
  );
};

export default SygeferiegodtgoerelseSection;
