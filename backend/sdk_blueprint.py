# sdk_blueprint.py (Reference Interface)
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ExtractedCatalogItem(BaseModel):
    title: str = Field(description="Clean text header of the listing")
    price: Optional[float] = Field(default=None, description="Normalized numerical price value")
    source_url: Optional[str] = Field(default=None, description="Fully qualified destination link")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Arbitrary layout key-values discovered"
    )


class AgenticCatalogSDK:
    def bulk_upsert(
        self,
        collection_name: str,
        data: List[Dict[str, Any]],
        unique_key: str = "title",
        unique_keys: List[str] = None
    ) -> bool:
        """Executes a high-performance database sync payload via the system wrapper.
        Saves data directly to MongoDB.
        """
        # Resolve unique keys
        if not unique_keys:
            unique_keys = [unique_key] if unique_key else ["title"]

        print(
            f"📊 [AgenticCatalogSDK] bulk_upsert invoked on collection '{collection_name}' with keys {unique_keys}"
        )
        print(f"📦 Payload count: {len(data)}")
        for idx, item in enumerate(data[:3]):
            print(f"  - Item {idx + 1}: {item}")
        if len(data) > 3:
            print(f"  - ... and {len(data) - 3} more items")

        # MongoDB integration
        from database import current_user_id, save_items_to_db
        user_id = current_user_id.get()
        if user_id:
            try:
                saved = save_items_to_db(user_id, collection_name, data, unique_keys)
                print(f"✅ [AgenticCatalogSDK] Successfully upserted {saved} documents in MongoDB.")
            except Exception as e:
                print(f"❌ [AgenticCatalogSDK] Error saving to MongoDB: {str(e)}")
        else:
            print("⚠️ [AgenticCatalogSDK] No authenticated user context found. Skipping DB write.")
        return True
