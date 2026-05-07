require('dotenv').config();
const app = require('./src/daApp');
const PORT = process.env.DA_PORT || 4000;
app.listen(PORT, () => console.log('DA Layer listening on port ' + PORT));
