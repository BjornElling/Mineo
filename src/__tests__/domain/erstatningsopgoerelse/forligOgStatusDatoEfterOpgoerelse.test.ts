import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import {
  buildEoErstatningsopgoerelseRows,
  buildEoForligRows,
} from '../../../domain/eoRowEvaluation/eoRowOverviewRows';
import {
  resolveForligDatoEfterOpgoerelseMessage,
  resolveStatusDatoEfterOpgoerelseMessage,
} from '../../../domain/erstatningsopgoerelse/validation/forligOgStatusDatoEfterOpgoerelse';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const eoWith = (overrides: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  opgørelseLavetDen: iso('2024-02-01'),
  ...overrides,
});

describe('resolveForligDatoEfterOpgoerelseMessage', () => {
  it('advarer med opgørelsens dato, når forliget er dateret efter den', () => {
    expect(resolveForligDatoEfterOpgoerelseMessage(eoWith({ forligDato: iso('2024-02-02') })))
      .toBe('Forliget er dateret efter opgørelsens dato (01-02-2024)');
  });

  it('er tavs på selve opgørelsens dato og før den', () => {
    expect(resolveForligDatoEfterOpgoerelseMessage(eoWith({ forligDato: iso('2024-02-01') }))).toBeUndefined();
    expect(resolveForligDatoEfterOpgoerelseMessage(eoWith({ forligDato: iso('2024-01-15') }))).toBeUndefined();
  });

  it('er tavs uden forligsdato eller uden «Opgørelse lavet den»', () => {
    expect(resolveForligDatoEfterOpgoerelseMessage(eoWith({ forligDato: undefined }))).toBeUndefined();
    expect(resolveForligDatoEfterOpgoerelseMessage(eoWith({
      opgørelseLavetDen: undefined,
      forligDato: iso('2024-03-01'),
    }))).toBeUndefined();
  });
});

describe('resolveStatusDatoEfterOpgoerelseMessage', () => {
  // Statusdatoen er dagen efter periodens slutdato: til-dato 31-01-2024 → status 01-02-2024.
  const medStatus = (overrides: Partial<ErstatningsopgoerelseValues>) => eoWith({
    kravPaaSvieSmerteGodtgoerelse: 'Ja',
    kravPaaTabtArbejdsfortjeneste: 'Ja',
    svieSmerteHelbredsstatus: 'Sygemeldt',
    tafArbejdsstatus: 'Uarbejdsdygtig',
    vedroererPeriodeFra: iso('2024-01-01'),
    vedroererPeriodeTil: iso('2024-01-31'),
    ...overrides,
  });

  it.each(['svieSmerteHelbredsstatus', 'tafArbejdsstatus'] as const)(
    '%s: advarer, når statusdatoen ligger efter opgørelsens dato',
    (felt) => {
      expect(resolveStatusDatoEfterOpgoerelseMessage(felt, medStatus({ opgørelseLavetDen: iso('2024-01-04') })))
        .toBe('Statusdatoen ligger efter opgørelsens dato (04-01-2024)');
      // Én dag før statusdatoen er grænsetilfældet for «efter».
      expect(resolveStatusDatoEfterOpgoerelseMessage(felt, medStatus({ opgørelseLavetDen: iso('2024-01-31') })))
        .toBe('Statusdatoen ligger efter opgørelsens dato (31-01-2024)');
    }
  );

  it.each(['svieSmerteHelbredsstatus', 'tafArbejdsstatus'] as const)(
    '%s: er tavs, når statusdatoen er lig opgørelsens dato',
    (felt) => {
      expect(resolveStatusDatoEfterOpgoerelseMessage(felt, medStatus({ opgørelseLavetDen: iso('2024-02-01') })))
        .toBeUndefined();
    }
  );

  it('er tavs, når der ikke er valgt nogen status', () => {
    const values = medStatus({
      opgørelseLavetDen: iso('2024-01-04'),
      svieSmerteHelbredsstatus: undefined,
      tafArbejdsstatus: undefined,
    });
    expect(resolveStatusDatoEfterOpgoerelseMessage('svieSmerteHelbredsstatus', values)).toBeUndefined();
    expect(resolveStatusDatoEfterOpgoerelseMessage('tafArbejdsstatus', values)).toBeUndefined();
  });

  it('er tavs, når statusfeltets krav ikke er rejst (statussen trykkes ikke)', () => {
    const values = medStatus({
      opgørelseLavetDen: iso('2024-01-04'),
      kravPaaSvieSmerteGodtgoerelse: 'Nej',
      kravPaaTabtArbejdsfortjeneste: 'Nej',
    });
    expect(resolveStatusDatoEfterOpgoerelseMessage('svieSmerteHelbredsstatus', values)).toBeUndefined();
    expect(resolveStatusDatoEfterOpgoerelseMessage('tafArbejdsstatus', values)).toBeUndefined();
  });

  it('er tavs uden periodens slutdato', () => {
    expect(resolveStatusDatoEfterOpgoerelseMessage('tafArbejdsstatus', medStatus({
      opgørelseLavetDen: iso('2024-01-04'),
      vedroererPeriodeTil: undefined,
    }))).toBeUndefined();
  });
});

describe('Beregning: «Fejl og advarsler»-rækkerne', () => {
  it('giver forligsdatoen en ikke-blokerende advarsel efter opgørelsens dato', () => {
    const rows = buildEoForligRows(
      eoWith({ forligAnsvarsgradProcent: 50, forligDato: iso('2024-03-01') }),
      EMPTY_FIELD_ISSUE_SET
    );

    expect(rows.find((row) => row.id === 'forlig.dato')).toEqual(expect.objectContaining({
      status: 'warning',
      displayValue: 'Advarsel (Forliget er dateret efter opgørelsens dato (01-02-2024))',
    }));
    expect(rows.filter((row) => row.status === 'error')).toEqual([]);
  });

  it('lader en forligsdato på opgørelsens dato være uden advarsel', () => {
    const rows = buildEoForligRows(
      eoWith({ forligAnsvarsgradProcent: 50, forligDato: iso('2024-02-01') }),
      EMPTY_FIELD_ISSUE_SET
    );

    expect(rows.find((row) => row.id === 'forlig.dato')?.status).toBe('ok');
  });

  it('giver begge valgte statusfelter en ikke-blokerende advarsel', () => {
    const rows = buildEoErstatningsopgoerelseRows(eoWith({
      opgørelseLavetDen: iso('2024-01-04'),
      kravPaaSvieSmerteGodtgoerelse: 'Ja',
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      svieSmerteHelbredsstatus: 'Sygemeldt',
      tafArbejdsstatus: 'Uarbejdsdygtig',
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
    }), EMPTY_FIELD_ISSUE_SET);

    for (const id of ['erstatningsopgoerelse.helbredsstatus', 'erstatningsopgoerelse.arbejdsstatus']) {
      expect(rows.find((row) => row.id === id)).toEqual(expect.objectContaining({
        status: 'warning',
        displayValue: 'Advarsel (Statusdatoen ligger efter opgørelsens dato (04-01-2024))',
      }));
    }
  });

  it('bevarer den manglende status som fejl i stedet for at advare om datoen', () => {
    const rows = buildEoErstatningsopgoerelseRows(eoWith({
      opgørelseLavetDen: iso('2024-01-04'),
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      tafArbejdsstatus: undefined,
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
    }), EMPTY_FIELD_ISSUE_SET);

    expect(rows.find((row) => row.id === 'erstatningsopgoerelse.arbejdsstatus')?.status).toBe('error');
  });
});
