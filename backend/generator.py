import os
import re
from typing import Dict, Tuple

import google.generativeai as genai
from bs4 import BeautifulSoup
from openai import OpenAI

# System instructions to enforce the code generation standard
SYSTEM_INSTRUCTIONS = """
You are a code generation agent specialized in web scraping and the "Scrape-as-Code" paradigm.
Your goal is to parse an HTML snippet representing a list or grid container, identify the structural selectors, and generate a sandboxed Python script utilizing BeautifulSoup to extract data items.

The generated script MUST conform to the sdk_blueprint.py interface:

```python
from pydantic import BaseModel, Field
from typing import List, Dict, Any

class ExtractedCatalogItem(BaseModel):
    title: str = Field(description="Clean text header of the listing")
    price: float = Field(description="Normalized numerical price value")
    source_url: str = Field(description="Fully qualified destination link")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary layout key-values discovered")
```

Your response should contain:
1. Inferred CSS selectors as a JSON block.
2. A complete, runnable Python code block that imports ExtractedCatalogItem and AgenticCatalogSDK, defines an extraction function, and calls bulk_upsert.
"""


def generate_parser_code(
    html_snippet: str, context_url: str = None
) -> Tuple[bool, str, Dict[str, str], str]:
    """
    Tries to generate the parsing code using LLM (Gemini or OpenAI).
    Falls back to a smart heuristic engine if no API keys are present.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if gemini_key:
        return _generate_with_gemini(gemini_key, html_snippet, context_url)
    elif openai_key:
        return _generate_with_openai(openai_key, html_snippet, context_url)
    else:
        return _generate_with_heuristics(html_snippet, context_url)


def _generate_with_gemini(
    api_key: str, html_snippet: str, context_url: str = None
) -> Tuple[bool, str, Dict[str, str], str]:
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = f"""
        {SYSTEM_INSTRUCTIONS}

        Target HTML Snippet:
        ```html
        {html_snippet}
        ```

        Context Source URL: {context_url or "Unknown"}

        Please return the selectors and Python script. Write the code in a single ```python code block.
        """

        response = model.generate_content(prompt)
        text = response.text

        # Extract selectors and code
        selectors = _infer_selectors_from_text(text)
        code = _extract_code_block(text, "python")

        if not code:
            return False, "", {}, "LLM response did not contain a python code block."

        return (
            True,
            code,
            selectors,
            "Successfully generated parser script using Gemini API.",
        )
    except Exception as e:
        return False, "", {}, f"Error generating with Gemini: {str(e)}"


def _generate_with_openai(
    api_key: str, html_snippet: str, context_url: str = None
) -> Tuple[bool, str, Dict[str, str], str]:
    try:
        client = OpenAI(api_key=api_key)

        prompt = f"""
        Target HTML Snippet:
        ```html
        {html_snippet}
        ```

        Context Source URL: {context_url or "Unknown"}
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_INSTRUCTIONS},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )

        text = response.choices[0].message.content
        selectors = _infer_selectors_from_text(text)
        code = _extract_code_block(text, "python")

        if not code:
            return False, "", {}, "LLM response did not contain a python code block."

        return (
            True,
            code,
            selectors,
            "Successfully generated parser script using OpenAI API.",
        )
    except Exception as e:
        return False, "", {}, f"Error generating with OpenAI: {str(e)}"


def _generate_with_heuristics(
    html_snippet: str, context_url: str = None
) -> Tuple[bool, str, Dict[str, str], str]:
    """
    Fallback Heuristic Parsing Engine. Analyzes the HTML snippet locally
    and generates a complete BeautifulSoup Python script.
    """
    soup = BeautifulSoup(html_snippet, "html.parser")

    # Try to identify potential list item elements
    # Common element layouts: .item, .card, .product, tr, li, article
    item_selector = ""
    candidates = [
        "article",
        "li",
        "tr",
        "[class*='item']",
        "[class*='card']",
        "[class*='product']",
        "[class*='post']",
        "[class*='listing']",
        "div > div",
    ]

    for cand in candidates:
        elements = soup.select(cand)
        if len(elements) > 1:
            item_selector = cand
            break
    if not item_selector:
        # Default fallback selector
        item_selector = "div"

    # Refine selectors based on tag search
    selectors = {
        "item_selector": item_selector,
        "title_selector": "h2, a" if soup.find("h2") else "a",
        "price_selector": ".price" if soup.select(".price") else "span",
        "url_selector": "a",
    }

    # Normalize url context code
    base_url_code = ""
    if context_url:
        from urllib.parse import urlparse

        parsed = urlparse(context_url)
        base_url_code = f"'{parsed.scheme}://{parsed.netloc}'"
    else:
        base_url_code = "''"

    # Generate complete python script conforming to blueprint
    generated_code = f"""# Generated BeautifulSoup Parser conforming to sdk_blueprint.py
import re
import sys
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from sdk_blueprint import ExtractedCatalogItem, AgenticCatalogSDK

def extract_items(html_content: str, base_url: str = {base_url_code}) -> list:
    soup = BeautifulSoup(html_content, 'html.parser')
    results = []

    # Locate listing items matching the container loop
    items = soup.select("{selectors["item_selector"]}")
    print(f"[Parser] Found {{len(items)}} candidates using selector '{selectors["item_selector"]}'")

    for item in items:
        try:
            # 1. Extract Title
            title = ""
            title_el = item.select_one("{selectors["title_selector"]}")
            if title_el:
                title = title_el.get_text(strip=True)
            if not title:
                title = item.get_text(strip=True)[:60] # Fallback to first text characters

            if not title:
                continue

            # 2. Extract Price
            price = 0.0
            price_text = ""
            price_el = item.select_one("{selectors["price_selector"]}")
            if price_el:
                price_text = price_el.get_text(strip=True)
            else:
                price_text = item.get_text(strip=True)

            # Regex to match price pattern (e.g. $19.99, 1500, 20.0)
            price_match = re.search(r'\\d+(?:[.,]\\d+)?', price_text)
            if price_match:
                price = float(price_match.group(0).replace(',', '.'))

            # 3. Extract URL
            source_url = ""
            url_el = item.select_one("{selectors["url_selector"]}")
            if url_el and url_el.has_attr('href'):
                source_url = urljoin(base_url, url_el['href'])
            else:
                # Search all anchors
                anchors = item.find_all('a', href=True)
                if anchors:
                    source_url = urljoin(base_url, anchors[0]['href'])

            # 4. Extract metadata context
            metadata = {{
                "extracted_title_raw": title_el.get_text(strip=True) if title_el else "",
                "extracted_price_raw": price_text
            }}

            catalog_item = ExtractedCatalogItem(
                title=title,
                price=price,
                source_url=source_url,
                metadata=metadata
            )
            results.append(catalog_item.model_dump())
        except Exception as e:
            print(f"[Warning] Failed parsing item node: {{e}}")
            continue

    return results

if __name__ == "__main__":
    # If run standalone, read from file argument
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            html = f.read()
    else:
        html = sys.stdin.read()

    extracted = extract_items(html)
    sdk = AgenticCatalogSDK()
    sdk.bulk_upsert("catalog_items", extracted, "title")
    print(f"[Parser Run] Successfully processed {{len(extracted)}} items.")
"""

    return (
        True,
        generated_code,
        selectors,
        "Generated parser using local structural heuristics (mock mode - configure API keys for LLM).",
    )


def _extract_code_block(text: str, language: str) -> str:
    pattern = rf"```(?:{language})?\n(.*?)\n```"
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return text.strip()


def _infer_selectors_from_text(text: str) -> Dict[str, str]:
    # Look for a json block in the text
    json_block = _extract_code_block(text, "json")
    if json_block:
        import json

        try:
            return json.loads(json_block)
        except Exception:
            pass
    # Basic regex lookups for selectors
    selectors = {}
    for key in ["item_selector", "title_selector", "price_selector", "url_selector"]:
        match = re.search(rf'"{key}"\s*:\s*"([^"]+)"', text)
        if match:
            selectors[key] = match.group(1)

    # Default fallback keys
    if not selectors:
        selectors = {
            "item_selector": ".item",
            "title_selector": "h3",
            "price_selector": ".price",
            "url_selector": "a",
        }
    return selectors
