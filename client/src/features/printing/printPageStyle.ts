/** Page setup for the printer: a full sheet, or continuous till roll. */
export const printPageStyle = (size: 'Thermal' | 'A4'): string =>
  size === 'A4'
    ? '@page { size: A4; margin: 0; } @media print { body { margin: 0; } }'
    : '@page { size: 80mm auto; margin: 0; } @media print { body { margin: 0; } }';
