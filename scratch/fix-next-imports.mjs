import fs from 'fs';
import path from 'path';

const dir = path.resolve('apps/frontend/src');

function walk(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      // Replace import from './foo.js' with import from './foo'
      const updated = content.replace(/from\s+(['"])(\.\.?\/[^'"]+?)\.js\1/g, "from $1$2$1");
      if (updated !== content) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        console.log(`Updated imports in: ${path.relative(dir, fullPath)}`);
      }
    }
  }
}

walk(dir);
console.log('All frontend imports cleaned of .js extension for Next.js');
