require('express-async-errors');
const express = require('express');
const projectsRouter = require('./routes/projects');
const analyticsRouter = require('./routes/analytics');

const router = express.Router();

router.use('/projects', projectsRouter);
router.use('/analytics', analyticsRouter);

// Error-handling middleware: catches thrown/rejected errors from the routes above
// (express-async-errors forwards async rejections here automatically) so a bad bbox
// or a query failure returns clean JSON instead of crashing the process or leaking
// a stack trace to the client.
router.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = router;
