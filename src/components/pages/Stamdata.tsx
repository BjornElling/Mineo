import React from 'react';
import { Box, CircularProgress, MenuItem, Typography } from '@mui/material';

import { useAppSettings } from '../../contexts/useAppSettings';
import { skadestypeEnum } from '../../schemas/formSchemas';
import { resolveStamdataDatoLabel } from '../../domain/policies';
import {
  stamdataJournalnrField,
  stamdataAdvokatField,
  stamdataSagsbehandlerField,
  stamdataSkadelidteField,
  stamdataSkadelidteFodselsdatoField,
  stamdataSkadestypeField,
  stamdataSkadedatoField,
} from '../../inputCore/catalog/stamdataDescriptors';
import { useInputEvaluation } from '../../inputCore/react';
import GreenfieldChoiceField from '../../inputCore/react/fields/GreenfieldChoiceField';
import GreenfieldDateField from '../../inputCore/react/fields/GreenfieldDateField';
import GreenfieldTextField from '../../inputCore/react/fields/GreenfieldTextField';
import ContentBox from '../layout/ContentBox';
import SideTab from '../layout/SideTab';
const StamdataTestTab = React.lazy(async () => import('./StamdataTestTab'));

// Greenfield-migreret (§2.4, formularrækkefølge trin 1 — FØRSTE callsite-cutover). Erstatter den legacy
// `usePersistedForm`+`Styled*Field`+`useFormFieldErrorReporter`-vej med de tynde `Greenfield*Field`-skaller.
// Hvert felt modtager KUN sin konkrete `field` (descriptor.bind()) og `location` (stabilt locationId) — ingen
// `value`/`onCommit`/`parse`/`format`/`onFieldError`/`min`/`max`. Datomodellens kronologiske bounds er
// feltvalidatorer, ikke props; de er koblet til runtime-issuet og giver samme røde feltfejl på tværs af consumers.

// Afled dropdown-valgmulighederne fra schemaets enum, så UI og validering aldrig kan komme ud af sync.
const SKADESTYPER = skadestypeEnum.options;

// Bundne field-refs (stabile — alle Stamdata-felter er top-level skalarer uden entity-id).
const journalnrRef = stamdataJournalnrField.bind();
const advokatRef = stamdataAdvokatField.bind();
const sagsbehandlerRef = stamdataSagsbehandlerField.bind();
const skadelidteRef = stamdataSkadelidteField.bind();
const skadelidteFodselsdatoRef = stamdataSkadelidteFodselsdatoField.bind();
const skadestypeRef = stamdataSkadestypeField.bind();
const skadedatoRef = stamdataSkadedatoField.bind();

// Stabil editorlokation pr. felt (§3.2): locationId er editor-metadata, ikke datafeltets identitet.
const loc = (field: string) => ({ locationId: `stamdata:${field}` });

const Stamdata = React.memo(() => {
  const { settings } = useAppSettings();
  // Test-fanen er DEV-only: indstillingen kan kun slås til i udviklingsmiljøet, og
  // selve visningen er gated på import.meta.env.DEV, så en localStorage-værdi gemt
  // under en dev-session aldrig aktiverer fanen i en produktions-build.
  const showTestTab = import.meta.env.DEV && settings.showStamdataTestTab;
  const [activeTab, setActiveTab] = React.useState<'stamdata' | 'test'>('stamdata');

  // Hvis test-tab slås fra mens den er aktiv, skift tilbage til stamdata
  React.useEffect(() => {
    if (!showTestTab && activeTab === 'test') {
      setActiveTab('stamdata');
    }
  }, [showTestTab, activeTab]);

  // Den dynamiske datolabel afhænger af den afsluttede skadestype-værdi (§1.2) og læses gennem samme offentlige
  // reader som øvrige consumers. Et fejlende felt kan derfor aldrig omgå issue-grænsen via rå canonical read.
  const evaluation = useInputEvaluation();
  const skadestypeRead = evaluation.reader.read(skadestypeRef);
  const skadestype = skadestypeRead.status === 'usable' ? skadestypeRead.value : undefined;
  const datoLabel = React.useMemo(
    () => resolveStamdataDatoLabel(skadestype === undefined ? null : { skadestype }),
    [skadestype]
  );

  return (
    <Box>
      <Typography className="page-title">Stamdata</Typography>

      {/* Indhold med test-tab i højre side */}
      <Box sx={{ position: 'relative' }}>
        {/* Test-tab (roteret 90° til højre, placeret ved højrekanten af ContentBox) */}
        {showTestTab && (
          <SideTab
            label="Test"
            active={activeTab === 'test'}
            onClick={() => setActiveTab('test')}
            top="-25px"
          />
        )}

        {/* Stamdata-indhold */}
        <Box
          role="tabpanel"
          hidden={activeTab !== 'stamdata'}
          sx={{ display: activeTab === 'stamdata' ? 'block' : 'none' }}
        >
          <ContentBox className="content-box" data-section-id="stamdata-sagsinfo">
            <Typography className="section-header">Sagsinfo</Typography>

            <Box className="row--label-offset">
              <Typography className="row--text" sx={{ minWidth: '250px' }}>
                Journalnr.
              </Typography>
              <Box className="row--label-offset__content">
                <GreenfieldTextField field={journalnrRef} location={loc('journalnr')} name="journalnr" width={220} />
              </Box>
            </Box>

            <Box className="row--label-offset">
              <Typography className="row--text" sx={{ minWidth: '250px' }}>
                Advokat/Sagsbehandler
              </Typography>
              <Box className="row--label-offset__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GreenfieldTextField
                    field={advokatRef}
                    location={loc('advokat')}
                    name="advokat"
                    placeholder="(init.)"
                    width={80}
                    sx={{ '& input': { textAlign: 'center' } }}
                  />
                  <Typography className="row--text">/</Typography>
                  <GreenfieldTextField
                    field={sagsbehandlerRef}
                    location={loc('sagsbehandler')}
                    name="sagsbehandler"
                    placeholder="(init.)"
                    width={80}
                    sx={{ '& input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>
          </ContentBox>

          <ContentBox className="content-box" data-section-id="stamdata-skadelidte">
            <Typography className="section-header">Skadelidte</Typography>

            <Box className="row--label-offset">
              <Typography className="row--text" sx={{ minWidth: '250px' }}>
                Skadelidtes navn
              </Typography>
              <Box className="row--label-offset__content">
                <GreenfieldTextField field={skadelidteRef} location={loc('skadelidte')} name="skadelidte" width={350} />
              </Box>
            </Box>

            <Box className="row--label-offset">
              <Typography className="row--text" sx={{ minWidth: '250px' }}>
                Fødselsdato
              </Typography>
              <Box className="row--label-offset__content">
                <GreenfieldDateField
                  field={skadelidteFodselsdatoRef}
                  location={loc('skadelidteFodselsdato')}
                  name="skadelidteFodselsdato"
                />
              </Box>
            </Box>

            <Box className="row--label-offset">
              <Typography className="row--text" sx={{ minWidth: '250px' }}>
                Skadestype
              </Typography>
              <Box className="row--label-offset__content">
                <GreenfieldChoiceField
                  field={skadestypeRef}
                  location={loc('skadestype')}
                  name="skadestype"
                  placeholder="Vælg skadestype"
                  width={200}
                >
                  {SKADESTYPER.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </GreenfieldChoiceField>
              </Box>
            </Box>

            <Box className="row--label-offset">
              <Typography className="row--text" sx={{ minWidth: '250px' }}>
                {datoLabel}
              </Typography>
              <Box className="row--label-offset__content">
                <GreenfieldDateField field={skadedatoRef} location={loc('skadedato')} name="skadedato" />
              </Box>
            </Box>
          </ContentBox>
        </Box>

        {/* Test-indhold */}
        {showTestTab && (
          <Box
            role="tabpanel"
            hidden={activeTab !== 'test'}
            sx={{ display: activeTab === 'test' ? 'block' : 'none' }}
          >
            <React.Suspense fallback={<CircularProgress />}>
              <StamdataTestTab />
            </React.Suspense>
          </Box>
        )}
      </Box>
    </Box>
  );
});

Stamdata.displayName = 'Stamdata';

export default Stamdata;
