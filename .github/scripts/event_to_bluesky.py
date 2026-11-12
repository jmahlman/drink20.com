#!/usr/bin/env python3
"""Work out what to announce on Bluesky and write the post text.

Reads _data/events.yml and drops anything already announced or already past.
Whatever is left goes out in a single post: one event gets a sentence of its
own, several get listed together. That keeps a batch of events to one post
rather than one per deploy, and it means posting stays a single `uses:` step,
which matters because GitHub Actions cannot loop over those.

Announced events are tracked by the UID the .ics feed gives them, so the
record survives a correction to a title, a time or a location. That is the
whole reason the feed stopped deriving UIDs from those fields; see events.ics.

Writes `found`, `count`, `text`, `url`, `lines` and `subject` to
GITHUB_OUTPUT when there is something to post, and `found=false` when there
is not. `lines` is what the workflow appends to the tracking file, one per
event, so the file's format stays next to the code that reads it back.
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
PREFIX_ONE = "New Drink20 event posted - "
PREFIX_MANY = "New Drink20 events posted - "

# Entries in a combined post carry commas of their own, so they are joined
# with semicolons rather than commas.
JOIN = "; "

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


def entry(when, event, room=None):
    """One event as "Title, Sunday November 22 at 2:30-5:30PM".

    With a `room` budget, the title gives way rather than the date and time:
    a clipped title still reads, a clipped date is useless.
    """
    tail = (
        f", {when:%A} {when:%B} {when.day}"
        f" at {time_range(event['start'], event['end'])}"
    )
    title = str(event["title"]).strip()
    if room is not None:
        allowed = room - len(tail)
        if len(title) > allowed:
            title = title[: max(allowed - 1, 0)].rstrip() + ELLIPSIS
    return f"{title}{tail}"


def listing(entries, keep):
    body = JOIN.join(entries[:keep])
    dropped = len(entries) - keep
    if dropped:
        body += f"{JOIN}and {dropped} more"
    return body


def post_text(rows):
    """The whole post for one or more events, inside the character limit."""
    link = f" {CALENDAR_URL}"

    if len(rows) == 1:
        _, when, event = rows[0]
        room = POST_LIMIT - len(PREFIX_ONE) - len(link)
        return f"{PREFIX_ONE}{entry(when, event, room=room)}{link}"

    budget = POST_LIMIT - len(PREFIX_MANY) - len(link)
    entries = [entry(when, event) for _, when, event in rows]

    # As many events named outright as will fit, the rest counted. Dropping
    # from the end keeps the soonest ones visible, since rows are sorted.
    for keep in range(len(entries), 1, -1):
        body = listing(entries, keep)
        if len(body) <= budget:
            return f"{PREFIX_MANY}{body}{link}"

    # Not even two fit: name the first and count the rest, clipping its title
    # against whatever "and N more" leaves behind.
    suffix = f"{JOIN}and {len(entries) - 1} more"
    _, when, event = rows[0]
    first = entry(when, event, room=budget - len(suffix))
    return f"{PREFIX_MANY}{first}{suffix}{link}"


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
    text = post_text(pending)

    print(f"Announcing {len(pending)} event(s) in one post:")
    for uid, when, event in pending:
        print(f"  {uid}  {when}  {event['title']}")
    print(f"{len(text)} of {POST_LIMIT} characters:")
    print(f"  {text}")

    # Every event in the post is recorded, whether or not it was named in the
    # text: they have all been announced, and an "and 2 more" that came round
    # again next deploy would be a duplicate.
    lines = "\n".join(
        f"{uid}  # {when} {event['title']}" for uid, when, event in pending
    )
    if len(pending) == 1:
        subject = f"Track announced event {pending[0][0]}"
    else:
        subject = f"Track {len(pending)} announced events"

    emit(
        found="true",
        count=str(len(pending)),
        text=text,
        url=CALENDAR_URL,
        lines=lines,
        subject=subject,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
