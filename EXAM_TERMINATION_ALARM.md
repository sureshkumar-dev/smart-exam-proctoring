# Exam Termination Alarm System

## 🚨 Overview

Implemented a loud alarm sound system that plays **ONLY** when exams are terminated due to malpractice, following strict rules for when the alarm should and should not play.

---

## 🔧 Implementation Details

### **1. Alarm System Variables**
```javascript
// Alarm system for exam termination
var alarmAudio = null;
var alarmPlayed = false;

// Critical violations that should trigger alarm immediately
var CRITICAL_VIOLATIONS = {
  'multiple_faces': true,           // 25 points
  'camera_disabled': true,          // 30 points  
  'paste_detected': true,           // 40 points
  'abnormal_typing_speed': true,    // 25 points
  'sudden_answer_after_inactivity': true, // 30 points
  'manual_termination': true,       // 50 points
  'auto_termination': true          // 50 points
};
```

### **2. Alarm Initialization**
```javascript
function initAlarm() {
  try {
    alarmAudio = new Audio('../assets/alarm.wav');
    alarmAudio.preload = 'auto';
    alarmAudio.loop = true;
    alarmAudio.volume = 1.0;
    
    // Handle autoplay restrictions by attempting to play silently first
    alarmAudio.play().then(() => {
      alarmAudio.pause();
      alarmAudio.currentTime = 0;
      console.log('Alarm initialized successfully');
    }).catch((err) => {
      console.log('Alarm initialization failed (expected due to autoplay):', err.message);
    });
  } catch (err) {
    console.error('Failed to initialize alarm:', err);
  }
}
```

### **3. Alarm Trigger Logic**
```javascript
function playTerminationAlarm(reason, eventType) {
  if (alarmPlayed || !alarmAudio) return;
  
  console.log('Playing termination alarm for:', reason, eventType);
  
  // Check if this is a critical violation or score threshold
  var isCriticalViolation = CRITICAL_VIOLATIONS[eventType] || false;
  var isScoreThreshold = reason === 'score_threshold';
  
  if (!isCriticalViolation && !isScoreThreshold) {
    console.log('Not a critical violation, skipping alarm');
    return;
  }
  
  // Play alarm with visual effects
  // ...
}
```

---

## 📊 Alarm Trigger Rules

### **✅ ALARM PLAYS FOR:**

#### **Critical Violations (Immediate)**
- **multiple_faces** (25 points) - Multiple people detected
- **camera_disabled** (30 points) - Camera intentionally disabled
- **paste_detected** (40 points) - Content pasted into exam
- **abnormal_typing_speed** (25 points) - Superhuman typing detected
- **sudden_answer_after_inactivity** (30 points) - Answer after long idle
- **manual_termination** (50 points) - Proctor manually terminates
- **auto_termination** (50 points) - System auto-terminates

#### **Score Threshold (Cumulative)**
- **score_threshold** - When malpractice score reaches 100 points

### **❌ ALARM DOES NOT PLAY FOR:**

#### **Minor Violations (No Alarm)**
- **tab_switch** (5 points) - Tab switching
- **window_blur** (8 points) - Window loses focus
- **fullscreen_exit** (10 points) - Exits fullscreen
- **no_face** (10 points) - Face temporarily missing
- **head_turned_away** (6 points) - Looks away briefly
- **right_click_usage** (5 points) - Right-click attempt
- **background_noise** (8 points) - Background noise
- **suspicious_idle** (10 points) - Idle behavior

---

## 🎨 Visual Effects

### **CSS Animation**
```css
@keyframes blink {
  0% { opacity: 1; }
  50% { opacity: 0.3; }
  100% { opacity: 1; }
}

body.alarm-active {
  animation: blink 0.5s infinite;
  background-color: #ff0000 !important;
}
```

### **Visual Indicators**
- **Red background** with blinking animation
- **Terminated screen** with red border
- **Warning message**: "🚨 EXAM TERMINATED DUE TO MALPRACTICE! 🚨"

---

## 🔊 Browser Autoplay Handling

### **Autoplay Restrictions**
Modern browsers block autoplay until user interaction. The system handles this with:

#### **1. Preload Attempt**
```javascript
// Attempt silent preload to establish audio context
alarmAudio.play().then(() => {
  alarmAudio.pause();
  alarmAudio.currentTime = 0;
}).catch(() => {
  // Expected to fail due to autoplay policies
});
```

#### **2. Fallback on User Interaction**
```javascript
// If autoplay fails, wait for user click
document.addEventListener('click', function playAlarmOnClick() {
  alarmAudio.play().then(() => {
    alarmPlayed = true;
    document.body.classList.add('alarm-active');
    showWarning('🚨 EXAM TERMINATED DUE TO MALPRACTICE! 🚨');
  });
}, { once: true });
```

#### **3. User Guidance**
- Shows message: "🚨 EXAM TERMINATED! Click anywhere to hear alarm 🚨"
- Ensures user knows alarm needs interaction

---

## 🔄 Server Integration

### **Score Threshold Termination**
```javascript
if (newScore >= CRITICAL_SCORE) {
  await db.run('UPDATE sessions SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?', ['terminated', secureSessionId]);
  io.to('exam_' + examId).emit('exam_terminated', { 
    sessionId: secureSessionId, 
    reason: 'score_threshold', 
    totalScore: newScore,
    eventType: eventType 
  });
}
```

### **Manual Termination**
```javascript
await db.run('UPDATE sessions SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?', ['terminated', sessionId]);
io.to('exam_' + examId).emit('exam_terminated', { 
  sessionId, 
  reason: 'manual_proctor',
  eventType: 'manual_termination'
});
```

---

## 📱 Client-Side Event Handling

### **Exam Termination Event**
```javascript
socket.on('exam_terminated', function (data) {
  clearInterval(timerInterval);
  clearInterval(monitorInterval);
  document.getElementById('examContainer').classList.add('hidden');
  var term = document.getElementById('terminatedScreen');
  term.classList.remove('hidden');
  
  var reason = data.reason || 'unknown';
  var totalScore = data.totalScore || 0;
  var eventType = data.eventType || 'auto_termination';
  
  if (reason === 'score_threshold') {
    terminationMessage = 'Your exam was auto-terminated due to high malpractice score (' + totalScore + ').';
    playTerminationAlarm(reason, eventType);
  } else if (reason === 'manual_proctor') {
    terminationMessage = 'Your exam was terminated by the proctor.';
    playTerminationAlarm(reason, 'manual_termination');
  } else if (reason === 'critical_violation') {
    terminationMessage = 'Your exam was terminated due to critical malpractice violation.';
    playTerminationAlarm(reason, eventType);
  }
  
  // Visual effects
  document.getElementById('terminatedScreen').style.backgroundColor = '#ffe6e6';
  document.getElementById('terminatedScreen').style.border = '3px solid #ff0000';
});
```

---

## 🧪 Testing Scenarios

### **Test 1: Score Threshold**
1. Student accumulates 100+ malpractice points
2. **Expected**: Alarm plays, red blinking background
3. **Console**: "Playing termination alarm for: score_threshold"

### **Test 2: Critical Violation**
1. Student pastes content (40 points)
2. **Expected**: Alarm plays immediately
3. **Console**: "Playing termination alarm for: critical_violation paste_detected"

### **Test 3: Minor Violation**
1. Student switches tabs (5 points)
2. **Expected**: NO alarm, just warning message
3. **Console**: "Not a critical violation, skipping alarm"

### **Test 4: Manual Termination**
1. Proctor terminates exam manually
2. **Expected**: Alarm plays
3. **Console**: "Playing termination alarm for: manual_proctor manual_termination"

---

## 🎯 Key Features

### **Strict Compliance**
- ✅ **No alarm for minor violations**
- ✅ **Alarm only for critical violations**
- ✅ **Alarm for score threshold (100 points)**
- ✅ **Respects browser autoplay rules**
- ✅ **Uses existing alarm.wav file**

### **User Experience**
- ✅ **Loud, attention-grabbing alarm**
- ✅ **Visual red blinking effect**
- ✅ **Clear termination message**
- ✅ **Fallback for autoplay restrictions**
- ✅ **One-time play (no spam)**

### **Technical Robustness**
- ✅ **Error handling for audio failures**
- ✅ **Prevents multiple alarm plays**
- ✅ **Proper cleanup on stop**
- ✅ **Browser compatibility**
- ✅ **Mobile device support**

---

## 📋 Files Modified

### **Frontend**
- `public/student/exam.js` - Main alarm logic
- `public/styles.css` - Blinking animation

### **Backend**
- `server.js` - Event data enhancement

### **Assets**
- `assets/alarm.wav` - Existing alarm file (used as-is)

---

## 🚀 Result

The alarm system now provides **clear, immediate audio feedback** when exams are terminated due to serious malpractice, while **respecting the strict rule** of not playing for minor violations. The system handles browser autoplay restrictions gracefully and provides both audio and visual alerts for maximum impact.
