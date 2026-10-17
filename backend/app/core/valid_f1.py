import pandas as pd

REQUIRED_COLUMNS = [
    "order_id", "order_date", "region", "category",
    "sales", "quantity", "discount", "profit",
]
NUMERIC_COLUMNS = ["sales", "quantity", "discount", "profit"]
DATE_COLUMNS = ["order_date"]


def validate_contract(df: pd.DataFrame) -> list[str]:
    """Return list of error messages. Empty list = valid."""
    errors = []

    if df.empty:
        return ["File is empty."]

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        return [f"Missing required columns: {', '.join(missing)}"]

    for col in NUMERIC_COLUMNS:
        bad = df[col].isna().sum()
        if bad:
            errors.append(f"'{col}' has {bad} non-numeric/empty values.")

    for col in DATE_COLUMNS:
        bad = df[col].isna().sum()
        if bad:
            errors.append(f"'{col}' has {bad} invalid/empty dates.")

    for col in ["order_id", "region", "category"]:
        bad = df[col].isna().sum()
        if bad:
            errors.append(f"'{col}' has {bad} empty values.")

    if (df["quantity"] <= 0).any():
        errors.append("'quantity' must be greater than 0.")
    if (df["sales"] < 0).any():
        errors.append("'sales' contains negative values.")

    return errors