import { resolveAarsloenTillaegsMode } from '../../../domain/aarsloen/aarsloenTillaeg';
import React from 'react';
import { Box, Typography } from '@mui/material';
import RadioField from '../../../inputCore/react/fields/RadioField';
import type { Loenperiode } from '../../../schemas/formSchemas/enumSchemas';
import { LOENPERIODE_LABELS } from '../../../schemas/formSchemas';

import ContentBox from '../../layout/ContentBox';
import StandardLoenTable from '../../tables/StandardLoenTable';
import { aarsloenStandardLoenFieldSet } from '../../../domain/aarsloen/aarsloenStandardLoenFieldSet';
import { useAarsloenVm } from './aarsloenContext';

/**
 * Indtægtsoplysninger: lønperioden og løntabellen over grid-adapteren.
 *
 * Tabellens valideringssummary er reader-afledt, så omregning-gaten og dokumentgaten deler præcis samme sandhed
 * som cellernes røde issues. `tabelRef` ejes af viewmodellen, fordi både omregning-gaten og
 * download-blokeringens celle-flash bruger den.
 */
const AarsloenIndtaegtSection = React.memo(() => {
  const { fields, locations, tabelRef, tableLocationNav, tableSatser, values, tableCellWarnings } = useAarsloenVm();

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Indtægtsoplysninger</Typography>

      {/* Lønperioden styrer kun tabellens kolonner og står derfor lige over tabellen (BB-348). */}
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

      <StandardLoenTable
        ref={tabelRef}
        fieldSet={aarsloenStandardLoenFieldSet}
        loenperiode={values.loenperiode}
        locationNav={tableLocationNav}
        tillaegAngivesSom={resolveAarsloenTillaegsMode(values.tillaegAngivesSom)}
        satser={tableSatser}
        useSmallFont={true}
        saveOrderPath="aarsloen.tableData"
        cellWarnings={tableCellWarnings}
      />
    </ContentBox>
  );
});

AarsloenIndtaegtSection.displayName = 'AarsloenIndtaegtSection';

export default AarsloenIndtaegtSection;
