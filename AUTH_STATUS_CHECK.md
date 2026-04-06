# Authentication Status Check

## 🔍 Quick Test to Check Authentication

Let's verify if you're properly logged in and what your role is.

## 🧪 Test in Browser Console

Open your browser console (F12) and run this:

```javascript
// Check current authentication status
fetch('/api/auth/me', {credentials: 'include'})
  .then(r => {
    console.log('Auth status:', r.status);
    if (r.ok) {
      return r.json();
    } else {
      return r.text().then(text => {
        console.log('Auth error:', text);
        throw new Error('Not authenticated');
      });
    }
  })
  .then(user => {
    console.log('=== CURRENT USER INFO ===');
    console.log('User ID:', user.user.id);
    console.log('User Email:', user.user.email);
    console.log('User Role:', user.user.role);
    console.log('User Display Name:', user.user.display_name);
    console.log('Auth Provider:', user.user.auth_provider);
    console.log('========================');
    
    // Now test the key validation
    console.log('Testing key validation...');
    return fetch('/api/validate-key?key=S-4122', {credentials: 'include'});
  })
  .then(r => {
    console.log('Key validation status:', r.status);
    if (r.ok) {
      return r.json();
    } else {
      return r.text().then(text => {
        console.log('Key validation error:', text);
        throw new Error('Key validation failed');
      });
    }
  })
  .then(result => {
    console.log('=== KEY VALIDATION RESULT ===');
    console.log('Result:', result);
    console.log('========================');
  })
  .catch(err => {
    console.error('Error:', err.message);
  });
```

## 📊 What to Look For

### **If Authentication Works:**
```
=== CURRENT USER INFO ===
User ID: 123
User Email: your@email.com
User Role: student
User Display Name: Your Name
Auth Provider: manual
========================
Testing key validation...
Key validation status: 200
=== KEY VALIDATION RESULT ===
Result: {valid: true, role: "student", examId: 456, ...}
========================
```

### **If Authentication Fails:**
```
Auth status: 401
Auth error: <!DOCTYPE html><html>... (login page)
Error: Not authenticated
```

### **If Role Mismatch:**
```
=== CURRENT USER INFO ===
User Role: teacher  (or admin, but not student/proctor)
========================
Testing key validation...
Key validation status: 403
Key validation error: {"error":"Only students, admins, or proctors can use student exam key"}
```

## 🚨 Common Issues & Solutions

### **Issue 1: Not Logged In**
**Problem:** User session expired
**Solution:** 
1. Go to `http://localhost:3000/auth/logout`
2. Login again with your credentials
3. Try the test again

### **Issue 2: Wrong Role**
**Problem:** User role is not student/admin/proctor
**Solution:**
1. Check what role you have
2. If wrong, create new account with correct role
3. Or update role in database

### **Issue 3: Session Issues**
**Problem:** Browser session corrupted
**Solution:**
1. Clear browser cookies
2. Restart browser
3. Login again

## 🎯 Expected Result

When everything works correctly, you should see:
- Auth status: 200
- User Role: student/admin/proctor
- Key validation status: 200
- Valid key response with exam details

## 🔧 Quick Fix

If you're getting 403 errors, most likely you need to:

1. **Logout and login again**
2. **Verify your user role** 
3. **Ensure you're using a valid student key**

**Run the test above and share what you see in the console!**
