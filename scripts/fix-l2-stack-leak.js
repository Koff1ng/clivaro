// Fix L2: Remove stack trace leak from suppliers/[id]/route.ts
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'api', 'suppliers', '[id]', 'route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the error response that leaks error.message and error.stack
const oldPattern = /error: error\.message \|\| 'Failed to fetch supplier',[\s\S]*?details: process\.env\.NODE_ENV === 'development' \? error\.stack : undefined,/;
const newText = "error: 'Failed to fetch supplier',";

if (oldPattern.test(content)) {
    content = content.replace(oldPattern, newText);
    fs.writeFileSync(filePath, content);
    console.log('✅ Fixed L2: Removed stack trace leak from suppliers/[id]/route.ts');
} else {
    console.log('⚠️ Pattern not found - may have already been fixed');
}
