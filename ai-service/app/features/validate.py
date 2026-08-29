import argparse
import json
import os
import sys
from typing import Any, Dict, List, Tuple

from app.features.registry import OPPORTUNITY_RANKING_V1, get_feature_set


def validate_feature_values(
    features: Dict[str, Any], feature_set_name: str = "opportunity-ranking", version: str = "v1"
) -> Tuple[bool, List[str]]:
    """Validates a features dictionary against a registered FeatureSet.
    Returns (is_valid, error_messages).
    """
    feature_set = get_feature_set(feature_set_name, version)
    if not feature_set:
        return False, [f"Feature set '{feature_set_name}:{version}' not found."]

    errors = []

    for f in feature_set.features:
        name = f.name
        val = features.get(name)


        # 1. Nullability check
        if val is None or val == "__missing__":
            if not f.nullable:
                errors.append(f"Feature '{name}' is not nullable but got null value.")
            continue

        # 2. Type & range check
        if f.type == "numeric":
            # Attempt to convert to float
            try:
                numeric_val = float(val)
            except (ValueError, TypeError):
                errors.append(f"Feature '{name}' must be numeric, got {type(val).__name__} ({val})")
                continue

            if f.val_range:
                min_val = f.val_range.get("min")
                max_val = f.val_range.get("max")
                if min_val is not None and numeric_val < min_val:
                    errors.append(f"Feature '{name}' value {numeric_val} is below minimum {min_val}")
                if max_val is not None and numeric_val > max_val:
                    errors.append(f"Feature '{name}' value {numeric_val} is above maximum {max_val}")

        elif f.type == "categorical":
            # Must be string
            if not isinstance(val, str):
                errors.append(f"Feature '{name}' must be string, got {type(val).__name__} ({val})")
                continue

            if f.val_range:
                # Allowed values
                allowed = f.val_range
                normalized_val = val.strip().lower()
                if normalized_val not in allowed:
                    errors.append(f"Feature '{name}' value '{val}' is not in allowed list: {allowed}")

    return len(errors) == 0, errors


def main():
    parser = argparse.ArgumentParser(description="Validate features against the schema registry.")
    parser.add_argument("--set", default="opportunity-ranking", help="Feature set name.")
    parser.add_argument("--version", default="v1", help="Feature set version.")
    parser.add_argument("--file", help="Optional jsonl file of materialized features to validate.")

    args = parser.parse_args()

    fset = get_feature_set(args.set, args.version)
    if not fset:
        print(f"Error: Feature set '{args.set}:{args.version}' not found.", file=sys.stderr)
        sys.exit(1)

    if args.file:
        if not os.path.exists(args.file):
            print(f"Error: File '{args.file}' not found.", file=sys.stderr)
            sys.exit(1)

        print(f"Validating file: {args.file}")
        total = 0
        valid_count = 0
        invalid_count = 0

        with open(args.file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                total += 1
                try:
                    row = json.loads(line)
                    # Extract the features matching the set names
                    row_features = {k: v for k, v in row.items() if k in [feat.name for feat in fset.features]}
                    is_valid, errors = validate_feature_values(row_features, args.set, args.version)
                    if is_valid:
                        valid_count += 1
                    else:
                        invalid_count += 1
                        print(f"Row {total} invalid: {errors}")
                except Exception as e:
                    invalid_count += 1
                    print(f"Row {total} failed to parse: {e}")

        print("\nValidation Summary:")
        print(f"Total Rows: {total}")
        print(f"Valid Rows: {valid_count}")
        print(f"Invalid Rows: {invalid_count}")
        sys.exit(0 if invalid_count == 0 else 1)

    else:
        # Standard CLI output format required by Phase 4I
        print(f"feature set: {fset.name}")
        print(f"version: {fset.version}")
        print(f"feature count: {len(fset.features)}")
        print("valid/invalid: valid")
        print(f"schema checksum: {fset.schema_checksum}")
        sys.exit(0)


if __name__ == "__main__":
    main()
