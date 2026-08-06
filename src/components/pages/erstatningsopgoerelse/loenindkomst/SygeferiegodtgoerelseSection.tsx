import { Box, MenuItem, Typography } from '@mui/material';
import TextField from '../../../../inputCore/react/fields/TextField';
import DateField from '../../../../inputCore/react/fields/DateField';
import ChoiceField, { ChoiceDivider } from '../../../../inputCore/react/fields/ChoiceField';
import EntityChoiceField from '../../../../inputCore/react/fields/EntityChoiceField';
import AmountField from '../../../../inputCore/react/fields/AmountField';
import MappedToggleField from '../../../../inputCore/react/fields/MappedToggleField';
import IntegerField from '../../../../inputCore/react/fields/IntegerField';
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
import type { SfggPresentation } from '../../../../domain/erstatningsopgoerelse/viewModel/loenindkomstDerivations';
import { APP_ROUTES } from '../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../config/eoTabKeys';

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
  af: Ansaettelsesforhold;
  /**
   * Den samlede SFGG-visningsafledning fra VM'en. Tidligere kom de otte flag/etiketter
   * herinde som otte selvstændige props, som kortet udregnede selv — dvs. domæneafledning
   * i et view, og den eneste grund til at netop denne sektion tog 10 props, hvor resten af
   * sektionsfamilien tager nul. Flagene er indbyrdes afhængige og hører derfor sammen som
   * ét objekt: en delmængde kan ikke give et konsistent billede.
   */
  sfgg: SfggPresentation;
  /** Snapshot-observation (ikke en ren af-afledning), derfor stadig en selvstændig prop. */
  showSfggSixMonthWarning: boolean;
  onNavigateToTabtArbejdsfortjeneste: () => void;
}>;

/**
 * Page-lokal sektion for sygeferiegodtgørelse (SFGG) i ét ansættelsesforhold.
 *
 * Rent præsentationslag: modtager committed værdier + afledte flags top-down (jf.
 * page-component-contract §6.3) og committer via den ene `updateSfggAnsaettelsesforhold`-callback.
 */
const SygeferiegodtgoerelseSection = ({
  af,
  sfgg,
  showSfggSixMonthWarning,
  onNavigateToTabtArbejdsfortjeneste,
}: Props) => {
  if (!sfgg.show) return null;

  // route + tabKey er eksplicit navigation-metadata (§3.7); SFGG-felterne bor på Lønindkomstfanen.
  const location = (name: string) => ({
    locationId: `erstatningsopgoerelse.sfggAnsaettelsesforhold:${af.id}:${name}`,
    route: APP_ROUTES.erstatningsopgoerelse,
    tabKey: EO_TAB_KEYS.LOENINDKOMST,
  });

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

      {sfgg.showSharedSfggBefore2015 ? (
        <Box className="row--label-right-hover">
          <Box className="row--label-right-hover__content" sx={{ width: '100%', justifyContent: 'flex-start' }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <Typography className="row--text">
                Bemærk: Da skaden er før 01-01-2015, skal samtlige TAF-perioder siden skaden være indtastet på fanen med
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
                EO Oplysninger
              </Typography>
              <Typography className="row--text">.</Typography>
            </Box>
          </Box>
        </Box>
      ) : null}

      <Box className="row--label-right-hover">
        <Typography className="row--text">Sygeferiegodtgørelse beregnes ud fra</Typography>
        <Box className="row--label-right-hover__content">
          <EntityChoiceField
            descriptor={eoSfggBeregningskildeField}
            collection={eoSfggAnsaettelsesforholdCollection.template as CollectionRef}
            entity={createEmptySfggRow(af.id)}
            entityId={af.id}
            entityExists={sfgg.row !== undefined}
            location={location('sfggBeregningskilde')}
            name={`${af.id}:sfggBeregningskilde`}
            width={200}
            placeholder="Vælg..."
          >
            <MenuItem value="Overenskomst">Overenskomst</MenuItem>
            <MenuItem value="Ferieloven">Ferieloven</MenuItem>
            <MenuItem value="Manuelt angivet">Manuelt angivet</MenuItem>
            <ChoiceDivider />
            <MenuItem value="Ingen">Ingen</MenuItem>
          </EntityChoiceField>
        </Box>
      </Box>

      {sfgg.row?.sfggBeregningskilde === 'Overenskomst' ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Overenskomst (angivet ovenfor)</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text" sx={{ textAlign: 'right', maxWidth: '520px' }}>
              {sfgg.selectedOverenskomstLabel}
            </Typography>
          </Box>
        </Box>
      ) : null}

      {sfgg.row?.sfggBeregningskilde === 'Overenskomst' && sfgg.canShowOverenskomstDetails && sfgg.policy?.model !== 'direkte_sats' ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Overenskomstens referenceperiode</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text" sx={{ textAlign: 'right', maxWidth: '520px' }}>
              {`Følger ferieloven${sfgg.policy?.referenceperiodeLabel ? ` (${sfgg.policy.referenceperiodeLabel})` : ''}`}
            </Typography>
          </Box>
        </Box>
      ) : null}

      {sfgg.canShowOverenskomstDetails && sfgg.showSatsvalg ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Angiv skadelidtes uddannelse og arbejdssted</Typography>
          <Box className="row--label-right-hover__content">
            <ChoiceField
              field={eoSfggSatsvalgField.bind(af.id)}
              location={location('sfggSatsvalg')}
              name={`${af.id}:sfggSatsvalg`}
              width={220}
              placeholder="Vælg..."
              allowEmpty={true}
            >
              <MenuItem value="Faglaert-Koebenhavn">Faglært-København</MenuItem>
              <MenuItem value="Faglaert-Provinsen">Faglært-Provinsen</MenuItem>
              <MenuItem value="Ufaglaert-Koebenhavn">Ufaglært-København</MenuItem>
              <MenuItem value="Ufaglaert-Provinsen">Ufaglært-Provinsen</MenuItem>
            </ChoiceField>
          </Box>
        </Box>
      ) : null}

      {sfgg.canShowOverenskomstDetails && sfgg.requiresReferenceperiode ? (
        <>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Referenceperiode</Typography>
            <Box className="row--label-right-hover__content">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DateField
                  field={eoSfggReferenceperiodeFraField.bind(af.id)}
                  location={location('sfggReferenceperiodeFra')}
                  name={`${af.id}:sfggReferenceperiodeFra`}
                />
                <Typography className="row--text">til og med</Typography>
                <DateField
                  field={eoSfggReferenceperiodeTilField.bind(af.id)}
                  location={location('sfggReferenceperiodeTil')}
                  name={`${af.id}:sfggReferenceperiodeTil`}
                />
              </Box>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Evt. ferie- og fraværsdage i referenceperioden uden løn</Typography>
            <Box className="row--label-right-hover__content">
              <IntegerField
                field={eoSfggReferenceperiodeFravaersdageUdenLoenField.bind(af.id)}
                location={location('sfggReferenceperiodeFravaersdageUdenLoen')}
                name={`${af.id}:sfggReferenceperiodeFravaersdageUdenLoen`}
                width={100}
                placeholder="0"
              />
            </Box>
          </Box>

        </>
      ) : null}

      {sfgg.row?.sfggBeregningskilde === 'Overenskomst' && sfgg.canShowOverenskomstDetails && sfgg.policy?.model === 'direkte_sats' && !sfgg.showSatsvalg ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Referencesats</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text">Fastlægges automatisk af overenskomsten</Typography>
          </Box>
        </Box>
      ) : null}

      {sfgg.row?.sfggBeregningskilde === 'Manuelt angivet' ? (
        <>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Dagssats for sygeferiegodtgørelse (mandag-fredag)</Typography>
            <Box className="row--label-right-hover__content">
              <AmountField
                field={eoSfggManuelDagssatsField.bind(af.id)}
                location={location('sfggManuelDagssats')}
                name={`${af.id}:sfggManuelDagssats`}
                width={150}
              />
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Beløbet er i henhold til</Typography>
            <Box className="row--label-right-hover__content">
              <TextField
                field={eoSfggManuelBeloebIHenholdTilField.bind(af.id)}
                location={location('sfggManuelBeloebIHenholdTil')}
                name={`${af.id}:sfggManuelBeloebIHenholdTil`}
                width={260}
              />
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Først sygeferiegodtgørelse efter ophør af sygeløn</Typography>
            <Box className="row--label-right-hover__content">
              <MappedToggleField
                field={eoSfggManuelFoerstEfterSygeloenField.bind(af.id)}
                location={location('sfggManuelFoerstEfterSygeloen')}
                checkedValue="Ja"
                uncheckedValue="Nej"
                name={`${af.id}:sfggManuelFoerstEfterSygeloen`}
              />
            </Box>
          </Box>
        </>
      ) : null}

      {sfgg.row?.sfggBeregningskilde !== undefined && sfgg.row.sfggBeregningskilde !== 'Ingen' && sfgg.canShowOverenskomstDetails ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. allerede betalt sygeferiegodtgørelse i denne erstatningsperiode<InfoTooltipIcon title="Angiv kun faktisk SFGG. Feriegodtgørelse af sygeløn beregnes automatisk." /></Typography>
          <Box className="row--label-right-hover__content">
            <AmountField
              field={eoSfggAlleredeBetaltBeloebField.bind(af.id)}
              location={location('sfggAlleredeBetaltBeloeb')}
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
