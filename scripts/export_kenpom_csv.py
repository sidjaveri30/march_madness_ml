from __future__ import annotations

import argparse
from pathlib import Path

from kenpompy import misc
from kenpompy.utils import login

from src.config.settings import settings
from src.utils.io import ensure_dir
from src.utils.logging import get_logger
from src.utils.team_names import normalizer

logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="One-off KenPom main table CSV export.")
    parser.add_argument("--season", type=int, default=2026, help="KenPom season to export. Defaults to 2026.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("tmp/kenpom_pomeroy_2026.csv"),
        help="CSV path to write. Defaults to tmp/kenpom_pomeroy_2026.csv.",
    )
    return parser.parse_args()


def clean_table(df):
    cleaned = df.copy()
    cleaned.columns = [str(col).strip().lower().replace(" ", "_") for col in cleaned.columns]
    team_col = next((col for col in cleaned.columns if col in {"team", "teams"}), None)
    if team_col:
        cleaned = cleaned.rename(columns={team_col: "team"})
        cleaned["team_normalized"] = cleaned["team"].map(normalizer.resolve)
    return cleaned


def main() -> None:
    args = parse_args()
    ensure_dir(args.output.parent)

    if not settings.kenpom_email or not settings.kenpom_password:
        raise ValueError("Missing KENPOM_EMAIL or KENPOM_PASSWORD in your environment/.env")

    browser = login(settings.kenpom_email, settings.kenpom_password)
    pomeroy = clean_table(misc.get_pomeroy_ratings(browser, season=args.season))
    pomeroy["season"] = args.season
    pomeroy.to_csv(args.output, index=False)
    logger.info("Wrote %s rows to %s", len(pomeroy), args.output)
    print(f"Exported KenPom main table for season {args.season} to {args.output}")


if __name__ == "__main__":
    main()
