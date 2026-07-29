import React from 'react';
import { Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import StandardLoenTable from '../../tables/StandardLoenTable';
import { aarsloenStandardLoenFieldSet } from '../../../domain/aarsloen/aarsloenStandardLoenFieldSet';
import { useAarsloenVm } from './aarsloenContext';

/**
 * Indtægtsoplysninger: løntabellen over grid-adapteren.
 *
 * Tabellens valideringssummary er reader-afledt, så omregning-gaten og dokumentgaten deler præcis samme sandhed
 * som cellernes røde issues. `tabelRef` ejes af viewmodellen, fordi både omregning-gaten og
 * download-blokeringens celle-flash bruger den.
 */
const AarsloenIndtaegtSection = React.memo(() => {
  const { tabelRef, tableLocationNav, tableSatser, values } = useAarsloenVm();

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Indtægtsoplysninger</Typography>

      <StandardLoenTable
        ref={tabelRef}
        fieldSet={aarsloenStandardLoenFieldSet}
        loenperiode={values.loenperiode}
        locationNav={tableLocationNav}
        tillaegAngivesSom={values.tillaegAngivesSom}
        satser={tableSatser}
        useSmallFont={true}
        saveOrderPath="aarsloen.tableData"
      />
    </ContentBox>
  );
});

AarsloenIndtaegtSection.displayName = 'AarsloenIndtaegtSection';

export default AarsloenIndtaegtSection;
