require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const { createServer } = require("http");
const { Server } = require("socket.io");

const {
  ensureInitialized,
  findUserByEmail,
  findUserById,
  findUserByGoogleId,
  createUser,
  updateUser
} = require("./lib/userStore");

const app = express();
const server = createServer(app);
const io = new Server(server);

app.set("trust proxy", 1);

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "exam-proctoring-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production"
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await findUserById(id);
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        const user = await findUserByEmail(email);

        if (!user || !user.password) {
          return done(null, false, { message: "Invalid email or password." });
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          return done(null, false, { message: "Invalid email or password." });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET);

if (googleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback"
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await findUserByGoogleId(profile.id);

          if (!user && profile.emails?.[0]?.value) {
            user = await findUserByEmail(profile.emails[0].value);
          }

          if (!user) {
            user = await createUser({
              displayName: profile.displayName || profile.username || "Google User",
              email: profile.emails?.[0]?.value || `${profile.id}@google.local`,
              password: null,
              provider: "google",
              googleId: profile.id
            });
          } else if (!user.googleId) {
            user = await updateUser(user.id, {
              googleId: profile.id,
              provider: "google"
            });
          }

          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.redirect("/login");
}

function renderPage(req, options = {}) {
  const title = options.title || "ProctorAI";
  const body = options.body || "";
  const currentPath = options.currentPath || "/";

  const isLoggedIn = req.isAuthenticated ? req.isAuthenticated() : false;

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root{
      --bg:#060816;
      --panel:#0f172a;
      --panel-2:#131d33;
      --text:#f8fafc;
      --muted:#94a3b8;
      --line:rgba(255,255,255,.12);
      --accent:#7c3aed;
      --accent-2:#22d3ee;
      --success:#34d399;
      --warning:#fbbf24;
      --danger:#fb7185;
      --shadow:0 20px 60px rgba(2,8,23,.45);
      --radius:24px;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;
      color:var(--text);
      background:
        radial-gradient(circle at top left, rgba(34,211,238,.18), transparent 28%),
        radial-gradient(circle at top right, rgba(124,58,237,.22), transparent 25%),
        linear-gradient(120deg,#060816 0%,#0b1122 45%,#0f172a 100%);
      min-height:100vh;
      overflow-x:hidden;
    }
    .orb{
      position:fixed;
      pointer-events:none;
      filter:blur(90px);
      opacity:.35;
      z-index:0;
    }
    .orb.one{width:280px;height:280px;top:-80px;left:-80px;background:#22d3ee}
    .orb.two{width:320px;height:320px;right:-120px;top:140px;background:#7c3aed}
    .orb.three{width:260px;height:260px;bottom:-100px;left:20%;background:#fb7185}
    .shell{position:relative;z-index:2;max-width:1280px;margin:0 auto;padding:24px 20px 60px}
    .topbar{
      position:sticky;top:0;z-index:10;
      display:flex;align-items:center;justify-content:space-between;
      padding:16px 20px;
      margin:16px auto 24px;
      max-width:1280px;
      border:1px solid var(--line);
      background:rgba(6,8,22,.7);
      backdrop-filter:blur(18px);
      border-radius:999px;
      box-shadow:var(--shadow);
    }
    .brand{
      display:flex;align-items:center;gap:10px;
      color:var(--text);text-decoration:none;font-weight:800;letter-spacing:.02em;
      font-size:1.08rem;
    }
    .brand-badge{
      width:38px;height:38px;border-radius:12px;display:grid;place-items:center;
      background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 10px 24px rgba(34,211,238,.22);
      font-weight:900;
    }
    .nav-links{display:flex;gap:12px;flex-wrap:wrap}
    .nav-links a{
      color:var(--muted);text-decoration:none;padding:8px 12px;border-radius:999px;transition:.2s ease;
      font-size:.95rem;
    }
    .nav-links a:hover,.nav-links a.active{color:var(--text);background:rgba(255,255,255,.07)}
    .btn{
      padding:12px 16px;border:none;border-radius:999px;font-weight:700;
      color:white;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;
      cursor:pointer;transition:transform .2s ease, box-shadow .2s ease, background .2s ease;
    }
    .btn:hover{transform:translateY(-2px)}
    .btn-primary{background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 16px 30px rgba(34,211,238,.18)}
    .btn-secondary{background:rgba(255,255,255,.08);color:var(--text);border:1px solid var(--line)}
    .card{
      background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03));
      border:1px solid var(--line);
      box-shadow:var(--shadow);
      border-radius:var(--radius);
      backdrop-filter:blur(18px);
    }
    .hero{
      display:grid;grid-template-columns:1.1fr .9fr;gap:24px;align-items:center;padding:32px;
      margin-bottom:24px;
    }
    .eyebrow{
      display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;
      background:rgba(255,255,255,.08);color:#cbd5e1;font-size:.84rem;margin-bottom:16px;
      border:1px solid var(--line);
    }
    h1,h2,h3,p{margin:0}
    .hero h1{font-size:clamp(2rem,4.5vw,3.4rem);line-height:1.05;margin-bottom:16px}
    .hero p{color:var(--muted);font-size:1.04rem;line-height:1.75;max-width:600px}
    .hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}
    .hero-panel{padding:24px}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:20px}
    .stat{padding:16px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
    .stat .value{font-size:1.35rem;font-weight:800}
    .stat .label{font-size:.86rem;color:var(--muted);margin-top:6px}
    .features{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:24px}
    .feature{padding:22px}
    .feature .icon{
      width:44px;height:44px;border-radius:14px;display:grid;place-items:center;
      background:linear-gradient(135deg,var(--accent),var(--accent-2));margin-bottom:16px;font-size:1.15rem
    }
    .feature h3{font-size:1.05rem;margin-bottom:10px}
    .feature p{color:var(--muted);line-height:1.7;font-size:.95rem}
    .grid{display:grid;grid-template-columns:1.1fr .9fr;gap:20px}
    .panel{padding:24px}
    .panel-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
    .muted{color:var(--muted)}
    .form-group{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
    label{font-size:.92rem;color:#cbd5e1}
    input,select,textarea{
      width:100%;padding:13px 14px;border-radius:14px;border:1px solid var(--line);
      background:rgba(255,255,255,.04);color:var(--text);outline:none;
    }
    input:focus,select:focus,textarea:focus{border-color:rgba(34,211,238,.6);box-shadow:0 0 0 4px rgba(34,211,238,.12)}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .pill{
      display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;
      background:rgba(255,255,255,.06);border:1px solid var(--line);color:#dbeafe;font-size:.9rem
    }
    .table{width:100%;border-collapse:collapse;overflow:hidden;border-radius:14px}
    .table th,.table td{padding:13px 12px;border-bottom:1px solid var(--line);text-align:left}
    .table th{color:#cbd5e1;font-size:.82rem;text-transform:uppercase;letter-spacing:.08em}
    .status{display:inline-flex;padding:7px 10px;border-radius:999px;font-size:.8rem;font-weight:700}
    .status.good{background:rgba(52,211,153,.16);color:#6ee7b7}
    .status.warn{background:rgba(251,191,36,.16);color:#fde68a}
    .status.danger{background:rgba(251,113,133,.16);color:#fda4af}
    .chip{display:inline-flex;padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.06);color:#e2e8f0;border:1px solid var(--line)}
    .list{display:grid;gap:10px}
    .list-item{padding:14px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
    .footer{
      text-align:center;color:var(--muted);padding:24px 16px 8px;font-size:.92rem;
      border-top:1px solid rgba(255,255,255,.08);margin-top:34px
    }
    .alert{
      padding:16px 18px;border-radius:16px;border:1px solid rgba(251,113,133,.28);background:rgba(251,113,133,.12);
      color:#fecdd3;margin-bottom:16px
    }
    .hero-card{
      padding:24px;border-radius:24px;background:
        linear-gradient(135deg,rgba(124,58,237,.3),rgba(34,211,238,.18));
      border:1px solid var(--line);
      min-height:330px;display:flex;flex-direction:column;justify-content:space-between;
    }
    .metric-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px}
    .metric{padding:14px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid var(--line)}
    .metric strong{display:block;font-size:1.2rem;margin-bottom:4px}
    @media (max-width: 960px){
      .hero,.grid,.features{grid-template-columns:1fr}
      .topbar{border-radius:24px}
      .nav-links{display:none}
    }
    @media (max-width: 640px){
      .shell{padding:16px 14px 40px}
      .topbar{padding:14px 16px}
      .hero{padding:22px}
      .stats,.metric-grid,.row{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
  <div class="orb one"></div>
  <div class="orb two"></div>
  <div class="orb three"></div>

  <div class="shell">
    <header class="topbar">
      <a class="brand" href="/">
        <span class="brand-badge">P</span>
        <span>ProctorAI</span>
      </a>

      <nav class="nav-links">
        <a class="${currentPath === '/' ? 'active' : ''}" href="/">Home</a>
        <a class="${currentPath === '/exam' ? 'active' : ''}" href="/exam">Exam</a>
        <a class="${currentPath === '/student-dashboard' ? 'active' : ''}" href="/student-dashboard">Student</a>
        <a class="${currentPath === '/admin-dashboard' ? 'active' : ''}" href="/admin-dashboard">Admin</a>
        <a class="${currentPath === '/reports' ? 'active' : ''}" href="/reports">Reports</a>
        ${isLoggedIn ? `<a href="/logout">Logout</a>` : `<a class="${currentPath === '/login' ? 'active' : ''}" href="/login">Login</a>`}
      </nav>
    </header>

    ${body}

    <footer class="footer">
      ProctorAI • Smart proctoring for modern assessments • Built for secure, human-centered exams
    </footer>
  </div>
</body>
</html>
`;
}

app.get("/", (req, res) => {
  const body = `
    <section class="hero card">
      <div>
        <div class="eyebrow">● Trusted AI exam integrity platform</div>
        <h1>Protect every assessment with premium proctoring.</h1>
        <p>Monitor sessions, detect anomalies, and deliver reliable exam experiences with a polished, enterprise-grade workflow designed for modern education and certification programs.</p>

        <div class="hero-actions">
          <a class="btn btn-primary" href="/register">Create account</a>
          <a class="btn btn-secondary" href="/login">Sign in</a>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="value">99.8%</div>
            <div class="label">Session stability</div>
          </div>
          <div class="stat">
            <div class="value">24/7</div>
            <div class="label">Live monitoring</div>
          </div>
          <div class="stat">
            <div class="value">4.9/5</div>
            <div class="label">Instructor satisfaction</div>
          </div>
        </div>
      </div>

      <div class="hero-card">
        <div>
          <div class="pill">● Real-time incident tracking</div>
          <h2 style="margin-top:14px;font-size:1.7rem">Live visibility for every exam room.</h2>
          <p style="margin-top:10px;color:rgba(255,255,255,.8);line-height:1.75">
            See suspicious behavior, review flags, and manage interventions from a single elegant control center.
          </p>
        </div>
        <div class="metric-grid">
          <div class="metric">
            <strong>1.2k+</strong>
            <span>Active sessions</span>
          </div>
          <div class="metric">
            <strong>38 ms</strong>
            <span>Alert response</span>
          </div>
          <div class="metric">
            <strong>92%</strong>
            <span>Auto-resolution</span>
          </div>
          <div class="metric">
            <strong>100%</strong>
            <span>Audit-ready logs</span>
          </div>
        </div>
      </div>
    </section>

    <section class="features">
      <article class="feature card">
        <div class="icon">⚡</div>
        <h3>Instant insights</h3>
        <p>Track violations, suspicious behavior, and engagement changes in real time with a clean intelligence dashboard.</p>
      </article>
      <article class="feature card">
        <div class="icon">🛡️</div>
        <h3>Secure by design</h3>
        <p>Built around modern authentication, encrypted sessions, and reliable user identity handling.</p>
      </article>
      <article class="feature card">
        <div class="icon">📊</div>
        <h3>Actionable reports</h3>
        <p>Turn every incident into a clear report for administrators, auditors, and instructional teams.</p>
      </article>
    </section>
  `;
  res.send(renderPage(req, { title: "ProctorAI | Secure Exam Platform", body, currentPath: "/" }));
});

app.get("/login", (req, res) => {
  const body = `
    <section class="grid">
      <div class="card panel">
        <div class="eyebrow">● Secure sign-in</div>
        <h2 style="font-size:1.7rem;margin-bottom:10px">Welcome back</h2>
        <p class="muted" style="line-height:1.7">Access monitoring tools, review sessions, and manage exam integrity workflows.</p>

        <form method="post" action="/login" style="margin-top:22px">
          <div class="form-group">
            <label>Email address</label>
            <input name="email" placeholder="you@institution.edu" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input name="password" type="password" placeholder="Enter your password" />
          </div>
          <button class="btn btn-primary" style="width:100%;margin-top:8px">Sign in</button>
        </form>

        <div style="margin-top:16px">
          <a class="btn btn-secondary" style="width:100%" href="/auth/google">Continue with Google</a>
        </div>

        <p class="muted" style="margin-top:16px">No account yet? <a href="/register" style="color:#7dd3fc">Create one</a></p>
      </div>

      <div class="card panel">
        <div class="eyebrow">● Why teams choose ProctorAI</div>
        <div class="list" style="margin-top:14px">
          <div class="list-item">
            <strong>Live incident monitoring</strong>
            <div class="muted" style="margin-top:6px">Detect suspicious activity instantly and react quickly.</div>
          </div>
          <div class="list-item">
            <strong>Professional reporting</strong>
            <div class="muted" style="margin-top:6px">Export summaries and keep evidence ready for review.</div>
          </div>
          <div class="list-item">
            <strong>Modern experience</strong>
            <div class="muted" style="margin-top:6px">A premium workflow that feels calm, polished, and reliable.</div>
          </div>
        </div>
      </div>
    </section>
  `;
  res.send(renderPage(req, { title: "Login | ProctorAI", body, currentPath: "/login" }));
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login?error=1"
  }),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

app.get("/register", (req, res) => {
  const body = `
    <section class="grid">
      <div class="card panel">
        <div class="eyebrow">● Create account</div>
        <h2 style="font-size:1.7rem;margin-bottom:10px">Start monitoring with confidence</h2>
        <p class="muted" style="line-height:1.7">Build a secure account for instructors, admins, and assessment teams in minutes.</p>

        <form method="post" action="/register" style="margin-top:22px">
          <div class="form-group">
            <label>Full name</label>
            <input name="displayName" placeholder="Alex Morgan" />
          </div>
          <div class="row">
            <div class="form-group">
              <label>Email</label>
              <input name="email" placeholder="alex@school.edu" />
            </div>
            <div class="form-group">
              <label>Password</label>
              <input name="password" type="password" placeholder="Create a strong password" />
            </div>
          </div>
          <button class="btn btn-primary" style="width:100%;margin-top:10px">Create account</button>
        </form>
      </div>

      <div class="card panel">
        <div class="eyebrow">● Included with every account</div>
        <div class="list" style="margin-top:14px">
          <div class="list-item">
            <strong>Secure authentication</strong>
            <div class="muted" style="margin-top:6px">Local login and optional Google OAuth support.</div>
          </div>
          <div class="list-item">
            <strong>Role-based access</strong>
            <div class="muted" style="margin-top:6px">Separate admin, instructor, and student experiences.</div>
          </div>
          <div class="list-item">
            <strong>Modern reporting</strong>
            <div class="muted" style="margin-top:6px">Clear audit trails for every flagged event.</div>
          </div>
        </div>
      </div>
    </section>
  `;
  res.send(renderPage(req, { title: "Register | ProctorAI", body, currentPath: "/register" }));
});

app.post("/register", async (req, res, next) => {
  try {
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password;
    const displayName = req.body?.displayName?.trim() || email;

    if (!email || !password) {
      return res.status(400).send("Email and password are required.");
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).send("User already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await createUser({
      displayName,
      email,
      password: hashedPassword,
      provider: "local"
    });

    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.redirect("/dashboard");
    });
  } catch (err) {
    next(err);
  }
});

app.get("/auth/google", (req, res, next) => {
  if (!googleConfigured) {
    return res.status(500).send("Google OAuth is not configured.");
  }
  return passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login?error=google"
  }),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy(() => {
      res.redirect("/");
    });
  });
});

app.get("/dashboard", ensureAuthenticated, (req, res) => {
  const body = `
    <section class="card panel">
      <div class="panel-header">
        <div>
          <div class="eyebrow">● Student dashboard</div>
          <h2 style="font-size:1.6rem;margin-top:8px">Welcome back, ${req.user.displayName || req.user.email}</h2>
        </div>
        <a class="btn btn-primary" href="/exam">Start exam</a>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="value">4</div>
          <div class="label">Upcoming exams</div>
        </div>
        <div class="stat">
          <div class="value">96%</div>
          <div class="label">Exam readiness</div>
        </div>
        <div class="stat">
          <div class="value">0</div>
          <div class="label">Violations</div>
        </div>
      </div>

      <div class="grid" style="margin-top:18px">
        <div class="card panel">
          <div class="panel-header">
            <h3>Today’s schedule</h3>
            <span class="chip">Live</span>
          </div>
          <div class="list">
            <div class="list-item">
              <strong>Mathematics Final</strong>
              <div class="muted" style="margin-top:6px">09:00 – 10:30 • Room 4A</div>
            </div>
            <div class="list-item">
              <strong>Logic Assessment</strong>
              <div class="muted" style="margin-top:6px">13:00 – 14:00 • Virtual</div>
            </div>
          </div>
        </div>

        <div class="card panel">
          <div class="panel-header">
            <h3>Compliance status</h3>
            <span class="status good">Secure</span>
          </div>
          <div class="list">
            <div class="list-item">
              <strong>Camera check</strong>
              <div class="muted" style="margin-top:6px">Ready</div>
            </div>
            <div class="list-item">
              <strong>Microphone check</strong>
              <div class="muted" style="margin-top:6px">Ready</div>
            </div>
            <div class="list-item">
              <strong>Browser lock</strong>
              <div class="muted" style="margin-top:6px">Enabled</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
  res.send(renderPage(req, { title: "Dashboard | ProctorAI", body, currentPath: "/student-dashboard" }));
});

app.get("/student-dashboard", ensureAuthenticated, (req, res) => {
  res.redirect("/dashboard");
});

app.get("/exam", ensureAuthenticated, (req, res) => {
  const body = `
    <section class="grid">
      <div class="card panel">
        <div class="eyebrow">● Exam session</div>
        <h2 style="font-size:1.6rem;margin:10px 0">Advanced Mathematics Assessment</h2>
        <p class="muted" style="line-height:1.7">You are currently in a monitored exam environment. Please keep your camera and microphone enabled throughout the session.</p>

        <div class="card" style="margin-top:18px;padding:18px;background:rgba(255,255,255,.05)">
          <div class="panel-header">
            <h3>Question 4 of 12</h3>
            <span class="chip">Time remaining: 18:42</span>
          </div>
          <p style="margin-top:8px;line-height:1.75">Solve the equation: 3x + 7 = 22</p>
          <div class="form-group" style="margin-top:16px">
            <label>Your answer</label>
            <input placeholder="Type your answer" />
          </div>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#">Submit answer</a>
            <a class="btn btn-secondary" href="#">Flag for review</a>
          </div>
        </div>
      </div>

      <div class="card panel">
        <div class="panel-header">
          <h3>Session controls</h3>
          <span class="status good">Monitoring active</span>
        </div>

        <div class="list">
          <div class="list-item">
            <strong>Camera status</strong>
            <div class="muted" style="margin-top:6px">Connected</div>
          </div>
          <div class="list-item">
            <strong>Microphone status</strong>
            <div class="muted" style="margin-top:6px">Connected</div>
          </div>
          <div class="list-item">
            <strong>Browser lock</strong>
            <div class="muted" style="margin-top:6px">Enabled</div>
          </div>
          <div class="list-item">
            <strong>Live flag count</strong>
            <div class="muted" style="margin-top:6px">2 pending reviews</div>
          </div>
        </div>
      </div>
    </section>
  `;
  res.send(renderPage(req, { title: "Exam | ProctorAI", body, currentPath: "/exam" }));
});

app.get("/admin-dashboard", ensureAuthenticated, (req, res) => {
  const body = `
    <section class="card panel">
      <div class="panel-header">
        <div>
          <div class="eyebrow">● Admin dashboard</div>
          <h2 style="font-size:1.6rem;margin-top:8px">Oversight center</h2>
        </div>
        <a class="btn btn-primary" href="/reports">View reports</a>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="value">132</div>
          <div class="label">Active candidates</div>
        </div>
        <div class="stat">
          <div class="value">11</div>
          <div class="label">Flags today</div>
        </div>
        <div class="stat">
          <div class="value">3</div>
          <div class="label">High risk</div>
        </div>
      </div>

      <div class="card" style="margin-top:18px;padding:18px">
        <table class="table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Session</th>
              <th>Risk</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Naomi T.</td>
              <td>Math Final</td>
              <td><span class="status warn">Medium</span></td>
              <td>Review pending</td>
            </tr>
            <tr>
              <td>Arjun P.</td>
              <td>Logic Exam</td>
              <td><span class="status danger">High</span></td>
              <td>Escalated</td>
            </tr>
            <tr>
              <td>Lisa M.</td>
              <td>Science Test</td>
              <td><span class="status good">Low</span></td>
              <td>Normal</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
  res.send(renderPage(req, { title: "Admin | ProctorAI", body, currentPath: "/admin-dashboard" }));
});

app.get("/reports", ensureAuthenticated, (req, res) => {
  const body = `
    <section class="card panel">
      <div class="panel-header">
        <div>
          <div class="eyebrow">● Reports</div>
          <h2 style="font-size:1.6rem;margin-top:8px">Incident reports</h2>
        </div>
        <a class="btn btn-secondary" href="/violations">Violation alerts</a>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="value">18</div>
          <div class="label">Reports generated</div>
        </div>
        <div class="stat">
          <div class="value">87%</div>
          <div class="label">Resolved</div>
        </div>
        <div class="stat">
          <div class="value">6</div>
          <div class="label">Pending review</div>
        </div>
      </div>

      <div class="card" style="margin-top:18px;padding:18px">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Candidate</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>2026-06-09</td>
              <td>Background noise</td>
              <td>Emma K.</td>
              <td><span class="status warn">Warning</span></td>
            </tr>
            <tr>
              <td>2026-06-09</td>
              <td>Multiple faces</td>
              <td>John A.</td>
              <td><span class="status danger">Escalated</span></td>
            </tr>
            <tr>
              <td>2026-06-08</td>
              <td>Tab switch</td>
              <td>Grace R.</td>
              <td><span class="status good">Cleared</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
  res.send(renderPage(req, { title: "Reports | ProctorAI", body, currentPath: "/reports" }));
});

app.get("/violations", ensureAuthenticated, (req, res) => {
  const body = `
    <section class="card panel">
      <div class="eyebrow">● Alert center</div>
      <h2 style="font-size:1.6rem;margin:10px 0">Warning and violation screen</h2>
      <div class="alert">
        <strong>Attention required:</strong> The system flagged repeated tab switching during the active exam session.
      </div>

      <div class="grid">
        <div class="card panel">
          <div class="panel-header">
            <h3>Alert details</h3>
            <span class="status danger">High priority</span>
          </div>
          <div class="list">
            <div class="list-item">
              <strong>Candidate</strong>
              <div class="muted" style="margin-top:6px">John A.</div>
            </div>
            <div class="list-item">
              <strong>Detected at</strong>
              <div class="muted" style="margin-top:6px">09:14 AM</div>
            </div>
            <div class="list-item">
              <strong>Suggested action</strong>
              <div class="muted" style="margin-top:6px">Issue warning and continue monitoring</div>
            </div>
          </div>
        </div>

        <div class="card panel">
          <div class="panel-header">
            <h3>Recommended response</h3>
            <span class="chip">Manual review</span>
          </div>
          <div class="hero-actions" style="margin-top:10px">
            <a class="btn btn-primary" href="/reports">Open report</a>
            <a class="btn btn-secondary" href="/admin-dashboard">Return to admin</a>
          </div>
        </div>
      </div>
    </section>
  `;
  res.send(renderPage(req, { title: "Violations | ProctorAI", body, currentPath: "/violations" }));
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/me", ensureAuthenticated, (req, res) => {
  res.json(req.user);
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Internal server error");
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-room", (room) => {
    socket.join(room);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

async function start() {
  await ensureInitialized();
  const port = process.env.PORT || 3001;

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
