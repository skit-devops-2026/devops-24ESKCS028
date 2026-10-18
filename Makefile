.PHONY: install test build run docker-build docker-up docker-down kind-up kind-deploy kind-down

IMAGE ?= ghcr.io/skit-devops-2026/devops-24eskcs028:latest

install:
	@node -v >/dev/null || (echo "Node.js 20+ is required" && exit 1)
	npm install --no-audit --no-fund

test:
	npm test

build:
	@echo "Syntax-checking server and frontend scripts..."
	node --check server.js
	node --check app.js
	node --check auth.js
	@echo "Build successful."

run:
	node server.js

docker-build:
	docker build --build-arg COMMIT_SHA=$$(git rev-parse HEAD) -t $(IMAGE) .

# App + Prometheus + Grafana
docker-up:
	COMMIT_SHA=$$(git rev-parse HEAD) docker compose up --build -d

docker-down:
	docker compose down

# Local Kubernetes with kind (see k8s/)
kind-up:
	kind create cluster --name krishi --config k8s/kind-config.yaml

kind-deploy: docker-build
	kind load docker-image $(IMAGE) --name krishi
	kubectl apply -f k8s/deployment.yaml -f k8s/service.yaml
	kubectl rollout restart deployment/krishi-clinic-deployment
	kubectl rollout status deployment/krishi-clinic-deployment --timeout=120s
	kubectl get pods -o wide

kind-down:
	kind delete cluster --name krishi
