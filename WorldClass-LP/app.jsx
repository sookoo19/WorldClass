// app.jsx — Mounts the page: Nav, Hero, Waitlist form, and assembles all sections.

function Nav() {
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <a href="#" className="nav-logo">
          <Logo size={32} />
          <span>WorldClass</span>
        </a>
        <div className="nav-links">
          <a href="#experience">体験イメージ</a>
          <a href="#features">できること</a>
          <a href="#audience">対象</a>
          <a href="#pricing">料金</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-cta">
          <a href="#waitlist" className="btn btn-orange btn-sm">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4 L 12 4 L 12 10 L 2 10 Z M 2 4 L 7 8 L 12 4" stroke="currentColor" strokeWidth="1.5" /></svg>
            先行登録
          </a>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="hero">
      {/* Background ornaments */}
      <div style={{ position: "absolute", top: 60, left: -40, opacity: 0.8 }} className="spin-slow"><DonutScallop size={140} color="#FFE3D2" /></div>
      <div style={{ position: "absolute", top: 140, right: 40 }}><Sparkle4 size={36} color="#FFA801" /></div>
      <div style={{ position: "absolute", bottom: 60, left: 100 }}><Mwave size={80} color="#FF651E" /></div>
      <div style={{ position: "absolute", bottom: 200, right: 80 }}><Star6 size={32} color="#0043C3" /></div>

      <div className="container relative">
        <div className="hero-grid">
          <div>
            <div className="hero-tag" style={{ marginBottom: 20 }}>
              <span>🎁 先着300名限定 · 特典クーポンプレゼント中</span>
            </div>

            <h1 className="display-xl">
              世界と<span className="accent">つながる</span>体験を、<br />
              家庭の日常に。
            </h1>

            {/* モバイルのみ表示: h1直後に画像 */}
            <div className="hero-img-mobile">
              <img
                src="uploads/Hero_image.png"
                alt="オンラインで世界の子どもたちと交流している様子"
                style={{ width: "100%", display: "block", borderRadius: 20 }}
              />
            </div>

            <p className="hero-sub">
              <strong style={{ color: "var(--ink)", fontWeight: 700 }}>発展途上国の子どもたち・現地で活動する日本人と、45分間ビデオ通話で対話できるサービスです。</strong><br/>
              ご家庭・塾・図書館から、現地と直接つながれます。<br />
              準備はほぼゼロ。進行スタッフが場をつくります。<br />
              あなたが払う料金の半分は、現地の教育施設へ届きます。<br />
              学ぶことが、そのまま支援になる。<br />
            </p>

            <div className="hero-ctas">
              <a href="#waitlist" className="btn btn-primary btn-lg">
                先行登録する
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8 L 13 8 M 9 4 L 13 8 L 9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
              <a href="#features" className="btn btn-outline btn-lg">サービス概要を見る</a>
            </div>

            <div className="hero-meta">
              <div className="hero-meta-item">
                <Icon name="check" size={22} />
                先行登録で特典クーポンをプレゼント
              </div>
              <div className="hero-meta-item">
                <Icon name="check" size={22} />
                サービス開始時に優先案内
              </div>
              <div className="hero-meta-item">
                <Icon name="check" size={22} />
                料金の半分が現地校へ
              </div>
              <div className="hero-meta-item">
                <Icon name="check" size={22} />
                日本人スタッフが進行をサポート
              </div>
            </div>
          </div>

          <div className="hero-stage">
            <img
              src="uploads/Hero_image.png"
              alt="オンラインで世界の子どもたちと交流している様子"
              style={{ width: "100%", display: "block", borderRadius: 24 }}
            />
          </div>
        </div>

        {/* Partner countries strip — the real, planned partner schools */}
        <div style={{ marginTop: 96, padding: "32px 0", borderTop: "1px dashed rgba(0,45,122,0.18)", borderBottom: "1px dashed rgba(0,45,122,0.18)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, color: "var(--orange)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--orange)" }}></span>
                Partner Countries
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 6 }}>
                提携予定パートナー
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { name: "ケニア", en: "Kenya", c: "#FF651E" },
                { name: "ブータン", en: "Bhutan", c: "#FFA801" },
                { name: "モロッコ", en: "Morocco", c: "#0043C3" },
                { name: "東ティモール", en: "Timor-Leste", c: "#FF651E" },
                { name: "ガーナ", en: "Ghana", c: "#FFA801" },
                { name: "チュニジア", en: "Tunisia", c: "#0043C3" },
              ].map((p) => (
                <div key={p.en} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px 10px 12px", background: "#fff", border: "1.5px solid rgba(0,45,122,0.1)", borderRadius: 999 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 99, background: p.c, color: "#fff", fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {p.en[0]}
                  </span>
                  <div style={{ lineHeight: 1.25 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: "var(--ink-soft)", fontFamily: "'Plus Jakarta Sans'", letterSpacing: ".06em" }}>{p.en.toUpperCase()}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "var(--blue-pale)", borderRadius: 999, fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>
                <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2 L 7 12 M 2 7 L 12 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                他、複数国と連携協議中
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ Waitlist (interactive) ============
function WaitlistSection() {
  const [email, setEmail] = React.useState("");
  const [userType, setUserType] = React.useState("");
  const [grade, setGrade] = React.useState("");           // 学年（「ご家庭」選択時のみ表示）
  const [themes, setThemes] = React.useState([]);
  const [timing, setTiming] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [honeypot, setHoneypot] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [cooldownUntil, setCooldownUntil] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());
  const [utmData, setUtmData] = React.useState({});       // 広告UTMパラメーター
  const formLoadedAt = React.useRef(Date.now());

  // UTMパラメーターをURLから取得（広告流入の識別に使用）
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setUtmData({
      utm_source: p.get("utm_source") || "",
      utm_medium: p.get("utm_medium") || "",
      utm_campaign: p.get("utm_campaign") || "",
      utm_content: p.get("utm_content") || "",
      utm_term: p.get("utm_term") || "",
    });
  }, []);

  // cooldown tick (only when needed)
  React.useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const COMMENT_MAX = 1000;

  const userTypes = ["ご家庭", "個人塾", "サークル団体", "公民館/図書館", "その他"];
  const gradeOptions = ["幼児・未就学", "小1〜3年", "小4〜6年", "中学生", "高校生以上"];
  const themeOptions = ["文化交流", "英語学習", "国際理解"];
  const timingOptions = ["できるだけ早く", "3ヶ月以内", "半年以内", "1年以内", "未定"];

  const toggleTheme = (t) => {
    setThemes(themes.includes(t) ? themes.filter((x) => x !== t) : [...themes, t]);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // cooldown guard (re-click after error / multi-tab)
    if (Date.now() < cooldownUntil) {
      const sec = Math.ceil((cooldownUntil - Date.now()) / 1000);
      setError(`連続送信を防ぐため、あと ${sec} 秒お待ちください`);
      return;
    }

    // honeypot — bot が埋めていたら黙って成功見せかけて終了
    if (honeypot) {
      setSubmitted(true);
      return;
    }

    // 高速送信検知（3秒未満に送信した人間はほぼいない）
    if (Date.now() - formLoadedAt.current < 3000) {
      setSubmitted(true);
      return;
    }

    if (!EMAIL_RE.test(email.trim())) {
      setError("有効なメールアドレスを入力してください");
      return;
    }
    if (!userType) {
      setError("利用者区分を選択してください");
      return;
    }
    if (userType === "ご家庭" && !grade) {
      setError("お子さんの学年を選択してください");
      return;
    }
    if (comment.length > COMMENT_MAX) {
      setError(`コメントは ${COMMENT_MAX} 文字以内でお願いします`);
      return;
    }

    setError("");
    setSubmitting(true);
    setCooldownUntil(Date.now() + 5000); // 5秒のクールダウン
    try {
      const res = await fetch("https://formspree.io/f/xeedrybk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          userType,
          grade: userType === "ご家庭" ? grade : "",   // ご家庭のみ学年を送信
          themes: themes.join(", "),
          timing,
          comment: comment.slice(0, COMMENT_MAX),
          ...utmData,                                   // UTMパラメーター（広告流入の識別）
          _subject: `[WorldClass] 先行登録: ${email.trim()}`,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        // Meta Pixel Lead イベント発火（広告最適化に必須）
        if (typeof window.fbq !== "undefined") {
          window.fbq("track", "Lead");
        }
      } else {
        let msg = "送信に失敗しました。時間をおいて再度お試しください。";
        try {
          const data = await res.json();
          if (data && data.errors && data.errors.length) {
            msg = data.errors.map((er) => er.message).join(" / ");
          }
        } catch (_) {}
        setError(msg);
      }
    } catch (err) {
      setError("ネットワークエラーが発生しました。接続を確認してください。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section" id="waitlist" style={{ background: "var(--paper)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 80, left: -30, opacity: 0.6 }} className="float-anim"><ScallopCircle size={180} color="#FFD98C" /></div>
      <div style={{ position: "absolute", bottom: 60, right: -40, opacity: 0.5 }} className="float-anim"><StarBurst size={200} color="#D6E6FF" /></div>
      <div style={{ position: "absolute", top: 200, right: 80 }}><Sparkle4 size={36} color="#FF651E" /></div>
      <div style={{ position: "absolute", bottom: 200, left: 80 }}><Asterisk8 size={32} color="#0043C3" /></div>

      <div className="container relative">
        <div className="waitlist-shell">
          <div className="waitlist-aside">
            <span className="eyebrow eyebrow-orange"><span className="eyebrow-dot"></span>このLPの主役 · Waiting List</span>
            <h2 className="display-lg mt-4">あなたの登録が、<br/>WorldClass を立ち上げます。</h2>
            <p className="lead mt-6">
              これは「申し込み」ではありません。
              サービス開始のお知らせを受け取ると同時に、どんな方が、どんなテーマに、いつ頃使いたいかを教えてください。
              いただいた回答は、サービス公開の判断と機能の優先順位に直接つながります。
            </p>

            <ul>
              <li>
                <span className="li-mark"><Icon name="bell" size={24} bgColor="#FFE3D2" color="#FF651E" /></span>
                <span><strong>サービス開始時にいち早くご案内します。</strong>登録順に優先枠でお声がけします。</span>
              </li>
              <li>
                <span className="li-mark"><Icon name="sparkles" size={24} bgColor="#FFD98C" color="#A36500" /></span>
                <span><strong>関心テーマを集計し、機能の優先順位を決めます。</strong>多かったテーマから先に整えます。</span>
              </li>
              <li>
                <span className="li-mark"><Icon name="handshake" size={24} bgColor="#D6E6FF" color="#0043C3" /></span>
                <span><strong>あなたの登録が、サービス開始の判断材料になります。</strong>需要が見えるほど、企画は前に進みます。</span>
              </li>
            </ul>

            <div style={{ marginTop: 32, padding: 20, background: "var(--blue-pale)", borderRadius: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
              <Icon name="check" size={28} />
              <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.7 }}>
                <strong>営業の連絡や、勝手なメルマガはしません。</strong><br/>
                <span className="muted">必要なご案内のみ、責任を持ってお届けします。</span>
              </div>
            </div>
          </div>

          {submitted ? (
            <div className="waitlist-form">
              <div className="success-state">
                <div className="success-mark">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="#FFA801" />
                    <path d="M 30 52 L 44 66 L 70 38" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="14" cy="20" r="3" fill="#FF651E" />
                    <circle cx="88" cy="22" r="2.5" fill="#0043C3" />
                    <circle cx="84" cy="78" r="3" fill="#FF651E" />
                    <circle cx="16" cy="80" r="2.5" fill="#0043C3" />
                  </svg>
                </div>
                <h3>登録ありがとうございます</h3>
                <p style={{ maxWidth: 380, margin: "0 auto" }}>
                  サービス開始時にいち早くお知らせします。<br/>
                  ご登録いただいたテーマの傾向は、機能の優先順位づけに必ず使わせていただきます。
                </p>
                <div style={{ marginTop: 32, padding: 20, background: "var(--cream)", borderRadius: 20, textAlign: "left", fontSize: 14, lineHeight: 1.7 }}>
                  <strong style={{ display: "block", marginBottom: 8 }}>あなたの登録内容</strong>
                  <span className="muted">メール:</span> {email}<br/>
                  <span className="muted">区分:</span> {userType}<br/>
                  {userType === "ご家庭" && grade && <><span className="muted">学年:</span> {grade}<br/></>}
                  {themes.length > 0 && <><span className="muted">興味テーマ:</span> {themes.join(", ")}<br/></>}
                  {timing && <><span className="muted">利用予定:</span> {timing}<br/></>}
                  {comment && <><span className="muted">コメント:</span> {comment}</>}
                </div>
                <button onClick={() => { setSubmitted(false); setEmail(""); setUserType(""); setGrade(""); setThemes([]); setTiming(""); setComment(""); }} className="btn btn-outline btn-sm" style={{ marginTop: 24 }}>
                  別のかたで登録する
                </button>
              </div>
            </div>
          ) : (
            <form className="waitlist-form" onSubmit={submit} noValidate>
              {/* honeypot — 人間には見えず bot が埋めるダミー */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
                <label>
                  Website (do not fill)
                  <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </label>
              </div>

              <div style={{ position: "absolute", top: -20, right: -20 }}>
                <Sparkle4 size={56} color="#FF651E" />
              </div>

              <div style={{ marginBottom: 28 }}>
                {/* 希少性バッジ：先着300名で特典クーポン */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#FFF3E0", color: "#A36500", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999, marginBottom: 10, border: "1px solid #FFD98C" }}>
                  🎁 先着300名限定 · 特典クーポンプレゼント中
                </div>
                <h3 style={{ fontSize: 22 }}>30秒で登録</h3>
                <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>必須項目は2つだけ。残りは任意です。</p>
              </div>

              <div className="field-group">
                <label className="field-label">メールアドレス<span className="req">*</span></label>
                <input
                  type="email"
                  className="field-input"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              <div className="field-group">
                <label className="field-label">利用者区分<span className="req">*</span></label>
                <div className="chip-row">
                  {userTypes.map((t) => (
                    <span key={t} className={`chip ${userType === t ? "active" : ""}`} onClick={() => { setUserType(t); setGrade(""); }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* 学年フィールド：「ご家庭」選択時のみ表示。広告セグメント配信に再利用する */}
              {userType === "ご家庭" && (
                <div className="field-group">
                  <label className="field-label">お子さんの学年<span className="req">*</span></label>
                  <div className="chip-row">
                    {gradeOptions.map((g) => (
                      <span key={g} className={`chip ${grade === g ? "active" : ""}`} onClick={() => setGrade(g)}>{g}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="field-group">
                <label className="field-label">興味テーマ<span style={{ fontWeight: 500, color: "var(--ink-soft)", marginLeft: 6 }}>(複数選択可)</span></label>
                <div className="chip-row">
                  {themeOptions.map((t) => (
                    <span key={t} className={`chip orange ${themes.includes(t) ? "active orange" : ""}`} onClick={() => toggleTheme(t)}>
                      {themes.includes(t) && (
                        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6 L 5 9 L 10 3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">利用予定時期</label>
                <div className="chip-row">
                  {timingOptions.map((t) => (
                    <span key={t} className={`chip yellow ${timing === t ? "active yellow" : ""}`} onClick={() => setTiming(t)}>{t}</span>
                  ))}
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">コメント<span style={{ fontWeight: 500, color: "var(--ink-soft)", marginLeft: 6 }}>(任意)</span></label>
                <textarea
                  className="field-textarea"
                  placeholder="どんな場面で使いたいか、気になる点など、自由にお書きください"
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
                  maxLength={COMMENT_MAX}
                />
              </div>

              {error && (
                <div style={{ background: "#FFE3D2", color: "#C03400", padding: "10px 14px", borderRadius: 12, fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
                  {error}
                </div>
              )}

              <button type="submit" className="btn btn-orange btn-lg" style={{ width: "100%", opacity: submitting ? 0.7 : 1, cursor: submitting ? "wait" : "pointer" }} disabled={submitting}>
                {submitting ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" style={{ animation: "spin 0.8s linear infinite" }}>
                      <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
                      <path d="M 10 2 A 8 8 0 0 1 18 10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    送信中...
                  </>
                ) : (
                  <>
                    <Icon name="bell" size={20} bgColor="rgba(255,255,255,0.2)" color="#fff" />
                    サービス開始時に通知を受け取る
                  </>
                )}
              </button>

              <p style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center", marginTop: 14, lineHeight: 1.7 }}>
                送信することで、<a href="privacy.html" style={{ color: "var(--ink)", textDecoration: "underline", fontWeight: 700 }}>プライバシーポリシー</a>に同意したものとみなします。
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ============ App ============
function App() {
  return (
    <>
      <Nav />
      <Hero />
      <ExperienceSection />
      <ProblemSection />
      <StorySection />
      <FeaturesSection />
      <AudienceSection />
      <ValueSection />
      <StepsSection />
      <PricingSection />
      <RoadmapSection />
      <FAQSection />
      <WaitlistSection />
      <FinalCTASection />
      <Footer />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
