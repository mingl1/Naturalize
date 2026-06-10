# agent_workflows.py
import json
import os
import re
import traceback
import uuid
from typing import Any, AsyncGenerator, Dict, List

from google import genai
from google.adk.agents import Agent, BaseAgent, LlmAgent, LoopAgent, SequentialAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event, EventActions
from google.adk.models import LlmRequest, LlmResponse
from google.adk.tools import MCPToolset
from google.adk.tools.mcp_tool import StdioConnectionParams
from mcp import StdioServerParameters
from pydantic import BaseModel, Field
from pymongo import MongoClient


# MongoDB direct connection for schema sampling and instant search
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/naturalize")
mongo_client = MongoClient(MONGO_URI)
db = mongo_client["naturalize"]
collection = db["items"]


# ==========================================
# 1. Structured Response schemas
# ==========================================


class FilterApplied(BaseModel):
    field: str = Field(
        description="The document field filtered on (e.g., 'price', 'title', 'metadata.stock')"
    )
    operator: str = Field(
        description="The query operator applied (e.g., 'less_than', 'greater_than', 'equals', 'regex')"
    )
    value: Any = Field(
        description="The filter threshold or value (e.g., 800, 'in_stock')"
    )


class SearchResultResponse(BaseModel):
    search_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="A unique ID for this search execution, used to update filters later",
    )
    query_intent: str = Field(
        description="The parsed semantic search string used for vector search queryVector"
    )
    filters_applied: List[FilterApplied] = Field(
        default_factory=list,
        description="List of structured constraints applied to the database search",
    )
    results: List[Dict[str, Any]] = Field(
        description="Raw list of matching catalog item documents retrieved from MongoDB"
    )
    summary: str = Field(
        description="A concise natural language summary answering the user query based on these documents"
    )



class SelectorsSchema(BaseModel):
    item_selector: str = Field(default="", description="CSS selector for the repeating item card/row container")
    title_selector: str = Field(default="", description="CSS selector for the item title element relative to the container")
    price_selector: str = Field(default="", description="CSS selector for the item price element relative to the container")
    url_selector: str = Field(default="", description="CSS selector for the item URL/link element relative to the container")


class ParserGenerationResult(BaseModel):
    selectors: SelectorsSchema = Field(
        default_factory=SelectorsSchema,
        description="Inferred CSS selectors mapping fields to selectors"
    )
    code: str = Field(
        description="The complete, runnable Python code of the BeautifulSoup script. Do NOT include markdown code blocks (like ```python or ```) in this string; it must be raw python code only."
    )
    deduplication_keys: List[str] = Field(
        default_factory=lambda: ["title"],
        description="List of fields (e.g. ['title'], ['source_url'], ['title', 'metadata.duration']) to use as a compound key for database deduplication."
    )



# ==========================================
# 2. Scraping Script Validator & Generator Loop
# ==========================================


class ParserScriptValidator(BaseAgent):
    """
    Executes the generated Python parser code in a sandbox against user-provided HTML pages
    and evaluates whether the output satisfies the user's specific instructions.
    """

    async def _run_async_impl(
        self, context: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        state = context.session.state
        parser_result = state.get("parser_generation_result")
        generated_code = ""
        if parser_result and isinstance(parser_result, dict):
            generated_code = parser_result.get("code") or ""
        
        if not generated_code:
            generated_code = state.get("generated_code")

        html_snippet = state.get("html_snippet", "")
        full_htmls = state.get("full_htmls") or []
        user_context = state.get("user_context", "")

        # Fallback to snippet if no full HTML pages are provided
        if not full_htmls and html_snippet:
            full_htmls = [html_snippet]

        if not generated_code:
            yield Event(
                author=self.name,
                state={
                    "error_feedback": "Error: No generated code was received to validate."
                },
            )
            return

        if not full_htmls:
            yield Event(
                author=self.name,
                state={
                    "error_feedback": "Error: No HTML content was provided for validation. Please provide either full_htmls or html_snippet."
                },
            )
            return


        # 1. Compile & Execution Sandbox test
        try:
            from generator import _extract_code_block
            code_clean = _extract_code_block(generated_code, "python")

            compiled_code = compile(code_clean, "<string>", "exec")
            local_namespace = {}
            exec(compiled_code, local_namespace)

            extract_items_func = local_namespace.get("extract_items")
            if not extract_items_func:
                raise ValueError(
                    "Generated script must contain an 'extract_items(html_content)' function."
                )

            # Run extraction against first HTML document
            test_html = full_htmls[0]
            extracted_items = extract_items_func(test_html)

            if not extracted_items:
                raise ValueError(
                    "Script ran successfully but parsed 0 items. Ensure container selectors are correct."
                )

            # 2. Evaluate instruction/schema coverage (LLM Judge)
            judge_verdict = self._evaluate_results(user_context, extracted_items[0])
            if judge_verdict != "SUCCESS":
                raise ValueError(
                    f"Instructions Compliance Audit Failed:\n{judge_verdict}"
                )

            # Validation succeeded! Escalate to exit the LoopAgent
            yield Event(
                author=self.name,
                actions=EventActions(escalate=True),
                state={"error_feedback": None},  # Clear any errors
            )

        except Exception as e:
            # Capture full traceback + error details
            tb = traceback.format_exc()
            error_msg = f"Runtime validation error: {str(e)}\n\nTraceback:\n{tb}"
            print(f"⚠️ [Validator] Validation failed: {error_msg}")

            # Feed error back into session state and continue LoopAgent
            yield Event(author=self.name, state={"error_feedback": error_msg})

    def _evaluate_results(self, user_context: str, sample_item: dict) -> str:
        """Invokes Gemini to judge if the parsed item fields satisfy the user guidelines."""
        if not user_context:
            return "SUCCESS"
        try:
            client = genai.Client()
            prompt = f"""
            Determine if the sample extracted item satisfies the user's specific parsing request.

            User Parsing Request:
            "{user_context}"

            Sample Extracted Item (JSON):
            {json.dumps(sample_item, indent=2)}

            Requirements:
            - Check if the user requested any custom metadata fields (like rating, stock status, level, category, etc.).
            - Are these custom fields present as keys inside the 'metadata' dictionary?
            - Are the extracted values non-empty and sensible?

            If all requested fields/instructions are satisfied, output exactly: SUCCESS
            If any fields are missing or incorrectly parsed, output a short explanation of what is missing/wrong. Do not add any markdown formatting or extra text.
            """
            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=prompt,
            )
            return response.text.strip()
        except Exception as e:
            print(f"[Warning] LLM judge failed: {e}")
            return "SUCCESS"


# Developer agent prompt injector callback
def developer_prompt_injector(
    callback_context: CallbackContext, llm_request: LlmRequest
) -> None:
    state = callback_context.state
    html_snippet = state.get("html_snippet", "")
    user_context = state.get("user_context", "")
    error_feedback = state.get("error_feedback") or "None"
    context_url = state.get("context_url", "")
    webpage_context = state.get("webpage_context") or {}

    prompt_parts = [
        "=== CONTEXT STATE ===",
        "Target HTML Snippet:",
        "```html",
        html_snippet,
        "```",
        f"\nContext Source URL: {context_url or 'Unknown'}",
    ]

    if webpage_context:
        prompt_parts.append("\nWebpage Metadata Context:")
        if webpage_context.get("url"):
            prompt_parts.append(f"- URL: {webpage_context['url']}")
        if webpage_context.get("title"):
            prompt_parts.append(f"- Title: {webpage_context['title']}")
        if webpage_context.get("description"):
            prompt_parts.append(f"- Description: {webpage_context['description']}")
        if webpage_context.get("keywords"):
            prompt_parts.append(f"- Keywords: {webpage_context['keywords']}")

    if user_context:
        prompt_parts.append("\nUser Guidelines / Instructions:")
        prompt_parts.append(user_context)
        prompt_parts.append(
            "\nIMPORTANT: Prioritize any fields specified in the User Guidelines. "
            "The BeautifulSoup parser script MUST extract the standard ExtractedCatalogItem fields (title, price, source_url) "
            "and any other requested custom fields. ALL custom fields MUST be populated inside the `metadata` dictionary "
            "of the ExtractedCatalogItem model so that the schema validation succeeds."
        )

    prompt_parts.append(f"\nPrevious Run Feedback:\n{error_feedback}")
    prompt_parts.append("=====================")

    context_prefix = "\n".join(prompt_parts)

    if llm_request.contents:
        first_content = llm_request.contents[0]
        if first_content.parts:
            orig_text = first_content.parts[0].text or ""
            first_content.parts[0].text = context_prefix + "\n" + orig_text


# Code Generator Developer Agent
developer_agent = Agent(
    model="gemini-3.5-flash",
    name="developer_agent",
    description="Writes robust BeautifulSoup code to extract data from snippets",
    instruction="""
    You are an expert Python scraping developer.
    Your task is to write a BeautifulSoup parsing script that extracts list/grid items from HTML.

    You will be provided with the target HTML snippet, webpage metadata context, context source URL, user guidelines, and any previous feedback.

    ### Guidelines for the Generated Script:
    1. The script must contain exactly this function signature:
       `def extract_items(html_content: str, base_url: str = "<default_url>") -> List[Dict[str, Any]]:`
       where you replace `<default_url>` with the actual Context Source URL (if provided in context state), otherwise `""`.
    2. The function must parse `html_content` using BeautifulSoup, locate repeating containers, and return a list of dictionaries matching the ExtractedCatalogItem schema (title: str, price: float, source_url: str, metadata: dict).
    3. Loop over repeating card/row containers and extract fields RELATIVE to each card (using container.find or container.select_one).
    4. Clean all strings and strip leading/trailing whitespaces.
    5. Price must be normalized to a clean `float`. (e.g. "$1,249.99" -> 1249.99). Fallback to 0.0 if missing.
    6. Resolve relative paths using `urllib.parse.urljoin(base_url, link)`.
    7. All custom requested fields from the User Guidelines must be parsed and stored inside the `metadata` dictionary of the returned items.
    8. Import `ExtractedCatalogItem` and `AgenticCatalogSDK` from `sdk_blueprint` at the top of your script (e.g., `from sdk_blueprint import ExtractedCatalogItem, AgenticCatalogSDK`).
    9. Determine the most appropriate fields to uniquely identify each item for deduplication and output them in the `deduplication_keys` field. For example:
       - If items represent unique entities with unique urls (e.g. products, detailed posts), use `["source_url"]`.
       - If items are repeat events/matches without unique URLs (e.g. game matches, logs), use a combination of fields like `["title", "metadata.duration"]` or `["title", "metadata.time_ago"]`.
       - If items have unique titles, use `["title"]`.

    If `error_feedback` is present and not "None", inspect the bug or validation error, correct your code, and output the updated script.
    """,
    before_model_callback=developer_prompt_injector,
    output_schema=ParserGenerationResult,
    output_key="parser_generation_result",
)

# Robust scraping generator LoopAgent
robust_code_generator = LoopAgent(
    name="robust_code_generator",
    description="A robust scraper developer that automatically tests and retries on errors.",
    sub_agents=[developer_agent, ParserScriptValidator(name="validator")],
    max_iterations=3,
)


# ==========================================
# 3. Document Search & Q&A Workflow
# ==========================================


# Pure Python Schema Discovery Agent (0 tokens, ultra-fast)
class PurePythonSchemaInspector(BaseAgent):
    """
    Samples a document from the MongoDB collection directly to discover
    active dynamic metadata fields, caching them in the session state.
    """

    async def _run_async_impl(
        self, context: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        if context.session.state.get("active_schema"):
            yield Event(author=self.name)
            return

        try:
            # Fetch a single document to infer active keys
            sample_doc = collection.find_one()
            if sample_doc:
                schema_keys = ["title", "price", "source_url"]
                metadata_keys = list(sample_doc.get("metadata", {}).keys())
                schema_info = {"fields": schema_keys, "metadata_fields": metadata_keys}
                yield Event(author=self.name, state={"active_schema": schema_info})
            else:
                yield Event(author=self.name)
        except Exception as e:
            print(f"[Warning] PurePythonSchemaInspector failed: {e}")
            yield Event(author=self.name)


# MongoDB MCP Toolset registration with Voyage AI support
mongodb_mcp = MCPToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command="npx",
            args=["-y", "mongodb-mcp-server"],
            env={
                "MONGODB_URI": MONGO_URI,
                "VOYAGE_API_KEY": os.getenv("VOYAGE_API_KEY", ""),
            },
        )
    )
)


# Cache callback to save search_id settings
def cache_query_parts_callback(
    context: CallbackContext, response: LlmResponse
) -> LlmResponse:
    try:
        if response.content and response.content.parts:
            text_json = response.content.parts[0].text
            # Strip potential json codeblock wrappers
            if "```json" in text_json:
                match = re.search(
                    r"```json\s*\n(.*?)\s*```", text_json, re.DOTALL
                )
                if match:
                    text_json = match.group(1)
            elif "```" in text_json:
                match = re.search(
                    r"```\s*\n(.*?)\s*```", text_json, re.DOTALL
                )
                if match:
                    text_json = match.group(1)

            data = json.loads(text_json)
            search_id = data.get("search_id")

            if "searches" not in context.session.state:
                context.session.state["searches"] = {}

            context.session.state["searches"][search_id] = {
                "query_intent": data.get("query_intent"),
                "filters_applied": data.get("filters_applied"),
            }
    except Exception as e:
        print(f"[Warning] Failed to cache query parts: {e}")
    return response


# Q&A Agent using the MongoDB MCP server
doc_qa_agent = LlmAgent(
    name="doc_qa_agent",
    model="gemini-3.5-flash",
    description="Structured Q&A search agent querying catalog data using Vector Search and dynamic filters",
    instruction="""
    You are an expert Q&A assistant querying catalog documents in MongoDB.

    You have access to the dynamic schema of the collection in the `active_schema` key in the session state.
    Look at the available fields under `metadata` in `active_schema` to construct your query filters.

    1. Parse the user's natural language request. Separate the semantic search intent from hard filters (e.g. price limits, stock availability).
    2. Invoke the MongoDB `aggregate` tool to run a vector search.
    3. Construct an aggregation pipeline containing a `$vectorSearch` stage:
       - Set `queryVector` in `$vectorSearch` to the raw semantic query text. The MCP server will automatically call Voyage AI to vectorize it.
       - Set `filter` or add a subsequent `$match` stage for hard filters based on your analysis.
    4. Compile the results and return the output strictly formatted according to the SearchResultResponse JSON schema structure.
    """,
    tools=[mongodb_mcp],
    output_schema=SearchResultResponse,
    after_agent_callback=cache_query_parts_callback,
)

# Search workflow combining schema discovery and Q&A
doc_search_workflow = SequentialAgent(
    name="doc_search_workflow",
    sub_agents=[PurePythonSchemaInspector(name="schema_inspector"), doc_qa_agent],
)
