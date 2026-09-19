/**
 * A compact, scrollable table with a sticky header, sized to sit inside a
 * detail section. Columns describe how each cell renders.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Empty } from './blocks';
import classes from './DetailModal.module.css';

export interface Column<Row> {
  key: string;
  header: string;
  align?: 'start' | 'end';
  render: (row: Row) => ReactNode;
}

interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  /** Shown instead of the table when there are no rows. */
  empty: string;
  maxHeight?: number;
}

export default function DataTable<Row>({ columns, rows, rowKey, empty, maxHeight = 300 }: DataTableProps<Row>) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;

  return (
    <div className={classes.tableScroll} style={{ '--table-max-height': `${maxHeight}px` } as CSSProperties}>
      <table className={classes.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} data-align={column.align} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {columns.map((column) => (
                <td key={column.key} data-align={column.align}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
