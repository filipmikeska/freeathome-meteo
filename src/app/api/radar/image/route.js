import { NextResponse } from 'next/server';
import sharp from 'sharp';

const CHMI_BASE = 'https://opendata.chmi.cz/meteorology/weather/radar/composite/pseudocappi2km/png/';

// Crop: remove ČHMÚ header (legend bars + text) and right-side legend columns
// Original: 680×460
const CROP = { left: 0, top: 52, width: 622, height: 408 };

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('f');

  if (!filename || !filename.startsWith('pacz2gmaps3')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  try {
    const res = await fetch(`${CHMI_BASE}${filename}`, { next: { revalidate: 300 } });
    if (!res.ok) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    // Step 1: Convert palette PNG to truecolor RGBA by re-encoding as PNG first
    const truecolor = await sharp(buffer)
      .png() // force truecolor
      .toBuffer();

    // Step 2: Crop and get raw pixels
    const { data, info } = await sharp(truecolor)
      .extract(CROP)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data);

    // Step 3: Make background, grid lines, and text transparent
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];

      // Already transparent
      if (a === 0) continue;

      // White / near-white background (the light gray radar background)
      if (r > 190 && g > 190 && b > 190) {
        pixels[i + 3] = 0;
        continue;
      }

      // Dark gray/black lines and text (borders, grid, CZRAD text)
      if (r < 80 && g < 80 && b < 80) {
        pixels[i + 3] = 0;
        continue;
      }

      // Medium gray (grid lines, frame borders)
      if (r > 140 && r < 200 && Math.abs(r - g) < 15 && Math.abs(g - b) < 15) {
        pixels[i + 3] = 0;
        continue;
      }
    }

    // Step 4: Encode back to PNG
    const png = await sharp(Buffer.from(pixels), {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png({ compressionLevel: 6 })
      .toBuffer();

    return new NextResponse(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
