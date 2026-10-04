const https = require('https');
const URL = 'https://mehra-share-file.onrender.com';
setInterval(() => {
  https.get(URL, () => {}).on('error', () => {});
}, 4 * 60 * 1000);
