// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PageTabs from '../../../components/layout/PageTabs';
import SideTab from '../../../components/layout/SideTab';

type Key = 'a' | 'b' | 'c';

const ITEMS = [
  { key: 'a' as const, label: 'Fane A' },
  { key: 'b' as const, label: 'Fane B' },
  { key: 'c' as const, label: 'Fane C' },
];

describe('PageTabs', () => {
  it('rendere en fane pr. item med den delte tab-item-klasse', () => {
    render(<PageTabs<Key> items={ITEMS} value="a" onChange={vi.fn()} />);
    for (const item of ITEMS) {
      const tab = screen.getByRole('tab', { name: item.label });
      expect(tab.classList.contains('tab-item')).toBe(true);
    }
  });

  it('kalder onChange med den valgte fane-nøgle', () => {
    const onChange = vi.fn();
    render(<PageTabs<Key> items={ITEMS} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Fane B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('markerer den aktive fane som selected', () => {
    render(<PageTabs<Key> items={ITEMS} value="c" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Fane C' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Fane A' })).toHaveAttribute('aria-selected', 'false');
  });

  it('markerer ingen fane når value er false (side-fane aktiv)', () => {
    render(<PageTabs<Key> items={ITEMS} value={false} onChange={vi.fn()} />);
    for (const item of ITEMS) {
      expect(screen.getByRole('tab', { name: item.label })).toHaveAttribute('aria-selected', 'false');
    }
  });
});

describe('SideTab', () => {
  it('rendere label og placerer sig ved højrekanten via top-prop', () => {
    render(<SideTab label="EO-kontrol" active={false} onClick={vi.fn()} top="125px" />);
    const el = screen.getByText('EO-kontrol');
    expect(el.classList.contains('side-tab')).toBe(true);
    expect(el.classList.contains('active')).toBe(false);
    expect(el).toHaveStyle({ top: '125px', left: '1200px' });
  });

  it('tilføjer active-klassen når aktiv', () => {
    render(<SideTab label="Test" active onClick={vi.fn()} top="-25px" />);
    expect(screen.getByText('Test').classList.contains('active')).toBe(true);
  });

  it('kalder onClick ved klik', () => {
    const onClick = vi.fn();
    render(<SideTab label="Kontroltabel" active={false} onClick={onClick} top="125px" />);
    fireEvent.click(screen.getByText('Kontroltabel'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
