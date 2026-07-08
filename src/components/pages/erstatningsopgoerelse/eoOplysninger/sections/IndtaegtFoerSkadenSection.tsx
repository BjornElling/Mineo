import { Box, IconButton, MenuItem, Tooltip, Typography } from '@mui/material';
import Download from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import ContentBox from '../../../../layout/ContentBox';
import InfoTooltipIcon from '../../../../common/InfoTooltipIcon';
import StyledToggleSwitch from '../../../../inputs/StyledToggleSwitch';
import StyledDropdown, { type StyledDropdownChangeEvent } from '../../../../inputs/StyledDropdown';
import StyledDateField from '../../../../inputs/StyledDateField';
import StyledAmountField from '../../../../inputs/StyledAmountField';
import StyledTextField from '../../../../inputs/StyledTextField';
import StyledIntegerField from '../../../../inputs/StyledIntegerField';
import BeregningsperiodeFerieTable from '../../../../tables/BeregningsperiodeFerieTable';
import LoenudviklingManuelTable from '../../../../tables/LoenudviklingManuelTable';
import LoenudviklingManuelProcentsatsTable from '../../../../tables/LoenudviklingManuelProcentsatsTable';
import { CellInvalidDraftScopeProvider } from '../../../../../contexts/CellInvalidDraftScopeContext';
import { CELL_TABLE_IDS } from '../../../../../config/cellInvalidDraftScopes';
import { erTabtArbejdsfortjenesteSektionAktiv } from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { getOverenskomstMetaById } from '../../../../../data/overenskomstRates';
import { ASL_AARSLOENSMAKSIMUM_MODEL_LABEL } from '../../../../../data/statistiskeRates';
import { krlSatstabelEnum, offentligLoenTypeEnum } from '../../../../../schemas/formSchemas';
import { amountValueToNumber } from '../../../../../utils/expressionAmount';
import { getDayAfterIso } from '../../../../../utils/isoDateHelpers';
import { useEoOplysningerVm } from '../eoOplysningerContext';

/**
 * Sektion 5: indtægt før stamdatadatoen (beregningsmetode, beregningsperiode/ferie/fravær eller
 * angivet løn, lønudvikling og anciennitetstillæg). Hele sektionen er kun synlig når der beregnes tabt
 * arbejdsfortjeneste.
 */
export default function IndtaegtFoerSkadenSection() {
  const {
    values,
    eoLoenudvikling,
    getChecked,
    handleToggleChange,
    handleBeregnesUdFraChange,
    handleIsoDateBlur,
    handleIntegerBlur,
    handleAmountBlur,
    commitField,
    skalKomprimereIndtaegtFoerSkaden,
    indtaegtFoerSkadenSectionTitle,
    beregningsperiodeTafOverlap,
    fravaer,
    fravaerFeriedageById,
    angivetLoenOpreguleringLabel,
    aktivAngivetLoenOpreguleresFraDato,
    visLoenudviklingFraEO,
    loenudviklingBasis,
    handleLoenudviklingBeregningsgrundlagChange,
    handleEoOverenskomstFilterChange,
    handleEoOverenskomstChange,
    alleLoenmodtagerOrg,
    alleArbejdsgiverOrg,
    filteredOverenskomster,
    erOffentligOverenskomst,
    handleOffentligLoenTypeChange,
    handleOffentligLoenTrinCommit,
    handleOffentligLoenGruppeCommit,
    handleOffentligLoenEkstraGrundloenCommit,
    offentligLoenEkstraGrundloenSuffix,
    handleLoenudviklingStatistikModelChange,
    handleLoenudviklingKRLSatstabelChange,
    handleLoenudviklingManuelNavnCommit,
    handleLoenudviklingManuelTableChange,
    handleLoenudviklingManuelProcentsatsTableChange,
    handleLoenudviklingManuelInputErrorChange,
    loenudviklingBaseDateDisplay,
    loenudviklingBaseDateISO,
    loenudviklingBaseDateErrorMessage,
    shouldShowReguleringsDatoInterval,
    reguleringsDatoIntervalData,
    reguleringsDatoIntervalDisplay,
    handleDownloadKRLPdf,
    handleDownloadKlLoenaftalerPdf,
    handleDownloadReguleringPdf,
    showEoAnciennitetstillaegSection,
    handleEoAnciennitetstillaegToggleCommit,
    handleEoAnciennitetstillaegDatoCommit,
    handleEoAnciennitetstillaegSatsCommit,
    eoAnciennitetSatsPerTekst,
    loentrinFinder,
  } = useEoOplysningerVm();
  const eoAnciennitetstillaegMinDato = getDayAfterIso(loenudviklingBaseDateISO);

  if (!erTabtArbejdsfortjenesteSektionAktiv(values)) return null;

  return (
        <ContentBox className="content-box" data-section-id="taf-beregningsgrundlag">
        <Typography className="section-header">{indtaegtFoerSkadenSectionTitle}</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Skjul beregning efter første opgørelse</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="komprimerBeregningEfterFoersteOpgoerelse"
              checked={getChecked(values.komprimerBeregningEfterFoersteOpgoerelse)}
              onCommit={handleToggleChange('komprimerBeregningEfterFoersteOpgoerelse')}
            />
          </Box>
        </Box>

        {!skalKomprimereIndtaegtFoerSkaden && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Beregnes ud fra</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDropdown
                  name="beregnesUdFra"
                  width={200}
                  value={values.beregnesUdFra}
                  onChange={handleBeregnesUdFraChange}
                  allowEmpty={false}
                >
                  <MenuItem value="Beregningsperiode">Beregningsperiode</MenuItem>
                  <MenuItem value="Angivet månedsløn">Angivet månedsløn</MenuItem>
                  <MenuItem value="Angivet dagsløn">Angivet dagsløn</MenuItem>
                </StyledDropdown>
              </Box>
            </Box>

            {values.beregnesUdFra === 'Beregningsperiode' && (
              <>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">Periode til beregning af før-løn:</Typography>
                  <Box className="row--label-right-hover__content">
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <StyledDateField
                        name="tafBeregningsperiodeFra"
                        value={values.tafBeregningsperiodeFra}
                        onCommit={handleIsoDateBlur('tafBeregningsperiodeFra')}
                        error={beregningsperiodeTafOverlap.firstOverlapMessage !== undefined}
                        helperText={beregningsperiodeTafOverlap.firstOverlapMessage ?? ''}
                      />
                      <Typography sx={{ minWidth: 'auto' }}>til:</Typography>
                      <StyledDateField
                        name="tafBeregningsperiodeTil"
                        value={values.tafBeregningsperiodeTil}
                        onCommit={handleIsoDateBlur('tafBeregningsperiodeTil')}
                        error={beregningsperiodeTafOverlap.firstOverlapMessage !== undefined}
                        helperText={beregningsperiodeTafOverlap.firstOverlapMessage ?? ''}
                      />
                    </Box>
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    Regulering af offentlige ydelser i EO
                    <InfoTooltipIcon title="Offentlige ydelser fremskrives efter statslig praksis med tilpasningsprocenten + 2 % per 1. januar" />
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledToggleSwitch
                      name="regulerOffentligeYdelser"
                      checked={getChecked(values.regulerOffentligeYdelser)}
                      onCommit={handleToggleChange('regulerOffentligeYdelser')}
                    />
                  </Box>
                </Box>

                <Typography className="row--subheading">Ferie i beregningsperioden:</Typography>
                <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoBeregningsperiodeFerie}>
                <BeregningsperiodeFerieTable
                  rows={fravaer.draftRows}
                  committedById={fravaer.committedById}
                  feriedageById={fravaerFeriedageById}
                  onFieldChange={fravaer.onFieldChange}
                  onRowBlur={fravaer.onRowBlur}
                  onDeleteRow={fravaer.removeRow}
                  onRowsReorder={fravaer.reorderRows}
                  beregningsperiodeFra={values.tafBeregningsperiodeFra}
                  beregningsperiodeTil={values.tafBeregningsperiodeTil}
                  saveOrderPath="erstatningsopgoerelse.fravaerPerioder"
                />
                </CellInvalidDraftScopeProvider>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Uspecificerede ferie-/feriefridage</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledIntegerField
                      name="uspecificeredeFerieFridage"
                      width={80}
                      value={values.uspecificeredeFerieFridage}
                      onCommit={handleIntegerBlur('uspecificeredeFerieFridage')}
                      minValue={0}
                      maxValue={365}
                    />
                  </Box>
                </Box>

                <Typography className="row--subheading">Øvrigt fravær i beregningsperioden:</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Øvrigt fravær uden løn</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledToggleSwitch
                      name="oevrigtFravaerUdenLoen"
                      checked={getChecked(values.oevrigtFravaerUdenLoen)}
                      onCommit={handleToggleChange('oevrigtFravaerUdenLoen')}
                    />
                  </Box>
                </Box>

                {getChecked(values.oevrigtFravaerUdenLoen) && (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Antal fraværsdage (mandag-fredag)</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledIntegerField
                          name="oevrigeFravaersdage"
                          width={80}
                          value={values.oevrigeFravaersdage}
                          onCommit={handleIntegerBlur('oevrigeFravaersdage')}
                          minValue={0}
                          maxValue={365}
                        />
                      </Box>
                    </Box>

                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Årsag til fravær</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledTextField
                          name="oevrigeFravaersdageBeskrivelse"
                          width={300}
                          value={values.oevrigeFravaersdageBeskrivelse || ''}
                          onCommit={commitField('oevrigeFravaersdageBeskrivelse')}
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
                <StyledAmountField
                  name="maanedsloenenUdgoer"
                  width={150}
                  value={values.maanedsloenenUdgoer}
                  onCommit={handleAmountBlur('maanedsloenenUdgoer')}
                />
                </Box>
              </Box>
            )}

            {values.beregnesUdFra === 'Angivet dagsløn' && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">Dagslønnen udgør</Typography>
                <Box className="row--label-right-hover__content">
                <StyledAmountField
                  name="dagsloenenUdgoer"
                  width={150}
                  value={values.dagsloenenUdgoer}
                  onCommit={handleAmountBlur('dagsloenenUdgoer')}
                />
                </Box>
              </Box>
            )}

            {(values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn') && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">- baseret på</Typography>
                <Box className="row--label-right-hover__content">
                  <StyledTextField
                    name={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? 'angivetMaanedsloenBaseretPaa'
                        : 'angivetDagsloenBaseretPaa'
                    }
                    width={300}
                    value={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? (values.angivetMaanedsloenBaseretPaa || '')
                        : (values.angivetDagsloenBaseretPaa || '')
                    }
                    onCommit={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? commitField('angivetMaanedsloenBaseretPaa')
                        : commitField('angivetDagsloenBaseretPaa')
                    }
                  />
                </Box>
              </Box>
            )}

            {(values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn') && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">{angivetLoenOpreguleringLabel}</Typography>
                <Box className="row--label-right-hover__content">
                  <StyledDateField
                    name={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? 'angivetMaanedsloenOpreguleresFraDato'
                        : 'angivetDagsloenOpreguleresFraDato'
                    }
                    value={aktivAngivetLoenOpreguleresFraDato}
                    onCommit={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? handleIsoDateBlur('angivetMaanedsloenOpreguleresFraDato')
                        : handleIsoDateBlur('angivetDagsloenOpreguleresFraDato')
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
                    <StyledDropdown
                      name="loenudviklingBeregningsgrundlag"
                      width={220}
                      value={loenudviklingBasis}
                      onChange={handleLoenudviklingBeregningsgrundlagChange}
                      allowEmpty={true}
                      placeholder="Vælg..."
                    >
                      <MenuItem value="Overenskomst">Overenskomst</MenuItem>
                      <MenuItem value="Statistik">Statistik</MenuItem>
                      <MenuItem value="KRL satstabel">KRL satstabel</MenuItem>
                      <MenuItem value="KL-lønaftaler">KL-lønaftaler</MenuItem>
                      <StyledDropdown.Divider />
                      <MenuItem value="Manuelt angivet">Manuelt angivet</MenuItem>
                      <MenuItem value="Manuel procentsats">Manuel procentsats</MenuItem>
                      <StyledDropdown.Divider />
                      <MenuItem value="Ingen">Ingen</MenuItem>
                    </StyledDropdown>
                  </Box>
                </Box>

                {loenudviklingBasis === 'Overenskomst' ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Vælg overenskomst</Typography>
                    <Box className="row--label-right-hover__content">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {/* Lønmodtager filter dropdown - UI viser 'ALLE', domæne bruger undefined */}
                        <Typography sx={{ fontSize: '11px', lineHeight: '24px' }}>L:</Typography>
                        <StyledDropdown
                          name="overenskomstFilter.loenmodtager"
                          value={eoLoenudvikling.overenskomstFilter?.loenmodtager ?? 'ALLE'}
                          onChange={(e: StyledDropdownChangeEvent<string>) => {
                            const uiValue = e.target.value;
                            handleEoOverenskomstFilterChange('loenmodtager', uiValue === 'ALLE' ? undefined : uiValue);
                          }}
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
                        </StyledDropdown>

                        {/* Arbejdsgiver filter dropdown - UI viser 'ALLE', domæne bruger undefined */}
                        <Typography sx={{ fontSize: '11px', lineHeight: '24px' }}>A:</Typography>
                        <StyledDropdown
                          name="overenskomstFilter.arbejdsgiver"
                          value={eoLoenudvikling.overenskomstFilter?.arbejdsgiver ?? 'ALLE'}
                          onChange={(e: StyledDropdownChangeEvent<string>) => {
                            const uiValue = e.target.value;
                            handleEoOverenskomstFilterChange('arbejdsgiver', uiValue === 'ALLE' ? undefined : uiValue);
                          }}
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
                        </StyledDropdown>

                        <StyledDropdown
                          name="overenskomstId"
                          value={eoLoenudvikling.overenskomstId || undefined}
                          onChange={handleEoOverenskomstChange}
                          width={460}
                          placeholder="Vælg overenskomst..."
                          allowEmpty={true}
                          getOptionLabel={(id) => {
                            const asString = typeof id === 'string' ? id : String(id);
                            const meta = getOverenskomstMetaById(asString);
                            if (!meta) return asString;
                            const loenPart = meta.loenmodtagerOrg[0] || '';
                            const arbPart = meta.arbejdsgiverOrg[0] || '';
                            return `${meta.navn} (${loenPart} / ${arbPart})`;
                          }}
                        >
                          {filteredOverenskomster.map((meta) => {
                            const loenPart = meta.loenmodtagerOrg[0] || '';
                            const arbPart = meta.arbejdsgiverOrg[0] || '';
                            return (
                              <MenuItem key={meta.id} value={meta.id}>
                                {meta.navn} ({loenPart} / {arbPart})
                              </MenuItem>
                            );
                          })}
                        </StyledDropdown>
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
                          <StyledDropdown
                            name="offentligLoenType"
                            width={160}
                            value={eoLoenudvikling.offentligLoenType ?? 'Månedsløn'}
                            onChange={handleOffentligLoenTypeChange}
                            allowEmpty={false}
                          >
                            {offentligLoenTypeEnum.options.map((option) => (
                              <MenuItem key={option} value={option}>
                                {option}
                              </MenuItem>
                            ))}
                          </StyledDropdown>
                          <Typography className="row--text">Løntrin</Typography>
                          <StyledIntegerField
                            name="offentligLoenTrin"
                            value={eoLoenudvikling.offentligLoenTrin}
                            onCommit={handleOffentligLoenTrinCommit}
                            minValue={1}
                            maxValue={55}
                            maxDigits={2}
                            width={80}
                          />
                          <Typography className="row--text">Gruppe</Typography>
                          <StyledIntegerField
                            name="offentligLoenGruppe"
                            value={eoLoenudvikling.offentligLoenGruppe}
                            onCommit={handleOffentligLoenGruppeCommit}
                            minValue={0}
                            maxValue={4}
                            maxDigits={1}
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
                          <StyledAmountField
                            name="offentligLoenEkstraGrundloen"
                            width={160}
                            value={eoLoenudvikling.offentligLoenEkstraGrundloen}
                            allowNegative={false}
                            onCommit={handleOffentligLoenEkstraGrundloenCommit}
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
                      <StyledDropdown
                        name="loenudviklingStatistikModel"
                        width={270}
                        value={eoLoenudvikling.loenudviklingStatistikModel}
                        onChange={handleLoenudviklingStatistikModelChange}
                        allowEmpty={true}
                        placeholder="Vælg..."
                      >
                        <MenuItem value={ASL_AARSLOENSMAKSIMUM_MODEL_LABEL}>{ASL_AARSLOENSMAKSIMUM_MODEL_LABEL}</MenuItem>
                        <MenuItem value="ILON12 (Danmarks Statistik)">ILON12 (Danmarks Statistik)</MenuItem>
                        <MenuItem value="SBLON2 (Danmarks Statistik)">SBLON2 (Danmarks Statistik)</MenuItem>
                      </StyledDropdown>
                    </Box>
                  </Box>
                ) : null}

                {loenudviklingBasis === 'KRL satstabel' ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Satstabel</Typography>
                    <Box className="row--label-right-hover__content">
                      <StyledDropdown
                        name="loenudviklingKRLSatstabel"
                        width={270}
                        value={eoLoenudvikling.loenudviklingKRLSatstabel}
                        onChange={handleLoenudviklingKRLSatstabelChange}
                        allowEmpty={true}
                        placeholder="Vælg..."
                      >
                        {krlSatstabelEnum.options.map((satstabel) => (
                          <MenuItem key={satstabel} value={satstabel}>
                            {satstabel}
                          </MenuItem>
                        ))}
                      </StyledDropdown>
                    </Box>
                  </Box>
                ) : null}

                {loenudviklingBasis === 'Manuelt angivet' ? (
                  <Box sx={{ mt: 1 }}>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Navn på reguleringsform</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledTextField
                          name="loenudviklingManuelNavn"
                          width={300}
                          value={eoLoenudvikling.loenudviklingManuelNavn || ''}
                          onCommit={handleLoenudviklingManuelNavnCommit}
                        />
                      </Box>
                    </Box>
                    <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoAngivetLoenudvikling}>
                    <LoenudviklingManuelTable
                      tableData={eoLoenudvikling.loenudviklingManuelTableData}
                      onTableDataChange={handleLoenudviklingManuelTableChange}
                      onInputErrorChange={handleLoenudviklingManuelInputErrorChange}
                      baseDateDisplay={loenudviklingBaseDateDisplay}
                      baseDateISO={loenudviklingBaseDateISO}
                      baseDateErrorMessage={loenudviklingBaseDateDisplay === '' ? loenudviklingBaseDateErrorMessage : undefined}
                      useSmallFont={true}
                    />
                    </CellInvalidDraftScopeProvider>
                  </Box>
                ) : null}

                {loenudviklingBasis === 'Manuel procentsats' ? (
                  <Box sx={{ mt: 1 }}>
                    <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoAngivetLoenudviklingManuelProcentsats}>
                      <LoenudviklingManuelProcentsatsTable
                        tableData={eoLoenudvikling.loenudviklingManuelProcentsatsTableData}
                        onTableDataChange={handleLoenudviklingManuelProcentsatsTableChange}
                        onInputErrorChange={handleLoenudviklingManuelInputErrorChange}
                        baseDateDisplay={loenudviklingBaseDateDisplay}
                        baseDateISO={loenudviklingBaseDateISO}
                        baseDateErrorMessage={loenudviklingBaseDateDisplay === '' ? loenudviklingBaseDateErrorMessage : undefined}
                        useSmallFont={true}
                      />
                    </CellInvalidDraftScopeProvider>
                  </Box>
                ) : null}

                {shouldShowReguleringsDatoInterval ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Tilgængelige reguleringssatser</Typography>
                    <Box className="row--label-right-hover__content">
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'flex-end', gap: 1 }}>
                        {(() => {
                          const hasReguleringsDatoInterval =
                            Boolean(reguleringsDatoIntervalData?.fraDato) && Boolean(reguleringsDatoIntervalData?.tilDato);
                          const offentligReady =
                            !erOffentligOverenskomst
                            || (
                              typeof eoLoenudvikling.offentligLoenTrin === 'number'
                              && typeof eoLoenudvikling.offentligLoenGruppe === 'number'
                            );
                          const canDownload =
                            hasReguleringsDatoInterval &&
                            (loenudviklingBasis !== 'Overenskomst' || offentligReady);
                          return (
                            <>
                              <Typography className="row--text" sx={{ textAlign: 'right' }}>
                                {reguleringsDatoIntervalDisplay || '-'}
                              </Typography>
                              <Box>
                                <Box
                                  onClick={() => {
                                    if (!canDownload) return;
                                    if (!reguleringsDatoIntervalData) return;
                                    if (loenudviklingBasis === 'KRL satstabel') {
                                      void handleDownloadKRLPdf();
                                      return;
                                    }
                                    if (loenudviklingBasis === 'KL-lønaftaler') {
                                      void handleDownloadKlLoenaftalerPdf();
                                      return;
                                    }
                                    if (loenudviklingBasis !== 'Overenskomst' && loenudviklingBasis !== 'Statistik') {
                                      return;
                                    }
                                    void handleDownloadReguleringPdf({
                                      overenskomstLabel: (() => {
                                        const id = eoLoenudvikling.overenskomstId;
                                        if (!id) return '-';
                                        const meta = getOverenskomstMetaById(id);
                                        return meta?.navn ?? id;
                                      })(),
                                      loenudviklingBasis,
                                      overenskomstId: eoLoenudvikling.overenskomstId,
                                      statistikModelLabel: eoLoenudvikling.loenudviklingStatistikModel,
                                      interval: reguleringsDatoIntervalData,
                                      applyAlmindeligLoenPaaShDageRegel: eoLoenudvikling.loenPaaHelligdage === 'Almindelig løn',
                                      offentligLoenType: eoLoenudvikling.offentligLoenType,
                                      offentligLoenTrin: eoLoenudvikling.offentligLoenTrin,
                                      offentligLoenGruppe: eoLoenudvikling.offentligLoenGruppe,
                                      offentligLoenEkstraGrundloen: amountValueToNumber(eoLoenudvikling.offentligLoenEkstraGrundloen),
                                    });
                                  }}
                                  tabIndex={-1}
                                  sx={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: canDownload ? 'pointer' : 'default',
                                    transition: 'background-color 0.2s',
                                    ...(canDownload && {
                                      '&:hover': {
                                        backgroundColor: 'var(--color-icon-action-hover)',
                                      },
                                      '&:active': {
                                        backgroundColor: 'var(--color-icon-action-active)',
                                      },
                                    }),
                                  }}
                                >
                                  <Download
                                    sx={{
                                      fontSize: '24px',
                                      color: canDownload ? 'primary.main' : 'grey.500',
                                    }}
                                  />
                                </Box>
                              </Box>
                            </>
                          );
                        })()}
                      </Box>
                    </Box>
                  </Box>
                ) : null}
              </>
            )}

            {showEoAnciennitetstillaegSection ? (
              <>
                <Typography className="row--subheading">Anciennitetstillæg</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Ville skadelidte have opnået anciennitetstillæg efter anvendt reguleringsdato</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledToggleSwitch
                      name="harAnciennitetstillaegEfterSkadedatoen"
                      checked={eoLoenudvikling.harAnciennitetstillaegEfterSkadedatoen}
                      onCommit={handleEoAnciennitetstillaegToggleCommit}
                    />
                  </Box>
                </Box>

                {eoLoenudvikling.harAnciennitetstillaegEfterSkadedatoen ? (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Dato for opnået anciennitetstillæg</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledDateField
                          name="anciennitetstillaegDato"
                          value={eoLoenudvikling.anciennitetstillaegDato}
                          minDate={eoAnciennitetstillaegMinDato}
                          specialRangeErrors={{
                            minBoundKind: loenudviklingBaseDateISO ? 'efterAnvendtReguleringsdato' : undefined,
                            minBoundReferenceISO: loenudviklingBaseDateISO,
                          }}
                          onCommit={handleEoAnciennitetstillaegDatoCommit}
                        />
                      </Box>
                    </Box>

                    <Box className="row--label-right-hover">
                      <Typography className="row--text">{`Sats per ${eoAnciennitetSatsPerTekst}`}</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledAmountField
                          name="anciennitetstillaegSats"
                          width={160}
                          value={eoLoenudvikling.anciennitetstillaegSats}
                          allowNegative={false}
                          onCommit={handleEoAnciennitetstillaegSatsCommit}
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
