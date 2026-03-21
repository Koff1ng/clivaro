import * as XLSX from 'xlsx'

export interface ExcelColumn {
    header: string
    key: string
    width: number // Width in pixels
}

/**
 * Generates and downloads a cleanly formatted Excel file with dimensioned columns
 * @param data Array of objects containing the row data
 * @param columns Array of column configurations (header, key, width)
 * @param filename Name of the file (without .xlsx extension)
 */
export function exportToExcel(data: any[], columns: ExcelColumn[], filename: string) {
    // 1. Transform data according to column definitions to maintain order and structure
    const worksheetData = data.map(item => {
        const row: any = {}
        columns.forEach(col => {
            // Retrieve the value using the key. Provide fallback for edge cases.
            let value = item[col.key]

            // Format numbers slightly if needed, but XLSX handles native numbers well
            if (value === null || value === undefined) {
                value = ''
            }

            row[col.header] = value
        })
        return row
    })

    // 2. Create standard worksheet
    const worksheet = XLSX.utils.json_to_sheet(worksheetData)

    // 3. Set column widths (wpx = width in pixels)
    worksheet['!cols'] = columns.map(col => ({ wpx: col.width }))

    // 4. Create workbook and append sheet
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte')

    // 5. Trigger download
    XLSX.writeFile(workbook, `${filename}.xlsx`)
}
