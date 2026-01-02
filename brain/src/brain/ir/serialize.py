import json
from typing import Iterable
from brain.src.brain.ir.models import EventIR

def write_events_jsonl(path: str, events: Iterable[EventIR]):
    with open(path, 'a', encoding='utf-8') as fh:
        for ev in events:
            fh.write(ev.json() + "\n")

def read_events_jsonl(path: str):
    with open(path, 'r', encoding='utf-8') as fh:
        for line in fh:
            yield EventIR.parse_raw(line)
