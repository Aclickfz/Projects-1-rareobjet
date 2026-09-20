// Keep the complete responsive header consistent without a runtime fetch.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const header = fs.readFileSync(path.join(root, 'partials/header.html'), 'utf8').trim();
for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
    const target = path.join(root, file);
    const html = fs.readFileSync(target, 'utf8');
    if (!/<header class="myNav">[\s\S]*?<\/header>/.test(html)) throw new Error(`Missing header: ${file}`);
    fs.writeFileSync(target, html.replace(/<header class="myNav">[\s\S]*?<\/header>/, header));
}
console.log('Updated headers on all pages.');
