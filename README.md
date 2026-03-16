# March Madness ML

Local full-stack NCAA men's basketball matchup predictor built with Python, FastAPI, React, scikit-learn, public current-season data, and KenPom data via `kenpompy`.

## Overview

This project predicts the outcome of a matchup between any two NCAA men's basketball teams and returns:

- predicted winner
- win probability for both teams
- optional predicted margin
- short explanation grounded in matchup features

The frontend now also includes a bracket-builder workspace:

- interactive First Four through championship bracket
- manual pick-and-advance behavior
- matchup details modal with model-backed probabilities and reasoning
- local save / restore
- JSON export / import

The app is designed as a practical MVP:

- public game results come from Sports Reference
- team-level advanced metrics come from KenPom using `kenpompy`
- both sources are cached locally to reduce repeated scraping
- the backend trains reproducible scikit-learn models and serves predictions through FastAPI
- a simple React frontend lets you choose teams and view the result
- the frontend team inputs support typed autocomplete, live filtering, and typo-friendly suggestions

## Architecture

High-level flow:

1. `src/data_sources/kenpom_client.py`
   Logs into KenPom with `kenpompy.utils.login`, detects the current season, fetches required tables, and caches them locally.
2. `src/data_sources/sports_reference_client.py`
   Fetches Sports Reference school metadata and current-season team schedules/results with retry and cache behavior.
3. `src/utils/team_names.py`
   Central team-name normalization layer used across ingestion, training, and prediction.
4. `src/features/engineering.py`
   Builds a KenPom-first matchup dataset with schedule-adjusted support features, explicit offense-vs-defense interaction terms, and a reduced dependence on raw record.
5. `src/models/training.py`
   Trains a logistic regression baseline and a stronger `HistGradientBoostingClassifier`, evaluates them, and persists the best classifier plus a margin regressor.
6. `src/api/app.py`
   Exposes `/health`, `/teams`, `/predict`, `/refresh-data`, and `/train`.
7. `frontend/`
   React + Vite app with both matchup insight and a polished bracket-builder workspace.

## Data Sources

### Public data

The public ingestion layer uses Sports Reference for current-season schedules and game results. The pipeline:

- fetches the school index
- maps teams to Sports Reference school slugs
- downloads each team's current-season schedule/results page
- caches raw schedule tables locally

This gives us:

- wins/losses
- points for and against
- recent form
- scoring margin
- home/away/neutral indicators

### KenPom data

KenPom is included as a first-class source, not an optional extra. The project intentionally uses these `kenpompy` entry points:

- `kenpompy.utils.login(email, password)`
- `kenpompy.misc.get_current_season(browser)`
- `kenpompy.misc.get_pomeroy_ratings(browser, season=...)`
- `kenpompy.summary.get_efficiency(browser, season=...)`
- `kenpompy.summary.get_fourfactors(browser, season=...)`
- `kenpompy.summary.get_height(browser, season=...)`
- `kenpompy.summary.get_teamstats(browser, defense=False, season=...)`
- `kenpompy.summary.get_teamstats(browser, defense=True, season=...)`
- `kenpompy.summary.get_pointdist(browser, season=...)`
- `kenpompy.team.get_valid_teams(browser, season=...)`
- `kenpompy.team.get_schedule(browser, team=..., season=...)`

Fetched KenPom tables are stored under `data/cache/kenpom/` and merged into a single team-metrics table before feature engineering.

## Repo Layout

```text
march_madness_ml/
├── data/
├── frontend/
├── notebooks/
├── scripts/
├── src/
│   ├── api/
│   ├── config/
│   ├── data_sources/
│   ├── features/
│   ├── ingestion/
│   ├── models/
│   └── utils/
├── .env.example
├── README.md
└── requirements.txt
```

## Setup

### 1. Create a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Add KenPom credentials

Create `.env` in the project root:

```bash
cp .env.example .env
```

Then set:

```env
KENPOM_EMAIL=your_email_here
KENPOM_PASSWORD=your_password_here
```

Do not commit real credentials.

### 4. Install frontend dependencies

```bash
cd frontend
npm install
cp .env.example .env
cd ..
```

## Running the Pipeline

### Refresh raw data

```bash
python scripts/refresh_data.py
```

This will:

- log into KenPom
- detect the current season
- fetch and cache KenPom tables
- fetch and cache Sports Reference schedule data
- write merged raw outputs into `data/raw/`

### Train models

```bash
python scripts/train_model.py
```

This will:

- build matchup training data into `data/processed/`
- train the baseline and stronger classifier
- train a margin regressor
- save model artifacts into `models_artifacts/`

## Running the App

### Start the backend

```bash
uvicorn src.api.app:app --reload
```

Backend endpoints:

- `GET /health`
- `GET /teams`
- `POST /predict`
- `POST /refresh-data`
- `POST /train`

Example prediction request:

```json
{
  "team_a": "Houston",
  "team_b": "Purdue",
  "neutral_site": true
}
```

### Start the frontend

```bash
cd frontend
npm run dev
```

Open the local Vite URL shown in the terminal, usually `http://127.0.0.1:5173`.

The frontend team selectors support:

- typing instead of scrolling
- live filtered suggestions
- keyboard navigation with arrow keys and Enter
- fuzzy typo suggestions such as `Gonzgaa` -> `Gonzaga`

The bracket workspace supports:

- First Four, regional rounds, Final Four, and championship views
- clicking a team to advance it
- clearing invalid downstream picks automatically if an upstream winner changes
- opening a details modal for any matchup
- local browser save / restore plus JSON export / import

## Caching Behavior

Caching is built in so the app does not need to re-authenticate against KenPom every time after the initial fetch unless you explicitly refresh.

- KenPom tables are cached in `data/cache/kenpom/`
- Sports Reference tables are cached in `data/cache/sports_reference/`
- processed datasets are written to `data/processed/`
- training artifacts are written to `models_artifacts/`

By default, cache freshness is controlled by `DATA_TTL_HOURS` in `.env`.

## Feature Summary

The current MVP includes:

- location context: home, away, neutral
- schedule-adjusted public support features such as opponent quality, top-50/top-100 performance, and schedule-adjusted margin
- KenPom backbone features such as adjusted efficiency margin, offense, defense, tempo, luck, SOS, non-conference SOS, Four Factors-style metrics, shooting splits, height, experience, bench usage, and continuity
- explicit matchup interaction features such as shooting-vs-defense fit, three-point profile fit, turnover pressure, offensive rebounding edge, free-throw pressure, and style/tempo clashes

The model predicts from Team A's perspective, so positive differentials generally favor Team A.

Raw resume features like overall win percentage and simple scoring margin are intentionally de-emphasized. They are no longer the backbone of the model.

## Explanation Strategy

Predictions include short deterministic reasons derived from the largest matchup feature advantages, such as:

- stronger adjusted efficiency margin
- stronger schedule-adjusted team quality
- stronger adjusted offense or defense
- more favorable shooting, turnover, rebounding, or foul-drawing matchup fit

This keeps explanations grounded in actual feature values and avoids inventing unsupported narratives.

## Neutral-Site Prediction Behavior

Neutral-site predictions are treated as game-level predictions rather than order-dependent `Team A` vs `Team B` classifications.

- for `neutral_site=true`, the backend scores both `(A, B)` and `(B, A)`
- it then symmetrizes the probability and margin outputs so swapping team order mirrors the result instead of changing the game prediction
- in this mode, `neutral_site=1`, `is_home=0`, and `is_away=0`

This makes March Madness style matchup predictions consistent when the same neutral-court game is entered in either team order.

## Limitations and Tradeoffs

- Sports Reference page layouts can change. The scraper uses caching and basic fallback logic, but HTML scrapers are inherently somewhat fragile.
- Team-name normalization includes common aliases and can be extended in `src/utils/team_names.py`.
- The first MVP uses current-season KenPom snapshots for training, which is practical but not perfectly leakage-free for historical game-by-game modeling.
- The margin model is intentionally lightweight and should be treated as directional rather than exact.
- Calibration is not yet explicitly tuned beyond probabilistic model output.
- The frontend is intentionally simple and local-first.

## Reasonable Assumptions Made

- The user has a valid KenPom subscription and can supply credentials through `.env`.
- Local use is the primary goal, so the app favors transparent scripts and cached files over cloud deployment complexity.
- Public current-season data is sufficiently represented by team schedule/results pages for an MVP.

## Suggested Local Workflow

```bash
python scripts/refresh_data.py
python scripts/train_model.py
uvicorn src.api.app:app --reload
cd frontend && npm run dev
```

## Verification Notes

During build-out, the Python source tree was syntax-checked with:

```bash
python3 -m compileall src scripts
```

Full live ingestion and model training were not executed in this environment because they require installed dependencies, network access to data sources, and valid KenPom credentials.

Frontend verification also included:

```bash
cd frontend
npm run test
npm run build
```
