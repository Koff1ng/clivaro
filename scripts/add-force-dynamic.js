const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..', 'app', 'api');

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.name === 'route.ts') {
      files.push(fullPath);
    }
  }
  return files;
}

const routeFiles = walk(apiDir);
let fixed = 0;
let skipped = 0;

for (const file of routeFiles) {
  const content = fs.readFileSync(file, 'utf8');
  
  if (content.includes("export const dynamic")) {
    skipped++;
    continue;
  }
  
  // Find the last import line
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') || (line.startsWith("import(") === false && line.startsWith("from "))) {
      lastImportIdx = i;
    }
    // Stop at first non-import, non-empty, non-comment line after we found imports
    if (lastImportIdx >= 0 && line && !line.startsWith('import') && !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('from')) {
      break;
    }
  }
  
  if (lastImportIdx === -1) {
    // No imports found, prepend
    const newContent = "export const dynamic = 'force-dynamic'\n\n" + content;
    fs.writeFileSync(file, newContent, 'utf8');
  } else {
    // Insert after last import
    lines.splice(lastImportIdx + 1, 0, '', "export const dynamic = 'force-dynamic'");
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
  }
  
  const rel = path.relative(apiDir, file);
  console.log(`✅ Fixed: ${rel}`);
  fixed++;
}

console.log(`\nDone! Fixed: ${fixed}, Already OK: ${skipped}, Total: ${routeFiles.length}`);
