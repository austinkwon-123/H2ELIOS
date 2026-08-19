require('dotenv').config();
const express = require('express');
const path = require('path');
const apiRouter = require('./api');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT === undefined ? 8000 : Number(process.env.PORT);

const app = express();

app.use('/api', apiRouter);
app.use(express.static(__dirname));

if (require.main === module) {
  const server = app.listen(PORT, HOST, () => {
    const address = server.address();
    console.log(`H2ELIOS Server running at http://${HOST}:${address.port}/`);
  });
}

module.exports = app;
