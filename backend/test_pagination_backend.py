import sys
import requests

def test_pagination_api():
    base_url = "http://127.0.0.1:8000"

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
    r_gen = requests.post(f"{base_url}/api/generate-parser", json=payload_gen)
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
    r_exec = requests.post(f"{base_url}/api/execute-parser", json=payload_exec)
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
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
