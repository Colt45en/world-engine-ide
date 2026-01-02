import uuid
from typing import Dict, Any, List
from ..ir.models import EventIR

class ContainmentSession:
    def __init__(self, owner: str = None, initial_state: Dict[str, Any] = None):
        self.id = str(uuid.uuid4())
        self.owner = owner
        self.created_at = None
        self.state = initial_state or {}
        self.audit: List[EventIR] = []
        self.forks: List[str] = []

    def record_event(self, event: EventIR):
        self.audit.append(event)
