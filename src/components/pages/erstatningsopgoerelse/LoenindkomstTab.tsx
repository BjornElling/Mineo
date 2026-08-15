import React from 'react';
import { Box, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ConfirmationDialog from '../../ui/ConfirmationDialog';
import FloatingActionButton from '../../ui/FloatingActionButton';
import ContentBox from '../../layout/ContentBox';
import { type ErstatningsopgoerelseValues, type StamdataValues } from '../../../schemas/formSchemas';
import { useLoenindkomstViewModel } from './loenindkomst/useLoenindkomstViewModel';
import { LoenindkomstVmProvider, type LoenindkomstVm } from './loenindkomst/loenindkomstContext';
import AnsaettelsesforholdCard from './loenindkomst/AnsaettelsesforholdCard';
import LoentrinFinderOverlay from './shared/LoentrinFinderOverlay';
import type { FieldIssueSet } from '../../../inputCore/inputIssue';

type Props = {
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
  onNavigateToTabtArbejdsfortjeneste: () => void;
  /** Id'er på ansættelsesforhold hvor SFGG løber >6 mdr. efter sidste indkomst.
   *  Beregnet i EO-snapshot (committed-state); tom liste når snapshot.data er null. */
  sfggSixMonthWarningEmploymentIds: readonly string[];
  manualRegulationDateIssues: FieldIssueSet;
};

const LoenindkomstTab = React.memo(({
  eoValues,
  stamdataValues,
  onNavigateToTabtArbejdsfortjeneste,
  sfggSixMonthWarningEmploymentIds,
  manualRegulationDateIssues,
}: Props) => {
  // View-model-laget ejer al afledt visningstilstand, lokal UI-state og handlers (jf. A1).
  // Siden er nu en tynd forbruger: den læser kun den flade model og beskriver layout.
  const vm = useLoenindkomstViewModel({
    eoValues,
    stamdataValues,
  });
  // Fanen er nu en komposition: den deler view-modellen med ansættelsesforhold-kortene via
  // konteksten (jf. A1) og beholder kun det fane-niveau-layout (intro, overlay, dialoger).
  const {
    addDialogOpen,
    setAddDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    setDeleteTargetId,
    deleteTargetName,
    loentrinFinder,
    totalAnsaettelsesforhold,
    addAnsaettelsesforholdGate,
    handleAddConfirm,
    handleDeleteConfirm,
  } = vm;

  // Kontekst-værdi til kortene: den fulde view-model + de få side-niveau-værdier kortene læser.
  const ctxValue: LoenindkomstVm = {
    ...vm,
    beregnesUdFra: eoValues.beregnesUdFra,
    tafBeregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
    sfggSixMonthWarningEmploymentIds,
    manualRegulationDateIssues,
    onNavigateToTabtArbejdsfortjeneste,
  };

  return (
    <LoenindkomstVmProvider value={ctxValue}>
    <Box data-section-id="loenindkomst">
      <ContentBox
        className="content-box"
        sx={{ position: 'relative', marginBottom: totalAnsaettelsesforhold > 0 ? '40px' : '60px' }}
      >
        <Typography className="section-header">Ansættelsesforhold</Typography>

        <Box className="row--label-right-hover">
          <Box className="row--label-right-hover__content" sx={{ width: '100%', justifyContent: 'flex-start' }}>
            <Typography className="row--text">
              Tryk på den blå knap for at indsætte et ansættelsesforhold.
            </Typography>
          </Box>
        </Box>

        {/* «Bemærk, at» + punkterne står i en egen `flow--16`-blok (samme utility som Mineo-siden
            bruger til løbende tekst): den neutraliserer `row--text`s faste rækkehøjde, så linjerne
            står tæt sammen i stedet for at fylde en hoverrække hver. Wrapperen ligger på blokken
            alene — ikke på hele `content-box` — så section-headeren og knap-rækken beholder
            sidens normale rækkeafstand. */}
        <Box className="flow--16">
          <Typography className="row--text">Bemærk, at</Typography>

          {[
            'Lønindkomst, tillæg og andre relevante oplysninger skal angives individuelt for hvert enkelt ansættelsesforhold.',
            'Det er ikke nødvendigt at dele indtastninger op i før og efter skaden. Programmet sondrer selv.',
          ].map((punkt) => (
            // Indrykningen ligger som margin, ikke padding: `.flow--16 .row--text` sætter
            // `padding: 0 12px !important` og ville ellers slå den ud.
            <Typography className="row--text" key={punkt} sx={{ marginLeft: '16px' }}>
              {`•  ${punkt}`}
            </Typography>
          ))}
        </Box>

        {totalAnsaettelsesforhold === 0 ? (
          <Box sx={{ position: 'absolute', bottom: -28, right: 44, display: 'flex', gap: '14px' }}>
            <FloatingActionButton
              icon={<AddIcon />}
              color="primary"
              disabled={addAnsaettelsesforholdGate.disabled}
              tooltip="Tilføj nyt ansættelsesforhold"
              disabledReason={addAnsaettelsesforholdGate.disabledReason}
              onClick={() => {
                setAddDialogOpen(true);
              }}
            />
          </Box>
        ) : null}

      </ContentBox>

      {eoValues.loenindkomstAnsaettelsesforhold.map((af, index) => (
        <AnsaettelsesforholdCard key={af.id} af={af} index={index} />
      ))}

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
        headingId={loentrinFinder.headingId}
        overenskomstLabel={loentrinFinder.overenskomstLabel}
        inputAmountNumber={loentrinFinder.inputAmountNumber}
        triggerRef={loentrinFinder.activeTriggerRef}
        onClose={loentrinFinder.closeFinder}
        onCalculate={loentrinFinder.handleCalculate}
      />

      {/* Tilføj-dialog */}
      <ConfirmationDialog
        open={addDialogOpen}
        title="Tilføj ansættelsesforhold"
        message={
          <>
            Dette vil tilføje et nyt ansættelsesforhold nederst på siden.
            <br />
            <br />
            Bekræft venligst.
          </>
        }
        confirmText="Ja, tilføj"
        cancelText="Annuller"
        onConfirm={handleAddConfirm}
        onCancel={() => {
          setAddDialogOpen(false);
        }}
      />

      {/* Slet-dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        title="Slet ansættelsesforhold"
        message={
          <>
            {deleteTargetName !== ''
              ? `Dette vil slette alle oplysninger i ansættelsesforholdet (${deleteTargetName}). Handlingen kan fortrydes.`
              : 'Dette vil slette alle oplysninger i dette ansættelsesforhold. Handlingen kan fortrydes.'}
            <br />
            <br />
            Bekræft venligst.
          </>
        }
        confirmText="Ja, slet"
        cancelText="Annuller"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setDeleteTargetId(null);
        }}
      />
    </Box>
    </LoenindkomstVmProvider>
  );
});

LoenindkomstTab.displayName = 'LoenindkomstTab';

export default LoenindkomstTab;
