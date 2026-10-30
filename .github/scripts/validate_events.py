#!/usr/bin/env python3
"""Validate _data/events.yml before it reaches the site.

Checks the shape of every entry, and that the list stays in date order — the
events page walks site.data.events forward for what's upcoming and backward
for what's past, so the file's order is the page's order, not a tidiness
preference.
"""

import re
import sys
from datetime import date, datetime
from pathlib import Path

import yaml

EVENTS_PATH = Path(__file__).resolve().parents[2] / "_data" / "events.yml"
FORM_PATH = (
    Path(__file__).resolve().parents[1] / "ISSUE_TEMPLATE" / "new-event.yml"
)

REQUIRED = ("title", "date", "start", "end")
OPTIONAL = ("short", "location", "link", "details")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
URL_RE = re.compile(r"^https?://\S+$")


def parse_date(value, label):
    # datetime is a subclass of date; exclude it so timestamps are rejected.
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValueError(
            f"{label}: date must be a date or YYYY-MM-DD string, "
            f"got {type(value).__name__}"
        )
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"{label}: date must be YYYY-MM-DD, got {value!r}")


def validate_form():
    """The issue form's labels are the only handle issue_to_event.py has on
    the submitted values, so a reworded label silently drops a field. Checking
    them here means a rename cannot reach main without the parser following."""
    from issue_to_event import FIELD_MAP

    try:
        with open(FORM_PATH) as f:
            form = yaml.safe_load(f)
    except FileNotFoundError:
        return [f"{FORM_PATH.name} is missing; the issue form is how events arrive"]

    labels = {
        item["attributes"]["label"]
        for item in form.get("body", [])
        if item.get("type") != "markdown"
    }
    errors = []
    for label in sorted(set(FIELD_MAP) - labels):
        errors.append(
            f"{FORM_PATH.name}: no field labelled {label!r}, but "
            f"issue_to_event.py reads one"
        )
    for label in sorted(labels - set(FIELD_MAP)):
        errors.append(
            f"{FORM_PATH.name}: field {label!r} is not in issue_to_event.py's "
            f"FIELD_MAP, so anything entered there is dropped"
        )
    return errors


def validate(events):
    if not isinstance(events, list):
        return [f"top level must be a list of events, got {type(events).__name__}"]
    if not events:
        return ["no events in the file"]

    errors = []
    previous = None
    for i, event in enumerate(events):
        label = f"events[{i}]"
        if not isinstance(event, dict):
            errors.append(f"{label}: must be a mapping, got {type(event).__name__}")
            continue
        if event.get("title"):
            label = f"events[{i}] ({event['title']!r})"

        for field in REQUIRED:
            if event.get(field) in (None, ""):
                errors.append(f"{label}: missing required field {field!r}")

        unknown = set(event) - set(REQUIRED) - set(OPTIONAL)
        if unknown:
            errors.append(
                f"{label}: unknown field(s) {sorted(unknown)}; the events page and "
                f"the .ics feed will ignore them"
            )

        for field in ("title", "short", "location", "details"):
            value = event.get(field)
            if value is not None and not isinstance(value, str):
                errors.append(
                    f"{label}: {field} must be text, got {type(value).__name__}"
                )
            elif isinstance(value, str) and "\n" in value:
                errors.append(f"{label}: {field} must be a single line")

        for field in ("start", "end"):
            value = event.get(field)
            if value in (None, ""):
                continue
            # An unquoted 18:00 is a YAML sexagesimal integer, not a string,
            # which is exactly the mistake this catches.
            if not isinstance(value, str) or not TIME_RE.match(value):
                errors.append(
                    f"{label}: {field} must be a quoted 24-hour time such as "
                    f'"18:30", got {value!r}'
                )

        if isinstance(event.get("start"), str) and isinstance(event.get("end"), str):
            if TIME_RE.match(event["start"]) and TIME_RE.match(event["end"]):
                if event["end"] <= event["start"]:
                    errors.append(
                        f"{label}: end {event['end']} is not after start "
                        f"{event['start']}"
                    )

        link = event.get("link")
        if link and not URL_RE.match(str(link)):
            errors.append(f"{label}: link must be an absolute http(s) URL, got {link!r}")

        if event.get("date") not in (None, ""):
            try:
                current = parse_date(event["date"], label)
                if previous and current < previous:
                    errors.append(
                        f"{label}: {current} comes after {previous} in the file; "
                        f"entries run oldest first"
                    )
                previous = current
            except ValueError as problem:
                errors.append(str(problem))

    return errors


def main():
    with open(EVENTS_PATH) as f:
        events = yaml.safe_load(f)
    errors = validate(events) + validate_form()
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        print(f"\n{len(errors)} problem(s) found", file=sys.stderr)
        return 1
    print(f"OK: {len(events)} events validated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
