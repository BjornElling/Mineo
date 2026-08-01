/** Formaterer en liste med dansk komma-/"og"-syntaks uden Oxford-komma. */
export const formatDanishList = (items: readonly string[]): string => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} og ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} og ${items.at(-1)}`;
};
