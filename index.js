require('dotenv').config()

const cors = require('cors')

const express = require("express");
const routes = require("./routes");
const db = require("./models")

const app = express();
const PORT = 3000;

app.use(cors()) 
let corsOptions = { origin: '*', optionSuccessStatus: 200, 
    methods: ['GET', 'PUT', 'POST', 'DELETE']}
    
app.use(cors(corsOptions))

app.use(express.json())

app.use(routes);

db.sequelize.sync().then(() => {
    console.log('✅ Datenbank synchronisiert');
    app.listen(PORT, () => {
      console.log(`🚀 Server läuft auf Port ${PORT}`);
    });
  }).catch((err) => {
    console.error('❌ Fehler bei DB-Sync:', err);
  });