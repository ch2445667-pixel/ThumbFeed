const fs = require('fs');
const path = require('path');

process.env.HOSTNAME = '0.0.0.0';
process.env.PORT = process.env.PORT || '3000';

const standaloneServer = path.join(__dirname, '.next', 'standalone', 'server.js');

if (fs.existsSync(standaloneServer)) {
  require(standaloneServer);
} else {
  const { spawn } = require('child_process');
  const child = spawn('npx', ['next', 'start', '-H', '0.0.0.0', '-p', process.env.PORT], {
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}
