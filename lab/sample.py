def total(values):
    """Synthetic exercise: sum positive integers (zero support is next step)."""
    if any(type(v) is not int or v <= 0 for v in values):
        raise ValueError("positive integers required")
    return sum(values)
