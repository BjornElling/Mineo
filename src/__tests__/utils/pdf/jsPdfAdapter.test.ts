/// <reference types="vitest/globals" />

import jsPDF from 'jspdf';
import { createJsPdfAdapter } from '../../../pdf/infrastructure/jsPdfAdapter';

/**
 * Tests for jsPdfAdapter
 *
 * Verificerer:
 * 1. Korrekt forwarding af alle metoder til jsPDF-instansen
 * 2. Defensiv guard fejler hårdt ved ugyldig pageSize-struktur
 * 3. getPageWidth/getPageHeight returnerer korrekte A4-dimensioner
 */
describe('createJsPdfAdapter', () => {
  const makeDoc = () =>
    new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  it('returnerer korrekt pageWidth for A4', () => {
    const adapter = createJsPdfAdapter(makeDoc());
    expect(adapter.getPageWidth()).toBeCloseTo(210, 0);
  });

  it('returnerer korrekt pageHeight for A4', () => {
    const adapter = createJsPdfAdapter(makeDoc());
    expect(adapter.getPageHeight()).toBeCloseTo(297, 0);
  });

  it('getNumberOfPages returnerer 1 for et nyt dokument', () => {
    const adapter = createJsPdfAdapter(makeDoc());
    expect(adapter.getNumberOfPages()).toBe(1);
  });

  it('addPage forøger sideantal', () => {
    const adapter = createJsPdfAdapter(makeDoc());
    adapter.addPage();
    expect(adapter.getNumberOfPages()).toBe(2);
  });

  it('setPage skifter til angivet side', () => {
    const doc = makeDoc();
    const adapter = createJsPdfAdapter(doc);
    adapter.addPage();
    // Verificer at setPage ikke kaster – jsPDF har ingen public "currentPage" getter
    expect(() => adapter.setPage(1)).not.toThrow();
    expect(() => adapter.setPage(2)).not.toThrow();
  });

  it('fejler hårdt hvis internal.pageSize mangler', () => {
    const doc = makeDoc();
    // Simuler korrupt jsPDF-intern struktur via unknown-assertion (undgår any)
    (doc as unknown as Record<string, unknown>)['internal'] = undefined;
    expect(() => createJsPdfAdapter(doc)).toThrow(
      'jsPDF internal.pageSize er ikke tilgængeligt'
    );
  });

  it('fejler hårdt hvis pageSize.width ikke er et tal', () => {
    const doc = makeDoc();
    // Simuler korrupt pageSize via unknown-assertion (undgår any)
    const internal = (doc as unknown as Record<string, unknown>)['internal'] as Record<string, unknown>;
    internal['pageSize'] = { width: 'invalid', height: 297 };
    expect(() => createJsPdfAdapter(doc)).toThrow(
      'jsPDF internal.pageSize er ikke tilgængeligt'
    );
  });
});
