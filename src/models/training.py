from __future__ import annotations

from dataclasses import asdict, dataclass

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss, mean_absolute_error, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from src.config.settings import settings
from src.features.engineering import CURATED_KP_FEATURES, CURATED_PUBLIC_SUPPORT, INTERACTION_FEATURES, build_training_dataset
from src.utils.io import ensure_dir, read_dataframe, write_json
from src.utils.logging import get_logger

logger = get_logger(__name__)


IDENTIFIER_COLUMNS = {
    "team",
    "team_normalized",
    "opponent",
    "opponent_normalized",
    "date",
    "result",
    "location_raw",
    "display_name",
    "season",
    "school_name",
}
TARGET_COLUMNS = {"win", "margin", "team_score", "opp_score"}
CURATED_FEATURES = (
    ["neutral_site", "is_home", "is_away"]
    + [f"{feature}_diff" for feature in CURATED_PUBLIC_SUPPORT]
    + [f"{feature}_diff" for feature in CURATED_KP_FEATURES]
    + INTERACTION_FEATURES
)


@dataclass
class TrainingSummary:
    season: int
    selected_classifier: str
    accuracy: float
    log_loss: float
    roc_auc: float
    margin_mae: float
    training_rows: int
    test_rows: int


def _latest_training_file() -> pd.DataFrame:
    files = sorted(settings.processed_data_dir.glob("training_matchups_*.parquet"))
    if not files:
        raise FileNotFoundError("No processed training data found.")
    return read_dataframe(files[-1])


def _feature_columns(df: pd.DataFrame) -> list[str]:
    return [col for col in CURATED_FEATURES if col in df.columns and pd.api.types.is_numeric_dtype(df[col])]


def _split_train_test(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = df.sort_values("date").reset_index(drop=True)
    split_idx = max(int(len(df) * 0.8), 1)
    train = df.iloc[:split_idx].copy()
    test = df.iloc[split_idx:].copy()
    if test.empty:
        test = train.copy()
    return train, test


def train_all_models() -> TrainingSummary:
    artifacts = build_training_dataset()
    df = _latest_training_file()
    features = _feature_columns(df)
    train_df, test_df = _split_train_test(df)

    X_train = train_df[features]
    y_train = train_df["win"]
    X_test = test_df[features]
    y_test = test_df["win"]

    linear_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("model", LogisticRegression(max_iter=3000, C=0.18)),
        ]
    )
    tree_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            (
                "model",
                HistGradientBoostingClassifier(
                    random_state=42,
                    learning_rate=0.05,
                    max_depth=4,
                    max_leaf_nodes=31,
                    min_samples_leaf=25,
                    l2_regularization=0.5,
                ),
            ),
        ]
    )

    candidate_models = {
        "logistic_regression": linear_pipeline,
        "hist_gradient_boosting": tree_pipeline,
    }
    results: dict[str, dict[str, float]] = {}
    fitted_models: dict[str, Pipeline] = {}
    for name, model in candidate_models.items():
        model.fit(X_train, y_train)
        proba = model.predict_proba(X_test)[:, 1]
        preds = (proba >= 0.5).astype(int)
        results[name] = {
            "accuracy": float(accuracy_score(y_test, preds)),
            "log_loss": float(log_loss(y_test, proba, labels=[0, 1])),
            "roc_auc": float(roc_auc_score(y_test, proba)) if len(np.unique(y_test)) > 1 else 0.5,
        }
        fitted_models[name] = model
        logger.info("%s metrics: %s", name, results[name])

    selected_classifier = min(results.items(), key=lambda item: item[1]["log_loss"])[0]
    classifier = fitted_models[selected_classifier]

    margin_model = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("model", HistGradientBoostingRegressor(random_state=42)),
        ]
    )
    margin_model.fit(X_train, train_df["margin"])
    margin_predictions = margin_model.predict(X_test)
    margin_mae = float(mean_absolute_error(test_df["margin"], margin_predictions))

    model_dir = ensure_dir(settings.model_path)
    joblib.dump(classifier, model_dir / "classifier.joblib")
    joblib.dump(margin_model, model_dir / "margin_regressor.joblib")
    joblib.dump(features, model_dir / "feature_columns.joblib")

    importance = permutation_importance(classifier, X_test, y_test, n_repeats=5, random_state=42, scoring="neg_log_loss")
    top_importances = sorted(
        zip(features, importance.importances_mean),
        key=lambda item: abs(item[1]),
        reverse=True,
    )[:20]
    write_json(
        {
            "selected_classifier": selected_classifier,
            "top_feature_importance": [
                {"feature": feature, "importance": float(value)} for feature, value in top_importances
            ],
        },
        model_dir / "feature_importance.json",
    )
    write_json(
        {
            "context_features": [feature for feature in ["neutral_site", "is_home", "is_away"] if feature in features],
            "raw_resume_features": [
                feature
                for feature in ["games_played_before_diff", "top50_win_pct_pre_diff", "top100_win_pct_pre_diff"]
                if feature in features
            ],
            "schedule_adjusted_public_features": [
                feature
                for feature in [f"{col}_diff" for col in CURATED_PUBLIC_SUPPORT]
                if feature in features
                and feature
                not in {"games_played_before_diff", "top50_win_pct_pre_diff", "top100_win_pct_pre_diff"}
            ],
            "opponent_adjusted_strength_features": [
                feature for feature in [f"{col}_diff" for col in CURATED_KP_FEATURES] if feature in features
            ],
            "matchup_interaction_features": [feature for feature in INTERACTION_FEATURES if feature in features],
        },
        model_dir / "feature_audit.json",
    )

    summary = TrainingSummary(
        season=artifacts.season,
        selected_classifier=selected_classifier,
        accuracy=results[selected_classifier]["accuracy"],
        log_loss=results[selected_classifier]["log_loss"],
        roc_auc=results[selected_classifier]["roc_auc"],
        margin_mae=margin_mae,
        training_rows=len(train_df),
        test_rows=len(test_df),
    )
    write_json(asdict(summary), model_dir / "training_summary.json")
    logger.info("Training complete with selected classifier=%s", selected_classifier)
    return summary
