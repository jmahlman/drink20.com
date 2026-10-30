#!/usr/bin/env python3
"""Convert a "[Event]" issue form submission into a _data/events.yml entry.

Reads the issue body from the ISSUE_BODY environment variable, parses the
structured markdown GitHub renders for issue forms, and inserts the event into
_data/events.yml in date order, leaving the rest of the file — comment header
and all — untouched. Run from the add-event workflow.

The scripts live under .github/ rather than at the repo root because Jekyll
publishes any top-level directory it doesn't recognise, and nobody needs
drink20.com/scripts/issue_to_event.py.
"""

import json
import os
import re
import sys
from datetime import date
from pathlib import Path

EVENTS_PATH = Path(__file__).resolve().parents[2] / "_data" / "events.yml"

# Issue form label -> events.yml field. These have to match the form's labels
# exactly; the workflow has no other handle on the values.
FIELD_MAP = {
    "Event title": "title",
    "Short label (optional)": "short",
    "Date": "date",
    "Start time": "start",
    "End time": "end",
    "Location (optional)": "location",
    "Facebook event link (optional)": "link",
    "Details (optional)": "details",
}

# Mirrors the order documented at the top of _data/events.yml.
FIELD_ORDER = ("title", "short", "date", "start", "end", "location", "link", "details")

REQUIRED = ("title", "date", "start", "end")

# Problems are reported with the label the person actually filled in.
FIELD_LABELS = {field: label for label, field in FIELD_MAP.items()}

# What GitHub renders for an optional text input nobody filled in.
UNANSWERED = "_No response_"

# "18:00", "6pm", "6:30 PM", "6.30pm" — people type times in all of these and
# the site only ever stores 24-hour HH:MM.
TIME_RE = re.compile(r"^(\d{1,2})(?:[:.](\d{2}))?\s*([ap])\.?m\.?$|^(\d{1,2}):(\d{2})$", re.I)

DATE_LINE_RE = re.compile(r"^\s+date:\s*\"?(\d{4}-\d{2}-\d{2})", re.M)
BLOCK_START = "- title:"


class EventError(Exception):
    """A problem with what was submitted, phrased for the issue comment."""


def parse_issue_body(body):
    """Parse '### Label\n\nvalue' sections into a dict of stripped values."""
    sections = {}
    current = None
    for line in body.splitlines():
        heading = re.match(r"^### (.+)$", line)
        if heading:
            current = heading.group(1).strip()
            sections[current] = []
        elif current is not None:
            sections[current].append(line)
    return {label: "\n".join(lines).strip() for label, lines in sections.items()}


def normalize_time(value, field):
    """Return 24-hour HH:MM, however the time was written."""
    match = TIME_RE.match(value.strip())
    if not match:
        raise EventError(
            f"**{field}**: couldn't read {value!r} as a time. "
            f"Try `6:00 PM` or `18:00`."
        )
    if match.group(3):
        hour, minute, meridiem = (
            int(match.group(1)),
            int(match.group(2) or 0),
            match.group(3).lower(),
        )
        if not 1 <= hour <= 12:
            raise EventError(f"**{field}**: {value!r} isn't a 12-hour clock time.")
        hour = hour % 12 + (12 if meridiem == "p" else 0)
    else:
        hour, minute = int(match.group(4)), int(match.group(5))
    if hour > 23 or minute > 59:
        raise EventError(f"**{field}**: {value!r} isn't a real time of day.")
    return f"{hour:02d}:{minute:02d}"


def normalize_date(value):
    try:
        return date.fromisoformat(value.strip()).isoformat()
    except ValueError:
        raise EventError(
            f"**Date**: {value!r} isn't a date in YYYY-MM-DD form, e.g. `2026-11-18`."
        )


def normalize_url(value):
    """Add a scheme to a bare host, and drop a trailing slash.

    Facebook hands out event URLs with a trailing slash and the entries in
    _data/events.yml don't carry one; this keeps them looking alike. Any query
    string is left alone — it isn't ours to decide that it's only tracking.
    """
    value = value.strip()
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", value):
        value = "https://" + value.lstrip("/")
    if not re.match(r"^https?://", value, re.I):
        raise EventError(
            f"**Facebook event link**: {value!r} isn't an http(s) link."
        )
    base, sep, tail = re.match(r"^([^?#]*)([?#]?)(.*)$", value).groups()
    return base.rstrip("/") + sep + tail


def build_event(sections):
    event = {}
    for label, field in FIELD_MAP.items():
        value = sections.get(label, "")
        if not value or value == UNANSWERED:
            continue
        # Every field here is single-line; collapse anything stray.
        event[field] = " ".join(value.split())

    missing = [f for f in REQUIRED if f not in event]
    if missing:
        raise EventError(
            "The form is missing "
            + ", ".join(f"**{FIELD_LABELS[f]}**" for f in missing)
            + "."
        )

    event["date"] = normalize_date(event["date"])
    event["start"] = normalize_time(event["start"], "Start time")
    event["end"] = normalize_time(event["end"], "End time")
    if event["end"] <= event["start"]:
        raise EventError(
            f"**End time** ({event['end']}) isn't after **start time** "
            f"({event['start']}). Events here don't run past midnight — if this "
            f"one does, add it by hand."
        )
    if "link" in event:
        event["link"] = normalize_url(event["link"])
    return event


def format_entry(event):
    """Render one YAML block.

    Values go through json.dumps, which is valid YAML double-quoted style and
    escapes correctly whatever someone typed into the form. Hand-written
    entries in the file are mostly unquoted; both parse the same, and being
    right beats matching the house style character for character. The date is
    the exception — left bare so it stays a YAML date like the rest.
    """
    lines = []
    for field in FIELD_ORDER:
        if field not in event:
            continue
        prefix = "- " if not lines else "  "
        if field == "date":
            lines.append(f"{prefix}{field}: {event[field]}")
        else:
            lines.append(f"{prefix}{field}: {json.dumps(event[field], ensure_ascii=False)}")
    return "\n".join(lines)


def split_blocks(text):
    """Split the file into its comment header and one string per event."""
    start = text.find("\n" + BLOCK_START)
    if start == -1:
        raise EventError(
            f"{EVENTS_PATH.name} has no event entries to insert alongside."
        )
    header = text[: start + 1]
    return header, re.split(r"\n{2,}", text[start + 1 :].strip("\n"))


def is_duplicate(blocks, event):
    """True if this date already carries an event with this title."""
    title_line = f"title: {event['title']}"
    quoted_title_line = f"title: {json.dumps(event['title'], ensure_ascii=False)}"
    for block in blocks:
        match = DATE_LINE_RE.search(block)
        if not match or match.group(1) != event["date"]:
            continue
        if title_line in block or quoted_title_line in block:
            return True
    return False


def insert_sorted(header, blocks, entry, event_date):
    """Insert oldest-first, which is the order the events page renders in."""
    insert_at = len(blocks)
    for i, block in enumerate(blocks):
        match = DATE_LINE_RE.search(block)
        if match and match.group(1) > event_date:
            insert_at = i
            break
    blocks.insert(insert_at, entry)
    return header + "\n\n".join(blocks) + "\n"


def write_output(name, value):
    output_path = os.environ.get("GITHUB_OUTPUT")
    if output_path:
        with open(output_path, "a") as f:
            f.write(f"{name}={value}\n")


def write_problem(markdown):
    """Leave the "what went wrong" comment for the workflow to post.

    A file rather than a step output: these run to several lines, and
    GITHUB_OUTPUT would need a delimiter dance to carry them intact. Only
    failures get one — a successful run has its pull request to speak for it.
    """
    problem_path = os.environ.get("PROBLEM_FILE")
    if problem_path:
        Path(problem_path).write_text(markdown)


def main():
    body = os.environ.get("ISSUE_BODY")
    if not body:
        print("ISSUE_BODY environment variable is empty", file=sys.stderr)
        return 1

    try:
        event = build_event(parse_issue_body(body))
        text = EVENTS_PATH.read_text()
        header, blocks = split_blocks(text)
        if is_duplicate(blocks, event):
            raise EventError(
                f"**{event['title']}** is already on the calendar for "
                f"{event['date']}, so nothing was changed."
            )
        entry = format_entry(event)
        EVENTS_PATH.write_text(insert_sorted(header, blocks, entry, event["date"]))
    except EventError as problem:
        # Posted back on the issue, so it has to read as a message to a person
        # rather than a stack trace.
        write_problem(
            f"{problem}\n\n"
            "Edit the issue and this will have another go.\n"
        )
        print(problem, file=sys.stderr)
        return 1

    write_output("title", event["title"])
    write_output("date", event["date"])
    print(f"added {event['title']!r} ({event['date']}) to {EVENTS_PATH}")
    print(entry)
    return 0


if __name__ == "__main__":
    sys.exit(main())
