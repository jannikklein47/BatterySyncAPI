# BatterySyncAPI
This is the API / Backend for the BatterySyncApp. It runs in Docker.
It utilizes expressJS for the server, Sequelize for a postgres database connection and bcrypt for tokenization.

# For basic usage:

To install:
```
git clone 
cd BatterySyncAPI
sudo apt install Docker
docker compose --build
```

To run:
```
docker compose up
```

# For development usage:

To install:
```
npm install
```

You will have to setup a postgres database "BatterySync" to enable the API to function.
```
npx sequelize-cli db:create
```

To run:
```
npm run dev
```