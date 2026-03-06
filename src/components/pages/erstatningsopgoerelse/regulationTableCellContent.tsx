import * as React from 'react';

export const renderRegulationTableCellContent = (value: string): React.ReactNode => {
  if (!value.includes('/')) return value;

  const parts = value.split('/');
  return parts.flatMap((part, index) => {
    const nodes: React.ReactNode[] = [];
    if (index > 0) {
      nodes.push(
        <span key={`${value}-slash-${index}`} style={{ whiteSpace: 'nowrap' }}>
          /
        </span>
      );
      nodes.push(<wbr key={`${value}-break-${index}`} />);
    }
    nodes.push(
      <span key={`${value}-part-${index}`} style={{ whiteSpace: 'nowrap' }}>
        {part}
      </span>
    );
    return nodes;
  });
};
