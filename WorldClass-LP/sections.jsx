// sections.jsx — All static page sections except hero and waitlist form (those live in app.jsx).

// ============ Section: Founding Story ============
function StorySection() {
  return (
    <section className="section" id="story" style={{ background: "var(--cream)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 80, right: -40, opacity: 0.55 }} className="spin-slow"><DonutScallop size={180} color="#FFA801" /></div>
      <div style={{ position: "absolute", bottom: 120, left: -30, opacity: 0.5 }} className="float-anim"><ScallopCircle size={150} color="#FF651E" /></div>
      <div style={{ position: "absolute", top: 160, left: "42%" }}><Sparkle4 size={32} color="#FF651E" /></div>
      <div style={{ position: "absolute", bottom: 180, right: "38%" }}><Star6 size={28} color="#0043C3" /></div>

      <div className="container relative">
        <div className="story-shell">
          <div className="story-side">
            <span className="eyebrow eyebrow-yellow"><span className="eyebrow-dot"></span>なぜつくるのか · Our Story</span>
            <h2 className="display-lg mt-4">留学だけが、<br/>世界を知る方法じゃない。</h2>

            <p className="lead mt-6" style={{ maxWidth: 380 }}>
              発展途上国の教育現場で活動してきた私たちが、日本のご家庭にも届けたい体験について。
            </p>

            <div className="story-chip-row">
              <span className="story-chip"><span className="story-chip-dot" style={{ background: "var(--orange)" }}></span>ケニア</span>
              <span className="story-chip"><span className="story-chip-dot" style={{ background: "var(--yellow)" }}></span>チュニジア</span>
              <span className="story-chip muted-chip">で活動してきた創業チーム</span>
            </div>
          </div>

          <div className="story-body">
            <div className="story-quote-mark">“</div>
            <p>私たちは海外ボランティアとして、<strong>発展途上国で教育活動を行ってきました</strong>。そこで感じたのは、子どもたちが海外や異文化に触れる機会の少なさでした。</p>
            <p>しかしそれは、<strong>日本でも同じかもしれません。</strong></p>

            <ul className="story-list">
              <li><span className="story-list-mark"></span>英語を学んでいても、実際に海外の同世代と話す機会は少ない。</li>
              <li><span className="story-list-mark"></span>世界に興味を持つきっかけがない。</li>
              <li><span className="story-list-mark"></span>「海外」は、まだ遠い存在のまま。</li>
            </ul>

            <p>だから私たちは、<strong>“家庭にいながら世界とつながれる体験”を作りたいと思いました。</strong></p>
            <p className="story-close">留学だけが、世界を知る方法ではない。<br/>子どもたちがもっと自然に、世界へ興味を持てる未来を目指しています。</p>

            <div className="story-sign">
              <Logo size={28} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>WorldClass 創業チーム</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ Section: Experience Preview (体験イメージ) ============
function ExperienceSection() {
  const beats = [
    {
      t: "0:00",
      title: "リビングで、画面を開く。",
      body: "ノートPC一台でOK。接続は裏でスタッフがサポートします。保護者の準備はほぼゼロ。",
      shape: <ScallopCircle size={130} color="#FFE3D2" />,
      accent: <Sparkle4 size={28} color="#FF651E" style={{ position: "absolute", top: 18, right: 18 }} />,
      tag: "準備",
    },
    {
      t: "0:03",
      title: "画面の向こうに、現地の友だち。",
      body: "ケニアの教室から「ジャンボ！」。進行役が日英で橋渡し、最初の「こんにちは」がちゃんと伝わります。",
      shape: <StarBurst size={130} color="#D6E6FF" petals={12} />,
      accent: <Asterisk8 size={28} color="#0043C3" style={{ position: "absolute", top: 18, right: 18 }} />,
      tag: "挨拶",
    },
    {
      t: "0:15",
      title: "テーマで話す。例えば「学校の一日」。",
      body: "「徒歩で学校まで二時間」「えっ、日本と違う、興味ある」。教科書ではなく、相手の日常を感じる時間。",
      shape: <Flower5 size={130} color="#FFD98C" />,
      accent: <Star6 size={28} color="#FFA801" style={{ position: "absolute", top: 18, right: 18 }} />,
      tag: "トーク",
    },
    {
      t: "0:45",
      title: "「また会おうね」で、終わる。",
      body: "「次は何を話そう？」。次回が待ち遠しくなる、そんな45分です。",
      shape: <Blob size={130} color="#FFA801" />,
      accent: <Mwave size={48} color="#FF651E" style={{ position: "absolute", top: 18, right: 18 }} />,
      tag: "振り返り",
    },
  ];

  const changes = [
    {
      before: "「海外」は、遠い話。",
      after: "「ケニアのアミナちゃん」が住んでいる国。",
    },
    {
      before: "英語は、試験のための勉強。",
      after: "「伝わったら嬉しい」言葉に、変わる。",
    },
    {
      before: "ニュースの貧困は、他人事。",
      after: "「自分にもできることがある」と思える。",
    },
    {
      before: "「見たことない」が、怖さ。",
      after: "「見たことない」が、ワクワクに。",
    },
  ];

  return (
    <section className="section" id="experience" style={{ background: "var(--paper)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 100, left: -40 }} className="float-anim"><DonutScallop size={140} color="#D6E6FF" /></div>
      <div style={{ position: "absolute", bottom: 80, right: -30 }} className="float-anim"><Blob size={120} color="#FFD98C" /></div>

      <div className="container relative">
        <div className="sect-head">
          <span className="eyebrow"><span className="eyebrow-dot"></span>体験イメージ · What happens</span>
          <h2 className="display-lg mt-4">45分、リビングで<br/>起きること。</h2>
          <p>「どんなことをするの？」「何が起きるの？」に、できるだけ具体的にお答えします。これは創業チームが設計しているテスト交流の一例です。</p>
        </div>

        <div className="exp-track">
          {beats.map((b, i) => (
            <article key={i} className="exp-card">
              <div className="exp-shape">{b.shape}</div>
              {b.accent}
              <div className="exp-time">
                <span className="exp-time-dot"></span>
                <span>{b.t}</span>
                <span className="exp-tag">{b.tag}</span>
              </div>
              <h3>{b.title}</h3>
              <p>{b.body}</p>
            </article>
          ))}
        </div>

        <div className="exp-change-head">
          <div>
            <span className="eyebrow eyebrow-orange"><span className="eyebrow-dot"></span>こうして、子どもは変わる</span>
            <h3 className="display-md mt-4">1回を重ねたとき、<br/>見える世界が広くなる。</h3>
          </div>
          <p className="muted" style={{ maxWidth: 380, fontSize: 15, lineHeight: 1.8 }}>
            一回で1個、「遠い」が「近い」に変わる。WorldClass が目指しているのは、その小さな振り幅を、何度も重ねられる場所です。
          </p>
        </div>

        <div className="exp-change-grid">
          {changes.map((c, i) => (
            <div key={i} className="exp-change">
              <div className="exp-change-row before">
                <span className="exp-change-label">BEFORE</span>
                <span className="exp-change-text">{c.before}</span>
              </div>
              <div className="exp-change-arrow">
                <svg width="20" height="20" viewBox="0 0 20 20"><path d="M 10 3 L 10 17 M 4 11 L 10 17 L 16 11" stroke="#FF651E" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className="exp-change-row after">
                <span className="exp-change-label after">AFTER</span>
                <span className="exp-change-text strong">{c.after}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ Section 2: Problem ============
function ProblemSection() {
  const problems = [
    {
      num: "課題 01",
      title: "英語を使う\n実践機会が少ない",
      body: "授業で英語を学んでも、海外の同年代と話す機会はほとんどありません。「使えない英語」のまま卒業してしまう不安を、多くの教育現場が抱えています。",
      shape: <ScallopCircle size={180} color="#FFE3D2" />,
      accent: <Sparkle4 size={36} color="#FF651E" style={{ position: "absolute", bottom: 24, right: 24 }} />,
    },
    {
      num: "課題 02",
      title: "国際理解教育を\nリアルに体験しづらい",
      body: "教科書や動画では伝わりきらない「現地の暮らしの温度」。発展途上国を遠い話題のままで終わらせず、子どもたちの目で確かめる機会が足りていません。",
      shape: <StarBurst size={170} color="#D6E6FF" petals={12} />,
      accent: <Asterisk8 size={32} color="#0043C3" style={{ position: "absolute", bottom: 24, right: 24 }} />,
    },
    {
      num: "課題 03",
      title: "SDGsを学んでも\n行動につながらない",
      body: "「知っている」と「自分ごと」のあいだには大きな距離があります。学びが行動に変わる小さな成功体験を、地域でも家庭でも提供しにくいのが現状です。",
      shape: <Flower5 size={170} color="#FFD98C" />,
      accent: <Star6 size={32} color="#FFA801" style={{ position: "absolute", bottom: 24, right: 24 }} />,
    },
  ];
  return (
    <section className="section" id="problem">
      <div className="container">
        <div className="sect-head">
          <span className="eyebrow eyebrow-orange"><span className="eyebrow-dot"></span>いまの教育の課題</span>
          <h2 className="display-lg mt-4">学びが、世界に<br/>とどいていない。</h2>
          <p>日本の教育現場が共通して感じている3つの「もう一歩」。<br/>WorldClass は、ここを越えるための場所として企画されました。</p>
        </div>
        <div className="prob-grid">
          {problems.map((p, i) => (
            <article key={i} className="prob-card">
              <div className="shape-bg">{p.shape}</div>
              <div className="prob-num">{p.num}</div>
              <h3 style={{ whiteSpace: "pre-line" }}>{p.title}</h3>
              <p className="muted" style={{ fontSize: 15, lineHeight: 1.75 }}>{p.body}</p>
              {p.accent}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ Section 3: What we do (features) ============
function FeaturesSection() {
  const features = [
    { icon: "globe", title: "海外とオンラインで交流", body: "発展途上国の学校や現地の日本人と直接つながり、リアルな現地の暮らしや教育、日本との違いについて学べます。" },
    { icon: "book", title: "テーマ付き交流", body: "「学校生活」「水」「食」など、考えやすいテーマを用意。準備しなくても参加できます。" },
    { icon: "home", title: "地域施設でも導入しやすい", body: "回線とディスプレイがあれば実施可能。図書館や公民館の通常運営に組み込めます。" },
    { icon: "handshake", title: "参加が、そのまま支援に", body: "参加料金の一部を物資として現地施設へ届けます。学びと支援が同時に起きます。" },
  ];
  return (
    <section className="section" id="features" style={{ background: "var(--blue-pale)" }}>
      <div style={{ position: "absolute", top: 60, right: 80 }} className="float-anim"><DonutScallop size={120} color="#FFA801" /></div>
      <div style={{ position: "absolute", bottom: 100, left: 60 }} className="float-anim"><Blob size={90} color="#FF651E" /></div>

      <div className="container relative">
        <div className="sect-head">
          <span className="eyebrow"><span className="eyebrow-dot"></span>WorldClass でできること</span>
          <h2 className="display-lg mt-4">1交流で、3つの学び。</h2>
          <p>英語・国際理解・SDGs を、別々の科目として教えるのではなく、ひとつのリアルな対話のなかで体験してもらう設計です。</p>
        </div>
        <div className="feat-grid">
          {features.map((f, i) => (
            <article key={i} className="feat-card">
              <div className="feat-icon">
                <Icon name={f.icon} size={64} bgColor={["#D6E6FF", "#FFEFD2", "#FFE3D2", "#FFD98C"][i]} color={["#0043C3", "#A36500", "#FF651E", "#A36500"][i]} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ Section 4: How it works (steps) ============
function StepsSection() {
  const [tab, setTab] = React.useState("now");
  const flows = {
    now: [
      { t: "先行登録する", b: "メールアドレスと利用者区分を選んで送信。30秒で完了します。" },
      { t: "サービス開始のお知らせを受け取る", b: "サービス公開時、いち早くご案内します。優先案内ありです。" },
      { t: "興味のあるテーマを選ぶ", b: "文化交流、英語、国際理解。気になるところから。" },
      { t: "海外とオンライン交流", b: "スタッフのサポートつき。準備物は最小限です。" },
    ],
    future: [
      { t: "施設・人物を選ぶ", b: "カタログから話を聞きたい施設や人物を選択。国・地域やテーマで絞り込めます。" },
      { t: "テーマを選ぶ", b: "用意されたカリキュラムから選ぶか、独自テーマを相談できます。" },
      { t: "日時を決める", b: "空きカレンダーから希望枠を選択。" },
      { t: "交流を実施", b: "オンラインで現地とつながり、リアルタイムで交流。" },
      { t: "支援レポートを受け取る", b: "あなたの参加が何に変わったかを、写真と数字で確認できます。" },
    ],
  };
  const cur = flows[tab];
  return (
    <section className="section" id="steps">
      <div className="container">
        <div className="sect-head">
          <span className="eyebrow eyebrow-yellow"><span className="eyebrow-dot"></span>使い方の流れ</span>
          <h2 className="display-lg mt-4">むずかしくは、しません。</h2>
          <p>「IT機器に強い人がいないと無理かも」と感じる必要はありません。WorldClass は、地域の現場の手数を増やさないことを設計の前提にしています。</p>
        </div>

        <div className="steps-tabs">
          <button className={`steps-tab ${tab === "now" ? "active" : ""}`} onClick={() => setTab("now")}>いま参加する流れ</button>
          <button className={`steps-tab ${tab === "future" ? "active" : ""}`} onClick={() => setTab("future")}>サービス開始後の流れ</button>
        </div>

        <div className="steps-grid" style={{ "--cols": cur.length }}>
          {cur.map((s, i) => (
            <div key={i} className="step-card">
              <div className="step-num">{i + 1}</div>
              <h3>{s.t}</h3>
              <p>{s.b}</p>
              {i < cur.length - 1 && (
                <svg style={{ position: "absolute", right: -18, top: "50%", transform: "translateY(-50%)", display: "none" }} width="20" height="20" viewBox="0 0 20 20" className="step-arrow">
                  <path d="M 4 10 L 16 10 M 12 6 L 16 10 L 12 14" stroke="#002D7A" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ Section 5: UI showcase ============
function UIShowcaseSection() {
  return (
    <section className="section" id="ui" style={{ background: "var(--ink)", color: "#fff", overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: 80, right: -40 }} className="spin-slow"><DonutScallop size={200} color="#0043C3" /></div>
      <div style={{ position: "absolute", bottom: 100, left: -40 }} className="spin-slow"><ScallopCircle size={220} color="#0059FF" /></div>
      <div style={{ position: "absolute", top: 200, left: "45%" }}><Sparkle4 size={48} color="#FFA801" /></div>
      <div style={{ position: "absolute", bottom: 240, right: "30%" }}><Star6 size={36} color="#FF651E" /></div>

      <div className="container relative">
        <div className="sect-head center" style={{ color: "#fff" }}>
          <span className="eyebrow" style={{ background: "rgba(255,255,255,0.08)", color: "#FFD98C" }}><span className="eyebrow-dot"></span>プロダクトを覗いてみる</span>
          <h2 className="display-lg mt-4" style={{ color: "#fff" }}>「ちゃんとしてそう」と<br/>感じてもらう、UIから。</h2>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>企画段階だからこそ、見た目と使い心地は手を抜きません。これは現在検討中のプロダクト画面のプレビューです。サービス開始時の最終仕様とは異なる場合があります。</p>
        </div>

        <div className="mt-12" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24 }}>
          <div><CatalogMock /></div>
          <div style={{ display: "grid", gap: 24 }}>
            <DashboardMock />
          </div>
        </div>

        <div className="mt-12" style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 24 }}>
          <BookingMock />
          <SupportReportMock />
        </div>

        <div className="mt-12" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 24 }}>
          <SessionListMock />
          <WaitlistMiniMock />
        </div>

        <div className="mt-12 text-center">
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginBottom: 18 }}>※ プロダクトUIは企画中・順次デザイン更新予定です。</p>
          <a href="#waitlist" className="btn btn-orange btn-lg">最新版の案内を受け取る →</a>
        </div>
      </div>
    </section>
  );
}

// ============ Section 7: Audience cards ============
function AudienceSection() {
  const audiences = [
    {
      label: "FOR FAMILIES",
      title: "保護者",
      icon: "family",
      bg: "#F3D9F1",
      iconBg: "#002D7A",
      iconColor: "#fff",
      body: "家庭学習の延長として参加しやすい設計。\nお子さんと一緒に、リビングから世界とつながれます。",
      tags: ["自宅から", "短時間", "親子で"],
    },
    {
      label: "FOR JUKU",
      title: "個人塾",
      icon: "school",
      bg: "#FFE3D2",
      iconBg: "#FF651E",
      iconColor: "#fff",
      body: "英語・国際理解の差別化メニューとして。\n大手塾にはない特別感のあるカリキュラムを提供できます。",
      tags: ["差別化", "英語強化", "受験以外の価値"],
    },
    {
      label: "FOR LIBRARIES",
      title: "図書館/公民館",
      icon: "library",
      bg: "var(--cream)",
      iconBg: "#FFD98C",
      iconColor: "#A36500",
      body: "地域の学びイベントとして活用。\n本のテーマと連動した国際交流プログラムを定期開催できます。",
      tags: ["週末イベント", "テーマ連動", "親子参加"],
    },
    {
      label: "FOR COMMUNITY",
      title: "大学サークル/学生団体",
      icon: "home",
      bg: "var(--blue-soft)",
      iconBg: "#0043C3",
      iconColor: "#fff",
      body: "海外大学生との交流や異文化イベントを、もっと気軽に。\n国際交流企画や学内イベントとして、学生主体で活用できます。",
      tags: ["国際交流", "学生企画", "異文化交流"],
    },
  ];
  return (
    <section className="section" id="audience" style={{ background: "var(--paper)" }}>
      <div className="container">
        <div className="sect-head">
          <span className="eyebrow"><span className="eyebrow-dot"></span>対象ユーザー</span>
          <h2 className="display-lg mt-4">それぞれの現場に、<br/>ちょうどいいかたちで。</h2>
          <p>WorldClass は、ひとつの使い方を押しつけません。家庭、塾、図書館、公民館それぞれが普段通りのペースで取り入れられる柔軟性を大切にしています。</p>
        </div>

        <div className="aud-grid">
          {audiences.map((a, i) => (
            <article key={i} className="aud-card" style={{ background: a.bg }}>
              <div>
                <Icon name={a.icon} size={56} bgColor={a.iconBg} color={a.iconColor} />
                <div style={{ marginTop: 22 }}>
                  <div className="aud-label">{a.label}</div>
                  <h3>{a.title}</h3>
                </div>
                <p className="muted" style={{ whiteSpace: "pre-line", marginTop: 8, color: "rgba(0,45,122,0.7)" }}>{a.body}</p>
              </div>
              <div className="aud-tags">
                {a.tags.map((t) => <span key={t} className="aud-tag">{t}</span>)}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ Section 8: Values / characteristic ============
function ValueSection() {
  const values = [
    { icon: "chat", title: "実践的な英語体験", body: "教科書ではなく、本物の同年代との対話。文法より「通じた」の体験を最初に届けます。", shape: <ScallopCircle size={70} color="#FFE3D2" /> },
    { icon: "globe", title: "国際理解を深める学び", body: "「遠い国」を「友だちのいる国」に変える。情報ではなく、関係から世界を理解します。", shape: <Star6 size={60} color="#D6E6FF" /> },
    { icon: "sparkles", title: "SDGsを行動につなげる仕組み", body: "知って終わりにしない。あなたの参加そのものが、世界の課題に対する小さな行動になります。", shape: <Sparkle4 size={50} color="#FFD98C" /> },
    { icon: "heart", title: "物資支援につながる社会性", body: "料金の一部を現地校への教材・文房具支援に回します。何にどう使われたかをレポートで返します。", shape: <Blob size={70} color="#FFA801" /> },
    { icon: "home", title: "家庭や地域施設でも参加しやすい", body: "特別な設備・運営知識は不要。普段の運営のなかに、すっと組み込める設計です。", shape: <Flower5 size={60} color="#F3D9F1" /> },
    { icon: "calendar", title: "オンラインで完結する手軽さ", body: "現地への渡航も、人を呼ぶ準備もいりません。インターネット越しに、本物が来ます。", shape: <DonutScallop size={70} color="#FF651E" /> },
  ];
  return (
    <section className="section" id="values">
      <div className="container">
        <div className="sect-head">
          <span className="eyebrow eyebrow-orange"><span className="eyebrow-dot"></span>WorldClass の特徴</span>
          <h2 className="display-lg mt-4">やさしく、誠実に、<br/>長く使えるものを。</h2>
        </div>
        <div className="value-grid">
          {values.map((v, i) => (
            <article key={i} className="value-card">
              <div style={{ position: "absolute", top: -10, right: -10, opacity: 0.5 }}>{v.shape}</div>
              <div className="vc-icon">
                <Icon name={v.icon} size={56} bgColor={["#D6E6FF", "#FFE3D2", "#FFEFD2", "#FFD98C", "#F3D9F1", "#D6E6FF"][i]} color={["#0043C3", "#FF651E", "#A36500", "#A36500", "#002D7A", "#0043C3"][i]} />
              </div>
              <h3>{v.title}</h3>
              <p>{v.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ Section 9: Pricing ============
function PricingSection() {
  const [plan, setPlan] = React.useState("indiv");

  const corpRows = [
    { dur: "45分", base: "8,000", opt: "+2,500", total: "10,500" },
    { dur: "60分", base: "10,000", opt: "+3,000", total: "13,000" },
  ];
  const indivRows = [
    { dur: "45分", base: "2,500", note: "進行役込み" },
    { dur: "60分", base: "3,000", note: "進行役込み" },
  ];

  return (
    <section className="section" id="pricing" style={{ position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 80, right: 60 }} className="float-anim"><Sparkle4 size={42} color="#FFA801" /></div>
      <div style={{ position: "absolute", bottom: 120, left: 60 }}><Asterisk8 size={36} color="#FF651E" /></div>

      <div className="container">
        <div className="sect-head">
          <span className="eyebrow eyebrow-yellow"><span className="eyebrow-dot"></span>料金と還元のしくみ · 検討中</span>
          <h2 className="display-lg mt-4">いただいた料金の半分は、<br/>現地施設の物資支援になります。</h2>
          <p>料金プランは現在検討中です。ここでは現時点の「考えていること」をそのままお見せします。確定情報は先行登録者からご案内します。</p>
        </div>

        {/* Plan toggle */}
        <div className="steps-tabs">
          <button className={`steps-tab ${plan === "indiv" ? "active" : ""}`} onClick={() => setPlan("indiv")}>一般参加プラン</button>
          <button className={`steps-tab ${plan === "corp" ? "active" : ""}`} onClick={() => setPlan("corp")}>プライベート交流</button>
        </div>

        {plan === "corp" ? (
          <div className="price-grid">
            <div className="price-table-card">
              <div className="price-table-head">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: ".1em", textTransform: "uppercase" }}>For large groups</div>
                  <div style={{ fontWeight: 800, fontSize: 22, marginTop: 4 }}>プライベート交流</div>
                </div>
                <span className="price-pill">交流単位</span>
              </div>
              <table className="price-table">
                <thead>
                  <tr>
                    <th>時間</th>
                    <th>基本料金</th>
                    <th>進行役</th>
                    <th className="hl">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {corpRows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.dur}</td>
                      <td>¥ {r.base}</td>
                      <td className="muted-cell">{r.opt}</td>
                      <td className="hl"><strong>¥ {r.total}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="price-note">
                ※1回あたり ・進行役は日英通訳と司会進行を担当(任意オプション)
              </div>
            </div>

            <div className="price-breakdown">
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.7 }}>プライベート交流について</div>
              <h3 style={{ fontSize: 22, marginTop: 8 }}>地域施設や教育現場でも、もっと気軽に世界とつながれるように。</h3>
              <p className="muted" style={{ marginTop: 10, fontSize: 14, lineHeight: 1.75 }}>
                WorldClassでは、塾・サークル・図書館・公民館などの団体向け国際交流プログラムを準備しています。「海外交流に興味はあるけれど、企画や運営が難しい」そんな現場でも導入しやすい形を目指しています。
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "grid", gap: 10 }}>
                <li style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                  <Icon name="check" size={20} />
                  <span>学年・目的・テーマに合わせて交流内容をカスタマイズ可能</span>
                </li>
                <li style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                  <Icon name="check" size={20} />
                  <span>参加年齢に応じた柔軟なプログラム設計に対応予定</span>
                </li>
                <li style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                  <Icon name="check" size={20} />
                  <span>一般参加プラン同様、物資支援プールへの還元を予定</span>
                </li>
              </ul>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.7, marginTop: 24  }}>例 ¥10,000 (60分・基本) の内訳</div>
              <div className="break-bar">
                <div className="break-seg blue" style={{ flex: 1 }}>
                  <div className="break-label">運営手数料</div>
                  <div className="break-val">¥5,000<span>50%</span></div>
                </div>
                <div className="break-seg orange" style={{ flex: 1 }}>
                  <div className="break-label">物資支援プール</div>
                  <div className="break-val">¥5,000<span>50%</span></div>
                </div>
              </div>
              <div className="break-detail">
                <div className="break-detail-item">
                  <Icon name="check" size={22} />
                  <div>
                    <strong>運営手数料(50%)</strong>
                    <p className="muted">プラットフォーム維持、現地校との調整、品質管理に使用</p>
                  </div>
                </div>
                <div className="break-detail-item">
                  <Icon name="handshake" size={22} bgColor="#FFD98C" color="#A36500" />
                  <div>
                    <strong>物資支援プール(50%)</strong>
                    <p className="muted">教材・文房具・図書として現地校へ届け、レポートで還元先を報告</p>
                  </div>
                </div>
              </div>

              <div className="break-fac">
                <Icon name="user" size={28} bgColor="#FFE3D2" color="#FF651E" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 14 }}>進行役オプション料金</strong>
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2, lineHeight: 1.6 }}>追加料金は全額(100%)スタッフ稼働コストに使用。物資支援プールには含めません。</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="price-grid">
            <div className="price-table-card">
              <div className="price-table-head">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: ".1em", textTransform: "uppercase" }}>For everyone</div>
                  <div style={{ fontWeight: 800, fontSize: 22, marginTop: 4 }}>一般参加プラン(相乗り)</div>
                </div>
                <span className="price-pill orange">1グループあたり</span>
              </div>
              <table className="price-table">
                <thead>
                  <tr>
                    <th>時間</th>
                    <th>料金(仮)</th>
                    <th className="hl">進行役</th>
                  </tr>
                </thead>
                <tbody>
                  {indivRows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.dur}</td>
                      <td><strong>¥ {r.base}</strong> <span className="muted-cell">/ グループ</span></td>
                      <td className="hl">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="price-note">
                ※3グループ以上で開催 ・進行役は常時参加(追加料金なし)
              </div>
            </div>

            <div className="price-breakdown" style={{ background: "var(--cream)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.7 }}>一般参加プランについて</div>
              <h3 style={{ fontSize: 22, marginTop: 8 }}>1人から参加できる、世界の窓。</h3>
              <p className="muted" style={{ marginTop: 10, fontSize: 14, lineHeight: 1.75 }}>
                保護者やお子さん個人でも、他のグループと相乗りで気軽に参加できる枠です。最少3グループから成立し、進行役が常時付くので「ひとりだと不安」という心配はありません。
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "grid", gap: 10 }}>
                <li style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                  <Icon name="check" size={20} />
                  <span>3〜8グループで成立する小規模交流</span>
                </li>
                <li style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                  <Icon name="check" size={20} />
                  <span>ご家族・友人みなさまでご参加いただけます</span>
                </li>
                <li style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                  <Icon name="check" size={20} />
                  <span>物資支援プールへの還元割合は法人と同じ設計を予定</span>
                </li>
              </ul>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.7, marginTop: 24 }}>例 ¥3,000 (60分) の内訳</div>
              <div className="break-bar">
                <div className="break-seg blue" style={{ flex: 1 }}>
                  <div className="break-label">運営手数料</div>
                  <div className="break-val">¥1,500<span>50%</span></div>
                </div>
                <div className="break-seg orange" style={{ flex: 1 }}>
                  <div className="break-label">物資支援プール</div>
                  <div className="break-val">¥1,500<span>50%</span></div>
                </div>
              </div>
              <div className="break-detail">
                <div className="break-detail-item">
                  <Icon name="check" size={22} />
                  <div>
                    <strong>運営手数料(50%)</strong>
                    <p className="muted">プラットフォーム維持、現地校との調整、品質管理に使用</p>
                  </div>
                </div>
                <div className="break-detail-item">
                  <Icon name="handshake" size={22} bgColor="#FFD98C" color="#A36500" />
                  <div>
                    <strong>物資支援プール(50%)</strong>
                    <p className="muted">教材・文房具・図書として現地校へ届け、レポートで還元先を報告</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="price-footer">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Icon name="bell" size={36} bgColor="#FFE3D2" color="#FF651E" />
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              <strong>料金は確定次第、先行登録者からご案内します。</strong><br/>
              <span className="muted">原価計算後に微調整があります。物資支援への還元設計は維持します。</span>
            </div>
          </div>
          <a href="#waitlist" className="btn btn-primary btn-sm">先行案内に登録</a>
        </div>
      </div>
    </section>
  );
}

// ============ Section 10: Roadmap ============
function RoadmapSection() {
  const roads = [
    { status: "now", label: "NOW", t: "企画 / 体験設計", b: "コア体験の設計と、パートナー校とのテーマすり合わせを進行中です。" },
    { status: "now", label: "NOW", t: "先行登録受付", b: "サービス開始の判断のために、関心度と利用シーンを集めています。" },
    { status: "next", label: "NEXT", t: "10カ国以上のパートナーと始動", b: "現地の教育機関/日本人と協働で初回の交流を設計します。" },
    { status: "next", label: "NEXT", t: "ベータ運用", b: "先行登録ユーザー向けに、小規模の交流を試験運用予定。" },
    { status: "future", label: "LATER", t: "サービス開始 / 拡大", b: "ベータの結果を踏まえてサービス開始。パートナー国・参加施設を順次拡大します。" },
  ];
  return (
    <section className="section" id="roadmap" style={{ background: "var(--blue-pale)" }}>
      <div style={{ position: "absolute", top: 100, right: 60 }} className="float-anim"><Mwave size={120} color="#FFA801" /></div>
      <div style={{ position: "absolute", bottom: 140, left: 80 }}><Arch size={140} color="#FFD98C" /></div>

      <div className="container relative">
        <div className="sect-head">
          <span className="eyebrow"><span className="eyebrow-dot"></span>これからの予定</span>
          <h2 className="display-lg mt-4">いま、ここから、<br/>つくっていきます。</h2>
          <p>実績はまだありません。代わりに、これからどう育てるかを開示します。WorldClass の成長は、最初のユーザーの皆さまの声で決まります。</p>
        </div>

        <div className="road-track">
          {roads.map((r, i) => (
            <article key={i} className="road-card">
              <span className={`road-status ${r.status}`}>{r.label}</span>
              <h3>{r.t}</h3>
              <p>{r.b}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ Section 11: FAQ ============
function FAQSection() {
  const [open, setOpen] = React.useState(0);
  const faqs = [
    {
      q: "もうサービスは始まっていますか？",
      a: "いいえ、WorldClass は現在企画段階のサービスです。このページの目的は、どれくらいニーズがあるかを測ることと、サービス開始時に通知をお届けすることです。実績数や導入校数を出していないのもそのためです。",
    },
    {
      q: "どんな人が対象ですか？",
      a: "初期の対象は、ご家庭や学生団体、塾、地域の図書館、公民館です。将来的には学校・自治体への展開も予定していますが、まずは「身近な学びの場」を整える方々にお使いいただけるよう設計しています。",
    },
    {
      q: "図書館や公民館でも使えますか？",
      a: "はい、はじめからその想定で設計しています。通常の運営に組み込みやすい時間設計、最小限の準備物、現地スタッフによるサポートなど、施設側の手数を増やさない仕様を目指しています。",
    },
    {
      q: "家からでも参加できますか？",
      a: "はい、家庭学習の延長としてご参加いただけます。短時間の交流から始められるよう設計しており、お子さんと一緒にリビングから参加できる気軽さを大切にしています。",
    },
    {
      q: "先行登録すると何が起こりますか？",
      a: "サービス開始のお知らせや特典クーポンのメールをお届けします。それに加えて、興味テーマや利用予定時期のご回答は、機能の優先順位を決めるための材料として使わせていただきます。あなたの登録が、サービスの方向性に直接影響します。",
    },
    {
      q: "料金はいくらくらいになりますか？",
      a: "料金プランは現在検討中です。確定しているのは「料金の一部を必ず現地校の物資支援に回す」という設計です。詳細は先行登録者の方へ、確定次第ご案内します。",
    },
  ];
  return (
    <section className="section" id="faq">
      <div className="container-narrow">
        <div className="sect-head center">
          <span className="eyebrow eyebrow-yellow"><span className="eyebrow-dot"></span>よくあるご質問</span>
          <h2 className="display-lg mt-4">気になることに、<br/>正直に答えます。</h2>
        </div>

        <div className="faq-list">
          {faqs.map((f, i) => (
            <div key={i} className="faq-item">
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                <span>{f.q}</span>
                <span className={`faq-q-mark ${open === i ? "open" : ""}`}>
                  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2 L 7 12 M 2 7 L 12 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </span>
              </button>
              {open === i && <div className="faq-a">{f.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ Section 12: Final CTA ============
function FinalCTASection() {
  return (
    <section className="section">
      <div className="container">
        <div className="final-cta">
          <div style={{ position: "absolute", top: 40, left: 60 }} className="float-anim"><ScallopCircle size={90} color="#FFA801" /></div>
          <div style={{ position: "absolute", top: 80, right: 80 }} className="float-anim"><Sparkle4 size={50} color="#FFD98C" /></div>
          <div style={{ position: "absolute", bottom: 60, left: 120 }} className="float-anim"><Star6 size={56} color="#FF651E" /></div>
          <div style={{ position: "absolute", bottom: 100, right: 120 }} className="float-anim"><Asterisk8 size={44} color="#FFD98C" /></div>
          <div style={{ position: "absolute", top: 200, left: 30 }}><Squiggle size={140} color="#0059FF" strokeWidth={10} /></div>
          <div style={{ position: "absolute", bottom: 200, right: 30 }}><Mwave size={120} color="#FFA801" /></div>

          <div style={{ position: "relative", zIndex: 2 }}>
            <span className="eyebrow" style={{ background: "rgba(255,255,255,0.1)", color: "#FFD98C" }}><span className="eyebrow-dot"></span>あなたの関心が、最初の一歩</span>
            <h2 className="display-xl mt-6" style={{ color: "#fff" }}>次の学びを、<br/>世界とつながる時間に。</h2>
            <p>まずは先行登録で、サービス開始のお知らせを受け取ってください。<br/>あなたの登録が、WorldClass を本当に立ち上げるための判断材料になります。</p>
          </div>

          <div className="final-cta-ctas">
            <a href="#waitlist" className="btn btn-orange btn-lg">先行登録する</a>
            <a href="#features" className="btn btn-lg" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)" }}>サービス概要をもう一度</a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ Footer ============
function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="nav-logo" style={{ marginBottom: 14 }}>
              <Logo size={36} />
              <span>WorldClass</span>
            </div>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 360 }}>
              日本国内のご家庭・学生団体・塾・地方施設と、発展途上国の学校をつなぐオンライン国際交流プラットフォーム。<br/>
              <span style={{ display: "inline-block", marginTop: 8, padding: "3px 10px", background: "var(--cream)", color: "#A36500", fontSize: 11, borderRadius: 999, fontWeight: 700 }}>企画段階 · プレサービス開始</span>
            </p>
          </div>
          <div>
            <div className="footer-title">SERVICE</div>
            <div className="footer-links">
              <a href="#features">できること</a>
              <a href="#steps">使い方</a>
              <a href="#pricing">料金</a>
            </div>
          </div>
          <div>
            <div className="footer-title">COMPANY</div>
            <div className="footer-links">
              <a href="#roadmap">ロードマップ</a>
              <a href="#audience">対象ユーザー</a>
              <a href="#faq">よくある質問</a>
            </div>
          </div>
          <div>
            <div className="footer-title">CONTACT</div>
            <div className="footer-links">
              <a href="#waitlist">先行登録</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 WorldClass · 学びと支援がつながる国際教育プラットフォーム</span>
          <a href="privacy.html" style={{ marginLeft: 16, textDecoration: "underline", opacity: 0.85 }}>プライバシーポリシー</a>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, {
  ProblemSection, StorySection, FeaturesSection, ExperienceSection, StepsSection, UIShowcaseSection,
  AudienceSection, ValueSection, PricingSection, RoadmapSection,
  FAQSection, FinalCTASection, Footer,
});
