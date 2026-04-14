import { NextResponse } from 'next/server';
import sharp from 'sharp';

const CHMI_BASE = 'https://opendata.chmi.cz/meteorology/weather/radar/composite/pseudocappi2km/png/';

// Colors to make transparent (borders, text, grid, radar shadow)
// The ČHMÚ palette PNG already has transparent background — only need to
// remove black frame/text pixels and gray radar-shadow pixels
const REMOVE_COLORS = new Set([
  '0,0,0',       // black — frame borders, grid lines, CZRAD text
  '196,196,196', // light gray — radar shadow/range limit areas
]);

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

    // Sharp decodes palette PNG to RGBA correctly
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data);

    // Remove unwanted opaque pixels (borders, text, shadow)
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] === 0) continue; // already transparent
      const key = pixels[i] + ',' + pixels[i + 1] + ',' + pixels[i + 2];
      if (REMOVE_COLORS.has(key)) {
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
