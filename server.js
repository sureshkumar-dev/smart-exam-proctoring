





/**
 * AI-assisted Online Exam Proctoring - Production server.
 * Express, session, Passport (Local + Google OAuth), Socket.IO, SQLite, multer.
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { Server } = require('socket.io');
const db = require('./config/database');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const sessionId = req.body.sessionId || 'unknown';
    cb(null, 'session_' + sessionId + '_' + Date.now() + '.png');
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'proctoring-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

app.post('/api/evidence/upload', upload.single('screenshot'), async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    const eventId = req.body.eventId;
    const eventType = req.body.eventType || 'unknown';
    const details = req.body.details || '';
    const timestamp = req.body.timestamp || new Date().toISOString();
    const score = req.body.score || 0;

    if (!sessionId || !req.file) {
      return res.status(400).json({ error: 'sessionId and file required' });
    }

    const filePath = '/uploads/' + req.file.filename;

    await db.run(
      'INSERT INTO evidence (session_id, event_id, file_path, details) VALUES (?, ?, ?, ?)',
      [sessionId, eventId || null, filePath, details]
    );

    const session = await db.get(
      'SELECT exam_id FROM sessions WHERE id = ?',
      [sessionId]
    );

    if (session) {
      io.to('exam_' + session.exam_id).emit('new_evidence', {
        sessionId,
        filePath,
        eventType,
        details,
        timestamp,
        score
      });
    }

    res.json({
      success: true,
      filePath
    });

  } catch (err) {
    console.error('Evidence upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Catch-all for API routes - return JSON error instead of HTML
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Catch-all handler for unmatched routes - serve index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const SCORE_RULES = {
  // 🧠 Browser / System Behaviour
  tab_switch: 5,
  window_blur: 8,
  fullscreen_exit: 10,
  multiple_tab_open: 15,
  page_refresh_attempt: 12,
  back_forward_navigation: 10,
  new_browser_window: 15,
  devtools_open: 15,
  copy_paste_attempt: 10,
  right_click_usage: 5,

  // 🎥 Camera / Video Based
  no_face: 10,
  multiple_faces: 25,
  face_out_of_frame: 8,
  head_turned_away: 6,
  camera_disabled: 30,

  // 🎙️ Audio / Environment
  mic_disabled: 20,
  background_noise: 8,
  human_voice_detected: 15,

  // ⏱️ Behaviour / Pattern Based
  suspicious_idle: 10,
  rapid_answer_pattern: 12,

  // 🧠 NEW Behavior-Based Detections (BEHAVIOR source)
  paste_detected: 40,
  abnormal_typing_speed: 25,
  sudden_answer_after_inactivity: 30,
  tab_switch_before_answer: 15,

  // Existing/Other
  noise_detected: 8,
  rapid_tab_switch: 8,
  idle: 10,
  session_time: 8,
  face_off_duration: 10,
  head_movement: 2,
  face_too_far_close: 8,
  background_change: 8,
  multi_voice: 15,
  repeated_escalation: 8,
  manual_termination: 50,
  auto_termination: 50,
};
const CRITICAL_SCORE = 100; // Updated to 100 as requested

io.on('connection', (socket) => {
  socket.on('proctor_join', async (data) => {
    const { proctorKey, examId } = data || {};
    if (!proctorKey || !examId) return socket.emit('error', { message: 'proctorKey and examId required' });
    try {
      const exam = await db.get('SELECT * FROM exams WHERE proctor_key = ? AND id = ?', [proctorKey, examId]);
      if (!exam) return socket.emit('error', { message: 'Invalid proctor key or exam' });
      socket.join('exam_' + examId);
      socket.proctorExamId = examId;
      const active = await db.all('SELECT s.*, u.email, COALESCE(u.display_name, u.email) as student_name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.exam_id = ? AND s.status = ?', [examId, 'active']);
      socket.emit('active_students', active);
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('student_join_room', async (data) => {
    const { sessionId, examId } = data || {};
    if (!sessionId || !examId) return socket.emit('error', { message: 'sessionId and examId required' });
    socket.sessionId = sessionId;
    socket.examId = examId;
    socket.join('exam_' + examId);
    const sessionRow = await db.get('SELECT s.*, u.email, COALESCE(u.display_name, u.email) as student_name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ?', [sessionId]);
    if (sessionRow) {
      io.to('exam_' + examId).emit('student_joined', {
        id: sessionRow.id,
        user_id: sessionRow.user_id,
        email: sessionRow.email,
        student_name: sessionRow.student_name,
        malpractice_score: sessionRow.malpractice_score,
      });
    }
  });

  socket.on('detection', async (data) => {
    const { sessionId, examId, eventType, details, source } = data || {};
    if (!sessionId || !examId || !eventType) return;

    // Use socket-bound session ID for security (don't trust client-sent sessionId)
    const secureSessionId = socket.sessionId || sessionId;

    const scoreAdd = SCORE_RULES[eventType] != null ? SCORE_RULES[eventType] : 10;
    try {
      const sessionRow = await db.get('SELECT * FROM sessions WHERE id = ?', [secureSessionId]);
      if (!sessionRow || sessionRow.status !== 'active') return;
      const newScore = (sessionRow.malpractice_score || 0) + scoreAdd;

      // Include source in details if provided
      const enhancedDetails = details ?
        (source ? `${details} [Source: ${source}]` : details) :
        (source ? `Detection from ${source}` : null);

      await db.run('INSERT INTO malpractice_events (session_id, event_type, score_added, details) VALUES (?, ?, ?, ?)', [secureSessionId, eventType, scoreAdd, enhancedDetails || null]);
      await db.run('UPDATE sessions SET malpractice_score = ? WHERE id = ?', [newScore, secureSessionId]);
      const sessionWithUser = await db.get('SELECT s.*, u.email, COALESCE(u.display_name, u.email) as student_name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ?', [secureSessionId]);
      const payload = {
        sessionId: secureSessionId,
        email: sessionWithUser && sessionWithUser.email,
        student_name: sessionWithUser && sessionWithUser.student_name,
        eventType,
        scoreAdded: scoreAdd,
        totalScore: newScore,
        details: enhancedDetails,
      };
      io.to('exam_' + examId).emit('malpractice_alert', payload);
      if (newScore >= CRITICAL_SCORE) {
        console.log('=== AUTO-TERMINATING EXAM ===');
        console.log('Session ID:', secureSessionId);
        console.log('New Score:', newScore);
        console.log('Event Type:', eventType);
        console.log('Critical Score Threshold:', CRITICAL_SCORE);

        await db.run('UPDATE sessions SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?', ['terminated', secureSessionId]);

        const terminationData = {
          sessionId: secureSessionId,
          reason: 'score_threshold',
          totalScore: newScore,
          eventType: eventType
        };

        console.log('Broadcasting termination event:', terminationData);

        io.to('exam_' + examId).emit('exam_terminated', terminationData);
        socket.emit('exam_terminated', terminationData);

        console.log('=== AUTO-TERMINATION COMPLETE ===');
      }
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('evidence_uploaded', (data) => {
    const { examId, sessionId, filePath, eventType, details, timestamp, score } = data || {};
    console.log('Evidence uploaded event received:', data);
    if (examId) {
      const evidenceData = {
        sessionId,
        filePath,
        eventType: eventType || 'unknown',
        details: details || '',
        timestamp: timestamp || new Date().toISOString(),
        score: score || 0
      };
      console.log('Broadcasting evidence:', evidenceData);
      io.to('exam_' + examId).emit('new_evidence', evidenceData);
    }
  });

  socket.on('proctor_terminate', async (data) => {
    const { sessionId, examId, proctorKey } = data || {};
    if (!sessionId || !examId || !proctorKey) return;
    try {
      const exam = await db.get('SELECT * FROM exams WHERE proctor_key = ? AND id = ?', [proctorKey, examId]);
      if (!exam) return socket.emit('error', { message: 'Invalid proctor key' });
      await db.run('UPDATE sessions SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?', ['terminated', sessionId]);
      io.to('exam_' + examId).emit('exam_terminated', {
        sessionId,
        reason: 'manual_proctor',
        eventType: 'manual_termination'
      });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('student_leave', async () => {
    if (socket.examId && socket.sessionId) {
      const sessionRow = await db.get('SELECT * FROM sessions WHERE id = ?', [socket.sessionId]);
      if (sessionRow && sessionRow.status === 'active') {
        io.to('exam_' + socket.examId).emit('student_left', { id: socket.sessionId });
      }
    }
  });

  socket.on('disconnect', () => {
    if (socket.sessionId && socket.examId) {
      db.get('SELECT * FROM sessions WHERE id = ?', [socket.sessionId]).then((sessionRow) => {
        if (sessionRow && sessionRow.status === 'active') {
          io.to('exam_' + socket.examId).emit('student_left', { id: socket.sessionId });
        }
      }).catch(() => { });
    }
  });
});

db.initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log('AI Exam Proctoring server running on http://localhost:' + PORT);
    });
  })
  .catch((err) => {
    console.error('Failed to init DB:', err);
    process.exit(1);
  });
