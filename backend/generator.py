import os
import re
from typing import Any, Dict, Tuple

from google import genai
from bs4 import BeautifulSoup
from openai import OpenAI

# System instructions to enforce the code generation standard
SYSTEM_INSTRUCTIONS = """
You are a code generation agent specialized in web scraping and the "Scrape-as-Code" paradigm.
Your goal is to parse HTML representation of page listings, grids, or tables and generate a highly robust, sandboxed Python script utilizing BeautifulSoup to extract data items.

### Design Pattern Guidelines for the Generated Script:
1. **Container-Relative Parsing (CRITICAL)**:
   - Do NOT extract individual fields using global selectors (e.g. `soup.find()` or `soup.select()`) directly on the main page DOM. This merges unrelated listings together or limits extraction to the first item.
   - Always locate the repeating wrapper/card container elements (e.g., `li`, `tr`, `div.product-card`, `div.match-item`, etc.) representing each item.
   - Loop over these container elements.
   - For each field (title, price, source_url, metadata), extract it RELATIVE to the item container element (e.g. use `container.find()` or `container.select_one()` instead of `soup.find()`).
   - If the HTML represents a single item detail page or no repeating containers are found, treat the root container as the single item element to maintain the relative parsing logic.

2. **Clean & Safe Field Extraction**:
   - **Title**: Extract the main title text from the appropriate sub-element, fallback to parent text or first characters if not found. Clean all whitespace.
   - **Price**: Find the price sub-element, extract its text, and normalize it to a `float`. Use regex to strip currency symbols, commas, and other non-numeric characters (e.g., "$1,249.99" -> `1249.99`). Fallback to `0.0` if missing or invalid.
   - **Source URL**: Find target link anchors, extract the `href` attribute, and resolve relative paths to fully qualified absolute URLs using `urllib.parse.urljoin(base_url, href)`.
   - **Metadata**: Collect any additional or custom requested fields (e.g., rating, stock, category, date, kills, level, badges) inside the `metadata` dictionary.

3. **Per-Item Error Handling**:
   - Wrap each item's extraction loop body in a `try/except` block to ensure that a single malformed or missing element in one listing does not crash the entire scraping process.

The generated script MUST conform to the sdk_blueprint.py interface:

```python
from pydantic import BaseModel, Field
from typing import List, Dict, Any

class ExtractedCatalogItem(BaseModel):
    title: str = Field(description="Clean text header of the listing")
    price: float = Field(description="Normalized numerical price value")
    source_url: str = Field(description="Fully qualified destination link")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary layout key-values discovered")

class AgenticCatalogSDK:
    def bulk_upsert(self, collection_name: str, data: List[Dict[str, Any]], unique_key: str) -> bool:
        \"\"\"Executes a high-performance database sync payload via the system wrapper.\"\"\"
        pass
```

Your response should contain:
1. Inferred CSS selectors as a JSON block.
2. A complete, runnable Python code block that:
   - Imports ExtractedCatalogItem and AgenticCatalogSDK from sdk_blueprint.
   - Defines the exact extraction function: `def extract_items(html_content: str, base_url: str = "<default_url>") -> List[Dict[str, Any]]:` where you replace `<default_url>` with the provided Context Source URL (if one is provided), otherwise `""`. This parses the HTML document and returns a list of dictionaries conforming to ExtractedCatalogItem model properties.
   - Uses `urllib.parse.urljoin(base_url, href)` to resolve absolute URLs.
   - Calls bulk_upsert.
   - Ensures all Python type annotations are native and in lowercase (specifically use `str` instead of `String` or `string`, `float` instead of `Double` or `number`, and `bool` instead of `Boolean`).
   - Maps any user-specified custom fields/instructions (such as rating, stock, category, location, etc.) into the `metadata` dictionary of the returned items.
"""


def _clean_python_code(code: str) -> str:
    # Correct common LLM type-hint typos in generated Python code (e.g. ": String" -> ": str")
    code = re.sub(r"(:\s*)String\b", r"\1str", code)
    code = re.sub(r"\[\s*String\s*\]", r"[str]", code)
    code = re.sub(r"(:\s*)Double\b", r"\1float", code)
    code = re.sub(r"\[\s*Double\s*\]", r"[float]", code)
    code = re.sub(r"(:\s*)Boolean\b", r"\1bool", code)
    code = re.sub(r"\[\s*Boolean\s*\]", r"[bool]", code)
    return code


def generate_parser_code(
    html_snippet: str,
    context_url: str = None,
    user_context: str = None,
    webpage_context: Dict[str, Any] = None,
) -> Tuple[bool, str, Dict[str, str], str]:
    """
    Tries to generate the parsing code using LLM (Gemini or OpenAI).
    Falls back to a smart heuristic engine if no API keys are present.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if gemini_key:
        success, code, selectors, message = _generate_with_gemini(
            gemini_key, html_snippet, context_url, user_context, webpage_context
        )
    elif openai_key:
        success, code, selectors, message = _generate_with_openai(
            openai_key, html_snippet, context_url, user_context, webpage_context
        )
    else:
        success, code, selectors, message = _generate_with_heuristics(
            html_snippet, context_url, user_context, webpage_context
        )

    if success and code:
        code = _clean_python_code(code)

    return success, code, selectors, message


def _generate_with_gemini(
    api_key: str,
    html_snippet: str,
    context_url: str = None,
    user_context: str = None,
    webpage_context: Dict[str, Any] = None,
) -> Tuple[bool, str, Dict[str, str], str]:
    try:
        client = genai.Client(api_key=api_key)

        prompt_parts = [
            SYSTEM_INSTRUCTIONS,
            "\nTarget HTML Snippet:",
            "```html",
            html_snippet,
            "```",
            f"\nContext Source URL: {context_url or 'Unknown'}",
        ]

        if webpage_context:
            prompt_parts.append("\nWebpage Metadata Context:")
            if "url" in webpage_context and webpage_context["url"]:
                prompt_parts.append(f"- URL: {webpage_context['url']}")
            if "title" in webpage_context and webpage_context["title"]:
                prompt_parts.append(f"- Title: {webpage_context['title']}")
            if "description" in webpage_context and webpage_context["description"]:
                prompt_parts.append(f"- Description: {webpage_context['description']}")
            if "keywords" in webpage_context and webpage_context["keywords"]:
                prompt_parts.append(f"- Keywords: {webpage_context['keywords']}")

        if user_context:
            prompt_parts.append("\nUser Parsing Guidelines / Instructions / NL Query:")
            prompt_parts.append(user_context)
            prompt_parts.append(
                "\nIMPORTANT: Prioritize any fields specified in the User Parsing Guidelines. "
                "The BeautifulSoup parser script MUST extract the standard ExtractedCatalogItem fields (title, price, source_url) "
                "and any other requested custom fields. ALL custom fields MUST be populated inside the `metadata` dictionary "
                "of the ExtractedCatalogItem model so that the schema validation succeeds."
            )

        prompt_parts.append(
            "\nPlease return the selectors and Python script. Write the code in a single ```python code block."
        )
        prompt = "\n".join(prompt_parts)

        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
        )
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
    api_key: str,
    html_snippet: str,
    context_url: str = None,
    user_context: str = None,
    webpage_context: Dict[str, Any] = None,
) -> Tuple[bool, str, Dict[str, str], str]:
    try:
        client = OpenAI(api_key=api_key)

        prompt_parts = [
            "\nTarget HTML Snippet:",
            "```html",
            html_snippet,
            "```",
            f"\nContext Source URL: {context_url or 'Unknown'}",
        ]

        if webpage_context:
            prompt_parts.append("\nWebpage Metadata Context:")
            if "url" in webpage_context and webpage_context["url"]:
                prompt_parts.append(f"- URL: {webpage_context['url']}")
            if "title" in webpage_context and webpage_context["title"]:
                prompt_parts.append(f"- Title: {webpage_context['title']}")
            if "description" in webpage_context and webpage_context["description"]:
                prompt_parts.append(f"- Description: {webpage_context['description']}")
            if "keywords" in webpage_context and webpage_context["keywords"]:
                prompt_parts.append(f"- Keywords: {webpage_context['keywords']}")

        if user_context:
            prompt_parts.append("\nUser Parsing Guidelines / Instructions / NL Query:")
            prompt_parts.append(user_context)
            prompt_parts.append(
                "\nIMPORTANT: Prioritize any fields specified in the User Parsing Guidelines. "
                "The BeautifulSoup parser script MUST extract the standard ExtractedCatalogItem fields (title, price, source_url) "
                "and any other requested custom fields. ALL custom fields MUST be populated inside the `metadata` dictionary "
                "of the ExtractedCatalogItem model so that the schema validation succeeds."
            )

        prompt = "\n".join(prompt_parts)

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
    html_snippet: str,
    context_url: str = None,
    user_context: str = None,
    webpage_context: Dict[str, Any] = None,
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
    user_context_comment = (
        f"# User Context/Guidelines: {user_context}\n" if user_context else ""
    )
    webpage_context_comment = (
        f"# Webpage Context: {webpage_context}\n" if webpage_context else ""
    )
    generated_code = f"""# Generated BeautifulSoup Parser conforming to sdk_blueprint.py
{user_context_comment}{webpage_context_comment}import re
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
    # 1. First try to find a block explicitly labeled with the language name (e.g., ```python)
    pattern = rf"```(?:{language})\b"
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        start_idx = match.end()
        # Find the next ``` after the start of this block
        end_idx = text.find("```", start_idx)
        if end_idx != -1:
            code = text[start_idx:end_idx]
        else:
            code = text[start_idx:]
        return code.strip()

    # 2. Try to find any block starting with just ```
    parts = text.split("```")
    if len(parts) >= 3:
        # Text between first and second ```
        code = parts[1]
        # If code starts with a word (e.g. 'py\n' or 'python\n'), strip that word
        code_clean = re.sub(r"^[a-zA-Z0-9+_#-]+\s*\n", "", code)
        return code_clean.strip()
    elif len(parts) == 2:
        # Truncated block
        code = parts[1]
        code_clean = re.sub(r"^[a-zA-Z0-9+_#-]+\s*\n", "", code)
        return code_clean.strip()

    return text.strip()


def _infer_selectors_from_text(text: str) -> Dict[str, Any]:
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
