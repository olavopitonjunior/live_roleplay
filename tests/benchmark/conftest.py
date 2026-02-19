"""Benchmark test fixtures for LiveKit room setup and audio operations."""
import pytest
import os
import json
import time
from datetime import datetime
from pathlib import Path

RESULTS_DIR = Path(__file__).parent / "results"
FIXTURES_DIR = Path(__file__).parent / "fixtures"


def pytest_addoption(parser):
    parser.addoption(
        "--agent-type",
        action="store",
        default="openai_realtime",
        help="Agent type to benchmark: openai_realtime or pipecat_modular",
    )


@pytest.fixture
def agent_type(request):
    return request.config.getoption("--agent-type")


@pytest.fixture
def results_dir():
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    return RESULTS_DIR


@pytest.fixture
def fixtures_dir():
    return FIXTURES_DIR


def save_result(metric_name: str, agent_type: str, data: dict, results_dir: Path = RESULTS_DIR):
    """Save benchmark result as timestamped JSON."""
    results_dir.mkdir(parents=True, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")
    filepath = results_dir / f"{today}_{agent_type}_results.json"

    # Load existing or create new
    if filepath.exists():
        with open(filepath) as f:
            results = json.load(f)
    else:
        results = {
            "date": today,
            "stack": agent_type,
            "agent_version": os.popen("git rev-parse --short HEAD 2>/dev/null").read().strip() or "unknown",
            "metrics": {},
            "manual_evaluation": None,
        }

    results["metrics"][metric_name] = data
    with open(filepath, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    return filepath
