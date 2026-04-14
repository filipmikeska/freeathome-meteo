import { NextResponse } from 'next/server';
import sharp from 'sharp';

const CHMI_BASE = 'https://opendata.chmi.cz/meteorology/weather/radar/composite/pseudocappi2km/png/';

// Crop area — remove ČHMÚ borders, legend bars and text header
// Original: 680×460, useful radar data approximately at:
const CROP = { left: 1, top: 40, width: 620, height: 418 };

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

    const processed = await sharp(buffer)
      .extract(CROP)
      // Make near-white and light gray pixels transparent (background + grid lines)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = processed;
    const pixels = new Uint8Array(data);

    // Make light pixels (background, grid, text) transparent
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      // White/near-white background and light gray grid lines
      if (r > 200 && g > 200 && b > 200) {
        pixels[i + 3] = 0; // fully transparent
      }
      // Also handle the exact gray of grid lines
      if (r > 180 && g > 180 && b > 180 && Math.abs(r - g) < 10 && Math.abs(g - b) < 10) {
        pixels[i + 3] = 0;
      }
    }

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
