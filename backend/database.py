# database.py
import os
import secrets
import hashlib
import datetime
from bson import ObjectId
from pymongo import MongoClient
from google import genai
import contextvars
from typing import Any

# Context variable to hold user ID during request execution
current_user_id = contextvars.ContextVar("current_user_id", default=None)

# Initialize MongoDB Client lazily to prevent connection errors during import or unit tests.
_client = None
_db = None

def _get_db():
    global _client, _db
    if _db is None:
        MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
        try:
            import certifi
            ca = certifi.where()
            if "mongodb.net" in MONGODB_URI or "mongodb+srv" in MONGODB_URI:
                _client = MongoClient(MONGODB_URI, tlsCAFile=ca)
            else:
                _client = MongoClient(MONGODB_URI)
        except ImportError:
            _client = MongoClient(MONGODB_URI)
        
        _db = _client.get_database("naturalize")
        
        # Ensure indexes
        try:
            _db.users.create_index("username", unique=True)
            _db.users.create_index("token", unique=True)
            _db.items.create_index([("user_id", 1), ("collection_name", 1), ("title", 1)])
        except Exception as e:
            print(f"[Warning] Failed to ensure MongoDB indexes: {e}")
            
    return _db

# Password hashing using pbkdf2
def hash_password(password: str) -> str:
    salt = secrets.token_hex(8)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
    return f"{salt}:{h.hex()}"

def verify_password(password: str, hashed: str) -> bool:
    try:
        salt, h_hex = hashed.split(":")
        h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
        return h.hex() == h_hex
    except Exception:
        return False

# User Auth Helpers
def register_user(username: str, password: str) -> dict:
    db = _get_db()
    if db.users.find_one({"username": username}):
        return {"success": False, "message": "Username already exists."}
    
    token = f"nt_{secrets.token_hex(24)}"
    password_hash = hash_password(password)
    
    user_doc = {
        "username": username,
        "password_hash": password_hash,
        "token": token,
        "gemini_api_key": "",
        "created_at": datetime.datetime.utcnow()
    }
    
    result = db.users.insert_one(user_doc)
    return {
        "success": True,
        "user_id": str(result.inserted_id),
        "username": username,
        "token": token
    }

def login_user(username: str, password: str) -> dict:
    db = _get_db()
    user = db.users.find_one({"username": username})
    if not user or not verify_password(password, user["password_hash"]):
        return {"success": False, "message": "Invalid username or password."}
    
    return {
        "success": True,
        "user_id": str(user["_id"]),
        "username": user["username"],
        "token": user["token"]
    }

def get_user_by_token(token: str) -> dict:
    db = _get_db()
    return db.users.find_one({"token": token})

def update_user_gemini_key(user_id: str, gemini_api_key: str) -> bool:
    db = _get_db()
    res = db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"gemini_api_key": gemini_api_key}}
    )
    return res.modified_count > 0

# Items & Collections logic
def save_items_to_db(user_id: str, collection_name: str, items: list, unique_keys: Any = None, **kwargs):
    """
    Upserts a list of parsed items under a specific user and collection name.
    Supports single or compound unique_keys (e.g. ['title', 'metadata.duration']).
    """
    db = _get_db()
    if not unique_keys:
        unique_keys = kwargs.get("unique_key")

    if not unique_keys:
        unique_keys = ["title"]
    elif isinstance(unique_keys, str):
        unique_keys = [unique_keys]

    seen_keys = set()
    saved_count = 0
    for item in items:
        # Standardize properties
        title = item.get("title", "").strip()
        if not title:
            continue
            
        price = 0.0
        try:
            price = float(item.get("price", 0.0))
        except (ValueError, TypeError):
            pass
            
        source_url = item.get("source_url", "").strip()
        metadata = item.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}

        # Set up unique filter for upsert
        filter_doc = {
            "user_id": ObjectId(user_id) if isinstance(user_id, str) else user_id,
            "collection_name": collection_name
        }
        
        has_unique_value = True
        unique_vals = []
        for key in unique_keys:
            if key in ["title", "price", "source_url"]:
                val = title if key == "title" else (price if key == "price" else source_url)
            else:
                meta_key = key.removeprefix("metadata.")
                val = metadata.get(meta_key)

            if val is not None and val != "":
                if key in ["title", "price", "source_url"]:
                    filter_doc[key] = val
                else:
                    filter_doc[f"metadata.{meta_key}"] = val
                unique_vals.append(f"{key}:{str(val)}")
            else:
                has_unique_value = False
                break

        if has_unique_value:
            val_str = "|".join(unique_vals)
            if val_str in seen_keys:
                # Already processed this unique key combination in the current batch. Force insert to prevent overwriting.
                has_unique_value = False
            else:
                seen_keys.add(val_str)

        if not has_unique_value:
            # Force insert by generating a unique _id since there's no valid unique value to upsert on
            filter_doc = {
                "user_id": ObjectId(user_id) if isinstance(user_id, str) else user_id,
                "collection_name": collection_name,
                "_id": ObjectId()
            }



        try:
            db.items.update_one(
                filter_doc,
                {
                    "$set": {
                        "user_id": ObjectId(user_id) if isinstance(user_id, str) else user_id,
                        "collection_name": collection_name,
                        "title": title,
                        "price": price,
                        "source_url": source_url,
                        "metadata": metadata,
                        "updated_at": datetime.datetime.utcnow()
                    },
                    "$setOnInsert": {
                        "created_at": datetime.datetime.utcnow()
                    }
                },
                upsert=True
            )
            saved_count += 1
        except Exception as e:
            print(f"[Warning] Failed to save item '{title}' to database: {e}")

        
    return saved_count

def get_collections_list(user_id: str) -> list:
    """
    Returns distinct collection names for the user.
    """
    db = _get_db()
    u_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    collections = db.items.distinct("collection_name", {"user_id": u_id})
    return sorted(collections)

def get_collection_items_list(user_id: str, collection_name: str) -> list:
    """
    Returns items in a specific collection.
    """
    db = _get_db()
    u_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    cursor = db.items.find({"user_id": u_id, "collection_name": collection_name})
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["user_id"] = str(doc["user_id"])
        results.append(doc)
    return results

def search_collection_items_list(user_id: str, collection_name: str, query_str: str, gemini_key: str = None) -> list:
    """
    Performs search on a collection. Uses Gemini semantic filter if gemini_key is available,
    otherwise falls back to keyword matching.
    """
    all_items = get_collection_items_list(user_id, collection_name)
    if not all_items or not query_str.strip():
        return all_items

    # 1. Try Gemini semantic search if key is provided
    if gemini_key:
        try:
            # We filter up to 150 items to keep prompt size small
            items_subset = all_items[:150]
            items_brief = []
            for item in items_subset:
                items_brief.append({
                    "id": item["_id"],
                    "title": item.get("title", ""),
                    "price": item.get("price", 0.0),
                    "metadata": item.get("metadata", {})
                })
            
            client = genai.Client(api_key=gemini_key)
            
            prompt = f"""You are a semantic search engine filtering scraped catalog items.
The user is searching for: "{query_str}"

Here is the JSON list of catalog items:
{items_brief}

Evaluate each item and check if it matches the user's query semantically (e.g. matching tags, categories, descriptions, custom features, colors, price ranges, or synonyms).
Return a JSON array of matching item ID strings in order of relevance, like this: ["id1", "id2"].
If no items match, return an empty array: [].
Do NOT include any explanations, markdown code blocks, backticks, or text other than the raw JSON array.
"""
            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=prompt,
            )
            text_resp = response.text.strip()
            
            # Extract JSON list if LLM wrapped in markdown
            if "```" in text_resp:
                import re
                match = re.search(r"```(?:json)?\s*(.*?)\s*```", text_resp, re.DOTALL | re.IGNORECASE)
                if match:
                    text_resp = match.group(1).strip()
            
            import json
            matching_ids = json.loads(text_resp)
            if isinstance(matching_ids, list):
                # Filter items in the exact order returned by Gemini
                id_map = {item["_id"]: item for item in items_subset}
                matched = []
                for m_id in matching_ids:
                    if m_id in id_map:
                        matched.append(id_map[m_id])
                
                # Append any remaining items if there are more than 150 (but only if they match keywords)
                # Just to be safe, if we found matches, return them!
                if matched:
                    return matched
        except Exception as e:
            print(f"[Warning] Gemini semantic search failed: {e}. Falling back to keyword search.")

    # 2. Local fallback keyword search
    keywords = query_str.lower().split()
    scored_items = []
    
    # Check if there is a price relation in the query (e.g. "under 50", "less than 100")
    price_limit = None
    price_operator = None # 'less' or 'greater'
    import re
    price_match = re.search(r'(?:under|less than|below|cheap|<)\s*\$?(\d+(?:\.\d+)?)', query_str.lower())
    if price_match:
        price_limit = float(price_match.group(1))
        price_operator = 'less'
    else:
        price_match = re.search(r'(?:over|above|greater than|expensive|>)\s*\$?(\d+(?:\.\d+)?)', query_str.lower())
        if price_match:
            price_limit = float(price_match.group(1))
            price_operator = 'greater'

    for item in all_items:
        score = 0
        title_lower = item.get("title", "").lower()
        metadata_str = str(item.get("metadata", {})).lower()
        
        # Check text matches
        for kw in keywords:
            if kw in title_lower:
                score += 10 # Higher weight for title match
            if kw in metadata_str:
                score += 2
                
        # Check price matches
        if price_limit is not None and price_operator is not None:
            item_price = item.get("price", 0.0)
            if price_operator == 'less' and item_price <= price_limit:
                score += 5
            elif price_operator == 'greater' and item_price >= price_limit:
                score += 5
                
        if score > 0:
            scored_items.append((score, item))
            
    scored_items.sort(key=lambda x: x[0], reverse=True)
    return [x[1] for x in scored_items]
