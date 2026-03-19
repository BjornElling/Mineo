import React from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import ContentBox from '../layout/ContentBox';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { usePersistedSection } from '../../hooks/usePersistedSection';
import { useFormFieldErrorReporter } from '../../hooks/useFormFieldErrors';
import {
  erhvervsevnetabSchema,
  faellesAarsloenSchema,
  faellesPersondataSchema,
  type ErhvervsevnetabComposedValues,
} from '../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../domain/faellesAarsloen/faellesAarsloenInitialValues';
import { FAELLES_PERSONDATA_INITIAL_VALUES } from '../../domain/faellesPersondata/faellesPersondataInitialValues';
import {
  collectEetAslAfgoerelseValidationIssues,
} from '../../domain/erhvervsevnetab/eetAslAfgoerelser';
import EetOplysningerTab from './erhvervsevnetab/EetOplysningerTab';
import EetEfterEalTab from './erhvervsevnetab/EetEfterEalTab';
import EetLoebendeYdelserTab from './erhvervsevnetab/EetLoebendeYdelserTab';
import EetKapitaliseringTab from './erhvervsevnetab/EetKapitaliseringTab';
import EetDifferencekravTab from './erhvervsevnetab/EetDifferencekravTab';
import { useAslAarsloenRuleReporter } from '../../hooks/useAslAarsloenRuleReporter';

// ─── Fane-konstanter ─────────────────────────────────────────────────────────

const TAB_KEYS = {
  EET_OPLYSNINGER: 'eet-oplysninger',
  LOEBENDE_YDELSER: 'loebende-ydelser',
  KAPITALISERING: 'kapitalisering',
  EET_EAL: 'eet-eal',
  DIFFERENCEKRAV: 'differencekrav',
} as const;

type TabKey = (typeof TAB_KEYS)[keyof typeof TAB_KEYS];

const ErhvervsevnetabPage = React.memo(() => {
  const { activeTab, setActiveTab, isAllowedTab } = usePersistedActiveTab<TabKey>({
    pageId: 'erhvervsevnetab',
    allowedTabs: [
      TAB_KEYS.EET_OPLYSNINGER,
      TAB_KEYS.LOEBENDE_YDELSER,
      TAB_KEYS.KAPITALISERING,
      TAB_KEYS.EET_EAL,
      TAB_KEYS.DIFFERENCEKRAV,
    ],
    defaultTab: TAB_KEYS.EET_OPLYSNINGER,
  });

  const { values, setValues, handleChange } = usePersistedForm(
    erhvervsevnetabSchema,
    'erhvervsevnetab',
    ERHVERVSEVNETAB_INITIAL_VALUES
  );
  const { values: faellesPersondataValues, handleChange: handleFaellesPersondataChange } = usePersistedForm(
    faellesPersondataSchema,
    'faellesPersondata',
    FAELLES_PERSONDATA_INITIAL_VALUES
  );
  const { values: faellesAarsloenValues, handleChange: handleFaellesAarsloenChange } = usePersistedForm(
    faellesAarsloenSchema,
    'faellesAarsloen',
    FAELLES_AARSLOEN_INITIAL_VALUES
  );
  const stamdata = usePersistedSection('stamdata');
  const reportAslAfgoerelserRuleError = useFormFieldErrorReporter('erhvervsevnetab', 'aslAfgoerelser', {
    severity: 'error',
    source: 'rule',
  });
  useAslAarsloenRuleReporter(faellesAarsloenValues.aslAarsloen, stamdata?.skadesdato);

  const composedValues = React.useMemo<ErhvervsevnetabComposedValues>(
    () => ({ ...values, ...faellesAarsloenValues, ...faellesPersondataValues }),
    [faellesAarsloenValues, faellesPersondataValues, values]
  );

  const aslAfgoerelserValidationIssues = React.useMemo(() => {
    return collectEetAslAfgoerelseValidationIssues(
      values.aslAfgoerelser,
      stamdata?.skadesdato,
      faellesPersondataValues.skadelidteFodselsdato
    );
  }, [faellesPersondataValues.skadelidteFodselsdato, stamdata?.skadesdato, values.aslAfgoerelser]);

  // Kun den første fejl rapporteres til error-bus — feltniveau-fejl på individuelle rækker
  // vises inline i tabellen og aggregeres ikke i EetIssuesBox. Dette er en bevidst
  // trade-off: EetIssuesBox viser den første tabelblokerende fejl som navigation-target,
  // mens øvrige row-fejl er synlige direkte i tabellen.
  React.useEffect(() => {
    reportAslAfgoerelserRuleError(aslAfgoerelserValidationIssues[0]?.message);
  }, [aslAfgoerelserValidationIssues, reportAslAfgoerelserRuleError]);
  const handleTabChange = React.useCallback(
    (_: React.SyntheticEvent, value: unknown) => {
      if (!isAllowedTab(value)) return;
      setActiveTab(value);
    },
    [isAllowedTab, setActiveTab]
  );

  return (
    <Box>
      <Typography className="page-title">Erhvervsevnetab</Typography>

      {/* Tab-navigation */}
      <Box
        sx={{
          position: 'relative',
          width: '1200px',
          height: 0,
          mb: '40px',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '-48px',
            right: '20px',
            zIndex: 10,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              minHeight: 48,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                minWidth: 130,
                transition: 'color 0.2s, opacity 0.2s',
                opacity: 0.7,
                '&:hover': { opacity: 1 },
                '&.Mui-selected': {
                  color: 'primary.main',
                  opacity: 1,
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'primary.main',
                height: '2px',
              },
            }}
          >
            <Tab label="EET oplysninger" value={TAB_KEYS.EET_OPLYSNINGER} />
            <Tab label="Løbende ydelser" value={TAB_KEYS.LOEBENDE_YDELSER} />
            <Tab label="Kapitalisering" value={TAB_KEYS.KAPITALISERING} />
            <Tab label="EET efter EAL" value={TAB_KEYS.EET_EAL} />
            <Tab label="Differencekrav" value={TAB_KEYS.DIFFERENCEKRAV} />
          </Tabs>
        </Box>
      </Box>

      {/* Tab-indhold */}
      {activeTab === TAB_KEYS.EET_OPLYSNINGER && (
        <EetOplysningerTab
          values={composedValues}
          setValues={setValues}
          handleChange={handleChange}
          handleSkadelidteFodselsdatoChange={handleFaellesPersondataChange('skadelidteFodselsdato')}
          handleAslAarsloenChange={handleFaellesAarsloenChange('aslAarsloen')}
          handleEalAarsloenChange={handleFaellesAarsloenChange('ealAarsloen')}
          skadesdato={stamdata?.skadesdato}
        />
      )}
      {activeTab === TAB_KEYS.LOEBENDE_YDELSER && (
        <EetLoebendeYdelserTab
          values={composedValues}
          setValues={setValues}
          onGoToEetOplysninger={() => setActiveTab(TAB_KEYS.EET_OPLYSNINGER)}
        />
      )}
      {activeTab === TAB_KEYS.KAPITALISERING && (
        <EetKapitaliseringTab
          values={composedValues}
          onGoToEetOplysninger={() => setActiveTab(TAB_KEYS.EET_OPLYSNINGER)}
        />
      )}
      {activeTab === TAB_KEYS.EET_EAL && (
        <EetEfterEalTab
          values={composedValues}
          onGoToEetOplysninger={() => setActiveTab(TAB_KEYS.EET_OPLYSNINGER)}
        />
      )}
      {activeTab === TAB_KEYS.DIFFERENCEKRAV && (
        <EetDifferencekravTab
          values={composedValues}
          setValues={setValues}
          onGoToEetOplysninger={() => setActiveTab(TAB_KEYS.EET_OPLYSNINGER)}
        />
      )}
    </Box>
  );
});

ErhvervsevnetabPage.displayName = 'ErhvervsevnetabPage';

// ─── Komponent ───────────────────────────────────────────────────────────────

const Erhvervsevnetab = React.memo(() => {
  return <ErhvervsevnetabPage />;
});

Erhvervsevnetab.displayName = 'Erhvervsevnetab';

export default Erhvervsevnetab;
