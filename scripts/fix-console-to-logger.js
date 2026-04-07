const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..', 'app', 'api');
const LOGGER_IMPORT = "import { logger } from '@/lib/logger'";

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (entry.name === 'route.ts') files.push(fullPath);
  }
  return files;
}

let totalFixed = 0;
let filesFixed = 0;

for (const file of walk(apiDir)) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Count replacements
  let count = 0;

  // Replace console.log(` with logger.info(
  content = content.replace(/console\.log\(/g, () => { count++; return 'logger.info('; });
  // Replace console.error( with logger.error(
  content = content.replace(/console\.error\(/g, () => { count++; return 'logger.error('; });
  // Replace console.warn( with logger.warn(
  content = content.replace(/console\.warn\(/g, () => { count++; return 'logger.warn('; });

  if (count === 0) continue;

  // Add logger import if not already present
  if (!content.includes("from '@/lib/logger'") && !content.includes('from "@/lib/logger"')) {
    // Insert after the first import line
    const firstImportEnd = content.indexOf('\n');
    if (firstImportEnd !== -1) {
      content = content.slice(0, firstImportEnd + 1) + LOGGER_IMPORT + '\n' + content.slice(firstImportEnd + 1);
    }
  }

  fs.writeFileSync(file, content, 'utf8');
  const rel = path.relative(apiDir, file);
  console.log(`✅ ${rel}: ${count} replacements`);
  totalFixed += count;
  filesFixed++;
}

console.log(`\nDone! ${totalFixed} console calls replaced across ${filesFixed} files.`);
