# Krishi Clinic

A web-based plant disease detection and advisory system built for farmers.

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
make install
make run
```

## Live URL

https://skit-devops-2026.github.io/devops-24ESKCS028/

## Health endpoint

`GET /health` returns the running commit SHA. See `Makefile` and the milestone
sheet for why this is required.
