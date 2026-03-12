# 2023 results and chart data

The app uses the **BTCC points system** when the JSON has no `points` value (or zero):

- **Positions 1–15:** 20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
- **Fastest lap (F/FL):** +1 point per race
- **Lead lap (L):** +1 point per race
- **Pole (P), Race 1 only:** +1 point

## Round order (chart order)

Rounds are shown in this order in the app (tracks across the top):

1. Donington Park (DPN)
2. Brands Hatch Indy (BHI)
3. Snetterton (SNE)
4. Thruxton (THR)
5. Oulton Park (OUL)
6. Croft (CRO)
7. Knockhill (KNO)
8. Donington Park GP (DPGP)
9. Silverstone (SIL)
10. Brands Hatch GP (BHGP)

The app reorders 2023 rounds from the JSON to match this order.

## Adding bonus points from the chart

In each race `results` entry you can add optional flags so the app computes the correct points (including +1 for FL, L, and R1 pole):

- `"fl": true` or `"fastestLap": true` — driver set fastest lap (F/FL in chart)
- `"l": true` or `"leadLap": true` — driver led at least one lap (L in chart)
- `"p": true` or `"pole": true` — pole for this race (P; only Race 1 counts for +1 pt)

Example for one driver in one race:

```json
{
  "pos": 2,
  "no": 116,
  "driver": "Ashley Sutton",
  "team": "NAPA Racing UK",
  "points": 0,
  "fl": true
}
```

That gives position points for 2nd (17) + 1 for fastest lap = 18 points for that race.

Populate these from the chart symbols (F/FL, L, P) next to each position to get totals that match the official standings (e.g. Sutton 446 pts).
