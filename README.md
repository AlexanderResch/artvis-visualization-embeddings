# ArtVis Embedding Explorer

Interactive visual analytics application for exploring artist embeddings in the ArtVis knowledge graph.

The application consists of:

* **Frontend:** React, TypeScript, Vite and D3
* **Backend:** FastAPI
* **Database:** Neo4j
* **Embedding pipeline:** Attribute-Enhanced ComplEx, PCA, HDBSCAN and UMAP
* **Deployment:** Docker Compose

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

Some large generated files are intentionally excluded from Git.

After cloning the repository, the required ML data must be downloaded separately from the GitHub Releases section of this repository.

### 3.1 Precomputed embedding and clustering data

The precomputed machine learning artifacts are provided as a GitHub Release asset because the complete data directory is too large to store directly in the Git repository.

Download the latest ML data archive from the **Releases** section of this repository.

[Download ML data](https://github.com/AlexanderResch/artvis-visualization-embeddings/releases/download/v1.0.0/data.zip)

Expected file:

```text
artvis-ml-data-v1.zip
```

After downloading the archive, extract its contents to:

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

The directory contains the trained artist embeddings, PCA preprocessing results, HDBSCAN clustering results, UMAP projections, and supporting metadata used by the application.

Do **not** rename individual files inside this directory. The backend expects the paths defined in:

```text
backend/app/ml/config.py
```

The complete `backend/app/ml/data/` directory is excluded through `.gitignore`.

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

Download the latest ML data archive from the GitHub Releases section and extract it to:

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
