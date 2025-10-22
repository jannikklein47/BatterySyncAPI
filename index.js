require('dotenv').config()

const cors = require('cors')

const express = require("express");
const routes = require("./routes");
const db = require("./models")
const fs = require('fs')
const path = require('path')
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
  key: fs.readFileSync('/etc/letsencrypt/live/batterysync.chickenkiller.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/batterysync.chickenkiller.com/fullchain.pem'),
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