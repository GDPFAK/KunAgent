const { app } = require('electron');

console.log('app type:', typeof app);
console.log('app.setName type:', typeof app?.setName);
console.log('process.type:', process.type);
console.log('process._linkedBinding type:', typeof process._linkedBinding);

// Try getting app via _linkedBinding
try {
  const app2 = process._linkedBinding('electron_browser_app');
  console.log('_linkedBinding app type:', typeof app2);
  console.log('app2.setName type:', typeof app2?.setName);
} catch(e) {
  console.log('_linkedBinding error:', e.message);
}

process.exit(0);
