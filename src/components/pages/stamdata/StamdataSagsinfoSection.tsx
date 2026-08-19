import React from 'react';
import { Box, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import TextField from '../../../inputCore/react/fields/TextField';
import { useStamdataVm } from './stamdataContext';

/**
 * Sagsinfo: journalnummer og advokat/sagsbehandler-initialer.
 *
 * Hvert felt modtager KUN sin konkrete `field` (descriptor.bind()) og `location` (stabilt locationId) – ingen
 * `value`/`onCommit`/`parse`/`format`/`min`/`max`. Bindingerne kommer fra sidens viewmodel (§4.4).
 */
const StamdataSagsinfoSection = React.memo(() => {
  const { fields, locations } = useStamdataVm();

  return (
    <ContentBox className="content-box" data-section-id="stamdata-sagsinfo">
      <Typography className="section-header">Sagsinfo</Typography>

      <Box className="row--label-offset">
        <Typography className="row--text" sx={{ minWidth: '250px' }}>
          Journalnr.
        </Typography>
        <Box className="row--label-offset__content">
          <TextField field={fields.journalnr} location={locations.journalnr} name="journalnr" width={220} />
        </Box>
      </Box>

      <Box className="row--label-offset">
        <Typography className="row--text" sx={{ minWidth: '250px' }}>
          Advokat/Sagsbehandler
        </Typography>
        <Box className="row--label-offset__content">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              field={fields.advokat}
              location={locations.advokat}
              name="advokat"
              placeholder="(init.)"
              width={80}
              sx={{ '& input': { textAlign: 'center' } }}
            />
            <Typography className="row--text">/</Typography>
            <TextField
              field={fields.sagsbehandler}
              location={locations.sagsbehandler}
              name="sagsbehandler"
              placeholder="(init.)"
              width={80}
              sx={{ '& input': { textAlign: 'center' } }}
            />
          </Box>
        </Box>
      </Box>
    </ContentBox>
  );
});

StamdataSagsinfoSection.displayName = 'StamdataSagsinfoSection';

export default StamdataSagsinfoSection;
