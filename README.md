# Krishi Clinic

A web-based plant disease detection and advisory system built for farmers.

**Live:** https://krishi-clinic-24eskcs028.onrender.com

## Author

| Roll No. | Name | GitHub username |
|---|---|---|
| 24ESKCS028 | Ajay Yadav | ajayyadav432 |

## About

Krishi Clinic is an AI-assisted agricultural web application designed to help farmers detect plant leaf diseases quickly and accurately. Farmers can upload photos of affected leaves and receive automated diagnostic guidance, preventive measures, and treatment recommendations.

## Tech stack

- Frontend: HTML5, CSS3, JavaScript, jQuery
- Backend: Node.js (Static file serving and health check endpoint)
- Storage & Auth: LocalStorage with client-side JWT (JSON Web Token) session management
- AI Model: Groq Vision API (Llama 3.2 Vision)

## Running locally

```bash
cp .env.example .env        # add your GROQ_API_KEY
make install
make test
GROQ_API_KEY=... make run   # serves on port 5500
```

The browser never sees the Groq key: the frontend posts to `/api/analyze`
and `server.js` forwards the request with the key from the environment.

## Live URL

https://krishi-clinic-24eskcs028.onrender.com

Deployed on Render from `render.yaml` (Docker runtime, auto-deploys on every
push to `main`). Useful endpoints on the live app:

| Endpoint | Purpose |
|---|---|
| `/` | The application |
| `/health` | Liveness check, returns the running commit SHA |
| `/metrics` | Prometheus metrics: request counts by route/status, latency histogram, memory, analysis failures |

## DevOps pipeline

| Stage | Where | What it does |
|---|---|---|
| CI | `.github/workflows/ci.yml` | Hygiene check, `make test`, `make build` on every push and PR |
| Container | `Dockerfile`, `docker` job in CI | Builds the image, smoke-tests `/health` and `/metrics`, pushes `ghcr.io/skit-devops-2026/devops-24eskcs028` on `main` |
| Kubernetes | `k8s/`, `kubernetes` job in CI | Deploys the image to a kind cluster and waits for Ready pods |
| Jenkins | `Jenkinsfile` | Same stages plus Docker build/smoke test, posts commit status to GitHub |
| Deploy | `render.yaml` | Render builds the Dockerfile and serves the live URL |
| Monitoring | `monitoring/` | Prometheus scrape config + alert rules, Grafana dashboard |

### Container and monitoring stack

```bash
GROQ_API_KEY=... make docker-up
# app on port 5500 · Prometheus on port 9090 · Grafana on port 3000 (admin/admin)
```

Prometheus scrapes both the local container and the live Render deployment.
Grafana loads `monitoring/dashboard.json` automatically.

### Kubernetes (kind)

```bash
make kind-up        # kind cluster with NodePort 30080 -> localhost:8080
make kind-deploy    # build image, load into kind, apply k8s/, wait for rollout
kubectl get pods
curl -s 127.0.0.1:8080/health
```

Screenshots of the deployment are in [`docs/`](docs/).
