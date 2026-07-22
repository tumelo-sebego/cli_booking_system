---
type: concept
title: System Architecture
---
# System Architecture

The project is built as a MERN-stack application (MongoDB, Express, Node.js).

## Stack
- **Backend:** Node.js with Express.js framework, using Mongoose as the ODM for MongoDB.
- **Frontend:** A CLI-based client (assumed based on project name "cli_booking_system") interacting with the REST API.

## Main Entry Points
- **Backend:** `backend/server.js` serves the REST API endpoints.
- **Frontend:** `frontend/index.js` likely acts as the main entry point for the client application.

## Service Interactions & Data Flows
1. **Authentication:**
   - Users (Students/Admins) register and login via `POST` requests to `/api/register`, `/api/login`, etc.
   - Sessions are managed via the `isLoggedIn` flag in the respective MongoDB collections.
2. **Booking:**
   - Students create bookings via `POST /api/book`.
   - The server enforces business rules: 3 bookings per week max, no duplicate day bookings, and PC availability checks.
3. **Admin:**
   - Admins access dashboard via `GET /api/admin/dashboard` to view bookings and logged-in students.
   - Admins can cancel bookings via `POST /api/admin/cancel`.
