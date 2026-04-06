# Report Loading Error Debugging Guide

## 🔍 Issue Analysis

The error "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" indicates that the server is returning an HTML page (likely a 404 error page) instead of JSON when trying to load reports. This happens when:

1. **User is not authenticated as admin**
2. **Exam doesn't exist or user doesn't own it**
3. **API endpoint is not found**
4. **Authentication middleware redirects to login**

---

## 🛠️ Debugging Steps

### **Step 1: Test the Flow**
1. Start server: `node server.js`
2. Login as admin (not student)
3. Go to Reports section
4. Select an exam from dropdown
5. Check both server and admin console logs

---

## 📊 What to Check in Console

### **Admin Console (F12) Should Show:**
```
=== LOADING EXAM REPORT ===
Exam ID: 7
Reports API URL: /api/exams/7/reports
Reports API response status: 404
Reports API error response: <!DOCTYPE html><html>...
Status: 404
Status Text: Not Found
=== REPORT LOADING FAILED ===
Error: Failed to load report: 404 <!DOCTYPE html>...
```

### **Server Console Should Show:**
```
=== REPORTS API REQUEST ===
Exam ID: 7
User ID: 1
User Role: admin
User Email: admin@test.com
Exam found: NO
Returning 404 - Exam not found or not owned by user
```

---

## 🚨 Common Issues & Solutions

### **Issue 1: Not Logged In as Admin**
**Symptoms:**
- Admin console shows 404 HTML response
- Server shows no request logs
- Redirected to login page

**Solution:**
- Login as admin user (not student)
- Check authentication status

### **Issue 2: Exam Doesn't Exist**
**Symptoms:**
- Server shows "Exam found: NO"
- Returns 404 error

**Solution:**
- Check if exam ID exists in database
- Verify admin created the exam

### **Issue 3: Admin Doesn't Own Exam**
**Symptoms:**
- Server shows "Exam found: NO"
- Exam exists but created by different user

**Solution:**
- Check exam ownership in database
- Use correct admin account

---

## 🔧 Quick Fixes

### **Fix 1: Verify Admin Login**
Make sure you're logged in as admin:
```
SELECT id, email, role FROM users WHERE role = 'admin';
```

### **Fix 2: Check Exam Ownership**
```sql
SELECT id, title, created_by FROM exams WHERE id = 7;
```

### **Fix 3: Verify Exam Exists**
```sql
SELECT * FROM exams;
```

---

## 🧪 Manual Testing

### **Test API Directly**
When logged in as admin, open:
```
http://localhost:3000/api/exams/7/reports
```

**Expected:** JSON array of sessions
**Broken:** HTML 404 page

### **Test with Different Exam IDs**
Try different exam IDs to find one that works:
```
http://localhost:3000/api/exams/1/reports
http://localhost:3000/api/exams/2/reports
```

---

## 📋 Expected vs Actual

### **Expected Flow:**
1. Admin logs in successfully
2. Admin selects exam from dropdown
3. API returns JSON with sessions
4. Report displays with evidence

### **If Not Working:**
1. Check admin authentication
2. Verify exam exists and is owned by admin
3. Check API endpoint accessibility
4. Verify database records

---

## 🎯 Debugging Checklist

- [ ] User is logged in as admin (not student)
- [ ] Exam exists in database
- [ ] Admin owns the exam (created_by matches)
- [ ] API endpoint is accessible
- [ ] Authentication headers are sent
- [ ] Database queries are working

---

## 🔍 Common Database Issues

### **Check Database State:**
```sql
-- List all exams with owners
SELECT e.id, e.title, e.created_by, u.email as owner_email
FROM exams e 
JOIN users u ON e.created_by = u.id;

-- Check admin users
SELECT id, email, role FROM users WHERE role = 'admin';

-- Check sessions for exam
SELECT s.id, s.exam_id, s.user_id, u.email 
FROM sessions s 
JOIN users u ON s.user_id = u.id
WHERE s.exam_id = 7;
```

---

## 🚀 Immediate Actions

1. **Verify admin login** - make sure you're logged in as admin
2. **Check database** for exam existence and ownership
3. **Test API directly** in browser
4. **Check authentication** headers are being sent

The debugging will show exactly where the JSON parsing error is coming from!
