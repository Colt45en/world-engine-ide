import pytest
from brain.tokenizers import normalize_unit_expression, detect_domain, route_text


def test_unit_normalization_simple():
    normalized = normalize_unit_expression("kg·m/s^2")
    assert "kg" in normalized and "s" in normalized and ("-2" in normalized or "^" in normalized)


def test_derived_unit_expansion():
    # N should expand to base units when expansion enabled
    res = normalize_unit_expression("N", expand_derived=True)
    assert "kg" in res and "s" in res and "m" in res


def test_domain_detection():
    assert detect_domain("The acceleration is 9.81 m/s^2") == "physics"
    assert detect_domain("\int_0^1 x dx") == "math"
    assert detect_domain("This is a simple sentence.") == "english"


def test_route_text():
    eng, m, p, mode = route_text("compute the sum")
    assert mode == "english" and eng
    eng, m, p, mode = route_text("10 / 2")
    assert mode == "math" and m
    eng, m, p, mode = route_text("9.81 m/s^2")
    assert mode == "physics" and p
