# MISSION SPECIFICATION: Browser Extension & Scrape-as-Code Engine

## 1. System Identity & Constraints
- **Target Architecture:** Chrome Extension (Manifest V3 Front-End) paired with a FastAPI/Python backend execution environment.
- **Agent Autonomy Policy:** `Agent Decides` for file modifications; `Request Review` for any outbound third-party web service requests or execution of raw Javascript blocks inside the browser tool wrapper.
- **Allowed Tech Stack:** Native Browser APIs, TailwindCSS via CDN (for extension popup styling), Python 3.11+, BeautifulSoup4, Parsel, and PyDantic V2.

## 2. Core Project Objectives (The Scrape-as-Code Paradigm)
Your ultimate goal is to build an asset collection agent that bypasses monolithic LLM parsing in favor of generated programmatic primitives. The user flow must execute as follows:
1. **Front-End UX (Extension Content Script):** Monitor clicks on a page element. On click, freeze standard execution and spawn a tactile sliding UI overlay that allows the user to adjust the hierarchical depth tree of the clicked node's parent containers.
2. **Structural Stripping:** Once a parent container bounding box is confirmed by the user, the content script captures *only* that single container's stripped innerHTML node snippet (removing script tags, trailing base64 images, and svgs) and shoots it to the backend.
3. **The Control Plane (Backend Orchestration):** Accept the atomic HTML snippet. Use an LLM reasoning turn to infer structural CSS selectors, then programmatically generate a standalone, sandboxed Python extraction script utilizing BeautifulSoup to target those loops over a full web document.
4. **Data Sink:** Expose an integration path where the generated extraction scripts execute a `bulkWrite` layout against an external database layer.

## 3. Sandboxed Core SDK Specification
You are provided with a minimal Agentic Catalog SDK signature template. When generating parsing code, you must strictly bind execution logic to this schema layout:

```python
# sdk_blueprint.py (Reference Interface)
from pydantic import BaseModel, Field
from typing import List, Dict, Any

class ExtractedCatalogItem(BaseModel):
    title: str = Field(description="Clean text header of the listing")
    price: float = Field(description="Normalized numerical price value")
    source_url: str = Field(description="Fully qualified destination link")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary layout key-values discovered")

class AgenticCatalogSDK:
    def bulk_upsert(self, collection_name: str, data: List[Dict[str, Any]], unique_key: str) -> bool:
        """Executes a high-performance database sync payload via the system wrapper."""
        pass
```

## 4. Immediate Initial Task Order (Phase 1 Scaffold)

Before writing any complex backend generation patterns, execute the following implementation step:

1. Scaffold an empty project repository containing a valid, detectable open-source license file (MIT) visible in the root workspace.
2. Build a functioning Chrome Extension boilerplate folder (`/extension`) containing a verified `manifest.json` (V3) and an active `content.js` script capable of intercepting mouse hovers on a page.
3. Present your generated Implementation Plan and Code Diffs for my review before triggering a local test compilation loop.
