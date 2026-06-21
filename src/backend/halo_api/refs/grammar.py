"""Generic tag grammar and parser for ``{PREFIX:ref_no}`` references (T-100).

This module is **independent of any concrete module** — it only knows about
the tag *shape*, not which prefixes are valid in a given deployment.  The
caller supplies the set of active prefixes via :func:`is_valid_prefix`.

Grammar (specs/01 §6.1, specs/03 §9)
-------------------------------------
A tag has the **strict** form ``{PREFIX:ref_no}`` where:

* ``PREFIX`` — one or more **uppercase** ASCII letters (``[A-Z]+``).
* ``:`` — literal colon (no spaces around it).
* ``ref_no`` — positive integer **without leading zeros** (``[1-9][0-9]*``),
  i.e. the human-readable reference number (≥ 1) of the target object.

The pattern is **anchored** on the literal braces ``{…}`` — anything that
does not match exactly is silently ignored by the parser.  There is no
support for single-character prefixes (``#``, ``@``, etc.) — the spec
requires ``{PREFIX:ref_no}`` with uppercase letters.

Storage note (T-101)
--------------------
Tags are stored **raw** (e.g. ``{NOTE:12}``) in database text fields.
Title and UUID resolution happens at **display time** via the target
module's ``resolve_refs`` — this module only extracts the (prefix, ref_no)
pairs.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    #: A parsed tag: (prefix, ref_no, (start, end) character span in source text).
    Tag = tuple[str, int, tuple[int, int]]

# ── Grammar ────────────────────────────────────────────────────────────────────

# The regex is written so that each valid tag is captured in its entirety
# by a single match.  Capturing groups isolate the prefix and ref_no.
#
# Breakdown:
#   \{              literal opening brace
#   ([A-Z]+)        group 1: prefix — one or more uppercase letters
#   :               literal colon
#   ([1-9][0-9]*)   group 2: ref_no — positive integer, no leading zero
#   \}              literal closing brace
#
# Whitespace and other characters inside the braces cause the match to
# fail, so ``{ LIST:1}``, ``{LIST: 1}``, ``{LIST:1 }`` are all ignored.
TAG_RE: re.Pattern[str] = re.compile(r"\{([A-Z]+):([1-9][0-9]*)\}")

# ── Public API ─────────────────────────────────────────────────────────────────


def parse_tags(text: str) -> list[Tag]:
    """Extract **every** well-formed tag from *text*.

    Returns:
        List of ``(prefix, ref_no, span)`` tuples, in the order they
        appear in the source text.  *ref_no* is already converted to
        :class:`int`.
    """
    tags: list[Tag] = []
    for m in TAG_RE.finditer(text):
        prefix: str = m.group(1)
        ref_no: int = int(m.group(2))
        span: tuple[int, int] = m.span()
        tags.append((prefix, ref_no, span))
    return tags


def is_valid_prefix(prefix: str, active_prefixes: set[str]) -> bool:
    """Return ``True`` iff *prefix* belongs to an **activated** module.

    The set of active prefixes is provided by the caller (typically the
    module registry).  This module never hard-codes any concrete prefix.
    """
    return prefix in active_prefixes


def iter_unique_refs(text: str) -> set[tuple[str, int]]:
    """Return the set of unique ``(prefix, ref_no)`` pairs found in *text*.

    Convenience helper for callers that need to resolve/validate
    references without caring about text positions.
    """
    return {(prefix, ref_no) for prefix, ref_no, _span in parse_tags(text)}
