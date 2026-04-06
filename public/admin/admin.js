
(function () {
  var currentReportExamId = null;
  var lastCreatedExamId = null;
  var exams = []; // Global exams array

  var MCQ_MIN_OPTIONS = 2;
  var MCQ_DEFAULT_OPTIONS = 4;

  /* ---------- Helpers ---------- */

  function el(id) {
    return document.getElementById(id);
  }

  function showMessage(text, type) {
    var m = el('message');
    if (!m) return;
    m.textContent = text;
    m.className = 'alert ' + (type || 'info');
    m.classList.remove('hidden');
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  /* ---------- Exams ---------- */

  function loadExams() {
    fetch('/api/exams', { credentials: 'include' })
      .then(r => r.json())
      .then(data => renderExams(Array.isArray(data) ? data : []));
  }

  function renderExams(exams) {
    var tbody = el('examsBody');
    if (!tbody) return;

    if (exams.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">No exams yet.</td></tr>';
      return;
    }

    tbody.innerHTML = exams.map(exam => `
      <tr>
        <td>${exam.id}</td>
        <td>${escapeHtml(exam.title)}</td>
        <td>${exam.duration_minutes}</td>
        <td>${exam.student_key}</td>
        <td>${exam.proctor_key}</td>
        <td>${exam.admin_key}</td>
        <td>
          <button class="add-questions-btn" data-id="${exam.id}" data-title="${escapeHtml(exam.title)}">
            Add Questions
          </button>
          <button class="view-report-btn" data-id="${exam.id}" data-title="${escapeHtml(exam.title)}" style="margin-left: 5px;">
            View Report
          </button>
          <button class="delete-exam-btn" data-id="${exam.id}" data-title="${escapeHtml(exam.title)}" style="margin-left: 5px; background-color: #dc3545; color: white;">
            Delete
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.add-questions-btn').forEach(btn => {
      btn.onclick = () => openQuestionsModal(Number(btn.dataset.id), btn.dataset.title);
    });

    tbody.querySelectorAll('.view-report-btn').forEach(btn => {
      btn.onclick = () => loadExamReport(Number(btn.dataset.id));
    });

    tbody.querySelectorAll('.delete-exam-btn').forEach(btn => {
      btn.onclick = () => deleteExam(Number(btn.dataset.id), btn.dataset.title);
    });
  }

  /* ---------- Questions Modal ---------- */

  function openQuestionsModal(examId, title) {
    if (!examId || examId <= 0 || isNaN(examId)) {
      showMessage('Invalid exam selected', 'error');
      return;
    }

    el('questionsModal').style.display = 'flex';
    el('questionsExamId').value = examId;
    el('questionsExamTitle').textContent = 'Exam: ' + title;

    el('qType').value = 'mcq';
    toggleQuestionTypeUi();
    loadQuestionsList(examId);

    bindModalButtons();
  }

  function closeQuestionsModal() {
    el('questionsModal').style.display = 'none';
  }

  function bindModalButtons() {
    var closeBtn = el('closeQuestionsModal');
    if (closeBtn) {
      closeBtn.onclick = closeQuestionsModal;
    }

    var addOptBtn = el('addOptionBtn');
    if (addOptBtn) {
      addOptBtn.onclick = function () {
        var container = el('mcqOptionFields');
        var count = container.querySelectorAll('.mcq-option-input').length;

        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'mcq-option-input';
        input.placeholder = 'Option ' + (count + 1);
        input.oninput = updateCorrectAnswerDropdown;
        container.appendChild(input);

        updateCorrectAnswerDropdown();
      };
    }
  }

  function loadQuestionsList(examId) {
    if (!examId || examId <= 0 || isNaN(examId)) {
      showMessage('Invalid exam ID for loading questions', 'error');
      return;
    }

    fetch('/api/exams/' + examId + '/questions', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load questions');
        return r.json();
      })
      .then(data => {
        var list = el('questionsList');
        if (!data || data.length === 0) {
          list.innerHTML = '<p>No questions yet.</p>';
          return;
        }
        list.innerHTML = '<ul>' + data.map(q =>
          `<li>${escapeHtml(q.question_text)}</li>`
        ).join('') + '</ul>';
      })
      .catch(err => {
        showMessage('Error loading questions: ' + err.message, 'error');
      });
  }

  /* ---------- MCQ ---------- */

  function renderMcqOptionFields(count) {
    var container = el('mcqOptionFields');
    container.innerHTML = '';
    for (var i = 0; i < count; i++) {
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'mcq-option-input';
      input.placeholder = 'Option ' + (i + 1);
      input.oninput = updateCorrectAnswerDropdown;
      container.appendChild(input);
    }
    updateCorrectAnswerDropdown();
  }

  function updateCorrectAnswerDropdown() {
    var select = el('qCorrectMcq');
    select.innerHTML = '<option value="">Select correct answer</option>';
    document.querySelectorAll('.mcq-option-input').forEach(inp => {
      if (inp.value.trim()) {
        var o = document.createElement('option');
        o.value = inp.value;
        o.textContent = inp.value;
        select.appendChild(o);
      }
    });
  }

  function toggleQuestionTypeUi() {
    var isMcq = el('qType').value === 'mcq';
    el('mcqOptionsContainer').classList.toggle('hidden', !isMcq);
    el('textCorrectContainer').classList.toggle('hidden', isMcq);
    if (isMcq) renderMcqOptionFields(MCQ_DEFAULT_OPTIONS);
  }

  el('qType').onchange = toggleQuestionTypeUi;

  /* ---------- Create Exam ---------- */

  el('createExamForm').onsubmit = function (e) {
    e.preventDefault();

    var title = el('examTitle').value.trim();
    var duration = el('durationMinutes').value;

    if (!title) {
      showMessage('Enter exam title', 'error');
      return;
    }

    if (!duration || duration <= 0) {
      showMessage('Enter valid duration', 'error');
      return;
    }

    fetch('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: title,
        duration_minutes: parseInt(duration, 10)
      })
    })
      .then(r => {
        console.log('Create exam response status:', r.status);
        console.log('Create exam response headers:', r.headers.get('content-type'));
        
        if (!r.ok) {
          return r.text().then(function(text) {
            console.error('Create exam error response:', text);
            throw new Error('Failed to create exam: ' + r.status + ' ' + text);
          });
        }
        return r.json();
      })
      .then(data => {
        el('examTitle').value = '';
        el('durationMinutes').value = '60';
        
        el('displayStudentKey').textContent = data.student_key;
        el('displayProctorKey').textContent = data.proctor_key;
        el('displayAdminKey').textContent = data.admin_key;
        el('keysBox').classList.remove('hidden');

        el('addQuestionsLink').onclick = () => openQuestionsModal(data.id, data.title);
        
        loadExams();
        showMessage('Exam created successfully', 'success');
      })
      .catch(err => {
        showMessage('Error creating exam: ' + err.message, 'error');
      });
  };

  /* ---------- Add Question ---------- */

  el('addQuestionForm').onsubmit = function (e) {
    e.preventDefault();

    var examId = Number(el('questionsExamId').value);
    console.log('Exam ID:', examId);
    if (!examId || examId <= 0 || isNaN(examId)) {
      showMessage('Select an exam first', 'error');
      return;
    }

    var text = el('qText').value.trim();
    console.log('Question text:', text);
    if (!text) {
      showMessage('Enter question text', 'error');
      return;
    }

    var questionType = el('qType').value;
    console.log('Question type:', questionType);
    var questionData = {
      type: questionType,
      question_text: text
    };

    if (questionType === 'mcq') {
      // MCQ validation and data
      var opts = [];
      document.querySelectorAll('.mcq-option-input').forEach(i => {
        if (i.value.trim()) opts.push(i.value.trim());
      });

      console.log('MCQ options:', opts);
      if (opts.length < MCQ_MIN_OPTIONS) {
        showMessage('At least 2 options required', 'error');
        return;
      }

      var correct = el('qCorrectMcq').value;
      console.log('MCQ correct answer:', correct);
      if (!correct) {
        showMessage('Select correct answer', 'error');
        return;
      }

      questionData.options = JSON.stringify(opts);
      questionData.correct_answer = correct;
    } else if (questionType === 'text') {
      // Text question validation and data
      var correctText = el('qCorrectText').value.trim();
      console.log('Text correct answer:', correctText);
      questionData.correct_answer = correctText || null;
      questionData.options = null;
    }

    console.log('Sending question data:', questionData);
    fetch('/api/exams/' + examId + '/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(questionData)
    })
      .then(r => {
        console.log('Response status:', r.status);
        if (!r.ok) throw new Error('Failed to add question');
        return r.json();
      })
      .then(data => {
        console.log('Question added:', data);
        el('qText').value = '';
        if (questionType === 'mcq') {
          renderMcqOptionFields(MCQ_DEFAULT_OPTIONS);
        } else {
          el('qCorrectText').value = '';
        }
        loadQuestionsList(examId);
        showMessage('Question added successfully', 'success');
      })
      .catch(err => {
        console.error('Error adding question:', err);
        showMessage('Error adding question: ' + err.message, 'error');
      });
  };

  /* ---------- Reports ---------- */

  function loadReports() {
    fetch('/api/exams', { credentials: 'include' })
      .then(r => r.json())
      .then(examsData => {
        exams = examsData; // Populate global exams array
        console.log('Exams loaded for reports:', exams);
        
        var select = el('reportExamSelect');
        if (!select) {
          // Create report exam selector if it doesn't exist
          select = document.createElement('select');
          select.id = 'reportExamSelect';
          select.innerHTML = '<option value="">Select exam</option>';
          exams.forEach(exam => {
            var option = document.createElement('option');
            option.value = exam.id;
            option.textContent = exam.title;
            select.appendChild(option);
          });
          
          var reportSection = el('reportSection');
          if (reportSection) {
            reportSection.insertBefore(select, reportSection.firstChild);
            select.onchange = () => loadExamReport(select.value);
          }
        }
      });
  }

  function loadExamReport(examId) {
    if (!examId || examId <= 0 || isNaN(examId)) {
      el('reportSection').classList.add('hidden');
      return;
    }

    currentReportExamId = examId;
    console.log('=== LOADING EXAM REPORT ===');
    console.log('Exam ID:', examId);
    console.log('Reports API URL:', '/api/exams/' + examId + '/reports');
    
    // Check if user is authenticated
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => {
        console.log('Auth check status:', r.status);
        console.log('Auth check headers:', r.headers.get('content-type'));
        if (!r.ok) {
          console.log('User not authenticated - status:', r.status);
          return r.text().then(text => {
            console.log('Auth error response:', text);
            throw new Error('Not authenticated');
          });
        }
        return r.json();
      })
      .then(user => {
        console.log('Current user:', user);
        if (!user) {
          console.log('No user data received');
          throw new Error('No user data');
        }
        if (user.role !== 'admin') {
          console.log('User is not admin:', user.role);
          throw new Error('Admin access required');
        }
        console.log('User authenticated as admin, proceeding with report loading');
        
        // Now proceed with report loading
        return fetch('/api/exams/' + examId + '/reports', { credentials: 'include' });
      })
      .then(r => {
        console.log('Reports API response status:', r.status);
        console.log('Reports API response headers:', r.headers.get('content-type'));
        
        if (!r.ok) {
          return r.text().then(function(text) {
            console.error('Reports API error response:', text);
            console.error('Status:', r.status);
            console.error('Status Text:', r.statusText);
            throw new Error('Failed to load report: ' + r.status + ' ' + text);
          });
        }
        
        return r.json();
      })
      .then(sessions => {
        console.log('Sessions data received:', sessions);
        console.log('Number of sessions:', sessions ? sessions.length : 0);
        
        var reportSessionsBody = el('reportSessionsBody');
        if (!reportSessionsBody) {
          console.error('Report sessions body element not found!');
          showMessage('Report container not found', 'error');
          return;
        }
        
        reportSessionsBody.innerHTML = '';

        if (!sessions || sessions.length === 0) {
          reportSessionsBody.innerHTML = '<tr><td colspan="6">No sessions found for this exam.</td></tr>';
          el('reportSection').classList.remove('hidden');
          return;
        }

        sessions.forEach(s => {
          console.log('Processing session:', s.id, 'Student:', s.student_name || s.display_name || s.email);
          var row = document.createElement('tr');
          row.innerHTML = `
            <td>${s.id}</td>
            <td>${s.student_name || s.display_name || s.email || 'N/A'}</td>
            <td>${s.status}</td>
            <td>${s.malpractice_score || 0}</td>
            <td>${new Date(s.started_at).toLocaleString()}</td>
            <td>${s.ended_at ? new Date(s.ended_at).toLocaleString() : 'N/A'}</td>
          `;
          reportSessionsBody.appendChild(row);
        });

        var exam = exams.find(ex => ex.id === examId);
        console.log('Looking for exam with ID:', examId);
        console.log('Available exams:', exams);
        console.log('Found exam:', exam);
        
        if (exam) {
          el('reportExamTitle').textContent = 'Report: ' + exam.title;
        } else {
          console.warn('Exam not found for ID:', examId);
          el('reportExamTitle').textContent = 'Report: Unknown Exam';
        }
        el('reportSection').classList.remove('hidden');
        
        console.log('=== REPORT LOADED SUCCESSFULLY ===');
      })
      .catch(err => {
        console.error('=== REPORT LOADING FAILED ===');
        console.error('Error:', err);
        console.error('Error message:', err.message);
        showMessage('Error loading report: ' + err.message, 'error');
      });
  }

  function renderReportSessions(sessions) {
    var tbody = el('reportSessionsBody');
    if (!tbody) return;

    if (!sessions || sessions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">No sessions yet.</td></tr>';
      el('violationsDetail').innerHTML = '';
      return;
    }

    tbody.innerHTML = sessions.map(session => `
      <tr>
        <td>${session.id}</td>
        <td>${session.student_name || session.display_name || session.email || 'N/A'}</td>
        <td>${session.status}</td>
        <td>${session.malpractice_score || 0}</td>
        <td>${session.started_at || 'N/A'}</td>
        <td>${session.ended_at || 'N/A'}</td>
      </tr>
    `).join('');

    // Add click handlers for session details
    tbody.querySelectorAll('tr').forEach((row, index) => {
      if (sessions[index]) {
        row.style.cursor = 'pointer';
        row.onclick = () => showSessionViolations(sessions[index]);
      }
    });
  }

  function showSessionViolations(session) {
    var detailDiv = el('violationsDetail');
    if (!detailDiv) return;

    var events = session.events || [];
    var evidence = session.evidence || [];

    var html = `
      <h4>Session ${session.id} - ${session.student_name || session.display_name || session.email || 'Unknown Student'}</h4>
      <h5>Malpractice Events (${events.length})</h5>
    `;

    if (events.length === 0) {
      html += '<p>No malpractice events recorded.</p>';
    } else {
      html += '<ul>';
      events.forEach(event => {
        html += `<li><strong>${event.event_type}</strong> - Score: ${event.score_added} - ${event.created_at}</li>`;
        if (event.details) {
          html += `<ul><li>${event.details}</li></ul>`;
        }
      });
      html += '</ul>';
    }

    html += `<h5>Evidence (${evidence.length})</h5>`;
    if (evidence.length === 0) {
      html += '<p>No evidence uploaded.</p>';
    } else {
      html += '<ul>';
      evidence.forEach(ev => {
        html += `<li><a href="${ev.file_path}" target="_blank">View Evidence</a> - ${ev.created_at}</li>`;
      });
      html += '</ul>';
    }

    detailDiv.innerHTML = html;
  }

  // Delete exam functionality
  function deleteExam(examId, examTitle) {
    if (!examId || examId <= 0 || isNaN(examId)) {
      showMessage('Invalid exam ID', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to delete the exam "${examTitle}"?\n\nThis will:\n- Delete the exam permanently\n- Delete all questions in this exam\n- Delete all student sessions and results\n\nThis action cannot be undone!`)) {
      return;
    }

    showMessage('Deleting exam...', 'info');

    fetch('/api/exams/' + examId, {
      method: 'DELETE',
      credentials: 'include'
    })
      .then(function (r) {
        console.log('Delete response status:', r.status);
        console.log('Delete response headers:', r.headers.get('content-type'));
        
        if (!r.ok) {
          return r.text().then(function(text) {
            console.error('Delete error response:', text);
            throw new Error('Failed to delete exam: ' + r.status + ' ' + text);
          });
        }
        return r.json();
      })
      .then(function (data) {
        console.log('Delete response:', data);
        if (data.error) {
          throw new Error(data.error);
        }
        
        showMessage(`Exam "${examTitle}" deleted successfully`, 'success');
        loadExams(); // Reload the exam list
        
        // Close report section if it was showing the deleted exam
        if (currentReportExamId === examId) {
          el('reportSection').classList.add('hidden');
          currentReportExamId = null;
        }
      })
      .catch(function (err) {
        console.error('Error deleting exam:', err);
        showMessage('Error deleting exam: ' + err.message, 'error');
      });
  }

  // Export functionality
  function bindExportButtons() {
    var exportJsonBtn = el('exportJsonBtn');
    if (exportJsonBtn) {
      exportJsonBtn.onclick = () => exportReport('json');
    }

    var exportCsvBtn = el('exportCsvBtn');
    if (exportCsvBtn) {
      exportCsvBtn.onclick = () => exportReport('csv');
    }
  }

  function exportReport(format) {
    if (!currentReportExamId) {
      showMessage('No exam selected for export', 'error');
      return;
    }

    var url = '/api/exams/' + currentReportExamId + '/export/' + format;
    window.open(url, '_blank');
  }

  /* ---------- Init ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    el('questionsModal').style.display = 'none'; // 🔥 FIX auto-open
    loadExams();
    loadReports();
    bindExportButtons();
  });
})();
