import type { ReactNode } from 'react'
import { useI18n } from '../../../locales/I18nContext'

interface Column {
  key: string
  label: string
}

interface DataTableProps {
  columns: Column[]
  data: object[]
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
}

/**
 * Tableau de données avec pagination.
 */
export function DataTable({ columns, data, page, totalPages, onPageChange }: DataTableProps) {
  const { t } = useI18n()
  const hasPagination = page !== undefined && totalPages !== undefined && onPageChange !== undefined

  return (
    <div className="data-table-container">
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  {t('dashboard.table.noResults')}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {(row as Record<string, unknown>)[col.key] as ReactNode}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasPagination && totalPages > 1 && (
        <div className="data-table-pagination">
          <button
            className="pagination-button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            ←
          </button>
          <span className="pagination-info">
            {t('dashboard.table.page')} {page} {t('dashboard.table.of')} {totalPages}
          </span>
          <button
            className="pagination-button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}

