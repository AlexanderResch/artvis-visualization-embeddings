# ArtVis Embedding Explorer

Interactive visual analytics application for exploring artist embeddings in the ArtVis knowledge graph.

The application consists of:

* **Frontend:** React, TypeScript, Vite and D3
* **Backend:** FastAPI
* **Database:** Neo4j
* **Embedding pipeline:** PyKEEN TransE, DistMult, ComplEx or RotatE; HDBSCAN and UMAP
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

Large generated files are excluded from Git. Download the ML data ZIP from the
matching GitHub Release and extract it into the project root before starting Docker:

```powershell
Expand-Archive -LiteralPath './artvis-ml-data-2026-11-12.zip' -DestinationPath .
```

Use the downloaded release's actual filename. The ZIP includes the complete
`backend/app/ml/data/input/` and `backend/app/ml/data/models/` trees. Do not extract
it into `data/` itself. When replacing an existing dataset, stop the backend and
move the previous `data/` directory aside first; then extract and restart it.
Reports are already included in the repository under `experiments/`.

### 3.1 Embedding and clustering data

The offline pipeline is documented in [backend/app/ml/README.md](backend/app/ml/README.md).
The Embedding model dropdown switches between complete TransE, DistMult, ComplEx,
and RotatE datasets. Each dataset contains embeddings, cluster assignments,
2D/3D maps, profiles, and evaluation metadata. The model catalog is published after
these artifacts have been verified. See the ML README for the bounded training search, five-seed
confirmation, and evaluation against Neo4j artist-group memberships.

The completed comparison and its interpretation are in
[the evaluation report](experiments/kge_comparison_2026-11-10/report.md) and
[the model recommendation](experiments/kge_comparison_2026-11-10/recommendation.md).
RotatE has the highest mean validation and held-out test pair-F1 among the tested
configurations. RotatE is the application's default. The dropdown follows the
validation ranking: RotatE, TransE, DistMult, ComplEx. The help dialog explains
the ranking and shows mean test agreement, noise, stability, and successful starts.

For a fresh standalone TransE data directory, the following uses the selected
four-epoch configuration and L2/PCA preprocessing:

```bash
docker compose exec -e ADAM_FUSED=true -e TORCH_NUM_THREADS=2 \
  -e ML_DEVICE=cpu -e LEARNING_RATE=0.001 \
  -e HDBSCAN_NORMALIZE=true -e HDBSCAN_USE_PCA=true backend \
  python -m app.ml.run_pipeline --model TransE --epochs 4 --seed 45 \
  --data-dir /app/app/ml/data/runs/new_transe_run
```

This command reads the released shared input and creates a standalone dataset in
`data/runs/new_transe_run/`. Reproduce and publish all
four dropdown datasets with the group-reference experiment in the ML README.

Existing `nodes.parquet` and `edges.parquet` snapshots can be reused. Export and
preparation are explicit steps and refuse to overwrite existing input artifacts.
The PCA comparison is available as a separate diagnostic. Earlier full training
runs and the old single-model dataset were archived outside this repository.

New tabular outputs use Parquet. Existing release archives and historical
experiment files must be matched to their recorded model and protocol. The new
reference evaluation excludes MEMBER_OF from training and separates validation
and test artists.

Do **not** rename individual files inside this directory. The backend expects the paths defined in:

```text
backend/app/ml/config.py
```

Generated ML data directories are excluded from Git. Small reports and comparison
tables are kept under `experiments/`.

### 3.2 Create a data release

Create the data ZIP manually. In a temporary folder, copy the `input` and `models`
directories into the following structure, then compress the `backend` folder:

```text
backend/
  app/
    ml/
      data/
        input/
        models/
```

The ZIP should open directly to `backend/`, without an additional enclosing
folder. Upload it to the matching GitHub Release. This structure allows users to
extract it into the project root as described above.

Include the complete `input` and `models` directories. Leave out `runs`, backups,
and user-study entries. The Neo4j dump and catalogue source remain separate.

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

Extract the same ML data release into the production checkout. Production mounts
one directory read only; it contains both the shared input and model catalog:

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
