# Exam Creation Error Debugging Guide

## 🔍 Issue Analysis

The error "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" when creating exams indicates that the server is returning an HTML page (likely a login/404 page) instead of JSON. This happens when:

1. **User is not authenticated as admin**
2. **Authentication middleware redirects to login**
3. **API endpoint is not found**
4. **Session expired**

---

## 🛠️ Debugging Steps

### **Step 1: Test the Flow**
1. Start server: `node server.js`
2. **Login as ADMIN** (not student)
3. Go to admin dashboard
4. Try to create an exam
5. Check both server and admin console logs

---

## 📊 What to Check in Console

### **Admin Console (F12) Should Show:**
```
Create exam response status: 404
Create exam response headers: text/html
Create exam error response: <!DOCTYPE html><html>...
Error creating exam: Failed to create exam: 404 <!DOCTYPE html>...
```

### **Server Console Should Show:**
```
=== CREATE EXAM API REQUEST ===
User ID: 1
User Role: admin
User Email: admin@test.com
Request Body: {title: "Test Exam", duration_minutes: 60}
```

**If NOT showing server logs, the request never reached the API endpoint!**

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
- Verify session is active

### **Issue 2: Session Expired**
**Symptoms:**
- Request reaches server but authentication fails
- Server shows authentication error

**Solution:**
- Logout and login again
- Check session timeout settings

### **Issue 3: Wrong URL**
**Symptoms:**
- Request goes to wrong endpoint
- 404 error from server

**Solution:**
- Verify API endpoint is `/api/exams` with POST
- Check server routing

---

## 🔧 Quick Fixes

### **Fix 1: Verify Admin Login**
Make sure you're logged in as admin:
```sql
SELECT id, email, role FROM users WHERE role = 'admin';
```

### **Fix 2: Check Authentication**
In browser console, check:
```javascript
// Check if authenticated
fetch('/api/auth/me', {credentials: 'include'})
  .then(r => r.json())
  .then(user => console.log('Current user:', user));
```

### **Fix 3: Manual API Test**
When logged in as admin, test with curl or browser:
```bash
curl -X POST http://localhost:3000/api/exams \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"Test Exam","duration_minutes":60}'
```

---

## 🧪 Manual Testing

### **Test API Directly**
When logged in as admin, open browser dev tools and run:
```javascript
fetch('/api/exams', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    title: 'Test Exam',
    duration_minutes: 60
  })
})
.then(r => {
  console.log('Status:', r.status);
  console.log('Headers:', r.headers.get('content-type'));
  return r.text();
})
.then(text => {
  console.log('Response:', text);
});
```

---

## 📋 Expected vs Actual

### **Expected Flow:**
1. Admin logged in successfully
2. POST request to `/api/exams`
3. Server receives request with admin user
4. Server creates exam and returns JSON
5. Client displays generated keys

### **If Not Working:**
1. Check admin authentication
2. Verify request reaches server
3. Check server logs for errors
4. Verify database operations

---

## 🎯 Debugging Checklist

- [ ] User is logged in as admin (not student)
- [ ] Session is active and not expired
- [ ] API endpoint is accessible
- [ ] Request reaches server (check logs)
- [ ] Database operations succeed
- [ ] Response is JSON format

---

## 🔍 Common Database Issues

### **Check Database State:**
```sql
-- Check admin users
SELECT id, email, role FROM users WHERE role = 'admin';

-- Check if exams table exists
SELECT name FROM sqlite_master WHERE type='table' AND name='exams';

-- Check recent exams
SELECT * FROM exams ORDER BY created_at DESC LIMIT 5;
```

---

## 🚀 Immediate Actions

1. **Verify admin login** - make sure you're logged in as admin
2. **Check server console** - see if request reaches API
3. **Test API manually** - use browser console to test
4. **Check authentication** - verify session is valid

The debugging will show exactly where the HTML response is coming from instead of JSON!
