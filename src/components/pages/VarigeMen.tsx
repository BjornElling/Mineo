import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { usePersistedSectionSelector } from '../../hooks/useFormPersistenceSelectors';
import { varigeMenSchema } from '../../schemas/formSchemas';
import MenberegningTab from './varigemen/MenberegningTab';
import SatserTab from './varigemen/SatserTab';
import { VARIGE_MEN_INITIAL_VALUES } from '../../domain/varigemen/varigeMenInitialValues';

const TAB_KEYS = {
  MENBEREGNING: 'menberegning',
  SATSER: 'satser',
} as const;

type TabKey = (typeof TAB_KEYS)[keyof typeof TAB_KEYS];

const VarigeMen = React.memo(() => {
  const { activeTab, setActiveTab } = usePersistedActiveTab<TabKey>({
    pageId: 'varigemen',
    allowedTabs: [TAB_KEYS.MENBEREGNING, TAB_KEYS.SATSER],
    defaultTab: TAB_KEYS.MENBEREGNING,
  });

  const { values, setValues, setFieldValue } = usePersistedForm(varigeMenSchema, 'varigemen', VARIGE_MEN_INITIAL_VALUES);
  const stamdata = usePersistedSectionSelector('stamdata');
  const menberegningStamdata = React.useMemo(
    () => ({
      journalnr: stamdata?.journalnr,
      advokat: stamdata?.advokat,
      sagsbehandler: stamdata?.sagsbehandler,
      skadelidteFodselsdato: stamdata?.skadelidteFodselsdato,
      skadedato: stamdata?.skadedato,
      skadestype: stamdata?.skadestype,
    }),
    [
      stamdata?.journalnr,
      stamdata?.advokat,
      stamdata?.sagsbehandler,
      stamdata?.skadelidteFodselsdato,
      stamdata?.skadedato,
      stamdata?.skadestype,
    ]
  );

  return (
    <Box>
      <Typography className="page-title">Varige mén</Typography>

      <PageTabs
        items={[
          { key: TAB_KEYS.MENBEREGNING, label: 'Ménberegning' },
          { key: TAB_KEYS.SATSER, label: 'Satser' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === TAB_KEYS.SATSER ? (
        <SatserTab />
      ) : (
        <MenberegningTab
          values={values}
          setValues={setValues}
          setFieldValue={setFieldValue}
          stamdata={menberegningStamdata}
        />
      )}
    </Box>
  );
});

VarigeMen.displayName = 'VarigeMen';

export default VarigeMen;
