const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'logo icon web.svg');
let svg = fs.readFileSync(srcPath, 'utf8');

// remove clipPath
svg = svg.replace(/<clipPath id="_clip1">[\s\S]*?<\/clipPath>/, '');
// replace green background group with black rounded rect path
const blackBg = '<path d="M874.8,0C988.053,0 1080,91.947 1080,205.2L1080,874.8C1080,988.053 988.053,1080 874.8,1080L205.2,1080C91.947,1080 0,988.053 0,874.8L0,205.2C0,91.947 91.947,0 205.2,0L874.8,0Z" fill="#000000"/>';
svg = svg.replace(/<g clip-path="url\(#_clip1\)">[\s\S]*?<\/g>/, blackBg);
// remove _Image2
svg = svg.replace(/<image id="_Image2"[\s\S]*?\/>/, '');

// Save to src/app/icon.svg
fs.writeFileSync(path.join(__dirname, '..', 'src', 'app', 'icon.svg'), svg);
console.log('Saved src/app/icon.svg');

// Save to public/icon.svg
fs.writeFileSync(path.join(__dirname, '..', 'public', 'icon.svg'), svg);
console.log('Saved public/icon.svg');

// Save to public/favicon.svg
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), svg);
console.log('Saved public/favicon.svg');
