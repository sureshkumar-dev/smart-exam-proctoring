# Behavior-Based Malpractice Detection Integration

## Overview
Four new behavior-based malpractice detections have been integrated into the existing AI Exam Proctoring System without breaking any current functionality.

## New Detections Added

### 1. Copy-Paste Detection (`paste_detected`)
- **Trigger**: Paste events in answer textareas/inputs
- **Confidence**: 0.9
- **Score**: 40 points
- **Implementation**: Monitors paste events specifically in answer fields
- **Source Tag**: BEHAVIOR

### 2. Abnormal Typing Speed Detection (`abnormal_typing_speed`)
- **Trigger**: > 15 chars/sec AND answer length > 150 characters
- **Confidence**: 0.85
- **Score**: 25 points
- **Implementation**: Tracks keystrokes and calculates typing speed when user stops typing
- **Source Tag**: BEHAVIOR

### 3. Long Inactivity → Sudden Answer Detection (`sudden_answer_after_inactivity`)
- **Trigger**: > 60 seconds inactivity followed by answer > 100 characters
- **Confidence**: 0.8
- **Score**: 30 points
- **Implementation**: Monitors keyboard inactivity and checks for sudden large answers
- **Source Tag**: BEHAVIOR

### 4. Tab Switch Before Answer Submission (`tab_switch_before_answer`)
- **Trigger**: Tab switch within 30 seconds of submitting answer > 100 characters
- **Confidence**: 0.75
- **Score**: 15 points
- **Implementation**: Tracks visibility changes and correlates with answer submissions
- **Source Tag**: BEHAVIOR

## Backend Changes

### Scoring Rules Added
```javascript
// 🧠 NEW Behavior-Based Detections (BEHAVIOR source)
paste_detected: 40,
abnormal_typing_speed: 25,
sudden_answer_after_inactivity: 30,
tab_switch_before_answer: 15,
```

### Enhanced Detection Handler
- Accepts `source` parameter for detection tagging
- Uses socket-bound session ID for security (doesn't trust client-sent sessionId)
- Includes source information in detection details
- Maintains existing detection logging and scoring logic

## Frontend Changes

### New Variables Added
```javascript
// Behavior-based detection variables
var typingStartTime = null;
var keystrokeCount = 0;
var lastPasteTime = 0;
var lastTabSwitchTime = 0;
var longInactivityStartTime = null;
var currentAnswerLength = 0;
```

### Enhanced emitDetection Function
- Now accepts optional `source` parameter
- Maintains backward compatibility with existing calls

### New Detection Functions
1. `setupPasteDetection()` - Monitors paste events in answer fields
2. `setupTypingSpeedDetection()` - Tracks typing speed and patterns
3. `setupInactivityDetection()` - Monitors long inactivity periods
4. `setupTabSwitchBeforeAnswerDetection()` - Tracks tab switches before answers
5. `checkTypingSpeed()` - Calculates and validates typing speed
6. `checkSuddenAnswerAfterInactivity()` - Detects sudden answers after inactivity
7. `checkTabSwitchBeforeAnswer()` - Correlates tab switches with answer submissions

### Integration Points
- All new detections are initialized in the main exam initialization
- Answer handlers now include behavior-based checks
- Maintains existing Socket.IO connection and scoring logic

## Security Features

### Session Security
- Uses socket-bound session ID (`socket.sessionId`) instead of trusting client-sent sessionId
- Maintains existing authentication and authorization checks

### Data Integrity
- Source tagging for clear detection attribution
- Detailed logging with context information
- No fake AI or text classifiers - only behavioral patterns

## Production Safety

### Performance
- Minimal performance impact on existing functionality
- Efficient event handling with debouncing
- Non-blocking detection checks

### Reliability
- Graceful error handling
- Backward compatibility maintained
- No breaking changes to existing APIs

### Monitoring
- Clear console logging for debugging
- Detailed detection information for administrators
- Source tagging for easy filtering

## Testing Recommendations

### Manual Testing Scenarios
1. **Copy-Paste**: Copy text and paste into answer field
2. **Typing Speed**: Type very quickly (>15 chars/sec) for long answers
3. **Inactivity**: Wait >60 seconds, then type a long answer
4. **Tab Switch**: Switch tabs, then return and submit answer >100 chars

### Expected Behavior
- Real-time alerts in proctor dashboard
- Appropriate scoring applied
- Source tagging in detection logs
- User warnings displayed

## Database Impact
No schema changes required. Uses existing `malpractice_events` table with enhanced details field containing source information.

## Conclusion
The behavior-based detection system is now fully integrated and production-ready. It enhances the existing proctoring capabilities with intelligent behavioral analysis while maintaining all current functionality and security measures.
