/**
 * API routes: exams, questions, keys validation, sessions, reports, export.
 * All routes require authentication and role where applicable.
 */

const express = require('express');
const db = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      auth_provider: req.user.auth_provider,
      display_name: req.user.display_name,
    },
  });
});

function getRoleForKey(key) {
  return db.get(
    'SELECT * FROM exams WHERE student_key = ? OR proctor_key = ? OR admin_key = ?',
    [key, key, key]
  ).then((exam) => {
    if (!exam) return { exam: null, role: null };
    if (exam.admin_key === key) return { exam, role: 'admin' };
    if (exam.proctor_key === key) return { exam, role: 'proctor' };
    if (exam.student_key === key) return { exam, role: 'student' };
    return { exam: null, role: null };
  });
}

router.get('/exams', requireAuth, requireRole('admin'), (req, res) => {
  db.all('SELECT * FROM exams WHERE created_by = ? ORDER BY created_at DESC', [req.user.id])
    .then((rows) => res.json(rows))
    .catch((e) => {
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.post('/exams', requireAuth, requireRole('admin'), (req, res) => {
  console.log('=== CREATE EXAM API REQUEST ===');
  console.log('User ID:', req.user.id);
  console.log('User Role:', req.user.role);
  console.log('User Email:', req.user.email);
  console.log('Request Body:', req.body);
  
  const { title, duration_minutes } = req.body;
  if (!title || !duration_minutes) {
    console.log('Returning 400 - Missing required fields');
    return res.status(400).json({ error: 'title and duration_minutes required' });
  }
  
  const studentKey = 'S-' + Math.floor(1000 + Math.random() * 9000);
  const proctorKey = 'P-' + Math.floor(1000 + Math.random() * 9000);
  const adminKey = 'A-' + Math.floor(1000 + Math.random() * 9000);
  
  console.log('Generated keys:', { studentKey, proctorKey, adminKey });
  console.log('Creating exam:', { title, duration_minutes: parseInt(duration_minutes, 10) });
  
  db.run(
    'INSERT INTO exams (title, duration_minutes, student_key, proctor_key, admin_key, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [title, parseInt(duration_minutes, 10), studentKey, proctorKey, adminKey, req.user.id]
  )
    .then((r) => {
      console.log('Exam created successfully with ID:', r.lastID);
      const response = {
        id: r.lastID,
        title,
        duration_minutes: parseInt(duration_minutes, 10),
        student_key: studentKey,
        proctor_key: proctorKey,
        admin_key: adminKey,
      };
      console.log('=== CREATE EXAM API RESPONSE ===');
      console.log('Response:', response);
      res.status(201).json(response);
    })
    .catch((e) => {
      console.error('Create exam error:', e);
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.get('/exams/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.get('SELECT * FROM exams WHERE id = ?', [id])
    .then((exam) => {
      if (!exam) return res.status(404).json({ error: 'Exam not found' });
      if (req.user.role !== 'admin' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Not allowed' });
      }
      res.json(exam);
    })
    .catch((e) => {
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.delete('/exams/:id', requireAuth, requireRole('admin'), (req, res) => {
  const examId = parseInt(req.params.id, 10);
  
  // First check if exam exists and user owns it
  db.get('SELECT * FROM exams WHERE id = ? AND created_by = ?', [examId, req.user.id])
    .then((exam) => {
      if (!exam) return res.status(404).json({ error: 'Exam not found or not authorized' });
      
      // Delete in proper order to maintain foreign key constraints
      return db.run('DELETE FROM evidence WHERE session_id IN (SELECT id FROM sessions WHERE exam_id = ?)', [examId])
        .then(() => db.run('DELETE FROM session_answers WHERE session_id IN (SELECT id FROM sessions WHERE exam_id = ?)', [examId]))
        .then(() => db.run('DELETE FROM malpractice_events WHERE session_id IN (SELECT id FROM sessions WHERE exam_id = ?)', [examId]))
        .then(() => db.run('DELETE FROM sessions WHERE exam_id = ?', [examId]))
        .then(() => db.run('DELETE FROM questions WHERE exam_id = ?', [examId]))
        .then(() => db.run('DELETE FROM exams WHERE id = ?', [examId]));
    })
    .then(() => {
      res.json({ success: true, message: 'Exam deleted successfully' });
    })
    .catch((e) => {
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.get('/exams/:id/questions', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  console.log('=== QUESTIONS API REQUEST ===');
  console.log('Exam ID:', id);
  console.log('User ID:', req.user.id);
  console.log('User Role:', req.user.role);
  console.log('User Email:', req.user.email);
  
  db.get('SELECT * FROM exams WHERE id = ?', [id])
    .then((exam) => {
      console.log('Exam found:', exam ? 'YES' : 'NO');
      if (exam) {
        console.log('Exam Title:', exam.title);
        console.log('Exam Created By:', exam.created_by);
      }
      
      if (!exam) {
        console.log('Returning 404 - Exam not found');
        return res.status(404).json({ error: 'Exam not found' });
      }
      
      if (req.user.role !== 'admin') {
        console.log('Student user - checking active session...');
        return db.get('SELECT id FROM sessions WHERE exam_id = ? AND user_id = ? AND status = ?', [id, req.user.id, 'active'])
          .then((session) => {
            console.log('Active session found:', session ? 'YES' : 'NO');
            if (session) {
              console.log('Session ID:', session.id);
            }
            if (!session) {
              console.log('Returning 403 - No active session');
              return res.status(403).json({ error: 'No active session for this exam' });
            }
            return db.all('SELECT id, exam_id, type, question_text, options, order_index FROM questions WHERE exam_id = ? ORDER BY order_index, id', [id]);
          })
          .then((rows) => {
            console.log('Questions found:', rows.length);
            if (rows.length === 0) {
              console.log('WARNING: No questions found for this exam');
            }
            console.log('=== QUESTIONS API RESPONSE ===');
            res.json(rows);
          });
      }
      
      console.log('Admin user - fetching all questions...');
      return db.all('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index, id', [id])
        .then((rows) => {
          console.log('Questions found:', rows.length);
          if (rows.length === 0) {
            console.log('WARNING: No questions found for this exam');
          }
          console.log('=== QUESTIONS API RESPONSE ===');
          res.json(rows);
        });
    })
    .catch((e) => {
      console.error('Questions API error:', e);
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.post('/exams/:id/questions', requireAuth, requireRole('admin'), (req, res) => {
  const examId = parseInt(req.params.id, 10);
  const { type, question_text, options, correct_answer, order_index } = req.body;
  if (!type || !question_text) return res.status(400).json({ error: 'type and question_text required' });
  const opts = options != null ? (typeof options === 'string' ? options : JSON.stringify(options)) : null;
  db.get('SELECT id FROM exams WHERE id = ? AND created_by = ?', [examId, req.user.id])
    .then((exam) => {
      if (!exam) return res.status(404).json({ error: 'Exam not found' });
      return db.run(
        'INSERT INTO questions (exam_id, type, question_text, options, correct_answer, order_index) VALUES (?, ?, ?, ?, ?, ?)',
        [examId, type, question_text, opts, correct_answer || null, order_index != null ? order_index : 0]
      );
    })
    .then((r) => res.status(201).json({ id: r.lastID, exam_id: examId, type, question_text }))
    .catch((e) => {
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.post('/exams/:id/questions/bulk', requireAuth, requireRole('admin'), (req, res) => {
  const examId = parseInt(req.params.id, 10);
  const questions = req.body.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'questions array required' });
  }
  db.get('SELECT id FROM exams WHERE id = ? AND created_by = ?', [examId, req.user.id])
    .then((exam) => {
      if (!exam) return res.status(404).json({ error: 'Exam not found' });
      let chain = Promise.resolve();
      questions.forEach((q, i) => {
        const type = q.type || 'text';
        const text = q.question_text || q.text || '';
        const opts = q.options != null ? (typeof q.options === 'string' ? q.options : JSON.stringify(q.options)) : null;
        chain = chain.then(() =>
          db.run(
            'INSERT INTO questions (exam_id, type, question_text, options, correct_answer, order_index) VALUES (?, ?, ?, ?, ?, ?)',
            [examId, type, text, opts, q.correct_answer || null, q.order_index != null ? q.order_index : i]
          )
        );
      });
      return chain;
    })
    .then(() => res.json({ added: questions.length }))
    .catch((e) => {
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.get('/validate-key', requireAuth, (req, res) => {
  const key = (req.query.key || '').trim();
  console.log('=== KEY VALIDATION REQUEST ===');
  console.log('Key:', key);
  console.log('User ID:', req.user.id);
  console.log('User Role:', req.user.role);
  console.log('User Email:', req.user.email);
  
  if (!key) return res.status(400).json({ error: 'key required' });
  
  getRoleForKey(key)
    .then(({ exam, role }) => {
      console.log('Key validation result:', { exam: exam ? 'found' : 'not found', role });
      
      if (!exam || !role) return res.status(404).json({ error: 'Invalid key' });
      
      if (role === 'proctor' && req.user.role !== 'proctor') {
        console.log('PROCTOR KEY ACCESS DENIED - User role:', req.user.role, 'Required: proctor');
        return res.status(403).json({ error: 'Only proctors can use proctor key' });
      }
      if (role === 'student' && !['student', 'admin', 'proctor'].includes(req.user.role)) {
        console.log('STUDENT KEY ACCESS DENIED - User role:', req.user.role, 'Allowed: student, admin, proctor');
        return res.status(403).json({ error: 'Only students, admins, or proctors can use student exam key' });
      }
      
      console.log('KEY VALIDATION SUCCESS - Role:', role, 'Exam ID:', exam.id);
      res.json({
        valid: true,
        role,
        examId: exam.id,
        examTitle: exam.title,
        durationMinutes: exam.duration_minutes,
      });
    })
    .catch((e) => {
      console.error('Key validation error:', e);
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.post('/join-exam', requireAuth, (req, res) => {
  const { student_key } = req.body;
  if (!student_key) return res.status(400).json({ error: 'student_key required' });
  
  // Allow students, admins, and proctors to join with student keys
  if (!['student', 'admin', 'proctor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only students, admins, or proctors can join exams with student keys' });
  }
  
  getRoleForKey(student_key.trim())
    .then(({ exam, role }) => {
      if (!exam || role !== 'student') return res.status(400).json({ error: 'Invalid student exam key' });
      return db.get('SELECT id FROM sessions WHERE exam_id = ? AND user_id = ? AND status = ?', [exam.id, req.user.id, 'active'])
        .then((existing) => {
          if (existing) return res.status(400).json({ error: 'Already in an active session for this exam' });
          return db.run('INSERT INTO sessions (exam_id, user_id) VALUES (?, ?)', [exam.id, req.user.id]);
        })
        .then((r) => ({ sessionId: r.lastID, exam }));
    })
    .then(({ sessionId, exam }) => {
      return res.json({
        sessionId,
        examId: exam.id,
        examTitle: exam.title,
        durationMinutes: exam.duration_minutes,
      });
    })
    .catch((e) => {
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.get('/sessions/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.get('SELECT s.*, e.title as exam_title FROM sessions s JOIN exams e ON s.exam_id = e.id WHERE s.id = ?', [id])
    .then((session) => {
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (req.user.role === 'student' && session.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not allowed' });
      }
      res.json(session);
    })
    .catch((e) => {
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.post('/sessions/:id/submit', requireAuth, (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  db.get('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [sessionId, req.user.id])
    .then((session) => {
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.status !== 'active') return res.status(400).json({ error: 'Session not active' });
      return db.run('UPDATE sessions SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?', ['submitted', sessionId]);
    })
    .then(() => res.json({ ok: true }))
    .catch((e) => {
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.post('/sessions/:id/answers', requireAuth, (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  const { question_id, answer_text } = req.body;
  if (!question_id) return res.status(400).json({ error: 'question_id required' });
  db.get('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [sessionId, req.user.id])
    .then((session) => {
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.status !== 'active') return res.status(400).json({ error: 'Session not active' });
      return db.get('SELECT id FROM session_answers WHERE session_id = ? AND question_id = ?', [sessionId, question_id]);
    })
    .then((existing) => {
      if (existing) {
        return db.run('UPDATE session_answers SET answer_text = ? WHERE session_id = ? AND question_id = ?', [answer_text || '', sessionId, question_id]);
      }
      return db.run('INSERT INTO session_answers (session_id, question_id, answer_text) VALUES (?, ?, ?)', [sessionId, question_id, answer_text || '']);
    })
    .then(() => res.json({ ok: true }))
    .catch((e) => {
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.get('/exams/:examId/reports', requireAuth, requireRole('admin'), (req, res) => {
  const examId = parseInt(req.params.examId, 10);
  console.log('=== REPORTS API REQUEST ===');
  console.log('Exam ID:', examId);
  console.log('User ID:', req.user.id);
  console.log('User Role:', req.user.role);
  console.log('User Email:', req.user.email);
  console.log('Is Authenticated:', req.isAuthenticated ? req.isAuthenticated() : 'N/A');
  console.log('Session Data:', req.session);
  
  if (!req.user || req.user.role !== 'admin') {
    console.log('AUTHENTICATION FAILED - User is not admin');
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  db.get('SELECT id FROM exams WHERE id = ? AND created_by = ?', [examId, req.user.id])
    .then((exam) => {
      console.log('Exam found:', exam ? 'YES' : 'NO');
      if (!exam) {
        console.log('Returning 404 - Exam not found or not owned by user');
        return res.status(404).json({ error: 'Exam not found' });
      }
      
      console.log('Fetching sessions for exam...');
      return db.all(
        'SELECT s.*, u.email, u.display_name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.exam_id = ? ORDER BY s.started_at DESC',
        [examId]
      );
    })
    .then((sessions) => {
      console.log('Sessions found:', sessions.length);
      return Promise.all(
        sessions.map((s) => {
          console.log('Fetching details for session:', s.id);
          return db.all('SELECT * FROM malpractice_events WHERE session_id = ? ORDER BY created_at', [s.id]).then((events) =>
            db.all('SELECT * FROM evidence WHERE session_id = ?', [s.id]).then((evidence) => {
              console.log('Session', s.id, '- Events:', events.length, 'Evidence:', evidence.length);
              return { ...s, events, evidence };
            })
          );
        })
      );
    })
    .then((withDetails) => {
      console.log('=== REPORTS API RESPONSE ===');
      console.log('Total sessions with details:', withDetails.length);
      console.log('Response type: JSON');
      res.json(withDetails);
    })
    .catch((e) => {
      console.error('Reports API error:', e);
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.get('/exams/:examId/export/json', requireAuth, requireRole('admin'), (req, res) => {
  const examId = parseInt(req.params.examId, 10);
  db.get('SELECT * FROM exams WHERE id = ? AND created_by = ?', [examId, req.user.id])
    .then((exam) => {
      if (!exam) return res.status(404).json({ error: 'Exam not found' });
      return db.all(
        'SELECT s.*, u.email, u.display_name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.exam_id = ? ORDER BY s.started_at DESC',
        [examId]
      ).then((sessions) => {
        const withDetails = sessions.map((s) =>
          db.all('SELECT * FROM malpractice_events WHERE session_id = ?', [s.id]).then((events) =>
            db.all('SELECT * FROM evidence WHERE session_id = ?', [s.id]).then((evidence) => ({ ...s, events, evidence }))
          )
        );
        return Promise.all(withDetails).then((withDetailsResolved) => ({ exam, sessions: withDetailsResolved }));
      });
    })
    .then((data) => {
      res.setHeader('Content-Disposition', `attachment; filename=exam_${examId}_report.json`);
      res.json(data);
    })
    .catch((e) => {
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.get('/exams/:examId/export/csv', requireAuth, requireRole('admin'), (req, res) => {
  const examId = parseInt(req.params.examId, 10);
  db.get('SELECT * FROM exams WHERE id = ? AND created_by = ?', [examId, req.user.id])
    .then((exam) => {
      if (!exam) return res.status(404).json({ error: 'Exam not found' });
      return db.all(
        'SELECT s.*, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.exam_id = ? ORDER BY s.started_at DESC',
        [examId]
      );
    })
    .then((sessions) => {
      const header = 'Session ID,User Email,Status,Malpractice Score,Started,Ended\n';
      const rows = sessions.map(
        (s) => `${s.id},"${(s.email || '').replace(/"/g, '""')}",${s.status},${s.malpractice_score || 0},${s.started_at || ''},${s.ended_at || ''}\n`
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=exam_${examId}_report.csv`);
      res.send(header + rows.join(''));
    })
    .catch((e) => {
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

router.post('/evidence', requireAuth, (req, res) => {
  const sessionId = req.body.sessionId;
  const eventId = req.body.eventId;
  const filePath = req.body.filePath;
  if (!sessionId || !filePath) return res.status(400).json({ error: 'sessionId and filePath required' });
  db.get('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [sessionId, req.user.id])
    .then((session) => {
      if (!session) return res.status(403).json({ error: 'Session not found' });
      return db.run('INSERT INTO evidence (session_id, event_id, file_path) VALUES (?, ?, ?)', [sessionId, eventId || null, filePath]);
    })
    .then((r) => res.json({ id: r.lastID }))
    .catch((e) => {
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message });
      }
    });
});

module.exports = router;
