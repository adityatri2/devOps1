require('dotenv').config();
const app = require('./src/app');
const { db, redis } = require('@rollup/shared');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('API Server running on port ' + PORT);
});
