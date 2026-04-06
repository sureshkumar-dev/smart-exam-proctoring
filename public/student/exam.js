/**
 * Exam interface: load questions, timer, attempt answers, proctoring.
 * Rule-based detections: tab switch, window blur, fullscreen, face presence,
 * multiple faces, head movement, noise, camera/mic disabled, repeated violations.
 * Cumulative score; auto-terminate when threshold crossed.
 */

(function () {
  var MONITOR_INTERVAL_MS = 5000;
  var CRITICAL_SCORE = 100; // Updated to 100
  var IDLE_SECONDS = 120; // 2 minutes for suspicious idle
  var FACE_OFF_THRESHOLD_SEC = 5; // 5 seconds for no face
  var RAPID_TAB_COUNT = 3;
  var RAPID_TAB_WINDOW_MS = 15000;
  var REPEATED_VIOLATIONS_COUNT = 5;
  var REPEATED_VIOLATIONS_WINDOW_MS = 60000;
  var RAPID_ANSWER_THRESHOLD = 3; // 3 answers in 10 seconds
  var RAPID_ANSWER_WINDOW_MS = 10000;

  var config = { sessionId: null, examId: null, examTitle: '', durationMinutes: 60 };
  var socket = null;
  var localVideo = null;
  var faceCanvas = null;
  var stream = null;
  var audioContext = null;
  var analyser = null;
  var examStartTime = null;
  var timerInterval = null;
  var monitorInterval = null;
  var violationTimes = [];
  var violationCountInWindow = 0;
  var violationWindowStart = Date.now();
  var lastNoiseTime = 0;
  var lastActivityTime = Date.now();
  var tabSwitchCount = 0;
  var answerTimes = [];
  var devtoolsOpen = false;
  var originalTitle = document.title;
  var contextMenuPrevented = false;
  var faceOffStartTime = null;
  var lastFacePresentTime = Date.now();
  var lastFrameData = null;
  var lastInputTime = Date.now();
  var questions = [];
  
  // Alarm system for exam termination
  var alarmAudio = null;
  var alarmPlayed = false;
  
  // Critical violations that should trigger alarm immediately
  var CRITICAL_VIOLATIONS = {
    'multiple_faces': true,
    'camera_disabled': true,
    'paste_detected': true,
    'abnormal_typing_speed': true,
    'sudden_answer_after_inactivity': true,
    'manual_termination': true,
    'auto_termination': true
  };
  
  // Score rules for malpractice violations (client-side copy)
  var SCORE_RULES = {
    // Browser / System Behaviour
    'tab_switch': 5,
    'window_blur': 8,
    'fullscreen_exit': 10,
    'multiple_tab_open': 15,
    'page_refresh_attempt': 12,
    'back_forward_navigation': 10,
    'new_browser_window': 15,
    'devtools_open': 15,
    'copy_paste_attempt': 10,
    'right_click_usage': 5,
    
    // Camera / Video Based
    'no_face': 10,
    'multiple_faces': 25,
    'face_out_of_frame': 8,
    'head_turned_away': 6,
    'camera_disabled': 30,
    
    // Audio / Environment
    'mic_disabled': 20,
    'background_noise': 8,
    'human_voice_detected': 15,
    
    // Behaviour / Pattern Based
    'suspicious_idle': 10,
    'rapid_answer_pattern': 12,
    
    // NEW Behavior-Based Detections (BEHAVIOR source)
    'paste_detected': 40,
    'abnormal_typing_speed': 25,
    'sudden_answer_after_inactivity': 30,
    'tab_switch_before_answer': 15,
    
    // Existing/Other
    'noise_detected': 8,
    'rapid_tab_switch': 8,
    'idle': 10,
    'session_time': 8,
    'face_off_duration': 10,
    'head_movement': 2,
    'face_too_far_close': 8,
    'background_change': 8,
    'multi_voice': 15,
    'repeated_escalation': 8,
    'manual_termination': 50,
    'auto_termination': 50,
  };
  
  // Behavior-based detection variables
  var typingStartTime = null;
  var keystrokeCount = 0;
  var lastPasteTime = 0;
  var lastTabSwitchTime = 0;
  var longInactivityStartTime = null;
  var currentAnswerLength = 0;

  function emitDetection(eventType, details, source) {
    if (!socket || !config.sessionId || !config.examId) return;
    socket.emit('detection', {
      sessionId: config.sessionId,
      examId: config.examId,
      eventType: eventType,
      details: details || null,
      source: source || null
    });
    violationTimes.push(Date.now());
    violationCountInWindow++;
    
    // AUTO-TERMINATION CHECK ENABLED
    if (violationCountInWindow >= REPEATED_VIOLATIONS_COUNT && (Date.now() - violationWindowStart) <= REPEATED_VIOLATIONS_WINDOW_MS) {
      socket.emit('detection', {
        sessionId: config.sessionId,
        examId: config.examId,
        eventType: 'repeated_escalation',
        details: 'Repeated violations in short window'
      });
      violationCountInWindow = 0;
      violationWindowStart = Date.now();
    }
  }

  function showWarning(text) {
    var el = document.getElementById('studentWarning');
    if (el) {
      el.textContent = text;
      el.className = 'alert warning';
      el.classList.remove('hidden');
    }
  }

  // Alarm system functions
  function initAlarm() {
    console.log('=== INITIALIZING ALARM SYSTEM ===');
    try {
      // Try different paths for the alarm file
      var alarmPath = '../assets/alarm.wav';
      console.log('Trying alarm path:', alarmPath);
      
      alarmAudio = new Audio(alarmPath);
      alarmAudio.preload = 'auto';
      alarmAudio.loop = true;
      alarmAudio.volume = 1.0;
      
      console.log('Alarm audio object created:', alarmAudio);
      console.log('Alarm src:', alarmAudio.src);
      console.log('Alarm preload:', alarmAudio.preload);
      console.log('Alarm volume:', alarmAudio.volume);
      
      // Test if the audio can be loaded
      alarmAudio.addEventListener('canplaythrough', function() {
        console.log('Alarm audio can play through - file loaded successfully');
      });
      
      alarmAudio.addEventListener('error', function(e) {
        console.error('Alarm audio error:', e);
        console.error('Audio error code:', alarmAudio.error);
        console.error('Trying alternative path...');
        
        // Try alternative path
        var altPath = '/assets/alarm.wav';
        console.log('Trying alternative path:', altPath);
        alarmAudio.src = altPath;
      });
      
      // Handle autoplay restrictions by attempting to play silently first
      alarmAudio.play().then(() => {
        alarmAudio.pause();
        alarmAudio.currentTime = 0;
        console.log('Alarm initialized successfully');
      }).catch((err) => {
        console.log('Alarm initialization failed (expected due to autoplay):', err.message);
        console.log('This is normal - alarm will work on user interaction');
      });
    } catch (err) {
      console.error('Failed to initialize alarm:', err);
    }
    console.log('=== ALARM INITIALIZATION COMPLETE ===');
  }

  function playTerminationAlarm(reason, eventType) {
    console.log('=== PLAY TERMINATION ALARM CALLED ===');
    console.log('Reason:', reason);
    console.log('EventType:', eventType);
    console.log('Alarm Played:', alarmPlayed);
    console.log('Alarm Audio:', alarmAudio ? 'exists' : 'null');
    
    if (alarmPlayed || !alarmAudio) {
      console.log('EARLY RETURN - alarmPlayed:', alarmPlayed, '!alarmAudio:', !alarmAudio);
      return;
    }
    
    console.log('Playing termination alarm for:', reason, eventType);
    
    // Check if this is a critical violation or score threshold
    var isCriticalViolation = CRITICAL_VIOLATIONS[eventType] || false;
    var isScoreThreshold = reason === 'score_threshold';
    
    console.log('Is Critical Violation:', isCriticalViolation);
    console.log('Is Score Threshold:', isScoreThreshold);
    console.log('CRITICAL_VIOLATIONS[eventType]:', CRITICAL_VIOLATIONS[eventType]);
    
    if (!isCriticalViolation && !isScoreThreshold) {
      console.log('Not a critical violation, skipping alarm');
      return;
    }
    
    console.log('PROCEEDING WITH ALARM PLAYBACK');
    
    try {
      // Reset audio to start
      alarmAudio.currentTime = 0;
      alarmAudio.loop = true;
      
      console.log('Audio reset - currentTime:', alarmAudio.currentTime, 'loop:', alarmAudio.loop);
      
      // Play the alarm
      var playPromise = alarmAudio.play();
      console.log('Play promise:', playPromise);
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('ALARM PLAYING SUCCESSFULLY');
          alarmPlayed = true;
          
          // Visual indication using CSS classes
          document.body.classList.add('alarm-active');
          console.log('Added alarm-active CSS class');
          
          // Show alarm message
          showWarning('EXAM TERMINATED DUE TO MALPRACTICE!');
          
        }).catch((error) => {
          console.error('ALARM PLAY FAILED:', error);
          console.error('Error name:', error.name);
          console.error('Error message:', error.message);
          
          // Fallback: try to play on user interaction
          console.log('SETTING UP FALLUP CLICK HANDLER');
          document.addEventListener('click', function playAlarmOnClick() {
            console.log('FALLBACK CLICK TRIGGERED');
            alarmAudio.play().then(() => {
              console.log('FALLBACK ALARM PLAYING SUCCESSFULLY');
              alarmPlayed = true;
              document.body.classList.add('alarm-active');
              showWarning('EXAM TERMINATED! Click anywhere to hear alarm');
              document.removeEventListener('click', playAlarmOnClick);
            }).catch((e) => {
              console.error('FALLBACK ALARM PLAY FAILED:', e);
            });
          }, { once: true });
          
          showWarning('EXAM TERMINATED! Click anywhere to hear alarm');
        });
      }
    } catch (err) {
      console.error('ERROR PLAYING ALARM:', err);
      showWarning('EXAM TERMINATED DUE TO MALPRACTICE!');
    }
    
    console.log('=== PLAY TERMINATION ALARM FUNCTION END ===');
  }

  function stopAlarm() {
    if (alarmAudio && !alarmAudio.paused) {
      alarmAudio.pause();
      alarmAudio.currentTime = 0;
      alarmAudio.loop = false;
    }
    document.body.classList.remove('alarm-active');
  }

  // Manual alarm test for debugging
  function testAlarm() {
    console.log('=== MANUAL ALARM TEST ===');
    console.log('Testing alarm with score_threshold reason...');
    playTerminationAlarm('score_threshold', 'test_violation');
  }

  // Add test function to global scope for console access
  window.testAlarm = testAlarm;
  window.playTerminationAlarm = playTerminationAlarm;

  function captureScreenshotAndSend(eventType, details) {
    console.log('Attempting to capture screenshot for:', eventType);
    console.log('Current config.sessionId:', config.sessionId);
    console.log('Current config.examId:', config.examId);
    
    // Check if video and canvas are available
    if (!localVideo) {
      console.error('Video element not available');
      return;
    }
    
    if (!faceCanvas) {
      console.error('Canvas element not available');
      return;
    }
    
    // Check if video has dimensions
    if (!localVideo.videoWidth || !localVideo.videoHeight) {
      console.error('Video dimensions not available:', localVideo.videoWidth, localVideo.videoHeight);
      return;
    }
    
    try {
      var ctx = faceCanvas.getContext('2d');
      faceCanvas.width = localVideo.videoWidth;
      faceCanvas.height = localVideo.videoHeight;
      
      // Draw video frame to canvas
      ctx.drawImage(localVideo, 0, 0);
      console.log('Video frame drawn to canvas');
      
      // Enhanced screenshot overlay with comprehensive malpractice information
      var timestamp = new Date();
      var overlayHeight = 120;
      
      // Semi-transparent background overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, faceCanvas.width, overlayHeight);
      
      // Add red border for malpractice evidence
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, faceCanvas.width - 4, faceCanvas.height - 4);
      
      // Text styling
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 3;
      
      // Header - MALPRACTICE DETECTED
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 20px Arial';
      ctx.fillText('🚨 MALPRACTICE DETECTED', 20, 30);
      
      // Event type with color coding
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      var eventDisplay = getEventDisplayName(eventType);
      ctx.fillText('Violation: ' + eventDisplay, 20, 55);
      
      // Detailed description
      ctx.font = '14px Arial';
      ctx.fillStyle = '#ffdd44';
      var detailText = getEventDescription(eventType, details);
      if (detailText) {
        // Wrap long text
        var maxWidth = faceCanvas.width - 40;
        var words = detailText.split(' ');
        var line = '';
        var y = 75;
        for (var n = 0; n < words.length; n++) {
          var testLine = line + words[n] + ' ';
          var metrics = ctx.measureText(testLine);
          var testWidth = metrics.width;
          if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, 20, y);
            line = words[n] + ' ';
            y += 18;
            if (y > overlayHeight - 10) break; // Prevent overflow
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, 20, y);
      }
      
      // Timestamp and session info
      ctx.fillStyle = '#cccccc';
      ctx.font = '12px Arial';
      ctx.fillText('Time: ' + timestamp.toLocaleString(), 20, overlayHeight - 20);
      ctx.fillText('Session: ' + (config.sessionId || 'Unknown'), 250, overlayHeight - 20);
      
      // Score indicator
      var score = SCORE_RULES[eventType] || 10;
      console.log('Screenshot overlay - Event:', eventType, 'Score:', score);
      ctx.fillStyle = score >= 25 ? '#ff4444' : score >= 15 ? '#ffaa44' : '#44ff44';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('Penalty: +' + score + ' points', faceCanvas.width - 150, overlayHeight - 20);
      
      console.log('Screenshot overlay added, converting to blob...');
      
      faceCanvas.toBlob(function (blob) {
        if (!blob) {
          console.error('Failed to create blob from canvas');
          return;
        }
        
        if (!config.sessionId) {
          console.error('No sessionId available for evidence upload');
          return;
        }
        
        console.log('Uploading evidence blob:', blob.size, 'bytes');
        console.log('FormData sessionId being sent:', config.sessionId);
        
        var fd = new FormData();
        fd.append('screenshot', blob, 'evidence.png');
        fd.append('sessionId', config.sessionId);
        fd.append('eventType', eventType || 'unknown');
        fd.append('details', details || '');
        fd.append('timestamp', timestamp.toISOString());
        fd.append('score', score.toString());
        
        console.log('FormData entries:');
        for (var pair of fd.entries()) {
          console.log(pair[0] + ':', pair[1]);
        }
        
        fetch('/api/evidence/upload', { method: 'POST', body: fd, credentials: 'include' })
          .then(function (r) {
            console.log('Evidence upload response status:', r.status);
            return r.json();
          })
          .then(function (data) {
            console.log('Evidence upload response:', data);
            if (data.filePath && socket && config.examId) {
              socket.emit('evidence_uploaded', {
                examId: config.examId,
                sessionId: config.sessionId,
                filePath: data.filePath,
                eventType: eventType || 'unknown',
                details: details || '',
                timestamp: timestamp.toISOString(),
                score: score
              });
              console.log('Evidence uploaded and broadcasted successfully');
            }
          })
          .catch(function (err) {
            console.error('Failed to upload evidence:', err);
          });
      }, 'image/png');
      
    } catch (error) {
      console.error('Error during screenshot capture:', error);
    }
  }
  
  // Helper function to get user-friendly event names
  function getEventDisplayName(eventType) {
    var eventNames = {
      'tab_switch': 'Tab Switching',
      'window_blur': 'Window Focus Lost',
      'fullscreen_exit': 'Left Fullscreen Mode',
      'multiple_tab_open': 'Multiple Tabs Open',
      'page_refresh_attempt': 'Page Refresh Attempt',
      'back_forward_navigation': 'Back/Forward Navigation',
      'new_browser_window': 'New Window Opened',
      'devtools_open': 'Developer Tools Opened',
      'copy_paste_attempt': 'Copy/Paste Attempt',
      'right_click_usage': 'Right Click Usage',
      'no_face': 'No Face Detected',
      'multiple_faces': 'Multiple Faces Detected',
      'face_out_of_frame': 'Face Out of Frame',
      'head_turned_away': 'Head Turned Away',
      'camera_disabled': 'Camera Disabled',
      'camera_blocked': 'Camera Blocked',
      'mic_disabled': 'Microphone Disabled',
      'background_noise': 'Background Noise',
      'human_voice_detected': 'Human Voice Detected',
      'suspicious_idle': 'Suspicious Inactivity',
      'rapid_answer_pattern': 'Rapid Answer Pattern',
      'paste_detected': 'Paste Detected in Answer',
      'abnormal_typing_speed': 'Abnormal Typing Speed',
      'sudden_answer_after_inactivity': 'Sudden Answer After Inactivity',
      'tab_switch_before_answer': 'Tab Switch Before Answer',
      'noise_detected': 'Noise Detected',
      'rapid_tab_switch': 'Rapid Tab Switching',
      'idle': 'Idle Behavior',
      'head_movement': 'Excessive Head Movement',
      'face_too_far_close': 'Face Too Far/Close',
      'background_change': 'Background Changed',
      'multi_voice': 'Multiple Voices Detected'
    };
    return eventNames[eventType] || eventType || 'Unknown Violation';
  }
  
  // Helper function to get detailed event descriptions
  function getEventDescription(eventType, details) {
    if (details) return details;
    
    var descriptions = {
      'tab_switch': 'Student switched tabs or hid the exam window',
      'window_blur': 'Exam window lost focus - possible cheating',
      'fullscreen_exit': 'Student exited fullscreen mode during exam',
      'multiple_tab_open': 'Multiple browser tabs detected simultaneously',
      'page_refresh_attempt': 'Student tried to refresh the exam page',
      'back_forward_navigation': 'Browser navigation buttons used',
      'new_browser_window': 'Attempted to open new browser window',
      'devtools_open': 'Developer tools were opened - code inspection',
      'copy_paste_attempt': 'Copy or paste operation detected',
      'right_click_usage': 'Right-click context menu accessed',
      'no_face': 'Student face not visible in camera',
      'multiple_faces': 'Multiple people detected in camera view',
      'face_out_of_frame': 'Student face partially outside camera',
      'head_turned_away': 'Student looking away from screen',
      'camera_disabled': 'Camera turned off or blocked',
      'camera_blocked': 'Camera lens appears covered',
      'mic_disabled': 'Microphone disabled during exam',
      'background_noise': 'Unusual noise detected in environment',
      'human_voice_detected': 'Human speech detected during exam',
      'suspicious_idle': 'Extended period of no activity',
      'rapid_answer_pattern': 'Answers submitted too quickly',
      'paste_detected': 'Content pasted into answer field',
      'abnormal_typing_speed': 'Typing speed exceeds human capability',
      'sudden_answer_after_inactivity': 'Answer appeared after long inactivity',
      'tab_switch_before_answer': 'Tab switched immediately before answering',
      'head_movement': 'Excessive head movement detected',
      'face_too_far_close': 'Face distance from camera abnormal',
      'background_change': 'Background scene changed during exam',
      'multi_voice': 'Multiple voices heard in background'
    };
    return descriptions[eventType] || 'Malpractice activity detected';
  }

  function requestFullscreen() {
    var el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(function () { showWarning('Please enable fullscreen.'); });
    }
  }

  function initSocket() {
    socket = io();
    socket.on('exam_terminated', function (data) {
      console.log('=== EXAM TERMINATED EVENT RECEIVED ===');
      console.log('Full data object:', data);
      console.log('Reason:', data.reason);
      console.log('Total Score:', data.totalScore);
      console.log('Event Type:', data.eventType);
      console.log('Alarm Audio Status:', alarmAudio ? 'initialized' : 'not initialized');
      console.log('Alarm Played Status:', alarmPlayed);
      
      clearInterval(timerInterval);
      clearInterval(monitorInterval);
      document.getElementById('examContainer').classList.add('hidden');
      var term = document.getElementById('terminatedScreen');
      term.classList.remove('hidden');
      
      var reason = data.reason || 'unknown';
      var totalScore = data.totalScore || 0;
      
      // Determine termination reason and play alarm if appropriate
      var terminationMessage = '';
      var eventType = data.eventType || 'auto_termination';
      
      console.log('Processing termination - Reason:', reason, 'EventType:', eventType);
      
      if (reason === 'score_threshold') {
        terminationMessage = 'Your exam was auto-terminated due to high malpractice score (' + totalScore + ').';
        console.log('Calling playTerminationAlarm for score_threshold');
        playTerminationAlarm(reason, eventType);
      } else if (reason === 'manual_proctor') {
        terminationMessage = 'Your exam was terminated by the proctor.';
        console.log('Calling playTerminationAlarm for manual_proctor');
        playTerminationAlarm(reason, 'manual_termination');
      } else if (reason === 'critical_violation') {
        terminationMessage = 'Your exam was terminated due to critical malpractice violation.';
        console.log('Calling playTerminationAlarm for critical_violation');
        playTerminationAlarm(reason, eventType);
      } else {
        terminationMessage = 'Your exam was terminated.';
        console.log('Checking if eventType is critical violation:', eventType, CRITICAL_VIOLATIONS[eventType]);
        // Only play alarm for specific critical violations
        if (CRITICAL_VIOLATIONS[eventType]) {
          console.log('Calling playTerminationAlarm for critical violation:', eventType);
          playTerminationAlarm(reason, eventType);
        } else {
          console.log('Not playing alarm - not a critical violation');
        }
      }
      
      document.getElementById('terminatedReason').textContent = terminationMessage;
      
      // Add visual alarm effects
      document.getElementById('terminatedScreen').style.backgroundColor = '#ffe6e6';
      document.getElementById('terminatedScreen').style.border = '3px solid #ff0000';
      
      console.log('=== EXAM TERMINATED PROCESSING COMPLETE ===');
    });
    socket.on('malpractice_alert', function (data) {
      if (data.sessionId === config.sessionId && data.totalScore != null) {
        document.getElementById('malpracticeScore').textContent = data.totalScore;
      }
    });
    socket.on('error', function (data) {
      showWarning(data.message || 'Error');
    });
  }

  function startTimer() {
    examStartTime = Date.now();
    function update() {
      var elapsed = (Date.now() - examStartTime) / 1000;
      var totalSec = config.durationMinutes * 60;
      var left = Math.max(0, totalSec - elapsed);
      var el = document.getElementById('timeRemaining');
      if (el) {
        var m = Math.floor(left / 60);
        var s = Math.floor(left % 60);
        el.textContent = m + 'm ' + s + 's';
      }
      if (left <= 0) {
        emitDetection('session_time', 'Exam duration exceeded');
        clearInterval(timerInterval);
      }
    }
    update();
    timerInterval = setInterval(update, 1000);
  }

  function sampleFrameLuminance() {
    if (!faceCanvas || !localVideo || localVideo.readyState < 2) return null;
    try {
      var w = localVideo.videoWidth;
      var h = localVideo.videoHeight;
      if (!w || !h) return null;
      faceCanvas.width = w;
      faceCanvas.height = h;
      var ctx = faceCanvas.getContext('2d');
      ctx.drawImage(localVideo, 0, 0);
      var cx = Math.floor(w / 2);
      var cy = Math.floor(h / 2);
      var size = Math.min(80, Math.floor(w / 4));
      var data = ctx.getImageData(cx - size, cy - size, size * 2, size * 2).data;
      var sum = 0, count = 0;
      for (var i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        count++;
      }
      var avg = count ? sum / count : 0;
      var variance = 0;
      for (var j = 0; j < data.length; j += 4) {
        var L = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
        variance += (L - avg) * (L - avg);
      }
      return { avg: avg, variance: count ? variance / count : 0 };
    } catch (e) { return null; }
  }

  function setupTabSwitchDetection() {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        tabSwitchCount++;
        lastTabSwitchTime = Date.now();
        emitDetection('tab_switch', 'Tab switched or window hidden');
        captureScreenshotAndSend('tab_switch', 'Student switched tabs or hid the exam window');
        showWarning('Do not switch tabs.');
      }
    });
  }

  function setupWindowBlurDetection() {
    window.addEventListener('blur', function () {
      emitDetection('window_blur', 'Window lost focus');
      captureScreenshotAndSend('window_blur', 'Exam window lost focus - possible cheating');
    });
  }

  function setupFullscreenDetection() {
    document.addEventListener('fullscreenchange', function () {
      if (!document.fullscreenElement) {
        emitDetection('fullscreen_exit', 'Left fullscreen');
        captureScreenshotAndSend('fullscreen_exit', 'Student exited fullscreen mode during exam');
        showWarning('Please stay in fullscreen.');
      }
    });
  }

  // 🧠 Comprehensive Browser/System Detection Functions
  
  function setupDevToolsDetection() {
    var devtools = {
      open: false,
      orientation: null
    };
    var threshold = 160;
    
    setInterval(function() {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          emitDetection('devtools_open', 'Developer tools detected');
          captureScreenshotAndSend('devtools_open', 'Developer tools were opened - code inspection');
          showWarning('Developer tools are not allowed.');
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }
  
  function setupContextMenuPrevention() {
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      if (!contextMenuPrevented) {
        contextMenuPrevented = true;
        emitDetection('right_click_usage', 'Right-click attempted');
        setTimeout(function() { contextMenuPrevented = false; }, 5000);
      }
    });
  }
  
  function setupCopyPastePrevention() {
    document.addEventListener('copy', function(e) {
      e.preventDefault();
      emitDetection('copy_paste_attempt', 'Copy attempt detected');
      showWarning('Copy/Paste is not allowed.');
    });
    
    document.addEventListener('paste', function(e) {
      e.preventDefault();
      emitDetection('copy_paste_attempt', 'Paste attempt detected');
      showWarning('Copy/Paste is not allowed.');
    });
    
    document.addEventListener('cut', function(e) {
      e.preventDefault();
      emitDetection('copy_paste_attempt', 'Cut attempt detected');
      showWarning('Copy/Paste is not allowed.');
    });
  }
  
  function setupNavigationPrevention() {
    // Prevent back/forward navigation
    window.addEventListener('popstate', function(e) {
      e.preventDefault();
      emitDetection('back_forward_navigation', 'Back/Forward navigation attempted');
      history.pushState(null, null, location.href);
      showWarning('Navigation is not allowed during exam.');
    });
    
    // Prevent page refresh
    window.addEventListener('beforeunload', function(e) {
      e.preventDefault();
      emitDetection('page_refresh_attempt', 'Page refresh attempted');
      e.returnValue = 'Your exam will be submitted if you leave this page.';
      return e.returnValue;
    });
    
    // Prevent new window opening
    document.addEventListener('click', function(e) {
      if (e.target.tagName === 'A' && e.target.target === '_blank') {
        e.preventDefault();
        emitDetection('new_browser_window', 'New window attempted');
        showWarning('Opening new windows is not allowed.');
      }
    });
  }
  
  function setupMultipleTabDetection() {
    tabSwitchCount = 0;
    var tabCheckInterval = setInterval(function() {
      if (document.hidden) {
        tabSwitchCount++;
        if (tabSwitchCount > 1) {
          emitDetection('multiple_tab_open', 'Multiple tabs detected');
          captureScreenshotAndSend('multiple_tab_open', 'Multiple browser tabs detected simultaneously');
          showWarning('Multiple tabs are not allowed.');
        }
      } else {
        tabSwitchCount = 0;
      }
    }, 1000);
  }
  
  function setupRapidAnswerDetection() {
    document.addEventListener('change', function(e) {
      if (e.target.dataset.questionId) {
        var now = Date.now();
        answerTimes.push(now);
        
        // Keep only recent answer times
        answerTimes = answerTimes.filter(function(time) {
          return now - time < RAPID_ANSWER_WINDOW_MS;
        });
        
        if (answerTimes.length >= RAPID_ANSWER_THRESHOLD) {
          emitDetection('rapid_answer_pattern', 'Rapid answer submission detected');
          showWarning('Suspicious answer pattern detected.');
        }
      }
    });
  }
  
  // ===== BEHAVIOR-BASED DETECTIONS =====
  
  function setupPasteDetection() {
    document.addEventListener('paste', function(e) {
      // Check if paste is happening in an answer field
      var target = e.target;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') && target.dataset.questionId) {
        var now = Date.now();
        
        // Prevent rapid duplicate paste events
        if (now - lastPasteTime > 2000) {
          lastPasteTime = now;
          emitDetection('paste_detected', 'Paste detected in answer field', 'BEHAVIOR');
          showWarning('Copy-paste detected. This may be flagged as malpractice.');
        }
      }
    });
  }
  
  function setupTypingSpeedDetection() {
    document.addEventListener('keydown', function(e) {
      // Only track typing in answer fields
      var target = e.target;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') && target.dataset.questionId) {
        var now = Date.now();
        
        // Start tracking typing for this answer
        if (!typingStartTime) {
          typingStartTime = now;
          keystrokeCount = 0;
        }
        
        keystrokeCount++;
        lastInputTime = now;
        currentAnswerLength = target.value.length;
      }
    });
    
    // Check typing speed when user stops typing or submits answer
    document.addEventListener('keyup', function(e) {
      var target = e.target;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') && target.dataset.questionId) {
        // Delay to check after typing stops
        setTimeout(function() {
          if (typingStartTime && Date.now() - lastInputTime > 2000) {
            checkTypingSpeed(target.value.length);
            typingStartTime = null;
            keystrokeCount = 0;
          }
        }, 2000);
      }
    });
  }
  
  function checkTypingSpeed(answerLength) {
    if (!typingStartTime || keystrokeCount < 10) return; // Need minimum keystrokes
    
    var typingDuration = (Date.now() - typingStartTime) / 1000; // seconds
    var charsPerSecond = answerLength / typingDuration;
    
    // Detect abnormal typing speed: > 15 chars/sec AND answer length > 150
    if (charsPerSecond > 15 && answerLength > 150) {
      var details = 'Abnormal typing speed: ' + charsPerSecond.toFixed(1) + ' chars/sec for ' + answerLength + ' characters';
      emitDetection('abnormal_typing_speed', details, 'BEHAVIOR');
      showWarning('Unusual typing speed detected.');
    }
  }
  
  function setupInactivityDetection() {
    // Check for long inactivity periods
    setInterval(function() {
      var now = Date.now();
      var inactivityDuration = (now - lastInputTime) / 1000; // seconds
      
      if (inactivityDuration > 60) {
        longInactivityStartTime = lastInputTime;
      } else {
        longInactivityStartTime = null;
      }
    }, 5000);
  }
  
  function checkSuddenAnswerAfterInactivity(answerLength) {
    if (longInactivityStartTime && answerLength > 100) {
      var inactivityDuration = (Date.now() - longInactivityStartTime) / 1000;
      var details = 'Sudden answer after ' + inactivityDuration.toFixed(0) + ' seconds of inactivity';
      emitDetection('sudden_answer_after_inactivity', details, 'BEHAVIOR');
      showWarning('Sudden answer after long inactivity detected.');
      longInactivityStartTime = null;
    }
  }
  
  function setupTabSwitchBeforeAnswerDetection() {
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        lastTabSwitchTime = Date.now();
      }
    });
  }
  
  function checkTabSwitchBeforeAnswer(answerLength) {
    if (lastTabSwitchTime > 0 && answerLength > 100) {
      var timeSinceTabSwitch = (Date.now() - lastTabSwitchTime) / 1000;
      if (timeSinceTabSwitch < 30) { // Tab switch within 30 seconds of submitting answer
        var details = 'Tab switch detected ' + timeSinceTabSwitch.toFixed(0) + ' seconds before answer submission';
        emitDetection('tab_switch_before_answer', details, 'BEHAVIOR');
        showWarning('Tab switching before answer detected.');
      }
      lastTabSwitchTime = 0;
    }
  }

  function checkRapidTabSwitch() {
    if (tabSwitchCount >= RAPID_TAB_COUNT && (Date.now() - lastTabSwitchTime) <= RAPID_TAB_WINDOW_MS) {
      emitDetection('rapid_tab_switch', 'Repeated rapid tab switching');
      tabSwitchCount = 0;
    }
  }

  function setupIdleDetection() {
    function onInput() { lastInputTime = Date.now(); }
    document.addEventListener('mousemove', onInput);
    document.addEventListener('keydown', onInput);
    document.addEventListener('mousedown', onInput);
  }

  function checkIdle() {
    if (Date.now() - lastInputTime > IDLE_SECONDS * 1000) {
      emitDetection('idle', 'No input for ' + IDLE_SECONDS + ' seconds');
      lastInputTime = Date.now();
    }
  }

  function checkFacePresence() {
    var sample = sampleFrameLuminance();
    if (!sample) return;
    var hasMotionOrContent = sample.variance > 50;
    if (hasMotionOrContent) {
      lastFacePresentTime = Date.now();
      faceOffStartTime = null;
    } else {
      if (!faceOffStartTime) faceOffStartTime = Date.now();
      var offSec = (Date.now() - faceOffStartTime) / 1000;
      if (offSec > FACE_OFF_THRESHOLD_SEC) {
        emitDetection('no_face', 'No face detected for ' + Math.floor(offSec) + 's');
        emitDetection('face_off_duration', 'Face off screen for ' + Math.floor(offSec) + 's');
        captureScreenshotAndSend('no_face', 'Student face not visible in camera for ' + Math.floor(offSec) + ' seconds');
        faceOffStartTime = Date.now();
      }
    }
  }

  var headMovementCount = 0;
  var headMovementWindowStart = 0;
  function checkHeadTurned() {
    var sample = sampleFrameLuminance();
    if (!sample || !lastFrameData) { lastFrameData = sample; return; }
    var diff = Math.abs(sample.avg - lastFrameData.avg);
    if (diff > 40) {
      emitDetection('head_turned', 'Significant frame change');
      headMovementCount++;
      if (Date.now() - headMovementWindowStart > 20000) {
        headMovementWindowStart = Date.now();
        headMovementCount = 0;
      }
      if (headMovementCount >= 4) {
        emitDetection('head_movement', 'Frequent head movement');
        headMovementCount = 0;
      }
    }
    lastFrameData = sample;
  }

  function checkCameraBlocked() {
    if (!stream) return;
    var videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== 'live') {
      emitDetection('camera_blocked', 'Camera disabled or not live');
      return;
    }
    var sample = sampleFrameLuminance();
    if (sample && sample.variance < 5 && sample.avg < 10) {
      emitDetection('camera_blocked', 'Camera possibly blocked (very dark)');
    }
  }

  function setupAudioAnalysis() {
    if (!stream) return;
    var audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      var source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
    } catch (e) {}
  }

  function checkNoise() {
    if (!analyser) return;
    var data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    var sum = 0;
    for (var i = 0; i < data.length; i++) sum += data[i];
    var avg = data.length ? sum / data.length : 0;
    if (avg > 80 && Date.now() - lastNoiseTime > 5000) {
      emitDetection('noise_detected', 'Audio level above threshold');
      lastNoiseTime = Date.now();
    }
  }

  function checkMicDisabled() {
    if (!stream) return;
    var audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || audioTrack.readyState !== 'live' || audioTrack.enabled === false) {
      emitDetection('mic_disabled', 'Microphone disabled');
    }
  }

  function runMonitorCycle() {
    checkRapidTabSwitch();
    checkIdle();
    checkFacePresence();
    checkHeadTurned();
    checkCameraBlocked();
    checkNoise();
    checkMicDisabled();
    requestFullscreen();
  }

  function initMedia() {
    return navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(function (s) {
        stream = s;
        localVideo = document.getElementById('localVideo');
        faceCanvas = document.getElementById('faceCanvas');
        if (localVideo) localVideo.srcObject = stream;
        setupAudioAnalysis();
        var status = document.getElementById('permissionStatus');
        if (status) status.textContent = 'Camera and microphone enabled.';
        return stream;
      })
      .catch(function (err) {
        var status = document.getElementById('permissionStatus');
        if (status) status.textContent = 'Camera/microphone required: ' + (err.message || 'Permission denied');
        if (socket && config.sessionId && config.examId) {
          emitDetection('camera_blocked', 'getUserMedia failed');
          emitDetection('mic_disabled', 'getUserMedia failed');
        }
        throw err;
      });
  }

  function loadQuestions() {
    console.log('=== LOADING QUESTIONS ===');
    console.log('Exam ID:', config.examId);
    console.log('Session ID:', config.sessionId);
    console.log('Questions API URL:', '/api/exams/' + config.examId + '/questions');
    
    return fetch('/api/exams/' + config.examId + '/questions', { credentials: 'include' })
      .then(function (r) { 
        console.log('Questions API response status:', r.status);
        console.log('Questions API response headers:', r.headers.get('content-type'));
        
        if (!r.ok) {
          return r.text().then(function(text) {
            console.error('Questions API error response:', text);
            console.error('Status:', r.status);
            console.error('Status Text:', r.statusText);
            throw new Error('Failed to load questions: ' + r.status + ' ' + text);
          });
        }
        
        return r.json(); 
      })
      .then(function (data) {
        console.log('Questions data received:', data);
        console.log('Number of questions:', data ? data.length : 0);
        if (data.error) throw new Error(data.error);
        questions = data || [];
        var container = document.getElementById('questionsContainer');
        if (!container) {
          console.error('Questions container not found');
          return;
        }
        container.innerHTML = '';
        questions.forEach(function (q, i) {
          console.log('Processing question', i + 1, ':', q.question_text);
          var block = document.createElement('div');
          block.className = 'question-block';
          block.innerHTML = '<h4>Q' + (i + 1) + '</h4><p>' + escapeHtml(q.question_text) + '</p>';
          if (q.type === 'mcq' && q.options) {
            try {
              var opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
              var radioGroup = 'q' + q.id;
              opts.forEach(function (opt, j) {
                var label = document.createElement('label');
                var input = document.createElement('input');
                input.type = 'radio';
                input.name = radioGroup;
                input.value = opt;
                input.dataset.questionId = q.id;
                label.appendChild(input);
                label.appendChild(document.createTextNode(' ' + opt));
                block.appendChild(label);
                block.appendChild(document.createElement('br'));
              });
            } catch (e) {
              console.error('Failed to parse MCQ options:', e);
            }
          } else {
            var input = document.createElement('textarea');
            input.dataset.questionId = q.id;
            input.style.width = '100%';
            block.appendChild(input);
          }
          container.appendChild(block);
        });
        console.log('=== QUESTIONS LOADED SUCCESSFULLY ===');
      })
      .catch(function (err) {
        console.error('=== QUESTIONS LOADING FAILED ===');
        console.error('Error:', err);
        console.error('Error message:', err.message);
        document.getElementById('questionsContainer').innerHTML = '<p class="alert error">' + escapeHtml(err.message) + '</p>';
        throw err;
      });
  }

  function escapeHtml(str) {
    if (str == null) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function saveAnswer(questionId, answerText) {
    return fetch('/api/sessions/' + config.sessionId + '/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ question_id: questionId, answer_text: answerText })
    });
  }

  function setupAnswerHandlers() {
    document.getElementById('questionsContainer').addEventListener('change', function (e) {
      var qId = e.target.dataset && e.target.dataset.questionId;
      if (!qId) return;
      var val = e.target.type === 'radio' ? e.target.value : e.target.value;
      
      // Check for behavior-based detections on answer change
      var answerLength = val ? val.length : 0;
      checkSuddenAnswerAfterInactivity(answerLength);
      checkTabSwitchBeforeAnswer(answerLength);
      
      saveAnswer(qId, val);
    });
    
    document.getElementById('questionsContainer').addEventListener('input', function (e) {
      var qId = e.target.dataset && e.target.dataset.questionId;
      if (!qId) return;
      var val = e.target.value;
      
      // Check for behavior-based detections during typing
      var answerLength = val ? val.length : 0;
      checkSuddenAnswerAfterInactivity(answerLength);
      checkTabSwitchBeforeAnswer(answerLength);
      
      saveAnswer(qId, val);
    });
  }

  function submitExam() {
    if (!confirm('Submit exam? You cannot change answers after submission.')) return;
    fetch('/api/sessions/' + config.sessionId, { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (session) {
        if (session && session.status === 'active') {
          return fetch('/api/sessions/' + config.sessionId + '/submit', {
            method: 'POST',
            credentials: 'include'
          }).catch(function () {});
        }
      })
      .then(function () {
        clearInterval(timerInterval);
        clearInterval(monitorInterval);
        document.getElementById('examContainer').classList.add('hidden');
        var term = document.getElementById('terminatedScreen');
        term.classList.remove('hidden');
        document.getElementById('terminatedReason').textContent = 'Exam submitted successfully.';
      });
  }

  function init() {
    console.log('Initializing student exam...');
    var params = new URLSearchParams(window.location.search);
    config.sessionId = params.get('sessionId');
    config.examId = params.get('examId');
    console.log('Session config:', config);
    console.log('URL sessionId:', params.get('sessionId'));
    console.log('URL examId:', params.get('examId'));
    console.log('Final config.sessionId:', config.sessionId);
    console.log('Final config.examId:', config.examId);
    
    if (!config.sessionId || !config.examId) {
      console.error('Invalid session parameters');
      document.getElementById('examTitle').textContent = 'Invalid session';
      return;
    }
    config.examTitle = sessionStorage.getItem('examTitle') || 'Exam';
    config.durationMinutes = parseInt(sessionStorage.getItem('examDuration') || '60', 10);
    document.getElementById('examTitle').textContent = config.examTitle;
    
    console.log('Starting initialization...');
    try {
      initAlarm(); // Initialize alarm system first
      initSocket();
      socket.emit('student_join_room', { sessionId: config.sessionId, examId: config.examId });
      
      // 🧠 Setup all comprehensive detection systems
      setupTabSwitchDetection();
      setupWindowBlurDetection();
      setupFullscreenDetection();
      setupIdleDetection();
      setupDevToolsDetection();
      setupContextMenuPrevention();
      setupCopyPastePrevention();
      setupNavigationPrevention();
      setupMultipleTabDetection();
      setupRapidAnswerDetection();
      
      // 🧠 BEHAVIOR-BASED DETECTIONS
      setupPasteDetection();
      setupTypingSpeedDetection();
      setupInactivityDetection();
      setupTabSwitchBeforeAnswerDetection();
      
      initMedia()
        .then(function () {
          console.log('Media initialized successfully');
          startTimer();
          monitorInterval = setInterval(runMonitorCycle, MONITOR_INTERVAL_MS);
          runMonitorCycle();
          requestFullscreen();
        })
        .catch(function (err) {
          console.error('Media initialization failed:', err);
          startTimer();
          monitorInterval = setInterval(runMonitorCycle, MONITOR_INTERVAL_MS);
        });
      loadQuestions()
        .then(setupAnswerHandlers)
        .catch(function (err) {
          console.error('Failed to load questions:', err);
          document.getElementById('questionsContainer').innerHTML = '<p class="alert error">' + escapeHtml(err.message) + '</p>';
        });
      document.getElementById('submitExamBtn').onclick = submitExam;
    } catch (error) {
      console.error('Error during initialization:', error);
      document.getElementById('questionsContainer').innerHTML = '<p class="alert error">Initialization error: ' + escapeHtml(error.message) + '</p>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
