from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SnippetGenerationRequest(BaseModel):
    html_snippet: str = Field(
        description="The stripped innerHTML node snippet from the page container"
    )
    context_url: Optional[str] = Field(
        default=None, description="The URL of the source page for metadata context"
    )
    user_context: Optional[str] = Field(
        default=None,
        description="Optional natural language instructions, guidelines, or queries from the user describing target fields",
    )
    webpage_context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional metadata about the webpage (e.g. title, description, keywords, url)",
    )


class SnippetGenerationResponse(BaseModel):
    success: bool = Field(
        description="Indicates whether code generation was successful"
    )
    generated_code: str = Field(
        description="The generated BeautifulSoup Python parsing code"
    )
    selectors: Dict[str, Any] = Field(
        default_factory=dict, description="Inferred CSS selectors for the data items"
    )
    message: str = Field(description="Status message or error logs")


class ExecutionRequest(BaseModel):
    generated_code: str = Field(description="The Python code block to execute")
    full_html: Optional[str] = Field(
        default=None,
        description="The full page HTML document to run the parser against",
    )
    full_htmls: Optional[List[str]] = Field(
        default=None,
        description="A list of full page HTML documents to run the parser against",
    )
    collection_name: Optional[str] = Field(
        default="catalog_items", description="Target database collection name"
    )
    unique_key: Optional[str] = Field(
        default="title", description="The unique key for upserting"
    )


class ExecutionResponse(BaseModel):
    success: bool = Field(
        description="Indicates if script execution completed without errors"
    )
    items_count: int = Field(
        default=0, description="Number of items successfully parsed"
    )
    parsed_items: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Extracted records conforming to ExtractedCatalogItem",
    )
    logs: str = Field(description="Standard execution logs and script printouts")
