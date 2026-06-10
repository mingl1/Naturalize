import pytest
from unittest.mock import patch
from bson import ObjectId
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

def test_list_models_no_auth():
    # Test GET /api/models without headers/auth (uses env/default fallback)
    with patch.dict("os.environ", {"GEMINI_API_KEY": ""}):
        response = client.get("/api/models")
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert len(data["models"]) > 0
        # Ensure default models are present
        model_ids = [m["id"] for m in data["models"]]
        assert "gemini-3.5-flash" in model_ids
        assert "gemini-3.1-pro" in model_ids
        
        # Verify pricing is present
        flash_model = next(m for m in data["models"] if m["id"] == "gemini-3.5-flash")
        assert flash_model["input_price_1m"] == 1.50
        assert flash_model["output_price_1m"] == 9.00


def test_update_and_get_settings():
    # Mock authentication and database settings update
    user_id = "60d5ec49f87c5131f47b2c5d"
    mock_user = {
        "_id": ObjectId(user_id),
        "username": "tester",
        "token": "test_token_settings",
        "gemini_api_key": "old-key",
        "generator_model": "gemini-3.5-flash",
        "validator_model": "gemini-3.5-flash",
        "search_model": "gemini-3.5-flash",
    }
    
    with patch("database.get_user_by_token", return_value=mock_user) as mock_get_user, \
         patch("database.update_user_settings", return_value=True) as mock_update_settings:
        
        headers = {"Authorization": "Bearer test_token_settings"}
        
        # 1. Update user settings with custom models
        settings_payload = {
            "gemini_api_key": "new-api-key",
            "generator_model": "gemini-3.1-pro",
            "validator_model": "gemini-2.5-flash",
            "search_model": "gemini-2.0-flash"
        }
        
        response = client.post("/api/user/settings", json=settings_payload, headers=headers)
        assert response.status_code == 200
        assert response.json() == {"success": True, "message": "Settings updated successfully."}
        
        mock_update_settings.assert_called_once_with(
            user_id,
            "new-api-key",
            "gemini-3.1-pro",
            "gemini-2.5-flash",
            "gemini-2.0-flash"
        )

        # 2. Get /api/auth/me returns mock user with settings
        updated_mock_user = mock_user.copy()
        updated_mock_user["gemini_api_key"] = "new-api-key"
        updated_mock_user["generator_model"] = "gemini-3.1-pro"
        updated_mock_user["validator_model"] = "gemini-2.5-flash"
        updated_mock_user["search_model"] = "gemini-2.0-flash"
        
        with patch("database.get_user_by_token", return_value=updated_mock_user):
            me_response = client.get("/api/auth/me", headers=headers)
            assert me_response.status_code == 200
            me_data = me_response.json()
            assert me_data["gemini_api_key"] == "new-api-key"
            assert me_data["generator_model"] == "gemini-3.1-pro"
            assert me_data["validator_model"] == "gemini-2.5-flash"
            assert me_data["search_model"] == "gemini-2.0-flash"
