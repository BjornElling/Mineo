import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import ChoiceField from '../../../inputCore/react/fields/ChoiceField';
import PercentField from '../../../inputCore/react/fields/PercentField';
import RadioField from '../../../inputCore/react/fields/RadioField';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import type { Loenperiode, TillaegAngivesSom } from '../../../schemas/formSchemas/enumSchemas';
import { LOENPERIODE_LABELS } from '../../../schemas/formSchemas';
import { useAarsloenVm } from './aarsloenContext';

/**
 * Satser: lønperiode, tillægsform og de fem procentsatser.
 *
 * Procentfelternes 0–100-grænser er canonical bounds-feltvalidatorer, ikke props; et input uden for intervallet
 * er en rød feltfejl, som gater beregningen (§1.6). Procentblokken skjules i Beløb-tilstand — værdierne bevares,
 * men ignoreres af beregningen.
 */
const AarsloenSatserSection = React.memo(() => {
  const { fields, locations, values } = useAarsloenVm();

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Satser</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Løn indtastes som:</Typography>
        <Box className="row--label-right-hover__content">
          <RadioField<Loenperiode>
            field={fields.loenperiode}
            location={locations.loenperiode}
            name="loenperiode"
            row
            options={LOENPERIODE_LABELS.options}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Tillæg angives som</Typography>
        <Box className="row--label-right-hover__content">
          <ChoiceField<TillaegAngivesSom>
            field={fields.tillaegAngivesSom}
            location={locations.tillaegAngivesSom}
            name="tillaegAngivesSom"
            width={185}
            allowEmpty={false}
          >
            <MenuItem value={TILLAEG_ANGIVES_SOM.PROCENT}>Procent</MenuItem>
            <MenuItem value={TILLAEG_ANGIVES_SOM.BELOEB}>Beløb</MenuItem>
          </ChoiceField>
        </Box>
      </Box>

      {values.tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB && (
        <>
          <Box className="row--label-right-hover">
            <Box sx={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '160px' }}>Feriegodtgørelse/-tillæg:</Typography>
                <PercentField field={fields.feriePct} location={locations.feriePct} name="feriePct" placeholder="0" sx={{ width: '100px' }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '60px' }}>Fritvalg:</Typography>
                <PercentField field={fields.fritvalgPct} location={locations.fritvalgPct} name="fritvalgPct" placeholder="0" sx={{ width: '100px' }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '140px' }}>SH/SO-sats:</Typography>
                <PercentField field={fields.shSoPct} location={locations.shSoPct} name="shSoPct" placeholder="0" sx={{ width: '100px' }} />
              </Box>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Box sx={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '160px' }}>Store Bededagstillæg:</Typography>
                <PercentField field={fields.storeBededagPct} location={locations.storeBededagPct} name="storeBededagPct" placeholder="0" sx={{ width: '100px' }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '190px' }}>Arbejdsgivers pensionsbidrag:</Typography>
                <PercentField field={fields.pensionPct} location={locations.pensionPct} name="pensionPct" placeholder="0" sx={{ width: '100px' }} />
              </Box>
            </Box>
          </Box>
        </>
      )}
    </ContentBox>
  );
});

AarsloenSatserSection.displayName = 'AarsloenSatserSection';

export default AarsloenSatserSection;
