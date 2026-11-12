const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'logo icon web.svg');
let svg = fs.readFileSync(srcPath, 'utf8');

// remove clipPath
svg = svg.replace(/<clipPath id="_clip1">[\s\S]*?<\/clipPath>/, '');
// remove green background group
svg = svg.replace(/<g clip-path="url\(#_clip1\)">[\s\S]*?<\/g>/, '');
// remove _Image2
svg = svg.replace(/<image id="_Image2"[\s\S]*?\/>/, '');

const outDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, 'logo-transparent.svg');
fs.writeFileSync(outPath, svg);
console.log('Saved transparent logo:', outPath);
