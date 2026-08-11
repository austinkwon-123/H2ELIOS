require('dotenv').config();
const express = require('express');
const path = require('path');
const apiRouter = require('./api');

const HOST = '127.0.0.1';
const PORT = 8000;

const app = express();

app.use('/api', apiRouter);
app.use(express.static(__dirname));

app.listen(PORT, HOST, () => {
  console.log(`H2ELIOS Server running at http://${HOST}:${PORT}/`);
});
