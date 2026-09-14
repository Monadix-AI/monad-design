const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = __dirname;
const W = 2064,
  H = 2752;
const names = ['01-workspace', '02-select', '03-annotate'];
const titles = [
  ['Your app.', 'Your canvas.'],
  ['Select the', 'exact detail.'],
  ['Show what', 'you mean.']
];
const descriptions = [
  ['Bring your running iOS app', 'into a touch workspace.'],
  ['Point to interface elements', 'with the full screen in context.'],
  ['Use shapes, arrows and notes', 'to make visual feedback precise.']
];
const labels = ['WORKSPACE', 'ELEMENT SELECTION', 'VISUAL FEEDBACK'];
const uri = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
(async () => {
  const background = await sharp(path.join(root, 'background-original.png'))
    .resize(W * 3, H, { fit: 'fill' })
    .png()
    .toBuffer();
  await sharp(background).toFile(path.join(root, 'background-panorama.png'));
  const panels = [];
  for (let i = 0; i < 3; i++) {
    const screenshot = uri(path.join(root, '../screenshots', `${names[i]}.png`));
    const icon = `data:image/png;base64,${(await sharp(path.join(root, '../app-icon-1024.png')).resize(76, 76).png().toBuffer()).toString('base64')}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <title>Monad Design ${labels[i]} App Store screenshot</title>
  <defs>
   <clipPath id="icon"><rect x="136" y="140" width="76" height="76" rx="18"/></clipPath>
   <clipPath id="screen"><rect x="104" y="1000" width="1856" height="1392" rx="28"/></clipPath>
   <filter id="shadow" x="-25%" y="-25%" width="150%" height="165%"><feDropShadow dx="0" dy="42" stdDeviation="32" flood-color="#27392b" flood-opacity="0.25"/></filter>
  </defs>
  <image href="${icon}" x="136" y="140" width="76" height="76" clip-path="url(#icon)"/>
  <g font-family="Avenir Next, Helvetica Neue, sans-serif" fill="#26392f">
   <text x="242" y="191" font-size="36" font-weight="600" letter-spacing="4">MONAD DESIGN</text>
   <text x="1928" y="191" text-anchor="end" font-size="32" letter-spacing="3" fill="#65765d">0${i + 1} / 03</text>
   <text x="132" y="432" font-size="174" font-weight="600" letter-spacing="-8">${titles[i][0]}</text>
   <text x="132" y="617" font-size="174" font-weight="600" letter-spacing="-8">${titles[i][1]}</text>
   <text x="139" y="756" font-size="49" fill="#536454">${descriptions[i][0]}</text>
   <text x="139" y="823" font-size="49" fill="#536454">${descriptions[i][1]}</text>
  </g>
  <rect x="79" y="975" width="1906" height="1442" rx="59" fill="#282c28" filter="url(#shadow)"/>
  <rect x="83" y="979" width="1898" height="1434" rx="56" fill="#161b18" stroke="#73796d" stroke-width="2"/>
  <image href="${screenshot}" x="104" y="1000" width="1856" height="1392" clip-path="url(#screen)"/>
  <circle cx="93" cy="1696" r="4" fill="#48524a"/>
  <g font-family="Avenir Next, Helvetica Neue, sans-serif" fill="#324536">
   <text x="139" y="2586" font-size="30" font-weight="600" letter-spacing="4">${labels[i]}</text>
   <text x="139" y="2645" font-size="30" fill="#596853">iPad + Monad Design Core on Mac</text>
  </g>
  </svg>`;
    fs.writeFileSync(path.join(root, `${names[i]}.svg`), svg);
    const bg = await sharp(background)
      .extract({ left: i * W, top: 0, width: W, height: H })
      .toBuffer();
    const png = await sharp(bg)
      .composite([{ input: Buffer.from(svg) }])
      .flatten({ background: '#f1f0e8' })
      .png()
      .toBuffer();
    await sharp(png).toFile(path.join(root, `${names[i]}.png`));
    await sharp(png)
      .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
      .toFile(path.join(root, `${names[i]}.jpg`));
    panels.push({ input: png, left: i * W, top: 0 });
  }
  await sharp({ create: { width: W * 3, height: H, channels: 3, background: '#f1f0e8' } })
    .composite(panels)
    .png()
    .toFile(path.join(root, 'triptych-full.png'));
  await sharp(path.join(root, 'triptych-full.png'))
    .resize(1858)
    .jpeg({ quality: 93 })
    .toFile(path.join(root, 'triptych-preview.jpg'));
})();
