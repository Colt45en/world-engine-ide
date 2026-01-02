from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)

class EventIR(BaseModel):
    id: str
    timestamp: datetime = Field(default_factory=utcnow)
    type: str
    payload: Dict[str, Any]

class OperatorIR(BaseModel):
    name: str
    params: Dict[str, Any] = {}

class MacroIR(BaseModel):
    name: str
    steps: List[OperatorIR]

class SessionIR(BaseModel):
    id: str
    created_at: datetime = Field(default_factory=utcnow)
    owner: Optional[str] = None
    state: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}

class CovenantIR(BaseModel):
    name: str
    result: Dict[str, Any] = {}

class SafetyLedgerIR(BaseModel):
    id: str
    timestamp: datetime = Field(default_factory=utcnow)
    note: str
    data: Dict[str, Any] = {}

class RenderNode(BaseModel):
    tag: str
    attrs: Dict[str, Any] = {}
    children: List['RenderNode'] = []
    text: Optional[str] = None

RenderNode.update_forward_refs()

class RenderTreeIR(BaseModel):
    root: RenderNode
