import * as React from 'react';
import {
  OFFENTLIGE_YDELSER_PDF_HEADERS,
  OFFENTLIGE_YDELSER_TABLE_HEADERS,
  resolveOffentligeYdelserColumnLabel,
} from '../../../domain/erstatningsopgoerelse/tables/offentligeYdelserTableColumns';
import { getOffentligeYdelserTableHeaderNodes } from '../../../components/tables/offentligeYdelserTableHeaderNodes';

describe('offentligeYdelserTableColumns', () => {
  it('bruger Ydelse og Tillæg på skærmen og i bilaget (BB-361)', () => {
    expect(OFFENTLIGE_YDELSER_TABLE_HEADERS).toEqual([
      'Fra dato',
      'Til dato',
      'Ydelse',
      'Tillæg',
      'Ydelsestype',
      'Periodisering',
      'Antal dage',
      'Ydelse per dag',
    ]);
    expect(OFFENTLIGE_YDELSER_PDF_HEADERS).toEqual([
      'Fra-dato',
      'Til-dato',
      'Ydelse',
      'Tillæg',
      'I alt',
    ]);
  });

  it('bruger skærmens navne i «Fejl og advarsler»', () => {
    expect(resolveOffentligeYdelserColumnLabel('ydelse')).toBe('Ydelse');
    expect(resolveOffentligeYdelserColumnLabel('tillaeg')).toBe('Tillæg');
  });

  it('bygger header-noden med informationsikon på Tillæg', () => {
    const nodes = getOffentligeYdelserTableHeaderNodes();

    expect(nodes).toHaveLength(OFFENTLIGE_YDELSER_TABLE_HEADERS.length);
    expect(nodes[0]).toBe('Fra dato');
    expect(nodes[3]).toEqual(expect.objectContaining({ type: 'span' }));

    const tillaegNode = nodes[3];
    if (!React.isValidElement<{ children?: React.ReactNode }>(tillaegNode)) {
      throw new Error('Forventede en header-node');
    }
    const children = React.Children.toArray(tillaegNode.props.children);
    expect(children[0]).toBe('Tillæg');
    expect(children[1]).toEqual(expect.objectContaining({ props: expect.objectContaining({
      title: 'Opdelingen af ydelser er rent visuel – værdierne lægges sammen i beregningen',
    }) }));
  });

  it('løser labels for dato- og ydelsestypekolonnerne', () => {
    expect(resolveOffentligeYdelserColumnLabel('fraDato')).toBe('Fra dato');
    expect(resolveOffentligeYdelserColumnLabel('tilDato')).toBe('Til dato');
    expect(resolveOffentligeYdelserColumnLabel('ydelsestype')).toBe('Ydelsestype');
  });
});
