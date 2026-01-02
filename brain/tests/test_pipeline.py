import asyncio
import pytest
from brain.operators.registry import OperatorRegistry
from brain.operators.core import op_st, op_xyz
from brain.containment.engine import ContainmentEngine

def test_operator_registry_and_containment():
    reg = OperatorRegistry()
    reg.register('ST', op_st)

    ce = ContainmentEngine()
    s = ce.create_session(owner='tester', initial_state={'counter': 0})

    res = reg.apply('ST', s.state, changes={'counter': 1})
    ev = ce.apply_operator(s.id, 'ST', res)

    assert s.state['counter'] == 1
    assert ev.type == 'OperatorApplied'


def test_operator_xyz_registry_and_containment():
    reg = OperatorRegistry()
    reg.register('XYZ', op_xyz)

    ce = ContainmentEngine()
    s = ce.create_session(owner='tester', initial_state={})

    res = reg.apply('XYZ', s.state, key='foo', value=123)
    ev = ce.apply_operator(s.id, 'XYZ', res)

    assert s.state['foo'] == 123
    assert ev.type == 'OperatorApplied'

@pytest.mark.asyncio
async def test_relay_create_and_apply(tmp_path):
    from brain.relay.ws_server import RelayServer
    server = RelayServer()

    # create session via engine directly (simpler than making real ws client for unit test)
    s = server.containment.create_session(owner='rt')
    assert s.id in server.containment.sessions

    # apply operator
    op_res = server.operators.apply('ST', s.state, changes={'hello': 'world'})
    server.containment.apply_operator(s.id, 'ST', op_res)
    assert s.state['hello'] == 'world'

    # XYZ is registered via DEFAULT_OPERATORS; exercise relay-style apply
    op_res2 = server.operators.apply('XYZ', s.state, key='ping', value='pong')
    ev2 = server.containment.apply_operator(s.id, 'XYZ', op_res2)
    assert s.state['ping'] == 'pong'
    assert ev2.type == 'OperatorApplied'
