try {
  const e = require('electron');
  console.log('SUCCESS! type:', typeof e, 'app:', typeof e.app);
} catch(err) {
  console.log('Error:', err.message);
}
