"""Tests for ``halo_api.refs.grammar`` — generic tag parsing (step 5-1).

Covers:
- Simple and multiple extraction
- Non-conforming ``{...}`` patterns silently ignored
- ``ref_no`` must be ≥ 1 (``{LIST:0}`` rejected)
- Leading-zero ``ref_no`` (``{LIST:01}``) rejected
- Text without any tag → empty list
- ``is_valid_prefix`` membership check
- ``iter_unique_refs`` deduplication
- Span correctness
"""

from halo_api.refs.grammar import (
    TAG_RE,
    is_valid_prefix,
    iter_unique_refs,
    parse_tags,
)

# ── TAG_RE pattern ────────────────────────────────────────────────────────────


def test_tag_re_matches_simple_tag() -> None:
    """TAG_RE matches a minimal ``{LIST:1}``."""
    m = TAG_RE.search("foo {LIST:1} bar")
    assert m is not None
    assert m.group(1) == "LIST"
    assert m.group(2) == "1"


def test_tag_re_matches_multi_char_prefix() -> None:
    """TAG_RE matches a prefix with several uppercase letters (e.g. ``NOTE``)."""
    m = TAG_RE.search("see {NOTE:42} for details")
    assert m is not None
    assert m.group(1) == "NOTE"
    assert m.group(2) == "42"


def test_tag_re_rejects_lowercase_prefix() -> None:
    """TAG_RE rejects a tag whose prefix contains lowercase letters."""
    assert TAG_RE.search("{List:1}") is None
    assert TAG_RE.search("{list:1}") is None


def test_tag_re_rejects_single_char_prefix() -> None:
    """TAG_RE rejects single-character prefixes like ``#`` or ``@``."""
    assert TAG_RE.search("{#:1}") is None
    assert TAG_RE.search("{@:1}") is None


def test_tag_re_rejects_ref_no_zero() -> None:
    """TAG_RE rejects ``ref_no == 0`` (minimum is 1)."""
    assert TAG_RE.search("{LIST:0}") is None


def test_tag_re_rejects_leading_zero_ref_no() -> None:
    """TAG_RE rejects ref_no with leading zeros (e.g. ``{LIST:01}``).

    The regex ``[1-9][0-9]*`` intentionally forbids a leading zero so
    that the serialised form is unambiguous and matches what humans
    naturally type for ref_no ≥ 1.
    """
    assert TAG_RE.search("{LIST:01}") is None
    assert TAG_RE.search("{NOTE:001}") is None


def test_tag_re_rejects_spaces_inside_braces() -> None:
    """TAG_RE rejects tags with internal whitespace."""
    assert TAG_RE.search("{ LIST:1}") is None
    assert TAG_RE.search("{LIST :1}") is None
    assert TAG_RE.search("{LIST: 1}") is None
    assert TAG_RE.search("{LIST:1 }") is None


def test_tag_re_rejects_unclosed_brace() -> None:
    """TAG_RE does not match a tag missing its closing brace."""
    assert TAG_RE.search("{LIST:1") is None


def test_tag_re_rejects_unopened_brace() -> None:
    """TAG_RE does not match a tag missing its opening brace."""
    assert TAG_RE.search("LIST:1}") is None


def test_tag_re_rejects_empty_prefix() -> None:
    """TAG_RE rejects ``{:1}`` (empty prefix)."""
    assert TAG_RE.search("{:1}") is None


def test_tag_re_rejects_empty_ref_no() -> None:
    """TAG_RE rejects ``{LIST:}`` (empty ref_no)."""
    assert TAG_RE.search("{LIST:}") is None


def test_tag_re_multiple_tags_in_text() -> None:
    """Several valid tags are each found by ``finditer``."""
    text = "{LIST:1} and {NOTE:2} and {BOOK:10}"
    matches = list(TAG_RE.finditer(text))
    assert len(matches) == 3
    assert [(m.group(1), m.group(2)) for m in matches] == [
        ("LIST", "1"),
        ("NOTE", "2"),
        ("BOOK", "10"),
    ]


# ── parse_tags ────────────────────────────────────────────────────────────────


def test_parse_single_tag() -> None:
    """A single tag is extracted with its prefix, ref_no, and span."""
    tags = parse_tags("Before {LIST:42} after")
    assert len(tags) == 1
    prefix, ref_no, span = tags[0]
    assert prefix == "LIST"
    assert ref_no == 42
    # "Before " = 7 chars → span starts at 7
    assert span == (7, 7 + len("{LIST:42}"))


def test_parse_multiple_tags() -> None:
    """All valid tags are returned in order."""
    tags = parse_tags("{LIST:1} {NOTE:2} {BOOK:3}")
    assert len(tags) == 3
    assert [(p, r) for p, r, _ in tags] == [("LIST", 1), ("NOTE", 2), ("BOOK", 3)]


def test_parse_ignores_non_conforming_braces() -> None:
    """Arbitrary ``{...}`` patterns that don't match the grammar are skipped."""
    text = "{LIST:1} {random} {NOT_A_TAG} {NOTE:5} {LIST:0} {LIST:01}"
    tags = parse_tags(text)
    assert len(tags) == 2
    assert [(p, r) for p, r, _ in tags] == [("LIST", 1), ("NOTE", 5)]


def test_parse_ignores_non_integer_ref_no() -> None:
    """A tag whose ref_no is not a positive integer is ignored."""
    tags = parse_tags("{LIST:abc} {LIST:1} {NOTE:1.5}")
    assert len(tags) == 1
    assert tags[0][0] == "LIST"
    assert tags[0][1] == 1


def test_parse_text_without_tags() -> None:
    """A string containing no tags returns an empty list."""
    assert parse_tags("") == []
    assert parse_tags("plain text without any tag") == []
    assert parse_tags("{almost} but not quite") == []


def test_parse_tags_span_exact() -> None:
    """Spans cover the exact ``{PREFIX:ref_no}`` substring."""
    text = "aa {LIST:9} bb {NOTE:99}"
    tags = parse_tags(text)
    assert len(tags) == 2
    for _prefix, _ref_no, (start, end) in tags:
        assert text[start:end] == f"{{{_prefix}:{_ref_no}}}"


def test_parse_adjacent_tags() -> None:
    """Adjacent tags (no space between them) are parsed separately."""
    tags = parse_tags("{LIST:1}{NOTE:2}")
    assert len(tags) == 2
    assert tags[0][0] == "LIST"
    assert tags[1][0] == "NOTE"


def test_parse_tag_with_newlines() -> None:
    """Tags spanning or adjacent to newlines are parsed correctly."""
    text = "Line 1\n{LIST:7}\nLine 3"
    tags = parse_tags(text)
    assert len(tags) == 1
    assert tags[0][0] == "LIST"
    assert tags[0][1] == 7


# ── is_valid_prefix ───────────────────────────────────────────────────────────


def test_is_valid_prefix_member() -> None:
    """A prefix present in the active set is valid."""
    assert is_valid_prefix("LIST", {"LIST", "NOTE", "BOOK"}) is True


def test_is_valid_prefix_non_member() -> None:
    """A prefix absent from the active set is NOT valid."""
    assert is_valid_prefix("CALD", {"LIST", "NOTE"}) is False


def test_is_valid_prefix_empty_set() -> None:
    """No prefix is valid when the active set is empty."""
    assert is_valid_prefix("LIST", set()) is False


def test_is_valid_prefix_case_sensitive() -> None:
    """Prefix matching is exact (case-sensitive)."""
    assert is_valid_prefix("list", {"LIST"}) is False
    assert is_valid_prefix("List", {"LIST"}) is False


# ── iter_unique_refs ──────────────────────────────────────────────────────────


def test_iter_unique_refs_basic() -> None:
    """Unique (prefix, ref_no) pairs are returned."""
    refs = iter_unique_refs("{LIST:1} {NOTE:2}")
    assert refs == {("LIST", 1), ("NOTE", 2)}


def test_iter_unique_refs_deduplicates() -> None:
    """Repeated tags are deduplicated."""
    refs = iter_unique_refs("{LIST:1} {LIST:1} {LIST:2}")
    assert refs == {("LIST", 1), ("LIST", 2)}


def test_iter_unique_refs_ignores_invalid() -> None:
    """Invalid tags do not appear in the result."""
    refs = iter_unique_refs("{LIST:1} {LIST:0} {:99} {x:1}")
    assert refs == {("LIST", 1)}


def test_iter_unique_refs_empty_text() -> None:
    """An empty string yields an empty set."""
    assert iter_unique_refs("") == set()


# ── Real-world snippets ───────────────────────────────────────────────────────


def test_realistic_description_with_tags() -> None:
    """A realistic multi-line description containing several tags."""
    text = (
        "Pour préparer le voyage, voir {LIST:1} et {NOTE:3}.\n"
        "Penser aussi à {LIST:2} pour les visas.\n"
        "Ne pas oublier {BOOK:1}."
    )
    tags = parse_tags(text)
    assert len(tags) == 4
    assert [(p, r) for p, r, _ in tags] == [
        ("LIST", 1),
        ("NOTE", 3),
        ("LIST", 2),
        ("BOOK", 1),
    ]


def test_tag_prefixes_are_uppercase_only() -> None:
    """Every parsed tag prefix consists solely of uppercase A-Z letters."""
    text = "{LIST:1} {NOTE:2} {BOOK:3} {CALD:4}"
    tags = parse_tags(text)
    for prefix, _ref_no, _span in tags:
        assert prefix.isascii() and prefix.isupper(), (
            f"Prefix {prefix!r} is not uppercase ASCII"
        )
