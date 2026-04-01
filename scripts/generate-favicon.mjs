import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Cloud icon SVG - filled version for better visibility at small sizes
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#2563eb"/>
  <svg x="4" y="6" width="24" height="20" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.5 16a4.5 4.5 0 0 1-.42-8.98A7 7 0 0 1 19.56 4.54 4.5 4.5 0 0 1 20.5 13.5H6.5z" fill="white" stroke="white" stroke-width="0.5"/>
  </svg>
</svg>`;

async function generateFavicons() {
  const svgBuffer = Buffer.from(faviconSvg);

  // Generate PNG favicons
  const sizes = [16, 32, 48, 64, 128, 180, 192, 512];

  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(publicDir, `favicon-${size}x${size}.png`));
    console.log(`Generated favicon-${size}x${size}.png`);
  }

  // Generate apple-touch-icon (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // Generate favicon.ico (multi-size ICO)
  // ICO format: header + entries + image data
  const icoSizes = [16, 32, 48];
  const images = [];

  for (const size of icoSizes) {
    const png = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    images.push({ size, data: png });
  }

  // Build ICO file
  const ico = buildIco(images);
  writeFileSync(join(publicDir, 'favicon.ico'), ico);
  console.log('Generated favicon.ico');
}

function buildIco(images) {
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset = headerSize + entrySize * images.length;

  // Calculate total size
  let totalDataSize = 0;
  for (const img of images) {
    totalDataSize += img.data.length;
  }

  const buffer = Buffer.alloc(dataOffset + totalDataSize);

  // ICO header
  buffer.writeUInt16LE(0, 0);      // Reserved
  buffer.writeUInt16LE(1, 2);      // Type: ICO
  buffer.writeUInt16LE(images.length, 4); // Number of images

  let currentOffset = dataOffset;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const entryOffset = headerSize + i * entrySize;

    buffer.writeUInt8(img.size === 256 ? 0 : img.size, entryOffset);     // Width
    buffer.writeUInt8(img.size === 256 ? 0 : img.size, entryOffset + 1); // Height
    buffer.writeUInt8(0, entryOffset + 2);     // Color palette
    buffer.writeUInt8(0, entryOffset + 3);     // Reserved
    buffer.writeUInt16LE(1, entryOffset + 4);  // Color planes
    buffer.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    buffer.writeUInt32LE(img.data.length, entryOffset + 8);  // Image size
    buffer.writeUInt32LE(currentOffset, entryOffset + 12);   // Image offset

    img.data.copy(buffer, currentOffset);
    currentOffset += img.data.length;
  }

  return buffer;
}

generateFavicons().then(() => console.log('Done!')).catch(console.error);
