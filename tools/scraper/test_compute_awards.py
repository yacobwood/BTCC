"""
Tests for compute_awards.py - the season awards generator.

Run with:
    python -m pytest tools/scraper/test_compute_awards.py -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import compute_awards as ca


def res(pos, driver, *, team="Team A", points=0, best="1:00.000", gap="", laps=10):
    return {"pos": pos, "driver": driver, "team": team, "car": "Car", "laps": laps,
            "bestLap": best, "gap": gap, "points": points}


def session(label, results, grid=None, **extra):
    s = {"label": label, "results": results}
    if grid:
        s["grid"] = [{"pos": i + 1, "driver": d} for i, d in enumerate(grid)]
    s.update(extra)
    return s


def season(*race_lists, venue="Track"):
    return {"rounds": [{"round": i + 1, "venue": venue, "races": races} for i, races in enumerate(race_lists)]}


def by_id(awards):
    return {a["id"]: a for a in awards}


class TestDnfHandling(unittest.TestCase):
    def test_dnf_is_not_a_podium_or_a_climb(self):
        # pos 0 = DNF. An early scan counted it as a podium (0 <= 3) and as a
        # 20-place climb from P20.
        data = season([session("Race 1",
                               [res(1, "Ann A", points=20), res(2, "Bob B", points=17), res(0, "Cal C", laps=1)],
                               grid=["Ann A", "Bob B", "Cal C"])])
        a = by_id(ca.stat_awards(data))
        self.assertEqual(a["podiums"]["stat"], "1 podium")
        self.assertNotIn("Cal", a["charge"]["winner"])
        self.assertEqual(a["hardLuck"]["winner"], "Cal C")

    def test_retired_car_does_not_get_fastest_lap(self):
        # Official results give it to a classified finisher (Croft R3 2026:
        # Chilton credited although Sutton, who retired, was quicker).
        data = season([session("Race 1",
                               [res(1, "Ann A", best="1:01.000"), res(0, "Cal C", best="59.500", laps=3)])])
        a = by_id(ca.stat_awards(data))
        self.assertEqual(a["fastestLaps"]["winner"], "Ann A")

    def test_official_fastest_lap_flag_wins_over_computed(self):
        r1 = res(1, "Ann A", best="59.000")
        r2 = res(2, "Bob B", best="59.500"); r2["fastestLap"] = True
        a = by_id(ca.stat_awards(season([session("Race 1", [r1, r2])])))
        self.assertEqual(a["fastestLaps"]["winner"], "Bob B")


class TestOfficialWins(unittest.TestCase):
    def test_qualifying_race_wins_and_podiums_do_not_count(self):
        # standings.json counts wins/podiums from Races 1-3 only.
        data = season([
            session("Qualifying Race", [res(1, "Ann A"), res(2, "Bob B")]),
            session("Race 1", [res(1, "Bob B"), res(2, "Ann A")]),
        ])
        a = by_id(ca.stat_awards(data))
        self.assertEqual(a["wins"]["winner"], "Bob B")
        self.assertEqual(a["wins"]["stat"], "1 win")
        self.assertEqual(a["podiums"]["stat"], "1 podium")


class TestTieBreaks(unittest.TestCase):
    def test_poles_split_on_average_qualifying(self):
        data = season(
            [session("Qualifying", [res(1, "Ann A"), res(5, "Bob B")])],
            [session("Qualifying", [res(1, "Bob B"), res(2, "Ann A")])],
        )
        a = by_id(ca.stat_awards(data))
        self.assertEqual(a["poles"]["winner"], "Ann A")  # avg 1.5 vs 3.0

    def test_closest_and_biggest_margin(self):
        data = season([
            session("Race 1", [res(1, "Ann A"), res(2, "Bob B", gap="0.050")]),
            session("Race 2", [res(1, "Bob B"), res(2, "Ann A", gap="9.000")]),
            session("Race 3", [res(1, "Cal C"), res(2, "Ann A", gap="1 Lap")]),
        ])
        a = by_id(ca.stat_awards(data))
        self.assertEqual(a["closestFinish"]["winner"], "Ann A")
        self.assertEqual(a["dominantWin"]["winner"], "Bob B")


class TestTeamsAndNames(unittest.TestCase):
    def test_cprl_old_name_folded_in(self):
        data = season([session("Race 1", [res(1, "Ann A", team="Cataclean Plato Racing", points=20)])])
        self.assertEqual(by_id(ca.stat_awards(data))["wins"]["team"], "CPRL")

    def test_penalty_names_matched_across_formats(self):
        data = season([session("Race 1", [res(1, "Daryl DE LEON")])])
        pens = {"rounds": [{"penalties": [{"driver": "Daryl DeLeon"}, {"driver": "Daryl DeLeon"}]}]}
        a = by_id(ca.stat_awards(data, penalties=pens))
        self.assertEqual(a["naughtyStep"]["winner"], "Daryl De Leon")
        self.assertEqual(a["naughtyStep"]["stat"], "2 penalties")

    def test_most_improved_uses_previous_season(self):
        prev = season([session("Race 1", [res(1, "Ann A", points=20), res(2, "Bob B", points=17)])])
        cur = season([session("Race 1", [res(1, "Bob B", points=20), res(2, "Ann A", points=17)])])
        a = by_id(ca.stat_awards(cur, prev_results=prev))
        self.assertEqual(a["improved"]["winner"], "Bob B")
        self.assertEqual(a["improved"]["stat"], "P2 to P1")


class TestExtraAwards(unittest.TestCase):
    def test_knocking_on_the_door_excludes_winners(self):
        data = season([
            session("Race 1", [res(1, "Ann A"), res(2, "Bob B"), res(3, "Cal C")]),
            session("Race 2", [res(1, "Ann A"), res(2, "Bob B"), res(3, "Cal C")]),
        ])
        a = by_id(ca.extra_awards(data))
        # Ann has wins so is excluded; Bob and Cal tie on 2 podiums and 0 points,
        # so the name tiebreak decides.
        self.assertEqual(a["knockingOnTheDoor"]["winner"], "Bob B")

    def test_reverse_grid_counts_race_3_only(self):
        data = season([session("Race 1", [res(1, "Ann A", points=20)]),
                       session("Race 3", [res(1, "Bob B", points=20)])])
        self.assertEqual(by_id(ca.extra_awards(data))["reverseGrid"]["winner"], "Bob B")

    def test_closest_teammates_only_counts_races_both_finished(self):
        races = []
        for i in range(16):
            first = "Ann A" if i % 2 else "Bob B"
            second = "Bob B" if i % 2 else "Ann A"
            races.append(session("Race 1", [res(1, first, team="T"), res(2, second, team="T")]))
        races.append(session("Race 2", [res(1, "Ann A", team="T"), res(0, "Bob B", team="T", laps=1)]))
        a = by_id(ca.extra_awards(season(races)))
        self.assertEqual(a["closestTeammates"]["stat"], "8-8")

    def test_launch_control_uses_lap_one_order_vs_grid(self):
        sess = session("Race 1", [res(1, "Ann A"), res(2, "Bob B")], grid=["Ann A", "Bob B"])
        sess["results"][0]["no"] = 1; sess["results"][1]["no"] = 2
        an = {(1, "Race 1"): {"laps": [{"no": 1, "laps": [{"t": 61.0}]}, {"no": 2, "laps": [{"t": 60.0}]}]}}
        a = by_id(ca.extra_awards(season([sess]), an))
        self.assertEqual(a["launch"]["winner"], "Bob B")
        self.assertEqual(a["launch"]["stat"], "+1 places")


class TestPerfectLap(unittest.TestCase):
    def test_one_disrupted_race_does_not_swamp_the_season(self):
        races = []
        for i in range(5):
            races.append(session("Race 1", [res(1, "Ann A"), res(2, "Bob B")],
                                 bestSectors=[{"driver": "Ann A", "diff": 0.10 if i else 16.7},
                                              {"driver": "Bob B", "diff": 0.15}]))
        a = by_id(ca.stat_awards(season(races)))
        self.assertEqual(a["perfectLap"]["winner"], "Ann A")


class TestBuild(unittest.TestCase):
    def test_season_complete_needs_final_race_3(self):
        done = season([session("Race 3", [res(1, "Ann A")])])
        pending = season([session("Race 3", [])])
        self.assertTrue(ca.season_complete(done))
        self.assertFalse(ca.season_complete(pending))

    def test_standings_season_mismatch_refused(self):
        with self.assertRaises(ValueError):
            ca.build_awards(2026, season(), {"season": "2025"})

    def test_championship_awards_keep_team_names_verbatim(self):
        st = {"season": "2026", "standings": [{"driver": "Ann A", "points": 400, "team": "X"}],
              "teams": [{"team": "NAPA Racing UK", "points": 700}, {"team": "WSR", "points": 400}]}
        a = by_id(ca.build_awards(2026, season(), st)["awards"])
        self.assertEqual(a["team"]["winner"], "NAPA Racing UK")
        self.assertEqual(a["champion"]["winner"], "Ann A")
        self.assertFalse(ca.build_awards(2026, season(), st)["published"])


if __name__ == "__main__":
    unittest.main()
