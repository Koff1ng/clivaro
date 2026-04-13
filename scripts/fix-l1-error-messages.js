// Fix L1: Replace raw error.message in API catch blocks with safeErrorMessage
// This script adds the import and replaces `error.message` in error responses
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apiDir = path.join(__dirname, '..', 'app', 'api');

// Find all route.ts files that have error.message in responses
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
let skippedCount = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(path.join(__dirname, '..'), file);
    
    // Only process files that have error.message in JSON responses
    // Pattern: { error: error.message ... } in NextResponse.json or similar
    const hasErrorMsg = /\berror(?:\s*:\s*|\.message)/.test(content) && 
                        /error\.message/.test(content) &&
                        /NextResponse\.json/.test(content);
    
    if (!hasErrorMsg) {
        continue;
    }
    
    // Skip files that already import safeErrorMessage
    if (content.includes('safeErrorMessage')) {
        skippedCount++;
        continue;
    }

    let modified = false;

    // Add import for safeErrorMessage after the last import line
    if (!content.includes("from '@/lib/safe-error'")) {
        // Find last import statement
        const importMatch = content.match(/^import\s+.+$/gm);
        if (importMatch && importMatch.length > 0) {
            const lastImport = importMatch[importMatch.length - 1];
            const lastImportIdx = content.lastIndexOf(lastImport);
            const insertPos = lastImportIdx + lastImport.length;
            content = content.slice(0, insertPos) + 
                      "\nimport { safeErrorMessage } from '@/lib/safe-error'" + 
                      content.slice(insertPos);
            modified = true;
        }
    }

    // Replace patterns like:
    //   { error: error.message || 'Fallback' }  ->  { error: safeErrorMessage(error, 'Fallback') }
    //   { error: error.message }                 ->  { error: safeErrorMessage(error) }
    //   error: error.message || 'Something'      ->  error: safeErrorMessage(error, 'Something')
    
    // Pattern 1: error.message || 'fallback text'
    const pattern1 = /error\.message\s*\|\|\s*'([^']+)'/g;
    const newContent1 = content.replace(pattern1, (match, fallback) => {
        return `safeErrorMessage(error, '${fallback}')`;
    });
    if (newContent1 !== content) {
        content = newContent1;
        modified = true;
    }

    // Pattern 2: error.message || "fallback text"
    const pattern2 = /error\.message\s*\|\|\s*"([^"]+)"/g;
    const newContent2 = content.replace(pattern2, (match, fallback) => {
        return `safeErrorMessage(error, '${fallback}')`;
    });
    if (newContent2 !== content) {
        content = newContent2;
        modified = true;
    }

    // Pattern 3: standalone error.message (in JSON context like { error: error.message })
    // But NOT in conditionals like if (error.message?.includes(...))
    const pattern3 = /(?<=[:{,]\s*)error\.message(?!\s*\??\.\s*includes)(?!\s*\|\|)/g;
    const newContent3 = content.replace(pattern3, (match) => {
        return `safeErrorMessage(error)`;
    });
    if (newContent3 !== content) {
        content = newContent3;
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(file, content);
        fixedCount++;
        console.log(`  ✅ ${relPath}`);
    }
}

console.log(`\nDone: ${fixedCount} files fixed, ${skippedCount} already migrated.`);
