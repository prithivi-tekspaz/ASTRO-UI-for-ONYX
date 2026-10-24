# Onyx Knowledge Workspace Frontend

A high-performance enterprise knowledge workspace built with **Astro**, featuring conversational RAG, multi-file document indexing, cross-source search, and a non-intrusive 3D wireframe ambient canvas.

---

## Architecture Overview

```text
src/
├── layouts/
│   └── AppLayout.astro         # Unified workspace shell (Header, Sidebar, 3D Background)
├── pages/
│   ├── index.astro             # Conversational Chat Workspace
│   ├── search.astro            # Cross-document Semantic Search
│   ├── knowledge.astro         # Knowledge Sources, Document Ingestion & Connectors
│   ├── agents.astro            # Specialized Assistants & Real-time Tool Activity
│   └── settings.astro          # Personalization, Themes & Upstream API config
├── components/
│   ├── app/
│   │   ├── AppHeader.astro     # Route-aware compact header & theme toggle
│   │   └── AppSidebar.astro    # Collapsible sidebar with independent recent chat scroll
│   ├── chat/
│   │   ├── ChatEmptyState.astro# Starter prompts & welcome screen
│   │   └── ChatComposer.astro  # Multiline input, drag-and-drop, stop generation
│   └── effects/
│       └── AmbientBackground.astro # 3D wireframe geometric solids & network filaments
├── lib/
│   └── onyx/
│       ├── types.ts            # Canonical frontend domain models
│       ├── client.ts           # Central Onyx HTTP client
│       ├── conversations.ts    # Session and chat history API
│       ├── documents.ts        # Document catalog and file ingestion
│       ├── streaming.ts        # Robust SSE stream decoder with citation events
│       ├── search.ts           # Search, agents, and connectors adapters
│       └── markdown.ts         # Secure Markdown parser, code highlighting & tables
└── styles/
    ├── tokens.css              # Dark & light design system tokens
    ├── layout.css              # App shell, responsive drawers & scroll areas
    ├── chat.css                # Bubble layouts, citations & composer styling
    ├── components.css          # Cards, badges, buttons & search bar
    └── motion.css              # Micro-animations, ambient glow & reduced motion
```

---

## Running the Application Locally (No Docker Required)

### 1. Prerequisites
- **Node.js**: `v20+` or `v22+`
- **npm** or your preferred package manager

### 2. Start the Astro Development Server
To launch the dev server in the background:
```bash
node ./node_modules/astro/bin/astro.mjs dev --background
```
Or directly:
```bash
npm run dev
```
The frontend will start at **`http://localhost:4321`**.

### 3. Backend Integration & Upstream Proxy
All `/api/*` endpoints are automatically proxied via `astro.config.mjs` to the upstream Onyx backend:
```javascript
vite: {
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      }
    }
  }
}
```
To point the frontend to a different backend host or staging server, update the `target` URL in [astro.config.mjs](file:///D:/frontend_backup/astro.config.mjs).
