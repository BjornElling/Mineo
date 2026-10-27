import React from 'react';
import { Box, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import PercentField, { DerivedPercentField } from '../../../inputCore/react/fields/PercentField';
import { createFieldWarning } from '../../../inputCore/fieldWarning';
import { resolveHoejFeriePctAdvarsel } from '../../../domain/loen/feriePctAdvarsel';
import { resolveAarsloenLaastSatsTooltip, resolveAarsloenSatsBindings } from '../../../domain/aarsloen/aarsloenTillaeg';
import type { OverenskomstSatsField } from '../../../domain/loen/overenskomstSatser';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import { useAarsloenVm } from './aarsloenContext';

/**
 * Satser: de fem procentsatser. Boksen skjules i Beløb-tilstand – værdierne bevares, men ignoreres af beregningen.
 *
 * Procentfelternes 0–100-grænser er canonical bounds-feltvalidatorer, ikke props; et input uden for intervallet
 * er en rød feltfejl, som gater beregningen (§1.6). I Overenskomst er fritvalg, SH/SO og pension låste, indtil
 * overenskomst og gyldig dato kendes (BB-351); Store Bededagstillæg er altid afledt.
 */
const AarsloenSatserSection = React.memo(() => {
  const { fields, locations, values } = useAarsloenVm();
  if (values.tillaegAngivesSom === TILLAEG_ANGIVES_SOM.BELOEB) return null;

  const harOverenskomst = values.tillaegAngivesSom === 'overenskomst';
  const hoejFerieAdvarsel = resolveHoejFeriePctAdvarsel(values.feriePct);
  const ferieWarning = hoejFerieAdvarsel === undefined ? undefined : createFieldWarning(hoejFerieAdvarsel);
  const bindings = resolveAarsloenSatsBindings(values);
  const renderSats = (sats: OverenskomstSatsField) => {
    const binding = bindings[sats];
    return binding.kind === 'bruger'
      ? <PercentField field={fields[sats]} location={locations[sats]} name={sats} placeholder="0" sx={{ width: '100px' }} />
      : <DerivedPercentField value={values[sats]} accessibleName={fields[sats].descriptor.label} name={sats} placeholder="" infoTooltipText={resolveAarsloenLaastSatsTooltip(binding, values)} sx={{ width: '100px' }} />;
  };

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Satser</Typography>

      <Box className="row--label-right-hover">
        <Box sx={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography className="row--text" sx={{ minWidth: '160px' }}>Feriegodtgørelse/-tillæg:</Typography>
            <PercentField field={fields.feriePct} location={locations.feriePct} name="feriePct" {...(ferieWarning === undefined ? {} : { warning: ferieWarning })} placeholder="0" sx={{ width: '100px' }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography className="row--text" sx={{ minWidth: '60px' }}>Fritvalg:</Typography>
            {renderSats('fritvalgPct')}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography className="row--text" sx={{ minWidth: '140px' }}>SH/SO-sats:</Typography>
            {renderSats('shSoPct')}
          </Box>
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Box sx={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography className="row--text" sx={{ minWidth: '160px' }}>Store Bededagstillæg:</Typography>
            {harOverenskomst
              ? <DerivedPercentField value={values.storeBededagPct} accessibleName="Store Bededagstillæg" name="storeBededagPct" placeholder="" sx={{ width: '100px' }} />
              : <PercentField field={fields.storeBededagPct} location={locations.storeBededagPct} name="storeBededagPct" placeholder="0" sx={{ width: '100px' }} />
            }
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography className="row--text" sx={{ minWidth: '190px' }}>Arbejdsgivers pensionsbidrag:</Typography>
            {renderSats('pensionPct')}
          </Box>
        </Box>
      </Box>
    </ContentBox>
  );
});

AarsloenSatserSection.displayName = 'AarsloenSatserSection';

export default AarsloenSatserSection;
