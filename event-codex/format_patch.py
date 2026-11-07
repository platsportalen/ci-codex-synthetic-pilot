"""Fail-closed patch LF normalizer. Only adds a final byte; never edits patch lines."""
from __future__ import annotations

import hashlib
from pathlib import Path
import sys

MAX_PATCH_BYTES = 8192


def normalize_final_lf(data: bytes, expected_sha256: str | None = None) -> bytes:
    if not isinstance(data, bytes) or not 0 < len(data) <= MAX_PATCH_BYTES:
        raise ValueError("patch input must be 1..8192 bytes")
    if b"\x00" in data:
        raise ValueError("binary patch not supported")
    data.decode("utf-8")
    if expected_sha256 is not None:
        if not (len(expected_sha256) == 64 and all(c in "0123456789abcdef" for c in expected_sha256)):
            raise ValueError("invalid expected SHA256")
        if hashlib.sha256(data).hexdigest() != expected_sha256:
            raise ValueError("artifact does not match audited original")
    result = data if data.endswith(b"\n") else data + b"\n"
    if len(result) > MAX_PATCH_BYTES:
        raise ValueError("normalized patch too large")
    return result


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("usage: format_patch.py ORIGINAL NORMALIZED EXPECTED_SHA256")
    original = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    destination.write_bytes(normalize_final_lf(original.read_bytes(), sys.argv[3]))
    print("Original SHA256 matched; only missing terminal LF appended (if necessary).")
