const express = require('express');
const path = require('path');
const txRoutes = require('./routes/txRoutes');
const errorHandler = require('./middlewares/errorHandler');
const { register, apiDuration } = require("@rollup/shared").metrics;

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Middleware to track API latency
app.use((req, res, next) => {
  const end = apiDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, status_code: res.statusCode });
  });
  next();
});

// Prometheus Metrics Endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

app.use('/', txRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

app.use(errorHandler);

module.exports = app;
