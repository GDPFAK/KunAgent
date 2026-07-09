const en = require('./src/renderer/src/locales/en/common.json');
const zh = require('./src/renderer/src/locales/zh/common.json');

const keys = Object.keys(en);
const missing = keys.filter(k => zh[k] === undefined);
console.log('Missing Chinese translations (' + missing.length + '):');
missing.forEach(k => {
  console.log('  "' + k + '": "' + en[k] + '",');
});
