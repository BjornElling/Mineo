import React from 'react';
import { Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import InfoTooltipIcon from '../../common/InfoTooltipIcon';
import {
  DataRow,
  MultiLineDataRow,
  formatKroner,
  formatKronerPair,
  formatKronerPerEnhed,
  formatOptionalPercent,
  renderReferenceValue,
} from './satserRows';
import type { SatserProjectionValue } from '../../../domain/satser/satserProjection';

type Satser = NonNullable<SatserProjectionValue['satser']>;

/**
 * De fire sats-sektioner (EAL, ASL, Diverse, Referencer).
 *
 * Komponenten renderes KUN for et gyldigt valgt år: `satser` er non-nullable her, fordi siden viser sin
 * vejledningstekst i stedet, når projektionen er `blocked` (§3.9). Sektionerne kan derfor ikke vise satser for et
 * fallback-år.
 */
const SatserRateSections = React.memo(({ satser }: { satser: Satser }) => (
  <>
    <ContentBox className="content-box">
      <Typography className="section-header">Erstatningsansvarsloven</Typography>

      <DataRow
        label="Godtgørelse for svie og smerte"
        value={formatKronerPerEnhed(satser.eal.svieSmertePrDag, 'sygedag')}
      />
      <DataRow label="Maksimum for svie og smerte" value={formatKroner(satser.eal.svieSmerteMax)} />
      <DataRow
        label="Maksimum for erhvervsevnetabserstatning"
        value={formatKroner(satser.eal.erhvervsevnetabEalMax)}
      />
      <DataRow label="Mindstebeløb for forsørgertab" value={formatKroner(satser.eal.foersoergertabEalMin)} />
      <DataRow
        label="Vejledende udtalelse om erhvervsevnetab"
        value={formatKroner(satser.eal.vejledendeUdtalelseEet)}
      />
    </ContentBox>

    <ContentBox className="content-box">
      <Typography className="section-header">Arbejdsskadesikringsloven</Typography>

      <DataRow
        label="Godtgørelse for varige mén"
        value={formatKronerPerEnhed(satser.asl.varigeMenPrGrad, 'méngrad')}
      />
      <DataRow label="Maksimum årsløn" value={formatKroner(satser.asl.aarsloenAslMax)} />
      <DataRow label="Minimum årsløn" value={formatKroner(satser.asl.aarsloenMin)} />
      <DataRow
        label="Minimum årsløn (skader før 1.7.2024)"
        value={formatKroner(satser.asl.aarsloenMinFoer2024)}
      />
      <DataRow
        label="Minimum årsløn (skader fra 1.7.2024)"
        value={formatKroner(satser.asl.aarsloenMinFra2024)}
      />
      <DataRow label="Overgangsbeløb" value={formatKroner(satser.asl.overgangsbelob)} />
      <DataRow
        label="Reguleringsprocent for erhvervsevnetab"
        value={formatOptionalPercent(satser.asl.reguleringProcentErhvervsevnetab)}
      />
      <DataRow
        label="Reguleringsprocent for erhvervsevnetab (før 2024)"
        value={formatOptionalPercent(satser.asl.reguleringProcentErhvervsevnetabFoer2024)}
      />
      <DataRow
        label="Reguleringsprocent for erhvervsevnetab (fra 2024)"
        value={formatOptionalPercent(satser.asl.reguleringProcentErhvervsevnetabFra2024)}
      />
    </ContentBox>

    <ContentBox className="content-box">
      <Typography className="section-header">Diverse</Typography>

      <MultiLineDataRow
        rows={[
          {
            key: 'fri-proces',
            label: (
              <>
                Beløbsgrænse for fri proces (enlig/samlevende):
                <InfoTooltipIcon title="Personlig indkomst + positiv kapitalindkomst" />
              </>
            ),
            value: formatKronerPair(satser.diverse.friProcesEnlig, satser.diverse.friProcesSamlevende),
          },
          {
            key: 'fri-proces-barn',
            label: '+ Tillæg per barn under 18 år:',
            value: formatKroner(satser.diverse.friProcesBarn),
          },
        ]}
      />
      <DataRow label="Reguleringssats" value={formatOptionalPercent(satser.diverse.reguleringssats)} />
    </ContentBox>

    <ContentBox className="content-box">
      <Typography className="section-header">Referencer</Typography>

      <DataRow label="Erstatningsansvarsloven" value={renderReferenceValue(satser.referencer.ealReferenceLinks)} />
      <DataRow label="Arbejdsskadesikringsloven" value={renderReferenceValue(satser.referencer.aslReferenceLinks)} />
      <DataRow label="Kapitalisering" value={renderReferenceValue(satser.referencer.kapitaliseringLinks)} />
      <DataRow
        label="Kapitalisering (skade fra 1.1.2011)"
        value={renderReferenceValue(satser.referencer.kapitaliseringSkadeFra2011Links)}
      />
      <DataRow
        label="Kapitalisering (skade før 1.1.2011)"
        value={renderReferenceValue(satser.referencer.kapitaliseringSkadeFoer2011Links)}
      />
      <DataRow
        label="Kapitalisering (skade fra 1.7.2007)"
        value={renderReferenceValue(satser.referencer.kapitaliseringSkadeFra2007Links)}
      />
      <DataRow
        label="Kapitalisering (skade før 1.7.2007)"
        value={renderReferenceValue(satser.referencer.kapitaliseringSkadeFoer2007Links)}
      />
      <DataRow label="Fri proces" value={renderReferenceValue(satser.referencer.friProcesReferenceLinks)} />
      <DataRow
        label="Reguleringssatser"
        value={renderReferenceValue(satser.referencer.reguleringssatsReferenceLinks)}
      />
    </ContentBox>
  </>
));

SatserRateSections.displayName = 'SatserRateSections';

export default SatserRateSections;
