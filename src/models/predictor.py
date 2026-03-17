from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

import joblib
import pandas as pd

from src.config.settings import settings
from src.features.engineering import INTERACTION_FEATURES, _latest_season
from src.utils.io import read_dataframe
from src.utils.team_names import canonicalize_name, normalizer


REASON_TEMPLATES = {
    "adjem_diff": "{team} owns the stronger adjusted efficiency margin.",
    "adjo_diff": "{team} projects better offensively by adjusted efficiency.",
    "adjd_diff": "{team} has the stronger adjusted defense profile.",
    "seed_estimate_diff": "{team} carries the stronger seed-line profile.",
    "win_pct_pre_diff": "{team} has delivered the better full-season record.",
    "avg_margin_pre_diff": "{team} has built the stronger average margin profile.",
    "recent_win_pct_5_diff": "{team} has the better recent five-game form.",
    "recent_margin_5_diff": "{team} has been winning more convincingly lately.",
    "recent_form_rating_diff": "{team} enters with the stronger recent-form rating.",
    "sos_adjem_diff": "{team} brings the stronger overall strength-of-schedule profile.",
    "quality_vs_schedule_diff": "{team} pairs stronger adjusted quality with a tougher schedule.",
    "opponent_quality_resilience_diff": "{team} has held up better after adjusting for opponent quality.",
    "shooting_matchup_diff": "{team}'s shot-making profile aligns better with the opponent's defensive weaknesses.",
    "three_point_matchup_diff": "{team} has the better three-point matchup on both ends.",
    "turnover_matchup_diff": "{team} is better positioned in the turnover battle.",
    "offensive_rebound_matchup_diff": "{team} has the more favorable offensive rebounding matchup.",
    "free_throw_matchup_diff": "{team} has the better foul-drawing and free-throw profile for this matchup.",
    "style_conflict_diff": "{team}'s scoring profile is a tougher stylistic fit for this opponent.",
}


@dataclass
class PredictionResult:
    team_a: str
    team_b: str
    predicted_winner: str
    win_probability_team_a: float
    win_probability_team_b: float
    predicted_margin: float | None
    top_reasons: list[str]
    feature_snapshot: dict[str, float]


class MatchupPredictor:
    def __init__(
        self,
        classifier=None,
        margin_regressor=None,
        feature_columns: list[str] | None = None,
        team_profiles: pd.DataFrame | None = None,
    ) -> None:
        model_dir = settings.model_path
        self.classifier = classifier or joblib.load(model_dir / "classifier.joblib")
        self.margin_regressor = margin_regressor or joblib.load(model_dir / "margin_regressor.joblib")
        self.feature_columns: list[str] = feature_columns or joblib.load(model_dir / "feature_columns.joblib")
        if team_profiles is None:
            season = _latest_season()
            self.team_profiles = read_dataframe(settings.processed_data_dir / f"team_profiles_{season}.parquet")
        else:
            self.team_profiles = team_profiles.copy()
        self._display_lookup: dict[str, str] = {}
        for row in self.team_profiles.itertuples(index=False):
            display_name = str(getattr(row, "display_name", "")).strip()
            team_name = str(getattr(row, "team", "")).strip()
            normalized = str(getattr(row, "team_normalized", "")).strip()
            if normalized:
                if display_name:
                    self._display_lookup[canonicalize_name(display_name)] = normalized
                if team_name:
                    self._display_lookup[canonicalize_name(team_name)] = normalized

    def list_teams(self) -> list[str]:
        return sorted(self.team_profiles["display_name"].dropna().unique().tolist())

    def list_ranked_teams(self) -> list[dict[str, Any]]:
        profiles = self.team_profiles.copy()
        if "rk" in profiles.columns:
            profiles["rk_numeric"] = pd.to_numeric(profiles["rk"], errors="coerce")
            profiles = profiles.sort_values(["rk_numeric", "display_name"], na_position="last")
        else:
            profiles = profiles.sort_values("display_name")
        ranked = []
        for row in profiles.itertuples(index=False):
            ranked.append(
                {
                    "name": str(getattr(row, "display_name", getattr(row, "team", ""))),
                    "rank": None if pd.isna(getattr(row, "rk_numeric", None)) else int(getattr(row, "rk_numeric")),
                }
            )
        return ranked

    def search_teams(self, query: str, limit: int = 8) -> dict[str, Any]:
        teams = self.list_teams()
        normalized_query = canonicalize_name(query)
        if not normalized_query:
            return {
                "query": query,
                "matches": teams[:limit],
                "exact_match": None,
                "strong_match": None,
            }

        exact_match = next((team for team in teams if canonicalize_name(team) == normalized_query), None)
        scored: list[tuple[str, float, int]] = []
        for team in teams:
            normalized_team = canonicalize_name(team)
            substring_bonus = 0.0
            if normalized_team.startswith(normalized_query):
                substring_bonus = 0.35
            elif normalized_query in normalized_team:
                substring_bonus = 0.2
            score = SequenceMatcher(None, normalized_query, normalized_team).ratio() + substring_bonus
            if score >= 0.45:
                scored.append((team, score, abs(len(normalized_team) - len(normalized_query))))
        scored.sort(key=lambda item: (-item[1], item[2], item[0]))
        matches = [team for team, _, _ in scored[:limit]]
        if exact_match and exact_match not in matches:
            matches = [exact_match] + matches[: max(limit - 1, 0)]
        strong_match = matches[0] if matches and scored and scored[0][1] >= 0.82 else None
        return {
            "query": query,
            "matches": matches,
            "exact_match": exact_match,
            "strong_match": strong_match if strong_match != exact_match or exact_match is None else exact_match,
        }

    def _team_row(self, team_name: str) -> pd.Series:
        display_key = canonicalize_name(team_name)
        canonical = self._display_lookup.get(display_key, normalizer.resolve(team_name))
        match = self.team_profiles[self.team_profiles["team_normalized"] == canonical]
        if match.empty:
            raise ValueError(f"Unknown team: {team_name}")
        return match.iloc[-1]

    @staticmethod
    def _num(row: pd.Series, column: str) -> float:
        return float(pd.to_numeric(row.get(column), errors="coerce"))

    def _interaction_values(self, a: pd.Series, b: pd.Series) -> dict[str, float]:
        def edge(off_row: pd.Series, off_col: str, def_row: pd.Series, def_col: str) -> float:
            return self._num(off_row, off_col) - self._num(def_row, def_col)

        a_shooting = edge(a, "off_efg", b, "def_efg")
        b_shooting = edge(b, "off_efg", a, "def_efg")
        a_three = edge(a, "off_3p_pct", b, "def_3p_pct")
        b_three = edge(b, "off_3p_pct", a, "def_3p_pct")
        a_two = edge(a, "off_2p_pct", b, "def_2p_pct")
        b_two = edge(b, "off_2p_pct", a, "def_2p_pct")
        a_profile = edge(a, "off_3pa_rate", b, "def_3pa_rate")
        b_profile = edge(b, "off_3pa_rate", a, "def_3pa_rate")
        a_turnover = (100 - self._num(a, "off_to")) - self._num(b, "def_to")
        b_turnover = (100 - self._num(b, "off_to")) - self._num(a, "def_to")
        a_or = edge(a, "off_or", b, "def_or")
        b_or = edge(b, "off_or", a, "def_or")
        a_ft = edge(a, "off_ftrate", b, "def_ftrate")
        b_ft = edge(b, "off_ftrate", a, "def_ftrate")
        a_ast = edge(a, "off_assist_rate", b, "def_assist_rate_allowed")
        b_ast = edge(b, "off_assist_rate", a, "def_assist_rate_allowed")
        a_rim = edge(a, "off_2p_pct", b, "def_blk_rate")
        b_rim = edge(b, "off_2p_pct", a, "def_blk_rate")
        a_style = edge(a, "ptdist_3p_share", b, "ptdist_3p_allowed_share")
        b_style = edge(b, "ptdist_3p_share", a, "ptdist_3p_allowed_share")

        return {
            "quality_vs_schedule_diff": self._num(a, "adjem") + 0.5 * self._num(a, "sos_adjem")
            - self._num(b, "adjem")
            - 0.5 * self._num(b, "sos_adjem"),
            "shooting_matchup_diff": a_shooting - b_shooting,
            "three_point_matchup_diff": a_three - b_three,
            "two_point_matchup_diff": a_two - b_two,
            "shot_profile_matchup_diff": a_profile - b_profile,
            "turnover_matchup_diff": a_turnover - b_turnover,
            "offensive_rebound_matchup_diff": a_or - b_or,
            "free_throw_matchup_diff": a_ft - b_ft,
            "assist_creation_matchup_diff": a_ast - b_ast,
            "rim_pressure_matchup_diff": a_rim - b_rim,
            "style_conflict_diff": a_style - b_style,
            "tempo_clash_abs": abs(self._num(a, "adjt") - self._num(b, "adjt")),
            "size_experience_diff": self._num(a, "avg_hgt")
            + self._num(a, "experience")
            + self._num(a, "continuity")
            - self._num(b, "avg_hgt")
            - self._num(b, "experience")
            - self._num(b, "continuity"),
            "bench_continuity_diff": self._num(a, "bench_minutes")
            + self._num(a, "continuity")
            - self._num(b, "bench_minutes")
            - self._num(b, "continuity"),
            "opponent_quality_resilience_diff": self._num(a, "schedule_adjusted_margin_pre")
            + 0.35 * self._num(a, "avg_opp_adjem_pre")
            - self._num(b, "schedule_adjusted_margin_pre")
            - 0.35 * self._num(b, "avg_opp_adjem_pre"),
        }

    def _build_feature_row(self, team_a: str, team_b: str, neutral_site: bool) -> pd.DataFrame:
        a = self._team_row(team_a)
        b = self._team_row(team_b)
        interaction_values = self._interaction_values(a, b)
        row: dict[str, Any] = {
            "neutral_site": int(neutral_site),
            "is_home": 0 if neutral_site else 1,
            "is_away": 0,
        }
        for col in self.feature_columns:
            if col in {"neutral_site", "is_home", "is_away"}:
                continue
            if col.endswith("_diff"):
                base = col.removesuffix("_diff")
                opp_base = f"opp_{base}"
                if base in a and base in b:
                    row[col] = pd.to_numeric(a[base], errors="coerce") - pd.to_numeric(b[base], errors="coerce")
                elif opp_base in a and opp_base in b:
                    row[col] = pd.to_numeric(a[opp_base], errors="coerce") - pd.to_numeric(b[opp_base], errors="coerce")
                else:
                    row[col] = 0.0
            elif col in interaction_values:
                row[col] = interaction_values[col]
            elif col.startswith("opp_"):
                base = col.removeprefix("opp_")
                row[col] = pd.to_numeric(b.get(base), errors="coerce")
            else:
                row[col] = pd.to_numeric(a.get(col), errors="coerce")
        return pd.DataFrame([row], columns=self.feature_columns)

    def _reason_values(
        self,
        feature_row: pd.DataFrame,
        mirrored_feature_row: pd.DataFrame | None = None,
    ) -> dict[str, float]:
        values = feature_row.iloc[0].to_dict()
        if mirrored_feature_row is None:
            return {key: float(value) for key, value in values.items() if not pd.isna(value)}

        mirrored_values = mirrored_feature_row.iloc[0].to_dict()
        combined: dict[str, float] = {}
        for key, value in values.items():
            if pd.isna(value):
                continue
            if key in {"neutral_site", "is_home", "is_away"}:
                combined[key] = float(value)
            elif key == "tempo_clash_abs":
                mirror_value = mirrored_values.get(key)
                combined[key] = (
                    float(value + float(mirror_value)) / 2
                    if mirror_value is not None and not pd.isna(mirror_value)
                    else float(value)
                )
            elif key.endswith("_diff") or key in INTERACTION_FEATURES:
                mirror_value = mirrored_values.get(key)
                combined[key] = float((float(value) - float(mirror_value)) / 2) if not pd.isna(mirror_value) else float(value)
            else:
                combined[key] = float(value)
        return combined

    def _reasons(
        self,
        feature_row: pd.DataFrame,
        team_a: str,
        team_b: str,
        mirrored_feature_row: pd.DataFrame | None = None,
    ) -> list[str]:
        values = self._reason_values(feature_row, mirrored_feature_row)
        scored: list[tuple[str, float]] = []
        for key in REASON_TEMPLATES:
            if key not in values or pd.isna(values[key]):
                continue
            scored.append((key, abs(float(values[key]))))
        top_keys = [key for key, _ in sorted(scored, key=lambda item: item[1], reverse=True)[:3]]
        reasons: list[str] = []
        for key in top_keys:
            winner = team_a if float(values[key]) >= 0 else team_b
            reasons.append(REASON_TEMPLATES[key].format(team=winner))
        return reasons

    def _predict_raw(self, feature_row: pd.DataFrame) -> tuple[float, float]:
        probability = float(self.classifier.predict_proba(feature_row)[0, 1])
        margin = float(self.margin_regressor.predict(feature_row)[0])
        return probability, margin

    def predict(self, team_a: str, team_b: str, neutral_site: bool = True) -> PredictionResult:
        feature_row = self._build_feature_row(team_a, team_b, neutral_site)
        mirrored_feature_row = None
        if neutral_site:
            mirrored_feature_row = self._build_feature_row(team_b, team_a, neutral_site=True)
            p_ab, margin_ab = self._predict_raw(feature_row)
            p_ba, margin_ba = self._predict_raw(mirrored_feature_row)
            team_a_proba = (p_ab + (1 - p_ba)) / 2
            margin = (margin_ab - margin_ba) / 2
        else:
            team_a_proba, margin = self._predict_raw(feature_row)
        predicted_winner = team_a if team_a_proba >= 0.5 else team_b
        return PredictionResult(
            team_a=team_a,
            team_b=team_b,
            predicted_winner=predicted_winner,
            win_probability_team_a=team_a_proba,
            win_probability_team_b=1 - team_a_proba,
            predicted_margin=margin,
            top_reasons=self._reasons(feature_row, team_a, team_b, mirrored_feature_row),
            feature_snapshot={
                key: round(float(value), 4)
                for key, value in self._reason_values(feature_row, mirrored_feature_row).items()
                if not pd.isna(value)
            },
        )
