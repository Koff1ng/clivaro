const fs = require('fs');
const path = require('path');

const libDir = path.join(__dirname, '..', 'lib');
let fixed = 0;

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (entry.name.endsWith('.ts')) files.push(fullPath);
  }
  return files;
}

for (const f of walk(libDir)) {
  const dir = path.dirname(f);
  const relToLib = path.relative(libDir, dir);
  
  // Skip files directly in lib/ — they correctly use './logger'
  if (!relToLib || relToLib === '.') continue;
  
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes("from './logger'")) {
    // Calculate correct relative path
    const depth = relToLib.split(path.sep).length;
    const prefix = '../'.repeat(depth);
    const newImport = `from '${prefix}logger'`;
    const newContent = content.replace("from './logger'", newImport);
    fs.writeFileSync(f, newContent, 'utf8');
    console.log(`Fixed: ${path.relative(process.cwd(), f)} → ${newImport}`);
    fixed++;
  }
}

console.log(`\nTotal fixed: ${fixed}`);
