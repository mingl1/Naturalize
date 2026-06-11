import sys
from unittest.mock import patch
from bson import ObjectId
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_api():
    with patch("database.get_user_by_token") as mock_get_user, \
         patch("database.save_items_to_db") as mock_save, \
         patch.dict("os.environ", {"GEMINI_API_KEY": ""}):
        
        mock_get_user.return_value = {
            "_id": ObjectId("60d5ec49f87c5131f47b2c5d"),
            "username": "test_user",
            "token": "test_token",
            "gemini_api_key": ""
        }
        mock_save.return_value = 2

        headers = {"Authorization": "Bearer test_token"}

        # 1. Test root endpoint
        print("Testing root endpoint...")
        r = client.get("/")
        assert r.status_code == 200
        print("Root response:", r.json())

        # Mock HTML listing snippet
        html_snippet = """
        <div class="product-list">
          <div class="product-card">
            <h2 class="title">Futuristic Mechanical Keyboard</h2>
            <span class="price">$189.99</span>
            <a href="/products/kbd-001" class="buy-btn">View Product</a>
          </div>
          <div class="product-card">
            <h2 class="title">RGB Gaming Mouse</h2>
            <span class="price">$59.50</span>
            <a href="/products/mouse-002" class="buy-btn">View Product</a>
          </div>
        </div>
        """

        # 2a. Test generate-parser missing API key failure
        print("\nTesting /api/generate-parser missing API key...")
        payload_gen = {
            "html_snippet": html_snippet,
            "context_url": "https://example.com/store",
            "user_context": "Extract rating and reviews as custom metadata fields.",
            "webpage_context": {
                "url": "https://example.com/store",
                "title": "Futuristic Electronics Emporium",
                "description": "Buy mechanical keyboards and RGB gaming mice.",
                "keywords": "keyboards, gaming, mouse",
            },
        }
        r_gen_fail = client.post("/api/generate-parser", json=payload_gen, headers=headers)
        assert r_gen_fail.status_code == 200
        res_gen_fail = r_gen_fail.json()
        assert res_gen_fail["success"] is False
        assert "No Gemini API key provided" in res_gen_fail["message"]
        print("Missing API key failure test passed!")

        # 2b. Test generate-parser with mock API key and mocked agent run
        print("\nTesting /api/generate-parser success with mocked agent run...")
        
        # Define mock agent run
        def mock_agent_run(user_id, session_id, new_message):
            from main import generator_runner
            app_name = generator_runner.app_name
            session = generator_runner.session_service.sessions[app_name][user_id][session_id]
            session.state["generated_code"] = """
```json
{
  "item_selector": ".product-card",
  "title_selector": ".title",
  "price_selector": ".price",
  "url_selector": "a"
}
```

```python
import re
from bs4 import BeautifulSoup
from sdk_blueprint import ExtractedCatalogItem, AgenticCatalogSDK

def extract_items(html_content: str, base_url: str = "https://example.com/store") -> list:
    soup = BeautifulSoup(html_content, 'html.parser')
    results = []
    for item in soup.select(".product-card"):
        title_el = item.select_one(".title")
        title = title_el.get_text(strip=True) if title_el else ""
        price_el = item.select_one(".price")
        price = 0.0
        if price_el:
            price_match = re.search(r'\\d+(?:[.,]\\d+)?', price_el.get_text())
            if price_match:
                price = float(price_match.group(0))
        url_el = item.select_one("a")
        source_url = ""
        if url_el and url_el.has_attr('href'):
            from urllib.parse import urljoin
            source_url = urljoin(base_url, url_el['href'])
        
        catalog_item = ExtractedCatalogItem(
            title=title,
            price=price,
            source_url=source_url,
            metadata={}
        )
        results.append(catalog_item.model_dump())
    return results
```
"""
            session.state["parser_generation_result"] = {
                "selectors": {
                    "item_selector": ".product-card",
                    "title_selector": ".title",
                    "price_selector": ".price",
                    "url_selector": "a"
                },
                "code": """
import re
from bs4 import BeautifulSoup
from sdk_blueprint import ExtractedCatalogItem, AgenticCatalogSDK

def extract_items(html_content: str, base_url: str = "https://example.com/store") -> list:
    soup = BeautifulSoup(html_content, 'html.parser')
    results = []
    for item in soup.select(".product-card"):
        title_el = item.select_one(".title")
        title = title_el.get_text(strip=True) if title_el else ""
        price_el = item.select_one(".price")
        price = 0.0
        if price_el:
            price_match = re.search(r'\\d+(?:[.,]\\d+)?', price_el.get_text())
            if price_match:
                price = float(price_match.group(0))
        url_el = item.select_one("a")
        source_url = ""
        if url_el and url_el.has_attr('href'):
            from urllib.parse import urljoin
            source_url = urljoin(base_url, url_el['href'])
        
        catalog_item = ExtractedCatalogItem(
            title=title,
            price=price,
            source_url=source_url,
            metadata={}
        )
        results.append(catalog_item.model_dump())
    return results
"""
            }
            return []

        with patch("main.generator_runner.run", side_effect=mock_agent_run), \
             patch.dict("os.environ", {"GEMINI_API_KEY": "mock-api-key"}):
            r_gen = client.post("/api/generate-parser", json=payload_gen, headers=headers)
            assert r_gen.status_code == 200
            res_gen = r_gen.json()
            print("DEBUG RES_GEN:", res_gen)
            assert res_gen["success"] is True
            assert "Successfully generated and validated parser script" in res_gen["message"]
            assert res_gen["selectors"] == {
                "item_selector": ".product-card",
                "title_selector": ".title",
                "price_selector": ".price",
                "url_selector": "a"
            }
            
            generated_code = res_gen["generated_code"]
            print("Generation Success:", res_gen["success"])
            print("Selectors Inferred:", res_gen["selectors"])
            print("Generated code preview:")
            print("\n".join(generated_code.splitlines()[:15]))
            print("...")

        # 3. Test execute-parser
        print("\nTesting /api/execute-parser...")
        payload_exec = {
            "generated_code": generated_code,
            "full_html": html_snippet,
            "collection_name": "keyboard_listings",
            "unique_key": "title",
        }
        r_exec = client.post("/api/execute-parser", json=payload_exec, headers=headers)
        assert r_exec.status_code == 200
        res_exec = r_exec.json()
        print("Execution Success:", res_exec["success"])
        print("Extracted Items Count:", res_exec["items_count"])
        print("Parsed Items:")
        for item in res_exec["parsed_items"]:
            print(" -", item)

        # Safe printing of logs by stripping emojis/non-ascii
        safe_logs = res_exec["logs"].encode("ascii", errors="replace").decode("ascii")
        print("\nLogs Output (Safe Encoded):")
        print(safe_logs)

        # Basic validations
        assert res_exec["success"] is True
        assert res_exec["items_count"] == 2
        assert res_exec["parsed_items"][0]["title"] == "Futuristic Mechanical Keyboard"
        assert res_exec["parsed_items"][0]["price"] == 189.99
        assert (
            res_exec["parsed_items"][0]["source_url"]
            == "https://example.com/products/kbd-001"
        )

        # 4. Test Collections APIs
        print("\nTesting Collections API routes...")
        with patch("database.create_collection") as mock_create_col, \
             patch("database.rename_collection") as mock_rename_col, \
             patch("database.delete_collection") as mock_delete_col, \
             patch("database.move_item_to_collection") as mock_move_item:
            
            # Test POST /api/collections
            mock_create_col.return_value = True
            r_col_create = client.post("/api/collections", json={"name": "New Cool Collection"}, headers=headers)
            assert r_col_create.status_code == 200
            assert r_col_create.json()["success"] is True
            assert r_col_create.json()["name"] == "New Cool Collection"
            mock_create_col.assert_called_once_with(str(mock_get_user.return_value["_id"]), "New Cool Collection")

            # Test PUT /api/collections/{collection_name}
            mock_rename_col.return_value = True
            r_col_rename = client.put("/api/collections/Old%20Col", json={"new_name": "New Col"}, headers=headers)
            assert r_col_rename.status_code == 200
            assert r_col_rename.json()["success"] is True
            assert r_col_rename.json()["old_name"] == "Old Col"
            assert r_col_rename.json()["new_name"] == "New Col"
            mock_rename_col.assert_called_once_with(str(mock_get_user.return_value["_id"]), "Old Col", "New Col")

            # Test DELETE /api/collections/{collection_name}
            mock_delete_col.return_value = True
            r_col_delete = client.delete("/api/collections/Delete%20Me", headers=headers)
            assert r_col_delete.status_code == 200
            assert r_col_delete.json()["success"] is True
            mock_delete_col.assert_called_once_with(str(mock_get_user.return_value["_id"]), "Delete Me")

            # Test PUT /api/items/{item_id}/collection
            mock_move_item.return_value = True
            item_id = "60d5ec49f87c5131f47b2c5e"
            r_item_move = client.put(f"/api/items/{item_id}/collection", json={"collection_name": "Target Col"}, headers=headers)
            assert r_item_move.status_code == 200
            assert r_item_move.json()["success"] is True
            mock_move_item.assert_called_once_with(str(mock_get_user.return_value["_id"]), item_id, "Target Col")
            
        print("Collections API routes test passed!")

        print("\n[SUCCESS] Backend verification passed successfully!")


if __name__ == "__main__":
    try:
        test_api()
    except Exception as e:
        # Safe print error
        safe_err = str(e).encode("ascii", errors="replace").decode("ascii")
        print(f"[FAIL] Verification failed: {safe_err}")
        sys.exit(1)

