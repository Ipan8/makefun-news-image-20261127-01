// news-image-20261127 — deterministic dense-grid news renderer.
//
// Renders ONE 1024x1024 PNG summing up Friday 27 November 2026 world news
// as a dense newspaper page: masthead + date, two main panels (Kuwait drone
// strike, Trump tariffs), 12 numbered story cards, an 18-item ALSO ON list,
// a numbers sidebar, a world map with pins, an as-reported timeline, a DATE
// CHECK footer and a HOW SURE legend. 32 dated stories, 9 regions.
//
// Facts verified against NEWS-27NOV.md (research cutoff Fri 27 Nov 2026
// 07:30 WIB). Honesty rules baked in:
// - Kuwait: strike REPORTED by NYT/BBC/Reuters; Iranian responsibility is
//   CLAIMED by officials and DENIED by Iran — headline says exactly that.
// - Cairo tanker fire (31 killed) is a WED item, labelled WED.
// - COP31 outcome and the US GDP-probe result were not yet known at the
//   cutoff — NOT included, stated in DATE CHECK.
// - Only multi-outlet figures are printed; single-source claims excluded.
//
// Node 22, stdlib only (node:fs, node:zlib, node:path), no network, no
// clock, no randomness — running it twice produces byte-identical output.
// Writes to $MAKEFUN_OUTPUT_DIR/entry.png (or /output/entry.png).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

const PAPER: [number, number, number] = [251, 247, 238];
const INK: [number, number, number] = [17, 17, 17];
const WHITE: [number, number, number] = [255, 255, 255];
const RED: [number, number, number] = [185, 28, 28];
const DARKRED: [number, number, number] = [127, 29, 29];
const BLUE: [number, number, number] = [30, 58, 138];
const DARKBLUE: [number, number, number] = [23, 45, 110];
const GREEN: [number, number, number] = [27, 94, 32];
const ORANGE: [number, number, number] = [217, 119, 6];
const GREY: [number, number, number] = [96, 96, 96];

type RGB = [number, number, number];

// 5x7 bitmap font. Each glyph is 7 rows; each row is a 5-bit integer,
// most-significant bit = leftmost pixel.
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 6, 8, 16, 31],
  "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  ":": [0, 12, 12, 0, 12, 12, 0],
  ";": [0, 12, 12, 0, 12, 4, 8],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "-": [0, 0, 0, 14, 0, 0, 0],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "?": [14, 17, 1, 2, 4, 0, 4],
  "%": [25, 26, 2, 4, 8, 22, 19],
  $: [4, 15, 20, 14, 5, 30, 4],
  "&": [12, 18, 20, 8, 21, 18, 13],
  "/": [1, 2, 2, 4, 8, 8, 16],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "+": [0, 4, 4, 14, 4, 4, 0],
  "=": [0, 0, 14, 0, 14, 0, 0],
  '"': [10, 10, 0, 0, 0, 0, 0],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale;
}

function wrapText(s: string, scale: number, maxW: number): string[] {
  const lines: string[] = [];
  for (const paragraph of s.split("\n")) {
    const words = paragraph.split(" ");
    let cur = "";
    for (const word of words) {
      const trial = cur === "" ? word : cur + " " + word;
      if (textWidth(trial, scale) <= maxW || cur === "") {
        cur = trial;
      } else {
        lines.push(cur);
        cur = word;
      }
    }
    if (cur !== "") lines.push(cur);
  }
  return lines;
}

class Canvas {
  w: number;
  h: number;
  buf: Buffer;

  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 3);
    this.fillRect(0, 0, w, h, bg);
  }

  px(x: number, y: number, color: RGB): void {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) {
      const i = (y * this.w + x) * 3;
      this.buf[i] = color[0];
      this.buf[i + 1] = color[1];
      this.buf[i + 2] = color[2];
    }
  }

  fillRect(x: number, y: number, w: number, h: number, color: RGB): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let yy = y0; yy < y1; yy++) {
      const base = (yy * this.w + x0) * 3;
      for (let xx = x0; xx < x1; xx++) {
        const i = base + (xx - x0) * 3;
        this.buf[i] = color[0];
        this.buf[i + 1] = color[1];
        this.buf[i + 2] = color[2];
      }
    }
  }

  hline(x: number, y: number, w: number, color: RGB, t = 1): void {
    this.fillRect(x, y, w, t, color);
  }

  vline(x: number, y: number, h: number, color: RGB, t = 1): void {
    this.fillRect(x, y, t, h, color);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: RGB, t = 1): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    const half = Math.floor(t / 2);
    for (let s = 0; s <= steps; s++) {
      const x = x0 + Math.round((dx * s) / steps);
      const y = y0 + Math.round((dy * s) / steps);
      this.fillRect(x - half, y - half, t, t, color);
    }
  }

  fillCircle(cx: number, cy: number, r: number, color: RGB): void {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      this.fillRect(cx - half, cy + dy, 2 * half + 1, 1, color);
    }
  }

  text(x: number, y: number, s: string, scale: number, color: RGB): void {
    for (let ci = 0; ci < s.length; ci++) {
      const glyph = FONT[s[ci]] ?? FONT[" "];
      const ox = x + ci * 6 * scale;
      for (let row = 0; row < 7; row++) {
        const bits = glyph[row];
        for (let col = 0; col < 5; col++) {
          if (bits & (1 << (4 - col))) {
            this.fillRect(ox + col * scale, y + row * scale, scale, scale, color);
          }
        }
      }
    }
  }

  textCentered(cx: number, y: number, s: string, scale: number, color: RGB): void {
    this.text(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, color);
  }

  wrapped(x: number, y: number, s: string, scale: number, color: RGB, maxW: number, leading: number): number {
    for (const line of wrapText(s, scale, maxW)) {
      this.text(x, y, line, scale, color);
      y += 7 * scale + leading;
    }
    return y;
  }
}

// Stylised world map: 48 columns x 18 rows, "#" = land. Coarse but the
// continents are recognisable; red pins mark the numbered stories.
const MAP_ROWS: string[] = [
  "  ###########                ################## ",
  " ##############   ###     ###### ################",
  "  ##############      #######################   ",
  "   ###########         #####################    ",
  "    #########           ###################     ",
  "     #######            #################       ",
  "      #####    ##        ##############  ##     ",
  "       ###    ####        ##########    ####    ",
  "        ##   #####         ########    ###      ",
  "            ######          ######             ",
  "             ######          ####     ######    ",
  "             #####            ##      #####     ",
  "              ####                    ###       ",
  "              ###                               ",
  "               ##                               ",
  "               #                                ",
  "                                                ",
  "                                                ",
];

// [col, row]: 1 Kuwait, 2 Gaza, 3 USA, 4 UK, 5 Bangkok, 6 Ibiza.
const MAP_PINS: [number, number][] = [
  [29, 6],
  [27, 6],
  [13, 2],
  [23, 3],
  [41, 7],
  [24, 4],
];

interface MainPanel {
  x: number;
  accent: RGB;
  dark: RGB;
  kicker: string;
  headline: string[];
  dek: string;
  graphic: "burst" | "bars";
}

function drawMain(cv: Canvas, y: number, h: number, p: MainPanel): void {
  const x = p.x;
  const w = 488;
  cv.fillRect(x, y, w, h, WHITE);
  cv.fillRect(x, y, w, 3, INK);
  cv.fillRect(x, y + h - 3, w, 3, INK);
  cv.fillRect(x, y, 3, h, INK);
  cv.fillRect(x + w - 3, y, 3, h, INK);
  cv.fillRect(x + 3, y + 3, w - 6, 30, p.accent);
  cv.textCentered(x + w / 2, y + 11, p.kicker, 2, WHITE);
  let cy = y + 42;
  for (const line of p.headline) {
    cv.text(x + 16, cy, line, 4, INK);
    cy += 7 * 4 + 3;
  }
  cv.hline(x + 16, cy + 6, w - 32, p.accent, 3);
  cy += 16;
  cy = cv.wrapped(x + 16, cy, p.dek, 2, p.dark, w - 32, 3);
  // Graphic band at the bottom of the panel.
  const gy = y + h - 26;
  if (p.graphic === "burst") {
    const bx = x + 64;
    const by = gy + 11;
    for (let k = 0; k < 8; k++) {
      const ang = (Math.PI * k) / 4;
      const ex = bx + Math.round(13 * Math.cos(ang));
      const ey = by + Math.round(13 * Math.sin(ang));
      cv.line(bx, by, ex, ey, RED, 3);
    }
    cv.fillCircle(bx, by, 4, RED);
    cv.text(x + 92, gy + 3, "STRIKE ZONE: KUWAIT", 2, RED);
  } else {
    const heights = [7, 12, 18];
    for (let i = 0; i < 3; i++) {
      cv.fillRect(x + 40 + i * 32, gy + 20 - heights[i], 22, heights[i], BLUE);
    }
    cv.text(x + 150, gy + 3, "TARIFFS RISE WORLDWIDE", 2, BLUE);
  }
}

interface Card {
  n: string;
  region: string;
  head: string[];
  support: string;
}

const CARDS: Card[] = [
  { n: "03", region: "GAZA", head: ["ISRAEL KILLS 10", "IN GAZA"], support: "HAMAS WEIGHS REPLY, CHIEF SLAIN" },
  { n: "04", region: "WEATHER", head: ["MACY'S PARADE", "POSTPONED"], support: "FIRST TIME EVER; 500,000+ NO POWER" },
  { n: "05", region: "ECONOMY", head: ["US GDP REVISED", "TO 4.3%"], support: "TRUMP SEEKS PROBE, CRIES FAKE" },
  { n: "06", region: "UK", head: ["UK MIGRATION AT", "LOWEST SINCE 1997"], support: "NET MIGRATION FALLS, EX-PANDEMIC LOW" },
  { n: "07", region: "N KOREA", head: ["KIM VOWS MORE", "NUCLEAR WEAPONS"], support: "IGNORES TRUMP OVERTURE" },
  { n: "08", region: "THAILAND", head: ["BANGKOK REFINERY", "BLAZE INJURES"], support: "SEVERAL; BANGCHAK SHUTS ALL UNITS" },
  { n: "09", region: "SPAIN", head: ["DIESEL TANKER", "CAPSIZES OFF IBIZA"], support: "1 KILLED; UP TO 7,000 TONNES ABOARD" },
  { n: "10", region: "FRANCE", head: ["DEPARDIEU TO", "STAND TRIAL"], support: "COURT RULES ON ALLEGED 2018 RAPE" },
  { n: "11", region: "S AFRICA", head: ["RAMAPHOSA WINS", "COURT BID"], support: "IMPEACHMENT REPORT OVERTURNED" },
  { n: "12", region: "CHESS", head: ["GUKESH-SINDAROV", "DRAW GAME 3"], support: "WORLD TITLE MATCH LEVEL AFTER 3" },
  { n: "13", region: "TECH", head: ["CLAUDE TURNS", "ARTIFACTS TO APPS"], support: "ANTHROPIC LETS ARTIFACTS BECOME APPS" },
  { n: "14", region: "SPACE", head: ["GIANT PLANET MAY", "HIDE PAST NEPTUNE"], support: "NEW EVIDENCE RAISES POSSIBILITY" },
];

function drawCard(cv: Canvas, x: number, y: number, c: Card): void {
  const w = 236;
  const h = 78;
  cv.fillRect(x, y, w, h, WHITE);
  cv.fillRect(x, y, w, 2, INK);
  cv.fillRect(x, y + h - 2, w, 2, INK);
  cv.fillRect(x, y, 2, h, INK);
  cv.fillRect(x + w - 2, y, 2, h, INK);
  cv.fillRect(x + 4, y + 4, 26, 22, RED);
  cv.text(x + 5, y + 9, c.n, 2, WHITE);
  cv.text(x + 34, y + 9, c.region, 2, RED);
  cv.text(x + 6, y + 32, c.head[0], 2, INK);
  cv.text(x + 6, y + 49, c.head[1], 2, INK);
  cv.text(x + 6, y + 66, c.support, 1, GREY);
}

// ALSO ON items 15-32: two columns of nine, one line each (<=40 chars).
const ALSO_ON: string[] = [
  "15  INDIA-CHINA BORDER GENERALLY STABLE",
  "16  SINNER OUT OF AUSTRALIAN OPEN 2027",
  "17  MUSK: US KIDS GET 2 SPACEX SHARES",
  "18  INDIA OKs RS 11,000 CRORE SCHEME",
  "19  INDIA SC: PMLA BENCH NEEDS JUDGE",
  "20  NZ COALITION HOLDS 67 OF 131 SEATS",
  "21  BLACK FRIDAY: $12.9BN ONLINE FORECAST",
  "22  RUSSIA: OWN DATA SHOWS 500,000 DEAD",
  "23  UKRAINE HITS 5 RUSSIAN JETS AT BASE",
  "24  N KOREA EXPELS SWISS DIPLOMAT",
  "25  ISRAEL JUDGES: DROP NETANYAHU CHARGES",
  "26  UK SANCTIONS MYANMAR GENERALS",
  "27  CAIRO TANKER FIRE KILLS 31 (WED)",
  "28  EBOLA IN CONGO TOPS 12,000 CASES",
  "29  NEPAL: 4,000 LANDSLIDE MISSING DEAD",
  "30  BELGIUM OPENS BIG SATELLITE PLANT",
  "31  SAUDI STOPS 2 HOUTHI MISSILES",
  "32  KARACHI COLLAPSE KILLS 3, HURTS 14",
];

function render(): Canvas {
  const cv = new Canvas(W, H, PAPER);

  // Masthead.
  cv.textCentered(W / 2, 18, "THE WORLD TODAY", 8, INK);
  cv.hline(24, 84, W - 48, INK, 4);
  cv.textCentered(W / 2, 94, "FRIDAY 27 NOVEMBER 2026", 4, RED);
  cv.textCentered(W / 2, 130, "32 DATED STORIES - 9 REGIONS - AS REPORTED 27 NOV 2026", 2, INK);
  cv.hline(24, 150, W - 48, INK, 4);

  // Main panels.
  drawMain(cv, 158, 230, {
    x: 24,
    accent: RED,
    dark: DARKRED,
    kicker: "MIDDLE EAST - KUWAIT",
    headline: ["DRONE STRIKE IN", "KUWAIT KILLS 2", "ITALIANS"],
    dek: "IRANIAN DRONE HIT KUWAIT, OFFICIALS SAY. TEHRAN DENIES RESPONSIBILITY.",
    graphic: "burst",
  });
  drawMain(cv, 158, 230, {
    x: 512,
    accent: BLUE,
    dark: DARKBLUE,
    kicker: "TRADE - WASHINGTON",
    headline: ["TRUMP UNVEILS", "NEW TARIFFS ON", "DOZENS OF NATIONS"],
    dek: "US PROPOSES LEVIES ON CHINA, EU, JAPAN, INDIA, MEXICO AND BRAZIL. BEIJING: TRADE WARS SERVE NO ONE.",
    graphic: "bars",
  });

  // Numbered grid header.
  cv.text(24, 396, "THE DAY IN 32 STORIES", 3, INK);
  cv.text(592, 400, "9 REGIONS - FRIDAY 27 NOVEMBER 2026", 2, RED);
  cv.hline(24, 420, W - 48, INK, 2);

  // Numbered cards 03-14: 4 columns x 3 rows.
  const cardX = [24, 268, 512, 756];
  const cardY = [432, 514, 596];
  for (let i = 0; i < CARDS.length; i++) {
    drawCard(cv, cardX[i % 4], cardY[Math.floor(i / 4)], CARDS[i]);
  }

  // ALSO ON list 15-32.
  cv.text(24, 682, "ALSO ON 27 NOVEMBER", 3, INK);
  cv.hline(24, 708, W - 48, INK, 2);
  for (let i = 0; i < ALSO_ON.length; i++) {
    const col = Math.floor(i / 9);
    const row = i % 9;
    const x = col === 0 ? 24 : 520;
    cv.text(x, 716 + row * 17, ALSO_ON[i], 2, INK);
  }

  // Bottom band.
  cv.hline(24, 874, W - 48, INK, 2);
  cv.vline(264, 880, 120, INK, 2);
  cv.vline(508, 880, 120, INK, 2);
  cv.vline(752, 880, 120, INK, 2);

  // A: The day in numbers.
  cv.text(24, 882, "THE DAY IN NUMBERS", 2, RED);
  const numbers = [
    "2 ITALIANS KILLED",
    "10 KILLED IN GAZA",
    "500,000+ NO POWER",
    "$12.9BN BLACK FRI",
    "4.3% US GDP",
  ];
  for (let i = 0; i < numbers.length; i++) {
    cv.text(24, 902 + i * 17, numbers[i], 2, INK);
  }

  // B: As reported (IST).
  cv.text(272, 882, "AS REPORTED (IST)", 2, RED);
  const timeline = [
    "01:03 NYT: 2 ITALIANS KILLED, KUWAIT",
    "02:26 REUTERS: HAMAS WEIGHS REPLY",
    "03:31 BBC: TANKER SINKS OFF IBIZA",
    "03:46 TOI: SC RULES ON PMLA BENCH",
    "04:03 NDTV: IRAN DENIES KUWAIT STRIKE",
  ];
  for (let i = 0; i < timeline.length; i++) {
    cv.text(272, 902 + i * 12, timeline[i], 1, INK);
  }

  // C: World map with pins.
  cv.text(516, 882, "WORLD MAP", 2, RED);
  const mapX = 536;
  const mapY = 900;
  for (let r = 0; r < MAP_ROWS.length; r++) {
    const row = MAP_ROWS[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === "#") {
        cv.fillRect(mapX + c * 4, mapY + r * 4, 4, 4, INK);
      }
    }
  }
  for (const [col, row] of MAP_PINS) {
    cv.fillRect(mapX + col * 4, mapY + row * 4, 5, 5, RED);
  }
  cv.textCentered(632, 976, "1 KUWAIT 2 GAZA 3 USA", 1, INK);
  cv.textCentered(632, 988, "4 UK 5 BANGKOK 6 IBIZA", 1, INK);

  // D: Date check + How sure.
  cv.text(760, 882, "DATE CHECK", 2, RED);
  const dateCheck = [
    "CUTOFF 07:30 WIB, 27 NOV 2026.",
    "COP31 OUTCOME + US GDP PROBE RESULT",
    "NOT YET KNOWN - NOT INCLUDED.",
    "WED ITEM (CAIRO FIRE) LABELLED.",
  ];
  for (let i = 0; i < dateCheck.length; i++) {
    cv.text(760, 902 + i * 12, dateCheck[i], 1, INK);
  }
  cv.text(760, 952, "HOW SURE", 2, RED);
  const howSure = [
    "REPORTED = 2+ OUTLETS",
    "CLAIM = 1 SOURCE OR DENIED",
    "ONGOING = STILL DEVELOPING",
  ];
  for (let i = 0; i < howSure.length; i++) {
    cv.text(760, 968 + i * 12, howSure[i], 1, INK);
  }

  // Footer.
  cv.textCentered(W / 2, 1006, "FRIDAY 27 NOVEMBER 2026 - THE WORLD TODAY - 32 STORIES, 9 REGIONS", 2, INK);
  return cv;
}

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tag: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const tagBuf = Buffer.from(tag, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tagBuf, data])), 0);
  return Buffer.concat([len, tagBuf, data, crc]);
}

function writePng(path: string, cv: Canvas): number {
  const rows: Buffer[] = [];
  for (let y = 0; y < cv.h; y++) {
    const row = Buffer.alloc(1 + cv.w * 3);
    row[0] = 0;
    cv.buf.copy(row, 1, y * cv.w * 3, (y + 1) * cv.w * 3);
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  return png.length;
}

function main(): void {
  const outdir = process.env["MAKEFUN_OUTPUT_DIR"] ?? "/output";
  mkdirSync(outdir, { recursive: true });
  const path = join(outdir, "entry.png");
  const size = writePng(path, render());
  console.log(`wrote ${path} (${size} bytes)`);
}

main();
