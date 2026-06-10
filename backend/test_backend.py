import sys
from unittest.mock import patch
from bson import ObjectId
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_api():
    with patch("database.get_user_by_token") as mock_get_user, \
         patch("database.save_items_to_db") as mock_save:
        
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

        # 2. Test generate-parser
        print("\nTesting /api/generate-parser...")
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
        r_gen = client.post("/api/generate-parser", json=payload_gen, headers=headers)
        assert r_gen.status_code == 200
        res_gen = r_gen.json()
        print("Generation Success:", res_gen["success"])
        print("Selectors Inferred:", res_gen["selectors"])

        generated_code = res_gen["generated_code"]
        print("Generated code preview:")
        print("\n".join(generated_code.splitlines()[:15]))
        print("...")

        # If heuristics/mock mode is active, check if comments are present
        if (
            "Generated BeautifulSoup Parser conforming to sdk_blueprint.py"
            in generated_code
        ):
            assert (
                "# User Context/Guidelines: Extract rating and reviews as custom metadata fields."
                in generated_code
            )
            assert "# Webpage Context: " in generated_code
            print(
                "Heuristics verification: user_context and webpage_context comments found in generated code!"
            )

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

        print("\n[SUCCESS] Backend verification passed successfully!")


if __name__ == "__main__":
    try:
        test_api()
    except Exception as e:
        # Safe print error
        safe_err = str(e).encode("ascii", errors="replace").decode("ascii")
        print(f"[FAIL] Verification failed: {safe_err}")
        sys.exit(1)

