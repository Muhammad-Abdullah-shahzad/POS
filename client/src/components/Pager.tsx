/**
 * Page controls for a paged list: "Showing 26–50 of 1,240 products" and the
 * page links. Built on react-paginate, which counts pages from 0; this
 * component counts from 1 like the server does.
 */
import ReactPaginateExport from 'react-paginate';
import classes from './Pager.module.css';

// react-paginate ships only a CommonJS/UMD bundle. Depending on the bundler
// (Vite in development, Rolldown in the build), its default export arrives
// either as the component or wrapped in `{ default }`; accept both.
const ReactPaginate =
  (ReactPaginateExport as unknown as { default?: typeof ReactPaginateExport }).default ?? ReactPaginateExport;

interface PagerProps {
  /** 1-based. */
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  /** Plural name of what is listed, e.g. "products". */
  noun?: string;
}

const count = new Intl.NumberFormat();

export default function Pager({ page, pageCount, pageSize, total, onChange, noun = 'records' }: PagerProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className={classes.root}>
      <p className={classes.summary}>
        {total === 0
          ? `No ${noun}`
          : `Showing ${count.format(first)}–${count.format(last)} of ${count.format(total)} ${noun}`}
      </p>

      {pageCount > 1 && (
        <ReactPaginate
          forcePage={Math.min(page, pageCount) - 1}
          pageCount={pageCount}
          onPageChange={({ selected }) => onChange(selected + 1)}
          pageRangeDisplayed={3}
          marginPagesDisplayed={1}
          previousLabel="Previous"
          nextLabel="Next"
          breakLabel="…"
          containerClassName={classes.pages}
          pageLinkClassName={classes.link}
          previousLinkClassName={classes.link}
          nextLinkClassName={classes.link}
          breakLinkClassName={classes.gap}
          activeLinkClassName={classes.current}
          disabledLinkClassName={classes.disabled}
        />
      )}
    </div>
  );
}
