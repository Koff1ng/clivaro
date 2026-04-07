const fs = require('fs');
const path = require('path');

const LOGGER_IMPORT = "import { logger } from '@/lib/logger'";
const LOGGER_IMPORT_RELATIVE = "import { logger } from './logger'";

// Files to fix (server-side only, skip client hooks and logger itself)
const SKIP = [
  'logger.ts',           // logger uses console internally
  'use-thermal-print.ts', // client-side hook
  'use-escpos-print.ts',  // client-side hook  
  'printer.ts',           // client-side WebSerial
];

function processFile(filePath) {
  const basename = path.basename(filePath);
  if (SKIP.includes(basename)) return 0;
  
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let count = 0;

  content = content.replace(/console\.log\(/g, () => { count++; return 'logger.info('; });
  content = content.replace(/console\.error\(/g, () => { count++; return 'logger.error('; });
  content = content.replace(/console\.warn\(/g, () => { count++; return 'logger.warn('; });

  if (count === 0) return 0;

  // Add logger import if missing
  if (!content.includes("from '@/lib/logger'") && !content.includes("from './logger'") && !content.includes('from "../logger"')) {
    // Determine import path
    const rel = path.relative(path.dirname(filePath), path.join(__dirname, '..', 'lib'));
    const isInLib = filePath.includes(path.join('lib', path.sep)) || filePath.includes('/lib/');
    const importLine = isInLib ? LOGGER_IMPORT_RELATIVE : LOGGER_IMPORT;
    
    const firstImportEnd = content.indexOf('\n');
    if (firstImportEnd !== -1) {
      content = content.slice(0, firstImportEnd + 1) + importLine + '\n' + content.slice(firstImportEnd + 1);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ ${path.relative(process.cwd(), filePath)}: ${count} replacements`);
  return count;
}

// Process lib/ files
const libDir = path.join(__dirname, '..', 'lib');

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) files.push(fullPath);
  }
  return files;
}

let total = 0;
for (const f of walk(libDir)) {
  total += processFile(f);
}

console.log(`\nDone! ${total} replacements in lib/ files.`);
