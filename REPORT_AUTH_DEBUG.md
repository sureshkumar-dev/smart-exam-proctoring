# Report Loading Authentication Debug Guide

## 🔍 Current Issue

Admin is getting "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" when trying to load reports, but the questions API is working fine for the same user.

## 🛠️ Enhanced Debugging Added

### **Server-Side Debugging**
Added comprehensive authentication checks to reports API:
```javascript
console.log('=== REPORTS API REQUEST ===');
console.log('User ID:', req.user.id);
console.log('User Role:', req.user.role);
console.log('Is Authenticated:', req.isAuthenticated ? req.isAuthenticated() : 'N/A');
console.log('Session Data:', req.session);
```

### **Client-Side Debugging**
Added authentication verification before report loading:
```javascript
// Check if user is authenticated first
fetch('/api/auth/me', { credentials: 'include' })
  .then(r => {
    console.log('Auth check status:', r.status);
    if (!r.ok) {
      throw new Error('Not authenticated');
    }
    return r.json();
  })
  .then(user => {
    console.log('Current user:', user);
    if (!user || user.role !== 'admin') {
      throw new Error('Admin access required');
    }
    // Proceed with report loading
  });
```

## 📊 What to Check

### **Step 1: Test Authentication**
In browser console, run:
```javascript
fetch('/api/auth/me', {credentials: 'include'})
  .then(r => r.json())
  .then(user => console.log('Current user:', user));
```

### **Step 2: Test Report Loading**
Now try loading a report and check console for:
```
=== LOADING EXAM REPORT ===
Auth check status: 200
Current user: {id: 1, email: "abc@gmail.com", role: "admin"}
Reports API response status: 200
```

### **Step 3: Check Server Logs**
Server should show:
```
=== REPORTS API REQUEST ===
User ID: 1
User Role: admin
Is Authenticated: true
Exam found: YES
=== REPORTS API RESPONSE ===
```

## 🚨 Possible Issues & Solutions

### **Issue 1: Session Expired**
**Symptoms:**
- Auth check returns 401 or 403
- Server shows no user data

**Solution:**
- Logout and login again as admin
- Check session timeout

### **Issue 2: Wrong User Role**
**Symptoms:**
- Auth check shows user but role is not "admin"
- Server returns "Admin access required"

**Solution:**
- Verify you're logged in as admin user
- Check user role in database

### **Issue 3: Exam Ownership**
**Symptoms:**
- Auth passes but "Exam found: NO"
- Admin doesn't own the exam

**Solution:**
- Check if admin created the exam
- Verify exam ownership in database

## 🧪 Testing Steps

1. **Check Authentication:**
   ```javascript
   fetch('/api/auth/me', {credentials: 'include'}).then(r => r.json()).then(console.log);
   ```

2. **Load Report:**
   - Select exam from dropdown
   - Check console for detailed logs

3. **Verify Server Logs:**
   - Look for "=== REPORTS API REQUEST ==="
   - Check authentication status

## 📋 Expected Working Flow

**Client Console:**
```
=== LOADING EXAM REPORT ===
Auth check status: 200
Current user: {id: 1, role: "admin"}
Reports API response status: 200
Reports API response headers: application/json
Sessions data received: [{...}]
=== REPORT LOADED SUCCESSFULLY ===
```

**Server Console:**
```
=== REPORTS API REQUEST ===
User ID: 1
User Role: admin
Is Authenticated: true
Exam found: YES
Sessions found: 1
=== REPORTS API RESPONSE ===
```

## 🎯 Next Steps

1. **Test the enhanced debugging**
2. **Share console logs** from both client and server
3. **Identify the exact failure point**
4. **Apply targeted fix**

The enhanced debugging will show exactly where the authentication/authorization is failing!
