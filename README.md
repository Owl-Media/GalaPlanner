# Train Gala Planner

A web application that helps you plan your day at a train gala event by maximizing the number of locomotives you can see within your time constraints.

## Features

- Upload timetable files (PDF, XLSX, CSV)
- Preview uploaded file information
- Modern, accessible UI

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Fastify + TypeScript
- **Shared:** TypeScript types via npm workspaces

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
npm install
```

### Development

Start both frontend and backend in development mode:

```bash
npm run dev
```

This starts:
- Backend at http://localhost:3001
- Frontend at http://localhost:5173

### Testing

Run all tests:

```bash
npm run test
```

### Building

Build all packages:

```bash
npm run build
```

### Deployment base path

If your reverse proxy serves the app from a subpath such as `/planner` instead of the domain root, set `APP_BASE_PATH` to that path in your deployment environment. The backend will serve the SPA and API from that prefix, for example `/planner/` and `/planner/api/*`.

## Project Structure

```
GalaPlanner/
├── packages/
│   ├── shared/          # TypeScript types shared between frontend/backend
│   ├── backend/         # Fastify API server
│   └── frontend/        # React application
├── samples/             # Sample timetable files for testing
└── Specs/               # Project specification
```

## API Endpoints

### POST /api/upload

Upload a timetable file for parsing.

**Request:** `multipart/form-data` with `file` field

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fileName": "timetable.csv",
    "uploadedAt": "2024-01-01T00:00:00.000Z",
    "services": [],
    "stations": [],
    "locomotives": [],
    "issues": []
  }
}
```

### GET /api/health

Health check endpoint.

**Response:** `{ "status": "ok" }`
