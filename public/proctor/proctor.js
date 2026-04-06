

(function () {
  var socket = null;
  var proctorKey = '';
  var examId = null;
  var examName = '';
  var activeStudents = {};
  var alerts = [];
  var evidenceList = [];

  function getParams() {
    var params = new URLSearchParams(window.location.search);
    proctorKey = params.get('key') || '';
    examId = params.get('examId') || '';
    if (proctorKey && examId) {
      examId = parseInt(examId, 10);
      return true;
    }
    return false;
  }

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

  function escapeHtml(str) {
    if (str == null) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderStudents() {
    var tbody = document.getElementById('studentsBody');
    if (!tbody) return;
    var ids = Object.keys(activeStudents);
    if (ids.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No active students</td></tr>';
      return;
    }
    tbody.innerHTML = ids.map(function (id) {
      var s = activeStudents[id];
      return (
        '<tr data-session-id="' + id + '">' +
        '<td>' + s.id + '</td>' +
        '<td>' + escapeHtml(s.student_name || s.email || '') + '</td>' +
        '<td>' + (s.malpractice_score || 0) + '</td>' +
        '<td><button type="button" class="btn danger terminate-btn" data-session-id="' + id + '">Terminate</button></td>' +
        '</tr>'
      );
    }).join('');
    tbody.querySelectorAll('.terminate-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sid = this.getAttribute('data-session-id');
        if (sid) terminateStudent(sid);
      });
    });
  }

  function terminateStudent(sessionId) {
    if (!socket || !proctorKey || !examId) return;
    if (!confirm('Terminate this student\'s exam?')) return;
    socket.emit('proctor_terminate', {
      sessionId: parseInt(sessionId, 10),
      examId: examId,
      proctorKey: proctorKey
    });
  }

  function addAlert(data) {
    alerts.unshift(data);
    if (alerts.length > 50) alerts.pop();
    var container = document.getElementById('alertsContainer');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'proctor-alert';
    div.innerHTML =
      '<strong>' + escapeHtml(data.student_name || data.email || '') + '</strong><br>' +
      'Event: ' + escapeHtml(data.eventType || '') + ' | Score +' + (data.scoreAdded || 0) + ' | Total: <span class="score">' + (data.totalScore || 0) + '</span><br>' +
      (data.details ? 'Details: ' + escapeHtml(data.details) : '') +
      '<br><small>' + new Date().toLocaleTimeString() + '</small>';
    container.insertBefore(div, container.firstChild);
  }

  function addEvidence(data) {
    console.log('=== ADDING EVIDENCE ===');
    console.log('Evidence data:', data);
    console.log('Evidence data details:', {
      sessionId: data.sessionId,
      filePath: data.filePath,
      eventType: data.eventType,
      details: data.details,
      timestamp: data.timestamp,
      score: data.score
    });

    evidenceList.unshift(data);
    var container = document.getElementById('evidenceContainer');
    if (!container) {
      console.error('Evidence container not found');
      return;
    }

    console.log('Evidence container found, adding evidence...');
    console.log('Container current children count:', container.children.length);

    // Clear old evidence if too many
    if (container.children.length > 20) {
      while (container.children.length > 15) {
        container.removeChild(container.lastChild);
      }
    }

    var div = document.createElement('div');
    div.className = 'evidence-item';
    div.style.border = '1px solid #ddd';
    div.style.margin = '10px 0';
    div.style.padding = '10px';
    div.style.backgroundColor = '#f9f9f9';

    var info = document.createElement('div');
    info.innerHTML = `
      <strong>Session:</strong> ${data.sessionId || 'Unknown'}<br>
      <strong>Event:</strong> ${data.eventType || 'Unknown'}<br>
      <strong>Time:</strong> ${new Date(data.timestamp || Date.now()).toLocaleString()}<br>
      <strong>Score:</strong> ${data.score || 0}<br>
      ${data.details ? '<strong>Details:</strong> ' + data.details + '<br>' : ''}
    `;
    div.appendChild(info);

    var img = document.createElement('img');
    img.src = img.src = "http://localhost:3000" + data.filePath;
    img.alt = 'Evidence';
    img.className = 'evidence-img';
    img.style.maxWidth = '200px';
    img.style.maxHeight = '150px';
    img.style.cursor = 'pointer';
    img.style.border = '1px solid #ccc';
    img.onclick = function () { window.open(data.filePath, '_blank'); };

    console.log('Creating evidence image with src:', img.src);
    console.log('Full image URL will be:', window.location.origin + img.src);

    img.onload = function () {
      console.log('✅ Evidence image loaded successfully:', img.src);
    };

    img.onerror = function () {
      console.error('❌ Evidence image failed to load:', img.src);
      console.error('Full URL attempted:', window.location.origin + img.src);
      this.style.display = 'none';
      var errorDiv = document.createElement('div');
      errorDiv.textContent = 'Image failed to load: ' + img.src;
      errorDiv.style.color = 'red';
      errorDiv.style.fontSize = '12px';
      div.appendChild(errorDiv);
    };

    div.appendChild(img);
    container.insertBefore(div, container.firstChild);
    console.log('Evidence added to container, new children count:', container.children.length);
    console.log('=== EVIDENCE ADDITION COMPLETE ===');
  }

  function connectSocket() {
    console.log('Connecting to socket with proctorKey:', proctorKey, 'examId:', examId);
    socket = io();

    socket.on('connect', function () {
      console.log('Socket connected, emitting proctor_join');
      socket.emit('proctor_join', { proctorKey: proctorKey, examId: examId });
    });

    socket.on('error', function (data) {
      console.error('Socket error:', data);
      showMessage(data.message || 'Error', 'error');
    });

    socket.on('active_students', function (list) {
      console.log('Received active_students:', list);
      activeStudents = {};
      list.forEach(function (s) {
        activeStudents[s.id] = s;
      });
      renderStudents();
    });

    socket.on('student_joined', function (student) {
      console.log('Student joined:', student);
      activeStudents[student.id] = student;
      renderStudents();
    });

    socket.on('student_left', function (student) {
      console.log('Student left:', student);
      delete activeStudents[student.id];
      renderStudents();
    });

    socket.on('malpractice_alert', function (data) {
      console.log('Malpractice alert:', data);
      addAlert(data);
    });

    socket.on('new_evidence', function (data) {
      console.log('=== NEW EVIDENCE EVENT RECEIVED ===');
      console.log('Evidence data:', data);
      console.log('Evidence filePath:', data.filePath);
      console.log('Evidence eventType:', data.eventType);
      console.log('Evidence sessionId:', data.sessionId);
      addEvidence(data);
    });

    socket.on('exam_terminated', function (data) {
      console.log('Exam terminated:', data);
      if (data.sessionId) delete activeStudents[data.sessionId];
      renderStudents();
    });
  }

  function loadExamInfo() {
    console.log('Loading exam info with proctorKey:', proctorKey);
    fetch('/api/validate-key?key=' + encodeURIComponent(proctorKey), { credentials: 'include' })
      .then(function (r) {
        console.log('Validate key response status:', r.status);
        if (r.status === 401) { window.location.href = '../login.html'; return null; }
        return r.json();
      })
      .then(function (data) {
        console.log('Validate key response:', data);
        if (!data) return;
        if (data.error) {
          showMessage(data.error, 'error');
          return;
        }
        examId = data.examId;
        examName = data.examTitle || 'Exam';
        document.getElementById('examName').textContent = examName;
        hideMessage();
        document.getElementById('keyScreen').classList.add('hidden');
        document.getElementById('dashboardScreen').classList.remove('hidden');
        connectSocket();
      })
      .catch(function (err) {
        console.error('Network error:', err);
        showMessage('Network error.', 'error');
      });
  }

  function showKeyForm() {
    document.getElementById('keyScreen').classList.remove('hidden');
    document.getElementById('dashboardScreen').classList.add('hidden');
    document.getElementById('keyForm').onsubmit = function (e) {
      e.preventDefault();
      proctorKey = document.getElementById('proctorKey').value.trim();
      if (!proctorKey) {
        showMessage('Enter Proctor Key.', 'error');
        return;
      }
      console.log('Validating proctor key:', proctorKey);
      fetch('/api/validate-key?key=' + encodeURIComponent(proctorKey), { credentials: 'include' })
        .then(function (r) {
          console.log('Proctor key validation response status:', r.status);
          if (r.status === 401) {
            console.log('Unauthorized, redirecting to login');
            window.location.href = '../login.html';
            return null;
          }
          return r.json();
        })
        .then(function (data) {
          console.log('Proctor key validation response:', data);
          if (!data) return;
          if (data.error) {
            console.error('Key validation error:', data.error);
            showMessage(data.error, 'error');
            return;
          }
          if (data.role !== 'proctor') {
            console.error('Invalid role:', data.role);
            showMessage('This key is not a Proctor Key.', 'error');
            return;
          }
          examId = data.examId;
          examName = data.examTitle || 'Exam';
          document.getElementById('examName').textContent = examName;
          hideMessage();
          document.getElementById('keyScreen').classList.add('hidden');
          document.getElementById('dashboardScreen').classList.remove('hidden');
          connectSocket();
        })
        .catch(function (err) {
          console.error('Network error during key validation:', err);
          showMessage('Network error: ' + err.message, 'error');
        });
    };
  }

  function refreshStudentList() {
    if (!socket) return;
    socket.emit('proctor_join', { proctorKey: proctorKey, examId: examId });
  }

  function init() {
    if (getParams()) {
      loadExamInfo();
    } else {
      showKeyForm();
    }

    // Add refresh button handler
    var refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.onclick = function () {
        console.log('Refreshing student list');
        refreshStudentList();
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
