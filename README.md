# BatterySyncAPI

The backend engine for the BatterySync project, designed for battery data synchronization, evaluation, prediction and notification across multiple devices. Built with Node.js, Express, and Sequelize, it leverages a containerized PostgreSQL architecture for reliability and scalability.

## Features

- Battery prediction algorithm
- Battery log history with lttb downsampling
- Custom notification system with single and permanent charge reminders and content messages
- Traffic Analysis: Built-in system for monitoring API usage and performance.
- Security First: Integrated Helmet for header security and IP Rate Limiting to prevent abuse.
- Device Authentication: A unique, hardware-linked and certificate-based system for secure inter-device communication.
- Robust Testing: Comprehensive Unit and Integration coverage using Jest and Supertest.
- Containerized: One-command deployment using Docker Compose.

## For basic usage:

### Prerequisites

- Docker an Docker Compose
- Node.js v22+
- PostgreSQL

### Production setup on Linux:

```
git clone https://github.com/jannikklein47/BatterySyncAPI.git
cd BatterySyncAPI
sudo apt install Docker postgresql
docker compose --build
```

### Production setup on MacOS:

Either download Docker Desktop or use a NodeJS runtime.
`git clone https://github.com/jannikklein47/BatterySyncAPI.git
cd BatterySyncAPI
brew install Docker postgresql
docker compose --build`

### To run (production):

```
docker compose up
```

## For development usage:

To install:

```
git clone https://github.com/jannikklein47/BatterySyncAPI.git
cd BatterySyncAPI
npm install
```

You will have to setup a postgres database "BatterySync" to enable the API to function.

```
npx sequelize-cli db:create
```

To run:

```
npm start
```

## Running tests

BatterySync API features both unit and integration tests with Jest and Supertest. To run tests, simply run
´´
npm test
´´
For a preconfigured testing environment. If you wish, you can modifiy the testing configuration in the package.json file.

## Architecture

This API is based on a modular SoC routes / service / utils structure.
Every route (separated by topic) gets their own folder. Every HTTP method gets their own file.
Router and routes are not to do any database operations or calculations on their own, they handle incoming http requests and validate input. All other fucntions are supposed to be called from either a service (database operations) or from a utility (helper functions and reusable logic)

## Security and Authentication

Devices authenticate themselves via a Certificate-based system. Only valid devices can sync data, the certificate is only accessible at the point of registration and are hardware-linked. Users authenticate themselves with a token that is grabbed on login.
