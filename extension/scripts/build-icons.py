#!/usr/bin/env python3
"""Generate Pulse Chat extension icons (16/32/48/128) as PNG files.

This script uses the standard library only and writes minimal PNG files that
encode a rounded purple-to-cyan gradient square containing a white chat
bubble. Run with: `python3 scripts/build-icons.py`.
"""

import math
import os
import struct
import zlib


def lerp(a, b, t):
    return a + (b - a) * t


def gradient(x, y, size):
    """Diagonal gradient from #7c3aed (124,58,237) -> #22d3ee (34,211,238)."""
    t = (x + y) / (2 * size)
    r = int(round(lerp(124, 34, t)))
    g = int(round(lerp(58, 211, t)))
    b = int(round(lerp(237, 238, t)))
    return (r, g, b)


def in_rounded_square(x, y, size, radius):
    if x >= radius and x <= size - 1 - radius:
        return True
    if y >= radius and y <= size - 1 - radius:
        return True
    cx = radius if x < radius else size - 1 - radius
    cy = radius if y < radius else size - 1 - radius
    dx = x - cx
    dy = y - cy
    return dx * dx + dy * dy <= radius * radius


def in_chat_bubble(x, y, size):
    """White rounded chat bubble centered in icon, with a small tail."""
    cx = size / 2.0
    cy = size / 2.0 - size * 0.04
    bw = size * 0.58
    bh = size * 0.46
    rx = bw / 2.0
    ry = bh / 2.0
    nx = (x - cx) / rx
    ny = (y - cy) / ry
    if nx * nx + ny * ny <= 1.0:
        return True
    # Tail (triangle in lower-left of bubble)
    tx = cx - rx * 0.55
    ty = cy + ry * 0.55
    tail_size = size * 0.13
    if (
        x >= tx - tail_size
        and x <= tx + tail_size
        and y >= ty
        and y <= ty + tail_size
        and (y - ty) >= (tx - x)
    ):
        return True
    return False


def in_dots(x, y, size):
    cx = size / 2.0
    cy = size / 2.0 - size * 0.04
    radius = max(1, int(size * 0.04))
    spacing = size * 0.13
    for dx in (-spacing, 0, spacing):
        if (x - (cx + dx)) ** 2 + (y - cy) ** 2 <= radius * radius:
            return True
    return False


def build_image(size):
    pixels = bytearray()
    radius = max(2, int(size * 0.22))
    for y in range(size):
        row = bytearray()
        row.append(0)  # PNG filter byte (None)
        for x in range(size):
            if not in_rounded_square(x, y, size, radius):
                row.extend([0, 0, 0, 0])
                continue
            if in_dots(x, y, size):
                # Bubble interior dots: gradient color
                r, g, b = gradient(x, y, size)
                row.extend([r, g, b, 255])
                continue
            if in_chat_bubble(x, y, size):
                row.extend([255, 255, 255, 255])
                continue
            r, g, b = gradient(x, y, size)
            row.extend([r, g, b, 255])
        pixels.extend(row)
    return bytes(pixels)


def write_png(path, size):
    raw = build_image(size)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    out = bytearray()
    out += b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    out += chunk(b"IHDR", ihdr)
    out += chunk(b"IDAT", zlib.compress(raw, 9))
    out += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(out)


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "icons")
    os.makedirs(out_dir, exist_ok=True)
    for size in (16, 32, 48, 128):
        path = os.path.join(out_dir, f"icon-{size}.png")
        write_png(path, size)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
