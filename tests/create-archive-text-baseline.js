const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const outputPath = path.join(__dirname, 'fixtures', 'archive-page-text-hashes.json');

function extractVisibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const result = {};
for (const filename of fs.readdirSync(pagesDir).filter((name) => name.endsWith('.html')).sort()) {
  const html = fs.readFileSync(path.join(pagesDir, filename), 'utf8');
  const text = extractVisibleText(html);
  result[filename] = crypto.createHash('sha256').update(text).digest('hex');
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`Wrote ${path.relative(root, outputPath)}`);
