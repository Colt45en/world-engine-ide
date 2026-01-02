import uuid
from typing import Dict, Any, Optional
from ..ir.models import EventIR
from .session import ContainmentSession

class ContainmentEngine:
    def __init__(self):
        self.sessions: Dict[str, ContainmentSession] = {}

    def create_session(self, owner: str = None, initial_state: Dict[str, Any] = None) -> ContainmentSession:
        s = ContainmentSession(owner=owner, initial_state=initial_state)
        self.sessions[s.id] = s
        ev = EventIR(id=str(uuid.uuid4()), type="SessionCreated", payload={"session_id": s.id, "owner": owner})
        s.record_event(ev)
        return s

    def apply_operator(self, session_id: str, op_name: str, op_result) -> EventIR:
        s = self.sessions[session_id]
        s.state = op_result.new_state
        ev = EventIR(id=str(uuid.uuid4()), type="OperatorApplied", payload={
            "session_id": s.id,
            "operator": op_name,
            "delta": op_result.delta,
            "audit": op_result.audit,
            "risk": op_result.risk,
            "recommendations": op_result.recommendations
        })
        s.record_event(ev)
        return ev

    def fork(self, session_id: str) -> ContainmentSession:
        parent = self.sessions[session_id]
        child = ContainmentSession(owner=parent.owner, initial_state=dict(parent.state))
        self.sessions[child.id] = child
        parent.forks.append(child.id)
        ev = EventIR(id=str(uuid.uuid4()), type="SessionForked", payload={"parent": parent.id, "child": child.id})
        child.record_event(ev)
        parent.record_event(ev)
        return child

    def seal(self, session_id: str) -> EventIR:
        s = self.sessions[session_id]
        ev = EventIR(id=str(uuid.uuid4()), type="SessionSealed", payload={"session_id": s.id})
        s.record_event(ev)
        return ev
