# Krishi Clinic

A simple web application for Indian farmers to upload photos of their plant leaves and receive AI-powered disease diagnosis.

## Features

- Plant leaf disease detection using Groq Vision AI (Llama 3.2 Vision model)
- User registration and login system with JWT authentication
- Protected routes (unauthorized users are automatically redirected to the login page)
- Farmer profile page displaying crop details, active JWT token, and scan history
- Local scan history management
- Clean and farmer-friendly responsive user interface

## Technologies Used

- HTML5
- CSS3
- JavaScript (ES6)
- jQuery (3.7.1)
- Groq AI API

## Project Structure

- `index.html` - Main plant disease detector page (upload, crop selection, analysis)
- `login.html` - Farmer login page
- `register.html` - Farmer account registration page
- `profile.html` - Farmer profile and scan history page
- `auth.js` - Authentication controller (JWT token creation, validation, session management)
- `app.js` - Core application logic (file reading, Groq API call, history storage)
- `style.css` - Green farmer-themed stylesheet

## Authentication (JWT)

This project uses JSON Web Token (JWT) standards (RFC 7519) formatted as:
`Header.Payload.Signature`

1. When a farmer logs in, a JWT token is generated containing the user's username (`sub`), full name (`name`), crop, and expiration time (`exp`).
2. The token is stored securely in the browser's `localStorage` as `krishiAuthToken`.
3. When accessing protected pages (`index.html`, `profile.html`), `auth.js` decodes and verifies the JWT token before granting access.
4. If the token is missing or expired, the user is redirected to `login.html`.

## How to Run

1. Serve the project files using any static HTTP server (e.g., Python HTTP server, Live Server, or Nginx):
   ```bash
   python3 -m http.server 5500
   ```
2. Open your browser and navigate to:
   ```
   http://localhost:5500/login.html
   ```
3. Register a new account, log in, and begin scanning plant leaves.
