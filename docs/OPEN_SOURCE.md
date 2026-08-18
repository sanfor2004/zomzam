# Zomzam Open Source & Self-Hosting Guide

Welcome to the open-source release of Zomzam! This guide explains how you can spin up your own instance of Zomzam to achieve Technological Sovereignty over your time, money, and relationships.

## Prerequisites
To host Zomzam locally or on your own server, you only need:
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start (Docker)

We have provided a ready-to-use Docker environment that spins up the Next.js application alongside a MySQL database.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/zomzam.git
   cd zomzam
   ```

2. **Configure your environment:**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill out the `JWT_SECRET` with a secure random string (you can generate one using `openssl rand -hex 64`).

3. **Start the environment:**
   ```bash
   docker-compose up -d
   ```

   This command will:
   - Start a MySQL 8 container.
   - Start the Next.js application container.
   - Automatically run the DB sync script (`scripts/db-sync.ts`) to create the schema and seed default data.

4. **Access the application:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Managing the Database

If you need to manually re-run the database sync script inside the docker container:
```bash
docker-compose exec app npm run db:sync
```

## Developing Locally without Docker

If you prefer to run the Next.js app on your host machine while using a local MySQL instance:

1. Ensure MySQL (v8.x+) is installed and running.
2. Edit `.env` to point `DB_HOST` to `localhost` (or `127.0.0.1`).
3. Run `npm install`.
4. Run `npm run db:sync` to construct the tables.
5. Run `npm run dev` to start the development server.

## License

Zomzam is released under the **AGPL-3.0 License**. This ensures that the software remains free and open, and that any modifications made to the source code—even if hosted as a web service—must also be released to the community. Please see the `LICENSE` file for the full text.
