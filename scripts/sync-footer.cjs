// Run after editing partials/footer.html. Pages stay directly deployable HTML.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const footer = fs.readFileSync(path.join(root, 'partials/footer.html'), 'utf8').trim();
for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
    const target = path.join(root, file);
    const html = fs.readFileSync(target, 'utf8');
    if (!/<footer>[\s\S]*?<\/footer>/.test(html)) throw new Error(`Missing footer: ${file}`);
    fs.writeFileSync(target, html.replace(/<footer>[\s\S]*?<\/footer>/, footer));
}
console.log('Updated footers on all pages.');
