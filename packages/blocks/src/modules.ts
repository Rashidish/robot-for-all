// Small MicroPython modules our blocks need that MicroPython doesn't have. They are added to the
// micro:bit's file system next to main.py (on screen and in the .hex).

/** MakeCode-style game sprites on the 5 × 5 LEDs (MakeCode's "Game" category). */
export const GAME_PY = `# game.py - Robots For All: sprites on the micro:bit's 5 x 5 LEDs, like MakeCode's Game blocks.
from microbit import display, sleep

score = 0
_sprites = []
_STEPS = {0: (0, -1), 45: (1, -1), 90: (1, 0), 135: (1, 1), 180: (0, 1), 225: (-1, 1), 270: (-1, 0), 315: (-1, -1)}


def _clamp(v):
    return max(0, min(4, int(v)))


def _draw():
    display.clear()
    for s in _sprites:
        display.set_pixel(s.x, s.y, 9)


class Sprite:
    def __init__(self, x, y):
        self.x = _clamp(x)
        self.y = _clamp(y)
        self.direction = 90
        _sprites.append(self)
        _draw()

    def move(self, n):
        dx, dy = _STEPS[self.direction % 360]
        self.x = _clamp(self.x + dx * int(n))
        self.y = _clamp(self.y + dy * int(n))
        _draw()

    def turn(self, degrees):
        self.direction = int((self.direction + degrees) // 45 * 45) % 360

    def change(self, axis, n):
        if axis == "x":
            self.x = _clamp(self.x + n)
        else:
            self.y = _clamp(self.y + n)
        _draw()

    def set(self, axis, n):
        if axis == "x":
            self.x = _clamp(n)
        else:
            self.y = _clamp(n)
        _draw()

    def on_edge(self):
        return self.x in (0, 4) or self.y in (0, 4)

    def bounce(self):
        dx, dy = _STEPS[self.direction % 360]
        if (self.x == 0 and dx < 0) or (self.x == 4 and dx > 0):
            dx = -dx
        if (self.y == 0 and dy < 0) or (self.y == 4 and dy > 0):
            dy = -dy
        for d, step in _STEPS.items():
            if step == (dx, dy):
                self.direction = d

    def touching(self, other):
        return other is not self and self.x == other.x and self.y == other.y

    def delete(self):
        if self in _sprites:
            _sprites.remove(self)
        _draw()


def add_score(n):
    global score
    score += int(n)


def game_over():
    display.scroll("GAME OVER")
    display.scroll(str(score))
    while True:
        sleep(1000)
`;

export const MODULES: Record<string, string> = { game: GAME_PY };
