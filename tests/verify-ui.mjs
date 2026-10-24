import http from 'node:http';

// Quick check if preview server is responding
http.get('http://localhost:4173/', (res) => {
  console.log('HTTP Status:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Body length:', data.length);
    console.log('Includes NetX:', data.includes('NetX'));
  });
}).on('error', (err) => {
  console.error('Error connecting to preview server:', err.message);
});
