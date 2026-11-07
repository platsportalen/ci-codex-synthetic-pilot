"""Deterministic non-AI demo: produces a diff for only sample.py."""
import pathlib
import subprocess
import sys
import tempfile

source = pathlib.Path(__file__).with_name("sample-baseline.py").read_text()
assert source.count("v <= 0") == 1, "baseline unexpectedly modified"
target = source.replace("v <= 0", "v < 0")
with tempfile.TemporaryDirectory() as d:
    old = pathlib.Path(d) / "old"
    new = pathlib.Path(d) / "new"
    old.write_text(source)
    new.write_text(target)
    p = subprocess.run(["git", "diff", "--no-index", "--", str(old), str(new)],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert p.returncode == 1 and p.stdout.strip()
    text = p.stdout
    # Fixed trusted filenames, never emit temporary filesystem paths.
    lines = text.splitlines(keepends=True)
    for i, line in enumerate(lines):
        if line.startswith("diff --git "):
            lines[i] = "diff --git a/sample.py b/sample.py\n"
        elif line.startswith("--- "):
            lines[i] = "--- a/sample.py\n"
        elif line.startswith("+++ "):
            lines[i] = "+++ b/sample.py\n"
    result = "".join(lines)
    # Git's index lines may include absolute paths only for a/b labels; sanitize.
    assert "a/sample.py" in result and "b/sample.py" in result
    pathlib.Path(sys.argv[1]).write_text(result)
