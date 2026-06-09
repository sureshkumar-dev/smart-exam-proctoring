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

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (req, res) => {
  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Exam Proctoring App</title>
      </head>
      <body>
        <h1>Exam Proctoring App</h1>
        <p>Authentication and user storage now use JSON files.</p>
        <a href="/login">Login</a> |
        <a href="/register">Register</a>
      </body>
    </html>
  `);
});

app.get("/login", (req, res) => {
  res.send(`
    <h1>Login</h1>
    <form method="post" action="/login">
      <input name="email" placeholder="Email" />
      <input name="password" type="password" placeholder="Password" />
      <button>Login</button>
    </form>
    <a href="/auth/google">Login with Google</a>
    <br />
    <a href="/register">Register</a>
  `);
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
  res.send(`
    <h1>Register</h1>
    <form method="post" action="/register">
      <input name="displayName" placeholder="Name" />
      <input name="email" placeholder="Email" />
      <input name="password" type="password" placeholder="Password" />
      <button>Register</button>
    </form>
  `);
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
  res.send(`
    <h1>Dashboard</h1>
    <p>Welcome, ${req.user.displayName || req.user.email}</p>
    <a href="/logout">Logout</a>
  `);
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
