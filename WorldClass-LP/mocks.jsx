// mocks.jsx — Product UI mockup components for the hero and "section 5: UI showcase".
// These are illustrative — not real screenshots. They follow the same blue/yellow/orange palette.

// ============ Hero center mockup ============
// A live "video session" composite with two surrounding chips, like a real product preview.
function HeroMock() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Background decoration */}
      <div style={{ position: "absolute", top: "-30px", right: "-20px", "--rot": "8deg" }} className="float-anim">
        <ScallopCircle size={140} color="#FFD98C" />
      </div>
      <div style={{ position: "absolute", bottom: "10px", left: "-30px", "--rot": "-12deg" }} className="float-anim" >
        <StarBurst size={110} color="#FF651E" />
      </div>
      <div style={{ position: "absolute", top: "30%", left: "-10px", "--rot": "0deg" }} className="float-anim">
        <Sparkle4 size={56} color="#0043C3" />
      </div>
      <div style={{ position: "absolute", top: "8px", left: "30%" }}>
        <Squiggle size={120} color="#0059FF" strokeWidth={10} />
      </div>

      {/* Main video card */}
      <div style={{ position: "relative", margin: "30px auto 0", maxWidth: 460 }}>
        <div className="mock-card" style={{ transform: "rotate(-2deg)" }}>
          <div className="mock-header">
            <span className="mock-dot r"></span>
            <span className="mock-dot y"></span>
            <span className="mock-dot g"></span>
            <div className="mock-url"><span style={{ width: 8, height: 8, borderRadius: 99, background: "#3F8A6E" }}></span>worldclass.app/session/ke-12</div>
          </div>
          <div style={{ padding: 14 }}>
            <div className="call-stage">
              <div className="call-grid">
                <div className="call-tile" style={{ background: "#9CB9FF" }}>
                  <SchoolKidsArt variant="a" />
                  <span className="call-name">ケニアの学校 · 6年生</span>
                </div>
                <div className="call-tile b">
                  <SchoolKidsArt variant="b" />
                  <span className="call-name">日本のご家庭</span>
                </div>
                <div className="call-tile c">
                  <SchoolKidsArt variant="c" />
                  <span className="call-name">テーマ: 学校生活</span>
                </div>
                <div className="call-tile d">
                  <SchoolKidsArt variant="d" />
                  <span className="call-name">通訳サポート</span>
                </div>
              </div>
              <div className="call-controls">
                <div className="call-ctrl">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2 a3 3 0 0 0 -3 3 v6 a3 3 0 0 0 6 0 V5 a3 3 0 0 0 -3 -3 Z M5 11 v1 a7 7 0 0 0 14 0 v-1 M12 19 v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <div className="call-ctrl">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M17 10 l4 -2 v8 l-4 -2 z" fill="currentColor"/></svg>
                </div>
                <div className="call-ctrl">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M2 12 a13 8 0 0 1 20 0 a13 8 0 0 1 -20 0 z" stroke="currentColor" strokeWidth="2"/></svg>
                </div>
                <div className="call-ctrl end">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 14 c4 -6 14 -6 18 0 l-2 2 a2 2 0 0 1 -3 0 l-1 -2 c-2 -1 -4 -1 -6 0 l-1 2 a2 2 0 0 1 -3 0 z" fill="currentColor"/></svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating reaction chips */}
        <div style={{ position: "absolute", top: -20, right: -20, background: "#fff", padding: "10px 14px", borderRadius: 999, boxShadow: "0 8px 20px -8px rgba(0,45,122,0.3)", display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }} className="float-anim">
          <span style={{ width: 22, height: 22, borderRadius: 99, background: "#FF651E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff" }}>EN</span>
          英語で自己紹介
        </div>
        <div style={{ position: "absolute", bottom: -16, left: -28, background: "#fff", padding: "10px 14px", borderRadius: 999, boxShadow: "0 8px 20px -8px rgba(0,45,122,0.3)", display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }} className="float-anim" >
          <span style={{ width: 22, height: 22, borderRadius: 99, background: "#FFA801", color: "#002D7A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800 }}>Topic</span>
          現地での生活について
        </div>
      </div>

      {/* Floating support card */}
      <div style={{ position: "absolute", bottom: -10, right: 0, background: "#fff", padding: 18, borderRadius: 20, boxShadow: "0 16px 40px -16px rgba(0,45,122,0.3)", width: 200 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#5A6B92", letterSpacing: ".1em", textTransform: "uppercase" }}>語学サポート</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>通訳スタッフが同席</div>
            <div style={{ fontSize: 11, color: "#5A6B92" }}>司会進行もお任せください</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Decorative "kids" art using flat shapes (no photos).
function SchoolKidsArt({ variant }) {
  if (variant === "a") {
    return (
      <svg viewBox="0 0 120 90" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid slice">
        <rect width="120" height="90" fill="#9CB9FF" />
        <circle cx="35" cy="35" r="13" fill="#5C3A1E" />
        <rect x="22" y="48" width="26" height="30" rx="10" fill="#FF651E" />
        <circle cx="80" cy="32" r="13" fill="#7A4E2E" />
        <rect x="67" y="45" width="26" height="32" rx="10" fill="#FFA801" />
        <circle cx="35" cy="32" r="1.5" fill="#fff" />
        <circle cx="80" cy="29" r="1.5" fill="#fff" />
      </svg>
    );
  }
  if (variant === "b") {
    return (
      <svg viewBox="0 0 120 90" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid slice">
        <rect width="120" height="90" fill="#FFD98C" />
        <circle cx="60" cy="32" r="16" fill="#E8B083" />
        <path d="M44 30 Q60 14 76 30 L 76 22 Q60 8 44 22 Z" fill="#3D2A1A" />
        <rect x="42" y="50" width="36" height="40" rx="12" fill="#0043C3" />
        <circle cx="55" cy="30" r="1.6" fill="#1A1A1A" />
        <circle cx="65" cy="30" r="1.6" fill="#1A1A1A" />
        <path d="M 55 38 Q 60 42 65 38" stroke="#1A1A1A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  if (variant === "c") {
    return (
      <svg viewBox="0 0 120 90" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid slice">
        <rect width="120" height="90" fill="#FF651E" />
        <rect x="20" y="20" width="80" height="55" rx="8" fill="#fff" />
        <line x1="30" y1="35" x2="80" y2="35" stroke="#002D7A" strokeWidth="2.5" />
        <line x1="30" y1="45" x2="70" y2="45" stroke="#0043C3" strokeWidth="2" />
        <line x1="30" y1="55" x2="85" y2="55" stroke="#0043C3" strokeWidth="2" />
        <circle cx="86" cy="63" r="6" fill="#FFA801" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 90" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid slice">
      <rect width="120" height="90" fill="#C7E0FF" />
      <circle cx="60" cy="35" r="14" fill="#F5C9A6" />
      <path d="M48 30 Q60 18 72 30 L72 24 Q60 12 48 24 Z" fill="#1A1A1A" />
      <rect x="44" y="48" width="32" height="38" rx="10" fill="#3F8A6E" />
      <circle cx="56" cy="34" r="1.4" fill="#1A1A1A" />
      <circle cx="64" cy="34" r="1.4" fill="#1A1A1A" />
    </svg>
  );
}

// ============ Section 5 mocks ============

function CatalogMock() {
  const schools = [
    { name: "ケニアの学校", loc: "ケニア共和国", tag: "文化交流", status: "partner", color: "#FFD98C", patternA: "#FF651E", patternB: "#FFA801" },
    { name: "ブータンの学校", loc: "ブータン王国", tag: "国際理解", status: "partner", color: "#C7E0FF", patternA: "#0043C3", patternB: "#FFA801" },
    { name: "チュニジアの学校", loc: "チュニジア共和国", tag: "SDGs", status: "partner", color: "#FFE3D2", patternA: "#FF651E", patternB: "#0043C3" },
    { name: "新規パートナー候補", loc: "募集中", tag: "募集中", status: "open", color: "#EEF4FF", patternA: "#D6E6FF", patternB: "#9CB9FF" },
    { name: "新規パートナー候補", loc: "募集中", tag: "募集中", status: "open", color: "#FBFAF5", patternA: "#E7E2D6", patternB: "#D6E6FF" },
    { name: "新規パートナー候補", loc: "募集中", tag: "募集中", status: "open", color: "#F3D9F1", patternA: "#D6E6FF", patternB: "#FFE3D2" },
  ];
  return (
    <div className="mock-card">
      <div className="mock-header">
        <span className="mock-dot r"></span><span className="mock-dot y"></span><span className="mock-dot g"></span>
        <div className="mock-url">worldclass.app/schools</div>
      </div>
      <div style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(0,45,122,0.06)" }}>
        <div>
          <div style={{ fontSize: 11, color: "#5A6B92", fontWeight: 600 }}>パートナー校カタログ</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginTop: 2 }}>つながれる学校 <span style={{ fontSize: 12, color: "#5A6B92", fontWeight: 600 }}>· 3カ国(予定)</span></div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["すべて", "確定", "募集中"].map((t, i) => (
            <div key={t} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: i === 0 ? "#002D7A" : "#EEF4FF", color: i === 0 ? "#fff" : "#002D7A" }}>{t}</div>
          ))}
        </div>
      </div>
      <div className="cat-grid">
        {schools.map((s, i) => (
          <div key={i} className="cat-card" style={{ opacity: s.status === "open" ? 0.55 : 1 }}>
            <div className="cat-thumb" style={{ background: s.color, position: "relative" }}>
              <SchoolPattern colorA={s.patternA} colorB={s.patternB} />
              {s.status === "partner" && (
                <span style={{ position: "absolute", top: 8, left: 8, background: "#002D7A", color: "#fff", fontSize: 9, padding: "3px 7px", borderRadius: 999, fontWeight: 700, letterSpacing: ".04em" }}>予定パートナー</span>
              )}
              {s.status === "open" && (
                <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,45,122,0.5)", color: "#fff", fontSize: 9, padding: "3px 7px", borderRadius: 999, fontWeight: 700 }}>+ 募集中</span>
              )}
            </div>
            <div className="cat-name">{s.name}</div>
            <div className="cat-loc">{s.loc}</div>
            <span className="cat-tag" style={{ background: s.tag === "SDGs" ? "#FFA801" : s.tag === "募集中" ? "#EEF4FF" : "#fff", color: s.tag === "募集中" ? "#5A6B92" : "#002D7A" }}>{s.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SchoolPattern({ colorA, colorB }) {
  return (
    <svg viewBox="0 0 100 75" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <circle cx="22" cy="55" r="18" fill={colorA} opacity="0.85" />
      <circle cx="62" cy="32" r="22" fill={colorB} opacity="0.9" />
      <path d="M 70 60 Q 80 50 90 60 Q 80 70 70 60 Z" fill={colorA} />
      <circle cx="80" cy="58" r="3" fill="#fff" />
    </svg>
  );
}

function SessionListMock() {
  const sess = [
    { h: "10:00", d: "土", title: "ケニアの学校とあいさつ", meta: "60分 · 文化交流", school: "ケニア共和国" , tag: "受付中"},
    { h: "13:30", d: "日", title: "ヒマラヤと幸福度の話", meta: "60分 · 国際理解", school: "ブータン王国", tag: "残3" },
    { h: "16:00", d: "日", title: "水・砂漠・暮らしのSDGs", meta: "60分 · SDGs", school: "チュニジア共和国", tag: "新着" },
    { h: "11:00", d: "月", title: "英語で給食メニューを話そう", meta: "45分 · 英語学習", school: "ケニア共和国", tag: "受付中" },
  ];
  return (
    <div className="mock-card">
      <div className="mock-header">
        <span className="mock-dot r"></span><span className="mock-dot y"></span><span className="mock-dot g"></span>
        <div className="mock-url">worldclass.app/sessions</div>
      </div>
      <div style={{ padding: 18, borderBottom: "1px solid rgba(0,45,122,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: "#5A6B92", fontWeight: 600 }}>オープンセッション</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginTop: 2 }}>今週のラインナップ</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EEF4FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 1 L 1 7 L 5 13" stroke="#002D7A" strokeWidth="2" strokeLinecap="round" /></svg>
          </div>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#002D7A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 1 L 13 7 L 9 13" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
          </div>
        </div>
      </div>
      {sess.map((s, i) => (
        <div key={i} className="sess-row">
          <div className="sess-time">
            <div className="h">{s.h}</div>
            <div className="d">{s.d}曜</div>
          </div>
          <div className="sess-body">
            <div className="sess-title">{s.title}</div>
            <div className="sess-meta">
              <span>{s.meta}</span>
              <span>· {s.school}</span>
            </div>
          </div>
          <span className="sess-pill" style={{ background: s.tag === "新着" ? "#FFE3D2" : s.tag === "残3" ? "#FFD98C" : "#D6E6FF", color: s.tag === "新着" ? "#FF651E" : s.tag === "残3" ? "#A36500" : "#002D7A" }}>{s.tag}</span>
          <button className="sess-btn">予約</button>
        </div>
      ))}
    </div>
  );
}

function BookingMock() {
  return (
    <div className="mock-card">
      <div className="mock-header">
        <span className="mock-dot r"></span><span className="mock-dot y"></span><span className="mock-dot g"></span>
        <div className="mock-url">worldclass.app/book/ke-12</div>
      </div>
      <div style={{ padding: 22 }}>
        <div style={{ fontSize: 11, color: "#5A6B92", fontWeight: 600 }}>セッション予約</div>
        <div style={{ fontWeight: 800, fontSize: 20, marginTop: 4 }}>ケニアの学校とあいさつ</div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <span style={{ background: "#FFE3D2", color: "#FF651E", fontSize: 11, padding: "4px 10px", borderRadius: 999, fontWeight: 700 }}>文化交流</span>
          <span style={{ background: "#D6E6FF", color: "#002D7A", fontSize: 11, padding: "4px 10px", borderRadius: 999, fontWeight: 700 }}>60分</span>
          <span style={{ background: "#FFEFD2", color: "#A36500", fontSize: 11, padding: "4px 10px", borderRadius: 999, fontWeight: 700 }}>初級</span>
        </div>

        <div style={{ marginTop: 22, fontSize: 12, fontWeight: 700, color: "#002D7A" }}>日時を選ぶ</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 8 }}>
          {[
            { d: 3, free: true }, { d: 4, free: false }, { d: 5, free: true, sel: true }, { d: 6, free: true },
            { d: 7, free: false }, { d: 8, free: true }, { d: 9, free: false },
          ].map((c, i) => (
            <div key={i} style={{ aspectRatio: "1/1", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: c.sel ? "#002D7A" : c.free ? "#EEF4FF" : "#F5F2EA", color: c.sel ? "#fff" : c.free ? "#002D7A" : "#B0AFA8" }}>
              <span style={{ fontSize: 9, opacity: 0.7 }}>{["月", "火", "水", "木", "金", "土", "日"][i]}</span>
              <span style={{ fontSize: 14 }}>{c.d}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, fontSize: 12, fontWeight: 700, color: "#002D7A" }}>時間帯</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {["10:00", "13:30", "15:00", "16:30"].map((t, i) => (
            <span key={t} style={{ padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: i === 1 ? "#FF651E" : "#EEF4FF", color: i === 1 ? "#fff" : "#002D7A" }}>{t}</span>
          ))}
        </div>

        <div style={{ marginTop: 22, background: "#FFEFD2", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="handshake" size={28} bgColor="#FFA801" color="#fff" />
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            <strong style={{ fontSize: 13 }}>この予約で教材2冊を支援</strong><br/>
            <span style={{ color: "#A36500" }}>料金の30%が現地校へ還元されます</span>
          </div>
        </div>

        <button style={{ marginTop: 16, width: "100%", background: "#002D7A", color: "#fff", height: 48, borderRadius: 999, fontWeight: 700, fontSize: 14 }}>予約を確定する</button>
      </div>
    </div>
  );
}

function DashboardMock() {
  return (
    <div className="mock-card">
      <div className="mock-header">
        <span className="mock-dot r"></span><span className="mock-dot y"></span><span className="mock-dot g"></span>
        <div className="mock-url">worldclass.app/dashboard</div>
      </div>
      <div style={{ padding: "18px 18px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: "#5A6B92", fontWeight: 600 }}>ダッシュボード</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginTop: 2 }}>こんにちは、川崎図書館さん</div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 99, background: "#FFD98C", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#002D7A", fontSize: 13 }}>川</div>
      </div>
      <div className="dash-grid">
        <div className="dash-stat">
          <div className="dash-stat-label">今月のセッション</div>
          <div className="dash-stat-value">4<span style={{ fontSize: 14, opacity: 0.5 }}> 回</span></div>
          <div className="dash-stat-meta">予定通り進行中</div>
        </div>
        <div className="dash-stat orange">
          <div className="dash-stat-label" style={{ color: "#A04018" }}>累計支援</div>
          <div className="dash-stat-value" style={{ color: "#A04018" }}>教材<span style={{ fontSize: 14 }}> 12 セット</span></div>
          <div className="dash-stat-meta" style={{ color: "#FF651E" }}>+3 今月</div>
        </div>
        <div className="dash-stat yellow">
          <div className="dash-stat-label" style={{ color: "#7A4F00" }}>つながった国</div>
          <div className="dash-stat-value" style={{ color: "#7A4F00" }}>3<span style={{ fontSize: 14, opacity: 0.6 }}> カ国</span></div>
          <div className="dash-stat-meta" style={{ color: "#A36500" }}>ケニア · ブータン · チュニジア</div>
        </div>
        <div className="dash-stat dark">
          <div className="dash-stat-label">次回セッション</div>
          <div className="dash-stat-value" style={{ fontSize: 18, marginTop: 8 }}>10/12 (土) 10:00</div>
          <div className="dash-stat-meta" style={{ color: "#FFD98C" }}>ケニア · 文化交流</div>
        </div>
      </div>
      <div style={{ padding: "0 18px 18px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#002D7A", marginBottom: 8 }}>最近の活動</div>
        <div style={{ display: "grid", gap: 8 }}>
          {[
            { c: "#FF651E", t: "ケニアの学校との交流レポートが届きました", m: "2日前" },
            { c: "#FFA801", t: "ブータンの学校が新しいテーマを公開", m: "5日前" },
            { c: "#0043C3", t: "10月のオープンセッションが追加されました", m: "1週間前" },
          ].map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: 10, background: "#FBFAF5", borderRadius: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: 99, background: a.c, flexShrink: 0 }}></div>
              <div style={{ flex: 1, fontSize: 12, color: "#002D7A" }}>{a.t}</div>
              <div style={{ fontSize: 10, color: "#5A6B92" }}>{a.m}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SupportReportMock() {
  return (
    <div className="mock-card">
      <div className="mock-header">
        <span className="mock-dot r"></span><span className="mock-dot y"></span><span className="mock-dot g"></span>
        <div className="mock-url">worldclass.app/support</div>
      </div>
      <div style={{ padding: 22 }}>
        <div style={{ fontSize: 11, color: "#5A6B92", fontWeight: 600 }}>支援レポート · 2026年Q1</div>
        <div style={{ fontWeight: 800, fontSize: 20, marginTop: 4, marginBottom: 18 }}>あなたの参加が届けたもの</div>

        <div style={{ background: "#FFEFD2", borderRadius: 18, padding: 20, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 11, color: "#A36500", fontWeight: 700 }}>還元総額</div>
              <div style={{ fontFamily: "'Plus Jakarta Sans'", fontSize: 32, fontWeight: 800, color: "#002D7A", letterSpacing: "-.02em" }}>¥ 18,400</div>
            </div>
            <Icon name="handshake" size={42} bgColor="#FFA801" color="#fff" />
          </div>
          <div style={{ fontSize: 12, color: "#A36500" }}>= 教材セット6個 + ノート40冊</div>
        </div>

        <div className="sup-meter">
          <div className="sup-meter-label"><span>教材セット</span><span style={{ color: "#5A6B92" }}>6 / 10</span></div>
          <div className="sup-meter-track"><div className="sup-meter-fill" style={{ width: "60%" }}></div></div>
        </div>
        <div className="sup-meter">
          <div className="sup-meter-label"><span>文房具</span><span style={{ color: "#5A6B92" }}>40 / 50</span></div>
          <div className="sup-meter-track"><div className="sup-meter-fill yellow" style={{ width: "80%" }}></div></div>
        </div>
        <div className="sup-meter">
          <div className="sup-meter-label"><span>図書寄贈</span><span style={{ color: "#5A6B92" }}>2 / 5</span></div>
          <div className="sup-meter-track"><div className="sup-meter-fill blue" style={{ width: "40%" }}></div></div>
        </div>

        <div style={{ marginTop: 16, padding: 14, background: "#EEF4FF", borderRadius: 14, display: "flex", gap: 10 }}>
          <Icon name="chat" size={32} bgColor="#0043C3" color="#fff" />
          <div style={{ fontSize: 12, lineHeight: 1.6, color: "#002D7A" }}>
            <strong>ケニアの学校より:</strong> 新しい英語の絵本が届きました。子どもたちが毎日読んでいます。
          </div>
        </div>
      </div>
    </div>
  );
}

function WaitlistMiniMock() {
  return (
    <div className="mock-card">
      <div className="mock-header">
        <span className="mock-dot r"></span><span className="mock-dot y"></span><span className="mock-dot g"></span>
        <div className="mock-url">worldclass.app/waiting-list</div>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 11, color: "#5A6B92", fontWeight: 600 }}>ウェイティングリスト登録</div>
        <div style={{ fontWeight: 800, fontSize: 20, marginTop: 4 }}>リリース通知を受け取る</div>
        <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
          <div style={{ background: "#EEF4FF", borderRadius: 14, padding: "12px 16px", fontSize: 13, color: "#5A6B92" }}>example@email.com</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["図書館", "公民館", "個人塾", "保護者"].map((t, i) => (
              <span key={t} style={{ padding: "7px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: i === 0 ? "#002D7A" : "#EEF4FF", color: i === 0 ? "#fff" : "#002D7A" }}>{t}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["文化交流", "英語学習", "SDGs", "国際理解"].map((t, i) => (
              <span key={t} style={{ padding: "7px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: i === 0 || i === 2 ? "#FF651E" : "#EEF4FF", color: i === 0 || i === 2 ? "#fff" : "#002D7A" }}>{t}</span>
            ))}
          </div>
        </div>
        <button style={{ marginTop: 18, width: "100%", background: "#FF651E", color: "#fff", height: 46, borderRadius: 999, fontWeight: 700, fontSize: 14 }}>
          リリース時に通知を受け取る →
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  HeroMock, CatalogMock, SessionListMock, BookingMock, DashboardMock, SupportReportMock, WaitlistMiniMock,
});
