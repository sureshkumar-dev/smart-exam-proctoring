# Questions 404 Error Debugging Guide

## 🔍 Issue Analysis

Students are getting a 404 error when trying to load questions after joining an exam. This could be due to several reasons:

1. **Exam doesn't exist**
2. **Student doesn't have an active session**
3. **Exam has no questions**
4. **Authentication issues**

---

## 🛠️ Debugging Steps

### **Step 1: Test the Flow**
1. Start server: `node server.js`
2. Login as student: `student@test.com / student123`
3. Join exam with student key
4. Click "Start Exam"
5. Check both server and student console logs

---

## 📊 What to Check in Console

### **Student Console (F12) Should Show:**
```
=== LOADING QUESTIONS ===
Exam ID: 7
Session ID: 13
Questions API URL: /api/exams/7/questions
Questions API response status: 404
Questions API error response: {"error":"Exam not found"}
Status: 404
Status Text: Not Found
=== QUESTIONS LOADING FAILED ===
```

### **Server Console Should Show:**
```
=== QUESTIONS API REQUEST ===
Exam ID: 7
User ID: 2
User Role: student
User Email: student@test.com
Exam found: NO
Returning 404 - Exam not found
```

---

## 🚨 Common Issues & Solutions

### **Issue 1: Exam ID Mismatch**
**Symptoms:**
- Student tries to load questions for exam ID 7
- Server shows "Exam found: NO"

**Solution:**
- Check if exam ID 7 exists in database
- Verify student joined the correct exam

### **Issue 2: No Active Session**
**Symptoms:**
- Server shows "Exam found: YES"
- Server shows "Active session found: NO"
- Returns 403 error

**Solution:**
- Student must join exam first
- Check if session was created properly

### **Issue 3: No Questions Added**
**Symptoms:**
- Server shows "Exam found: YES"
- Server shows "Active session found: YES"
- Server shows "Questions found: 0"

**Solution:**
- Admin needs to add questions to the exam
- Check if questions were saved properly

---

## 🔧 Quick Fixes

### **Fix 1: Verify Exam Exists**
Run this in server console or check database:
```sql
SELECT * FROM exams WHERE id = 7;
```

### **Fix 2: Check Student Session**
```sql
SELECT * FROM sessions WHERE exam_id = 7 AND user_id = 2 AND status = 'active';
```

### **Fix 3: Verify Questions Exist**
```sql
SELECT * FROM questions WHERE exam_id = 7;
```

---

## 🧪 Manual Testing

### **Test API Directly**
Open in browser (when logged in as student):
```
http://localhost:3000/api/exams/7/questions
```

### **Test with Admin**
Login as admin and try:
```
http://localhost:3000/api/exams/7/questions
```

---

## 📋 Expected vs Actual

### **Expected Flow:**
1. Student joins exam → Session created
2. Student starts exam → Questions loaded
3. Server shows active session
4. Questions returned successfully

### **If Not Working:**
1. Check which step fails in console logs
2. Verify database records exist
3. Check authentication status

---

## 🎯 Debugging Checklist

- [ ] Student is logged in
- [ ] Exam exists in database
- [ ] Student has active session for exam
- [ ] Exam has questions added
- [ ] Authentication headers are sent
- [ ] API endpoint is accessible

---

## 🔍 Common Database Issues

### **Check Database State:**
```sql
-- List all exams
SELECT id, title, student_key, proctor_key FROM exams;

-- Check student sessions
SELECT s.id, s.exam_id, s.user_id, s.status, u.email 
FROM sessions s 
JOIN users u ON s.user_id = u.id;

-- Check exam questions
SELECT q.exam_id, q.question_text, q.type 
FROM questions q 
JOIN exams e ON q.exam_id = e.id;
```

---

## 🚀 Immediate Actions

1. **Test the flow** and share console logs
2. **Check database** for exam/session existence
3. **Verify questions** were added to exam
4. **Check authentication** is working

The debugging will show exactly where the 404 error is coming from!
