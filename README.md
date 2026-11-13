# MAI

An AI chatbot with real-time streaming responses, persistent per-user conversation history, and a React + TypeScript frontend.

## Features

- JWT authentication with httpOnly cookies
- Optional Google OAuth sign-in
- Per-user conversation threads
- PDF/TXT/Markdown uploads with embeddings-based retrieval (RAG)
- Real token streaming over Server-Sent Events (SSE)
- Markdown rendering with syntax highlighting and sanitization
- Conversation search, deletion, and history
- Dark/light theme
- Typed API layer with Zod validation
- Security middleware: Helmet, CORS allowlist, rate limiting
- Automated tests for the API and UI

## Tech Stack

### Frontend
- React 19 + TypeScript
- Vite 7
- react-markdown, remark-gfm, rehype-highlight, rehype-sanitize
- Vitest + React Testing Library

### Backend
- Node.js + Express 5 + TypeScript
- MongoDB + Mongoose
- OpenAI SDK (streaming)
- JWT + bcryptjs
- Zod, Helmet, express-rate-limit, pino

## Project Structure

```
MAI/
├── Backend/
│   ├── src/
│   │   ├── config/env.ts
│   │   ├── middleware/       # auth, error handling
│   │   ├── models/           # User, Thread, Document, Chunk
│   │   ├── routes/           # auth, chat, documents
│   │   ├── schemas/          # Zod schemas
│   │   ├── services/         # openai, embeddings, document, rag
│   │   ├── tests/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── Dockerfile
│   └── package.json
├── Frontend/
│   ├── src/
│   │   ├── api.ts
│   │   ├── Auth.tsx
│   │   ├── Chat.tsx
│   │   ├── ChatWindow.tsx
│   │   ├── Sidebar.tsx
│   │   ├── MyContext.tsx
│   │   ├── tests/
│   │   └── types.ts
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- OpenAI API key with available credits

## Local Setup

1. Install backend dependencies:
```bash
cd Backend
npm install
```

2. Create `Backend/.env` from the example:
```bash
cp .env.example .env
```
Set `MONGODB_URI`, `OPENAI_API_KEY`, and a long random `JWT_SECRET`.

3. Install frontend dependencies:
```bash
cd ../Frontend
npm install
```

4. Start the backend:
```bash
cd ../Backend
npm run dev
```

5. Start the frontend:
```bash
cd ../Frontend
npm run dev
```

Open http://localhost:5173, create an account, and start chatting.

## Docker

Create a root `.env` from `.env.example`, then:
```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8080
- Health check: http://localhost:8080/health

## Scripts

Backend:
- `npm run dev` — start with hot reload (tsx)
- `npm run build` — compile TypeScript
- `npm start` — run the compiled build
- `npm run typecheck` — type-check without emitting
- `npm test` — run Vitest + Supertest tests

Frontend:
- `npm run dev` — start Vite
- `npm run build` — type-check and build
- `npm run lint` — run ESLint
- `npm run typecheck` — type-check
- `npm test` — run Vitest + React Testing Library tests

## API

Auth:
- `POST /api/auth/register` — create an account and session
- `POST /api/auth/login` — start a session
- `POST /api/auth/logout` — clear the session
- `GET /api/auth/me` — current user
- `GET /api/auth/providers` — which OAuth providers are enabled
- `GET /api/auth/google` — start Google OAuth
- `GET /api/auth/google/callback` — Google OAuth callback

Chat (authenticated):
- `GET /api/thread` — list the user's threads
- `GET /api/thread/:threadId` — load messages for a thread
- `DELETE /api/thread/:threadId` — delete a thread
- `POST /api/chat` — non-streaming chat completion
- `POST /api/chat/stream` — SSE token stream

Documents / RAG (authenticated):
- `POST /api/documents` — upload a PDF/TXT/Markdown file (`file` + `threadId`)
- `GET /api/documents?threadId=...` — list a thread's documents
- `DELETE /api/documents/:documentId` — delete a document and its chunks

Uploaded files are chunked, embedded with `text-embedding-3-small`, and stored in MongoDB. When you chat, the most similar chunks for that thread are added to the prompt as context. Similarity is computed in the app, so no external vector database is required.

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Backend port (default 8080) |
| `MONGODB_URI` | MongoDB connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | Model name (default `gpt-4o-mini`) |
| `OPENAI_EMBEDDING_MODEL` | Embedding model (default `text-embedding-3-small`) |
| `RAG_TOP_K` | Number of document chunks injected into the prompt |
| `MAX_UPLOAD_MB` | Maximum upload size (default 10) |
| `MAX_DOCUMENTS_PER_THREAD` | Upload limit per conversation (default 5) |
| `JWT_SECRET` | Secret used to sign session tokens |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated |
| `COOKIE_SECURE` | `true` to require HTTPS cookies |
| `COOKIE_SAME_SITE` | `lax`, `strict`, or `none` |
| `GOOGLE_CLIENT_ID` | Google OAuth client id (optional) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (optional) |
| `GOOGLE_REDIRECT_URI` | Google OAuth callback URL |
| `OAUTH_SUCCESS_REDIRECT` | Frontend URL to return to after OAuth |

To enable Google sign-in, create an OAuth client in Google Cloud Console and add `http://localhost:8080/api/auth/google/callback` as an authorized redirect URI. For production, add your deployed callback URL.

When deploying the frontend and backend on different sites, use `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none`, and set `CORS_ORIGIN` to the exact frontend URL.

## Deployment

- Frontend: Vercel or Netlify (`VITE_API_URL` points at the backend)
- Backend: Render, Railway, or Fly.io
- Database: MongoDB Atlas
- CI: GitHub Actions runs type-checking, tests, linting, and builds

## License

ISC
