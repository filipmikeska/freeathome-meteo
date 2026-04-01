/**
 * Generate PWA icons from SVG template.
 * Usage: node scripts/generate-icons.mjs
 * Requires: no external dependencies (uses built-in canvas-like SVG approach)
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');

// Cloud rain icon as filled SVG for app icon
function createIconSVG(size, maskable = false) {
  const padding = maskable ? size * 0.2 : size * 0.1;
  const inner = size - padding * 2;
  const bg = maskable ? '#2563eb' : '#2563eb';
  const radius = maskable ? 0 : size * 0.18;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>
  <g transform="translate(${padding}, ${padding}) scale(${inner / 24})" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
    <path d="M16 14v6"/>
    <path d="M8 14v6"/>
    <path d="M12 16v6"/>
  </g>
</svg>`;
}

// Write SVG icons (browsers and PWA support SVG icons well)
const sizes = [192, 512];

for (const size of sizes) {
  writeFileSync(join(outDir, `icon-${size}.svg`), createIconSVG(size, false));
  writeFileSync(join(outDir, `icon-maskable-${size}.svg`), createIconSVG(size, true));
  console.log(`Generated icon-${size}.svg and icon-maskable-${size}.svg`);
}

// Also create a simple HTML that can be opened in browser to save as PNG
writeFileSync(join(outDir, 'generate-png.html'), `<!DOCTYPE html>
<html><head><title>Generate PNG Icons</title></head>
<body>
<h2>Right-click each image → Save as PNG</h2>
${sizes.map(s => `
<div style="margin:20px">
  <h3>${s}x${s}</h3>
  <canvas id="c${s}" width="${s}" height="${s}"></canvas>
  <canvas id="cm${s}" width="${s}" height="${s}"></canvas>
</div>
<script>
(function(){
  var s=${s}, c=document.getElementById('c${s}'), ctx=c.getContext('2d');
  var img=new Image(); img.onload=function(){ctx.drawImage(img,0,0)};
  img.src='icon-${s}.svg';
  var cm=document.getElementById('cm${s}'), ctxm=cm.getContext('2d');
  var imgm=new Image(); imgm.onload=function(){ctxm.drawImage(imgm,0,0)};
  imgm.src='icon-maskable-${s}.svg';
})();
</script>
`).join('')}
</body></html>`);

console.log('Done! Open public/icons/generate-png.html to export PNGs if needed.');
