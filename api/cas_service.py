from __future__ import annotations

import random
import re
from dataclasses import dataclass
from typing import Any

import sympy
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sympy import N, simplify
from sympy.parsing.latex import parse_latex


app = FastAPI(title="ProofArena CAS Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://proof-arena.guoxh.me",
    ],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class EquivalenceRequest(BaseModel):
    expr_a: str
    expr_b: str


class StepsRequest(BaseModel):
    steps: list[str]


_CJK = re.compile(r"[\u4e00-\u9fff\uff00-\uffef]")
_EQ_SPLIT = re.compile(r"(?<!\\[lg])(?<!\\ne)(?<!\\leq)(?<!\\geq)(?<![!<>])=(?!=)")


@dataclass
class Equation:
    raw: str
    lhs: Any
    rhs: Any

    @property
    def residual(self):
        return simplify(self.lhs - self.rhs)


def _strip_math_delimiters(value: str) -> str:
    cleaned = value.strip()
    for left, right in [("\\[", "\\]"), ("$$", "$$"), ("\\(", "\\)"), ("$", "$")]:
        if cleaned.startswith(left) and cleaned.endswith(right) and len(cleaned) > len(left) + len(right):
            return cleaned[len(left):-len(right)].strip()
    return cleaned


def _normalize_latex(value: str) -> str:
    text = _strip_math_delimiters(value)
    text = text.replace("\\\\", "\\")
    text = re.sub(r"\\sqrt\s*\\([A-Za-z]+)", r"\\sqrt{\\\1}", text)
    text = re.sub(r"\\sqrt\s*([A-Za-z0-9]+)", r"\\sqrt{\1}", text)
    text = re.sub(r"\\dfrac", r"\\frac", text)
    return text.strip()


def _math_parts(step: str) -> list[str]:
    text = step.strip()
    parts = [match.group(1).strip() for match in re.finditer(r"\$([^$\n]+)\$", text)]
    if parts:
        return parts
    if _CJK.search(text):
        return []
    return [_strip_math_delimiters(text)] if text else []


def _parse_expr(value: str):
    return parse_latex(_normalize_latex(value))


def _parse_equation(value: str) -> Equation | None:
    normalized = _normalize_latex(value)
    parts = _EQ_SPLIT.split(normalized, maxsplit=1)
    if len(parts) != 2:
        return None
    lhs_raw, rhs_raw = parts[0].strip(), parts[1].strip()
    if not lhs_raw or not rhs_raw:
        return None
    return Equation(normalized, _parse_expr(lhs_raw), _parse_expr(rhs_raw))


def _symbolic_zero(expr) -> bool | None:
    try:
        return simplify(expr) == 0
    except Exception:
        return None


def _numeric_zero(expr, trials: int = 8) -> bool | None:
    try:
        symbols = list(expr.free_symbols)
        if not symbols:
            return abs(complex(N(expr))) < 1e-9
        for _ in range(trials):
            subs = {symbol: random.uniform(0.7, 3.3) for symbol in symbols}
            if abs(complex(N(expr.subs(subs)))) > 1e-6:
                return False
        return True
    except Exception:
        return None


def _check_zero(expr) -> tuple[bool | None, str]:
    symbolic = _symbolic_zero(expr)
    if symbolic is not None:
        return symbolic, "symbolic"
    numeric = _numeric_zero(expr)
    if numeric is not None:
        return numeric, "numeric"
    return None, "undecidable"


def _equivalent_residuals(a, b) -> tuple[bool | None, str]:
    same, method = _check_zero(a - b)
    if same is True:
        return True, method

    opposite, method = _check_zero(a + b)
    if opposite is True:
        return True, method

    try:
        ratio = simplify(a / b)
        if ratio.free_symbols == set() and ratio != 0:
            return True, "symbolic"
    except Exception:
        pass

    return False if same is False and opposite is False else None, "undecidable"


def _simple_assignment(eq: Equation) -> tuple[Any, Any] | None:
    if len(eq.lhs.free_symbols) == 1 and eq.lhs in eq.lhs.free_symbols:
        return eq.lhs, eq.rhs
    return None


def _check_equivalence(expr_a: str, expr_b: str) -> dict[str, Any]:
    try:
        a = _parse_expr(expr_a)
        b = _parse_expr(expr_b)
    except Exception as exc:
        return {"equivalent": None, "method": "parse_error", "error": str(exc)}

    result, method = _check_zero(a - b)
    return {"equivalent": result, "method": method}


def _verify_step(step: str, index: int, previous: Equation | None, known: dict[Any, Any]) -> tuple[dict[str, Any], Equation | None]:
    parts = _math_parts(step)
    if not parts:
        return (
            {"step": step, "index": index, "valid": None, "method": "no_math", "detail": "步骤不含可解析数学表达式，跳过"},
            previous,
        )

    equations: list[Equation] = []
    for part in parts:
        try:
            eq = _parse_equation(part)
            if eq is not None:
                equations.append(eq)
        except Exception as exc:
            return {"step": step, "index": index, "valid": None, "method": "parse_error", "error": str(exc)}, previous

    if not equations:
        return (
            {"step": step, "index": index, "valid": None, "method": "no_equation", "detail": "步骤含数学表达式但没有等式，跳过"},
            previous,
        )

    eq = equations[-1]
    residual = simplify(eq.residual.subs(known))
    is_identity, identity_method = _check_zero(residual)

    assignment = _simple_assignment(eq)
    if assignment is not None and previous is None:
        symbol, value = assignment
        known[symbol] = simplify(value.subs(known))
        return (
            {
                "step": step,
                "index": index,
                "valid": None,
                "method": "condition",
                "detail": "已记录为条件/设定；CAS 不把单独赋值视为已证明结论。",
            },
            eq,
        )

    if previous is not None:
        if assignment is not None:
            symbol, value = assignment
            candidate_known = {**known, symbol: simplify(value.subs(known))}
            prev_holds, method = _check_zero(previous.residual.subs(candidate_known))
            known.update(candidate_known)
            return (
                {
                    "step": step,
                    "index": index,
                    "valid": prev_holds,
                    "method": "derived" if prev_holds else method,
                    "detail": "该赋值可代回上一条等式成立；若上一条有多根，CAS 只验证满足性，不证明唯一性。",
                },
                eq,
            )

        equivalent, method = _equivalent_residuals(previous.residual.subs(known), eq.residual.subs(known))
        if equivalent is True:
            return {"step": step, "index": index, "valid": True, "method": "equivalent", "detail": "与上一条等式等价或只差非零常数倍。"}, eq
        if is_identity is True:
            return {"step": step, "index": index, "valid": True, "method": identity_method, "detail": "该等式本身为恒等式。"}, eq
        return {"step": step, "index": index, "valid": equivalent, "method": method, "detail": "无法确认它与上一条等式等价。"}, eq

    if is_identity is True:
        return {"step": step, "index": index, "valid": True, "method": identity_method, "detail": "该等式本身为恒等式。"}, eq
    return {"step": step, "index": index, "valid": None, "method": "condition", "detail": "已作为起始等式记录，后续步骤会与它比较。"}, eq


def _verify_steps(steps: list[str]) -> dict[str, Any]:
    if not steps:
        return {"verifications": [], "summary": "没有可验证的步骤"}

    previous: Equation | None = None
    known: dict[Any, Any] = {}
    verifications: list[dict[str, Any]] = []

    for index, step in enumerate(steps):
        result, previous = _verify_step(step, index, previous, known)
        verifications.append(result)

    passed = sum(1 for item in verifications if item.get("valid") is True)
    failed = sum(1 for item in verifications if item.get("valid") is False)
    undecided = sum(1 for item in verifications if item.get("valid") is None)

    if failed:
        summary = f"{len(verifications)} 步中 {failed} 步未通过。CAS 只检查代数等式，不替代人工审题。"
    elif passed:
        summary = f"{len(verifications)} 步中 {passed} 步通过，{undecided} 步作为条件或无法判定。"
    else:
        summary = "没有可确认通过的等式；请使用 $...$ 标出含等号的数学步骤。"

    return {"verifications": verifications, "summary": summary}


async def _dispatch_action(payload: dict[str, Any]):
    action = payload.get("action")
    if action == "equivalence":
        return _check_equivalence(str(payload.get("expr_a", "")), str(payload.get("expr_b", "")))
    if action == "steps":
        raw_steps = payload.get("steps", [])
        steps = [str(step) for step in raw_steps] if isinstance(raw_steps, list) else []
        return _verify_steps(steps)
    return {"error": 'action must be "equivalence" or "steps"'}


@app.get("/health")
def health():
    return {"status": "ok", "sympy_version": sympy.__version__}


@app.post("/")
async def action_root(req: Request):
    return await _dispatch_action(await req.json())


@app.post("/api/cas_service")
async def action_full_path(req: Request):
    return await _dispatch_action(await req.json())


@app.post("/verify/equivalence")
def verify_equivalence(req: EquivalenceRequest):
    return _check_equivalence(req.expr_a, req.expr_b)


@app.post("/verify/steps")
def verify_steps(req: StepsRequest):
    return _verify_steps(req.steps)
