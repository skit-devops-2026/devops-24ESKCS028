# Krishi Clinic — DevOps Architecture & Operational Guide

## Overview

This repository houses the DevOps configuration and automation pipelines for Krishi Clinic, an AI-enabled agriculture disease advisory platform.

## Architecture

- **Application Server**: Lightweight Node.js server exposing HTTP assets, `/health`, and `/metrics`.
- **Continuous Integration**: GitHub Actions workflow (`.github/workflows/ci.yml`) running repository hygiene checks and automated test suites.
- **Continuous Delivery**: Jenkins declarative pipeline (`Jenkinsfile`) standardizing build and validation stages.
- **Containerization**: Docker multi-stage container image with internal health check.
- **Orchestration**: Kubernetes Deployment (`k8s/deployment.yaml`) running 2 replicas with active liveness and readiness probes, exposed via ClusterIP Service (`k8s/service.yaml`).
- **Telemetry & Monitoring**: Prometheus scraping `/metrics` and Grafana monitoring dashboard (`monitoring/dashboard.json`).
# Kubernetes & Monitoring Setup Verified
