require('dotenv').config()

const cors = require('cors')

const express = require("express");
const routes = require("./routes");
const db = require("./models")
const fs = require('fs')

const https = require('https')

const app = express();
const PORT = 3000;

app.use(cors()) 
let corsOptions = { origin: '*', optionSuccessStatus: 200, 
    methods: ['GET', 'PUT', 'POST', 'DELETE']}
    
app.use(cors(corsOptions))

app.use(express.json())

app.use(routes);

const options = {
  key: fs.readFileSync(path.join(__dirname, "localhost-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "localhost.pem")),
};

const server = https.createServer(options, app);


db.sequelize.sync().then(() => {
    console.log('✅ Datenbank synchronisiert');
    server.listen(PORT, () => {
      console.log(`🚀 Server läuft auf Port ${PORT}`);
    });
  }).catch((err) => {
    console.error('❌ Fehler bei DB-Sync:', err);
  });