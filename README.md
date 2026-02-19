# Noteko

AI-powered document analysis and quiz generation desktop application. Upload PDFs, images, and documents — Noteko extracts key information and generates interactive quizzes to help you learn.

## Features

- **Document Upload & Management** — Upload PDF, images (.png, .jpg), and Word documents (.docx). Organize files into projects/folders.
- **AI-Powered Summarization** — Automatically extract the most important information from your documents using local LLM models.
- **Quiz Generation** — Generate interactive quizzes from document content to test your knowledge.
- **Project Organization** — Group documents into projects with folder hierarchy, tags, and search.
- **Logging & Statistics** — Monitor processing logs, track quiz scores, and view usage analytics.
- **Cross-Platform** — Runs on Windows, macOS, and Linux.
- **Privacy-First** — All AI processing runs locally via Ollama. Your documents never leave your machine.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | Electron + Vite |
| Frontend | React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| State Management | Zustand |
| Database | SQLite (via Drizzle ORM) |
| LLM Engine | Ollama (Llama 3, Mistral, Phi) |
| Document Processing | pdf-parse, Tesseract.js (OCR), mammoth |
| Logging | electron-log |
| Testing | Vitest, Playwright |
| Packaging | electron-forge |

## Architecture

```
noteko/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry point
│   │   ├── ipc/                 # IPC handlers (bridge between main & renderer)
│   │   ├── services/
│   │   │   ├── database/        # SQLite + Drizzle ORM setup & queries
│   │   │   ├── documents/       # Document parsing (PDF, images, DOCX)
│   │   │   ├── llm/             # Ollama integration & prompt management
│   │   │   ├── quiz/            # Quiz generation & scoring logic
│   │   │   └── logging/         # Structured logging service
│   │   └── utils/
│   ├── renderer/                # React frontend (Vite)
│   │   ├── components/          # Reusable UI components (shadcn/ui)
│   │   ├── pages/               # Page-level components
│   │   │   ├── Dashboard/       # Home dashboard with stats
│   │   │   ├── Projects/        # Project & folder management
│   │   │   ├── Documents/       # Document viewer & analysis
│   │   │   ├── Quiz/            # Quiz taking & results
│   │   │   ├── Logs/            # Log viewer & statistics
│   │   │   └── Settings/        # App & Ollama configuration
│   │   ├── hooks/               # Custom React hooks
│   │   ├── store/               # Zustand state stores
│   │   └── lib/                 # Utility functions
│   ├── shared/                  # Shared types & constants
│   └── preload/                 # Electron preload scripts
├── drizzle/                     # Database migrations
├── resources/                   # App icons & static assets
├── tests/                       # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── config files
```

### Data Flow

```
User uploads document
       │
       ▼
[Electron Main Process]
       │
       ├──► Document Parser (pdf-parse / Tesseract.js / mammoth)
       │         │
       │         ▼
       │    Extracted text stored in SQLite
       │         │
       │         ▼
       ├──► Ollama API (async, non-blocking)
       │         │
       │         ├──► Summarization → stored in SQLite
       │         └──► Quiz Generation → stored in SQLite
       │
       ▼
[IPC Bridge] ──► [React Renderer] ──► UI Update
```

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [Ollama](https://ollama.ai/) installed and running locally
- A pulled model (e.g., `ollama pull llama3.2` or `ollama pull mistral`)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/letyshub/noteko.git
cd noteko

# Install dependencies
npm install

# Start in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Package for distribution
npm run package
```

## License

[MIT](LICENSE)
