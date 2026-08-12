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
    cannotAddMore,
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

        <Box className="row--label-right-hover">
          <Box className="row--label-right-hover__content" sx={{ width: '100%', justifyContent: 'flex-start' }}>
            <Typography className="row--text">Bemærk, at</Typography>
          </Box>
        </Box>

        {/* Punkterne står som almindelige tekstrækker med et ledende «•», så de deler `row--text`s
            typografi og rækkeafstand med resten af siden (der findes ingen delt listekomponent). */}
        {[
          'Lønindkomst, tillæg og andre relevante oplysninger angives individuelt for hvert enkelt ansættelsesforhold.',
          'Det er ikke nødvendigt at dele indtastninger op i før og efter skaden. Programmet sondrer selv.',
        ].map((punkt) => (
          <Box className="row--label-right-hover" key={punkt}>
            <Box className="row--label-right-hover__content" sx={{ width: '100%', justifyContent: 'flex-start' }}>
              <Typography className="row--text" sx={{ paddingLeft: '16px' }}>
                {`•  ${punkt}`}
              </Typography>
            </Box>
          </Box>
        ))}

        {totalAnsaettelsesforhold === 0 ? (
          <Box sx={{ position: 'absolute', bottom: -28, right: 44, display: 'flex', gap: '14px' }}>
            <FloatingActionButton
              icon={<AddIcon />}
              color="primary"
              disabled={cannotAddMore}
              tooltip={cannotAddMore ? 'Maksimalt 10 ansættelsesforhold' : 'Tilføj nyt ansættelsesforhold'}
              shake={cannotAddMore}
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
        open={loentrinFinder.loentrinFinderOpenForAfId !== null}
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
