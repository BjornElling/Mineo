import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';
import StyledCheckbox from '../inputs/StyledCheckbox';
import StyledToggleSwitch from '../inputs/StyledToggleSwitch';
import StyledDropdown from '../inputs/StyledDropdown';
import StyledRadioButton from '../inputs/StyledRadioButton';
import type { CommitEvent } from '../../types/fieldEvents';
import { useAppSettings } from '../../contexts/useAppSettings';
import ContentBox from '../layout/ContentBox';
import LabeledControlRow from '../layout/LabeledControlRow';
import { getAlleLoenmodtagerOrg, getAlleArbejdsgiverOrg } from '../../data/overenskomstRates';
import DefaultDirectoryRow from './indstillinger/DefaultDirectoryRow';
import {
  APP_SETTINGS_AFSLUTTES_MED_OPTIONS,
  APP_SETTINGS_LOEN_PAA_HELLIGDAGE_OPTIONS,
  type BrevhovedIndstillinger,
} from '../../settings/appSettingsSchema';
import { DOCUMENT_DOWNLOAD_FORMAT_OPTIONS, getDocumentFormatLabel } from '../../document/documentFormat';
import { DOCUMENT_BREVHOVED_LABELS, type DocumentBrevhovedType } from '../../document/layout/documentBrevhoved';
import {
  LOENPERIODE_LABELS,
  SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_LABELS,
} from '../../schemas/formSchemas';

type BrevhovedOption = Readonly<{
  key: keyof BrevhovedIndstillinger;
  label: string;
}>;

/**
 * Kun RÆKKE-OPDELINGEN er sidens egen — hvilke checkbokse der står på hvilken linje er et
 * layoutvalg her. Etiketterne kommer fra dokument-laget (`DOCUMENT_BREVHOVED_LABELS`), så
 * siden ikke kan kalde et dokument noget andet, end dokumentet kalder sig selv.
 */
const brevhovedKeyRows: readonly (readonly DocumentBrevhovedType[])[] = [
  ['erstatningsopgoerelse', 'erhvervsevnetab', 'varigeMen'],
  ['forsoergertab', 'aarsloensberegning', 'renteberegning', 'satser'],
  ['shDage', 'regulering'],
];

const [brevhovedOptionsRow1, brevhovedOptionsRow2, brevhovedOptionsRow3] = brevhovedKeyRows.map(
  (keys): readonly BrevhovedOption[] => keys.map((key) => ({ key, label: DOCUMENT_BREVHOVED_LABELS[key] }))
);

const loenIndtastesSomOptions = LOENPERIODE_LABELS.options;

const svieSmerteDelvisSygemeldingSatsOptions = SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_LABELS.options;

const udloebMaanederOptions = Array.from({ length: 13 }, (_, index) => index);

const BrevhovedCheckboxRow = React.memo((props: {
  items: readonly BrevhovedOption[];
  checked: BrevhovedIndstillinger;
  onToggle: (key: keyof BrevhovedIndstillinger, checked: boolean) => boolean;
}) => {
  const { items, checked, onToggle } = props;
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {items.map(({ key, label }) => (
        <StyledCheckbox
          key={key}
          checked={checked[key]}
          onCommit={(event) => onToggle(key, event.target.value)}
          label={label}
          size="small"
        />
      ))}
    </Box>
  );
});

BrevhovedCheckboxRow.displayName = 'BrevhovedCheckboxRow';

/**
 * Indstillinger-side
 *
 * Programindstillinger (device-lokale) – gemmes i localStorage og indgår ikke i `.eo` filer.
 *
 * VIGTIGT (trust-kritisk + persistence-adskillelse):
 * - Disse indstillinger er ikke en del af sagsdata.
 * - `.eo` filer må kun indeholde schema-valideret brugerinput fra de registrerede sagssektioner.
 *
 * Refs:
 * - `src/contracts/app-settings.md`
 */
const Indstillinger = React.memo(() => {
  const { settings, updateSettings } = useAppSettings();

  const handleBrevhovedToggle = React.useCallback((key: keyof BrevhovedIndstillinger, checked: boolean) => {
    const newBrevhovedIndstillinger: BrevhovedIndstillinger = {
      ...settings.brevhovedIndstillinger,
      [key]: checked,
    };
    return updateSettings({ brevhovedIndstillinger: newBrevhovedIndstillinger });
  }, [settings.brevhovedIndstillinger, updateSettings]);

  // Hent alle organisationer til overenskomst-dropdowns
  const alleLoenmodtagerOrg = React.useMemo(() => getAlleLoenmodtagerOrg(), []);
  const alleArbejdsgiverOrg = React.useMemo(() => getAlleArbejdsgiverOrg(), []);

  return (
    <Box>
      {/* Side-header */}
      <Typography className="page-title">Indstillinger</Typography>

      <ContentBox className="content-box">
        <Typography className="section-header">System</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Farvetema</Typography>
          <Box className="row--label-right-hover__content">
            <StyledRadioButton
              ariaLabel="Farvetema"
              value={settings.themeMode}
              onCommit={(event) => {
                const nextThemeMode = event.target.value;
                if (nextThemeMode === 'light' || nextThemeMode === 'dark') {
                  return updateSettings({ themeMode: nextThemeMode });
                }
                return false;
              }}
              row={true}
              options={[
                { value: 'light', label: 'Lyst' },
                { value: 'dark', label: 'Mørkt' },
              ]}
            />
          </Box>
        </Box>

        <DefaultDirectoryRow />

        <Box className="row--label-right-hover">
          <Typography className="row--text">Download-format for dokumenter</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              ariaLabel="Download-format for dokumenter"
              allowEmpty={false}
              value={settings.documentDownloadFormat}
              onChange={(e) => {
                updateSettings({ documentDownloadFormat: e.target.value });
              }}
              width={120}
            >
              {DOCUMENT_DOWNLOAD_FORMAT_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {getDocumentFormatLabel(option)}
                </MenuItem>
              ))}
            </StyledDropdown>
          </Box>
        </Box>

        <Box className="row--label-right-hover" sx={{ alignItems: 'flex-start' }}>
          <Typography className="row--text">Indsæt brevhoved i</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0 }}>
              {/* Første række: Erstatningsopgørelse, Erhvervsevnetab, Varige mén */}
              <BrevhovedCheckboxRow
                items={brevhovedOptionsRow1}
                checked={settings.brevhovedIndstillinger}
                onToggle={handleBrevhovedToggle}
              />
              <BrevhovedCheckboxRow
                items={brevhovedOptionsRow2}
                checked={settings.brevhovedIndstillinger}
                onToggle={handleBrevhovedToggle}
              />
              <BrevhovedCheckboxRow
                items={brevhovedOptionsRow3}
                checked={settings.brevhovedIndstillinger}
                onToggle={handleBrevhovedToggle}
              />
            </Box>
          </Box>
        </Box>
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Standardværdier</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--subheading-underlined">Tabt arbejdsfortjeneste</Typography>
          <Box className="row--label-right-hover__content" />
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Løn indtastes som:</Typography>
          <Box className="row--label-right-hover__content">
            <StyledRadioButton
              ariaLabel="Løn indtastes som"
              value={settings.defaultLoenIndtastesSom}
              onCommit={(event) => {
                const next = event.target.value;
                if (next === undefined) return false;
                return updateSettings({ defaultLoenIndtastesSom: next });
              }}
              row={true}
              options={loenIndtastesSomOptions}
            />
          </Box>
        </Box>

        <LabeledControlRow label="Fuld løn under ferie">
          {({ labelledBy, controlId }) => (
            <StyledToggleSwitch
              id={controlId}
              labelledBy={labelledBy}
              checked={settings.defaultFuldLoenUnderFerie}
              onCommit={(e: CommitEvent<boolean>) => updateSettings({ defaultFuldLoenUnderFerie: e.target.value })}
            />
          )}
        </LabeledControlRow>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Løn på helligdage</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              ariaLabel="Løn på helligdage"
              allowEmpty={false}
              value={settings.defaultLoenPaaHelligdage}
              onChange={(e) => {
                updateSettings({ defaultLoenPaaHelligdage: e.target.value });
              }}
              width={185}
            >
              {APP_SETTINGS_LOEN_PAA_HELLIGDAGE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </StyledDropdown>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Overenskomstparter</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">L:</Typography>
              <StyledDropdown
                ariaLabel="Lønmodtager"
                value={settings.defaultOverenskomstLoenmodtager}
                onChange={(e) => {
                  // Alle dropdownens string-værdier er gyldige her; schemaet håndhæver kun at feltet er en string.
                  updateSettings({ defaultOverenskomstLoenmodtager: e.target.value });
                }}
                width={200}
                allowEmpty={false}
              >
                <MenuItem value="ALLE">Alle</MenuItem>
                {alleLoenmodtagerOrg.map((org) => (
                  <MenuItem key={org} value={org}>
                    {org}
                  </MenuItem>
                ))}
              </StyledDropdown>

              <Typography className="row--text">A:</Typography>
              <StyledDropdown
                ariaLabel="Arbejdsgiver"
                value={settings.defaultOverenskomstArbejdsgiver}
                onChange={(e) => {
                  // Alle dropdownens string-værdier er gyldige her; schemaet håndhæver kun at feltet er en string.
                  updateSettings({ defaultOverenskomstArbejdsgiver: e.target.value });
                }}
                width={200}
                allowEmpty={false}
              >
                <MenuItem value="ALLE">Alle</MenuItem>
                {alleArbejdsgiverOrg.map((org) => (
                  <MenuItem key={org} value={org}>
                    {org}
                  </MenuItem>
                ))}
              </StyledDropdown>
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--subheading-underlined">Svie- og smerte</Typography>
          <Box className="row--label-right-hover__content" />
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Svie/smerte-sats ved delvis sygemelding</Typography>
          <Box className="row--label-right-hover__content">
            <StyledRadioButton
              ariaLabel="Svie/smerte-sats ved delvis sygemelding"
              value={settings.defaultSvieSmerteDelvisSygemeldingSats}
              onCommit={(event) => {
                const next = event.target.value;
                if (next === undefined) return false;
                return updateSettings({ defaultSvieSmerteDelvisSygemeldingSats: next });
              }}
              row={true}
              options={svieSmerteDelvisSygemeldingSatsOptions}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--subheading-underlined">Erstatningsopgørelse</Typography>
          <Box className="row--label-right-hover__content" />
        </Box>

        <LabeledControlRow label="Udkast-stempel på nye dokumenter">
          {({ labelledBy, controlId }) => (
            <StyledToggleSwitch
              id={controlId}
              labelledBy={labelledBy}
              checked={settings.defaultIndsaetUdkastStempel}
              onCommit={(e: CommitEvent<boolean>) => updateSettings({ defaultIndsaetUdkastStempel: e.target.value })}
            />
          )}
        </LabeledControlRow>

        <LabeledControlRow label="Bilagsnumre i erstatningsopgørelser">
          {({ labelledBy, controlId }) => (
            <StyledToggleSwitch
              id={controlId}
              labelledBy={labelledBy}
              checked={settings.defaultVisBilagsnumre}
              onCommit={(e: CommitEvent<boolean>) => updateSettings({ defaultVisBilagsnumre: e.target.value })}
            />
          )}
        </LabeledControlRow>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Opgørelse afsluttes med</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              ariaLabel="Opgørelse afsluttes med"
              allowEmpty={false}
              value={settings.erstatningsopgoerelseAfsluttesMed}
              onChange={(e) => {
                updateSettings({ erstatningsopgoerelseAfsluttesMed: e.target.value });
              }}
              width={220}
            >
              {APP_SETTINGS_AFSLUTTES_MED_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </StyledDropdown>
          </Box>
        </Box>
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Beregningsteknisk</Typography>

        <LabeledControlRow label="Tillad regulering med overenskomst, der ikke dækker hele perioden">
          {({ labelledBy, controlId }) => (
            <StyledToggleSwitch
              id={controlId}
              labelledBy={labelledBy}
              checked={settings.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden}
              onCommit={(e: CommitEvent<boolean>) =>
                updateSettings({ allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: e.target.value })
              }
            />
          )}
        </LabeledControlRow>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Efter udløb anses overenskomst for forældet efter</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StyledDropdown
                ariaLabel="Efter udløb anses overenskomst for forældet efter"
                allowEmpty={false}
                value={settings.allowReguleringMedUdloebMedMaaneder}
                onChange={(e) => {
                  // Kun værdier fra udloebMaanederOptions kan nå hertil; schemaets min/max er defensiv backup.
                  updateSettings({ allowReguleringMedUdloebMedMaaneder: e.target.value });
                }}
                width={80}
              >
                {udloebMaanederOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </StyledDropdown>
              <Typography className="row--text">måneder</Typography>
            </Box>
          </Box>
        </Box>
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Kontrol</Typography>

        <LabeledControlRow label="Vis knap til at rapportere fejl og forbedringsønsker på indholdsbokse">
          {({ labelledBy, controlId }) => (
            <StyledToggleSwitch
              id={controlId}
              labelledBy={labelledBy}
              checked={settings.showContentBoxReportButton}
              onCommit={(e: CommitEvent<boolean>) => updateSettings({ showContentBoxReportButton: e.target.value })}
            />
          )}
        </LabeledControlRow>

        <LabeledControlRow label="Vis kontrolfaner på Erstatningsopgørelse-side">
          {({ labelledBy, controlId }) => (
            <StyledToggleSwitch
              id={controlId}
              labelledBy={labelledBy}
              checked={settings.showEOInspektionMenu}
              onCommit={(e: CommitEvent<boolean>) => updateSettings({ showEOInspektionMenu: e.target.value })}
            />
          )}
        </LabeledControlRow>

        {/* DEV-only: denne indstilling vises kun i udviklingsmiljøet (import.meta.env.DEV).
            Den forbrugende adfærd er ligeledes DEV-gated (font-style-farver i AppSettingsContext),
            så en værdi der er gemt i localStorage under en dev-session aldrig kan aktivere
            adfærden i en produktions-build. */}
        {import.meta.env.DEV && (
          <>
            <LabeledControlRow label="Farvemarkering af font-styles">
              {({ labelledBy, controlId }) => (
                <StyledToggleSwitch
                  id={controlId}
                  labelledBy={labelledBy}
                  checked={settings.fontStyleColorDebug}
                  onCommit={(e: CommitEvent<boolean>) => updateSettings({ fontStyleColorDebug: e.target.value })}
                />
              )}
            </LabeledControlRow>
          </>
        )}

      </ContentBox>
    </Box>
  );
});

Indstillinger.displayName = 'Indstillinger';

export default Indstillinger;
