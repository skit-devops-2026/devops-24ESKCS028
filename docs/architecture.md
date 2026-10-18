# Krishi Clinic — DevOps Architecture

## Request path

```
browser ──> server.js (Node 20, no dependencies)
              ├── static frontend (allow-listed files only)
              ├── /api/analyze ──> Groq vision API (key from GROQ_API_KEY)
              ├── /health      (liveness/readiness, returns commit SHA)
              └── /metrics     (Prometheus text format)
```

## Delivery path

```
push / PR ──> GitHub Actions
                hygiene ─> build-and-test ─> docker ─> kubernetes (kind)
                                              │
                                              └─ main only: push to ghcr.io
main ──> Render (render.yaml) builds Dockerfile ─> live URL
```

Jenkins (`Jenkinsfile`) runs the same stages locally and reports a
`jenkins/krishi-clinic` commit status back to GitHub.

## Monitoring

- `server.js` exposes `http_requests_total{method,route,status}`,
  `http_request_duration_seconds` (histogram), `analyze_requests_total`,
  `analyze_failures_total`, memory gauges and `app_info{commit}`.
- `monitoring/prometheus.yml` scrapes the local container and the live Render URL.
- `monitoring/alert-rules.yml`: app down, 5xx ratio > 5%, p95 > 500 ms,
  analysis failures.
- `monitoring/dashboard.json`: Grafana dashboard, auto-provisioned by
  `docker compose up` via `monitoring/grafana/provisioning/`.

## Kubernetes

- `k8s/deployment.yaml`: 2 replicas of the GHCR image, rolling update with
  `maxUnavailable: 0`, liveness/readiness on `/health`, non-root,
  read-only root filesystem, resource limits, optional `GROQ_API_KEY` secret.
- `k8s/service.yaml`: NodePort 30080, mapped to `localhost:8080` by
  `k8s/kind-config.yaml`.

## Secrets

The Groq key was previously embedded (base64) in `app.js`. It was moved
behind the server-side proxy, and the old key has been revoked. Keys are
supplied through `.env` locally, a Render environment variable in
production, and a Kubernetes Secret in the cluster.
