import uuid
from typing import Dict, Any
from ..ir.models import CovenantIR, SafetyLedgerIR, EventIR

class CovenantEngine:
    def __init__(self):
        self.registry = []
        self.safety_ledger = []

    def evaluate(self, session_state: Dict[str, Any]) -> CovenantIR:
        # trivial scoring for Phase 1
        result = {"score": 0.8, "fields": {"empathy": 0.8, "care": 0.9, "trust": 0.7}}
        cov = CovenantIR(name="Phase1Eval", result=result)
        self.registry.append(cov)
        return cov

    def verify_safeguard_integrity(self, session_state: Dict[str, Any]) -> SafetyLedgerIR:
        # If risk-like signals exist, write small ledger entry
        note = "ok"
        data = {}
        if session_state.get("suspicious", False):
            note = "safeguard_engaged"
            data = {"reason": "suspicious_flag"}
        ledger = SafetyLedgerIR(id=str(uuid.uuid4()), note=note, data=data)
        self.safety_ledger.append(ledger)
        # For tracking, we also emit an EventIR wrapper
        return ledger

    def measure_empathy_field(self, session_state: Dict[str, Any]) -> Dict[str, Any]:
        return {"empathy": 0.77}

    def why_we_work_together(self, session_state: Dict[str, Any]) -> EventIR:
        ev = EventIR(id=str(uuid.uuid4()), type="WhyWeWorkTogetherPulse", payload={"summary": "phase1 pulse"})
        return ev
