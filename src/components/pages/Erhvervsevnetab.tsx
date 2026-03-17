import React from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import ContentBox from '../layout/ContentBox';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { usePersistedSection } from '../../hooks/usePersistedSection';
import { useFormFieldErrorReporter } from '../../hooks/useFormFieldErrors';
import { erhvervsevnetabSchema } from '../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { amountValueToNumber } from '../../utils/expressionAmount';
import {
  collectEetAslAfgoerelseValidationIssues,
  validateAslAarsloenBySkadesaarMax,
  validateAslAarsloenDivisibleBy1000,
} from '../../domain/erhvervsevnetab/eetAslAfgoerelser';
import EetOplysningerTab from './erhvervsevnetab/EetOplysningerTab';
import EetEfterEalTab from './erhvervsevnetab/EetEfterEalTab';
import EetLoebendeYdelserTab from './erhvervsevnetab/EetLoebendeYdelserTab';
import EetKapitaliseringTab from './erhvervsevnetab/EetKapitaliseringTab';
import EetDifferencekravTab from './erhvervsevnetab/EetDifferencekravTab';

// ─── Fane-konstanter ─────────────────────────────────────────────────────────

const TAB_KEYS = {
  EET_OPLYSNINGER: 'eet-oplysninger',
  LOEBENDE_YDELSER: 'loebende-ydelser',
  KAPITALISERING: 'kapitalisering',
  EET_EAL: 'eet-eal',
  DIFFERENCEKRAV: 'differencekrav',
} as const;

type TabKey = (typeof TAB_KEYS)[keyof typeof TAB_KEYS];

// ─── Skeleton-fane ───────────────────────────────────────────────────────────

const SkeletonTab: React.FC<{ titel: string }> = ({ titel }) => (
  <ContentBox className="content-box">
    <Typography className="section-header">{titel}</Typography>
    <Typography className="row--text">Kommer...</Typography>
  </ContentBox>
);

const ErhvervsevnetabProductionPlaceholder = React.memo(() => (
  <Box>
    <Typography className="page-title">Erhvervsevnetab</Typography>
    <ContentBox className="content-box">
      <Typography className="section-header">
        Beregning af erhvervsevnetabserstatning
      </Typography>
      <Typography className="row--text">Kommer...</Typography>
    </ContentBox>
  </Box>
));

ErhvervsevnetabProductionPlaceholder.displayName = 'ErhvervsevnetabProductionPlaceholder';

const ErhvervsevnetabDev = React.memo(() => {
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
    legacySource: { persistedPageKey: 'erhvervsevnetab', fieldName: 'activeTab' },
  });

  const { values, setValues, handleChange } = usePersistedForm(
    erhvervsevnetabSchema,
    'erhvervsevnetab',
    ERHVERVSEVNETAB_INITIAL_VALUES
  );
  const stamdata = usePersistedSection('stamdata');
  const reportAslAfgoerelserRuleError = useFormFieldErrorReporter('erhvervsevnetab', 'aslAfgoerelser', {
    severity: 'error',
    source: 'rule',
  });
  const reportAslAarsloenRuleError = useFormFieldErrorReporter('erhvervsevnetab', 'aslAarsloen', {
    severity: 'error',
    source: 'rule',
  });

  const aslAarsloenRuleError = React.useMemo(() => {
    const aarsloen = amountValueToNumber(values.aslAarsloen);
    const divisibleBy1000Error = validateAslAarsloenDivisibleBy1000(aarsloen);
    if (divisibleBy1000Error) return divisibleBy1000Error;
    return validateAslAarsloenBySkadesaarMax(aarsloen, stamdata?.skadesdato);
  }, [stamdata?.skadesdato, values.aslAarsloen]);

  const aslAfgoerelserValidationIssues = React.useMemo(() => {
    return collectEetAslAfgoerelseValidationIssues(values.aslAfgoerelser, stamdata?.skadesdato, stamdata?.fodselsdato);
  }, [stamdata?.fodselsdato, stamdata?.skadesdato, values.aslAfgoerelser]);

  React.useEffect(() => {
    reportAslAfgoerelserRuleError(aslAfgoerelserValidationIssues[0]?.message);
  }, [aslAfgoerelserValidationIssues, reportAslAfgoerelserRuleError]);

  React.useEffect(() => {
    reportAslAarsloenRuleError(aslAarsloenRuleError);
  }, [aslAarsloenRuleError, reportAslAarsloenRuleError]);

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
        <EetOplysningerTab values={values} setValues={setValues} handleChange={handleChange} />
      )}
      {activeTab === TAB_KEYS.LOEBENDE_YDELSER && (
        <EetLoebendeYdelserTab
          values={values}
          setValues={setValues}
          onGoToEetOplysninger={() => setActiveTab(TAB_KEYS.EET_OPLYSNINGER)}
        />
      )}
      {activeTab === TAB_KEYS.KAPITALISERING && (
        <EetKapitaliseringTab
          values={values}
          onGoToEetOplysninger={() => setActiveTab(TAB_KEYS.EET_OPLYSNINGER)}
        />
      )}
      {activeTab === TAB_KEYS.EET_EAL && (
        <EetEfterEalTab
          values={values}
          onGoToEetOplysninger={() => setActiveTab(TAB_KEYS.EET_OPLYSNINGER)}
        />
      )}
      {activeTab === TAB_KEYS.DIFFERENCEKRAV && (
        <EetDifferencekravTab
          values={values}
          setValues={setValues}
          onGoToEetOplysninger={() => setActiveTab(TAB_KEYS.EET_OPLYSNINGER)}
        />
      )}
    </Box>
  );
});

ErhvervsevnetabDev.displayName = 'ErhvervsevnetabDev';

// ─── Komponent ───────────────────────────────────────────────────────────────

/**
 * Erhvervsevnetab-siden.
 *
 * I development-mode vises den fulde implementering.
 * I production vises en "Kommer..."-placeholder.
 */
const Erhvervsevnetab = React.memo(() => {
  const isDev = import.meta.env.DEV;
  // NOTE: Denne gate styrer runtime-aktivering. Dev-kode kan stadig indgå i production bundle,
  // men hooks/state mountes ikke i production fordi placeholder-komponenten renderes i stedet.
  return isDev ? <ErhvervsevnetabDev /> : <ErhvervsevnetabProductionPlaceholder />;
});

Erhvervsevnetab.displayName = 'Erhvervsevnetab';

export default Erhvervsevnetab;
