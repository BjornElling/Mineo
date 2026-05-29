import React from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { usePersistedSectionSelector } from '../../hooks/useFormPersistenceSelectors';
import { useFormFieldErrorReporter, useFormFieldErrors } from '../../hooks/useFormFieldErrors';
import {
  erhvervsevnetabSchema,
  faellesAarsloenSchema,
  type ErhvervsevnetabComposedValues,
} from '../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import {
  collectEetAslAfgoerelseValidationIssues,
} from '../../domain/erhvervsevnetab/eetAslAfgoerelser';
import { computeEetSnapshot } from '../../domain/erhvervsevnetab/eetSnapshot';
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

  const { values, setValues, setFieldValue } = usePersistedForm(
    erhvervsevnetabSchema,
    'erhvervsevnetab',
    ERHVERVSEVNETAB_INITIAL_VALUES
  );
  const { values: faellesAarsloenValues, setFieldValue: setFaellesAarsloenFieldValue } = usePersistedForm(
    faellesAarsloenSchema,
    'faellesAarsloen',
    FAELLES_AARSLOEN_INITIAL_VALUES
  );
  const stamdata = usePersistedSectionSelector('stamdata');
  const reportAslAfgoerelserRuleError = useFormFieldErrorReporter('erhvervsevnetab', 'aslAfgoerelser', {
    severity: 'error',
    source: 'rule',
  });
  useAslAarsloenRuleReporter(faellesAarsloenValues.aslAarsloen, stamdata?.skadedato);
  const stamdataFieldErrors = useFormFieldErrors('stamdata');
  const eetFieldErrors = useFormFieldErrors('erhvervsevnetab');
  const faellesAarsloenFieldErrors = useFormFieldErrors('faellesAarsloen');

  const composedValues = React.useMemo<ErhvervsevnetabComposedValues>(
    () => ({ ...values, ...faellesAarsloenValues, skadelidteFodselsdato: stamdata?.skadelidteFodselsdato }),
    [faellesAarsloenValues, stamdata?.skadelidteFodselsdato, values]
  );

  const eetSnapshot = React.useMemo(
    () =>
      computeEetSnapshot({
        values: composedValues,
        stamdata,
        fieldErrors: {
          stamdata: stamdataFieldErrors,
          erhvervsevnetab: eetFieldErrors,
          faellesAarsloen: faellesAarsloenFieldErrors,
        },
      }),
    [
      composedValues,
      eetFieldErrors,
      faellesAarsloenFieldErrors,
      stamdata,
      stamdataFieldErrors,
    ]
  );

  const aslAfgoerelserValidationIssues = React.useMemo(() => {
    return collectEetAslAfgoerelseValidationIssues(
      values.aslAfgoerelser,
      stamdata?.skadedato,
      stamdata?.skadelidteFodselsdato
    );
  }, [stamdata?.skadelidteFodselsdato, stamdata?.skadedato, values.aslAfgoerelser]);

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
                minWidth: 130,
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'var(--color-primary)',
                height: '2px',
              },
            }}
          >
            <Tab className="tab-item" label="EET oplysninger" value={TAB_KEYS.EET_OPLYSNINGER} />
            <Tab className="tab-item" label="Løbende ydelser" value={TAB_KEYS.LOEBENDE_YDELSER} />
            <Tab className="tab-item" label="Kapitalisering" value={TAB_KEYS.KAPITALISERING} />
            <Tab className="tab-item" label="EET efter EAL" value={TAB_KEYS.EET_EAL} />
            <Tab className="tab-item" label="Differencekrav" value={TAB_KEYS.DIFFERENCEKRAV} />
          </Tabs>
        </Box>
      </Box>

      {/* Tab-indhold */}
      {activeTab === TAB_KEYS.EET_OPLYSNINGER && (
        <EetOplysningerTab
          values={composedValues}
          setValues={setValues}
          setFieldValue={setFieldValue}
          handleAslAarsloenChange={(event) => setFaellesAarsloenFieldValue('aslAarsloen', event.target.value)}
          handleEalAarsloenChange={(event) => setFaellesAarsloenFieldValue('ealAarsloen', event.target.value)}
          skadedato={stamdata?.skadedato}
        />
      )}
      {activeTab === TAB_KEYS.LOEBENDE_YDELSER && (
        <EetLoebendeYdelserTab
          values={composedValues}
          setValues={setValues}
          onGoToEetOplysninger={() => setActiveTab(TAB_KEYS.EET_OPLYSNINGER)}
          stamdata={stamdata}
          snapshot={eetSnapshot.loebendeYdelser}
        />
      )}
      {activeTab === TAB_KEYS.KAPITALISERING && (
        <EetKapitaliseringTab
          values={composedValues}
          onGoToEetOplysninger={() => setActiveTab(TAB_KEYS.EET_OPLYSNINGER)}
          stamdata={stamdata}
          snapshot={eetSnapshot.kapitalisering}
        />
      )}
      {activeTab === TAB_KEYS.EET_EAL && (
        <EetEfterEalTab
          onGoToEetOplysninger={() => setActiveTab(TAB_KEYS.EET_OPLYSNINGER)}
          stamdata={stamdata}
          snapshot={eetSnapshot.efterEal}
        />
      )}
      {activeTab === TAB_KEYS.DIFFERENCEKRAV && (
        <EetDifferencekravTab
          values={composedValues}
          setValues={setValues}
          onGoToEetOplysninger={() => setActiveTab(TAB_KEYS.EET_OPLYSNINGER)}
          stamdata={stamdata}
          snapshot={eetSnapshot.differencekrav}
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
