import importlib.util
import sys
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "tools" / "world_text_sync.py"
SPEC = importlib.util.spec_from_file_location("world_text_sync", MODULE_PATH)
assert SPEC and SPEC.loader
world_text_sync = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = world_text_sync
SPEC.loader.exec_module(world_text_sync)


def test_new_non_world_pages_are_excluded_from_world_text_sync() -> None:
    expected = {
        "map.html",
        "objects.html",
        "events.html",
        "terms.html",
        "organizations.html",
        "countries.html",
        "other.html",
        "mythology.html",
        "timeline.html",
    }
    pages_dir = MODULE_PATH.parents[1] / "pages"
    assert (pages_dir / "characters.html").exists()
    assert {path.name for path in world_text_sync.iter_sync_pages(pages_dir)} == expected
