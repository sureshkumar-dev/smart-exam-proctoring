# Student Key 403 Error Debug Guide

## 🔍 Issue Identified

Student is getting `403 (Forbidden)` error when trying to validate student key `S-3047`.

## 🛠️ Enhanced Debugging Added

### **Key Validation Endpoint Debugging**
```javascript
router.get('/validate-key', requireAuth, (req, res) => {
  console.log('=== KEY VALIDATION REQUEST ===');
  console.log('Key:', key);
  console.log('User ID:', req.user.id);
  console.log('User Role:', req.user.role);
  console.log('User Email:', req.user.email);
  
  getRoleForKey(key)
    .then(({ exam, role }) => {
      console.log('Key validation result:', { exam: exam ? 'found' : 'not found', role });
      
      if (role === 'student' && !['student', 'admin', 'proctor'].includes(req.user.role)) {
        console.log('STUDENT KEY ACCESS DENIED - User role:', req.user.role, 'Allowed: student, admin, proctor');
        return res.status(403).json({ error: 'Only students, admins, or proctors can use student exam key' });
      }
      
      console.log('KEY VALIDATION SUCCESS - Role:', role, 'Exam ID:', exam.id);
      // ... success response
    });
});
```

## 🧪 Testing Steps

### **Step 1: Check User Authentication**
In browser console, check current user:
```javascript
fetch('/api/auth/me', {credentials: 'include'})
  .then(r => r.json())
  .then(user => {
    console.log('Current user:', user);
    console.log('User role:', user.user.role);
    console.log('User email:', user.user.email);
  });
```

### **Step 2: Test Key Validation**
Try the key validation directly:
```javascript
fetch('/api/validate-key?key=S-3047', {credentials: 'include'})
  .then(r => {
    console.log('Validation status:', r.status);
    return r.json();
  })
  .then(result => {
    console.log('Validation result:', result);
  })
  .catch(err => {
    console.error('Validation error:', err);
  });
```

### **Step 3: Check Server Logs**
When you try to validate the key, server should show:
```
=== KEY VALIDATION REQUEST ===
Key: S-3047
User ID: [user_id]
User Role: [user_role]
User Email: [user_email]
Key validation result: {exam: 'found', role: 'student'}
KEY VALIDATION SUCCESS - Role: student, Exam ID: [exam_id]
```

## 🚨 Possible Issues & Solutions

### **Issue 1: User Not Authenticated**
**Symptoms:**
- `requireAuth` middleware blocks the request
- User gets 401/403 before key validation

**Solution:**
- Make sure user is logged in
- Check session is valid
- Verify authentication cookies

### **Issue 2: User Role Mismatch**
**Symptoms:**
- Server logs show wrong user role
- `STUDENT KEY ACCESS DENIED` message

**Current Allowed Roles:**
- `student` ✅
- `admin` ✅ 
- `proctor` ✅

**Solution:**
- Check if user has correct role
- Verify role in database
- Update user role if needed

### **Issue 3: Key Not Found**
**Symptoms:**
- Server logs show `exam: 'not found'`
- Key doesn't exist in database

**Solution:**
- Verify key exists in exams table
- Check key format (S-xxxx)
- Ensure exam is created

### **Issue 4: Database Connection**
**Symptoms:**
- `getRoleForKey` function fails
- Database query errors

**Solution:**
- Check database connection
- Verify exams table exists
- Check SQL query syntax

## 📋 Expected Working Flow

**Student Joins with Valid Key:**
```
=== KEY VALIDATION REQUEST ===
Key: S-3047
User ID: 123
User Role: student
User Email: student@example.com
Key validation result: {exam: 'found', role: 'student'}
KEY VALIDATION SUCCESS - Role: student, Exam ID: 456
```

**Response:**
```json
{
  "valid": true,
  "role": "student",
  "examId": 456,
  "examTitle": "Test Exam",
  "durationMinutes": 60
}
```

## 🔧 Quick Fixes

### **Fix 1: Ensure Authentication**
```javascript
// Check if user is logged in
fetch('/api/auth/me', {credentials: 'include'})
  .then(r => {
    if (r.status === 200) {
      console.log('✅ User authenticated');
      return r.json();
    } else {
      console.log('❌ User not authenticated');
      throw new Error('Not authenticated');
    }
  });
```

### **Fix 2: Verify User Role**
Check database directly:
```sql
SELECT id, email, role FROM users WHERE email = 'student@example.com';
```

### **Fix 3: Verify Key Exists**
Check database directly:
```sql
SELECT id, title, student_key FROM exams WHERE student_key = 'S-3047';
```

## 🎯 Next Steps

1. **Test the enhanced debugging** - try validating key S-3047
2. **Check server console** for detailed logs
3. **Identify the exact failure point**
4. **Apply targeted fix** based on findings

The enhanced debugging will show exactly why the 403 error is occurring!
