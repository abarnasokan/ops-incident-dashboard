# Ops Incident Dashboard

A full-stack incident management dashboard inspired by real-world operations and support workflows.

This project is being built as a flagship portfolio project to demonstrate backend API development, PostgreSQL database design, incident lifecycle tracking, and eventually a React-based operational dashboard.

## Tech Stack

- Node.js
- Express.js
- PostgreSQL
- Postman for API testing
- React planned for frontend
- Docker planned for containerization

## Current Progress

### Completed

- Created backend Express server
- Configured environment variables using `.env`
- Fixed local macOS port conflict by moving API from port `5000` to `5001`
- Connected backend to local PostgreSQL database
- Created `incidents` table
- Built incident CRUD route structure
- Implemented incident controller functions
- Tested health endpoint:

```http
GET /health