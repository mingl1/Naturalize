# Antigravity Scrape-as-Code Engine (Naturalize)

A lightweight visual asset collection tool and scraping generator. The engine bypasses monolithic LLM parsing in favor of generated programmatic primitives, allowing you to visually identify target layout containers and compile them into sandboxed, standalone Python extraction scripts.

---

## 🏗️ Architecture Overview

The system consists of two primary components:

1. **Front-End UX (`/extension`)**: A Manifest V3 Chrome Extension that monitors DOM hovers and lets you visual identify item listings.
2. **Control Plane (`/backend`)**: A FastAPI service that takes stripped HTML snippets, infers structural CSS selectors, and outputs runnable Python scripts conforming to our Core SDK specification.

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

The generator can leverage LLMs for high-fidelity selector generation. Set at least one API key in `/backend/.env` (based on the template in [.env.example](file:///C:/Users/gameg/Documents/antigravity/peaceful-volta/.env.example)):

- `GEMINI_API_KEY`: API Key for Google Gemini.

_If no keys are configured, the backend automatically falls back to local HTML parsing heuristics._

---

## 🧹 Linting and Formatting

This project enforces strict style conventions using `ruff`:

- **Run linter checks**:
  ```bash
  ruff check .
  ```
- **Auto-fix style violations**:
  ```bash
  ruff check --fix .
  ```
- **Reformat codebase**:
  ```bash
  ruff format .
  ```

---

## 📄 License

Distributed under the MIT License. See [LICENSE](file:///C:/Users/gameg/Documents/antigravity/peaceful-volta/LICENSE) for more information.
