from typing import Dict, List, Any
from brain.src.brain.ir.models import RenderNode, RenderTreeIR

# Minimal helper to build a RenderTreeIR for code and HUD

def build_code_rendertree(code: str) -> RenderTreeIR:
    pre = RenderNode(tag="pre", attrs={"class": "code-snapshot"}, children=[], text=None)
    code_lines = code.splitlines()
    for line in code_lines:
        span = RenderNode(tag="span", attrs={"class": "code-line"}, text=line)
        pre.children.append(span)
    return RenderTreeIR(root=pre)


def build_hud_tree(fields: Dict[str, Any]) -> RenderTreeIR:
    root = RenderNode(tag="div", attrs={"class": "hud"}, children=[])
    for k, v in fields.items():
        node = RenderNode(tag="div", attrs={"class": "hud-field"}, text=f"{k}: {v}")
        root.children.append(node)
    return RenderTreeIR(root=root)
