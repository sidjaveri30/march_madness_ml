from __future__ import annotations

import unittest

from src.services.live_bracket_service import EspnLiveGameProvider


class _MockResponse:
    def raise_for_status(self) -> None:
        return None

    def json(self):
        return {
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
                                    "team": {"shortDisplayName": "Colorado"},
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
                                    "seed": "13",
                                    "team": {"shortDisplayName": "Vermont"},
                                },
                            ],
                        }
                    ],
                },
            ]
        }


class _MockSession:
    def get(self, *args, **kwargs):
        return _MockResponse()


class LiveBracketServiceTests(unittest.TestCase):
    def test_espn_provider_normalizes_live_and_final_games(self):
        provider = EspnLiveGameProvider(session=_MockSession())
        games = provider.fetch_games()

        self.assertEqual(len(games), 2)
        self.assertEqual(games[0].status, "live")
        self.assertEqual(games[0].detail, "2H 5:12")
        self.assertEqual(games[0].teamAKey, "florida")
        self.assertEqual(games[0].scoreA, 68)
        self.assertEqual(games[1].status, "final")
        self.assertEqual(games[1].winner, "Duke")
        self.assertEqual(games[1].winnerKey, "duke")


if __name__ == "__main__":
    unittest.main()
