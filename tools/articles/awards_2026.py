#!/usr/bin/env python3
"""
BTCC Hub Awards 2026 - the awards digest article (hub_news.json id
"digest-2026-awards").

HOW TO EDIT
  1. Change any text inside the quotes below. Each H.append(...) line is one
     block of the article, top to bottom.
       media(image, alt, LABEL, NAME, BADGE, TEXT)  -> photo beside text tile
       card(LABEL, NAME, BADGE, TEXT)               -> highlighted panel
       stats((NUMBER, caption), ...)                -> row of yellow stat tiles
       '<p>...</p>'                                 -> a normal paragraph
  2. Run:  python3 tools/articles/awards_2026.py
     It rewrites only this article's content in data/hub_news.json. Its
     status (draft/published), preview devices and other fields are untouched.
  3. Commit and push data/hub_news.json. The app picks it up within ~5 min.

Do NOT edit this article in the admin panel: its Quill editor strips the
layout classes and the <style> block and would flatten the page.
Style rules: no em dashes, no comma before or after "and"/"or".
"""
import json
from pathlib import Path

HUB_NEWS = Path(__file__).resolve().parent.parent.parent / "data" / "hub_news.json"
POST_ID = "digest-2026-awards"

B='https://raw.githubusercontent.com/yacobwood/BTCC/main/data/hub_images/2026-awards/'
def img(f,alt): return f'<img src="{B}{f}" alt="{alt}">'
def media(f,alt,kicker,name,pill,text,right=False):
    return (f'<div class="media{" right" if right else ""}">{img(f,alt)}<div>'
            f'<p class="kicker">{kicker}</p><p><strong>{name}</strong> <span class="pill">{pill}</span></p><p>{text}</p></div></div>')
def card(kicker,name,pill,text):
    return f'<div class="card"><p class="kicker">{kicker}</p><p><strong>{name}</strong> <span class="pill">{pill}</span></p><p>{text}</p></div>'
def stats(*items): return '<div class="stats">'+''.join(f'<div class="stat"><b>{n}</b> {c}</div>' for n,c in items)+'</div>'
H=[]
H.append('<style>body{background:linear-gradient(180deg,#0B0C0F 0%,#101538 30%,#0B0C0F 100%);}</style>')
H.append('<p>Ten race weekends. One record-breaking champion. Before the cars go into hibernation for the winter we went through every number the app collected this season. That means results and grids, lap charts and sector times, speed traps and the small print at the bottom of every classification. Some of these awards you would expect. Some of them you really would not.</p>')
H.append('<p class="kicker">Part one</p><h2>The Big Silverware</h2>')
H.append(img('card-champion-final.jpg','Champion: Ash Sutton, 516 points'))
H.append('<p>516 points and a fifth title. No driver in BTCC history has done that before. Sutton sealed it at Silverstone with a whole round to spare and never looked like being caught.</p>')
H.append(img('card-independent-final.jpg','Independent of the Year: Mikey Doble, 421 points'))
H.append("<p>421 points in the Independents' Trophy with Aiden Moffat chasing on 382. A Power Maxed one-two at the top of the privateer pile.</p>")
H.append(img('card-jst-final.jpg','Jack Sears Trophy: Dexter Patterson, 519 points'))
H.append('<p>519 points with Lewis Selby the closest challenger on 376.</p>')
H.append(media('car-sutton.webp','NAPA Racing UK Ford Focus','Team of the Year','NAPA Racing UK','766 pts',"Comfortably clear of Team VERTU on 540."))
H.append(media('car-doble.webp','Power Maxed Audi A3','Independent Team','LKQ Euro Car Parts with Power Maxed Racing','515 pts','Ahead of WSR on 469.',right=True))
H.append(media('car-cammish.webp','Ford Focus','Manufacturer of the Year','Ford','910 pts','Mercedes pipped Hyundai to second by 12 points.'))
H.append('<p class="kicker">Part two</p><h2>The Sutton Clause</h2>')
H.append('<p>We had to make a rule. Without it this would just be a list of one name. Sutton topped almost every stat we could think of so here they all are in one place.</p>')
H.append(stats(('9','wins'),('21','podiums'),('12','fastest laps')))
H.append(stats(('164','laps led'),('P4.08','avg finish'),('+133','places gained')))
H.append(stats(('+51','lap-1 places'),('P2.0','in the wet'),('128','Race 3 points')))
H.append('<p>That is Race Winner of the Year (nine wins at eight different circuits), Podium King, Fastest Lap King, Front-runner, Mr Consistent and Overtaker of the Year. Tom Ingram was second in all six. Add Launch Control (51 places gained on opening laps), Rain Master (an average finish of P2.0 across five wet or damp races), Reverse Grid King (128 points from the Race 3s) and Metronome (the most consistent lap times on the grid) and the clause rather justifies itself.</p>')
H.append(media('d-sutton.webp','Ash Sutton','Most Dominant Win','Ash Sutton','19.333s','Oulton Park Race 2. Nineteen seconds clear of the next car. In a BTCC race.'))
H.append('<p class="kicker">Part three</p><h2>Everyone Else Gets a Trophy Too</h2>')
H.append(media('d-cook.webp','Josh Cook','Saturday Specialist','Josh Cook','P6.1 average','Ingram, Morgan and Cook all took two poles. Cook gets it on the tiebreak because nobody qualified better across the season. His average qualifying position was P6.1, the best on the grid.'))
H.append(media('d-collard.webp','Ricky Collard','Knocking on the Door','Ricky Collard','8 podiums',"Three seconds and five thirds without a single win. He even took the chequered flag first in the final race of the season, only for a five-second penalty for a safety car restart breach to drop him to eighth. A first win feels very close.",right=True))
H.append(media('d-ingram.webp','Tom Ingram','Sector King','Tom Ingram','22 sectors','Quickest of anyone through 22 individual sectors in races this year. Even Sutton only managed 21.'))
H.append(media('d-chilton.webp','Tom Chilton','Perfect Lap','Tom Chilton','0.111s','In a typical race his best lap was only 0.111 seconds off his ideal lap built from his best three sectors. No one strung a lap together better in his final season.',right=True))
H.append(media('pair-topspeed.webp','Sam Osborne and Tom Chilton','Top Speed','Osborne and Chilton','148.4 mph','Osborne at Snetterton and Chilton at Brands Hatch on the very last day. Two drivers who retired this weekend share the fastest reading of the season.'))
H.append(media('pair-teammates-pmr.webp','Aiden Moffat and Mikey Doble','Closest Team-mates','Moffat and Doble','14-14','A perfect split. Each finished ahead of the other 14 times in races they both finished. WSR pair Daryl De Leon and Charles Rainford ended level at 14-14 too.',right=True))
H.append(media('pair-ironman.webp','Mikey Doble and Ash Sutton','Iron Man','Doble and Sutton','22 in a row','22 straight points finishes each. Dead heat. They share it.'))
H.append(media('pair-charge.webp','Tom Ingram and Ash Sutton','Charge of the Year','Ingram and Sutton','21st to 2nd','Both did it at Donington Park on the same day. Sutton in Race 1 and Ingram in Race 3.',right=True))
H.append(media('d-taylorsmith.webp','Árón Taylor-Smith','Win from Furthest Back','Árón Taylor-Smith','from 13th','Won Brands Hatch Indy Race 2 from 13th on the grid. The deepest grid slot anyone won from all year.'))
H.append(media('d-robottom.webp','Daniel Rowbottom','Closest Finish','Daniel Rowbottom','0.024s','Beat Tom Ingram to the line in the Donington Park Qualifying Race. The first race of the season and still the tightest.',right=True))
H.append(media('d-doble.webp','Mikey Doble','Most Improved','Mikey Doble','18th to 6th','Twelve places up on 2025 and six trophies on this page.'))
H.append(media('car-ingram.webp','Tom Ingram Hyundai i30N','Hard Luck Award','Tom Ingram','7 DNFs','Seven retirements and still runner-up in the championship. Imagine the season without them.',right=True))
H.append(card('Ever Present','Doble, Cammish and De Leon','30 from 30','Started all 30 races and finished every one of them.'))
H.append(card('Mileage Award','Mikey Doble','687 laps','More racing laps than anyone. Cammish was just three behind.'))
H.append('<p class="kicker">Part four</p><h2>The Track Limits Files</h2>')
H.append(card('Track Limits Offender','Daniel Rowbottom','4 penalties',"Four of the season's 35 track limits time penalties in races. No one picked up more."))
H.append(card('Lap Times Deleted','Ash Sutton','18 laps','Yes the champion tops this one too. Across the season 236 qualifying laps were wiped for exceeding track limits.'))
H.append(card('Circuit of Shame','Croft','18 penalties','18 track limits penalties in a single weekend. One more than every other round put together.'))
H.append('<h2>The Number That Sums It Up</h2>')
H.append(stats(('11','different winners'),('9','for one of them')))
H.append('<p>A deep field that could produce a winner from almost anywhere and a champion who was simply on another level. Roll on 2027.</p>')


def main():
    raw = HUB_NEWS.read_text()
    data = json.loads(raw)
    post = next(p for p in data["posts"] if p["id"] == POST_ID)
    content = "".join(H)
    if post["content"] == content:
        print("No changes.")
        return
    post["content"] = content
    HUB_NEWS.write_text(json.dumps(data, indent=2, ensure_ascii=False) + ("\n" if raw.endswith("\n") else ""))
    print(f"Updated {POST_ID} (status: {post.get('status', 'published')}).")


if __name__ == "__main__":
    main()
