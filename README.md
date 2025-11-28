
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

## Run from Docker Hub

To run the application using the pre-built image from Docker Hub (`rajatpatel7/portfolio-app:latest`) instead of building locally:

1.  **Configure Environment**: Follow Step 2 in **Setup** to create your `.env` file.

2.  **Update Docker Compose**:
    Open `docker-compose.yml` and replace the `build` section for the `app` service with the `image` property:

    ```yaml
    services:
      app:
        image: rajatpatel7/portfolio-app:latest
        # build: ... (remove or comment out the build section)
        ...
    ```

3.  **Start the App**:
    ```bash
    docker-compose up -d
    ```

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
