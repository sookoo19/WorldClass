// shapes.jsx — Decorative SVG shape library inspired by the reference shape pack.
// Every shape is a single React component that accepts {size, color, className, style}.
// All shapes are designed to be flat, paper-cut, single-color marks.

const sShape = (props, children, viewBox = "0 0 100 100") => {
  const { size = 80, color = "#0043C3", className = "", style = {}, rotate = 0 } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      className={className}
      style={{ display: "block", transform: `rotate(${rotate}deg)`, ...style }}
      aria-hidden="true"
    >
      {React.Children.map(children, (c) =>
        React.cloneElement(c, { fill: c.props.fill || color })
      )}
    </svg>
  );
};

// --- Scalloped circle (01-03) ---
function ScallopCircle(props) {
  // generate scallop path with N petals
  const petals = props.petals || 16;
  const r = 38, r2 = 46, cx = 50, cy = 50;
  const points = [];
  const steps = petals * 2;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r2;
    points.push(`${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`);
  }
  // smooth as scallops via quadratic curves
  let d = `M ${points[0]} `;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i].split(",").map(Number);
    const [px, py] = points[i - 1].split(",").map(Number);
    d += `Q ${(px + x) / 2 + (y - py) * 0.2} ${(py + y) / 2 - (x - px) * 0.2} ${x} ${y} `;
  }
  d += "Z";
  return sShape(props, [<path key="p" d={d} />]);
}

// --- Starburst with rounded points (04) ---
function StarBurst(props) {
  const petals = props.petals || 14;
  const rOuter = 48, rInner = 18, cx = 50, cy = 50;
  const points = [];
  for (let i = 0; i < petals * 2; i++) {
    const a = (i / (petals * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? rOuter : rInner;
    points.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  let d = `M ${points[0][0]} ${points[0][1]} `;
  for (let i = 1; i <= points.length; i++) {
    const [x, y] = points[i % points.length];
    const [px, py] = points[i - 1];
    if (i % 2 === 1) d += `Q ${(px + x) / 2} ${(py + y) / 2} ${x} ${y} `;
    else d += `L ${x} ${y} `;
  }
  d += "Z";
  return sShape(props, [<path key="p" d={d} />]);
}

// --- Pointy star burst (08, 16) ---
function SpikeBurst(props) {
  const petals = props.petals || 16;
  const rOuter = 48, rInner = 32, cx = 50, cy = 50;
  let d = "";
  for (let i = 0; i < petals * 2; i++) {
    const a = (i / (petals * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? rOuter : rInner;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    d += (i === 0 ? "M " : "L ") + x + " " + y + " ";
  }
  d += "Z";
  return sShape(props, [<path key="p" d={d} />]);
}

// --- 4-point sparkle (19) ---
function Sparkle4(props) {
  return sShape(props, [
    <path key="p" d="M50 5 Q52 40 95 50 Q52 60 50 95 Q48 60 5 50 Q48 40 50 5 Z" />,
  ]);
}

// --- 8-point asterisk (10, 18) ---
function Asterisk8(props) {
  const lines = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 8) * Math.PI * 2;
    lines.push(
      <rect
        key={i}
        x="44" y="6" width="12" height="88" rx="6"
        transform={`rotate(${(i * 180) / 4} 50 50)`}
      />
    );
  }
  return sShape(props, lines);
}

// --- Flower 5 petals (14) ---
function Flower5(props) {
  const petals = 5;
  let d = "";
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    const cx = 50 + Math.cos(a) * 24;
    const cy = 50 + Math.sin(a) * 24;
    d += `M ${cx} ${cy} m -22 0 a 22 22 0 1 0 44 0 a 22 22 0 1 0 -44 0 `;
  }
  return sShape(props, [<path key="p" d={d} />]);
}

// --- Blob (irregular flower) (11) ---
function Blob(props) {
  return sShape(props, [
    <path key="p" d="M50 4 C 65 8 62 22 78 24 C 95 26 92 44 88 54 C 84 66 96 78 82 86 C 70 94 58 82 50 92 C 42 100 26 92 22 80 C 18 70 4 64 10 50 C 14 38 6 24 22 18 C 36 12 38 0 50 4 Z" />,
  ]);
}

// --- Squiggle horizontal (30-32, 33) ---
function Squiggle(props) {
  const { size = 200, color = "#0043C3", className = "", style = {}, strokeWidth = 14 } = props;
  return (
    <svg width={size} height={size / 4} viewBox="0 0 200 50" className={className} style={style}>
      <path
        d="M 10 25 Q 30 5 50 25 T 90 25 T 130 25 T 170 25 T 195 25"
        fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
      />
    </svg>
  );
}

// --- M-shape squiggle (32) ---
function Mwave(props) {
  const { size = 200, color = "#FF651E", className = "", style = {} } = props;
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 200 110" className={className} style={style}>
      <path
        d="M 15 90 Q 15 20 45 20 Q 75 20 75 70 Q 75 95 100 95 Q 125 95 125 70 Q 125 20 155 20 Q 185 20 185 90"
        fill="none" stroke={color} strokeWidth="22" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

// --- Arch (rainbow half-circle) (33) ---
function Arch(props) {
  const { size = 160, color = "#F3D9F1", className = "", style = {} } = props;
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 160 90" className={className} style={style}>
      <path d="M 5 88 A 75 75 0 0 1 155 88 L 130 88 A 50 50 0 0 0 30 88 Z" fill={color} />
    </svg>
  );
}

// --- Quarter arc (34) ---
function QuarterArc(props) {
  const { size = 120, color = "#FFD98C", className = "", style = {} } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} style={style}>
      <path d="M 10 110 A 100 100 0 0 1 110 10 L 110 50 A 60 60 0 0 0 50 110 Z" fill={color} />
    </svg>
  );
}

// --- Donut scallop (05-07) ---
function DonutScallop(props) {
  const petals = 12;
  const r = 42, r2 = 50, cx = 50, cy = 50;
  const points = [];
  for (let i = 0; i < petals * 2; i++) {
    const a = (i / (petals * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r2;
    points.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  let d = `M ${points[0][0]} ${points[0][1]} `;
  for (let i = 1; i <= points.length; i++) {
    const [x, y] = points[i % points.length];
    const [px, py] = points[i - 1];
    d += `Q ${(px + x) / 2 + (y - py) * 0.15} ${(py + y) / 2 - (x - px) * 0.15} ${x} ${y} `;
  }
  d += " M 50 35 a 15 15 0 1 0 0.01 0 Z";
  return sShape(props, [<path key="p" d={d} fillRule="evenodd" />]);
}

// --- 6-point star (13) ---
function Star6(props) {
  const points = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? 48 : 22;
    points.push(`${50 + Math.cos(a) * rad},${50 + Math.sin(a) * rad}`);
  }
  return sShape(props, [<polygon key="p" points={points.join(" ")} />]);
}

// --- Wavy column (25-29) ---
function WavyCol(props) {
  const { size = 80, color = "#FF651E", className = "", style = {} } = props;
  return (
    <svg width={size * 0.65} height={size} viewBox="0 0 65 100" className={className} style={style}>
      <path d="M 10 5 Q 10 18 25 22 Q 60 28 60 40 Q 60 52 25 60 Q 10 64 10 76 Q 10 88 60 95 L 60 5 Z" fill={color} />
    </svg>
  );
}

// --- Soft pill star (21) ---
function Star5(props) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? 45 : 22;
    points.push([50 + Math.cos(a) * rad, 50 + Math.sin(a) * rad]);
  }
  let d = `M ${points[0][0]} ${points[0][1]} `;
  for (let i = 1; i <= points.length; i++) {
    const [x, y] = points[i % points.length];
    d += `L ${x} ${y} `;
  }
  return sShape(props, [<path key="p" d={d} strokeLinejoin="round" stroke={props.color || "#FFD98C"} strokeWidth="10" />]);
}

// --- Wordmark/Logo — 地球儀 + 開いた本 ---
function Logo({ size = 32, color = "#FF651E" }) {
  const s = 2.2; // stroke-width
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true"
         stroke={color} strokeLinecap="round" strokeLinejoin="round">

      {/* 光線（5本） */}
      <line x1="40" y1="4"  x2="40" y2="10" strokeWidth={s+0.3}/>
      <line x1="24" y1="8"  x2="27" y2="13" strokeWidth={s}/>
      <line x1="56" y1="8"  x2="53" y2="13" strokeWidth={s}/>
      <line x1="13" y1="17" x2="17" y2="21" strokeWidth={s}/>
      <line x1="67" y1="17" x2="63" y2="21" strokeWidth={s}/>

      {/* 地球儀: 外周 */}
      <circle cx="40" cy="36" r="20" strokeWidth={s}/>

      {/* 地球儀: 経線（Cubic Bezier — 512座標を80座標にスケール変換） */}
      <path d="M40 16 C32.94 22.48 29.41 28.94 29.41 36 C29.41 43.06 32.94 49.52 40 56" strokeWidth={s-0.4}/>
      <path d="M40 16 C47.06 22.48 50.59 28.94 50.59 36 C50.59 43.06 47.06 49.52 40 56" strokeWidth={s-0.4}/>
      <line x1="40" y1="16" x2="40" y2="56" strokeWidth={s-0.4}/>

      {/* 地球儀: 緯線（Cubic Bezier） */}
      <path d="M21.76 28.94 C30.59 32.47 49.41 32.47 58.24 28.94" strokeWidth={s-0.4}/>
      <path d="M20 43.06 C30 46.59 50 46.59 60 43.06" strokeWidth={s-0.4}/>

      {/* 開いた本: 左ページ */}
      <path d="M40 54 Q28 50 10 56 L10 72 Q28 66 40 70 Z" strokeWidth={s}/>
      {/* 開いた本: 右ページ */}
      <path d="M40 54 Q52 50 70 56 L70 72 Q52 66 40 70 Z" strokeWidth={s}/>
      {/* 本の背表紙（中央縦線） */}
      <line x1="40" y1="54" x2="40" y2="70" strokeWidth={s}/>
      {/* ページのカーブ線（左） */}
      <path d="M17 59 Q28 56 38 58" strokeWidth={s-0.6}/>
      {/* ページのカーブ線（右） */}
      <path d="M63 59 Q52 56 42 58" strokeWidth={s-0.6}/>
    </svg>
  );
}

// --- Icon set (24x24 line style for cards) ---
function Icon({ name, size = 28, color = "#002D7A", bgColor = "#D6E6FF" }) {
  const ICONS = {
    globe: (
      <>
        <circle cx="14" cy="14" r="10" fill={bgColor} />
        <circle cx="14" cy="14" r="10" fill="none" stroke={color} strokeWidth="2" />
        <ellipse cx="14" cy="14" rx="4" ry="10" fill="none" stroke={color} strokeWidth="2" />
        <line x1="4" y1="14" x2="24" y2="14" stroke={color} strokeWidth="2" />
      </>
    ),
    chat: (
      <>
        <rect x="3" y="5" width="22" height="16" rx="6" fill={bgColor} />
        <path d="M 9 21 L 9 25 L 13 21" fill={bgColor} />
        <rect x="3" y="5" width="22" height="16" rx="6" fill="none" stroke={color} strokeWidth="2" />
        <path d="M 9 21 L 9 25 L 13 21" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <circle cx="10" cy="13" r="1.4" fill={color} />
        <circle cx="14" cy="13" r="1.4" fill={color} />
        <circle cx="18" cy="13" r="1.4" fill={color} />
      </>
    ),
    book: (
      <>
        <path d="M 4 6 L 14 8 L 24 6 L 24 22 L 14 24 L 4 22 Z" fill={bgColor} stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <line x1="14" y1="8" x2="14" y2="24" stroke={color} strokeWidth="2" />
      </>
    ),
    heart: (
      <>
        <path d="M 14 23 C 4 17 4 9 9 7 C 12 6 14 8 14 10 C 14 8 16 6 19 7 C 24 9 24 17 14 23 Z" fill={bgColor} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
    bell: (
      <>
        <path d="M 7 18 L 7 13 A 7 7 0 0 1 21 13 L 21 18 L 23 21 L 5 21 Z" fill={bgColor} stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <path d="M 11 22 A 3 3 0 0 0 17 22" stroke={color} strokeWidth="2" fill="none" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="6" width="20" height="18" rx="3" fill={bgColor} stroke={color} strokeWidth="2" />
        <line x1="4" y1="11" x2="24" y2="11" stroke={color} strokeWidth="2" />
        <line x1="9" y1="4" x2="9" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1="19" y1="4" x2="19" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <circle cx="14" cy="17" r="2" fill="#FF651E" />
      </>
    ),
    user: (
      <>
        <circle cx="14" cy="10" r="4" fill={bgColor} stroke={color} strokeWidth="2" />
        <path d="M 5 24 C 5 18 10 16 14 16 C 18 16 23 18 23 24 Z" fill={bgColor} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
    library: (
      <>
        <path d="M 4 24 L 4 11 L 14 5 L 24 11 L 24 24 Z" fill={bgColor} stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <line x1="4" y1="24" x2="24" y2="24" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <rect x="8" y="14" width="3" height="10" fill={color} />
        <rect x="13" y="14" width="3" height="10" fill={color} />
        <rect x="18" y="14" width="3" height="10" fill={color} />
      </>
    ),
    home: (
      <>
        <path d="M 4 13 L 14 4 L 24 13 L 24 24 L 17 24 L 17 17 L 11 17 L 11 24 L 4 24 Z" fill={bgColor} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
    school: (
      <>
        <path d="M 14 4 L 25 10 L 14 16 L 3 10 Z" fill={bgColor} stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <path d="M 7 12 L 7 18 C 7 21 10 23 14 23 C 18 23 21 21 21 18 L 21 12" fill="none" stroke={color} strokeWidth="2" />
        <line x1="24" y1="10" x2="24" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    family: (
      <>
        <circle cx="9" cy="9" r="3" fill={bgColor} stroke={color} strokeWidth="2" />
        <circle cx="19" cy="9" r="3" fill={bgColor} stroke={color} strokeWidth="2" />
        <circle cx="14" cy="17" r="2.5" fill="#FF651E" />
        <path d="M 4 23 C 4 19 6 17 9 17 C 12 17 14 19 14 23" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 14 23 C 14 19 16 17 19 17 C 22 17 24 19 24 23" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    ),
    sparkles: (
      <>
        <path d="M 14 4 L 16 12 L 24 14 L 16 16 L 14 24 L 12 16 L 4 14 L 12 12 Z" fill={bgColor} stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <path d="M 22 5 L 23 8 L 26 9 L 23 10 L 22 13 L 21 10 L 18 9 L 21 8 Z" fill="#FFA801" />
      </>
    ),
    handshake: (
      <>
        <path d="M 4 14 L 9 11 L 14 13 L 19 11 L 24 14 L 24 19 L 19 22 L 14 20 L 9 22 L 4 19 Z" fill={bgColor} stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <circle cx="14" cy="16" r="2" fill="#FF651E" />
      </>
    ),
    check: (
      <>
        <circle cx="14" cy="14" r="11" fill="#FFA801" />
        <path d="M 8 14 L 12 18 L 20 10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      {ICONS[name] || ICONS.sparkles}
    </svg>
  );
}

Object.assign(window, {
  ScallopCircle, StarBurst, SpikeBurst, Sparkle4, Asterisk8, Flower5, Blob,
  Squiggle, Mwave, Arch, QuarterArc, DonutScallop, Star6, WavyCol, Star5,
  Logo, Icon,
});
