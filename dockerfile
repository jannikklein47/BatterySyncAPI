# Wähle eine Node-Version
FROM node:20.6.0

# Arbeitsverzeichnis im Container
WORKDIR /app

# Nur die package.json zuerst kopieren (für schnelleres Caching)
COPY package*.json ./

# Abhängigkeiten installieren
RUN npm install

# Restlichen Code kopieren
COPY . .

# Port freigeben (falls du z. B. 3000 nutzt)
EXPOSE 3000

# Startbefehl
CMD ["npm", "run dev"]
