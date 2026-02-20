import { aarsloenSchema, erstatningsopgoerelseSchema } from '../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

describe('formSchemas', () => {
  it('afviser dansk tusindtalsformat i procentfelter over 100 efter korrekt coercion', () => {
    const result = aarsloenSchema.safeParse({
      feriePct: '1.234',
      fritvalgPct: undefined,
      shSoPct: undefined,
      storeBededagPct: undefined,
      pensionPct: undefined,
      loenperiode: 'maaned',
      tableData: [],
      omregningTilFuldtAar: false,
      fuldLoenUnderFerie: false,
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      loenPaaHelligdage: 'Almindelig løn',
    });

    expect(result.success).toBe(false);
  });

  it('tillader deserialisering når AES-afgørelse er Ja uden tilhørende datoer', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.varigeMenAfgorelse = 'Ja';
    values.menAfgoerelseDato = undefined;
    values.midlertidigtEetAfgorelse = 'Ja';
    values.midlertidigEETAfgoerelseDato = undefined;
    values.midlertidigEETVirkningsdato = undefined;
    values.endeligtEetAfgorelse = 'Ja';
    values.endeligEETAfgoerelseDato = undefined;
    values.endeligEETVirkningsdato = undefined;

    const result = erstatningsopgoerelseSchema.safeParse(values);
    expect(result.success).toBe(true);
  });
});
