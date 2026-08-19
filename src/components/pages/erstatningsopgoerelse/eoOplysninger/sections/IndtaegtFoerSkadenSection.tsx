import { Box, MenuItem, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import LabeledControlRow from '../../../../layout/LabeledControlRow';
import MappedToggleField from '../../../../../inputCore/react/fields/MappedToggleField';
import ChoiceField from '../../../../../inputCore/react/fields/ChoiceField';
import DateField from '../../../../../inputCore/react/fields/DateField';
import IntegerField from '../../../../../inputCore/react/fields/IntegerField';
import TextField from '../../../../../inputCore/react/fields/TextField';
import AmountField from '../../../../../inputCore/react/fields/AmountField';
import {
  eoAngivetDagsloenBaseretPaaField,
  eoAngivetDagsloenOpreguleresFraDatoField,
  eoAngivetMaanedsloenBaseretPaaField,
  eoAngivetMaanedsloenOpreguleresFraDatoField,
  eoBeregnesUdFraField,
  eoDagsloenenUdgoerField,
  eoKomprimerBeregningField,
  eoMaanedsloenenUdgoerField,
  eoOevrigeFravaersdageBeskrivelseField,
  eoOevrigeFravaersdageField,
  eoOevrigtFravaerUdenLoenField,
  eoTafBeregningsperiodeFraField,
  eoTafBeregningsperiodeTilField,
  eoUspecificeredeFerieFridageField,
} from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  eoAngivetLoenFields,
  eoAngivetLoenFilterFields,
  eoAngivetLoenManual,
} from '../../../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { CollectionRef } from '../../../../../inputCore/fieldAddress';
import FerieperiodeTable from '../../../../tables/FerieperiodeTable';
import LoenudviklingFields from '../../loenudvikling/LoenudviklingFields';
import AnciennitetstillaegFields from '../../loenudvikling/AnciennitetstillaegFields';
import { capitalizeFirstCharDa } from '../../../../../utils/formatUtils';
import { erTabtArbejdsfortjenesteSektionAktiv } from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { formatOverenskomstMetaDisplay, resolveOverenskomstDisplay } from '../../../../../data/overenskomstRates';
import { useEoOplysningerVm } from '../eoOplysningerContext';
import { APP_ROUTES } from '../../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../../config/eoTabKeys';

// route + tabKey er eksplicit navigation-metadata (§3.7); alle felter i denne sektion bor på EO-oplysningerfanen.
const eoOplyLocation = (locationId: string) => ({
  locationId,
  route: APP_ROUTES.erstatningsopgoerelse,
  tabKey: EO_TAB_KEYS.EO_OPLYSNINGER,
});

/**
 * De to overenskomst-filterdropdowns er bevidst kompakte (24 px høje, 11 px tekst), fordi de
 * står inline foran den brede overenskomstvælger. Stylingen var tidligere skrevet ordret to
 * gange lige efter hinanden; her er den ét sted, så de to filtre ikke kan drive fra hinanden.
 */
const OVERENSKOMST_FILTER_SX = {
  '& .MuiInputBase-root': {
    height: '24px !important',
    minHeight: '24px !important',
    paddingRight: '20px !important',
  },
  '& .MuiInputBase-input': {
    fontSize: '11px !important',
    padding: '0 4px 0 8px !important',
    lineHeight: '24px',
  },
  '& .MuiSvgIcon-root': {
    fontSize: '12px !important',
  },
} as const;

const OVERENSKOMST_FILTER_ICON_SX = {
  fontSize: '16px',
  right: 2,
} as const;

const OVERENSKOMST_FILTER_OPTION_SX = {
  fontSize: '11px',
  minHeight: '24px',
  padding: '3px 8px',
} as const;

/**
 * Sektion 5: indtægt før stamdatadatoen (beregningsmetode, beregningsperiode/ferie/fravær eller
 * angivet løn, lønudvikling og anciennitetstillæg). Hele sektionen er kun synlig når der beregnes tabt
 * arbejdsfortjeneste.
 */
export default function IndtaegtFoerSkadenSection() {
  const {
    values,
    eoLoenudvikling,
    skalKomprimereIndtaegtFoerSkaden,
    indtaegtFoerSkadenSectionTitle,
    fravaerFeriedageById,
    angivetLoenOpreguleringLabel,
    visLoenudviklingFraEO,
    loenudviklingBasis,
    alleLoenmodtagerOrg,
    alleArbejdsgiverOrg,
    filteredOverenskomster,
    erOffentligOverenskomst,
    offentligLoenEkstraGrundloenSuffix,
    loenudviklingBaseDateDisplay,
    loenudviklingBaseDateISO,
    loenudviklingBaseDateErrorMessage,
    loenudviklingBaseDateReferenceText,
    shouldShowReguleringsDatoInterval,
    reguleringsDatoIntervalDisplay,
    reguleringDocument,
    showEoAnciennitetstillaegSection,
    eoAnciennitetSatsPerTekst,
    loentrinFinder,
    manualRegulationDateIssues,
  } = useEoOplysningerVm();

  if (!erTabtArbejdsfortjenesteSektionAktiv(values)) return null;

  // «Angivet løn» har ÉN `Find løntrin`-knap, så finderen behøver ingen nøgle: den åbnes for sagens ene
  // overenskomst og husker bevidst ikke indtastningen mellem åbninger (modsat Lønindkomst).
  const loentrinFinderTriggerRef = loentrinFinder.registerTrigger('eoAngivetLoen');
  const openLoentrinFinder = () => {
    loentrinFinder.openFinder({
      overenskomstId: eoLoenudvikling.overenskomstId,
      offentligLoenType: eoLoenudvikling.offentligLoenType,
    });
  };

  /**
   * Bindingen til den delte Lønudvikling-flade. «Angivet løn» har én forekomst pr. sag, så
   * adresserne er statiske – modsat Lønindkomst, der binder pr. ansættelsesforhold.
   */
  const loenudviklingBinding = {
    loenudviklingBeregningsgrundlag: {
      field: eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(),
      location: eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag'),
    },
    loenudviklingStatistikModel: {
      field: eoAngivetLoenFields.loenudviklingStatistikModel.bind(),
      location: eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.loenudviklingStatistikModel'),
    },
    loenudviklingKRLSatstabel: {
      field: eoAngivetLoenFields.loenudviklingKRLSatstabel.bind(),
      location: eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.loenudviklingKRLSatstabel'),
    },
    loenudviklingManuelNavn: {
      field: eoAngivetLoenFields.loenudviklingManuelNavn.bind(),
      location: eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.loenudviklingManuelNavn'),
    },
    offentligLoenType: {
      field: eoAngivetLoenFields.offentligLoenType.bind(),
      location: eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.offentligLoenType'),
    },
    offentligLoenTrin: {
      field: eoAngivetLoenFields.offentligLoenTrin.bind(),
      location: eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.offentligLoenTrin'),
    },
    offentligLoenGruppe: {
      field: eoAngivetLoenFields.offentligLoenGruppe.bind(),
      location: eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.offentligLoenGruppe'),
    },
    offentligLoenEkstraGrundloen: {
      field: eoAngivetLoenFields.offentligLoenEkstraGrundloen.bind(),
      location: eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.offentligLoenEkstraGrundloen'),
    },
  };

  return (
        <ContentBox className="content-box" data-section-id="taf-beregningsgrundlag">
        <Typography className="section-header">{indtaegtFoerSkadenSectionTitle}</Typography>

        <LabeledControlRow label="Skjul beregning efter første opgørelse">
          {({ labelledBy, controlId }) => (
            <MappedToggleField
              field={eoKomprimerBeregningField.bind()}
              location={eoOplyLocation('erstatningsopgoerelse.komprimerBeregningEfterFoersteOpgoerelse')}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="komprimerBeregningEfterFoersteOpgoerelse"
              id={controlId}
              labelledBy={labelledBy}
            />
          )}
        </LabeledControlRow>

        {!skalKomprimereIndtaegtFoerSkaden && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Beregnes ud fra</Typography>
              <Box className="row--label-right-hover__content">
                <ChoiceField
                  field={eoBeregnesUdFraField.bind()}
                  location={eoOplyLocation('erstatningsopgoerelse.beregnesUdFra')}
                  name="beregnesUdFra"
                  width={200}
                  allowEmpty={false}
                >
                  <MenuItem value="Beregningsperiode">Beregningsperiode</MenuItem>
                  <MenuItem value="Angivet månedsløn">Angivet månedsløn</MenuItem>
                  <MenuItem value="Angivet dagsløn">Angivet dagsløn</MenuItem>
                </ChoiceField>
              </Box>
            </Box>

            {values.beregnesUdFra === 'Beregningsperiode' && (
              <>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">Periode til beregning af før-løn:</Typography>
                  <Box className="row--label-right-hover__content">
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <DateField
                        field={eoTafBeregningsperiodeFraField.bind()}
                        location={eoOplyLocation('erstatningsopgoerelse.tafBeregningsperiodeFra')}
                        name="tafBeregningsperiodeFra"
                      />
                      <Typography sx={{ minWidth: 'auto' }}>til:</Typography>
                      <DateField
                        field={eoTafBeregningsperiodeTilField.bind()}
                        location={eoOplyLocation('erstatningsopgoerelse.tafBeregningsperiodeTil')}
                        name="tafBeregningsperiodeTil"
                      />
                    </Box>
                  </Box>
                </Box>

                {/*
                  «Offentlige ydelser i beregningsperioden reguleres» stod tidligere her, men hører
                  sagligt til de offentlige ydelser og bor nu på Offentlige ydelser-fanen.
                  Feltet selv er uændret – kun editorlokationen er flyttet, og dermed den fane
                  fokusnavigationen fører brugeren til (§3.2).
                */}

                <Typography className="row--subheading">Ferie i beregningsperioden:</Typography>
                <FerieperiodeTable
                  kind="beregningsperiode"
                  committedRows={values.fravaerPerioder}
                  feriedageById={fravaerFeriedageById}
                  saveOrderPath="erstatningsopgoerelse.fravaerPerioder"
                />

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Uspecificerede ferie-/feriefridage</Typography>
                  <Box className="row--label-right-hover__content">
                    <IntegerField
                      field={eoUspecificeredeFerieFridageField.bind()}
                      location={eoOplyLocation('erstatningsopgoerelse.uspecificeredeFerieFridage')}
                      name="uspecificeredeFerieFridage"
                      width={80}
                    />
                  </Box>
                </Box>

                <Typography className="row--subheading">Øvrigt fravær i beregningsperioden:</Typography>

                <LabeledControlRow label="Øvrigt fravær uden løn">
                  {({ labelledBy, controlId }) => (
                    <MappedToggleField
                      field={eoOevrigtFravaerUdenLoenField.bind()}
                      location={eoOplyLocation('erstatningsopgoerelse.oevrigtFravaerUdenLoen')}
                      checkedValue="Ja"
                      uncheckedValue="Nej"
                      name="oevrigtFravaerUdenLoen"
                      id={controlId}
                      labelledBy={labelledBy}
                    />
                  )}
                </LabeledControlRow>

                {values.oevrigtFravaerUdenLoen === 'Ja' && (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Antal fraværsdage (mandag-fredag)</Typography>
                      <Box className="row--label-right-hover__content">
                        <IntegerField
                          field={eoOevrigeFravaersdageField.bind()}
                          location={eoOplyLocation('erstatningsopgoerelse.oevrigeFravaersdage')}
                          name="oevrigeFravaersdage"
                          width={80}
                        />
                      </Box>
                    </Box>

                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Årsag til fravær</Typography>
                      <Box className="row--label-right-hover__content">
                        <TextField
                          field={eoOevrigeFravaersdageBeskrivelseField.bind()}
                          location={eoOplyLocation('erstatningsopgoerelse.oevrigeFravaersdageBeskrivelse')}
                          name="oevrigeFravaersdageBeskrivelse"
                          width={300}
                          sx={{
                            '& .MuiInputBase-input': {
                              textAlign: 'right',
                            },
                          }}
                        />
                      </Box>
                    </Box>
                  </>
                )}
              </>
            )}

            {values.beregnesUdFra === 'Angivet månedsløn' && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">Månedslønnen udgør</Typography>
                <Box className="row--label-right-hover__content">
                <AmountField
                  field={eoMaanedsloenenUdgoerField.bind()}
                  location={eoOplyLocation('erstatningsopgoerelse.maanedsloenenUdgoer')}
                  name="maanedsloenenUdgoer"
                  width={150}
                />
                </Box>
              </Box>
            )}

            {values.beregnesUdFra === 'Angivet dagsløn' && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">Dagslønnen udgør</Typography>
                <Box className="row--label-right-hover__content">
                <AmountField
                  field={eoDagsloenenUdgoerField.bind()}
                  location={eoOplyLocation('erstatningsopgoerelse.dagsloenenUdgoer')}
                  name="dagsloenenUdgoer"
                  width={150}
                />
                </Box>
              </Box>
            )}

            {(values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn') && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">- baseret på</Typography>
                <Box className="row--label-right-hover__content">
                  <TextField
                    field={values.beregnesUdFra === 'Angivet månedsløn'
                      ? eoAngivetMaanedsloenBaseretPaaField.bind()
                      : eoAngivetDagsloenBaseretPaaField.bind()}
                    location={eoOplyLocation(values.beregnesUdFra === 'Angivet månedsløn'
                      ? 'erstatningsopgoerelse.angivetMaanedsloenBaseretPaa'
                      : 'erstatningsopgoerelse.angivetDagsloenBaseretPaa')}
                    name={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? 'angivetMaanedsloenBaseretPaa'
                        : 'angivetDagsloenBaseretPaa'
                    }
                    width={300}
                  />
                </Box>
              </Box>
            )}

            {(values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn') && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">{angivetLoenOpreguleringLabel}</Typography>
                <Box className="row--label-right-hover__content">
                  <DateField
                    field={values.beregnesUdFra === 'Angivet månedsløn'
                      ? eoAngivetMaanedsloenOpreguleresFraDatoField.bind()
                      : eoAngivetDagsloenOpreguleresFraDatoField.bind()}
                    location={eoOplyLocation(values.beregnesUdFra === 'Angivet månedsløn'
                      ? 'erstatningsopgoerelse.angivetMaanedsloenOpreguleresFraDato'
                      : 'erstatningsopgoerelse.angivetDagsloenOpreguleresFraDato')}
                    name={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? 'angivetMaanedsloenOpreguleresFraDato'
                        : 'angivetDagsloenOpreguleresFraDato'
                    }
                  />
                </Box>
              </Box>
            )}

            {visLoenudviklingFraEO && (
              <LoenudviklingFields
                binding={loenudviklingBinding}
                manualBindings={eoAngivetLoenManual}
                manualCollection={eoAngivetLoenManual.manualCollection.template as CollectionRef}
                manualPercentCollection={eoAngivetLoenManual.manualPercentCollection.template as CollectionRef}
                manualRows={eoLoenudvikling.loenudviklingManuelTableData}
                manualPercentRows={eoLoenudvikling.loenudviklingManuelProcentsatsTableData}
                manualRuleIssues={manualRegulationDateIssues}
                manualLocationPrefix="erstatningsopgoerelse.eoAngivetLoenLoenudvikling.loenudviklingManuelTableData"
                manualPercentLocationPrefix="erstatningsopgoerelse.eoAngivetLoenLoenudvikling.loenudviklingManuelProcentsatsTableData"
                // route + tabKey er eksplicit navigation-metadata (§3.7); her bor tabellerne på EO-oplysningerfanen.
                locationNav={{ route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                loenudviklingBasis={loenudviklingBasis}
                erOffentligOverenskomst={erOffentligOverenskomst}
                overenskomstSlot={
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Vælg overenskomst</Typography>
                    <Box className="row--label-right-hover__content">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {/* Lønmodtager filter dropdown - UI viser 'ALLE', domæne bruger undefined */}
                        <Typography sx={{ fontSize: '11px', lineHeight: '24px' }}>L:</Typography>
                        <ChoiceField
                          field={eoAngivetLoenFilterFields.loenmodtager.bind()}
                          location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.overenskomstFilter.loenmodtager')}
                          name="overenskomstFilter.loenmodtager"
                          emptyUiValue="ALLE"
                          width={120}
                          allowEmpty={false}
                          sx={OVERENSKOMST_FILTER_SX}
                          iconSx={OVERENSKOMST_FILTER_ICON_SX}
                          optionSx={OVERENSKOMST_FILTER_OPTION_SX}
                        >
                          <MenuItem value="ALLE">Alle</MenuItem>
                          {alleLoenmodtagerOrg.map((org) => (
                            <MenuItem key={org} value={org}>
                              {org}
                            </MenuItem>
                          ))}
                        </ChoiceField>

                        {/* Arbejdsgiver filter dropdown - UI viser 'ALLE', domæne bruger undefined */}
                        <Typography sx={{ fontSize: '11px', lineHeight: '24px' }}>A:</Typography>
                        <ChoiceField
                          field={eoAngivetLoenFilterFields.arbejdsgiver.bind()}
                          location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.overenskomstFilter.arbejdsgiver')}
                          name="overenskomstFilter.arbejdsgiver"
                          emptyUiValue="ALLE"
                          width={120}
                          allowEmpty={false}
                          sx={OVERENSKOMST_FILTER_SX}
                          iconSx={OVERENSKOMST_FILTER_ICON_SX}
                          optionSx={OVERENSKOMST_FILTER_OPTION_SX}
                        >
                          <MenuItem value="ALLE">Alle</MenuItem>
                          {alleArbejdsgiverOrg.map((org) => (
                            <MenuItem key={org} value={org}>
                              {org}
                            </MenuItem>
                          ))}
                        </ChoiceField>

                        <ChoiceField
                          field={eoAngivetLoenFields.overenskomstId.bind()}
                          location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.overenskomstId')}
                          name="overenskomstId"
                          width={460}
                          placeholder="Vælg overenskomst..."
                          allowEmpty={true}
                          getOptionLabel={(id) => resolveOverenskomstDisplay(typeof id === 'string' ? id : String(id))}
                        >
                          {filteredOverenskomster.map((meta) => (
                            <MenuItem key={meta.id} value={meta.id}>
                              {formatOverenskomstMetaDisplay(meta)}
                            </MenuItem>
                          ))}
                        </ChoiceField>
                      </Box>
                    </Box>
                  </Box>
                }
                offentligLoenEkstraGrundloenSuffix={offentligLoenEkstraGrundloenSuffix}
                onOpenLoentrinFinder={openLoentrinFinder}
                loentrinFinderTriggerRef={loentrinFinderTriggerRef}
                baseDateDisplay={loenudviklingBaseDateDisplay}
                baseDateISO={loenudviklingBaseDateISO}
                baseDateErrorMessage={loenudviklingBaseDateErrorMessage}
                /*
                  Forklaringen bag basisdatoen manglede tidligere på DENNE overflade, selv om VM'en
                  allerede beregnede `loenudviklingBaseDateReferenceText`. Tabellen viste derfor
                  låst basisdato uden at kunne forklare hvor datoen kom fra – modsat Lønindkomst.
                */
                baseDateInfoTooltipText={
                  loenudviklingBaseDateDisplay === '' || loenudviklingBaseDateReferenceText === ''
                    ? undefined
                    : capitalizeFirstCharDa(loenudviklingBaseDateReferenceText)
                }
                manualNavnWidth={350}
                shouldShowReguleringsDatoInterval={shouldShowReguleringsDatoInterval}
                reguleringsDatoIntervalDisplay={reguleringsDatoIntervalDisplay}
                reguleringDocument={reguleringDocument}
                hasManualBaseRow={eoLoenudvikling.loenudviklingManuelTableData.length > 0}
                hasManualPercentBaseRow={eoLoenudvikling.loenudviklingManuelProcentsatsTableData.length > 0}
                /*
                  «Angivet løn» har ingen satsfelter over tabellen, så basisrækkens procentfelter
                  er altid brugerens egne – der er intet at spejle og intet at låse.
                */
                readOnlyBaseRowPercentFields={false}
                baseRowPercentErrors={undefined}
                fieldNamePrefix=""
              />
            )}

            {showEoAnciennitetstillaegSection ? (
              <AnciennitetstillaegFields
                binding={{
                  anciennitetstillaegDato: {
                    field: eoAngivetLoenFields.anciennitetstillaegDato.bind(),
                    location: eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.anciennitetstillaegDato'),
                  },
                  anciennitetstillaegSats: {
                    field: eoAngivetLoenFields.anciennitetstillaegSats.bind(),
                    location: eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.anciennitetstillaegSats'),
                  },
                }}
                toggleSlot={({ labelledBy, controlId }) => (
                  <MappedToggleField
                    field={eoAngivetLoenFields.harAnciennitetstillaegEfterSkadedatoen.bind()}
                    location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.harAnciennitetstillaegEfterSkadedatoen')}
                    checkedValue={true}
                    uncheckedValue={false}
                    name="harAnciennitetstillaegEfterSkadedatoen"
                    // Etiketten ejes af AnciennitetstillaegFields, som leverer bindingen her.
                    id={controlId}
                    labelledBy={labelledBy}
                  />
                )}
                harAnciennitetstillaeg={Boolean(eoLoenudvikling.harAnciennitetstillaegEfterSkadedatoen)}
                referenceText={loenudviklingBaseDateReferenceText}
                satsPerTekst={eoAnciennitetSatsPerTekst}
                // Denne overflade UDLEDER enheden af `beregnesUdFra` og viser derfor intet valg.
                satsEnhedSlot={null}
                fieldNamePrefix=""
              />
            ) : null}
          </>
        )}
      </ContentBox>
  );
}
