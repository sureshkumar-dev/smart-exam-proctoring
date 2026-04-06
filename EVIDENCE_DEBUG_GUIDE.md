# Evidence Screenshot Debugging Guide

## 🚨 Issue Identified

**Problem**: Evidence screenshots are being uploaded but with `session_unknown` in filenames, indicating the `sessionId` is not being properly passed from frontend to backend.

**Evidence**: 
- ✅ Screenshots are being captured (many files in uploads directory)
- ❌ All files named `session_unknown_*` instead of `session_[actualId]_*`
- ❌ Evidence not properly associated with student sessions

---

## 🔧 Debugging Implementation

### **Frontend Debugging Added**

#### **1. Exam Initialization (`exam.js`)**
```javascript
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
}
```

#### **2. Screenshot Capture (`exam.js`)**
```javascript
function captureScreenshotAndSend(eventType, details) {
  console.log('Attempting to capture screenshot for:', eventType);
  console.log('Current config.sessionId:', config.sessionId);
  console.log('Current config.examId:', config.examId);
  
  // ... existing validation code ...
  
  console.log('Uploading evidence blob:', blob.size, 'bytes');
  console.log('FormData sessionId being sent:', config.sessionId);
  
  var fd = new FormData();
  fd.append('screenshot', blob, 'evidence.png');
  fd.append('sessionId', config.sessionId);
  // ... other fields ...
  
  console.log('FormData entries:');
  for (var pair of fd.entries()) {
    console.log(pair[0] + ':', pair[1]);
  }
}
```

### **Backend Debugging Added**

#### **3. Evidence Upload Endpoint (`server.js`)**
```javascript
app.post('/api/evidence/upload', upload.single('screenshot'), (req, res) => {
  console.log('Evidence upload request received');
  console.log('Request body sessionId:', req.body.sessionId);
  console.log('Request file:', req.file ? req.file.filename : 'No file');
  console.log('User authenticated:', req.isAuthenticated ? req.isAuthenticated() : false);
  console.log('User ID:', req.user ? req.user.id : 'No user');
  
  // ... existing code ...
  
  console.log('Processed sessionId:', sessionId);
  console.log('EventType:', eventType);
});
```

---

## 🧪 Testing Steps

### **Step 1: Start Server with Debugging**
```bash
cd exam-proctoring-app
node server.js
```

### **Step 2: Join Exam as Student**
1. Go to `http://localhost:3000`
2. Login as student: `student@test.com / student123`
3. Enter student exam key (e.g., `S-1234`)
4. Click "Start Exam"

### **Step 3: Check Console Logs**
Open browser developer tools (F12) and check console for:

**Expected Initialization Logs:**
```
Initializing student exam...
Session config: {sessionId: "123", examId: "456"}
URL sessionId: 123
URL examId: 456
Final config.sessionId: 123
Final config.examId: 456
```

**Expected Screenshot Logs (when violation occurs):**
```
Attempting to capture screenshot for: tab_switch
Current config.sessionId: 123
Current config.examId: 456
Video frame drawn to canvas
Uploading evidence blob: 596445 bytes
FormData sessionId being sent: 123
FormData entries:
screenshot: [object File]
sessionId: 123
eventType: tab_switch
details: Student switched tabs
timestamp: 2026-02-04T...
score: 25
Evidence upload response status: 200
Evidence upload response: {id: 789, filePath: "/uploads/session_123_1754321123456.png"}
```

### **Step 4: Check Server Console**
Look for these logs in server terminal:

**Expected Server Logs:**
```
Evidence upload request received
Request body sessionId: 123
Request file: session_123_1754321123456.png
User authenticated: true
User ID: 2
Processed sessionId: 123
EventType: tab_switch
```

---

## 🔍 Diagnosis Guide

### **If You See `session_unknown` in Filenames:**

**Check Frontend Console:**
- ❌ `Final config.sessionId: null` → URL parameters not parsed correctly
- ❌ `FormData sessionId being sent: null` → config.sessionId lost
- ✅ `FormData sessionId being sent: 123` → Frontend working

**Check Server Console:**
- ❌ `Request body sessionId: undefined` → FormData not sent correctly
- ❌ `Request body sessionId: null` → Frontend sending null
- ✅ `Request body sessionId: 123` → Server receiving correctly

### **Common Issues & Solutions:**

#### **Issue 1: URL Parameters Missing**
**Symptoms:**
```
URL sessionId: null
URL examId: null
```
**Solution:** Check student.js redirect URL construction

#### **Issue 2: SessionId Lost During Execution**
**Symptoms:**
```
Final config.sessionId: 123
FormData sessionId being sent: null
```
**Solution:** Check if config object is being reset

#### **Issue 3: FormData Not Sending Correctly**
**Symptoms:**
```
FormData sessionId being sent: 123
Request body sessionId: undefined
```
**Solution:** Check fetch request construction

---

## 🚀 Expected Results After Fix

**Before Fix:**
```
uploads/session_unknown_1754321123456.png
uploads/session_unknown_1754321123457.png
```

**After Fix:**
```
uploads/session_123_1754321123456.png
uploads/session_123_1754321123457.png
```

**Evidence should appear in:**
- ✅ Proctor dashboard evidence section
- ✅ Admin reports with correct session association
- ✅ Database evidence table with proper session_id

---

## 📋 Next Steps

1. **Run the test** with debugging enabled
2. **Check console logs** for the specific failure point
3. **Share the logs** if issue persists
4. **Verify evidence appears** in proctor/admin dashboards

The debugging will pinpoint exactly where the sessionId is being lost in the process! 🎯
