from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable


def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def canonicalize_name(value: str) -> str:
    value = _strip_accents(value).lower().strip()
    value = value.replace("&", "and")
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    tokens = [token for token in value.split() if token not in {"the", "university", "of"}]
    return " ".join(tokens)


TEAM_ALIASES: dict[str, str] = {
    "uconn": "connecticut",
    "unc": "north carolina",
    "ole miss": "mississippi",
    "lsu": "louisiana state",
    "smu": "southern methodist",
    "uc san diego": "california san diego",
    "byu": "brigham young",
    "vcu": "virginia commonwealth",
    "st mary s ca": "saint marys",
    "saint mary s": "saint marys",
    "st mary s": "saint marys",
    "st john s ny": "st johns",
    "saint john s": "st johns",
    "st john s": "st johns",
    "miami fl": "miami",
    "miami florida": "miami",
    "utah st": "utah state",
    "miss st": "mississippi state",
    "iowa st": "iowa state",
    "michigan st": "michigan state",
    "ohio st": "ohio state",
    "oklahoma st": "oklahoma state",
    "oregon st": "oregon state",
    "washington st": "washington state",
    "penn st": "penn state",
    "kansas st": "kansas state",
    "boise st": "boise state",
    "colorado st": "colorado state",
    "fresno st": "fresno state",
    "san diego st": "san diego state",
    "san jose st": "san jose state",
    "nc state": "north carolina state",
    "n c state": "north carolina state",
    "usc": "southern california",
    "tcu": "texas christian",
    "ul lafayette": "louisiana",
    "pitt": "pittsburgh",
    "va tech": "virginia tech",
    "uab": "alabama birmingham",
    "uab blazers": "alabama birmingham",
    "unlv": "nevada las vegas",
    "s florida": "south florida",
    "usf": "south florida",
    "umass": "massachusetts",
    "app state": "appalachian state",
    "sou miss": "southern miss",
    "texas a m": "texas am",
    "texas a&m": "texas am",
    "florida intl": "florida international",
    "florida international university": "florida international",
    "loyola chicago": "loyola il",
    "loyola (il)": "loyola il",
    "loyola md": "loyola maryland",
    "southern california": "usc",
}


@dataclass(frozen=True)
class TeamNameRecord:
    source_name: str
    canonical_name: str


class TeamNameNormalizer:
    def __init__(self) -> None:
        self._source_to_canonical: dict[str, str] = {}
        self._canonical_to_display: dict[str, str] = {}

    def register(self, source_name: str, canonical_name: str | None = None) -> None:
        base = canonical_name or self.normalize(source_name)
        key = canonicalize_name(source_name)
        self._source_to_canonical[key] = base
        self._canonical_to_display.setdefault(base, source_name)

    def bulk_register(self, values: Iterable[str]) -> None:
        for value in values:
            self.register(value)

    def register_alias(self, source_name: str, canonical_name: str) -> None:
        key = canonicalize_name(source_name)
        self._source_to_canonical[key] = canonical_name

    def normalize(self, value: str) -> str:
        canonical = canonicalize_name(value)
        return TEAM_ALIASES.get(canonical, canonical)

    def resolve(self, value: str) -> str:
        key = canonicalize_name(value)
        direct = self._source_to_canonical.get(key)
        if direct:
            return direct
        return self.normalize(value)

    def display_name(self, value: str) -> str:
        canonical = self.resolve(value)
        return self._canonical_to_display.get(canonical, value)


normalizer = TeamNameNormalizer()


def register_school_aliases(records: Iterable[dict[str, str]]) -> None:
    alias_columns = ["school_name", "short_name", "location_name", "team_name", "nickname", "abbreviation"]
    for record in records:
        canonical_source = (
            record.get("location_name")
            or record.get("short_name")
            or record.get("school_name")
            or record.get("team_normalized")
        )
        canonical = normalizer.normalize(str(canonical_source)) if canonical_source else None
        if not canonical:
            continue
        for column in alias_columns:
            value = record.get(column)
            if value:
                normalizer.register_alias(str(value), canonical)
        school_name = record.get("school_name")
        team_name = record.get("team_name")
        if school_name and team_name:
            normalizer.register_alias(f"{school_name} {team_name}", canonical)
