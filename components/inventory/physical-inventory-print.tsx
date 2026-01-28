'use client'

import { formatDate } from '@/lib/utils'

export function PhysicalInventoryPrint({ inventory }: { inventory: any }) {
  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: auto;
            margin: 10mm;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .physical-inventory-print {
            max-width: 100%;
            margin: 0;
            padding: 0;
          }
          
          .physical-inventory-print table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: auto;
          }
          
          .physical-inventory-print tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          .physical-inventory-print thead {
            display: table-header-group;
          }
          
          .physical-inventory-print tfoot {
            display: table-footer-group;
          }
          
          .physical-inventory-print .no-print {
            display: none !important;
          }
          
          /* Optimize font sizes for print */
          .physical-inventory-print h1 {
            font-size: 18pt;
          }
          
          .physical-inventory-print .text-sm {
            font-size: 10pt;
          }
          
          .physical-inventory-print .text-xs {
            font-size: 9pt;
          }
        }
        
        @media screen {
          .physical-inventory-print {
            max-width: 210mm; /* A4 width */
            margin: 0 auto;
          }
        }
      `}</style>

      <div className="physical-inventory-print p-6 space-y-4 bg-white">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-3">
          <h1 className="text-2xl font-bold mb-2">INVENTARIO FÍSICO</h1>
          <div className="grid grid-cols-2 gap-2 text-sm max-w-md mx-auto">
            <div className="text-left"><strong>Número:</strong> {inventory.number}</div>
            <div className="text-right"><strong>Fecha:</strong> {formatDate(inventory.createdAt)}</div>
            <div className="text-left"><strong>Almacén:</strong> {inventory.warehouse?.name || '-'}</div>
            <div className="text-right">
              <strong>Estado:</strong>{' '}
              {inventory.status === 'PENDING' ? 'Pendiente' :
                inventory.status === 'COUNTING' ? 'En Conteo' :
                  inventory.status === 'COMPLETED' ? 'Completado' : 'Cancelado'}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="border-2 border-gray-700 rounded-lg p-4 bg-gray-50 text-sm space-y-1">
          <div className="font-semibold text-base mb-2">INSTRUCCIONES:</div>
          <div>1. Cuente físicamente cada producto en el almacén</div>
          <div>2. Anote la cantidad contada en la columna "Cantidad Contada"</div>
          <div>3. Si encuentra diferencias, anótelas en "Observaciones"</div>
          <div>4. Al finalizar, ingrese los datos en el sistema</div>
        </div>

        {/* Products Table */}
        <div className="border-2 border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="text-left p-3 border-b-2 border-gray-800 w-12">#</th>
                <th className="text-left p-3 border-b-2 border-gray-800">Producto / SKU</th>
                <th className="text-center p-3 border-b-2 border-gray-800 w-32">Cant. Sistema</th>
                <th className="text-center p-3 border-b-2 border-gray-800 w-32">Cant. Contada</th>
                <th className="text-left p-3 border-b-2 border-gray-800 w-48">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {inventory.items?.map((item: any, index: number) => {
                return (
                  <tr key={item.id} className="border-b border-gray-300">
                    <td className="p-3 text-center font-medium">{index + 1}</td>
                    <td className="p-3">
                      <div className="font-semibold">{item.product?.name || '-'}</div>
                      <div className="text-xs text-gray-600">SKU: {item.product?.sku || '-'}</div>
                      {item.variant && (
                        <div className="text-xs text-gray-600">Var: {item.variant.name}</div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="font-medium">{item.systemQuantity?.toFixed(2) || '0.00'}</div>
                      <div className="text-xs text-gray-500">{item.product?.unitOfMeasure || ''}</div>
                    </td>
                    <td className="p-3">
                      <div className="border-b-2 border-dashed border-gray-400 min-h-[30px] text-center font-medium">
                        {item.countedQuantity !== null ? item.countedQuantity.toFixed(2) : ''}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="border-b-2 border-dashed border-gray-400 min-h-[30px] text-xs">
                        {item.notes || ''}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="border-2 border-gray-700 rounded-lg p-4 space-y-2">
          <div className="font-semibold text-base mb-3">RESUMEN:</div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex justify-between border-b border-gray-300 pb-1">
              <span>Total Productos:</span>
              <span className="font-bold">{inventory.items?.length || 0}</span>
            </div>
            <div className="flex justify-between border-b border-gray-300 pb-1">
              <span>Contados:</span>
              <span className="font-bold">
                {inventory.items?.filter((item: any) => item.countedQuantity !== null).length || 0}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-300 pb-1">
              <span>Con Diferencias:</span>
              <span className="font-bold text-orange-600">
                {inventory.items?.filter((item: any) =>
                  item.countedQuantity !== null && item.difference !== null && item.difference !== 0
                ).length || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-700 border-t-2 border-gray-800 pt-4 mt-8">
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div>
              <div className="mb-2">Conteo realizado por:</div>
              <div className="border-b-2 border-black min-h-[30px]"></div>
            </div>
            <div>
              <div className="mb-2">Firma:</div>
              <div className="border-b-2 border-black min-h-[30px]"></div>
            </div>
            <div>
              <div className="mb-2">Fecha:</div>
              <div className="border-b-2 border-black min-h-[30px]"></div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

