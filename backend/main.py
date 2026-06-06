import contextlib
import io

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from generator import generate_parser_code
from schemas import (
    ExecutionRequest,
    ExecutionResponse,
    SnippetGenerationRequest,
    SnippetGenerationResponse,
)

# Load environment variables from .env file
load_dotenv()

# Initialize FastAPI App
app = FastAPI(
    title="Antigravity Scrape-as-Code Engine Control Plane",
    description="FastAPI service generating programmatic scraping scripts from visual element nodes.",
    version="0.1.0",
)

# Enable CORS for Chrome Extensions
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits requests from chrome-extension:// origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "status": "online",
        "engine": "Antigravity Scrape-as-Code",
        "version": "0.1.0",
    }


@app.post("/api/generate-parser", response_model=SnippetGenerationResponse)
def generate_parser(request: SnippetGenerationRequest):
    """
    Accepts an atomic HTML container snippet and generates a BeautifulSoup parser
    bound to the ExtractedCatalogItem blueprint schema.
    """
    if not request.html_snippet.strip():
        raise HTTPException(
            status_code=400, detail="HTML snippet content cannot be empty."
        )

    success, code, selectors, message = generate_parser_code(
        html_snippet=request.html_snippet,
        context_url=request.context_url,
        user_context=request.user_context,
        webpage_context=request.webpage_context,
    )

    return SnippetGenerationResponse(
        success=success, generated_code=code, selectors=selectors, message=message
    )


@app.post("/api/execute-parser", response_model=ExecutionResponse)
def execute_parser(request: ExecutionRequest):
    """
    Dynamically executes a generated BeautifulSoup parser script against full page HTML
    and logs stdout print statements and extracted items.
    """
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
                    # Match collection_name or collection
                    if "collection_name" in params:
                        kwargs["collection_name"] = (
                            request.collection_name or "catalog_items"
                        )
                    elif "collection" in params:
                        kwargs["collection"] = (
                            request.collection_name or "catalog_items"
                        )

                    # Match data, items, or catalog_items
                    if "data" in params:
                        kwargs["data"] = extracted_items
                    elif "items" in params:
                        kwargs["items"] = extracted_items
                    elif "catalog_items" in params:
                        kwargs["catalog_items"] = extracted_items

                    # Match unique_key or key
                    if "unique_key" in params:
                        kwargs["unique_key"] = request.unique_key or "title"
                    elif "key" in params:
                        kwargs["key"] = request.unique_key or "title"

                    if kwargs:
                        sdk_instance.bulk_upsert(**kwargs)
                    else:
                        # Fallback to positional arguments if keywords could not be matched
                        sdk_instance.bulk_upsert(
                            request.collection_name or "catalog_items",
                            extracted_items,
                            request.unique_key or "title",
                        )
                except Exception:
                    # Fallback to positional calls if signature inspection fails
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
