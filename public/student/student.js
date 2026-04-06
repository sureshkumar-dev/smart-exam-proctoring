/**
 * Student dashboard: enter Student Exam Key, validate with backend, join exam.
 * Redirects to exam interface when user starts exam.
 */

(function () {
  function showMessage(text, type) {
    var el = document.getElementById('message');
    if (!el) return;
    el.textContent = text;
    el.className = 'alert ' + (type || 'info');
    el.classList.remove('hidden');
  }

  function hideMessage() {
    var el = document.getElementById('message');
    if (el) el.classList.add('hidden');
  }

  document.getElementById('joinForm').onsubmit = function (e) {
    e.preventDefault();
    var key = document.getElementById('studentKey').value.trim();
    var msg = document.getElementById('message');
    hideMessage();
    if (!key) {
      showMessage('Please enter Student Exam Key.', 'error');
      return;
    }
    fetch('/api/validate-key?key=' + encodeURIComponent(key), { credentials: 'include' })
      .then(function (r) {
        if (r.status === 401) { window.location.href = '../login.html'; return null; }
        return r.json();
      })
      .then(function (data) {
        if (!data) return;
        if (data.error) {
          showMessage(data.error, 'error');
          return;
        }
        if (data.role !== 'student') {
          showMessage('This key is not a Student Exam Key.', 'error');
          return;
        }
        fetch('/api/join-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ student_key: key })
        })
          .then(function (r) { return r.json(); })
          .then(function (joinData) {
            if (joinData.error) {
              showMessage(joinData.error, 'error');
              return;
            }
            sessionStorage.setItem('examSessionId', joinData.sessionId);
            sessionStorage.setItem('examExamId', joinData.examId);
            sessionStorage.setItem('examTitle', joinData.examTitle || 'Exam');
            sessionStorage.setItem('examDuration', joinData.durationMinutes || 60);
            document.getElementById('joinForm').classList.add('hidden');
            document.getElementById('joined').classList.remove('hidden');
            showMessage('You have joined the exam. Click "Start Exam" to begin.', 'success');
          })
          .catch(function () {
            showMessage('Network error. Try again.', 'error');
          });
      })
      .catch(function () {
        showMessage('Network error. Try again.', 'error');
      });
  };

  document.getElementById('startExamLink').addEventListener('click', function (e) {
    e.preventDefault();
    var sessionId = sessionStorage.getItem('examSessionId');
    var examId = sessionStorage.getItem('examExamId');
    if (sessionId && examId) {
      window.location.href = 'exam.html?sessionId=' + sessionId + '&examId=' + examId;
    } else {
      showMessage('Please join an exam first.', 'error');
    }
  });

  fetch('/api/me', { credentials: 'include' })
    .then(function (r) {
      if (r.status === 401) window.location.href = '../login.html';
    })
    .catch(function () {});
})();
