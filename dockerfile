# Wähle eine Node-Version
FROM node:latest

RUN apk add --no-cache postgresql-client

# Arbeitsverzeichnis im Container
WORKDIR /app

# Nur die package.json zuerst kopieren (für schnelleres Caching)
COPY package*.json ./

# Abhängigkeiten installieren
RUN npm install

# bcrypt fix?
RUN npm rebuild bcrypt

# Den Rest des Anwendungs-Codes kopieren
COPY . .

# Exponieren des Ports (falls Ihr Backend einen bestimmten Port nutzt)
EXPOSE 3000

# Skript zum Anwenden von Migrationen und Starten des Servers
# Dieses Skript wird im nächsten Schritt erstellt
COPY ./docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]

# Standardbefehl zum Starten des Servers (wird nach dem Entrypoint ausgeführt)
CMD ["npm", "start"]