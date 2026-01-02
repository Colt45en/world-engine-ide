from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from sqlite3 import Connection
from typing import Any
from numpy import dtype, ndarray
from brain.containment.session import ContainmentSession
from websockets.server import serve
from brain.containment.engine import ContainmentEngine
from brain.operators.registry import OperatorRegistry, OperatorResult
from brain.operators.core import DEFAULT_OPERATORS
from brain.covenant.engine import CovenantEngine
from brain.ir.models import CovenantIR, EventIR, SafetyLedgerIR

logging.basicConfig(level=logging.INFO)

class RelayServer:
    def __init__(self, host='localhost', port=9000, test_mode: bool = False, artifact_run_id: str = 'latest', artifacts_root: str = 'artifacts/runs', log_json: bool = False, db_path: str | None = None) -> None:
        self.host: str = host
        self.port = int(port)
        self.test_mode = bool(test_mode)
        self.artifact_run_id: str = artifact_run_id
        self.artifacts_root: str = artifacts_root
        self.log_json = bool(log_json)
        self.db_path: str | Path = db_path or (Path(artifacts_root).parent / 'e2e.sqlite')

        self.containment = ContainmentEngine()
        self.operators = OperatorRegistry()
        for name, fn in DEFAULT_OPERATORS.items():
            self.operators.register(name, fn)
        self.covenant = CovenantEngine()

        # DB (SQLite) for e2e persistence; use migrations helper to create schema
        self._db: Connection | None = None
        try:
            from brain.migrations import apply_migrations

            apply_migrations(Path(self.db_path))
            import sqlite3

            self._sqlite3: Any = sqlite3
            self._db = sqlite3.connect(str(self.db_path), check_same_thread=False)
            logging.info("Relay DB ready at %s (migrations applied)", self.db_path)
        except Exception:
            logging.exception("Could not initialize SQLite DB; persistence disabled")
            self._db = None

        # If running in test mode, attempt to load artifact model & tokenizers
        self.model = None
        self.eng_vec = None
        self.math_vec = None
        self.phys_vec = None
        if self.test_mode:
            try:
                from brain.registry import load_model_and_tokenizers

                loaded = load_model_and_tokenizers(run_id=self.artifact_run_id, artifacts_root=Path(self.artifacts_root))
                self.model = loaded.get("model")
                self.eng_vec = loaded.get("english_vectorizer")
                self.math_vec = loaded.get("math_vectorizer")
                self.phys_vec = loaded.get("physics_vectorizer")
                logging.info("Relay test mode: loaded artifact %s", self.artifact_run_id)
            except Exception as e:
                logging.exception("Failed to load artifact for relay test mode: %s", e)
                # keep going but inference will fail when requested

    async def handler(self, websocket):
        async for raw in websocket:
            try:
                msg = json.loads(raw)
                cmd = msg.get('cmd')

                # Test-mode inference command
                if cmd == 'Infer':
                    trace_id: Any | str = msg.get('trace_id') or msg.get('trace') or 'trace-none'
                    payload = msg.get('payload', {})
                    text = payload.get('text', '')
                    math = payload.get('math', '')
                    physics = payload.get('physics', '')

                    routing: dict[str, bool] = {'english': bool(text), 'math': bool(math), 'physics': bool(physics)}

                    tokens = {}
                    try:
                        import numpy as np

                        if self.eng_vec is not None and routing['english']:
                            eng_ids = self.eng_vec(np.array([text])).numpy().tolist()[0]
                            tokens['english'] = {'ids': eng_ids, 'length': len([i for i in eng_ids if i != 0])}
                        else:
                            tokens['english'] = {'ids': [], 'length': 0}

                        if self.math_vec is not None and routing['math']:
                            math_ids = self.math_vec(np.array([math])).numpy().tolist()[0]
                            tokens['math'] = {'ids': math_ids, 'length': len([i for i in math_ids if i != 0])}
                        else:
                            tokens['math'] = {'ids': [], 'length': 0}

                        if self.phys_vec is not None and routing['physics']:
                            phys_ids = self.phys_vec(np.array([physics])).numpy().tolist()[0]
                            tokens['physics'] = {'ids': phys_ids, 'length': len([i for i in phys_ids if i != 0])}
                        else:
                            tokens['physics'] = {'ids': [], 'length': 0}

                        # Model predict
                        prediction = None
                        if self.model is not None:
                            # use dummy args [0,0] for scalar predict
                            X: dict[str, ndarray[tuple[Any, ...], dtype[Any]]] = {
                                'args': np.array([[0.0, 0.0]]),
                                'english_text': np.array([text], dtype=object),
                                'math_text': np.array([math], dtype=object),
                                'physics_text': np.array([physics], dtype=object),
                            }
                            y = self.model.predict(X, verbose=0)
                            try:
                                prediction = float(y[0][0])
                            except Exception:
                                prediction = None

                        resp = {
                            'type': 'infer_result',
                            'trace_id': trace_id,
                            'routing': routing,
                            'tokens': tokens,
                            'prediction': {'value': prediction},
                        }

                        # structured log
                        if self.log_json:
                            log_event = {'event': 'infer', 'trace_id': trace_id, 'routing': routing, 'prediction': {'value': prediction}}
                            print(json.dumps(log_event), flush=True)

                        await websocket.send(json.dumps(resp))
                    except Exception as e:
                        logging.exception('infer error')
                        await websocket.send(json.dumps({'error': str(e), 'trace_id': trace_id}))
                    continue

                if cmd == 'CreateSession':
                    s: ContainmentSession = self.containment.create_session(owner=msg.get('owner'))
                    await websocket.send(json.dumps({'type': 'SessionCreated', 'session_id': s.id}))
                elif cmd == 'ApplyOperator':
                    session_id = msg['session_id']
                    op = msg['operator']
                    params = msg.get('params', {})
                    # Evaluate covenant before applying
                    cov: CovenantIR = self.covenant.evaluate(self.containment.sessions[session_id].state)
                    ledger: SafetyLedgerIR = self.covenant.verify_safeguard_integrity(self.containment.sessions[session_id].state)
                    # apply operator
                    op_res: OperatorResult = self.operators.apply(op, self.containment.sessions[session_id].state, **params)
                    ev: EventIR = self.containment.apply_operator(session_id, op, op_res)
                    # return snapshot
                    snapshot = {'type': 'State.Snapshot', 'session_id': session_id, 'state': self.containment.sessions[session_id].state}
                    await websocket.send(json.dumps(snapshot))
                else:
                    await websocket.send(json.dumps({'error': 'unknown command'}))
            except Exception as e:
                logging.exception('error handling message')
                await websocket.send(json.dumps({'error': str(e)}))

    async def start(self) -> None:
        # Start the websocket server; allow ephemeral port (0) in test mode
        ws_server = await serve(self.handler, self.host, self.port)
        # Determine actual bound port
        sockets = list(ws_server.sockets) if hasattr(ws_server, 'sockets') else []
        bound_port = None
        if sockets:
            sock = sockets[0]
            bound_port = sock.getsockname()[1]
        else:
            bound_port: int = self.port

        if self.test_mode:
            # Print a machine-readable listening line for tests
            print(f"LISTENING ws://{self.host}:{bound_port}", flush=True)
        logging.info("Starting relay server on ws://%s:%s", self.host, bound_port)

        async with ws_server:
            await asyncio.Future()  # run forever

if __name__ == '__main__':
    # Read environment variables for test mode
    host: str = os.environ.get('RELAY_HOST', '127.0.0.1')
    port = int(os.environ.get('RELAY_PORT', os.environ.get('PORT', 9000)))
    test_mode: bool = os.environ.get('RELAY_TEST_MODE', '') in ('1', 'true', 'True')
    artifact_run_id: str = os.environ.get('ARTIFACT_RUN_ID', 'latest')
    artifacts_root: str = os.environ.get('ARTIFACTS_ROOT', 'artifacts/runs')
    log_json: bool = os.environ.get('RELAY_LOG_JSON', '') in ('1', 'true', 'True')

    server = RelayServer(host=host, port=port, test_mode=test_mode, artifact_run_id=artifact_run_id, artifacts_root=artifacts_root, log_json=log_json)
    asyncio.run(server.start())
