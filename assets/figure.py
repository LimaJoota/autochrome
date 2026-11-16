"""README figure: open in the background, read and act by ref, attach a file and stop before sending."""

import os
import sys
from pathlib import Path

# Needs the esquadro library: https://github.com/LimaJoota/esquadro
sys.path.insert(0, os.environ.get("ESQUADRO_SCRIPTS", str(Path(__file__).resolve().parents[2] / "esquadro/scripts")))
from esquadro import Drawing, hand_note, panels

OUT = Path(__file__).resolve().parent


def browser(d, x, y, w, h, tabs=3, active=0):
    """Browser window: frame, tab strip, address bar. Returns the top-left of the page area."""
    d.rect(x, y, w, h)
    tw = w / (tabs + 1)
    for i in range(tabs):
        d.rect(x + 1 + i * tw, y + 1, tw - 1, 3, fill="#000" if i == active else None)
    d.line((x, y + 5), (x + w, y + 5), "thin")
    d.rect(x + 2, y + 6, w - 4, 2.5)
    return x + 3, y + 11


def main():
    d = Drawing.figure("page", 94, lang="en", title="autochrome in three steps",
                       description="Open a tab without taking the person's tab, act on numbered elements, attach a file and stop before sending.")
    d.text((5, 9), "autochrome in three steps", "heading")
    f1, f2, f3 = panels(
        d, 3, area=(5.0, 14.0, 160.0, 74.0),
        titles=["1. Open in the background", "2. Read, click, type", "3. Attach, then stop"],
        verdicts=[True, True, None], colored=True, arrows=True, gap=10.0,
    )

    # 1: the new tab opens next to the person's tab; their tab stays in front.
    sx, sy = f1.x + 5, f1.y + 8
    browser(d, sx, sy, 38, 26, tabs=3, active=1)
    hand_note(d, (sx + 25, sy + 2.5), (f1.x + 2, f1.y + 46), "a new tab opens; the person's tab stays in front", 42, bend=0.2, ink="blue")

    # 2: elements get numbers; click and type go by number or CSS selector.
    px, py = browser(d, f2.x + 5, sy, 38, 26)
    for i, w in enumerate((20, 26, 14)):
        d.rect(px, py + i * 4.5, w, 3)
        d.text((px + w + 2, py + i * 4.5 + 2.4), str(i + 1), "label")
    hand_note(d, (px + 14, py + 10.5), (f2.x + 2, f2.y + 46), "read numbers what you can click or type into", 42, bend=-0.2)

    # 3: the file goes into the page's file input; sending is the person's call.
    px, py = browser(d, f3.x + 5, sy, 38, 26)
    d.polyline([(px + 8, py), (px + 16, py), (px + 19, py + 3), (px + 19, py + 12), (px + 8, py + 12)], closed=True)
    d.text((px + 10, py + 8), "PDF", "label")
    hand_note(d, (px + 19, py + 6), (f3.x + 2, f3.y + 46), "the file lands in the page; send only when the person asked", 42, bend=0.25, ink="red")
    return d.save(OUT / "autochrome.svg")


if __name__ == "__main__":
    print(main())
