from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    kenpom_email: str = Field(default="", alias="KENPOM_EMAIL")
    kenpom_password: str = Field(default="", alias="KENPOM_PASSWORD")
    sports_reference_base_url: str = Field(
        default="https://www.sports-reference.com/cbb",
        alias="SPORTS_REFERENCE_BASE_URL",
    )
    data_ttl_hours: int = Field(default=24, alias="DATA_TTL_HOURS")
    model_dir: str = Field(default="models_artifacts", alias="MODEL_DIR")
    api_host: str = Field(default="127.0.0.1", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    frontend_api_url: str = Field(
        default="http://127.0.0.1:8000",
        alias="FRONTEND_API_URL",
    )
    odds_api_key: str = Field(default="", alias="ODDS_API_KEY")
    odds_region: str = Field(default="us", alias="ODDS_REGION")
    odds_bookmakers: str = Field(default="draftkings,fanduel", alias="ODDS_BOOKMAKERS")
    odds_markets: str = Field(default="h2h,spreads,totals", alias="ODDS_MARKETS")
    odds_cache_ttl_minutes: int = Field(default=20, alias="ODDS_CACHE_TTL_MINUTES")

    @property
    def raw_data_dir(self) -> Path:
        return ROOT_DIR / "data" / "raw"

    @property
    def processed_data_dir(self) -> Path:
        return ROOT_DIR / "data" / "processed"

    @property
    def cache_dir(self) -> Path:
        return ROOT_DIR / "data" / "cache"

    @property
    def external_data_dir(self) -> Path:
        return ROOT_DIR / "data" / "external"

    @property
    def model_path(self) -> Path:
        return ROOT_DIR / self.model_dir


settings = Settings()
