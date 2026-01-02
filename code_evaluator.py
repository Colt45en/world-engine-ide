from dataclasses import dataclass
from typing import Any, Dict
import ast

@dataclass
class CodeEvalResult:
    ok: bool
    score: float
    breakdown: Dict[str, float]
    stdout: str
    stderr: str
    meta: Dict[str, Any]


class CodeEvaluator:
    def __init__(self, policy: Dict[str, Any]):
        self.policy = policy or {}

    def evaluate(self, code: str, tests: str | None = None) -> CodeEvalResult:
        # Static checks: AST parse, forbidden imports, dangerous builtins, complexity heuristic
        weights = self.policy.get("weights", {})
        max_complexity = int(self.policy.get("max_complexity", 20))
        forbidden = set(self.policy.get("forbidden_imports", []))
        dangerous = set(self.policy.get("dangerous_builtins", []))

        ast_score = 0.0
        compile_score = 0.0
        policy_score = 1.0
        runtime_score = 1.0
        tests_score = 1.0

        stderr = ""
        stdout = ""
        meta = {}

        # AST parse
        try:
            tree = ast.parse(code)
            ast_nodes = sum(1 for _ in ast.walk(tree))
            ast_score = max(0.0, min(1.0, 1.0 - (ast_nodes / max(1000, max_complexity * 50))))
            meta["ast_nodes"] = ast_nodes
        except Exception as e:
            stderr += f"AST error: {e}\n"
            return CodeEvalResult(ok=False, score=0.0, breakdown={"ast_parse": 0.0}, stdout=stdout, stderr=stderr, meta=meta)

        # Check imports and names
        imports_found = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for n in node.names:
                    imports_found.append(n.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports_found.append(node.module)

        bad_imports = [imp for imp in imports_found if any(imp == b or imp.startswith(b + ".") for b in forbidden)]
        if bad_imports:
            stderr += f"Forbidden imports: {bad_imports}\n"
            policy_score = 0.0

        # Detect dangerous builtins usage
        names = {getattr(n, 'id', None) for n in ast.walk(tree) if isinstance(n, ast.Name)}
        bad_builtins = [n for n in names if n in dangerous]
        if bad_builtins:
            stderr += f"Dangerous builtins used: {bad_builtins}\n"
            policy_score = 0.0

        # Complexity heuristic: count function defs & loops
        complexity = sum(1 for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.For, ast.While)))
        meta["complexity"] = complexity
        if complexity > max_complexity:
            stderr += f"Complexity {complexity} > max {max_complexity}\n"
            runtime_score = max(0.0, 1.0 - (complexity - max_complexity) / max_complexity)

        # Compile check
        try:
            compile(code, "<string>", "exec")
            compile_score = 1.0
        except Exception as e:
            stderr += f"Compile error: {e}\n"
            compile_score = 0.0

        # Tests: if tests are provided, we don't run them for safety; instead we require presence of test text as a minimal proxy
        if tests and tests.strip():
            tests_score = 1.0
            meta["tests_present"] = True
        else:
            tests_score = 0.5
            meta["tests_present"] = False

        w_ast = float(weights.get("ast_parse", 0.2))
        w_compile = float(weights.get("compile", 0.15))
        w_policy = float(weights.get("policy", 0.2))
        w_runtime = float(weights.get("runtime", 0.25))
        w_tests = float(weights.get("tests", 0.2))

        score = (
            w_ast * ast_score
            + w_compile * compile_score
            + w_policy * policy_score
            + w_runtime * runtime_score
            + w_tests * tests_score
        )
        score = max(0.0, min(1.0, score))

        ok = score >= float(self.policy.get("pass_threshold", 0.5)) and policy_score > 0.0 and compile_score > 0.0

        breakdown = {
            "ast_parse": ast_score,
            "compile": compile_score,
            "policy": policy_score,
            "runtime": runtime_score,
            "tests": tests_score,
        }

        return CodeEvalResult(ok=ok, score=score, breakdown=breakdown, stdout=stdout, stderr=stderr, meta=meta)
