const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.otf': 'font/otf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
    catch { res.writeHead(400).end(); return; }
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (file === root) file = path.join(root, 'index.html');
    fs.stat(file, (error, stat) => {
        if (error || !stat.isFile()) { res.writeHead(404).end(); return; }
        const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' };
        const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
        if (range) {
            const start = Number(range[1]);
            const end = Math.min(range[2] ? Number(range[2]) : stat.size - 1, stat.size - 1);
            if (start > end) { res.writeHead(416).end(); return; }
            res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' });
            fs.createReadStream(file, { start, end }).pipe(res);
        } else {
            res.writeHead(200, { ...headers, 'Content-Length': stat.size });
            fs.createReadStream(file).pipe(res);
        }
    });
});
if (require.main === module) server.listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173'));
module.exports = server;
