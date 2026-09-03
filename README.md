# ArtVis Embedding Explorer

Interactive visual analytics application for exploring artist embeddings in the ArtVis knowledge graph.

The application consists of:

- **Frontend:** React, TypeScript, Vite and D3
- **Backend:** FastAPI
- **Database:** Neo4j
- **Embedding pipeline:** Attribute-Enhanced ComplEx, PCA, HDBSCAN and UMAP
- **Deployment:** Docker Compose

---

## 1. Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── ml/
│   │   │   └── data/              # Precomputed ML artifacts, not stored in Git
│   │   ├── main.py
│   │   └── db.py
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   ├── nginx.conf
│   ├── vite.config.ts
│   └── package.json
│
├── artvis-graph-db/
│   ├── csv/
│   │   └── catalogue_entries.csv
│   ├── neo4j_dump/
│   │   └── neo4j.dump             # Not stored in Git
│   ├── dev.env
│   ├── Dockerfile
│   └── import.sh
│
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env                            # Production credentials, not stored in Git
```

---

## 2. Prerequisites

Install:

- Docker Desktop or Docker Engine
- Docker Compose

Check the installation:

```bash
docker --version
docker compose version
```

---

# Development Setup

The normal `docker-compose.yml` starts the complete local development environment:

1. Neo4j
2. FastAPI backend
3. Vite frontend

The local Neo4j database is available on ports `7474` and `7687`.

The backend is available on port `8000`.

The frontend is available on port `5173`.

---

## 3. Required Data Files

Some large generated files are intentionally excluded from Git.

After cloning the repository, copy the required files into the paths described below.

### 3.1 Precomputed embedding and clustering data

Copy the complete ML data directory to:

```text
backend/app/ml/data/
```

The resulting structure should look similar to:

```text
backend/
└── app/
    └── ml/
        └── data/
            ├── nodes.parquet
            ├── edges.parquet
            ├── entity_metadata.parquet
            ├── attribute_features.npy
            ├── attribute_manifest.json
            ├── indexed_edges.parquet
            ├── relation_manifest.json
            ├── type_entities.npz
            ├── entity_type_ids.npy
            ├── relations/
            └── ...
```

The directory also contains the trained embeddings, PCA/HDBSCAN results and UMAP projections used by the application.

Do **not** rename individual files inside this directory. The backend expects the paths defined in:

```text
backend/app/ml/config.py
```

The complete `backend/app/ml/data/` directory is excluded through `.gitignore`.

---

### 3.2 Neo4j database dump for local development

For the normal local Docker setup, place the ArtVis Neo4j dump at:

```text
artvis-graph-db/neo4j_dump/
```

For example:

```text
artvis-graph-db/
└── neo4j_dump/
    └── neo4j.dump
```

The Neo4j Docker image imports the database from this directory.

The dump is excluded from Git because of its size.

---

### 3.3 Catalogue entries CSV

The backend also expects:

```text
artvis-graph-db/csv/catalogue_entries.csv
```

The file is mounted into the backend container as:

```text
/app/data/catalogue_entries.csv
```

The corresponding backend environment variable is:

```text
ARTVIS_CATALOGUE_ENTRIES_CSV=/app/data/catalogue_entries.csv
```

---

## 4. Start Development Environment

From the root directory of the project:

```bash
docker compose up -d --build
```

Check the running containers:

```bash
docker compose ps
```

Expected services:

```text
artvis-db
artvis-backend
artvis-frontend
```

Open the application:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:8000
```

Neo4j Browser:

```text
http://localhost:7474
```

---

## 5. Development Logs

Show all logs:

```bash
docker compose logs -f
```

Backend only:

```bash
docker compose logs -f backend
```

Frontend only:

```bash
docker compose logs -f frontend
```

Neo4j only:

```bash
docker compose logs -f artvis-db
```

---

## 6. Stop Development Environment

```bash
docker compose down
```

To rebuild after code or Docker configuration changes:

```bash
docker compose up -d --build
```

---

# Production Deployment

The production setup uses:

```text
docker-compose.prod.yml
```

The production frontend is built with Vite and served through nginx.

The FastAPI backend runs in its own container.

For the TU Wien deployment, the application is exposed through an external nginx reverse proxy at:

```text
/embedding-explorer/
```

The application container listens locally on:

```text
127.0.0.1:3000
```

---

## 7. Production Environment Variables

Create a `.env` file in the root directory:

```text
.
├── .env
├── docker-compose.prod.yml
├── backend/
└── frontend/
```

Example:

```env
NEO4J_URI=bolt+s://YOUR_NEO4J_HOST:7687
NEO4J_USER=YOUR_USERNAME
NEO4J_PASSWORD=YOUR_PASSWORD
```

Do not commit `.env`.

The file is excluded through `.gitignore`.

Never store production passwords directly in `docker-compose.prod.yml`.

An optional `.env.example` can be committed instead:

```env
NEO4J_URI=
NEO4J_USER=
NEO4J_PASSWORD=
```

---

## 8. Production ML Data

The production backend uses the same precomputed data as the development version.

Copy the complete data directory to:

```text
backend/app/ml/data/
```

The production Compose configuration mounts it read-only into the backend container:

```text
./backend/app/ml/data:/app/app/ml/data:ro
```

The ML files are therefore **not copied into the Docker image**.

They must exist on the machine where Docker Compose is started.

---

## 9. External Docker Network

The TU Wien production configuration uses the external Docker network:

```text
artvis-network
```

Check whether it exists:

```bash
docker network ls
```

More details:

```bash
docker network inspect artvis-network
```

If the network already exists on the production server, no further action is required.

For a local production test, create it once if Docker reports:

```text
network artvis-network declared as external, but could not be found
```

Create it with:

```bash
docker network create artvis-network
```

---

## 10. Start Production Environment

Build and start:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Check the containers:

```bash
docker compose -f docker-compose.prod.yml ps
```

Expected production services include:

```text
artvis-embedding-backend
artvis-embedding-explorer
```

The frontend should expose:

```text
127.0.0.1:3000->80/tcp
```

---

## 11. Local Production Test

When testing the production configuration locally, open:

```text
http://localhost:3000/embedding-explorer/
```

The application is configured for the `/embedding-explorer` base path because the production server exposes it under this URL prefix.

The frontend build therefore requires:

```ts
base: '/embedding-explorer/'
```

in:

```text
frontend/vite.config.ts
```

React Router must also use:

```tsx
<BrowserRouter basename="/embedding-explorer">
```

---

## 12. Production API Routing

The browser accesses the backend through nginx.

Example:

```text
/embedding-explorer/api/...
```

The internal frontend nginx forwards API requests to:

```text
http://backend:8000/
```

This prevents the browser from accessing the FastAPI container directly.

The production Vite build should use:

```text
VITE_API_URL=/embedding-explorer/api
```

for the TU Wien deployment.

---

## 13. Health Checks

Check whether the frontend responds:

```bash
curl http://127.0.0.1:3000/embedding-explorer/
```

Check the backend through the frontend proxy:

```bash
curl http://127.0.0.1:3000/embedding-explorer/api/health
```

Check whether the backend, database and ML artifacts are ready:

```bash
curl http://127.0.0.1:3000/embedding-explorer/api/ready
```

The `/ready` endpoint is especially useful because it checks whether the required application data is available.

---

## 14. Production Logs

All production logs:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

Backend:

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

Frontend:

```bash
docker compose -f docker-compose.prod.yml logs -f frontend
```

---

## 15. Stop Production Environment

```bash
docker compose -f docker-compose.prod.yml down
```

Restart:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Rebuild and restart after frontend, backend, nginx or Docker configuration changes:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

# TU Wien Deployment

The current deployment target is:

```text
https://artvis.cvast.tuwien.ac.at/embedding-explorer/
```

The external nginx reverse proxy forwards requests to:

```text
127.0.0.1:3000
```

The expected request flow is:

```text
Browser
   |
   v
https://artvis.cvast.tuwien.ac.at/embedding-explorer/
   |
   v
TU Wien nginx reverse proxy
   |
   v
127.0.0.1:3000
   |
   v
Frontend nginx container
   |
   +---- static React/Vite application
   |
   +---- /api/ ---> FastAPI backend
                      |
                      v
                  ArtVis Neo4j
```

For the server deployment, the backend connects to the existing ArtVis Neo4j instance through the values defined in `.env`.

Production credentials must never be committed to Git.

---

# 16. Fresh Clone Checklist

After cloning the repository on a new machine:

1. Install Docker.
2. Copy the required Neo4j dump to:

   ```text
   artvis-graph-db/neo4j_dump/
   ```

   This is required for the full local development environment.

3. Copy the complete precomputed ML data directory to:

   ```text
   backend/app/ml/data/
   ```

4. Make sure this file exists:

   ```text
   artvis-graph-db/csv/catalogue_entries.csv
   ```

5. For production, create:

   ```text
   .env
   ```

   with the Neo4j connection data.

6. If production Compose uses an external network, verify:

   ```bash
   docker network inspect artvis-network
   ```

7. Start development:

   ```bash
   docker compose up -d --build
   ```

   or start production:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

---

# 17. Common Problems

### `network artvis-network declared as external, but could not be found`

Create the network for a local production test:

```bash
docker network create artvis-network
```

On the deployment server, first check whether the shared network already exists.

---

### Frontend container is running but the page is empty

Check:

```bash
docker compose -f docker-compose.prod.yml logs -f frontend
```

Also verify the production base path:

```ts
base: '/embedding-explorer/'
```

and:

```tsx
<BrowserRouter basename="/embedding-explorer">
```

After changing frontend configuration, rebuild:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

### Frontend loads but no artist data appears

Check the browser Network tab and verify the API URL.

Production requests should use:

```text
/embedding-explorer/api/...
```

Check the backend logs:

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

---

### Backend starts but `/ready` fails

Verify that the ML data exists at:

```text
backend/app/ml/data/
```

Also check that:

```text
artvis-graph-db/csv/catalogue_entries.csv
```

exists.

Finally, verify the Neo4j connection variables in `.env`.

---

### Docker configuration changed but behavior did not change

Force a rebuild:

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

---

# 18. Security

Do not commit:

```text
.env
backend/app/ml/data/
artvis-graph-db/neo4j_dump/
```

Do not publish Neo4j usernames or passwords in documentation, source code, screenshots or issue reports.

Use environment variables for production credentials.
