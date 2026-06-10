import sys
from unittest.mock import patch
from bson import ObjectId
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_pagination_api():
    with patch("database.get_user_by_token") as mock_get_user, \
         patch("database.save_items_to_db") as mock_save:
        
        mock_get_user.return_value = {
            "_id": ObjectId("60d5ec49f87c5131f47b2c5d"),
            "username": "test_user",
            "token": "test_token",
            "gemini_api_key": ""
        }
        mock_save.return_value = 4

        headers = {"Authorization": "Bearer test_token"}

        # Mock HTML listings from page 1 and page 2
        html_page_1 = """
        <div class="product-list">
          <div class="product-card">
            <h2 class="title">Item 1 Page 1</h2>
            <span class="price">$10.00</span>
            <a href="/item1" class="buy-btn">View</a>
          </div>
          <div class="product-card">
            <h2 class="title">Item 2 Page 1</h2>
            <span class="price">$15.00</span>
            <a href="/item2" class="buy-btn">View</a>
          </div>
        </div>
        """

        html_page_2 = """
        <div class="product-list">
          <div class="product-card">
            <h2 class="title">Item 3 Page 2</h2>
            <span class="price">$20.00</span>
            <a href="/item3" class="buy-btn">View</a>
          </div>
          <div class="product-card">
            <h2 class="title">Item 4 Page 2</h2>
            <span class="price">$25.00</span>
            <a href="/item4" class="buy-btn">View</a>
          </div>
        </div>
        """

        # Generate a parser first using one of the snippets
        print("Testing parser generation...")
        payload_gen = {
            "html_snippet": html_page_1,
            "context_url": "https://example.com/store",
        }
        r_gen = client.post("/api/generate-parser", json=payload_gen, headers=headers)
        assert r_gen.status_code == 200
        res_gen = r_gen.json()
        print("res_gen:", res_gen)
        assert res_gen["success"] is True
        generated_code = res_gen["generated_code"]

        # Test /api/execute-parser with a list of HTMLs (full_htmls)
        print("Testing /api/execute-parser with multi-page HTMLs...")
        payload_exec = {
            "generated_code": generated_code,
            "full_htmls": [html_page_1, html_page_2],
            "collection_name": "paginated_items",
            "unique_key": "title",
        }
        r_exec = client.post("/api/execute-parser", json=payload_exec, headers=headers)
        assert r_exec.status_code == 200
        res_exec = r_exec.json()
        print("Execution Success:", res_exec["success"])
        print("Extracted Items Count:", res_exec["items_count"])
        for item in res_exec["parsed_items"]:
            print(" -", item)

        assert res_exec["success"] is True
        assert res_exec["items_count"] == 4
        titles = [item["title"] for item in res_exec["parsed_items"]]
        assert "Item 1 Page 1" in titles
        assert "Item 3 Page 2" in titles
        print("[SUCCESS] Backend pagination execution test passed!")


if __name__ == "__main__":
    try:
        test_pagination_api()
    except Exception:
        import traceback

        traceback.print_exc()
        sys.exit(1)

