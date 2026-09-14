import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);

const buildValues = (): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  beregnesUdFra: 'Angivet dagsløn',
  vedroererPeriodeFra: iso('2024-05-01'),
  vedroererPeriodeTil: iso('2024-05-05'),
  kravPaaSvieSmerteGodtgoerelse: 'Ja',
  svieSmertePerioder: [{
    id: 'ss-men-stop',
    fra: iso('2024-05-01'),
    til: iso('2024-05-05'),
    tilstand: 'sygemeldt',
  }],
  varigeMenAfgorelse: 'Ja',
  menAfgoerelseDato: iso('2024-05-03'),
  verserendeKlageMen: 'Nej',
});

describe('EOInspektion – uafhængigt facit for mén-stop i S/S-tidslinjen', () => {
  it('stopper S/S-status på mén-datoen og viser ingen status efter datoen', () => {
    const model = buildEOInspektionModel(buildValues());
    const dates = ['2024-05-01', '2024-05-02', '2024-05-03', '2024-05-04', '2024-05-05'];

    const statuses = dates.map((date) => {
      const rowIndex = model.tableData.dates.indexOf(iso(date));
      expect(rowIndex).toBeGreaterThanOrEqual(0);
      return model.getCell(rowIndex, 'base:ss_day');
    });

    // Den rå S/S-periode fortsætter efter 03-05, men mén-afgørelsen stopper den.
    expect(statuses).toEqual(['Ja', 'Ja', 'Varige Mén', '-', '-']);
    expect(model.integrityIssues).toEqual([]);
  });
});
