import {
  adaptPersistedFileDataForLoad,
  adaptPersistedSectionForLoad,
} from '../../persistence/persistedLoadAdapter';

describe('persistedLoadAdapter', () => {
  it('bruger samme godkendte tavse undtagelse før filoptælling og ved sektionsload', () => {
    const source = {
      stamdata: { journalnr: 'J-1' },
      erstatningsopgoerelse: {
        opsagtFraStilling: 'Ja',
        sfggSygeperioderFoer2015: [{ id: 'historisk' }],
        beholdtFelt: 'bevares',
      },
    };

    const fileData = adaptPersistedFileDataForLoad(source);
    const section = adaptPersistedSectionForLoad(
      'erstatningsopgoerelse',
      source.erstatningsopgoerelse,
      '3.12'
    );

    expect(fileData).toEqual({
      stamdata: { journalnr: 'J-1' },
      erstatningsopgoerelse: { beholdtFelt: 'bevares' },
    });
    expect(section.value).toEqual(fileData.erstatningsopgoerelse);
    expect(source.erstatningsopgoerelse).toHaveProperty('opsagtFraStilling', 'Ja');
  });

  it('lader fremmede felter urørte, så den almindelige preflight fortsat kan rapportere dem', () => {
    const adapted = adaptPersistedFileDataForLoad({
      fremmedSektion: { værdi: true },
      erstatningsopgoerelse: { ukendtFelt: 'skal rapporteres' },
    });

    expect(adapted).toEqual({
      fremmedSektion: { værdi: true },
      erstatningsopgoerelse: { ukendtFelt: 'skal rapporteres' },
    });
  });

  it('migrerer versionsløs fødselsdato og EET-årslønner mellem historiske sektioner', () => {
    const adapted = adaptPersistedFileDataForLoad({
      stamdata: { journalnr: 'J-1' },
      faellesPersondata: { skadelidteFodselsdato: '1990-01-01' },
      erhvervsevnetab: {
        aslAarsloen: { kind: 'number', value: 400000 },
        ealAarsloen: { kind: 'number', value: 450000 },
        beholdtFelt: true,
      },
    }, 'legacy-unversioned');

    expect(adapted).toEqual({
      stamdata: { journalnr: 'J-1', skadelidteFodselsdato: '1990-01-01' },
      faellesAarsloen: {
        aslAarsloen: { kind: 'number', value: 400000 },
        ealAarsloen: { kind: 'number', value: 450000 },
      },
      erhvervsevnetab: { beholdtFelt: true },
    });
  });

  it('lader tværgående destinationskonflikter stå til preflight', () => {
    const source = {
      stamdata: { skadelidteFodselsdato: '1980-01-01' },
      faellesPersondata: { skadelidteFodselsdato: '1990-01-01' },
      faellesAarsloen: { aslAarsloen: { kind: 'number', value: 300000 } },
      erhvervsevnetab: { aslAarsloen: { kind: 'number', value: 400000 } },
    };

    expect(adaptPersistedFileDataForLoad(source, 'legacy-unversioned')).toEqual(source);
  });
});
