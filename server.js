require('dotenv').config();
const express = require('express');
const { syncProductsOptimized } = require('./sync');

const app = express();
const port = process.env.PORT || 3000;

app.get('/sync', async (req, res) => {
  await syncProductsOptimized();
  res.send('Sincronização completa.');
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
