import os
import contextlib
import io
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from generator import generate_parser_code
from schemas import (
    ExecutionRequest,
    ExecutionResponse,
    SnippetGenerationRequest,
    SnippetGenerationResponse,
)
import database

# Load environment variables from .env file
load_dotenv()

# Initialize FastAPI App
app = FastAPI(
    title="Antigravity Scrape-as-Code Engine Control Plane",
    description="FastAPI service generating programmatic scraping scripts from visual element nodes.",
    version="0.1.0",
)

# Enable CORS for Extension and Dashboard frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper dependency to authenticate users from Token in Header
def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header.")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization header format. Use Bearer <token>")
    token = authorization.split(" ")[1]
    user = database.get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")
    return user

# Pydantic Schemas for Auth/Settings
class UserAuthRequest(BaseModel):
    username: str
    password: str

class UserSettingsRequest(BaseModel):
    gemini_api_key: str = Field(default="")

class SearchRequest(BaseModel):
    q: str = Field(...)
    collection_name: Optional[str] = Field(default=None)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "engine": "Antigravity Scrape-as-Code",
        "version": "0.1.0",
    }

# --- Authentication Endpoints ---
@app.post("/api/auth/register")
def auth_register(payload: UserAuthRequest):
    username_clean = payload.username.strip()
    if len(username_clean) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters.")
    if len(payload.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")
        
    res = database.register_user(username_clean, payload.password)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.post("/api/auth/login")
def auth_login(payload: UserAuthRequest):
    username_clean = payload.username.strip()
    if not username_clean or not payload.password:
        raise HTTPException(status_code=400, detail="Username and password are required.")
        
    res = database.login_user(username_clean, payload.password)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.get("/api/auth/me")
def auth_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": str(current_user["_id"]),
        "username": current_user["username"],
        "token": current_user["token"],
        "gemini_api_key": current_user.get("gemini_api_key", "")
    }

@app.post("/api/user/settings")
def update_settings(payload: UserSettingsRequest, current_user: dict = Depends(get_current_user)):
    success = database.update_user_gemini_key(str(current_user["_id"]), payload.gemini_api_key)
    return {"success": success, "message": "Settings updated successfully."}

# --- Collections & Items Endpoints ---
@app.get("/api/collections")
def list_collections(current_user: dict = Depends(get_current_user)):
    collections = database.get_collections_list(str(current_user["_id"]))
    return {"collections": collections}

@app.get("/api/collections/{collection_name}/items")
def get_collection_items(
    collection_name: str,
    q: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    gemini_key = current_user.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY")
    
    if q and q.strip():
        items = database.search_collection_items_list(user_id, collection_name, q, gemini_key)
    else:
        items = database.get_collection_items_list(user_id, collection_name)
    return {"items": items}

@app.post("/api/collections/search")
def search_items(payload: SearchRequest, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    gemini_key = current_user.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY")
    
    if payload.collection_name:
        items = database.search_collection_items_list(user_id, payload.collection_name, payload.q, gemini_key)
    else:
        # Search across all collections and combine results
        collections = database.get_collections_list(user_id)
        items = []
        for col in collections:
            col_items = database.search_collection_items_list(user_id, col, payload.q, gemini_key)
            items.extend(col_items)
    return {"items": items}

# --- Generator & Execution Endpoints (Updated) ---
@app.post("/api/generate-parser", response_model=SnippetGenerationResponse)
def generate_parser(request: SnippetGenerationRequest, authorization: Optional[str] = Header(None)):
    """
    Accepts an atomic HTML container snippet and generates a BeautifulSoup parser
    bound to the ExtractedCatalogItem blueprint schema.
    Uses the user's custom Gemini API Key if authenticated.
    """
    user = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user = database.get_user_by_token(token)
        
    gemini_key = None
    if user:
        gemini_key = user.get("gemini_api_key")
        
    if not gemini_key:
        gemini_key = os.environ.get("GEMINI_API_KEY")

    if not request.html_snippet.strip():
        raise HTTPException(
            status_code=400, detail="HTML snippet content cannot be empty."
        )

    # Patch the GEMINI_API_KEY env variable temporarily for this run
    old_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        os.environ["GEMINI_API_KEY"] = gemini_key
    
    try:
        success, code, selectors, message = generate_parser_code(
            html_snippet=request.html_snippet,
            context_url=request.context_url,
            user_context=request.user_context,
            webpage_context=request.webpage_context,
        )
    finally:
        # Restore old key
        if old_key is not None:
            os.environ["GEMINI_API_KEY"] = old_key
        elif "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]

    return SnippetGenerationResponse(
        success=success, generated_code=code, selectors=selectors, message=message
    )

@app.post("/api/execute-parser", response_model=ExecutionResponse)
def execute_parser(request: ExecutionRequest, authorization: Optional[str] = Header(None)):
    """
    Dynamically executes a generated BeautifulSoup parser script against full page HTML
    and logs stdout print statements and extracted items.
    Binds items to the authenticated user's MongoDB collection.
    """
    user = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user = database.get_user_by_token(token)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required to run parser script. Please save your Token in extension."
        )

    # Safeguard compile check
    try:
        compiled_code = compile(request.generated_code, "<string>", "exec")
    except Exception as e:
        return ExecutionResponse(
            success=False,
            items_count=0,
            parsed_items=[],
            logs=f"Compilation error: {str(e)}",
        )

    # Set contextvar so AgenticCatalogSDK knows which user is running
    token_ctx = database.current_user_id.set(str(user["_id"]))

    # Prepare sandbox execution context
    local_namespace = {}
    stdout_buffer = io.StringIO()

    try:
        # Capture printouts
        with contextlib.redirect_stdout(stdout_buffer):
            # Execute generated code to load namespace
            exec(compiled_code, local_namespace)

            # Find the extraction function
            extract_items_func = local_namespace.get("extract_items")
            if not extract_items_func:
                raise ValueError(
                    "Generated script must contain an 'extract_items(html_content)' function."
                )

            # Run extraction
            html_inputs = (
                request.full_htmls
                if request.full_htmls is not None
                else [request.full_html or ""]
            )
            extracted_items = []
            for _idx, html_content in enumerate(html_inputs):
                page_items = extract_items_func(html_content)
                extracted_items.extend(page_items)

            # Invoke AgenticCatalogSDK to run bulk_upsert internally if desired
            sdk_class = local_namespace.get("AgenticCatalogSDK")
            if sdk_class:
                sdk_instance = sdk_class()
                import inspect

                try:
                    sig = inspect.signature(sdk_instance.bulk_upsert)
                    params = sig.parameters

                    kwargs = {}
                    if "collection_name" in params:
                        kwargs["collection_name"] = (
                            request.collection_name or "catalog_items"
                        )
                    elif "collection" in params:
                        kwargs["collection"] = (
                            request.collection_name or "catalog_items"
                        )

                    if "data" in params:
                        kwargs["data"] = extracted_items
                    elif "items" in params:
                        kwargs["items"] = extracted_items
                    elif "catalog_items" in params:
                        kwargs["catalog_items"] = extracted_items

                    if "unique_key" in params:
                        kwargs["unique_key"] = request.unique_key or "title"
                    elif "key" in params:
                        kwargs["key"] = request.unique_key or "title"

                    if kwargs:
                        sdk_instance.bulk_upsert(**kwargs)
                    else:
                        sdk_instance.bulk_upsert(
                            request.collection_name or "catalog_items",
                            extracted_items,
                            request.unique_key or "title",
                        )
                except Exception as ex:
                    print(f"Error calling SDK bulk_upsert: {ex}")
                    # Fallback to positional calls
                    try:
                        sdk_instance.bulk_upsert(
                            request.collection_name or "catalog_items",
                            extracted_items,
                            request.unique_key or "title",
                        )
                    except TypeError:
                        try:
                            sdk_instance.bulk_upsert(
                                extracted_items, request.unique_key or "title"
                            )
                        except TypeError:
                            sdk_instance.bulk_upsert(extracted_items)

        logs = stdout_buffer.getvalue()
        return ExecutionResponse(
            success=True,
            items_count=len(extracted_items),
            parsed_items=extracted_items,
            logs=logs,
        )
    except Exception as e:
        logs = stdout_buffer.getvalue() + f"\nRuntime Execution Error: {str(e)}"
        return ExecutionResponse(
            success=False, items_count=0, parsed_items=[], logs=logs
        )
    finally:
        database.current_user_id.reset(token_ctx)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
