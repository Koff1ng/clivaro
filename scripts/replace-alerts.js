/**
 * Script to replace all alert() calls with toast notifications
 * Run with: node scripts/replace-alerts.js
 */

const fs = require('fs')
const path = require('path')
const glob = require('glob')

const files = glob.sync('components/**/*.{tsx,ts}', {
  ignore: ['**/node_modules/**', '**/.next/**']
})

const filesWithAlerts = files.filter(file => {
  const content = fs.readFileSync(file, 'utf8')
  return content.includes('alert(')
})

console.log(`Found ${filesWithAlerts.length} files with alert()`)

filesWithAlerts.forEach(file => {
  let content = fs.readFileSync(file, 'utf8')
  let modified = false

  // Check if useToast is already imported
  const hasUseToast = content.includes("useToast") || content.includes("from '@/components/ui/toast'")
  
  // Add import if not present
  if (!hasUseToast && content.includes("'use client'")) {
    const importMatch = content.match(/(import.*from.*['"]@\/components\/ui\/[^'"]+['"];?\n)/)
    if (importMatch) {
      const lastImportIndex = content.lastIndexOf(importMatch[0]) + importMatch[0].length
      content = content.slice(0, lastImportIndex) + 
        "import { useToast } from '@/components/ui/toast'\n" + 
        content.slice(lastImportIndex)
      modified = true
    }
  }

  // Add const { toast } = useToast() in component
  if (!content.includes('const { toast } = useToast()')) {
    const componentMatch = content.match(/(export\s+(?:default\s+)?function\s+\w+\s*\([^)]*\)\s*\{)/)
    if (componentMatch) {
      const insertIndex = componentMatch.index + componentMatch[0].length
      const nextLine = content.indexOf('\n', insertIndex)
      content = content.slice(0, nextLine + 1) + 
        "  const { toast } = useToast()\n" + 
        content.slice(nextLine + 1)
      modified = true
    }
  }

  // Replace alert() calls
  const alertRegex = /alert\(([^)]+)\)/g
  const matches = [...content.matchAll(alertRegex)]
  
  matches.forEach(match => {
    const alertContent = match[1]
    let toastType = 'error'
    
    // Determine toast type based on content
    if (alertContent.includes('exitosamente') || alertContent.includes('exitoso') || alertContent.includes('completado')) {
      toastType = 'success'
    } else if (alertContent.includes('Error') || alertContent.includes('error') || alertContent.includes('fallido')) {
      toastType = 'error'
    } else if (alertContent.includes('advertencia') || alertContent.includes('debe') || alertContent.includes('selecciona')) {
      toastType = 'warning'
    } else {
      toastType = 'info'
    }
    
    content = content.replace(match[0], `toast(${alertContent}, '${toastType}')`)
    modified = true
  })

  if (modified) {
    fs.writeFileSync(file, content, 'utf8')
    console.log(`✓ Updated: ${file}`)
  }
})

console.log('\nDone! Review the changes before committing.')

