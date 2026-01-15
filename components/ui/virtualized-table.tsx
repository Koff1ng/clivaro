'use client'

import { List as VirtualList } from 'react-window'

interface VirtualizedTableProps<T> {
  data: T[]
  columns: Array<{
    key: string
    header: string
    width?: number
    render?: (item: T) => React.ReactNode
  }>
  height?: number
  rowHeight?: number
  onRowClick?: (item: T) => void
}

export function VirtualizedTable<T extends { id: string }>({
  data,
  columns,
  height = 400,
  rowHeight = 50,
  onRowClick,
}: VirtualizedTableProps<T>) {
  const Row = ({ index, style, ariaAttributes }: { index: number; style: React.CSSProperties; ariaAttributes?: any }) => {
    const item = data[index]
    
    return (
      <div
        style={style}
        {...(ariaAttributes || {})}
        onClick={() => onRowClick?.(item)}
        className={`flex items-center border-b hover:bg-gray-50 cursor-pointer ${onRowClick ? '' : 'cursor-default'}`}
      >
        {columns.map((col, colIndex) => (
          <div
            key={col.key}
            className="px-4 py-2"
            style={{ width: col.width || `${100 / columns.length}%` }}
          >
            {col.render ? col.render(item) : (item as any)[col.key]}
          </div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-gray-500">
        No hay datos para mostrar
      </div>
    )
  }

  return (
    <div className="border rounded-lg">
      <div className="flex items-center border-b bg-gray-50">
        {columns.map((col) => (
          <div
            key={col.key}
            className="px-4 py-3 font-semibold text-sm"
            style={{ width: col.width || `${100 / columns.length}%` }}
          >
            {col.header}
          </div>
        ))}
      </div>
      <VirtualList
        defaultHeight={height}
        rowCount={data.length}
        rowHeight={rowHeight}
        rowComponent={Row as any}
        rowProps={{} as any}
        style={{ height: Math.min(height, data.length * rowHeight), width: '100%' }}
      />
    </div>
  )
}

