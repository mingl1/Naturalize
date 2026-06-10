# Antigravity Scrape-as-Code Engine (Naturalize)

A lightweight visual asset collection tool and scraping generator. The engine bypasses monolithic LLM parsing in favor of generated programmatic primitives, allowing you to visually identify target layout containers and compile them into sandboxed, standalone Python extraction scripts.

---

## 🏗️ Architecture Overview

The system consists of three primary components:
1. **Front-End UX ([extension](file:///C:/Users/gameg/Documents/antigravity/peaceful-volta/extension))**: A Manifest V3 Chrome and Firefox Extension that monitors DOM hovers, lets you visually identify item listings, and supports click action recording.
2. **React Dashboard ([dashboard](file:///C:/Users/gameg/Documents/antigravity/peaceful-volta/dashboard))**: A Vite-based UI interface for managing collections, browsing scraped items, configuring credentials, and executing semantic searches.
3. **Control Plane ([backend](file:///C:/Users/gameg/Documents/antigravity/peaceful-volta/backend))**: A FastAPI service that uses a self-improving LoopAgent generator to compile robust, sandboxed BeautifulSoup scraping scripts and supports conversational Q&A search workflows.

---

## 📂 Repository Layout

```text
├── extension/             # Browser Extension (Manifest V3)
│   ├── manifest.json      # Extension manifest metadata
│   ├── content.js         # Hover element highlight and click recording
│   ├── background.js      # Service worker proxy for API requests bypassing CSP
│   └── popup.js           # Extension controller logic
├── dashboard/             # React + Vite Web Client
│   ├── src/App.jsx        # Dashboard UI (Auth, Collections, Semantic Search)
│   └── package.json       # Node package configuration
├── backend/               # FastAPI Backend Service
│   ├── main.py            # API endpoints (Auth, Collections, Generator, Search)
│   ├── agent_workflows.py # LoopAgent code generator & Q&A search pipelines
│   ├── database.py        # MongoDB connection and semantic/keyword search
│   ├── generator.py       # Selector inference generator (LLM & Heuristics)
│   ├── sdk_blueprint.py   # Core ExtractedCatalogItem SDK schema
│   └── test_backend.py    # Integration test suite
├── pyproject.toml         # Ruff configuration settings
└── LICENSE                # MIT License file
```

---

## 🚀 Getting Started

### 1. Backend Service Setup

The backend utilizes `uv` as its package manager.

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   uv venv
   # On Windows:
   .venv\Scripts\activate
   ```
3. Install the required dependencies:
   ```bash
   uv pip install -r requirements.txt
   ```
4. Copy the environment configuration template and set up your keys:
   ```bash
   cp ../.env.example .env
   ```
5. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```

The backend API will be available at `http://127.0.0.1:8000`.

---

### 2. React Dashboard Setup

1. Navigate to the dashboard directory:
   ```bash
   cd dashboard
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

The dashboard will be available at `http://localhost:5173`.

---

### 3. Browser Extension Installation

#### Google Chrome & Chromium-based Browsers

1. Open your browser and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** in the top-left.
4. Select the `/extension` directory from this repository.

#### Mozilla Firefox

1. Open Firefox and navigate to `about:debugging`.
2. Click **This Firefox** on the left menu.
3. Click **Load Temporary Add-on...**
4. Select the `manifest.json` (or `manifest.firefox.json`) file inside the `/extension` directory.

---

## ⚙️ Configuration (.env)

Configure your API keys and MongoDB settings in `/backend/.env` (refer to [.env.example](file:///C:/Users/gameg/Documents/antigravity/peaceful-volta/.env.example)):
- `GEMINI_API_KEY`: API Key for Google Gemini.
- `OPENAI_API_KEY`: API Key for OpenAI.
- `MONGODB_URI`: Connection string for MongoDB (defaults to `mongodb://localhost:27017`).

---

## 🧹 Linting and Formatting

This project enforces strict style conventions using `ruff`:
- **Run linter checks**: `ruff check .`
- **Auto-fix style violations**: `ruff check --fix .`
- **Reformat codebase**: `ruff format .`

---

## 📄 License

Distributed under the MIT License. See [LICENSE](file:///C:/Users/gameg/Documents/antigravity/peaceful-volta/LICENSE) for more information.
