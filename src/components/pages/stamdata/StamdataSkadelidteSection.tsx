import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';

import { skadestypeEnum } from '../../../schemas/formSchemas';
import ContentBox from '../../layout/ContentBox';
import ChoiceField from '../../../inputCore/react/fields/ChoiceField';
import DateField from '../../../inputCore/react/fields/DateField';
import TextField from '../../../inputCore/react/fields/TextField';
import { useStamdataVm } from './stamdataContext';

// Afled dropdown-valgmulighederne fra schemaets enum, så UI og validering aldrig kan komme ud af sync.
const SKADESTYPER = skadestypeEnum.options;

/**
 * Skadelidte: navn, fødselsdato, skadestype og den skadestype-afhængige dato.
 *
 * Datomodellens kronologiske bounds er feltvalidatorer, ikke props; de er koblet til runtime-issuet og giver
 * samme røde feltfejl på tværs af consumers. Datolabelen kommer fra sidens viewmodel, som læser den afsluttede
 * skadestype gennem den offentlige reader (§1.2).
 */
const StamdataSkadelidteSection = React.memo(() => {
  const { fields, locations, datoLabel } = useStamdataVm();

  return (
    <ContentBox className="content-box" data-section-id="stamdata-skadelidte">
      <Typography className="section-header">Skadelidte</Typography>

      <Box className="row--label-offset">
        <Typography className="row--text" sx={{ minWidth: '250px' }}>
          Skadelidtes navn
        </Typography>
        <Box className="row--label-offset__content">
          <TextField field={fields.skadelidte} location={locations.skadelidte} name="skadelidte" width={350} />
        </Box>
      </Box>

      <Box className="row--label-offset">
        <Typography className="row--text" sx={{ minWidth: '250px' }}>
          Fødselsdato
        </Typography>
        <Box className="row--label-offset__content">
          <DateField
            field={fields.skadelidteFodselsdato}
            location={locations.skadelidteFodselsdato}
            name="skadelidteFodselsdato"
          />
        </Box>
      </Box>

      <Box className="row--label-offset">
        <Typography className="row--text" sx={{ minWidth: '250px' }}>
          Skadestype
        </Typography>
        <Box className="row--label-offset__content">
          <ChoiceField
            field={fields.skadestype}
            location={locations.skadestype}
            name="skadestype"
            placeholder="Vælg skadestype"
            width={200}
          >
            {SKADESTYPER.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </ChoiceField>
        </Box>
      </Box>

      <Box className="row--label-offset">
        <Typography className="row--text" sx={{ minWidth: '250px' }}>
          {datoLabel}
        </Typography>
        <Box className="row--label-offset__content">
          <DateField field={fields.skadedato} location={locations.skadedato} name="skadedato" />
        </Box>
      </Box>
    </ContentBox>
  );
});

StamdataSkadelidteSection.displayName = 'StamdataSkadelidteSection';

export default StamdataSkadelidteSection;
