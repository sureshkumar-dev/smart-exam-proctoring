# Real Time Online Exam Proctoring And Malpractice Detection System 

Production-style web application for online exam proctoring with manual auth and Google OAuth. No frontend frameworks (HTML, CSS, Vanilla JavaScript). Backend: Node.js, Express, SQLite, Socket.IO.

---

## Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript (no React, Vue, or other frameworks)
- **Backend:** Node.js with Express
- **Database:** SQLite
- **Real-time:** Socket.IO
- **Auth:** Manual (email + password) + Google OAuth
- **Sessions:** express-session with Passport

---

## Role Flow

When the application opens, users see a **landing page**. They must select a role:

1. **Admin** – Create exams, add questions (MCQ or text), generate keys, view reports, export CSV/JSON.
2. **Student** – Join exam with Student Exam Key, attempt questions, proctored session with camera/mic.
3. **Proctor** – Enter Proctor Key, view live students, receive real-time alerts, view evidence, terminate sessions.

After selecting a role, users **sign up** or **log in** (email/password or Google). The dashboard then redirects by role:

- Admin → `/admin/`
- Student → `/student/`
- Proctor → `/proctor/`

---

## Auth Flow

- **Authentication is required** for all roles.
- **Two options:**
  - **Manual:** Sign up with email, password, and role; log in with email and password.
  - **Google OAuth:** “Continue with Google” on login/signup. First-time Google users are created with role `student`; existing users are matched by email/google_id.
- **Sessions:** express-session keeps the user logged in. Passport serializes user by `id`; deserialize loads full user (id, email, role, auth_provider, display_name) from the database.
- **Stored in DB:** `users` table with `email`, `password_hash` (nullable for Google), `role`, `auth_provider` (`manual` or `google`), `google_id` (nullable).

---

## Exam & Key Usage

### Admin

- After login, Admin goes to **Admin Dashboard** (`/admin/`).
- **Create exam:** Enter exam title and duration (minutes). On create, the server generates:
  - **Student Exam Key** (e.g. `S-1234`)
  - **Proctor Key** (e.g. `P-1234`)
  - **Admin Key** (e.g. `A-1234`)
- Keys are shown on the UI and can be shared.
- **Add questions:** Per exam, add questions with type **MCQ** (options, one per line) or **text** (free text). Questions are stored in `questions` table.
- **View reports:** Select an exam and view “Report” – sessions, user email, status, malpractice score, violations, evidence.
- **Export:** Export report as **JSON** or **CSV**.

### Student

- After login, Student goes to **Student Dashboard** (`/student/`).
- **Enter Student Exam Key** (e.g. `S-1234`). Backend validates the key and creates a **session** (exam_id, user_id).
- Student clicks **Start Exam** → redirect to exam interface (`/student/exam.html?sessionId=...&examId=...`).
- **Exam interface:** Questions (MCQ or text), timer, malpractice score. **Camera and microphone permission are mandatory.** Proctoring starts automatically.
- Answers are saved via API (`POST /api/sessions/:id/answers`). Submit exam via “Submit Exam” (sets session status to `submitted`).

### Proctor

- After login, Proctor goes to **Proctor Dashboard** (`/proctor/`).
- **Enter Proctor Key** (e.g. `P-1234`). Backend validates key and returns exam id and title.
- **Dashboard:** Live list of active students (sessions for that exam), real-time malpractice alerts (Socket.IO), evidence (screenshots), and **Terminate** button per student to end that session manually.

---

## Proctoring Logic

- **Rule-based, AI-assisted** monitoring only. No deep learning, no face recognition.
- **Browser-based detections** (client-side in `exam.js`):
  - Tab switch
  - Window blur / focus loss
  - Fullscreen exit
  - Face presence (heuristic: motion/variance in center of video frame)
  - Face off-screen duration
  - Head movement (frame luminance change as proxy)
  - Noise detection (Web Audio API, level above threshold)
  - Camera/mic disabled (track state / getUserMedia failure)
  - Repeated violations escalation (many events in a short time window)
- **Scoring:** Each event type has a weight (e.g. tab_switch +20, no_face +25, multiple_faces +40, head_turned +15, noise_detected +15, fullscreen_exit +10). Server maintains **cumulative malpractice score** per session.
- **Auto-terminate:** When cumulative score ≥ 50 (configurable `CRITICAL_SCORE`), the server sets session status to `terminated` and emits `exam_terminated` to the student; the student UI shows “Exam Terminated”.
- **Evidence:** On violations, the client can capture a screenshot (canvas from video) and upload to `/api/evidence/upload`; path is stored in `evidence` table and broadcast to proctor via Socket.IO.

---

## Database (SQLite)

- **users** – id, email, password_hash, role, auth_provider, google_id, display_name, created_at
- **exams** – id, title, duration_minutes, student_key, proctor_key, admin_key, created_by, created_at
- **questions** – id, exam_id, type (mcq/text), question_text, options (JSON), correct_answer, order_index
- **sessions** – id, exam_id, user_id, status (active/terminated/submitted), malpractice_score, started_at, ended_at
- **session_answers** – id, session_id, question_id, answer_text, created_at
- **malpractice_events** – id, session_id, event_type, score_added, details, created_at
- **evidence** – id, session_id, event_id, file_path, created_at

---

## Setup & Run

1. **Install dependencies**
   ```bash
   cd exam-proctoring-app
   npm install
   ```

2. **Environment (optional)**  
   Copy `.env.example` to `.env` and set:
   - `SESSION_SECRET` – session secret
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` – for Google OAuth
   - `BASE_URL` – e.g. `http://localhost:3000` (for OAuth callback)

3. **Start server**
   ```bash
   npm start
   ```

4. **Open in browser**  
   `http://localhost:3000`

5. **First use**  
   - Sign up as **Admin** (email + password + role Admin).
   - Create an exam and add questions; note the generated keys.
   - Sign up as **Student** and use the Student Exam Key to join and start the exam.
   - Sign up as **Proctor** and use the Proctor Key to open the proctor dashboard.

---

## Project Structure

```
exam-proctoring-app/
  package.json
  server.js              # Express, session, Passport, Socket.IO, multer
  .env.example
  config/
    database.js          # SQLite init and helpers
    passport.js          # Local + Google OAuth strategies
  middleware/
    auth.js              # requireAuth, requireRole
  routes/
    auth.js              # signup, login, logout, /me, Google OAuth
    api.js               # exams, questions, validate-key, join-exam, sessions, reports, export
  public/
    index.html           # Landing + role selection
    login.html
    signup.html
    dashboard.html       # Redirect by role
    styles.css
    admin/
      index.html
      admin.js           # Create exam, questions, keys, reports, export
    student/
      index.html         # Join exam (key)
      student.js
      exam.html          # Exam UI + proctoring
      exam.js            # Questions, timer, detections, Socket.IO
    proctor/
      index.html         # Proctor key → dashboard
      proctor.js         # Live students, alerts, evidence, terminate
  uploads/               # Evidence screenshots (created at runtime)
  README.md
```
