# Antigravity Scrape-as-Code Engine

A lightweight visual asset collection tool and scraping generator. The engine bypasses monolithic LLM parsing in favor of generated programmatic primitives, allowing you to visually identify target layout containers and compile them into sandboxed, standalone Python extraction scripts.

---

## 🏗️ Architecture Overview

The system consists of two primary components:
1. **Front-End UX (`/extension`)**: A Manifest V3 Chrome Extension that monitors DOM hovers and lets you visual identify item listings.
2. **Control Plane (`/backend`)**: A FastAPI service that takes stripped HTML snippets, infers structural CSS selectors, and outputs runnable Python scripts conforming to our Core SDK specification.

---

## 📂 Repository Layout

```text
├── extension/             # Chrome Extension (Manifest V3)
│   ├── manifest.json      # Extension manifest metadata
│   ├── content.js         # Hover element highlight script
│   ├── popup.html         # Tailwind CSS glassmorphic popup panel
│   └── popup.js           # Extension controller logic
├── backend/               # FastAPI Backend Service
│   ├── main.py            # API Entrypoint (Generate & Execute endpoints)
│   ├── generator.py       # Selector inference generator (LLM & Heuristics)
│   ├── schemas.py         # Request and Response schemas
│   ├── sdk_blueprint.py   # Core ExtractedCatalogItem SDK schema
│   ├── requirements.txt   # Python dependency list
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

### 2. Chrome Extension Installation

1. Open a Chromium-based browser (Chrome, Edge, Brave).
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** in the top-left.
5. Select the `/extension` directory from this repository.

---

## ⚙️ Configuration (.env)

The generator can leverage LLMs for high-fidelity selector generation. Set at least one API key in `/backend/.env` (based on the template in [.env.example](file:///C:/Users/gameg/Documents/antigravity/peaceful-volta/.env.example)):
- `GEMINI_API_KEY`: API Key for Google Gemini.
- `OPENAI_API_KEY`: API Key for OpenAI.

*If no keys are configured, the backend automatically falls back to local HTML parsing heuristics.*

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
