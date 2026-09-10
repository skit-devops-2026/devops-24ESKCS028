.PHONY: install test build run docker-build docker-up

install:
	@echo "Checking environment..."
	@node -v || (echo "Node.js is required" && exit 1)

test:
	npm test

build:
	@echo "Validating project assets..."
	@node -c server.js
	@echo "Build successful."

run:
	node server.js

docker-build:
	docker build -t krishi-clinic:latest .

docker-up:
	docker compose up --build -d
