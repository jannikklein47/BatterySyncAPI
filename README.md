# BatterySyncAPI
This is the API / Backend for the BatterySyncApp.

To install:
```
npm install
```

It utilizes expressJS for the server, Sequelize for a postgres database connection and bcrypt for tokenization.
You will have to setup a postgres database "BatterySync" to enable the API to function.
```
npx sequelize-cli db:create
```

To run:
```
npm run dev
```