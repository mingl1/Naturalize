import sys
from unittest.mock import patch
from bson import ObjectId
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_sandbox_fallback():
    with patch("database.get_user_by_token") as mock_get_user, \
         patch("database.save_items_to_db") as mock_save:
        
        mock_get_user.return_value = {
            "_id": ObjectId("60d5ec49f87c5131f47b2c5d"),
            "username": "test_user",
            "token": "test_token",
            "gemini_api_key": ""
        }
        mock_save.return_value = 1

        headers = {"Authorization": "Bearer test_token"}

        # Generated code has no AgenticCatalogSDK import or class!
        code_without_sdk = """
def extract_items(html_content: str, base_url: str = "") -> list:
    return [{
        "title": "Minimal Title",
        "price": 10.0,
        "source_url": "https://example.com/item",
        "metadata": {}
    }]
"""

        payload_exec = {
            "generated_code": code_without_sdk,
            "full_html": "<div>Minimal</div>",
            "collection_name": "fallback_items",
            "unique_key": "title",
        }
        
        r_exec = client.post("/api/execute-parser", json=payload_exec, headers=headers)
        assert r_exec.status_code == 200
        res_exec = r_exec.json()
        
        assert res_exec["success"] is True
        assert res_exec["items_count"] == 1
        assert res_exec["parsed_items"][0]["title"] == "Minimal Title"
        assert "Using system fallback SDK class" in res_exec["logs"]
        
        # Verify save_items_to_db was indeed called
        mock_save.assert_called_once()
        print("Sandbox fallback test passed successfully!")


def test_save_items_to_db_falsy_key():
    from unittest.mock import MagicMock
    import database
    from bson import ObjectId

    # Mock DB client and collections
    mock_db = MagicMock()
    mock_items_col = MagicMock()
    mock_db.items = mock_items_col

    with patch("database._get_db", return_value=mock_db):
        user_id = ObjectId("60d5ec49f87c5131f47b2c5d")
        
        # Test items where unique key "source_url" is empty string or missing
        items = [
            {"title": "Item 1", "price": 10.0, "source_url": ""},
            {"title": "Item 2", "price": 20.0, "source_url": ""},
        ]
        
        saved = database.save_items_to_db(
            user_id=user_id,
            collection_name="test_col",
            items=items,
            unique_key="source_url"
        )
        
        assert saved == 2
        # Verify update_one was called twice
        assert mock_items_col.update_one.call_count == 2
        
        # Check first call arguments: filter should contain user_id, collection_name, and a random _id
        first_call_args = mock_items_col.update_one.call_args_list[0]
        filter_doc = first_call_args[0][0]
        
        assert filter_doc["user_id"] == user_id
        assert filter_doc["collection_name"] == "test_col"
        assert "_id" in filter_doc
        assert isinstance(filter_doc["_id"], ObjectId)
        assert "source_url" not in filter_doc
        
        # Check second call arguments: filter should also contain a different _id
        second_call_args = mock_items_col.update_one.call_args_list[1]
        second_filter_doc = second_call_args[0][0]
        
        assert second_filter_doc["_id"] != filter_doc["_id"]


def test_save_items_to_db_duplicate_batch_keys():
    from unittest.mock import MagicMock
    import database
    from bson import ObjectId

    # Mock DB client and collections
    mock_db = MagicMock()
    mock_items_col = MagicMock()
    mock_db.items = mock_items_col

    with patch("database._get_db", return_value=mock_db):
        user_id = ObjectId("60d5ec49f87c5131f47b2c5d")
        
        # Test items where the unique key is "title", and they have duplicate titles
        items = [
            {"title": "Jinx - Victory", "price": 0.0, "source_url": "https://example.com/match1"},
            {"title": "Jinx - Victory", "price": 0.0, "source_url": "https://example.com/match2"},
            {"title": "Rakan - Victory", "price": 0.0, "source_url": "https://example.com/match3"},
        ]
        
        saved = database.save_items_to_db(
            user_id=user_id,
            collection_name="test_col",
            items=items,
            unique_key="title"
        )
        
        assert saved == 3
        # Verify update_one was called 3 times
        assert mock_items_col.update_one.call_count == 3
        
        # Call 1: should upsert normally based on title since it's the first occurrence
        call1_args = mock_items_col.update_one.call_args_list[0]
        filter_doc1 = call1_args[0][0]
        assert filter_doc1["title"] == "Jinx - Victory"
        assert "_id" not in filter_doc1
        
        # Call 2: duplicate "Jinx - Victory" in current batch, should force insert by using _id
        call2_args = mock_items_col.update_one.call_args_list[1]
        filter_doc2 = call2_args[0][0]
        assert "title" not in filter_doc2
        assert "_id" in filter_doc2
        assert isinstance(filter_doc2["_id"], ObjectId)
        
        # Call 3: first occurrence of "Rakan - Victory" in current batch, should upsert normally
        call3_args = mock_items_col.update_one.call_args_list[2]
        filter_doc3 = call3_args[0][0]
        assert filter_doc3["title"] == "Rakan - Victory"
        assert "_id" not in filter_doc3


def test_save_items_to_db_compound_keys():
    from unittest.mock import MagicMock
    import database
    from bson import ObjectId

    # Mock DB client and collections
    mock_db = MagicMock()
    mock_items_col = MagicMock()
    mock_db.items = mock_items_col

    with patch("database._get_db", return_value=mock_db):
        user_id = ObjectId("60d5ec49f87c5131f47b2c5d")
        
        # Test items with compound unique keys "title" and "metadata.duration"
        items = [
            {"title": "Jinx - Victory", "price": 0.0, "source_url": "https://example.com/m1", "metadata": {"duration": "30m"}},
            {"title": "Jinx - Victory", "price": 0.0, "source_url": "https://example.com/m2", "metadata": {"duration": "35m"}},
            {"title": "Jinx - Victory", "price": 0.0, "source_url": "https://example.com/m3", "metadata": {"duration": "30m"}}, # duplicate compound key in same batch
        ]
        
        saved = database.save_items_to_db(
            user_id=user_id,
            collection_name="test_col",
            items=items,
            unique_keys=["title", "metadata.duration"]
        )
        
        assert saved == 3
        assert mock_items_col.update_one.call_count == 3
        
        # Call 1: upsert normally based on title and metadata.duration
        call1_args = mock_items_col.update_one.call_args_list[0]
        filter_doc1 = call1_args[0][0]
        assert filter_doc1["title"] == "Jinx - Victory"
        assert filter_doc1["metadata.duration"] == "30m"
        assert "_id" not in filter_doc1
        
        # Call 2: title is same, but duration is different (35m) -> upsert normally since compound key combination is unique so far
        call2_args = mock_items_col.update_one.call_args_list[1]
        filter_doc2 = call2_args[0][0]
        assert filter_doc2["title"] == "Jinx - Victory"
        assert filter_doc2["metadata.duration"] == "35m"
        assert "_id" not in filter_doc2
        
        # Call 3: duplicate of compound combination (Jinx - Victory + 30m) -> force insert by _id
        call3_args = mock_items_col.update_one.call_args_list[2]
        filter_doc3 = call3_args[0][0]
        assert "title" not in filter_doc3
        assert "metadata.duration" not in filter_doc3
        assert "_id" in filter_doc3
        assert isinstance(filter_doc3["_id"], ObjectId)


def test_save_items_schema_alignment():
    from unittest.mock import MagicMock
    import database
    from bson import ObjectId

    # Mock DB client and collections
    mock_db = MagicMock()
    mock_items_col = MagicMock()
    mock_db.items = mock_items_col

    # Set up some existing documents that find() will return to simulate database state
    existing_docs = [
        {"user_id": ObjectId("60d5ec49f87c5131f47b2c5d"), "collection_name": "test_col", "title": "Old Item", "price": None, "source_url": None, "metadata": {"old_key": "old_val"}}
    ]
    mock_items_col.find.return_value.limit.return_value = existing_docs

    with patch("database._get_db", return_value=mock_db):
        user_id = ObjectId("60d5ec49f87c5131f47b2c5d")
        
        # New items with a new metadata field, and one missing the old metadata field
        # Also testing optional price/source_url (one has price/url, other doesn't)
        new_items = [
            {"title": "New Item 1", "price": 12.5, "source_url": "https://example.com/new1", "metadata": {"new_key": "new_val"}},
            {"title": "New Item 2", "metadata": {"old_key": "keep_val"}}
        ]
        
        saved = database.save_items_to_db(
            user_id=user_id,
            collection_name="test_col",
            items=new_items,
            unique_key="title"
        )
        
        # Verify save_items_to_db completed
        assert saved == 2
        
        # Verify update_many was called to backfill existing items with 'new_key': None
        mock_items_col.update_many.assert_called_once()
        update_many_args = mock_items_col.update_many.call_args[0]
        assert update_many_args[0]["collection_name"] == "test_col"
        assert update_many_args[1]["$set"] == {"metadata.new_key": None}
        
        # Verify all incoming items had the union of keys applied
        # Item 1 should have 'old_key': None added
        # Item 2 should have 'new_key': None added, and price/source_url set to None
        update_calls = mock_items_col.update_one.call_args_list
        assert len(update_calls) == 2
        
        # First update_one payload check
        first_update = update_calls[0][0][1]["$set"]
        assert first_update["title"] == "New Item 1"
        assert first_update["price"] == 12.5
        assert first_update["source_url"] == "https://example.com/new1"
        assert first_update["metadata"] == {"new_key": "new_val", "old_key": None}
        
        # Second update_one payload check
        second_update = update_calls[1][0][1]["$set"]
        assert second_update["title"] == "New Item 2"
        assert second_update["price"] is None
        assert second_update["source_url"] is None
        assert second_update["metadata"] == {"old_key": "keep_val", "new_key": None}
        print("Schema alignment and optional price/url test passed successfully!")


if __name__ == "__main__":
    test_sandbox_fallback()
    test_save_items_to_db_falsy_key()
    test_save_items_to_db_duplicate_batch_keys()
    test_save_items_to_db_compound_keys()
    test_save_items_schema_alignment()



