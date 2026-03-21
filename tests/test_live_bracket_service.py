from __future__ import annotations

import unittest
from unittest.mock import patch

from src.services.live_bracket_service import EspnLiveGameProvider
from src.utils.team_names import normalizer


class _MockResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self):
        return self._payload


class _MockSession:
    def __init__(self):
        self.calls = []

    def get(self, *args, **kwargs):
        self.calls.append(kwargs.get("params", {}))
        requested_date = (kwargs.get("params", {}) or {}).get("dates")
        if len(self.calls) == 1:
            return _MockResponse(
                {
                    "events": [
                        {
                            "id": "401",
                            "date": "2026-03-21T19:10:00Z",
                            "competitions": [
                                {
                                    "id": "401",
                                    "date": "2026-03-21T19:10:00Z",
                                    "status": {
                                        "type": {"state": "in"},
                                        "displayClock": "5:12",
                                        "period": 2,
                                    },
                                    "competitors": [
                                        {
                                            "homeAway": "home",
                                            "score": "68",
                                            "seed": "7",
                                            "team": {"shortDisplayName": "Florida"},
                                        },
                                        {
                                            "homeAway": "away",
                                            "score": "64",
                                            "seed": "10",
                                            "team": {"shortDisplayName": "Illinois"},
                                        },
                                    ],
                                }
                            ],
                        },
                        {
                            "id": "402",
                            "date": "2026-03-21T22:00:00Z",
                            "competitions": [
                                {
                                    "id": "402",
                                    "date": "2026-03-21T22:00:00Z",
                                    "status": {
                                        "type": {"state": "post"},
                                        "displayClock": "0:00",
                                        "period": 2,
                                    },
                                    "competitors": [
                                        {
                                            "homeAway": "home",
                                            "score": "79",
                                            "winner": True,
                                            "seed": "4",
                                            "team": {"shortDisplayName": "Duke"},
                                        },
                                        {
                                            "homeAway": "away",
                                            "score": "61",
                                            "winner": False,
                                            "seed": "4",
                                            "team": {"shortDisplayName": "Kansas"},
                                        },
                                    ],
                                }
                            ],
                        },
                        {
                            "id": "403",
                            "date": "2026-03-21T23:00:00Z",
                            "competitions": [
                                {
                                    "id": "403",
                                    "date": "2026-03-21T23:00:00Z",
                                    "status": {
                                        "type": {"state": "post"},
                                        "displayClock": "0:00",
                                        "period": 2,
                                    },
                                    "competitors": [
                                        {
                                            "homeAway": "home",
                                            "score": "81",
                                            "winner": True,
                                            "seed": "1",
                                            "team": {"shortDisplayName": "Dayton"},
                                        },
                                        {
                                            "homeAway": "away",
                                            "score": "70",
                                            "winner": False,
                                            "seed": "4",
                                            "team": {"shortDisplayName": "Boise St."},
                                        },
                                    ],
                                }
                            ],
                        },
                    ]
                }
            )
        return _MockResponse(
            {
                "events": [
                    {
                        "id": f"future-{requested_date}",
                        "date": "2026-03-22T22:00:00Z",
                        "competitions": [
                            {
                                "id": f"future-{requested_date}",
                                "date": "2026-03-22T22:00:00Z",
                                "status": {
                                    "type": {"state": "pre"},
                                    "displayClock": "",
                                    "period": 0,
                                },
                                "competitors": [
                                    {
                                        "homeAway": "home",
                                        "score": None,
                                        "seed": "5",
                                        "team": {"shortDisplayName": "Wisconsin"},
                                    },
                                    {
                                        "homeAway": "away",
                                        "score": None,
                                        "seed": "12",
                                        "team": {"shortDisplayName": "Akron"},
                                    },
                                ],
                            }
                        ],
                    }
                ]
            }
        )


class LiveBracketServiceTests(unittest.TestCase):
    def test_team_normalizer_accepts_north_dakota_state_shorthand(self):
        self.assertEqual(normalizer.resolve("N Dakota St"), normalizer.resolve("North Dakota St."))
        self.assertEqual(normalizer.resolve("NDSU"), normalizer.resolve("North Dakota St."))
        self.assertEqual(normalizer.resolve("Hawai'i"), normalizer.resolve("Hawaii"))
        self.assertEqual(normalizer.resolve("Texas A&M"), normalizer.resolve("texas aandm"))
        self.assertEqual(normalizer.resolve("Kansas Jayhawks"), normalizer.resolve("Kansas"))
        self.assertEqual(normalizer.resolve("Cal Baptist Lancers"), normalizer.resolve("Cal Baptist"))
        self.assertEqual(normalizer.resolve("Prairie View A&M Panthers"), normalizer.resolve("Prairie View A&M"))
        self.assertEqual(normalizer.resolve("Lehigh Mountain Hawks"), normalizer.resolve("Lehigh"))
        self.assertEqual(normalizer.resolve("Queens University of Charlotte Royals"), normalizer.resolve("Queens (N.C.)"))
        self.assertEqual(normalizer.resolve("Queens Royals"), normalizer.resolve("Queens (N.C.)"))

    def test_espn_provider_normalizes_live_and_final_games(self):
        session = _MockSession()
        with patch("src.services.live_bracket_service.settings.espn_schedule_timezone", "America/Chicago"), patch(
            "src.services.live_bracket_service.settings.espn_schedule_days_back",
            1,
        ), patch("src.services.live_bracket_service.settings.espn_schedule_days_ahead", 2):
            provider = EspnLiveGameProvider(session=session)
            games = provider.fetch_games()

        self.assertEqual(sum(1 for game in games if game.status == "live"), 1)
        self.assertEqual(sum(1 for game in games if game.status == "final"), 1)
        self.assertGreaterEqual(sum(1 for game in games if game.status == "upcoming"), 1)
        self.assertEqual(games[0].status, "live")
        self.assertEqual(games[0].detail, "2H 5:12")
        self.assertEqual(games[0].teamAKey, "florida")
        self.assertEqual(games[0].scoreA, 68)
        self.assertEqual(games[1].status, "final")
        self.assertEqual(games[1].winner, "Duke")
        self.assertEqual(games[1].winnerKey, "duke")
        self.assertEqual(games[2].status, "upcoming")
        self.assertEqual(games[2].teamA, "Wisconsin")
        self.assertGreaterEqual(len(session.calls), 3)
        self.assertTrue(all("dates" in call for call in session.calls))
        self.assertTrue(all({game.teamA, game.teamB} != {"Dayton", "Boise St."} for game in games))

    def test_espn_provider_accepts_location_and_nickname_team_fields(self):
        provider = EspnLiveGameProvider(session=_MockSession())
        event = {
            "id": "777",
            "date": "2026-03-21T21:00:00Z",
            "competitions": [
                {
                    "id": "777",
                    "date": "2026-03-21T21:00:00Z",
                    "status": {
                        "type": {"state": "post"},
                        "displayClock": "0:00",
                        "period": 2,
                    },
                    "competitors": [
                        {
                            "homeAway": "home",
                            "score": "84",
                            "winner": True,
                            "team": {
                                "displayName": "Kansas Jayhawks",
                                "location": "Kansas",
                                "name": "Jayhawks",
                            },
                        },
                        {
                            "homeAway": "away",
                            "score": "62",
                            "winner": False,
                            "team": {
                                "displayName": "California Baptist Lancers",
                                "location": "Cal Baptist",
                                "name": "Lancers",
                            },
                        },
                    ],
                }
            ],
        }

        game = provider._normalize_event(event)

        self.assertIsNotNone(game)
        self.assertEqual(game.teamA, "Kansas")
        self.assertEqual(game.teamB, "Cal Baptist")
        self.assertEqual(game.winner, "Kansas")
        self.assertEqual(game.status, "final")

    def test_espn_provider_accepts_queens_charlotte_variants(self):
        provider = EspnLiveGameProvider(session=_MockSession())
        event = {
            "id": "778",
            "date": "2026-03-21T21:00:00Z",
            "competitions": [
                {
                    "id": "778",
                    "date": "2026-03-21T21:00:00Z",
                    "status": {
                        "type": {"state": "post"},
                        "displayClock": "0:00",
                        "period": 2,
                    },
                    "competitors": [
                        {
                            "homeAway": "home",
                            "score": "91",
                            "winner": True,
                            "team": {
                                "displayName": "Purdue Boilermakers",
                                "location": "Purdue",
                                "name": "Boilermakers",
                            },
                        },
                        {
                            "homeAway": "away",
                            "score": "58",
                            "winner": False,
                            "team": {
                                "displayName": "Queens University of Charlotte Royals",
                                "location": "Queens University of Charlotte",
                                "name": "Royals",
                            },
                        },
                    ],
                }
            ],
        }

        game = provider._normalize_event(event)

        self.assertIsNotNone(game)
        self.assertEqual(game.teamA, "Purdue")
        self.assertEqual(game.teamB, "Queens (N.C.)")
        self.assertEqual(game.winner, "Purdue")
        self.assertEqual(game.status, "final")


if __name__ == "__main__":
    unittest.main()
