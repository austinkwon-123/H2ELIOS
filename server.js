require('dotenv').config();
const express = require('express');
const path = require('path');
const apiRouter = require('./api');

const PORT = 8000;

const app = express();

app.use('/api', apiRouter);
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`H2Grid Server running at http://localhost:${PORT}/`);
});
