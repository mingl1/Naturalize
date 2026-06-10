import contextlib
import io
import json
import os
import re
import uuid
from typing import Any, Dict, List, Optional

import database
from agent_workflows import (collection, doc_search_workflow,
                             robust_code_generator)
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from generator import generate_parser_code
from google.adk.runners import InMemoryRunner
from pydantic import BaseModel, Field
from schemas import (ExecutionRequest, ExecutionResponse, InstantSearchRequest,
                     QueryCatalogRequest, SnippetGenerationRequest,
                     SnippetGenerationResponse)

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

# ADK runners
generator_runner = InMemoryRunner(agent=robust_code_generator)
search_runner = InMemoryRunner(agent=doc_search_workflow)

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
    generator_model: str = Field(default="gemini-3.5-flash")
    validator_model: str = Field(default="gemini-3.5-flash")
    search_model: str = Field(default="gemini-3.5-flash")

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
        "gemini_api_key": current_user.get("gemini_api_key", ""),
        "generator_model": current_user.get("generator_model", "gemini-3.5-flash"),
        "validator_model": current_user.get("validator_model", "gemini-3.5-flash"),
        "search_model": current_user.get("search_model", "gemini-3.5-flash")
    }

@app.post("/api/user/settings")
def update_settings(payload: UserSettingsRequest, current_user: dict = Depends(get_current_user)):
    success = database.update_user_settings(
        str(current_user["_id"]),
        payload.gemini_api_key,
        payload.generator_model,
        payload.validator_model,
        payload.search_model
    )
    return {"success": success, "message": "Settings updated successfully."}

@app.get("/api/models")
def list_models(authorization: Optional[str] = Header(None)):
    user = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user = database.get_user_by_token(token)
    
    gemini_key = None
    if user:
        gemini_key = user.get("gemini_api_key")
    if not gemini_key:
        gemini_key = os.environ.get("GEMINI_API_KEY")
        
    fallback_models = [
        {"id": "gemini-3.5-flash", "name": "Gemini 3.5 Flash", "input_price_1m": 1.50, "output_price_1m": 9.00},
        {"id": "gemini-3.1-pro", "name": "Gemini 3.1 Pro", "input_price_1m": 2.00, "output_price_1m": 12.00},
        {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "input_price_1m": 0.30, "output_price_1m": 2.50},
        {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "input_price_1m": 1.25, "output_price_1m": 10.00},
        {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "input_price_1m": 0.075, "output_price_1m": 0.30},
        {"id": "gemini-2.0-flash-lite", "name": "Gemini 2.0 Flash Lite", "input_price_1m": 0.075, "output_price_1m": 0.30},
        {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "input_price_1m": 0.075, "output_price_1m": 0.30},
        {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "input_price_1m": 1.25, "output_price_1m": 5.00},
    ]
    
    if not gemini_key:
        return {"models": fallback_models}
        
    try:
        from google import genai
        client = genai.Client(api_key=gemini_key)
        api_models = client.models.list()
        
        exclude_keywords = [
            "embedding", "translate", "image", "audio", "vision", "tts", 
            "robotics", "computer-use", "customtools", "live", "preview-tts"
        ]
        
        filtered = []
        seen_ids = set()
        
        pricing_map = {m["id"]: (m["name"], m["input_price_1m"], m["output_price_1m"]) for m in fallback_models}
        
        for m in api_models:
            name_lower = m.name.lower()
            if "gemini" in name_lower and not any(k in name_lower for k in exclude_keywords):
                model_id = m.name.split("/")[-1]
                if model_id in seen_ids:
                    continue
                seen_ids.add(model_id)
                
                if model_id in pricing_map:
                    friendly_name, in_p, out_p = pricing_map[model_id]
                else:
                    parts = model_id.split("-")
                    formatted_parts = []
                    for p in parts:
                        if p == "gemini":
                            formatted_parts.append("Gemini")
                        elif p.replace(".", "").isdigit():
                            formatted_parts.append(p)
                        else:
                            formatted_parts.append(p.capitalize())
                    friendly_name = " ".join(formatted_parts)
                    
                    if "pro" in model_id:
                        in_p, out_p = 1.25, 10.00
                    else:
                        in_p, out_p = 0.30, 2.50
                        
                filtered.append({
                    "id": model_id,
                    "name": friendly_name,
                    "input_price_1m": in_p,
                    "output_price_1m": out_p
                })
        
        def sort_key(x):
            try:
                standard_ids = [m["id"] for m in fallback_models]
                return (standard_ids.index(x["id"]), x["id"])
            except ValueError:
                return (len(fallback_models), x["id"])
                
        filtered.sort(key=sort_key)
        return {"models": filtered}
    except Exception as e:
        print(f"[Warning] Failed to fetch dynamic models list: {e}")
        return {"models": fallback_models}

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
    search_model = current_user.get("search_model") or "gemini-3.5-flash"
    
    if q and q.strip():
        items = database.search_collection_items_list(user_id, collection_name, q, gemini_key, search_model)
    else:
        items = database.get_collection_items_list(user_id, collection_name)
    return {"items": items}

@app.post("/api/collections/search")
def search_items(payload: SearchRequest, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    gemini_key = current_user.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY")
    search_model = current_user.get("search_model") or "gemini-3.5-flash"
    
    if payload.collection_name:
        items = database.search_collection_items_list(user_id, payload.collection_name, payload.q, gemini_key, search_model)
    else:
        # Search across all collections and combine results
        collections = database.get_collections_list(user_id)
        items = []
        for col in collections:
            col_items = database.search_collection_items_list(user_id, col, payload.q, gemini_key, search_model)
            items.extend(col_items)
    return {"items": items}

# --- Generator & Execution Endpoints (Updated) ---
@app.post("/api/generate-parser", response_model=SnippetGenerationResponse)
async def generate_parser(request: SnippetGenerationRequest, authorization: Optional[str] = Header(None)):
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
    generator_model = "gemini-3.5-flash"
    validator_model = "gemini-3.5-flash"
    if user:
        gemini_key = user.get("gemini_api_key")
        generator_model = user.get("generator_model") or "gemini-3.5-flash"
        validator_model = user.get("validator_model") or "gemini-3.5-flash"
        
    if not gemini_key:
        gemini_key = os.environ.get("GEMINI_API_KEY")

    if not request.html_snippet.strip():
        raise HTTPException(
            status_code=400, detail="HTML snippet content cannot be empty."
        )

    if not gemini_key:
        return SnippetGenerationResponse(
            success=False,
            generated_code="",
            selectors={},
            message="No Gemini API key provided. Please set your key in the extension settings or as an environment variable.",
        )

    # Patch the GEMINI_API_KEY env variable temporarily for this run
    old_key = os.environ.get("GEMINI_API_KEY")
    os.environ["GEMINI_API_KEY"] = gemini_key
    
    # Execute code generation inside ADK self-improving LoopAgent
    try:
        session_id = str(uuid.uuid4())
        initial_state = {
            "html_snippet": request.html_snippet,
            "user_context": request.user_context or "",
            "full_htmls": request.full_htmls or [],
            "error_feedback": None,
            "context_url": request.context_url or "",
            "webpage_context": request.webpage_context or {},
            "generator_model": generator_model,
            "validator_model": validator_model,
        }
        session = await generator_runner.session_service.create_session(
            app_name=generator_runner.app_name,
            user_id="code_generator_user",
            session_id=session_id,
            state=initial_state,
        )


        from google.genai.types import Part, UserContent

        content = UserContent(parts=[Part(text="Start writing the parser.")])

        # Run LoopAgent workflow (Developer agent + ParserScriptValidator)
        events = generator_runner.run(
            user_id=session.user_id, session_id=session.id, new_message=content
        )
        print(f"[Generate Parser] Starting LoopAgent workflow session {session_id}...")
        for event in events:
            print(f"[Generate Parser Event] Author: {event.author}")
            if hasattr(event, "content") and event.content:
                print(f"  Content: {event.content}")
            if hasattr(event, "actions") and event.actions:
                print(f"  Actions: {event.actions}")

        # Retrieve the updated session from the session service to read changes
        session = await generator_runner.session_service.get_session(
            app_name=generator_runner.app_name,
            user_id=session.user_id,
            session_id=session.id,
        )

        parser_result = session.state.get("parser_generation_result")
        raw_generated_code = session.state.get("generated_code")
        error_feedback = session.state.get("error_feedback")
        print(f"[Generate Parser] Workflow finished. Has parser_generation_result: {bool(parser_result)}, Has generated_code: {bool(raw_generated_code)}, error_feedback: {error_feedback}")

        final_code = ""
        selectors = {}
        deduplication_keys = ["title"]
        from generator import _clean_python_code
        if parser_result and isinstance(parser_result, dict):
            final_code = parser_result.get("code") or ""
            selectors = parser_result.get("selectors") or {}
            deduplication_keys = parser_result.get("deduplication_keys") or ["title"]
            final_code = _clean_python_code(final_code)
        elif raw_generated_code:
            from generator import (_extract_code_block,
                                   _infer_selectors_from_text)
            selectors = _infer_selectors_from_text(raw_generated_code)
            final_code = _extract_code_block(raw_generated_code, "python")
            final_code = _clean_python_code(final_code)

        if final_code and not error_feedback:
            return SnippetGenerationResponse(
                success=True,
                generated_code=final_code,
                selectors=selectors,
                deduplication_keys=deduplication_keys,
                message="Successfully generated and validated parser script using ADK LoopAgent.",
            )
        else:
            return SnippetGenerationResponse(
                success=False,
                generated_code=final_code or "",
                selectors={},
                deduplication_keys=[],
                message=f"Parser generation failed validation. Last error: {error_feedback}",
            )

    except Exception as e:
        return SnippetGenerationResponse(
            success=False,
            generated_code="",
            selectors={},
            message=f"Error running ADK generator workflow: {str(e)}",
        )
    finally:
        # Restore old key
        if old_key is not None:
            os.environ["GEMINI_API_KEY"] = old_key
        elif "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]

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
    
    user_id = str(user["_id"])
    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid user session. Please log in again.",
        )
    token_ctx = database.current_user_id.set(user_id)

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
            if not sdk_class:
                from sdk_blueprint import AgenticCatalogSDK as fallback_sdk_class
                sdk_class = fallback_sdk_class
                print("ℹ️ [Sandbox] AgenticCatalogSDK not found in generated script namespace. Using system fallback SDK class.")

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

                    # Resolve unique_keys and unique_key
                    unique_keys = request.unique_keys
                    if not unique_keys:
                        unique_keys = [request.unique_key] if request.unique_key else ["title"]

                    if "unique_keys" in params:
                        kwargs["unique_keys"] = unique_keys
                    if "unique_key" in params:
                        kwargs["unique_key"] = unique_keys[0]
                    elif "key" in params:
                        kwargs["key"] = unique_keys[0]

                    if kwargs:
                        sdk_instance.bulk_upsert(**kwargs)
                    else:
                        sdk_instance.bulk_upsert(
                            request.collection_name or "catalog_items",
                            extracted_items,
                            unique_keys[0],
                            unique_keys,
                        )
                except Exception as ex:
                    print(f"Error calling SDK bulk_upsert: {ex}")
                    # Fallback to positional calls
                    try:
                        sdk_instance.bulk_upsert(
                            request.collection_name or "catalog_items",
                            extracted_items,
                            unique_keys[0],
                            unique_keys,
                        )
                    except TypeError:
                        try:
                            sdk_instance.bulk_upsert(
                                request.collection_name or "catalog_items",
                                extracted_items,
                                unique_keys[0],
                            )
                        except TypeError:
                            try:
                                sdk_instance.bulk_upsert(
                                    extracted_items, unique_keys[0]
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


@app.post("/api/query-catalog")
async def query_catalog(request: QueryCatalogRequest):
    """
    Exposes conversational natural language search over MongoDB catalog documents.
    Uses sequential agents to discover schema and perform vector search.
    """
    search_model = "gemini-3.5-flash"
    if request.user_id and request.user_id != "user_default":
        try:
            from bson import ObjectId
            user_doc = database._get_db().users.find_one({"_id": ObjectId(request.user_id)})
            if user_doc:
                search_model = user_doc.get("search_model") or "gemini-3.5-flash"
        except Exception:
            pass

    session = await search_runner.session_service.create_session(
        app_name=search_runner.app_name,
        user_id=request.user_id,
        session_id=request.conversation_id,
        state={"gemini_model": search_model}
    )

    try:
        from google.genai.types import Part, UserContent

        content = UserContent(parts=[Part(text=request.user_prompt)])

        events = search_runner.run(
            user_id=session.user_id, session_id=session.id, new_message=content
        )

        final_output = ""
        for event in events:
            if event.content and event.content.parts:
                for part in event.content.parts:
                    final_output += part.text or ""

        # Clean JSON wrappers from response
        text_json = final_output.strip()
        if "```json" in text_json:
            match = re.search(
                r"```json\s*\n(.*?)\s*```", text_json, re.DOTALL
            )
            if match:
                text_json = match.group(1)
        elif "```" in text_json:
            match = re.search(r"```\s*\n(.*?)\s*```", text_json, re.DOTALL)
            if match:
                text_json = match.group(1)

        return json.loads(text_json)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Catalog Q&A Search workflow execution failed: {str(e)}",
        ) from e


@app.post("/api/instant-search")
async def instant_search(request: InstantSearchRequest):
    """
    Direct MongoDB query bypassing the LLM when users update hard filters in the UI.
    Uses cached query intent for the specific search_id.
    """
    session = await search_runner.session_service.get_session(
        app_name=search_runner.app_name,
        user_id="user_default",
        session_id=request.conversation_id,
    )
    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"No active search session found for conversation ID: {request.conversation_id}",
        )

    searches = session.state.get("searches", {})
    search_params = searches.get(request.search_id)
    if not search_params:
        raise HTTPException(
            status_code=404,
            detail=f"Search parameters not found for search ID: {request.search_id}",
        )

    query_intent = search_params["query_intent"]

    # Translate update_filters input into MongoDB query operators
    mongo_filter = {}
    for f in request.updated_filters:
        field = f.field
        op = f.operator
        val = f.value

        if op == "less_than":
            mongo_filter[field] = {"$lt": val}
        elif op == "greater_than":
            mongo_filter[field] = {"$gt": val}
        elif op == "equals":
            mongo_filter[field] = val
        elif op == "regex":
            mongo_filter[field] = {"$regex": val, "$options": "i"}

    try:
        # Build Vector Search aggregation pipeline
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "vector_index",
                    "path": "embedding",
                    "queryVector": query_intent,
                    "numCandidates": 100,
                    "limit": 10,
                    "filter": mongo_filter,
                }
            }
        ]

        # Try executing Atlas Vector Search, fallback to Regex text search if not configured/Atlas
        try:
            results = list(collection.aggregate(pipeline))
        except Exception as atlas_err:
            print(
                f"[Warning] Atlas Vector Search failed, running fallback regex search: {atlas_err}"
            )
            fallback_query = {
                "$or": [
                    {"title": {"$regex": query_intent, "$options": "i"}},
                    {"metadata.description": {"$regex": query_intent, "$options": "i"}},
                ]
            }
            fallback_query.update(mongo_filter)
            results = list(collection.find(fallback_query).limit(10))

        for r in results:
            r["_id"] = str(r["_id"])

        # Cache updated filters back into session state
        search_params["filters_applied"] = [
            f.model_dump() for f in request.updated_filters
        ]
        session.state["searches"][request.search_id] = search_params

        return {
            "search_id": request.search_id,
            "query_intent": query_intent,
            "filters_applied": request.updated_filters,
            "results": results,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Instant search database query failed: {str(e)}"
        ) from e


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
