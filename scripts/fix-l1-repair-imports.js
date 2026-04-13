// Fix: Repair broken imports from L1 batch script
// The previous script incorrectly inserted the safeErrorMessage import 
// in the middle of multi-line import blocks
const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..', 'app', 'api');

function findRouteFiles(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findRouteFiles(fullPath));
        } else if (entry.name === 'route.ts') {
            results.push(fullPath);
        }
    }
    return results;
}

const files = findRouteFiles(apiDir);
let fixedCount = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(path.join(__dirname, '..'), file);

    if (!content.includes("safeErrorMessage")) continue;

    let modified = false;

    // Step 1: Remove ALL existing safeErrorMessage imports (could be broken or misplaced)
    // Pattern: import { safeErrorMessage } from '@/lib/safe-error' with optional \r\n
    const importPattern = /\r?\nimport \{ safeErrorMessage \} from '@\/lib\/safe-error'\r?\n?/g;
    const cleaned = content.replace(importPattern, '\n');
    if (cleaned !== content) {
        content = cleaned;
        modified = true;
    }

    // Step 2: Check if file still uses safeErrorMessage — if so, add import properly
    if (content.includes('safeErrorMessage(')) {
        // Find the position after the first complete import block
        // We look for the first line that's NOT an import, blank, or export const dynamic
        const lines = content.split(/\r?\n/);
        let insertIdx = 0;
        let inImport = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Track if we're inside a multi-line import
            if (line.startsWith('import ') && line.includes('{') && !line.includes('}')) {
                inImport = true;
                insertIdx = i;
                continue;
            }
            if (inImport) {
                if (line.includes('}')) {
                    inImport = false;
                    insertIdx = i;
                }
                continue;
            }
            
            // Single-line import or from line
            if (line.startsWith('import ') || line.startsWith('from ')) {
                insertIdx = i;
                continue;
            }
            
            // Empty lines between imports
            if (line === '' && insertIdx > 0) {
                continue;
            }
            
            // export const dynamic = 'force-dynamic' between imports 
            if (line.startsWith('export const dynamic')) {
                insertIdx = i;
                continue;
            }
            
            // If we hit a real code line, stop
            if (line !== '' && !line.startsWith('import') && !line.startsWith('//')) {
                break;
            }
        }
        
        // Insert after insertIdx
        lines.splice(insertIdx + 1, 0, "import { safeErrorMessage } from '@/lib/safe-error'");
        content = lines.join('\n');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(file, content);
        fixedCount++;
    }
}

console.log(`Repaired ${fixedCount} files.`);
