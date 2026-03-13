const Jimp = require('jimp');
const path = require('path');

async function generateIcons() {
  const sizes = [192, 512];
  const bgColor = 0x6366F1FF; // indigo

  for (const size of sizes) {
    const image = new Jimp(size, size, bgColor);

    // Load a built-in font for the "T" letter
    const fontKey = size >= 512 ? Jimp.FONT_SANS_128_WHITE : Jimp.FONT_SANS_64_WHITE;
    const font = await Jimp.loadFont(fontKey);

    // Print "T" centered
    image.print(
      font,
      0,
      0,
      {
        text: 'T',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
      },
      size,
      size
    );

    const outPath = path.join(__dirname, 'public', 'icons', `icon-${size}.png`);
    await image.writeAsync(outPath);
    console.log(`Created ${outPath}`);
  }
}

generateIcons().catch(console.error);
