# Proctor Evidence Display Debug Guide

## 🔍 Issue Identified

Screenshots are being uploaded to the uploads folder but not showing in the proctor panel's evidence section.

## 🛠️ Enhanced Debugging Added

### **1. Server-Side Evidence Flow**
The server already properly:
- ✅ Receives evidence uploads at `/api/evidence/upload`
- ✅ Stores files in uploads folder
- ✅ Emits `new_evidence` events to proctor room
- ✅ Broadcasts evidence data with file paths

### **2. Client-Side Debugging Enhanced**

#### **Socket Event Reception:**
```javascript
socket.on('new_evidence', function (data) {
  console.log('=== NEW EVIDENCE EVENT RECEIVED ===');
  console.log('Evidence data:', data);
  console.log('Evidence filePath:', data.filePath);
  console.log('Evidence eventType:', data.eventType);
  console.log('Evidence sessionId:', data.sessionId);
  addEvidence(data);
});
```

#### **Evidence Display Function:**
```javascript
function addEvidence(data) {
  console.log('=== ADDING EVIDENCE ===');
  console.log('Evidence data:', data);
  console.log('Creating evidence image with src:', img.src);
  console.log('Full image URL will be:', window.location.origin + img.src);
  
  img.onload = function() {
    console.log('✅ Evidence image loaded successfully:', img.src);
  };
  
  img.onerror = function () { 
    console.error('❌ Evidence image failed to load:', img.src);
    console.error('Full URL attempted:', window.location.origin + img.src);
  };
}
```

## 🧪 Testing Steps

### **Step 1: Trigger Evidence Capture**
1. Student joins exam
2. Student triggers violation (switch tabs, open DevTools, etc.)
3. Check server console for evidence upload logs

### **Step 2: Check Proctor Console**
Look for these logs:
```
=== NEW EVIDENCE EVENT RECEIVED ===
Evidence data: {sessionId: 16, filePath: "/uploads/session_16_1770214070931.png", eventType: "tab_switch"}
=== ADDING EVIDENCE ===
Creating evidence image with src: /uploads/session_16_1770214070931.png
Full image URL will be: http://localhost:3000/uploads/session_16_1770214070931.png
✅ Evidence image loaded successfully: /uploads/session_16_1770214070931.png
```

### **Step 3: Check Evidence Container**
The proctor panel should show:
- Evidence items with session info
- Thumbnail images
- Event details and timestamps

## 🚨 Common Issues & Solutions

### **Issue 1: No Socket Events**
**Symptoms:**
- No "=== NEW EVIDENCE EVENT RECEIVED ===" logs
- Server uploads files but no proctor updates

**Solution:**
- Check if proctor is properly connected to exam room
- Verify proctor key is correct
- Check if proctor joined the right exam

### **Issue 2: Image Loading Errors**
**Symptoms:**
- "❌ Evidence image failed to load" logs
- 404 errors for image URLs

**Solution:**
- Check if `/uploads/` route is properly configured
- Verify file paths are correct
- Check file permissions

### **Issue 3: Container Not Found**
**Symptoms:**
- "Evidence container not found" error
- No evidence display area

**Solution:**
- Check if `evidenceContainer` element exists in HTML
- Verify DOM is loaded before evidence events

## 📋 Expected Working Flow

**Server Console:**
```
Evidence upload request received
Request body sessionId: 16
Request file: session_16_1770214070931.png
Broadcasting evidence: {sessionId: 16, filePath: "/uploads/session_16_1770214070931.png", eventType: "tab_switch"}
```

**Proctor Console:**
```
=== NEW EVIDENCE EVENT RECEIVED ===
Evidence data: {sessionId: 16, filePath: "/uploads/session_16_1770214070931.png", eventType: "tab_switch"}
=== ADDING EVIDENCE ===
✅ Evidence image loaded successfully: /uploads/session_16_1770214070931.png
```

**Proctor Panel:**
- Evidence items appear with thumbnails
- Session information displayed
- Event details and timestamps shown

## 🔧 Manual Testing

### **Test Evidence Directly**
Open in browser (when logged in as proctor):
```
http://localhost:3000/uploads/session_16_1770214070931.png
```

Should display the screenshot image.

### **Test Socket Connection**
In proctor console, check:
```javascript
console.log('Socket connected:', socket.connected);
console.log('Socket rooms:', socket.rooms);
```

## 🎯 Next Steps

1. **Test the enhanced debugging**
2. **Trigger a violation** as student
3. **Check proctor console** for detailed logs
4. **Identify the exact failure point**
5. **Apply targeted fix**

The enhanced debugging will show exactly where the evidence display is failing!
