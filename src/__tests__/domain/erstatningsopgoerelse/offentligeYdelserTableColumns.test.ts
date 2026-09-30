import * as React from 'react';
import {
  getOffentligeYdelserTableHeaderNodes,
  OFFENTLIGE_YDELSER_PDF_HEADERS,
  OFFENTLIGE_YDELSER_TABLE_HEADERS,
  resolveOffentligeYdelserColumnLabel,
} from '../../../domain/erstatningsopgoerelse/tables/offentligeYdelserTableColumns';

describe('offentligeYdelserTableColumns', () => {
  it('bruger Ydelse og Ydelse (2) som de to standard ydelseskolonner', () => {
    expect(OFFENTLIGE_YDELSER_TABLE_HEADERS).toEqual([
      'Fra-dato',
      'Til-dato',
      'Ydelse',
      'Ydelse (2)',
      'Ydelsestype',
      'Periodisering',
      'Antal dage',
      'Ydelse / dag',
    ]);
    expect(OFFENTLIGE_YDELSER_PDF_HEADERS).toEqual([
      'Fra-dato',
      'Til-dato',
      'Ydelse',
      'Ydelse (2)',
      'I alt',
    ]);
  });

  it('giver de nye labels for ydelse og det andet ydelsesfelt i fejl- og inspektionkontekster', () => {
    expect(resolveOffentligeYdelserColumnLabel('ydelse')).toBe('Ydelse');
    expect(resolveOffentligeYdelserColumnLabel('tillaeg')).toBe('Ydelse (2)');
  });

  it('bygger header-noden med tooltip på det andet ydelsesfelt', () => {
    const nodes = getOffentligeYdelserTableHeaderNodes();

    expect(nodes).toHaveLength(OFFENTLIGE_YDELSER_TABLE_HEADERS.length);
    expect(nodes[0]).toBe('Fra-dato');
    expect(nodes[3]).toEqual(expect.objectContaining({ type: 'span' }));

    const ydelseToNode = nodes[3];
    if (!React.isValidElement<{ children?: React.ReactNode }>(ydelseToNode)) {
      throw new Error('Forventede en header-node');
    }
    const children = React.Children.toArray(ydelseToNode.props.children);
    expect(children[0]).toBe('Ydelse (2)');
    expect(children[1]).toEqual(expect.objectContaining({ props: expect.objectContaining({
      title: 'Opdelingen af ydelser er rent visuel - værdierne lægges sammen i beregningen',
    }) }));
  });

  it('løser labels for dato- og ydelsestypekolonnerne', () => {
    expect(resolveOffentligeYdelserColumnLabel('fraDato')).toBe('Fra dato');
    expect(resolveOffentligeYdelserColumnLabel('tilDato')).toBe('Til dato');
    expect(resolveOffentligeYdelserColumnLabel('ydelsestype')).toBe('Ydelsestype');
  });
});
