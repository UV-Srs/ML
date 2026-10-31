import joblib
from pathlib import Path

MODEL_DIR = Path("models")

files = {
    "Production Delay Pipeline": "combined_delivery_delay_pipeline.pkl",
    "Production Risk Pipeline": "combined_delivery_risk_pipeline.pkl",
    "Alternative Supplier Engine": "alternative_supplier_engine.pkl"
}

for name, filename in files.items():
    path = MODEL_DIR / filename
    if not path.exists():
        continue

    print(f"\n{'=' * 50}")
    print(f"{name} ({filename})")

    obj = joblib.load(path)
    print("Object type:", type(obj).__name__)

    if isinstance(obj, dict):
        print("Dictionary keys:", list(obj.keys()))
        if "candidate_db" in obj:
            print(f"Candidate suppliers in database: {len(obj['candidate_db']):,} records across {obj['candidate_db']['Candidate_Supplier_ID'].nunique()} suppliers")
    elif hasattr(obj, "steps"):
        print("Pipeline steps:", [step[0] for step in obj.steps])
        final_estimator = obj.steps[-1][1]
        print("Final Estimator:", type(final_estimator).__name__)
    elif hasattr(obj, "feature_names_in_"):
        print("Features count:", len(obj.feature_names_in_))
