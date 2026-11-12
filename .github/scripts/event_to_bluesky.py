#!/usr/bin/env python3
"""Pick the next event to announce on Bluesky and write the post text.

Reads _data/events.yml, drops anything already announced and anything whose
date has passed, and emits the soonest event left. One event per run: posting
is a single `uses:` step and GitHub Actions cannot loop over those, so a
backlog drains across runs — the workflow's daily schedule is what moves it
along when no deploy is coming.

Announced events are tracked by the UID the .ics feed gives them, so the
record survives a correction to a title, a time or a location. That is the
whole reason the feed stopped deriving UIDs from those fields; see events.ics.

Writes `found`, `uid`, `text` and `url` to GITHUB_OUTPUT when there is
something to post, and `found=false` when there is not.
"""

import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
EVENTS_PATH = ROOT / "_data" / "events.yml"
POSTED_PATH = ROOT / ".github" / "bluesky-posted-events.txt"

SITE = "https://drink20.com"
CALENDAR_URL = f"{SITE}/events"
PREFIX = "New Drink20 event posted - "

# Bluesky counts graphemes, not bytes. Nothing here reaches for an emoji, so
# counting characters is the same number and a title is all that can overrun.
POST_LIMIT = 300
ELLIPSIS = "…"
NDASH = "–"

# The events page offsets UTC by five hours to decide its own "today" (see
# events.html). Matching that keeps the two from disagreeing about whether
# tonight's game is still upcoming.
PHILLY_OFFSET = timedelta(hours=-5)


def today_in_philly():
    return (datetime.now(timezone.utc) + PHILLY_OFFSET).date()


def as_date(value):
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    return date.fromisoformat(str(value))


def uid_for(event_date, seq):
    """The same UID events.ics writes: the date, then which event that day."""
    return f"{event_date:%Y%m%d}-{seq}@drink20.com"


def with_uids(events):
    """Pair each event with its UID, numbering events that share a date."""
    seen = {}
    out = []
    for event in events:
        when = as_date(event["date"])
        seen[when] = seen.get(when, 0) + 1
        out.append((uid_for(when, seen[when]), when, event))
    return out


def clock(hhmm):
    """"18:00" -> ("6", "PM"). Minutes are dropped on the hour, as on the site."""
    hour, minute = (int(part) for part in str(hhmm).split(":"))
    meridiem = "AM" if hour < 12 else "PM"
    shown = f"{hour % 12 or 12}:{minute:02d}".removesuffix(":00")
    return shown, meridiem


def time_range(start, end):
    """Mirrors _includes/event-time.html, including where the meridiem goes."""
    start_t, start_ap = clock(start)
    end_t, end_ap = clock(end)
    if start_ap == end_ap:
        return f"{start_t}{NDASH}{end_t}{end_ap}"
    return f"{start_t}{start_ap}{NDASH}{end_t}{end_ap}"


def post_text(when, event):
    tail = (
        f", {when:%A} {when:%B} {when.day}"
        f" at {time_range(event['start'], event['end'])} {CALENDAR_URL}"
    )
    room = POST_LIMIT - len(PREFIX) - len(tail)
    title = str(event["title"]).strip()
    if len(title) > room:
        title = title[: max(room - 1, 0)].rstrip() + ELLIPSIS
    return f"{PREFIX}{title}{tail}"


def already_posted():
    if not POSTED_PATH.exists():
        return set()
    # Lines carry a trailing "# date title" so the file reads as a log rather
    # than a wall of identifiers, and so a human can tell which line to delete
    # to make an event announce again.
    uids = set()
    for line in POSTED_PATH.read_text(encoding="utf-8").splitlines():
        uid = line.split("#", 1)[0].strip()
        if uid:
            uids.add(uid)
    return uids


def emit(**fields):
    target = os.environ.get("GITHUB_OUTPUT")
    if not target:
        for key, value in fields.items():
            print(f"[no GITHUB_OUTPUT] {key}={value}")
        return
    with open(target, "a", encoding="utf-8") as handle:
        for key, value in fields.items():
            # Heredoc form: a title could contain anything, newlines included.
            handle.write(f"{key}<<FIELD_EOF\n{value}\nFIELD_EOF\n")


def main():
    events = yaml.safe_load(EVENTS_PATH.read_text(encoding="utf-8"))
    if not isinstance(events, list) or not events:
        print(f"{EVENTS_PATH.name} holds no events", file=sys.stderr)
        return 1

    posted = already_posted()
    today = today_in_philly()

    pending = [
        (uid, when, event)
        for uid, when, event in with_uids(events)
        if when >= today and uid not in posted
    ]

    print(f"{len(events)} events, {len(posted)} already announced, today is {today}")

    if not pending:
        print("Nothing to announce.")
        emit(found="false")
        return 0

    pending.sort(key=lambda row: (row[1], row[0]))
    uid, when, event = pending[0]
    text = post_text(when, event)

    if len(pending) > 1:
        waiting = ", ".join(f"{row[1]} {row[2]['title']}" for row in pending[1:])
        print(f"Also waiting, one per run: {waiting}")

    print(f"Announcing {uid}")
    print(f"{len(text)} of {POST_LIMIT} characters:")
    print(f"  {text}")

    # The workflow appends `line` verbatim, so the file's format lives here
    # next to the code that reads it back.
    emit(
        found="true",
        uid=uid,
        text=text,
        url=CALENDAR_URL,
        line=f"{uid}  # {when} {event['title']}",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
