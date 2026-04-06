# Alarm Debugging Guide

## 🔍 Debugging the Auto-Termination Alarm

I've added comprehensive debugging to help identify why the alarm isn't playing when the exam is auto-terminated.

---

## 📊 Testing Steps

### **Step 1: Start the Server with Debugging**
```bash
cd exam-proctoring-app
node server.js
```

### **Step 2: Join Exam as Student**
1. Go to `http://localhost:3000`
2. Login as student: `student@test.com / student123`
3. Join exam with student key
4. Start exam

### **Step 3: Trigger Auto-Termination**
Accumulate 100+ malpractice points by:
- Switching tabs multiple times (5 points each)
- Opening DevTools (15 points)
- Pasting content (40 points)
- Or any combination that reaches 100 points

---

## 🔍 What to Check in Console

### **Student Browser Console (F12)**

#### **1. Alarm Initialization (should see on page load):**
```
=== INITIALIZING ALARM SYSTEM ===
Alarm audio object created: [object HTMLAudioElement]
Alarm src: http://localhost:3000/assets/alarm.wav
Alarm preload: auto
Alarm volume: 1
Alarm initialization failed (expected due to autoplay): NotAllowedError
This is normal - alarm will work on user interaction
=== ALARM INITIALIZATION COMPLETE ===
```

#### **2. When Exam Terminates (should see):**
```
=== EXAM TERMINATED EVENT RECEIVED ===
Full data object: {sessionId: 123, reason: "score_threshold", totalScore: 105, eventType: "tab_switch"}
Reason: score_threshold
Total Score: 105
Event Type: tab_switch
Alarm Audio Status: initialized
Alarm Played Status: false
Processing termination - Reason: score_threshold EventType: tab_switch
Calling playTerminationAlarm for score_threshold
=== PLAY TERMINATION ALARM CALLED ===
Reason: score_threshold
EventType: tab_switch
Alarm Played: false
Alarm Audio: exists
Is Critical Violation: false
Is Score Threshold: true
PROCEEDING WITH ALARM PLAYBACK
Audio reset - currentTime: 0 loop: true
Play promise: [object Promise]
ALARM PLAYING SUCCESSFULLY
Added alarm-active CSS class
=== PLAY TERMINATION ALARM FUNCTION END ===
=== EXAM TERMINATED PROCESSING COMPLETE ===
```

### **Server Console (should see):**
```
=== AUTO-TERMINATING EXAM ===
Session ID: 123
New Score: 105
Event Type: tab_switch
Critical Score Threshold: 100
Broadcasting termination event: {sessionId: 123, reason: "score_threshold", totalScore: 105, eventType: "tab_switch"}
=== AUTO-TERMINATION COMPLETE ===
```

---

## 🚨 Common Issues & Solutions

### **Issue 1: Alarm Not Playing**
**Symptoms:**
- Console shows "ALARM PLAY FAILED: NotAllowedError"
- See "Click anywhere to hear alarm" message

**Solution:**
- Click anywhere on the page after termination
- This is normal due to browser autoplay policies

### **Issue 2: Alarm Not Called**
**Symptoms:**
- Console shows "Not playing alarm - not a critical violation"
- Reason is not "score_threshold"

**Solution:**
- Check if score actually reached 100 points
- Verify the termination reason in server console

### **Issue 3: Alarm Audio Not Found**
**Symptoms:**
- Console shows alarm src as incorrect path
- 404 error for alarm.wav

**Solution:**
- Verify `assets/alarm.wav` exists
- Check file path: `../assets/alarm.wav`

### **Issue 4: Alarm Already Played**
**Symptoms:**
- Console shows "EARLY RETURN - alarmPlayed: true"

**Solution:**
- Refresh page and test again
- Check if alarmPlayed flag is being reset properly

---

## 🧪 Quick Test Commands

### **Test 1: Manual Alarm Trigger**
Open browser console and run:
```javascript
playTerminationAlarm('score_threshold', 'tab_switch');
```

### **Test 2: Check Alarm State**
```javascript
console.log('Alarm Audio:', alarmAudio);
console.log('Alarm Played:', alarmPlayed);
console.log('Critical Violations:', CRITICAL_VIOLATIONS);
```

### **Test 3: Force Alarm Play**
```javascript
if (alarmAudio) {
  alarmAudio.play().then(() => {
    console.log('Manual alarm play successful');
  }).catch(err => {
    console.log('Manual alarm play failed:', err);
  });
}
```

---

## 📋 Expected vs Actual

### **Expected Behavior:**
1. Student reaches 100+ points
2. Server sends termination event
3. Student receives event
4. Alarm plays (or shows click fallback)
5. Red blinking background appears

### **If Not Working:**
1. Check which step fails in console logs
2. Verify alarm file exists and is accessible
3. Check browser autoplay restrictions
4. Test manual alarm trigger

---

## 🎯 Debugging Checklist

- [ ] Server shows auto-termination logs
- [ ] Student receives termination event
- [ ] Alarm initialization completed
- [ ] playTerminationAlarm is called
- [ ] Alarm play promise resolves
- [ ] Visual effects appear
- [ ] Audio file loads correctly

---

## 🔧 If Still Not Working

1. **Share the console logs** from both server and student
2. **Check the Network tab** for alarm.wav file (should be 200 OK)
3. **Test manual alarm trigger** in console
4. **Verify browser compatibility** (Chrome, Firefox, Safari)

The debugging will show exactly where the alarm system is failing!
