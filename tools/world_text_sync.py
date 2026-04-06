from __future__ import annotations

import argparse
import json
import re
import unicodedata
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable


VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}

HEADING_RANK = {f"h{i}": i for i in range(1, 7)}
ITEM_CONTAINER_CLASSES = {"object-item", "event-item", "term-item", "country-article"}
SKIP_CLASSES = {"sub-nav"}
TEXT_BLOCK_CLASSES = {"content-paragraph"}
SECTION_BLOCK_RE = re.compile(
    r"(?P<section><section\b[^>]*\bid=(?P<quote>['\"])(?P<id>[^'\"]+)(?P=quote)[^>]*>.*?</section>)",
    re.DOTALL,
)
ASSET_DIRS = ("picture", "voice")


@dataclass
class TextNode:
    text: str


@dataclass
class ElementNode:
    tag: str
    attrs: list[tuple[str, str | None]] = field(default_factory=list)
    children: list["Node"] = field(default_factory=list)

    def attr(self, name: str, default: str | None = None) -> str | None:
        for key, value in self.attrs:
            if key == name:
                return value if value is not None else default
        return default

    def classes(self) -> set[str]:
        value = self.attr("class", "") or ""
        return {item for item in value.split() if item}


Node = ElementNode | TextNode


class SimpleHtmlTreeBuilder(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = ElementNode("document")
        self.stack: list[ElementNode] = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = ElementNode(tag=tag, attrs=attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = ElementNode(tag=tag, attrs=attrs)
        self.stack[-1].children.append(node)

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data: str) -> None:
        if data:
            self.stack[-1].children.append(TextNode(data))


def parse_html_file(path: Path) -> ElementNode:
    parser = SimpleHtmlTreeBuilder()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser.root


def direct_element_children(node: ElementNode) -> list[ElementNode]:
    return [child for child in node.children if isinstance(child, ElementNode)]


def is_whitespace_text(node: Node) -> bool:
    return isinstance(node, TextNode) and not node.text.strip()


def normalize_text(value: str) -> str:
    value = value.replace("\xa0", " ").replace("\u3000", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def text_content(node: Node) -> str:
    parts: list[str] = []

    def walk(current: Node) -> None:
        if isinstance(current, TextNode):
            parts.append(current.text)
            return
        for child in current.children:
            walk(child)

    walk(node)
    return normalize_text("".join(parts))


def find_first(node: ElementNode, predicate) -> ElementNode | None:
    for child in direct_element_children(node):
        if predicate(child):
            return child
        found = find_first(child, predicate)
        if found is not None:
            return found
    return None


def find_all(node: ElementNode, predicate) -> list[ElementNode]:
    found: list[ElementNode] = []
    for child in direct_element_children(node):
        if predicate(child):
            found.append(child)
        found.extend(find_all(child, predicate))
    return found


def is_heading(node: Node) -> bool:
    return isinstance(node, ElementNode) and node.tag in HEADING_RANK


def heading_rank(node: ElementNode) -> int:
    return HEADING_RANK[node.tag]


def first_direct_heading(node: ElementNode) -> ElementNode | None:
    for child in direct_element_children(node):
        if child.tag in HEADING_RANK:
            return child
    return None


def is_skip_node(node: Node) -> bool:
    return isinstance(node, ElementNode) and bool(node.classes() & SKIP_CLASSES)


def is_container_item(node: Node) -> bool:
    return (
        isinstance(node, ElementNode)
        and bool(node.attr("id"))
        and bool(node.classes() & ITEM_CONTAINER_CLASSES)
    )


def find_meta_content(root: ElementNode, name: str) -> str | None:
    for meta in find_all(root, lambda element: element.tag == "meta"):
        if meta.attr("name") == name:
            return meta.attr("content")
    return None


def extract_table_rows(node: ElementNode) -> list[list[str]]:
    rows: list[list[str]] = []
    for row in find_all(node, lambda element: element.tag == "tr"):
        cells = [
            text_content(cell)
            for cell in direct_element_children(row)
            if cell.tag in {"th", "td"} and text_content(cell)
        ]
        if cells:
            rows.append(cells)
    return rows


def extract_content_blocks_from_node(node: Node) -> list[dict[str, Any]]:
    if isinstance(node, TextNode):
        return []

    if node.tag == "p" or (node.tag == "div" and bool(node.classes() & TEXT_BLOCK_CLASSES)):
        block_text = text_content(node)
        if block_text:
            return [{"type": "paragraph", "text": block_text}]
        images = []
        for image in find_all(node, lambda element: element.tag == "img"):
            images.append(
                {
                    "type": "image",
                    "src": image.attr("src"),
                    "alt": image.attr("alt"),
                }
            )
        return images

    if node.tag == "img":
        return [{"type": "image", "src": node.attr("src"), "alt": node.attr("alt")}]

    if node.tag == "table":
        rows = extract_table_rows(node)
        if rows:
            return [
                {
                    "type": "table",
                    "rows": rows,
                    "text": normalize_text(" | ".join(" / ".join(row) for row in rows)),
                }
            ]
        return []

    blocks: list[dict[str, Any]] = []
    for child in node.children:
        if not is_whitespace_text(child):
            blocks.extend(extract_content_blocks_from_node(child))
    return blocks


def build_group_from_heading(
    heading_node: ElementNode,
    sibling_nodes: list[Node],
    parent_level: int,
) -> dict[str, Any]:
    content_blocks, nested_items = extract_body(sibling_nodes, parent_level=heading_rank(heading_node))
    return {
        "id": heading_node.attr("id"),
        "title": text_content(heading_node),
        "heading_tag": heading_node.tag,
        "content_blocks": content_blocks,
        "items": nested_items,
    }


def extract_groups_from_heading_sequence(nodes: list[Node], level: int) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    current_heading: ElementNode | None = None
    current_body: list[Node] = []

    for node in nodes:
        if isinstance(node, ElementNode) and node.tag in HEADING_RANK and heading_rank(node) == level:
            if current_heading is not None:
                groups.append(
                    build_group_from_heading(
                        current_heading,
                        current_body,
                        parent_level=level - 1,
                    )
                )
            current_heading = node
            current_body = []
        elif current_heading is not None:
            current_body.append(node)

    if current_heading is not None:
        groups.append(build_group_from_heading(current_heading, current_body, parent_level=level - 1))

    return groups


def extract_wrapper_groups(node: ElementNode, parent_level: int) -> list[dict[str, Any]]:
    if node.attr("id") or bool(node.classes() & SKIP_CLASSES):
        return []

    direct_children = [child for child in node.children if not is_whitespace_text(child)]
    if not direct_children:
        return []

    container_children = [child for child in direct_children if is_container_item(child)]
    if container_children:
        return [extract_item_from_container(child) for child in container_children]  # type: ignore[arg-type]

    heading_levels = sorted(
        {
            heading_rank(child)
            for child in direct_children
            if isinstance(child, ElementNode)
            and child.tag in HEADING_RANK
            and heading_rank(child) > parent_level
        }
    )
    if not heading_levels:
        return []

    return extract_groups_from_heading_sequence(direct_children, heading_levels[0])


def extract_body(nodes: list[Node], parent_level: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    content_blocks: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []

    index = 0
    while index < len(nodes):
        node = nodes[index]

        if is_whitespace_text(node) or is_skip_node(node):
            index += 1
            continue

        if is_container_item(node):
            items.append(extract_item_from_container(node))
            index += 1
            continue

        if isinstance(node, ElementNode) and node.tag in HEADING_RANK and heading_rank(node) > parent_level:
            items.extend(extract_groups_from_heading_sequence(nodes[index:], heading_rank(node)))
            break

        if isinstance(node, ElementNode):
            wrapper_groups = extract_wrapper_groups(node, parent_level=parent_level)
            if wrapper_groups:
                items.extend(wrapper_groups)
                index += 1
                continue

        content_blocks.extend(extract_content_blocks_from_node(node))
        index += 1

    return content_blocks, items


def extract_item_from_container(node: ElementNode) -> dict[str, Any]:
    title_node = first_direct_heading(node)
    if title_node is not None:
        item_title = text_content(title_node)
        body_nodes = node.children[node.children.index(title_node) + 1 :]
        item_level = heading_rank(title_node)
        item_id = node.attr("id") or title_node.attr("id")
        heading_tag = title_node.tag
    else:
        item_title = node.attr("id") or ""
        body_nodes = node.children
        item_level = 2
        item_id = node.attr("id")
        heading_tag = None

    content_blocks, nested_items = extract_body(body_nodes, parent_level=item_level)
    return {
        "id": item_id,
        "title": item_title,
        "heading_tag": heading_tag,
        "content_blocks": content_blocks,
        "items": nested_items,
    }


def extract_section(node: ElementNode) -> dict[str, Any]:
    title_node = first_direct_heading(node)
    section_title = text_content(title_node) if title_node else node.attr("id") or ""
    section_level = heading_rank(title_node) if title_node else 1
    body_nodes = node.children[node.children.index(title_node) + 1 :] if title_node else node.children
    intro_blocks, items = extract_body(body_nodes, parent_level=section_level)

    return {
        "id": node.attr("id"),
        "title": section_title,
        "heading_tag": title_node.tag if title_node else None,
        "content_blocks": intro_blocks,
        "items": items,
    }


def count_text_blocks(blocks: Iterable[dict[str, Any]]) -> int:
    return sum(1 for block in blocks if block.get("type") in {"paragraph", "table"})


def aggregate_text(entry: dict[str, Any]) -> str:
    parts: list[str] = []
    for block in entry.get("content_blocks", []):
        text = block.get("text")
        if text:
            parts.append(str(text))
    for item in entry.get("items", []):
        parts.append(aggregate_text(item))
    return normalize_text("\n".join(part for part in parts if part))


def normalize_key(value: str | None) -> str:
    if not value:
        return ""
    value = unicodedata.normalize("NFKC", value)
    value = re.sub(r"[\s\"'“”‘’·,，。.!！？：:;；、\-\(\)（）【】\[\]]+", "", value)
    return value.casefold()


def build_lookup(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for item in items:
        item_id = normalize_key(item.get("id"))
        title_key = normalize_key(item.get("title"))
        for key in {item_id, title_key}:
            if key and key not in lookup:
                lookup[key] = item
    return lookup


def compare_entries(source_entry: dict[str, Any], current_entry: dict[str, Any] | None) -> dict[str, Any]:
    source_text = aggregate_text(source_entry)
    source_lookup = build_lookup(source_entry.get("items", []))
    current_items = current_entry.get("items", []) if current_entry else []
    current_lookup = build_lookup(current_items)

    if current_entry is None:
        return {
            "source_id": source_entry.get("id"),
            "source_title": source_entry.get("title"),
            "current_id": None,
            "current_title": None,
            "status": "missing",
            "source_text_blocks": count_text_blocks(source_entry.get("content_blocks", [])),
            "current_text_blocks": 0,
            "source_child_count": len(source_entry.get("items", [])),
            "current_child_count": 0,
            "similarity": 0.0,
            "items": [compare_entries(item, None) for item in source_entry.get("items", [])],
        }

    current_text = aggregate_text(current_entry)
    similarity = round(SequenceMatcher(None, source_text, current_text).ratio(), 4)
    nested_reports: list[dict[str, Any]] = []

    matched_current_keys: set[int] = set()
    for source_item in source_entry.get("items", []):
        match = None
        for key in (normalize_key(source_item.get("id")), normalize_key(source_item.get("title"))):
            if key and key in current_lookup:
                match = current_lookup[key]
                matched_current_keys.add(id(match))
                break
        nested_reports.append(compare_entries(source_item, match))

    extra_current = [
        {"id": item.get("id"), "title": item.get("title")}
        for item in current_items
        if id(item) not in matched_current_keys
    ]

    if similarity >= 0.999 and not extra_current and all(report["status"] == "identical" for report in nested_reports):
        status = "identical"
    elif not current_text and source_text:
        status = "missing_text"
    elif len(source_entry.get("items", [])) > len(current_items):
        status = "simplified"
    elif similarity < 0.8:
        status = "changed"
    else:
        status = "partial_match"

    return {
        "source_id": source_entry.get("id"),
        "source_title": source_entry.get("title"),
        "current_id": current_entry.get("id"),
        "current_title": current_entry.get("title"),
        "status": status,
        "source_text_blocks": count_text_blocks(source_entry.get("content_blocks", [])),
        "current_text_blocks": count_text_blocks(current_entry.get("content_blocks", [])),
        "source_child_count": len(source_entry.get("items", [])),
        "current_child_count": len(current_items),
        "similarity": similarity,
        "extra_current_items": extra_current,
        "items": nested_reports,
    }


def section_lookup(sections: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for section in sections:
        section_id = normalize_key(section.get("id"))
        section_title = normalize_key(section.get("title"))
        for key in {section_id, section_title}:
            if key and key not in lookup:
                lookup[key] = section
    return lookup


def extract_document(path: Path) -> dict[str, Any]:
    root = parse_html_file(path)
    main = find_first(root, lambda element: element.tag == "main" and "content-area" in element.classes())
    if main is None:
        raise ValueError(f"Could not find main content area in {path}")

    sections = [extract_section(section) for section in find_all(main, lambda element: element.tag == "section" and bool(element.attr("id")))]
    page_id = find_meta_content(root, "page-id")
    page_title = find_meta_content(root, "page-title")

    return {
        "file": str(path.as_posix()),
        "page_id": page_id,
        "page_title": page_title,
        "sections": sections,
    }


def compare_source_to_pages(source_doc: dict[str, Any], page_docs: list[dict[str, Any]]) -> dict[str, Any]:
    source_sections = source_doc.get("sections", [])
    source_lookup = section_lookup(source_sections)
    page_reports: list[dict[str, Any]] = []

    for page_doc in page_docs:
        page_key = normalize_key(page_doc.get("page_id"))
        page_title_key = normalize_key(page_doc.get("page_title"))
        source_section = None
        for key in (page_key, page_title_key):
            if key and key in source_lookup:
                source_section = source_lookup[key]
                break

        current_section = page_doc["sections"][0] if page_doc.get("sections") else None
        report = {
            "file": page_doc.get("file"),
            "page_id": page_doc.get("page_id"),
            "page_title": page_doc.get("page_title"),
            "matched_source_section": source_section.get("id") if source_section else None,
            "comparison": compare_entries(source_section, current_section) if source_section else None,
        }
        page_reports.append(report)

    return {
        "source_file": source_doc.get("file"),
        "page_reports": page_reports,
    }


def summarize_report(report: dict[str, Any]) -> str:
    lines = ["# indexyuan 与子页正文对照摘要", ""]
    for page_report in report.get("page_reports", []):
        comparison = page_report.get("comparison")
        page_name = page_report.get("page_title") or page_report.get("page_id") or page_report.get("file")
        if comparison is None:
            lines.append(f"- {page_name}: 未找到对应的原始 section")
            continue

        lines.append(
            "- "
            f"{page_name}: 状态={comparison['status']}, "
            f"相似度={comparison['similarity']}, "
            f"原始子项={comparison['source_child_count']}, "
            f"当前子项={comparison['current_child_count']}"
        )

        changed_items = collect_non_identical_items(comparison.get("items", []), prefix=page_name)
        for item in changed_items[:8]:
            lines.append(
                f"  - {item['path']}: 状态={item['status']}, 相似度={item['similarity']}, "
                f"原始子项={item['source_child_count']}, 当前子项={item['current_child_count']}"
            )
    lines.append("")
    return "\n".join(lines)


def collect_non_identical_items(items: list[dict[str, Any]], prefix: str) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = []
    for item in items:
        path = f"{prefix} / {item.get('source_title') or item.get('source_id') or '未命名条目'}"
        if item.get("status") != "identical":
            collected.append(
                {
                    "path": path,
                    "status": item.get("status"),
                    "similarity": item.get("similarity"),
                    "source_child_count": item.get("source_child_count"),
                    "current_child_count": item.get("current_child_count"),
                }
            )
        collected.extend(collect_non_identical_items(item.get("items", []), path))
    return collected


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def extract_section_html_map(raw_html: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    for match in SECTION_BLOCK_RE.finditer(raw_html):
        sections[match.group("id")] = match.group("section")
    return sections


def prefix_section_asset_paths(section_html: str) -> str:
    updated = section_html
    for asset_dir in ASSET_DIRS:
        updated = re.sub(
            rf'((?:src|href)\s*=\s*["\']){re.escape(asset_dir)}/',
            rf"\1../{asset_dir}/",
            updated,
        )
        updated = re.sub(
            rf'(url\(\s*["\']?){re.escape(asset_dir)}/',
            rf"\1../{asset_dir}/",
            updated,
        )
    return updated


def sync_split_pages_from_source(source_path: Path, pages_dir: Path) -> list[str]:
    source_html = source_path.read_text(encoding="utf-8")
    source_sections = extract_section_html_map(source_html)
    updated_files: list[str] = []

    for page_path in sorted(pages_dir.glob("*.html")):
        current_html = page_path.read_text(encoding="utf-8")
        page_doc = extract_document(page_path)
        section_id = page_doc.get("page_id") or page_path.stem
        if not section_id or section_id not in source_sections:
            continue

        replacement_section = prefix_section_asset_paths(source_sections[section_id])
        pattern = re.compile(
            rf'<section\b[^>]*\bid=(?P<quote>["\']){re.escape(section_id)}(?P=quote)[^>]*>.*?</section>',
            re.DOTALL,
        )
        updated_html, replacements = pattern.subn(replacement_section, current_html, count=1)
        if replacements and updated_html != current_html:
            page_path.write_text(updated_html, encoding="utf-8")
            updated_files.append(page_path.as_posix())

    return updated_files


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract structured text from indexyuan.html and compare it with split pages.",
    )
    parser.add_argument("--source", default="indexyuan.html", help="Path to the original combined HTML file.")
    parser.add_argument("--pages", default="pages", help="Path to the directory containing split pages.")
    parser.add_argument(
        "--output-dir",
        default="data/text-sync",
        help="Directory for generated JSON and summary files.",
    )
    parser.add_argument(
        "--apply-pages",
        action="store_true",
        help="Replace each split page section with the matching original section from the source file.",
    )
    args = parser.parse_args()

    source_path = Path(args.source)
    pages_dir = Path(args.pages)
    output_dir = Path(args.output_dir)
    ensure_dir(output_dir)

    updated_files: list[str] = []
    if args.apply_pages:
        updated_files = sync_split_pages_from_source(source_path, pages_dir)

    source_doc = extract_document(source_path)
    page_docs = [extract_document(path) for path in sorted(pages_dir.glob("*.html"))]
    report = compare_source_to_pages(source_doc, page_docs)

    source_output = output_dir / "indexyuan-structured.json"
    pages_output = output_dir / "split-pages-structured.json"
    report_output = output_dir / "text-sync-report.json"
    summary_output = output_dir / "text-sync-summary.md"

    source_output.write_text(json.dumps(source_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    pages_output.write_text(json.dumps(page_docs, ensure_ascii=False, indent=2), encoding="utf-8")
    report_output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    summary_output.write_text(summarize_report(report), encoding="utf-8")

    if updated_files:
        print("Updated split pages:")
        for updated_file in updated_files:
            print(f"  {updated_file}")
    print(f"Wrote {source_output.as_posix()}")
    print(f"Wrote {pages_output.as_posix()}")
    print(f"Wrote {report_output.as_posix()}")
    print(f"Wrote {summary_output.as_posix()}")


if __name__ == "__main__":
    main()
