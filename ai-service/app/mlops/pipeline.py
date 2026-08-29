import argparse
import sys
from app.ml.training.pipeline import run_training

def main(argv=None):
    parser = argparse.ArgumentParser(description="End-to-End MLOps Pipeline Orchestrator")
    parser.add_argument("--mode", choices=["real", "development"], default="development")
    parser.add_argument("--dataset-version", default=None)
    parser.add_argument("--no-register", action="store_true")
    args = parser.parse_args(argv)

    print("==================================================")
    print("STARTING E2E MLOPS LIFECYCLE PIPELINE")
    print(f"Mode: {args.mode}")
    print("==================================================")

    # 1. Validate Data & Build Dataset
    print("\n[STAGE 1/7] VALIDATING DATA & BUILDING DATASET...")
    
    # 2. Build Features
    print("[STAGE 2/7] BUILDING FEATURES...")

    # 3. Model Training
    print("[STAGE 3/7] TRAINING OPPORTUNITY RANKER MODEL...")

    # 4. Model Evaluation
    print("[STAGE 4/7] EVALUATING PERFORMANCE AGAINST BASELINES...")

    # 5. Serialization & Metadata Checksums
    print("[STAGE 5/7] SERIALIZING MODEL AND ENFORCING CHECKSUM GATE...")

    # 6. MLflow Tracking Ingestion
    print("[STAGE 6/7] LOGGING METRICS, ARTIFACTS AND TAGS TO MLFLOW...")

    # 7. Model Registry Candidate Registration
    print("[STAGE 7/7] HANDING MODEL OVER TO THE MODEL REGISTRY...")

    try:
        result = run_training(
            mode=args.mode,
            dataset_version=args.dataset_version,
            register_candidate=not args.no_register
        )
        print("\n==================================================")
        if result["status"] == "MODEL_NOT_READY":
            print(f"FAILED: MODEL_NOT_READY - {result['reason']}")
            print("==================================================")
            return 3
        else:
            print("SUCCESS: E2E MLOPS PIPELINE COMPLETED SUCCESSFULLY!")
            print(f"Model Version: {result['modelVersion']}")
            print(f"Model Path: {result['modelPath']}")
            print(f"Artifact Checksum: {result['checksum']}")
            print(f"MLflow Run Status: {result['mlflow'].get('status')}")
            print(f"Registry Status: {result['registry'].get('status')}")
            print("==================================================")
            return 0
    except Exception as exc:
        print(f"\nERROR: PIPELINE FAILED: {exc}")
        print("==================================================")
        return 1

if __name__ == "__main__":
    sys.exit(main())
