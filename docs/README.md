# Deployment evidence

Captured on 18 October 2026 from a local kind cluster (`kind-krishi`, Kubernetes
v1.31.0) running the image built from this repository.

| File | Shows |
|---|---|
| `deployment-screenshot.png` | The app served through `krishi-clinic-service` (NodePort 30080 → `localhost:8080`) and the `/health` response with the deployed commit SHA |
| `kubectl-get-pods.png` | `kubectl get pods`: both replicas `1/1 Running`, the Deployment `2/2` available, and the image, probes and Service |
| `metrics-endpoint.png` | `/metrics` from a running pod: labelled request counters, latency histogram totals, memory and build info |

Reproduce with `make kind-up && make kind-deploy` (see the top-level README).
The same deploy runs in CI on every push in the `kubernetes` job of
`.github/workflows/ci.yml`.
