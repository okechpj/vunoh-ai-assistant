Frontend for AI Task Manager

Files:
- index.html — main UI
- styles.css — styles (CSS variables, responsive)
- app.js — vanilla JS for API integration and UI logic

Run
1. Start backend server (API endpoints expected: POST /request, GET /tasks, GET /tasks/:id, PATCH /tasks/:id/status)
2. Open `frontend/index.html` in a browser OR serve with a static server (recommended):

  npx http-server frontend -c-1

3. Use the UI. Ensure backend and frontend origins align or configure CORS accordingly.

Notes
- Use the mock server or `nock`-based tests for deterministic behaviour in development.
- API errors are shown as feedback messages. Logs in the backend help debug.
