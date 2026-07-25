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

const EOOplysningerTab = React.memo(({ values, stamdataValues }: { values: ErstatningsopgoerelseValues; stamdataValues: StamdataValues }) => {
  // View-model-laget bygges her og deles med sektion-komponenterne via konteksten (jf. A1):
  // hver sektion forbruger `useEoOplysningerVm()` i stedet for at modtage props. Fanen er nu en
  // ren komposition af sektioner + den side-lokale løntrin-finder-overlay.
  const vm = useEoOplysningerViewModel(values, stamdataValues);
  const { loentrinFinder } = vm;

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
          open={loentrinFinder.loentrinFinderOpen}
          ansaettelse={loentrinFinder.loentrinFinderAnsaettelse}
          setAnsaettelse={loentrinFinder.setLoentrinFinderAnsaettelse}
          beloeb={loentrinFinder.loentrinFinderBeloeb}
          setBeloeb={loentrinFinder.setLoentrinFinderBeloeb}
          dato={loentrinFinder.loentrinFinderDato}
          setDato={loentrinFinder.setLoentrinFinderDato}
          errors={loentrinFinder.loentrinFinderErrors}
          setErrors={loentrinFinder.setLoentrinFinderErrors}
          onAmountFieldError={loentrinFinder.handleLoentrinFinderAmountFieldError}
          onDateFieldError={loentrinFinder.handleLoentrinFinderDateFieldError}
          results={loentrinFinder.loentrinFinderResults}
          buttonShake={loentrinFinder.loentrinFinderButtonShake}
          dialogRef={loentrinFinder.loentrinFinderDialogRef}
          loentrinFinderAnsaettelseRef={loentrinFinder.loentrinFinderAnsaettelseRef}
          loentrinFinderBeloebRef={loentrinFinder.loentrinFinderBeloebRef}
          loentrinFinderDatoRef={loentrinFinder.loentrinFinderDatoRef}
          beregnRef={loentrinFinder.loentrinFinderBeregnRef}
          headingId={loentrinFinder.loentrinFinderHeadingId}
          overenskomstLabel={loentrinFinder.loentrinFinderOverenskomstLabel}
          inputAmountNumber={loentrinFinder.loentrinFinderInputAmountNumber}
          onClose={loentrinFinder.closeLoentrinFinder}
          onCalculate={loentrinFinder.handleLoentrinFinderCalculate}
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
