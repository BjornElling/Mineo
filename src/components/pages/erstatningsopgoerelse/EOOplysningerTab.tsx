import React from 'react';
import { Box } from '@mui/material';
import { useEoOplysningerViewModel } from './eoOplysninger/useEoOplysningerViewModel';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { EoOplysningerVmProvider } from './eoOplysninger/eoOplysningerContext';
import LoentrinFinderOverlay from './shared/LoentrinFinderOverlay';
import EoSagsinfoSection from './eoOplysninger/sections/EoSagsinfoSection';
import ForligSection from './eoOplysninger/sections/ForligSection';
import AesAfgoerelserSection from './eoOplysninger/sections/AesAfgoerelserSection';
import SvieSmerteSection from './eoOplysninger/sections/SvieSmerteSection';
import TabtArbejdsfortjenesteSection from './eoOplysninger/sections/TabtArbejdsfortjenesteSection';
import IndtaegtFoerSkadenSection from './eoOplysninger/sections/IndtaegtFoerSkadenSection';
import OevrigeKravSection from './eoOplysninger/sections/OevrigeKravSection';
import SaerligeKommentarerSection from './eoOplysninger/sections/SaerligeKommentarerSection';
import BilagsnumreSection from './eoOplysninger/sections/BilagsnumreSection';
import type { FieldIssueSet } from '../../../inputCore/inputIssue';

const EOOplysningerTab = React.memo(({
  values, stamdataValues, manualRegulationDateIssues, tafCutoffDateIssues, svieSmerteCutoffDateIssues,
}: {
  values: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
  manualRegulationDateIssues: FieldIssueSet;
  tafCutoffDateIssues: FieldIssueSet;
  svieSmerteCutoffDateIssues: FieldIssueSet;
}) => {
  // View-model-laget bygges her og deles med sektion-komponenterne via konteksten (jf. A1):
  // hver sektion forbruger `useEoOplysningerVm()` i stedet for at modtage props. Fanen er nu en
  // ren komposition af sektioner + den side-lokale løntrin-finder-overlay.
  const baseVm = useEoOplysningerViewModel(values, stamdataValues);
  const vm = React.useMemo(
    () => ({ ...baseVm, manualRegulationDateIssues, tafCutoffDateIssues, svieSmerteCutoffDateIssues }),
    [baseVm, manualRegulationDateIssues, tafCutoffDateIssues, svieSmerteCutoffDateIssues]
  );
  const { loentrinFinder } = baseVm;

  return (
    <EoOplysningerVmProvider value={vm}>
      <Box>
        <EoSagsinfoSection />
        <ForligSection />
        <AesAfgoerelserSection />
        <SvieSmerteSection />
        <TabtArbejdsfortjenesteSection />
        <IndtaegtFoerSkadenSection />

        <LoentrinFinderOverlay
          open={loentrinFinder.open}
          ansaettelse={loentrinFinder.ansaettelse}
          setAnsaettelse={loentrinFinder.setAnsaettelse}
          beloeb={loentrinFinder.beloeb}
          setBeloeb={loentrinFinder.setBeloeb}
          dato={loentrinFinder.dato}
          setDato={loentrinFinder.setDato}
          errors={loentrinFinder.errors}
          setErrors={loentrinFinder.setErrors}
          onAmountFieldError={loentrinFinder.handleAmountFieldError}
          onDateFieldError={loentrinFinder.handleDateFieldError}
          results={loentrinFinder.results}
          buttonShake={loentrinFinder.buttonShake}
          headingId={loentrinFinder.headingId}
          overenskomstLabel={loentrinFinder.overenskomstLabel}
          inputAmountNumber={loentrinFinder.inputAmountNumber}
          triggerRef={loentrinFinder.activeTriggerRef}
          onClose={loentrinFinder.closeFinder}
          onCalculate={loentrinFinder.handleCalculate}
        />

        <OevrigeKravSection />
        <SaerligeKommentarerSection />
        <BilagsnumreSection />
      </Box>
    </EoOplysningerVmProvider>
  );
});

EOOplysningerTab.displayName = 'EOOplysningerTab';

export default EOOplysningerTab;
