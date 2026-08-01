import { Box, IconButton, MenuItem, Tooltip, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DocumentDownloadButton from '../../../../inputs/DocumentDownloadButton';
import DocumentOutcomeMessage from '../../../../inputs/DocumentOutcomeMessage';
import ContentBox from '../../../../layout/ContentBox';
import InfoTooltipIcon from '../../../../common/InfoTooltipIcon';
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
  eoRegulerOffentligeYdelserField,
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
import { ChoiceDivider } from '../../../../../inputCore/react/fields/ChoiceField';
import FerieperiodeTable from '../../../../tables/FerieperiodeTable';
import LoenudviklingManuelTable from '../../../../tables/LoenudviklingManuelTable';
import LoenudviklingManuelProcentsatsTable from '../../../../tables/LoenudviklingManuelProcentsatsTable';
import { erTabtArbejdsfortjenesteSektionAktiv } from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { formatOverenskomstMetaDisplay, resolveOverenskomstDisplay } from '../../../../../data/overenskomstRates';
import { ASL_AARSLOENSMAKSIMUM_MODEL_LABEL } from '../../../../../data/statistiskeRates';
import { krlSatstabelEnum, offentligLoenTypeEnum } from '../../../../../schemas/formSchemas';
import { useEoOplysningerVm } from '../eoOplysningerContext';
import { APP_ROUTES } from '../../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../../config/eoTabKeys';
import { createManualRegulationBasisCommitOverride } from '../../../../../domain/erstatningsopgoerelse/manualRegulationBasisCommit';

// route + tabKey er eksplicit navigation-metadata (§3.7); alle felter i denne sektion bor på EO-oplysningerfanen.
const eoOplyLocation = (locationId: string) => ({
  locationId,
  route: APP_ROUTES.erstatningsopgoerelse,
  tabKey: EO_TAB_KEYS.EO_OPLYSNINGER,
});

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

  return (
        <ContentBox className="content-box" data-section-id="taf-beregningsgrundlag">
        <Typography className="section-header">{indtaegtFoerSkadenSectionTitle}</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Skjul beregning efter første opgørelse</Typography>
          <Box className="row--label-right-hover__content">
            <MappedToggleField
              field={eoKomprimerBeregningField.bind()}
              location={eoOplyLocation('erstatningsopgoerelse.komprimerBeregningEfterFoersteOpgoerelse')}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="komprimerBeregningEfterFoersteOpgoerelse"
            />
          </Box>
        </Box>

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

                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    Offentlige ydelser i beregningsperioden reguleres
                    <InfoTooltipIcon title="Offentlige ydelser fremskrives efter statslig praksis med tilpasningsprocenten + 2 % per 1. januar" />
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <MappedToggleField
                      field={eoRegulerOffentligeYdelserField.bind()}
                      location={eoOplyLocation('erstatningsopgoerelse.regulerOffentligeYdelser')}
                      checkedValue="Ja"
                      uncheckedValue="Nej"
                      name="regulerOffentligeYdelser"
                    />
                  </Box>
                </Box>

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

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Øvrigt fravær uden løn</Typography>
                  <Box className="row--label-right-hover__content">
                    <MappedToggleField
                      field={eoOevrigtFravaerUdenLoenField.bind()}
                      location={eoOplyLocation('erstatningsopgoerelse.oevrigtFravaerUdenLoen')}
                      checkedValue="Ja"
                      uncheckedValue="Nej"
                      name="oevrigtFravaerUdenLoen"
                    />
                  </Box>
                </Box>

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
              <>
                <Typography className="row--subheading">Lønudvikling</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Lønudvikling beregnes ud fra</Typography>
                  <Box className="row--label-right-hover__content">
                      <ChoiceField
                        field={eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind()}
                        location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag')}
                        immediateCommitOverride={createManualRegulationBasisCommitOverride({
                          field: eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(),
                          location: eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag'),
                          manualCollection: eoAngivetLoenManual.manualCollection.template as CollectionRef,
                          manualPercentCollection: eoAngivetLoenManual.manualPercentCollection.template as CollectionRef,
                          hasManualBaseRow: eoLoenudvikling.loenudviklingManuelTableData.length > 0,
                          hasManualPercentBaseRow: eoLoenudvikling.loenudviklingManuelProcentsatsTableData.length > 0,
                        })}
                      name="loenudviklingBeregningsgrundlag"
                      width={220}
                      allowEmpty={true}
                      placeholder="Vælg..."
                    >
                      <MenuItem value="Overenskomst">Overenskomst</MenuItem>
                      <MenuItem value="Statistik">Statistik</MenuItem>
                      <MenuItem value="KRL satstabel">KRL satstabel</MenuItem>
                      <MenuItem value="KL-lønaftaler">KL-lønaftaler</MenuItem>
                      <ChoiceDivider />
                      <MenuItem value="Manuelt angivet">Manuelt angivet</MenuItem>
                      <MenuItem value="Manuel procentsats">Manuel procentsats</MenuItem>
                      <ChoiceDivider />
                      <MenuItem value="Ingen">Ingen</MenuItem>
                    </ChoiceField>
                  </Box>
                </Box>

                {loenudviklingBasis === 'Overenskomst' ? (
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
                          sx={{
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
                          }}
                          iconSx={{
                            fontSize: '16px',
                            right: 2,
                          }}
                          optionSx={{
                            fontSize: '11px',
                            minHeight: '24px',
                            padding: '3px 8px',
                          }}
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
                          sx={{
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
                          }}
                          iconSx={{
                            fontSize: '16px',
                            right: 2,
                          }}
                          optionSx={{
                            fontSize: '11px',
                            minHeight: '24px',
                            padding: '3px 8px',
                          }}
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
                ) : null}

                {loenudviklingBasis === 'Overenskomst' && erOffentligOverenskomst ? (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Lønoplysninger</Typography>
                      <Box className="row--label-right-hover__content">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography className="row--text">Ansættelse</Typography>
                          <ChoiceField
                            field={eoAngivetLoenFields.offentligLoenType.bind()}
                            location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.offentligLoenType')}
                            name="offentligLoenType"
                            width={160}
                            allowEmpty={false}
                          >
                            {offentligLoenTypeEnum.options.map((option) => (
                              <MenuItem key={option} value={option}>
                                {option}
                              </MenuItem>
                            ))}
                          </ChoiceField>
                          <Typography className="row--text">Løntrin</Typography>
                          <IntegerField
                            field={eoAngivetLoenFields.offentligLoenTrin.bind()}
                            location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.offentligLoenTrin')}
                            name="offentligLoenTrin"
                            width={80}
                          />
                          <Typography className="row--text">Gruppe</Typography>
                          <IntegerField
                            field={eoAngivetLoenFields.offentligLoenGruppe.bind()}
                            location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.offentligLoenGruppe')}
                            name="offentligLoenGruppe"
                            width={70}
                          />
                          <Tooltip title="Find løntrin" arrow>
                            <IconButton
                              onClick={loentrinFinder.openLoentrinFinder}
                              tabIndex={-1}
                              aria-label="Find løntrin"
                              sx={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                transition: 'background-color 0.2s',
                                '&:hover': {
                                  backgroundColor: 'var(--color-icon-action-hover)',
                                },
                                '&:active': {
                                  backgroundColor: 'var(--color-icon-action-active)',
                                },
                              }}
                            >
                              <SearchIcon
                                sx={{
                                  fontSize: '24px',
                                  color: 'primary.main',
                                }}
                              />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </Box>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Evt. forhøjet grundløn udover løntrin</Typography>
                      <Box className="row--label-right-hover__content">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AmountField
                            field={eoAngivetLoenFields.offentligLoenEkstraGrundloen.bind()}
                            location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.offentligLoenEkstraGrundloen')}
                            name="offentligLoenEkstraGrundloen"
                            width={160}
                          />
                          <Typography className="row--text">{offentligLoenEkstraGrundloenSuffix}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  </>
                ) : null}

                {loenudviklingBasis === 'Statistik' ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Statistisk beregningsmodel</Typography>
                    <Box className="row--label-right-hover__content">
                      <ChoiceField
                        field={eoAngivetLoenFields.loenudviklingStatistikModel.bind()}
                        location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.loenudviklingStatistikModel')}
                        name="loenudviklingStatistikModel"
                        width={270}
                        allowEmpty={true}
                        placeholder="Vælg..."
                      >
                        <MenuItem value={ASL_AARSLOENSMAKSIMUM_MODEL_LABEL}>{ASL_AARSLOENSMAKSIMUM_MODEL_LABEL}</MenuItem>
                        <MenuItem value="ILON12 (Danmarks Statistik)">ILON12 (Danmarks Statistik)</MenuItem>
                        <MenuItem value="SBLON2 (Danmarks Statistik)">SBLON2 (Danmarks Statistik)</MenuItem>
                      </ChoiceField>
                    </Box>
                  </Box>
                ) : null}

                {loenudviklingBasis === 'KRL satstabel' ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Satstabel</Typography>
                    <Box className="row--label-right-hover__content">
                      <ChoiceField
                        field={eoAngivetLoenFields.loenudviklingKRLSatstabel.bind()}
                        location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.loenudviklingKRLSatstabel')}
                        name="loenudviklingKRLSatstabel"
                        width={270}
                        allowEmpty={true}
                        placeholder="Vælg..."
                      >
                        {krlSatstabelEnum.options.map((satstabel) => (
                          <MenuItem key={satstabel} value={satstabel}>
                            {satstabel}
                          </MenuItem>
                        ))}
                      </ChoiceField>
                    </Box>
                  </Box>
                ) : null}

                {loenudviklingBasis === 'Manuelt angivet' ? (
                  <Box sx={{ mt: 1 }}>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Navn på reguleringsform</Typography>
                      <Box className="row--label-right-hover__content">
                        <TextField
                          field={eoAngivetLoenFields.loenudviklingManuelNavn.bind()}
                          location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.loenudviklingManuelNavn')}
                          name="loenudviklingManuelNavn"
                          width={300}
                        />
                      </Box>
                    </Box>
                    <LoenudviklingManuelTable
                      bindings={eoAngivetLoenManual}
                      collection={eoAngivetLoenManual.manualCollection.template as CollectionRef}
                      committedRows={eoLoenudvikling.loenudviklingManuelTableData}
                      ruleIssues={manualRegulationDateIssues}
                      locationPrefix="erstatningsopgoerelse.eoAngivetLoenLoenudvikling.loenudviklingManuelTableData"
                      baseDateDisplay={loenudviklingBaseDateDisplay}
                      baseDateISO={loenudviklingBaseDateISO}
                      baseDateErrorMessage={loenudviklingBaseDateDisplay === '' ? loenudviklingBaseDateErrorMessage : undefined}
                      useSmallFont={true}
                      // route + tabKey er eksplicit navigation-metadata (§3.7); her bor tabellen på EO-oplysningerfanen.
                      locationNav={{ route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                    />
                  </Box>
                ) : null}

                {loenudviklingBasis === 'Manuel procentsats' ? (
                  <Box sx={{ mt: 1 }}>
                      <LoenudviklingManuelProcentsatsTable
                        bindings={eoAngivetLoenManual}
                        collection={eoAngivetLoenManual.manualPercentCollection.template as CollectionRef}
                        committedRows={eoLoenudvikling.loenudviklingManuelProcentsatsTableData}
                        ruleIssues={manualRegulationDateIssues}
                        locationPrefix="erstatningsopgoerelse.eoAngivetLoenLoenudvikling.loenudviklingManuelProcentsatsTableData"
                        baseDateDisplay={loenudviklingBaseDateDisplay}
                        baseDateISO={loenudviklingBaseDateISO}
                        baseDateErrorMessage={loenudviklingBaseDateDisplay === '' ? loenudviklingBaseDateErrorMessage : undefined}
                        useSmallFont={true}
                        // route + tabKey er eksplicit navigation-metadata (§3.7); her bor tabellen på EO-oplysningerfanen.
                        locationNav={{ route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                      />
                  </Box>
                ) : null}

                {shouldShowReguleringsDatoInterval ? (
                  <>
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Tilgængelige reguleringssatser</Typography>
                    <Box className="row--label-right-hover__content">
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'flex-end', gap: 1 }}>
                        {/*
                          Knaptilstand og outputvalg kommer fra `reguleringDocument`. Den
                          side-lokale `canDownload`-IIFE og den `loenudviklingBasis`-switch, der før
                          valgte mellem tre servicekald ved KLIK — altså før commit-barrieren — er
                          erstattet af resolveren, som vælger efter settle på et frisk snapshot.
                        */}
                        <Typography className="row--text" sx={{ textAlign: 'right' }}>
                          {reguleringsDatoIntervalDisplay || '-'}
                        </Typography>
                        <Box>
                          <DocumentDownloadButton
                            disabled={!reguleringDocument.canDownload}
                            disabledReason={reguleringDocument.disabledReason}
                            onClick={() => { void reguleringDocument.download(); }}
                          />
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                  {/*
                    Gate-årsagen findes her KUN i knappens tooltip, så beskeden vises rå — ellers ville en
                    blokeret aktivering være helt usynlig for brugeren.
                  */}
                  <DocumentOutcomeMessage message={reguleringDocument.errorMessage} />
                  </>
                ) : null}
              </>
            )}

            {showEoAnciennitetstillaegSection ? (
              <>
                <Typography className="row--subheading">Anciennitetstillæg</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    {`Ville skadelidte have opnået anciennitetstillæg efter ${loenudviklingBaseDateReferenceText}`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <MappedToggleField
                      field={eoAngivetLoenFields.harAnciennitetstillaegEfterSkadedatoen.bind()}
                      location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.harAnciennitetstillaegEfterSkadedatoen')}
                      checkedValue={true}
                      uncheckedValue={false}
                      name="harAnciennitetstillaegEfterSkadedatoen"
                    />
                  </Box>
                </Box>

                {eoLoenudvikling.harAnciennitetstillaegEfterSkadedatoen ? (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Dato for opnået anciennitetstillæg</Typography>
                      <Box className="row--label-right-hover__content">
                        <DateField
                          field={eoAngivetLoenFields.anciennitetstillaegDato.bind()}
                          location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.anciennitetstillaegDato')}
                          name="anciennitetstillaegDato"
                        />
                      </Box>
                    </Box>

                    <Box className="row--label-right-hover">
                      <Typography className="row--text">{`Sats per ${eoAnciennitetSatsPerTekst}`}</Typography>
                      <Box className="row--label-right-hover__content">
                        <AmountField
                          field={eoAngivetLoenFields.anciennitetstillaegSats.bind()}
                          location={eoOplyLocation('erstatningsopgoerelse.eoAngivetLoenLoenudvikling.anciennitetstillaegSats')}
                          name="anciennitetstillaegSats"
                          width={160}
                        />
                      </Box>
                    </Box>
                  </>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </ContentBox>
  );
}
