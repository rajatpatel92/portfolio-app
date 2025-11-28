
# Docker Deployment Guide

This guide explains how to deploy the Portfolio App using Docker and Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed on your machine.
- [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop).

## Setup

1.  **Clone the repository** (if you haven't already):
    ```bash
    git clone <your-repo-url>
    cd portfolio-app
    ```

2.  **Configure Environment Variables**:
    Copy the example environment file to `.env`:
    ```bash
    cp env.example .env
    ```
    Open `.env` and update the `NEXTAUTH_SECRET` with a secure random string. You can generate one with `openssl rand -base64 32`.

3.  **Build and Run**:
    Run the following command to build the Docker image and start the services (App and Database):
    ```bash
    docker-compose up -d --build
    ```
    The `-d` flag runs the containers in the background.

4.  **Access the Application**:
    Open your browser and navigate to:
    [http://localhost:3000](http://localhost:3000)

## Management

-   **Stop the application**:
    ```bash
    docker-compose down
    ```

-   **View Logs**:
    ```bash
    docker-compose logs -f
    ```

-   **Database Access**:
    The PostgreSQL database is running in a container named `portfolio-db`. Data is persisted in a Docker volume named `postgres_data`.

## Troubleshooting

-   **Database Connection Issues**: Ensure the `DATABASE_URL` in `docker-compose.yml` matches the credentials in your `.env` file.
-   **Port Conflicts**: If port 3000 is already in use, modify the `ports` mapping in `docker-compose.yml` (e.g., `"3001:3000"`).
