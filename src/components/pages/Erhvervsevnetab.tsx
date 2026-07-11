import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import {
  usePersistedSectionSelector,
  useInvalidDraftForFieldSelector,
} from '../../hooks/useFormPersistenceSelectors';
import { useFormFieldErrorReporter, useFormFieldErrors } from '../../hooks/useFormFieldErrors';
import {
  erhvervsevnetabSchema,
  faellesAarsloenSchema,
  erstatningsopgoerelseSchema,
  type ErhvervsevnetabComposedValues,
} from '../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { useAppSettings } from '../../contexts/useAppSettings';
import {
  collectEetAslAfgoerelseValidationIssues,
} from '../../domain/erhvervsevnetab/eetAslAfgoerelser';
import {
  ERHVERVSEVNETAB_TAB_KEYS,
  type ErhvervsevnetabTabKey,
} from '../../domain/erhvervsevnetab/eetIssueNavigation';
import { computeEetSnapshot } from '../../domain/erhvervsevnetab/eetSnapshot';
import EetOplysningerTab from './erhvervsevnetab/EetOplysningerTab';
import EetEfterEalTab from './erhvervsevnetab/EetEfterEalTab';
import EetLoebendeYdelserTab from './erhvervsevnetab/EetLoebendeYdelserTab';
import EetKapitaliseringTab from './erhvervsevnetab/EetKapitaliseringTab';
import EetDifferencekravTab from './erhvervsevnetab/EetDifferencekravTab';
import { useAslAarsloenRuleReporter } from '../../hooks/useAslAarsloenRuleReporter';

// ─── Fane-konstanter ─────────────────────────────────────────────────────────

const TAB_KEYS = ERHVERVSEVNETAB_TAB_KEYS;
type TabKey = ErhvervsevnetabTabKey;

const ErhvervsevnetabPage = React.memo(() => {
  const { activeTab, setActiveTab } = usePersistedActiveTab<TabKey>({
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

  // Forlig om ansvarsgrad er delt kilde mellem EO- og differencekrav-fanen: felterne bor i
  // erstatningsopgoerelse-sektionen, men kan redigeres herfra. Vi binder den samme sektion (samme
  // globale store-slice) så ændringer slår igennem begge steder. Settings-afledte initialværdier
  // matcher EO-sidens egne, så et commit herfra materialiserer ikke afvigende EO-defaults.
  const { settings } = useAppSettings();
  const erstatningsopgoerelseInitialValues = React.useMemo(
    () => createErstatningsopgoerelseInitialValues(settings),
    [settings]
  );
  const { values: erstatningsopgoerelseValues, setValues: setErstatningsopgoerelseValues } = usePersistedForm(
    erstatningsopgoerelseSchema,
    'erstatningsopgoerelse',
    erstatningsopgoerelseInitialValues
  );
  // Ikke-committbare rå drafts i forligs-felterne (committede værdier er altid schema-gyldige).
  const forligProcentInvalidDraft = useInvalidDraftForFieldSelector('erstatningsopgoerelse', 'forligAnsvarsgradProcent');
  const forligBroekInvalidDraft = useInvalidDraftForFieldSelector('erstatningsopgoerelse', 'forligAnsvarsgradBroek');
  const forligValues = React.useMemo(
    () => ({
      forligAnsvarsgradProcent: erstatningsopgoerelseValues.forligAnsvarsgradProcent,
      forligAnsvarsgradBroek: erstatningsopgoerelseValues.forligAnsvarsgradBroek,
      forligDato: erstatningsopgoerelseValues.forligDato,
    }),
    [
      erstatningsopgoerelseValues.forligAnsvarsgradProcent,
      erstatningsopgoerelseValues.forligAnsvarsgradBroek,
      erstatningsopgoerelseValues.forligDato,
    ]
  );
  const forligHasInvalidDraft =
    forligProcentInvalidDraft !== undefined || forligBroekInvalidDraft !== undefined;
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
        forlig: {
          values: forligValues,
          dato: forligValues.forligDato,
          hasInvalidDraft: forligHasInvalidDraft,
        },
      }),
    [
      composedValues,
      eetFieldErrors,
      faellesAarsloenFieldErrors,
      forligHasInvalidDraft,
      forligValues,
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
  return (
    <Box>
      <Typography className="page-title">Erhvervsevnetab</Typography>

      {/* Tab-navigation */}
      <PageTabs
        items={[
          { key: TAB_KEYS.EET_OPLYSNINGER, label: 'EET oplysninger' },
          { key: TAB_KEYS.LOEBENDE_YDELSER, label: 'Løbende ydelser' },
          { key: TAB_KEYS.KAPITALISERING, label: 'Kapitalisering' },
          { key: TAB_KEYS.EET_EAL, label: 'EET efter EAL' },
          { key: TAB_KEYS.DIFFERENCEKRAV, label: 'Differencekrav' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        minTabWidth={130}
      />

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
          forligValues={forligValues}
          setForligValues={setErstatningsopgoerelseValues}
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
