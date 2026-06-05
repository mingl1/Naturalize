import sys

import requests


def test_api():
    base_url = "http://127.0.0.1:8000"

    # 1. Test root endpoint
    print("Testing root endpoint...")
    r = requests.get(f"{base_url}/")
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
    }
    r_gen = requests.post(f"{base_url}/api/generate-parser", json=payload_gen)
    assert r_gen.status_code == 200
    res_gen = r_gen.json()
    print("Generation Success:", res_gen["success"])
    print("Selectors Inferred:", res_gen["selectors"])

    generated_code = res_gen["generated_code"]
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
    r_exec = requests.post(f"{base_url}/api/execute-parser", json=payload_exec)
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
