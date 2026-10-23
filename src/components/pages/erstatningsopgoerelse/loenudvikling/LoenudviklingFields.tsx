import { ILON12_DISCONTINUED_NOTE } from '../../../../data/statistikNotes';
import type { ReactNode } from 'react';
import { Box, IconButton, MenuItem, Tooltip, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DocumentDownloadButton from '../../../inputs/DocumentDownloadButton';
import DocumentOutcomeMessage from '../../../inputs/DocumentOutcomeMessage';
import ChoiceField, { ChoiceDivider } from '../../../../inputCore/react/fields/ChoiceField';
import TextField from '../../../../inputCore/react/fields/TextField';
import AmountField from '../../../../inputCore/react/fields/AmountField';
import IntegerField from '../../../../inputCore/react/fields/IntegerField';
import LoenudviklingManuelTable from '../../../tables/LoenudviklingManuelTable';
import LoenudviklingManuelProcentsatsTable from '../../../tables/LoenudviklingManuelProcentsatsTable';
import SatsEnhedChoiceField from './SatsEnhedChoiceField';
import type { CollectionRef, LoenudviklingBinding, LoenudviklingManualBindings } from './loenudviklingBinding';
import { ASL_AARSLOENSMAKSIMUM_MODEL_LABEL } from '../../../../data/statistiskeRates';
import { krlSatstabelEnum, offentligLoenTypeEnum } from '../../../../schemas/formSchemas';
import type { LoenudviklingManuelRow, LoenudviklingManuelProcentsatsRow } from '../../../../schemas/formSchemas';
import { activeFieldIssue, type FieldIssueSet } from '../../../../inputCore/inputIssue';
import { serializeFieldAddress, type SerializedFieldAddress } from '../../../../inputCore/fieldAddress';
import type { FieldWarning } from '../../../../inputCore/fieldWarning';
import { createManualRegulationBasisCommitOverride } from '../../../../domain/erstatningsopgoerelse/manualRegulationBasisCommit';
import type { ReguleringDocumentAction } from '../../../../domain/erstatningsopgoerelse/react/useReguleringDocumentAction';

/**
 * Den fælles Lønudvikling-flade.
 *
 * Fladen findes på to overflader – pr. ansættelsesforhold på Lønindkomstfanen og for
 * «angivet løn» på EO-oplysningerfanen – og var tidligere kopieret ordret mellem
 * `AnsaettelsesforholdCard.tsx` og `IndtaegtFoerSkadenSection.tsx` (~290 linjer hver).
 * Kopierne var allerede drevet fra hinanden på tre punkter, som ingen havde besluttet:
 * feltbredden på «Navn på reguleringsform» (350 vs. 300), den manglende
 * basisdato-tooltip på EO-oplysninger, og en let omskrevet kommentar. Derfor ét sted.
 *
 * Overfladerne binder forskelligt (`field(...)`/`location(...)` pr. ansættelsesforhold
 * vs. `descriptor.bind()`/fast locationId), så bindingen injiceres som `binding`.
 * `page-component-contract.md` §4.4 l. 190 gør det et frit valg, om en delt flade får
 * sine data via props eller context; her er props det rigtige, fordi komponenten netop
 * skal kunne bindes til to forskellige ejere.
 *
 * Overenskomst-blokken er bevidst en `overenskomstSlot`, ikke en prop-flag: de to
 * overflader viser reelt forskellige ting (read-only etiket vs. fuld vælger med to
 * filter-dropdowns), og at presse dem gennem samme markup ville skjule en reel
 * forskel bag en betingelse.
 */
export type LoenudviklingFieldsProps<
  TGrundlag extends string | undefined,
  TStatistikModel extends string | undefined,
  TKrlSatstabel extends string | undefined,
  TOffentligLoenType extends string | undefined,
> = Readonly<{
  /** Adresse + location pr. logisk felt for den aktuelle overflade. */
  binding: LoenudviklingBinding<TGrundlag, TStatistikModel, TKrlSatstabel, TOffentligLoenType>;
  /** Descriptor-bundtet til de to manuelle tabeller. */
  manualBindings: LoenudviklingManualBindings;
  manualCollection: CollectionRef;
  manualPercentCollection: CollectionRef;
  manualRows: readonly LoenudviklingManuelRow[];
  manualPercentRows: readonly LoenudviklingManuelProcentsatsRow[];
  /**
   * Lønudviklingens projekterede feltfejl (`loenudviklingIssues` i projektionen): de manuelle tabellers celler og
   * reguleringsgrundlagets dækning på «Lønudvikling beregnes ud fra» (BB-306).
   */
  loenudviklingIssues: FieldIssueSet;
  /** Lønudviklingens gule ringe: de manuelle tabellers celler og den forhøjede grundløn (BB-302, BB-313). */
  manualCellWarnings: ReadonlyMap<SerializedFieldAddress, FieldWarning>;
  manualLocationPrefix: string;
  manualPercentLocationPrefix: string;
  /** Navigation-metadata (§3.7) for de to tabeller – fanen adskiller overfladerne. */
  locationNav: Readonly<{ route: string; tabKey: string | null }>;

  /** Det aktive beregningsgrundlag; styrer hvilke undergrene der vises. */
  loenudviklingBasis: string | undefined;
  statistikModel: string | undefined;
  erOffentligOverenskomst: boolean;

  /** Indholdet af «Overenskomst»-rækken – se komponentens doc. */
  overenskomstSlot: ReactNode;

  onOpenLoentrinFinder: () => void;
  /**
   * Ref til `Find løntrin`-knappen. Overlayet gendanner fokus hertil ved lukning
   * (jf. `keyboard-navigation.md` §Popup-fokus-restore).
   */
  loentrinFinderTriggerRef: React.RefObject<HTMLButtonElement | null>;
  /** Gruppefeltets input – fokus lander her, når et resultat fra finderen er sat ind (BB-310). */
  gruppeInputRef: React.RefObject<HTMLInputElement | null>;

  /** Basisrækkens dato i de manuelle tabeller. */
  baseDateDisplay: string;
  baseDateISO: string | undefined;
  baseDateErrorMessage: string | undefined;
  /**
   * Forklaringen bag basisdatoen. Påkrævet – ikke optional – fordi den tidligere var
   * optional og derfor stiltiende manglede på EO-oplysningerfanen, selv om VM'en
   * allerede beregnede teksten. Send `undefined` eksplicit, hvis den ikke findes.
   */
  baseDateInfoTooltipText: string | undefined;

  /** Bredden på «Navn på reguleringsform». Overfladerne havde 350 og 300 uden grund. */
  manualNavnWidth: number;

  /** Reguleringssats-intervallet og dets download. */
  shouldShowReguleringsDatoInterval: boolean;
  reguleringsDatoIntervalDisplay: string;
  /** Den fælles resolver – ikke en lokalt genskabt form, så gate-reglen kun findes ét sted. */
  reguleringDocument: ReguleringDocumentAction;

  /** Har den manuelle tabel en basisrække – styrer commit-override'et. */
  hasManualBaseRow: boolean;
  hasManualPercentBaseRow: boolean;
  /** Procentfelterne i basisrækken er read-only når tillæg angives som procent. */
  readOnlyBaseRowPercentFields: boolean;
  /** Fejl på basisrækkens procentfelter. Kun Lønindkomst har satsfelter at afvige fra. */
  baseRowPercentErrors: Partial<Record<'feriepenge' | 'shSoSats' | 'fritvalg' | 'agPension', string>> | undefined;
  /** Suffiks på feltnavne, så to kort på samme side ikke deler `name`. */
  fieldNamePrefix: string;
}>;

export default function LoenudviklingFields<
  TGrundlag extends string | undefined,
  TStatistikModel extends string | undefined,
  TKrlSatstabel extends string | undefined,
  TOffentligLoenType extends string | undefined,
>({
  binding,
  manualBindings,
  manualCollection,
  manualPercentCollection,
  manualRows,
  manualPercentRows,
  loenudviklingIssues,
  manualCellWarnings,
  manualLocationPrefix,
  manualPercentLocationPrefix,
  locationNav,
  loenudviklingBasis,
  statistikModel,
  erOffentligOverenskomst,
  overenskomstSlot,
  onOpenLoentrinFinder,
  loentrinFinderTriggerRef,
  gruppeInputRef,
  baseDateDisplay,
  baseDateISO,
  baseDateErrorMessage,
  baseDateInfoTooltipText,
  manualNavnWidth,
  shouldShowReguleringsDatoInterval,
  reguleringsDatoIntervalDisplay,
  reguleringDocument,
  hasManualBaseRow,
  hasManualPercentBaseRow,
  readOnlyBaseRowPercentFields,
  baseRowPercentErrors,
  fieldNamePrefix,
}: LoenudviklingFieldsProps<TGrundlag, TStatistikModel, TKrlSatstabel, TOffentligLoenType>) {
  const name = (fieldName: string): string => `${fieldNamePrefix}${fieldName}`;
  const grundlag = binding.loenudviklingBeregningsgrundlag;
  const grundlagIssue = activeFieldIssue(loenudviklingIssues, serializeFieldAddress(grundlag.field.address));
  // Gul ring, når den forhøjede grundløn er større end trinlønnen (BB-313).
  const ekstraGrundloenWarning = manualCellWarnings.get(serializeFieldAddress(binding.offentligLoenEkstraGrundloen.field.address));
  const resolvedBaseDateErrorMessage = baseDateDisplay === '' ? baseDateErrorMessage : undefined;

  return (
    <>
      <Typography className="row--subheading">Lønudvikling</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Lønudvikling beregnes ud fra</Typography>
        <Box className="row--label-right-hover__content">
          <ChoiceField
            field={grundlag.field}
            location={grundlag.location}
            immediateCommitOverride={createManualRegulationBasisCommitOverride({
              field: grundlag.field,
              location: grundlag.location,
              manualCollection,
              manualPercentCollection,
              hasManualBaseRow,
              hasManualPercentBaseRow,
            })}
            name={name('loenudviklingBeregningsgrundlag')}
            {...(grundlagIssue === undefined ? {} : { crossFieldIssue: grundlagIssue })}
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

      {loenudviklingBasis === 'Overenskomst' ? overenskomstSlot : null}

      {loenudviklingBasis === 'Overenskomst' && erOffentligOverenskomst ? (
        <>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Lønoplysninger</Typography>
            <Box className="row--label-right-hover__content">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography className="row--text">Ansættelse</Typography>
                <ChoiceField
                  field={binding.offentligLoenType.field}
                  location={binding.offentligLoenType.location}
                  name={name('offentligLoenType')}
                  width={160}
                >
                  {offentligLoenTypeEnum.options.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </ChoiceField>
                <Typography className="row--text">Løntrin</Typography>
                <IntegerField
                  field={binding.offentligLoenTrin.field}
                  location={binding.offentligLoenTrin.location}
                  name={name('offentligLoenTrin')}
                  width={80}
                />
                <Typography className="row--text">Gruppe</Typography>
                <IntegerField
                  field={binding.offentligLoenGruppe.field}
                  location={binding.offentligLoenGruppe.location}
                  name={name('offentligLoenGruppe')}
                  inputRef={gruppeInputRef}
                  width={70}
                />
                <Tooltip title="Find løntrin" arrow>
                  {/* Eksplicit opt-in i Containerens tab-sekvens (jf. keyboard-navigation.md
                      §Implementeringsfrihed), samme tilgang som `Indsæt dags dato`. Container
                      lader Enter passere på knapper, så native button-semantik dækker både
                      Enter og mellemrum – der skal ingen egen keydown-vej til. Refen bærer
                      overlayets fokus-restore-mål (§Popup-fokus-restore): fokus skal tilbage
                      hertil ved lukning, uanset om brugeren lukkede med Escape, X eller backdrop. */}
                  <IconButton
                    type="button"
                    ref={loentrinFinderTriggerRef}
                    onClick={onOpenLoentrinFinder}
                    data-mineo-focusable-button="true"
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
                  field={binding.offentligLoenEkstraGrundloen.field}
                  location={binding.offentligLoenEkstraGrundloen.location}
                  name={name('offentligLoenEkstraGrundloen')}
                  width={160}
                  {...(ekstraGrundloenWarning === undefined ? {} : { warning: ekstraGrundloenWarning })}
                />
                {/* Enheden er brugerens eget valg og gemmes med beløbet. Den stod før som et fast suffiks efter
                    «Ansættelse», mens beregningen læste beløbet i TAF-enheden (fund A1). */}
                <Typography className="row--text">per</Typography>
                <SatsEnhedChoiceField
                  binding={binding.offentligLoenEkstraGrundloenAngivesPer}
                  name={name('offentligLoenEkstraGrundloenAngivesPer')}
                  width={110}
                />
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
              field={binding.loenudviklingStatistikModel.field}
              location={binding.loenudviklingStatistikModel.location}
              name={name('loenudviklingStatistikModel')}
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

      {loenudviklingBasis === 'Statistik' && statistikModel === 'ILON12 (Danmarks Statistik)' ? (
        <Typography className="row--text" sx={{ fontSize: '0.875rem', mb: 1 }}>
          {ILON12_DISCONTINUED_NOTE}
        </Typography>
      ) : null}

      {loenudviklingBasis === 'KRL satstabel' ? (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Satstabel</Typography>
          <Box className="row--label-right-hover__content">
            <ChoiceField
              field={binding.loenudviklingKRLSatstabel.field}
              location={binding.loenudviklingKRLSatstabel.location}
              name={name('loenudviklingKRLSatstabel')}
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
                field={binding.loenudviklingManuelNavn.field}
                location={binding.loenudviklingManuelNavn.location}
                name={name('loenudviklingManuelNavn')}
                width={manualNavnWidth}
              />
            </Box>
          </Box>
          <LoenudviklingManuelTable
            bindings={manualBindings}
            collection={manualCollection}
            committedRows={manualRows}
            ruleIssues={loenudviklingIssues}
            cellWarnings={manualCellWarnings}
            locationPrefix={manualLocationPrefix}
            baseDateDisplay={baseDateDisplay}
            baseDateISO={baseDateISO}
            baseDateErrorMessage={resolvedBaseDateErrorMessage}
            baseDateInfoTooltipText={baseDateInfoTooltipText}
            baseRowPercentErrors={baseRowPercentErrors}
            // Procent-tilstand spejler satsfelterne ovenfor. I Beløb-tilstand er de skjulte,
            // og brugeren indtaster basisrækkens tillægsprocenter direkte i tabellen.
            readOnlyBaseRowPercentFields={readOnlyBaseRowPercentFields}
            useSmallFont={true}
            locationNav={locationNav}
          />
        </Box>
      ) : null}

      {loenudviklingBasis === 'Manuel procentsats' ? (
        <Box sx={{ mt: 1 }}>
          <LoenudviklingManuelProcentsatsTable
            bindings={manualBindings}
            collection={manualPercentCollection}
            committedRows={manualPercentRows}
            ruleIssues={loenudviklingIssues}
            cellWarnings={manualCellWarnings}
            locationPrefix={manualPercentLocationPrefix}
            baseDateDisplay={baseDateDisplay}
            baseDateISO={baseDateISO}
            baseDateErrorMessage={resolvedBaseDateErrorMessage}
            baseDateInfoTooltipText={baseDateInfoTooltipText}
            useSmallFont={true}
            locationNav={locationNav}
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
                  Knaptilstand OG outputvalg kommer fra `reguleringDocument`. De tidligere
                  side-lokale `canDownload`-IIFE'er (skrevet med hver sin formel) og
                  `loenudviklingBasis`-switchen ved KLIK – altså før commit-barrieren – er
                  erstattet af den fælles resolver, som vælger efter settle på et frisk snapshot.
                */}
                {/*
                  Er intervallet ukendt, vises INTET – hverken tekst eller pladsholdertegn.
                  Bindestregen her var et levn fra en fjernet inline-tekst; erstatningen skulle have
                  været ingenting, og et bart `-` på linjen ligner en værdi, der ikke findes.
                */}
                {reguleringsDatoIntervalDisplay ? (
                  <Typography className="row--text" sx={{ textAlign: 'right' }}>
                    {reguleringsDatoIntervalDisplay}
                  </Typography>
                ) : null}
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
            Gate-årsagen findes her KUN i knappens tooltip, så beskeden vises rå – ellers ville en
            blokeret aktivering være helt usynlig for brugeren.
          */}
          <DocumentOutcomeMessage message={reguleringDocument.errorMessage} />
        </>
      ) : null}
    </>
  );
}
