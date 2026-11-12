# ArtVis Embedding Explorer

Interactive visual analytics application for exploring artist embeddings in the ArtVis knowledge graph.

The application consists of:

* **Frontend:** React, TypeScript, Vite and D3
* **Backend:** FastAPI
* **Database:** Neo4j
* **Embedding pipeline:** PyKEEN TransE, DistMult, ComplEx or RotatE; L2 normalization, PCA, HDBSCAN and UMAP
* **Deployment:** Docker Compose

---

## 1. Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── ml/
│   │   │   └── data/              # Generated data, excluded from Git
│   │   │       ├── input/         # Shared graph snapshot, prepared triples, group labels
│   │   │       ├── models/        # Four selected datasets and manifest.json
│   │   │       └── runs/          # Optional new training runs, excluded from releases
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
├── experiments/                    # Versioned comparison reports, tables, frozen source
├── releases/                       # Generated data ZIP, excluded from Git
└── .env                            # Production credentials, not stored in Git
```

---

## 2. Prerequisites

Install:

* Docker Desktop or Docker Engine
* Docker Compose

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

The local setup requires the ML data and Neo4j database dump from the same GitHub
Release. Both are distributed separately from the source code.

### 3.1 Add the model data

1. Download **artvis-ml-data-v2.zip** from the repository's GitHub Releases page.
2. In File Explorer, right-click the ZIP and select **Extract All**.
3. If the backend is running, stop it in Docker Desktop. Copy the entire extracted
   **data** folder into **backend/app/ml** in your project.

The resulting folder must be `backend/app/ml/data/`, containing `input/` and
`models/`. The model catalog is at `backend/app/ml/data/models/manifest.json`.

The data include embeddings, clusters, and 2D/3D maps for RotatE, TransE, DistMult,
and ComplEx. RotatE is the default. All four datasets use L2 normalization followed
by PCA, reducing the 64 embedding features to ten dimensions. HDBSCAN produces
clusters from this representation, and UMAP uses it to generate the 2D/3D maps.

### 3.2 Add the Neo4j database dump

1. Download the database dump from the same GitHub Release. If it is supplied as
   a ZIP, extract it in File Explorer first.
2. Open **artvis-graph-db** in your project and create a **neo4j_dump** folder if
   it is missing.
3. Copy **neo4j.dump** into that folder. The complete path must be
   `artvis-graph-db/neo4j_dump/neo4j.dump`.

Add both datasets before starting the application as described in Section 4.
Docker imports the provided dump automatically during the database image build.

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

## 5. Stop Development Environment

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

## 6. Production Environment Variables

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

Do not commit the `.env` file.

---

## 7. Production ML Data

The production backend uses the same precomputed ML artifacts as the development setup.

Extract **artvis-ml-data-v2.zip** and copy its **data** folder into
**backend/app/ml** in the production checkout, as described in Section 3.
Production mounts this directory read only:

```text
backend/app/ml/data/
```

---

## 8. Start Production Environment

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
