from __future__ import annotations

from dataclasses import asdict, dataclass

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss, mean_absolute_error, roc_auc_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from src.config.settings import settings
from src.features.engineering import (
    CONTEXT_FEATURES,
    CURATED_KP_FEATURES,
    CURATED_PUBLIC_SUPPORT,
    EXTERNAL_TEAM_FEATURES,
    INTERACTION_FEATURES,
    MARKET_FEATURES,
    build_training_dataset,
)
from src.utils.io import ensure_dir, read_dataframe, write_json
from src.utils.logging import get_logger

logger = get_logger(__name__)

try:  # pragma: no cover - optional dependency
    from xgboost import XGBClassifier, XGBRegressor
except Exception:  # noqa: BLE001
    XGBClassifier = None
    XGBRegressor = None


DEFAULT_RANDOM_STATE = 42


@dataclass
class TrainingSummary:
    season: int
    selected_feature_family: str
    selected_classifier: str
    selected_regressor: str
    calibration_method: str
    evaluation_method: str
    accuracy: float
    log_loss: float
    brier_score: float
    roc_auc: float
    margin_mae: float
    training_rows: int
    evaluation_folds: int
    market_features_available: bool


def _latest_training_file() -> pd.DataFrame:
    files = sorted(settings.processed_data_dir.glob("training_matchups_*.parquet"))
    if not files:
        raise FileNotFoundError("No processed training data found.")
    return read_dataframe(files[-1]).sort_values("date").reset_index(drop=True)


def _numeric_columns(df: pd.DataFrame, candidates: list[str]) -> list[str]:
    return [col for col in candidates if col in df.columns and pd.api.types.is_numeric_dtype(df[col])]


def _paired_features(base_features: list[str]) -> list[str]:
    features: list[str] = []
    for feature in base_features:
        features.extend([feature, f"opp_{feature}", f"{feature}_diff"])
    return features


def _feature_family_columns(df: pd.DataFrame, family_name: str) -> list[str]:
    family_lookup = {
        "kenpom_only": CONTEXT_FEATURES + _paired_features(EXTERNAL_TEAM_FEATURES + CURATED_KP_FEATURES),
        "kenpom_plus_form": (
            CONTEXT_FEATURES
            + _paired_features(EXTERNAL_TEAM_FEATURES + CURATED_KP_FEATURES + CURATED_PUBLIC_SUPPORT)
            + [feature for feature in INTERACTION_FEATURES if feature in df.columns]
        ),
        "kenpom_plus_form_plus_market": (
            CONTEXT_FEATURES
            + _paired_features(EXTERNAL_TEAM_FEATURES + CURATED_KP_FEATURES + CURATED_PUBLIC_SUPPORT + MARKET_FEATURES)
            + [feature for feature in INTERACTION_FEATURES if feature in df.columns]
        ),
    }
    return _numeric_columns(df, family_lookup[family_name])


def _available_feature_families(df: pd.DataFrame) -> dict[str, list[str]]:
    families = {
        "kenpom_only": _feature_family_columns(df, "kenpom_only"),
        "kenpom_plus_form": _feature_family_columns(df, "kenpom_plus_form"),
    }
    market_columns = [col for col in _paired_features(MARKET_FEATURES) if col in df.columns]
    if market_columns:
        families["kenpom_plus_form_plus_market"] = _feature_family_columns(df, "kenpom_plus_form_plus_market")
    return {name: cols for name, cols in families.items() if cols}


def _time_series_splits(df: pd.DataFrame, desired_splits: int = 5) -> list[tuple[np.ndarray, np.ndarray]]:
    n_rows = len(df)
    if n_rows < 600:
        split_idx = max(int(n_rows * 0.8), 1)
        return [(np.arange(split_idx), np.arange(split_idx, n_rows))]

    test_size = max(int(n_rows * 0.08), 250)
    max_splits = max(2, min(desired_splits, (n_rows // test_size) - 1))
    splitter = TimeSeriesSplit(n_splits=max_splits, test_size=test_size)
    min_train_rows = max(int(n_rows * 0.45), test_size * 2)
    splits = [(train_idx, test_idx) for train_idx, test_idx in splitter.split(df) if len(train_idx) >= min_train_rows]
    if not splits:
        split_idx = max(int(n_rows * 0.8), 1)
        return [(np.arange(split_idx), np.arange(split_idx, n_rows))]
    return splits


def _classifier_factories() -> dict[str, callable]:
    factories: dict[str, callable] = {
        "logistic_regression": lambda: Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                (
                    "model",
                    LogisticRegression(
                        max_iter=5000,
                        C=0.35,
                        class_weight="balanced",
                        random_state=DEFAULT_RANDOM_STATE,
                    ),
                ),
            ]
        ),
        "random_forest": lambda: Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    RandomForestClassifier(
                        n_estimators=500,
                        min_samples_leaf=8,
                        max_depth=10,
                        random_state=DEFAULT_RANDOM_STATE,
                        n_jobs=-1,
                    ),
                ),
            ]
        ),
        "gradient_boosting": lambda: Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    GradientBoostingClassifier(
                        learning_rate=0.05,
                        n_estimators=250,
                        max_depth=3,
                        random_state=DEFAULT_RANDOM_STATE,
                    ),
                ),
            ]
        ),
        "hist_gradient_boosting": lambda: Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    HistGradientBoostingClassifier(
                        random_state=DEFAULT_RANDOM_STATE,
                        learning_rate=0.04,
                        max_depth=5,
                        max_leaf_nodes=31,
                        min_samples_leaf=20,
                        l2_regularization=0.6,
                    ),
                ),
            ]
        ),
    }
    if XGBClassifier is not None:
        factories["xgboost"] = lambda: Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    XGBClassifier(
                        n_estimators=300,
                        max_depth=4,
                        learning_rate=0.04,
                        subsample=0.9,
                        colsample_bytree=0.9,
                        reg_lambda=1.0,
                        random_state=DEFAULT_RANDOM_STATE,
                        eval_metric="logloss",
                        tree_method="hist",
                    ),
                ),
            ]
        )
    return factories


def _regressor_factories() -> dict[str, callable]:
    factories: dict[str, callable] = {
        "random_forest": lambda: Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    RandomForestRegressor(
                        n_estimators=400,
                        min_samples_leaf=8,
                        max_depth=10,
                        random_state=DEFAULT_RANDOM_STATE,
                        n_jobs=-1,
                    ),
                ),
            ]
        ),
        "gradient_boosting": lambda: Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    GradientBoostingRegressor(
                        learning_rate=0.05,
                        n_estimators=250,
                        max_depth=3,
                        random_state=DEFAULT_RANDOM_STATE,
                    ),
                ),
            ]
        ),
        "hist_gradient_boosting": lambda: Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    HistGradientBoostingRegressor(
                        random_state=DEFAULT_RANDOM_STATE,
                        learning_rate=0.05,
                        max_depth=5,
                        max_leaf_nodes=31,
                        min_samples_leaf=18,
                    ),
                ),
            ]
        ),
    }
    if XGBRegressor is not None:
        factories["xgboost"] = lambda: Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    XGBRegressor(
                        n_estimators=300,
                        max_depth=4,
                        learning_rate=0.04,
                        subsample=0.9,
                        colsample_bytree=0.9,
                        reg_lambda=1.0,
                        random_state=DEFAULT_RANDOM_STATE,
                        tree_method="hist",
                    ),
                ),
            ]
        )
    return factories


def _evaluate_classifier(factory, X: pd.DataFrame, y: pd.Series, splits: list[tuple[np.ndarray, np.ndarray]]) -> dict[str, float]:
    metrics = {
        "accuracy": [],
        "log_loss": [],
        "brier_score": [],
        "roc_auc": [],
    }
    for train_idx, test_idx in splits:
        estimator = factory()
        estimator.fit(X.iloc[train_idx], y.iloc[train_idx])
        probabilities = estimator.predict_proba(X.iloc[test_idx])[:, 1]
        predictions = (probabilities >= 0.5).astype(int)
        y_true = y.iloc[test_idx]
        metrics["accuracy"].append(float(accuracy_score(y_true, predictions)))
        metrics["log_loss"].append(float(log_loss(y_true, probabilities, labels=[0, 1])))
        metrics["brier_score"].append(float(brier_score_loss(y_true, probabilities)))
        metrics["roc_auc"].append(float(roc_auc_score(y_true, probabilities)) if len(np.unique(y_true)) > 1 else 0.5)
    return {metric: float(np.mean(values)) for metric, values in metrics.items()}


def _evaluate_regressor(factory, X: pd.DataFrame, y: pd.Series, splits: list[tuple[np.ndarray, np.ndarray]]) -> dict[str, float]:
    maes: list[float] = []
    for train_idx, test_idx in splits:
        estimator = factory()
        estimator.fit(X.iloc[train_idx], y.iloc[train_idx])
        predictions = estimator.predict(X.iloc[test_idx])
        maes.append(float(mean_absolute_error(y.iloc[test_idx], predictions)))
    return {"mae": float(np.mean(maes))}


def _select_classifier(results: list[dict[str, object]]) -> dict[str, object]:
    return min(
        results,
        key=lambda row: (
            float(row["log_loss"]),
            float(row["brier_score"]),
            -float(row["accuracy"]),
        ),
    )


def _select_regressor(results: list[dict[str, object]]) -> dict[str, object]:
    return min(results, key=lambda row: float(row["mae"]))


def train_all_models() -> TrainingSummary:
    artifacts = build_training_dataset()
    df = _latest_training_file()
    feature_families = _available_feature_families(df)
    splits = _time_series_splits(df)

    classifier_results: list[dict[str, object]] = []
    for family_name, feature_columns in feature_families.items():
        X = df[feature_columns]
        y = df["win"].astype(int)
        for model_name, factory in _classifier_factories().items():
            metrics = _evaluate_classifier(factory, X, y, splits)
            row = {
                "feature_family": family_name,
                "model": model_name,
                **metrics,
            }
            classifier_results.append(row)
            logger.info("Classifier %s / %s metrics: %s", family_name, model_name, metrics)

    selected_classifier_row = _select_classifier(classifier_results)
    selected_feature_family = str(selected_classifier_row["feature_family"])
    selected_classifier_name = str(selected_classifier_row["model"])
    selected_features = feature_families[selected_feature_family]

    regressor_results: list[dict[str, object]] = []
    X_margin = df[selected_features]
    y_margin = df["margin"].astype(float)
    for model_name, factory in _regressor_factories().items():
        metrics = _evaluate_regressor(factory, X_margin, y_margin, splits)
        regressor_results.append({"feature_family": selected_feature_family, "model": model_name, **metrics})
        logger.info("Regressor %s / %s metrics: %s", selected_feature_family, model_name, metrics)
    selected_regressor_row = _select_regressor(regressor_results)
    selected_regressor_name = str(selected_regressor_row["model"])

    classifier_factory = _classifier_factories()[selected_classifier_name]
    base_classifier = classifier_factory()
    calibrated_classifier = CalibratedClassifierCV(
        estimator=classifier_factory(),
        method="sigmoid",
        cv=splits,
    )
    calibrated_classifier.fit(df[selected_features], df["win"].astype(int))
    base_classifier.fit(df[selected_features], df["win"].astype(int))

    regressor_factory = _regressor_factories()[selected_regressor_name]
    margin_regressor = regressor_factory()
    margin_regressor.fit(df[selected_features], df["margin"].astype(float))

    model_dir = ensure_dir(settings.model_path)
    joblib.dump(calibrated_classifier, model_dir / "classifier.joblib")
    joblib.dump(margin_regressor, model_dir / "margin_regressor.joblib")
    joblib.dump(selected_features, model_dir / "feature_columns.joblib")

    feature_importance_split = splits[-1][1]
    importance = permutation_importance(
        base_classifier,
        df.iloc[feature_importance_split][selected_features],
        df.iloc[feature_importance_split]["win"].astype(int),
        n_repeats=5,
        random_state=DEFAULT_RANDOM_STATE,
        scoring="neg_log_loss",
    )
    top_importances = sorted(
        zip(selected_features, importance.importances_mean),
        key=lambda item: abs(item[1]),
        reverse=True,
    )[:20]

    write_json(
        {
            "selected_classifier": selected_classifier_name,
            "selected_regressor": selected_regressor_name,
            "selected_feature_family": selected_feature_family,
            "top_feature_importance": [
                {"feature": feature, "importance": float(value)} for feature, value in top_importances
            ],
        },
        model_dir / "feature_importance.json",
    )
    write_json(
        {
            "feature_families": {
                "context": [feature for feature in CONTEXT_FEATURES if feature in selected_features],
                "external": [feature for feature in _paired_features(EXTERNAL_TEAM_FEATURES) if feature in selected_features],
                "kenpom": [feature for feature in _paired_features(CURATED_KP_FEATURES) if feature in selected_features],
                "form": [feature for feature in _paired_features(CURATED_PUBLIC_SUPPORT) if feature in selected_features],
                "interaction": [feature for feature in INTERACTION_FEATURES if feature in selected_features],
                "market": [feature for feature in _paired_features(MARKET_FEATURES) if feature in selected_features],
            },
            "all_selected_features": selected_features,
        },
        model_dir / "feature_audit.json",
    )
    write_json(
        {
            "evaluation_method": "rolling_origin_time_series_split",
            "folds": [
                {
                    "train_rows": int(len(train_idx)),
                    "test_rows": int(len(test_idx)),
                    "train_start": str(df.iloc[train_idx[0]]["date"]),
                    "train_end": str(df.iloc[train_idx[-1]]["date"]),
                    "test_start": str(df.iloc[test_idx[0]]["date"]),
                    "test_end": str(df.iloc[test_idx[-1]]["date"]),
                }
                for train_idx, test_idx in splits
            ],
            "classifier_results": classifier_results,
            "regressor_results": regressor_results,
            "market_features_available": artifacts.market_features_available,
            "xgboost_available": XGBClassifier is not None,
        },
        model_dir / "model_selection.json",
    )

    summary = TrainingSummary(
        season=artifacts.season,
        selected_feature_family=selected_feature_family,
        selected_classifier=selected_classifier_name,
        selected_regressor=selected_regressor_name,
        calibration_method="sigmoid",
        evaluation_method="rolling_origin_time_series_split",
        accuracy=float(selected_classifier_row["accuracy"]),
        log_loss=float(selected_classifier_row["log_loss"]),
        brier_score=float(selected_classifier_row["brier_score"]),
        roc_auc=float(selected_classifier_row["roc_auc"]),
        margin_mae=float(selected_regressor_row["mae"]),
        training_rows=len(df),
        evaluation_folds=len(splits),
        market_features_available=artifacts.market_features_available,
    )
    write_json(asdict(summary), model_dir / "training_summary.json")
    logger.info(
        "Training complete with classifier=%s, regressor=%s, family=%s",
        selected_classifier_name,
        selected_regressor_name,
        selected_feature_family,
    )
    return summary
