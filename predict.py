"""
ML Prediction Engine Compatibility Shim
Redirects all imports to the modular ml/predict.py module.
"""
import sys
from pathlib import Path

# Ensure root is in sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from ml.predict import *
from ml.predict import (
    load_models,
    load_alternative_engine,
    predict_orders,
    calculate_production_loss,
    find_alternative_suppliers,
    build_manual_order,
    prepare_features
)
