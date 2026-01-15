'use client'

import { formatDate } from '@/lib/utils'

export function PhysicalInventoryPrint({ inventory }: { inventory: any }) {
  return (
    <div className="thermal-ticket p-4 space-y-4">
      {/* Header */}
      <div className="text-center border-b pb-3">
        <h1 className="text-lg font-bold mb-1">INVENTARIO FÍSICO</h1>
        <div className="text-sm space-y-1">
          <div><strong>Número:</strong> {inventory.number}</div>
          <div><strong>Almacén:</strong> {inventory.warehouse?.name || '-'}</div>
          <div><strong>Fecha:</strong> {formatDate(inventory.createdAt)}</div>
          <div><strong>Estado:</strong> {
            inventory.status === 'PENDING' ? 'Pendiente' :
            inventory.status === 'COUNTING' ? 'En Conteo' :
            inventory.status === 'COMPLETED' ? 'Completado' : 'Cancelado'
          }</div>
        </div>
      </div>

      {/* Instructions */}
      <div className="border rounded p-3 bg-gray-50 text-xs space-y-1">
        <div className="font-semibold mb-2">INSTRUCCIONES:</div>
        <div>1. Cuente físicamente cada producto en el almacén</div>
        <div>2. Anote la cantidad contada en la columna "Cantidad Contada"</div>
        <div>3. Si encuentra diferencias, anótelas en "Observaciones"</div>
        <div>4. Al finalizar, ingrese los datos en el sistema</div>
      </div>

      {/* Products Table */}
      <div className="border rounded">
        <table className="w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2 border-b">#</th>
              <th className="text-left p-2 border-b">Producto / SKU</th>
              <th className="text-right p-2 border-b">Cantidad Contada</th>
              <th className="text-left p-2 border-b">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {inventory.items?.map((item: any, index: number) => {
              return (
                <tr key={item.id} className="border-b">
                  <td className="p-2">{index + 1}</td>
                  <td className="p-2">
                    <div className="font-medium">{item.product?.name || '-'}</div>
                    <div className="text-xs text-gray-600">SKU: {item.product?.sku || '-'}</div>
                    {item.variant && (
                      <div className="text-xs text-gray-600">Var: {item.variant.name}</div>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <div className="border-b border-dashed border-gray-400 min-h-[20px]">
                      {item.countedQuantity !== null ? item.countedQuantity.toFixed(2) : ''}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {item.product?.unitOfMeasure || ''}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="border-b border-dashed border-gray-400 min-h-[20px]">
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
      <div className="border rounded p-3 space-y-2 text-xs">
        <div className="font-semibold mb-2">RESUMEN:</div>
        <div className="flex justify-between">
          <span>Total Productos:</span>
          <span className="font-semibold">{inventory.items?.length || 0}</span>
        </div>
        <div className="flex justify-between">
          <span>Contados:</span>
          <span className="font-semibold">
            {inventory.items?.filter((item: any) => item.countedQuantity !== null).length || 0}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Con Diferencias:</span>
          <span className="font-semibold text-orange-600">
            {inventory.items?.filter((item: any) => 
              item.countedQuantity !== null && item.difference !== null && item.difference !== 0
            ).length || 0}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 border-t pt-3">
        <div>Conteo realizado por: _________________________</div>
        <div className="mt-2">Firma: _________________________</div>
        <div className="mt-2">Fecha: _________________________</div>
      </div>
    </div>
  )
}

