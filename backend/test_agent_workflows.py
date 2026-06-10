# test_agent_workflows.py
import pytest
from agent_workflows import ParserScriptValidator, robust_code_generator
from fastapi.testclient import TestClient
from google.adk.runners import InMemoryRunner
from main import app
from schemas import FilterInput, InstantSearchRequest, QueryCatalogRequest

client = TestClient(app)

# Initialize a real runner to create real sessions
test_runner = InMemoryRunner(agent=robust_code_generator)


class DummyContext:
    def __init__(self, session):
        self.session = session


def test_schemas():
    """Verify that input/output validation schemas can be instantiated correctly."""
    filter_input = FilterInput(field="price", operator="less_than", value=300.0)
    assert filter_input.field == "price"
    assert filter_input.operator == "less_than"
    assert filter_input.value == 300.0

    query_req = QueryCatalogRequest(
        conversation_id="conv_123", user_prompt="gaming keyboard"
    )
    assert query_req.conversation_id == "conv_123"
    assert query_req.user_prompt == "gaming keyboard"

    instant_req = InstantSearchRequest(
        conversation_id="conv_123",
        search_id="search_abc",
        updated_filters=[filter_input],
    )
    assert instant_req.conversation_id == "conv_123"
    assert instant_req.search_id == "search_abc"
    assert len(instant_req.updated_filters) == 1


@pytest.mark.asyncio
async def test_parser_validator_compile_error():
    """Verify that ParserScriptValidator catches syntax errors and sets error_feedback state."""
    session = await test_runner.session_service.create_session(
        app_name=test_runner.app_name, user_id="test_user", session_id="test_session_1"
    )
    session.state["generated_code"] = (
        "def invalid_python_syntax( {"  # Missing closing bracket
    )
    session.state["html_snippet"] = "<div></div>"
    session.state["full_htmls"] = ["<div></div>"]

    context = DummyContext(session)
    validator = ParserScriptValidator(name="validator")

    events = []
    async for event in validator._run_async_impl(context):
        events.append(event)

    assert len(events) == 1
    event = events[0]
    assert event.author == "validator"
    assert event.actions is not None
    # Verify the traceback / compile error was captured in state_delta
    assert "error_feedback" in event.actions.state_delta
    assert (
        "SyntaxError" in event.actions.state_delta["error_feedback"]
        or "validation error" in event.actions.state_delta["error_feedback"]
    )


@pytest.mark.asyncio
async def test_parser_validator_execution_success():
    """Verify that ParserScriptValidator successfully validates compliant scraper code and escalates."""
    valid_code = """
def extract_items(html_content, base_url=""):
    return [
        {
            "title": "Item A",
            "price": 19.99,
            "source_url": "https://example.com/a",
            "metadata": {}
        }
    ]
"""
    session = await test_runner.session_service.create_session(
        app_name=test_runner.app_name, user_id="test_user", session_id="test_session_2"
    )
    session.state["generated_code"] = valid_code
    session.state["html_snippet"] = "<div></div>"
    session.state["full_htmls"] = ["<div></div>"]

    context = DummyContext(session)
    validator = ParserScriptValidator(name="validator")

    events = []
    async for event in validator._run_async_impl(context):
        events.append(event)

    assert len(events) == 1
    event = events[0]
    assert event.author == "validator"
    # Succeeded validation should trigger loop escalation (exit loop)
    assert event.actions is not None
    assert event.actions.escalate is True
    assert event.actions.state_delta.get("error_feedback") is None


def test_instant_search_missing_session():
    """Verify that instant-search endpoint returns 404 if no session is active."""
    payload = {
        "conversation_id": "non_existent_conv",
        "search_id": "search_123",
        "updated_filters": [],
    }
    response = client.post("/api/instant-search", json=payload)
    assert response.status_code == 404
    assert "No active search session found" in response.json()["detail"]
