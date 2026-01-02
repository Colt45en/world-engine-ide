"""Surrogate model with tokenized English/Math/Physics branches.

Provides:
- build_vectorizers
- build_surrogate_model_with_routing
- train_from_logs_routed
- predict_routed

Requirements: tensorflow 2.12+
"""
from __future__ import annotations

import importlib
import json
from types import ModuleType
from typing import Any, Tuple

import numpy as np

try:
    # When imported as part of the `brain` package (src-layout).
    from .tokenizers import normalize_unit_expression, route_text
except ImportError:  # pragma: no cover
    # Fallback for environments that resolve `brain` as a top-level package.
    from brain.tokenizers import normalize_unit_expression, route_text


def _require_tensorflow() -> ModuleType:
    """Import TensorFlow only when needed to avoid hard dependency at import time."""
    try:
        return importlib.import_module("tensorflow")
    except Exception as e:  # pragma: no cover
        raise ModuleNotFoundError(
            "TensorFlow is required for surrogate_token_model; install it with "
            "`pip install tensorflow` (or `pip install tensorflow-cpu`)."
        ) from e

# Re-implement graph-friendly tokenization helpers here to avoid circular TF import issues.

_MATH_TOKEN_PATTERN = (
    r"(\\[A-Za-z]+)"
    r"|((?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][+\-]?\d+)?)"
    r"|([A-Za-zα-ωΑ-ΩμħεσπΔΩ]+(?:_[A-Za-z0-9α-ωΑ-ΩμħεσπΔΩ]+)?)"
    r"|([+\-*/^=<>±×÷·∙⋅∗∧∨¬∩∪∈∉⊂⊆⊃⊇≈≠≤≥→←↔⇒⇐⇔∞∑∏∫∂∇∥⊥°%!])"
    r"|([\(\)\[\]\{\},:;|])"
)


def build_vectorizers(
    english_texts, math_texts, physics_texts, vocab_size=20000, seq_len=64
) -> Tuple[Any, Any, Any]:
    """Create three TextVectorization layers adapted to provided corpora."""
    tf: ModuleType = _require_tensorflow()

    eng_vec = tf.keras.layers.TextVectorization(
        max_tokens=vocab_size,
        output_mode="int",
        output_sequence_length=seq_len,
        standardize=lambda x: tf.strings.strip(
            tf.strings.regex_replace(
                tf.strings.lower(x),
                r"(\.|,|!|\?|;|:|\(|\)|\{|\}|\[|\]|\"|')",
                r" \1 ",
            )
        ),
        split="whitespace",
    )
    eng_vec.adapt(tf.data.Dataset.from_tensor_slices(english_texts).batch(128))

    math_vec = tf.keras.layers.TextVectorization(
        max_tokens=vocab_size,
        output_mode="int",
        output_sequence_length=seq_len,
        standardize=None,
        split="whitespace",
    )
    phys_vec = tf.keras.layers.TextVectorization(
        max_tokens=vocab_size,
        output_mode="int",
        output_sequence_length=seq_len,
        standardize=None,
        split="whitespace",
    )

    # NOTE: The vectorizers expect whitespace-separated tokens; upstream routing/tokenization
    # is handled by `route_text()` and `normalize_unit_expression()`.
    math_vec.adapt(tf.data.Dataset.from_tensor_slices(math_texts).batch(128))
    phys_vec.adapt(tf.data.Dataset.from_tensor_slices(physics_texts).batch(128))

    return eng_vec, math_vec, phys_vec


def build_surrogate_model_with_routing(eng_vec, math_vec, phys_vec, embed_dim=64):
    tf: ModuleType = _require_tensorflow()

    args_in = tf.keras.Input(shape=(2,), dtype=tf.float32, name="args")
    x_num = tf.keras.layers.Dense(64, activation="swish")(args_in)
    x_num = tf.keras.layers.Dense(64, activation="swish")(x_num)
    x_num = tf.keras.layers.Dense(32, activation="swish")(x_num)

    eng_in = tf.keras.Input(shape=(), dtype=tf.string, name="english_text")
    math_in = tf.keras.Input(shape=(), dtype=tf.string, name="math_text")
    phys_in = tf.keras.Input(shape=(), dtype=tf.string, name="physics_text")

    eng_ids = eng_vec(eng_in)
    eng_emb = tf.keras.layers.Embedding(input_dim=eng_vec.vocabulary_size(), output_dim=embed_dim, mask_zero=True)(eng_ids)
    eng_feat = tf.keras.layers.GlobalAveragePooling1D()(eng_emb)

    # Math: pre-tokenize and join in graph
    math_tokens = tf.keras.layers.Lambda(lambda x: tf.strings.regex_replace(x, r"\s+", " "))(math_in)
    math_ids = math_vec(math_tokens)
    math_emb = tf.keras.layers.Embedding(input_dim=math_vec.vocabulary_size(), output_dim=embed_dim, mask_zero=True)(math_ids)
    math_feat = tf.keras.layers.GlobalAveragePooling1D()(math_emb)

    phys_tokens = tf.keras.layers.Lambda(lambda x: tf.strings.regex_replace(x, r"\s+", " "))(phys_in)
    phys_ids = phys_vec(phys_tokens)
    phys_emb = tf.keras.layers.Embedding(input_dim=phys_vec.vocabulary_size(), output_dim=embed_dim, mask_zero=True)(phys_ids)
    phys_feat = tf.keras.layers.GlobalAveragePooling1D()(phys_emb)

    fused = tf.keras.layers.Concatenate()([x_num, eng_feat, math_feat, phys_feat])
    fused = tf.keras.layers.Dense(128, activation="swish")(fused)
    fused = tf.keras.layers.Dense(64, activation="swish")(fused)
    out = tf.keras.layers.Dense(1, name="predicted_result")(fused)

    model = tf.keras.Model(inputs={"args": args_in, "english_text": eng_in, "math_text": math_in, "physics_text": phys_in}, outputs=out, name="surrogate_routed")

    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="mse", metrics=["mae"])
    return model


def train_from_logs_routed(
    json_logs_path: str, op_filter: str = "safeDiv", expand_derived: bool = True
) -> Tuple[Any, Tuple[Any, Any, Any]]:
    with open(json_logs_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    features_args = []
    routed_english = []
    routed_math = []
    routed_physics = []
    labels = []

    for entry in data:
        if entry.get("op") != op_filter:
            continue
        res = entry.get("res", {})
        if not res.get("ok", False):
            continue
        args = entry.get("args", None)
        if not (isinstance(args, list) and len(args) == 2):
            continue

        text = entry.get("text")
        if not isinstance(text, str) or not text.strip():
            candidates = []
            for k: str in ("english_in", "english_out", "math_expr", "physics_expr", "prompt"):
                v = entry.get(k)
                if isinstance(v, str) and v.strip():
                    candidates.append(v.strip())
            text: str = " ".join(candidates) if candidates else f"{entry.get('op')}({args[0]}, {args[1]})"

        eng, mth, phy, mode = route_text(text)

        if phy:
            phy = normalize_unit_expression(phy, expand_derived=expand_derived)

        features_args.append(args)
        routed_english.append(eng)
        routed_math.append(mth)
        routed_physics.append(phy)
        labels.append(float(res["value"]))

    if not labels:
        raise ValueError(f"No usable training examples found for op={op_filter} in {json_logs_path}")

    X_args = np.array(features_args, dtype=np.float32)
    y = np.array(labels, dtype=np.float32)

    eng_vec, math_vec, phys_vec = build_vectorizers(routed_english, routed_math, routed_physics)

    model = build_surrogate_model_with_routing(eng_vec, math_vec, phys_vec, embed_dim=64)

    X = {
        "args": X_args,
        "english_text": np.array(routed_english, dtype=object),
        "math_text": np.array(routed_math, dtype=object),
        "physics_text": np.array(routed_physics, dtype=object),
    }

    model.fit(X, y, epochs=10, verbose=1)
    return model, (eng_vec, math_vec, phys_vec)


def predict_routed(model, a: float, b: float, text: str) -> float:
    _: ModuleType = _require_tensorflow()

    eng, mth, phy, mode = route_text(text)
    if phy:
        phy = normalize_unit_expression(phy)
    X = {
        "args": np.array([[a, b]], dtype=np.float32),
        "english_text": np.array([eng], dtype=object),
        "math_text": np.array([mth], dtype=object),
        "physics_text": np.array([phy], dtype=object),
    }
    y = model.predict(X, verbose=0)
    return float(y[0, 0])
