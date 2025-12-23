# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**InMotion** is a web application that helps reduce motion sickness symptoms using scientifically-proven 100 Hz audio tones. The project is a simple, privacy-focused single-page application with no backend dependencies.

## Stack

- **Frontend**: HTML5, CSS3, JavaScript (vanilla)
- **UI Framework**: Bootstrap 5.3
- **Audio**: Web Audio API (AudioContext, OscillatorNode, GainNode)
- **Styling**: Custom CSS with CSS variables for design tokens

## Project Structure

The entire application consists of three files:

- `index.html` (147 lines) - Single page with demo interface, science section, usage instructions, and privacy information
- `app.js` (258 lines) - Audio generation logic, UI state management, event handling
- `style.css` (456 lines) - Global styles with modern design tokens and component styling
- `.venv/` - Python virtual environment (not actively used in current version)

No build process, bundler, or server required. The app is completely client-side and works offline once loaded.

## Key Features & Implementation

### Audio Generation
The app generates a 100 Hz sine wave tone using Web Audio API. Key functions:
- `initAudio()` - Initializes AudioContext with suspended state handling for browser compatibility
- `generate100HzTone(duration)` - Creates OscillatorNode at 100 Hz with gain control
- `updateVolume(value)` - Adjusts gain node value from volume slider
- `startTimer()` - Tracks elapsed time during 1-minute treatment and updates progress bar

### UI State Management
The demo workflow progresses through multiple sections by toggling visibility:
1. **Calibration** - Volume adjustment with 1-second test tone
2. **Treatment** - 1-minute audio playback with live progress bar
3. **Complete** - Success message with option to start new treatment

Functions: `resetDemoToStart()`, `stopTreatment()`, and event listeners manage state transitions.

### Design System
CSS uses custom properties for consistency:
- **Colors**: Primary blue (#1a73e8), accent green (#34a853), danger red (#ea4335)
- **Spacing**: Bootstrap utilities for margins/padding
- **Typography**: System font stack with defined heading hierarchy
- **Shadows & Radius**: Predefined CSS variables for consistent UI depth

## Development Commands

Since this is a static site, no build or test commands are needed. To serve locally:

```bash
# Using Python 3 (http.server)
python3 -m http.server 8000

# Using Node.js (http-server)
npx http-server

# Using Ruby (thin)
ruby -run -ehttpd . -p8000
```

Then navigate to `http://localhost:8000` in your browser.

## Common Tasks

### Adding Audio Features
Audio generation logic is in `generate100HzTone()`. To modify:
- Frequency: Change `oscillator.frequency.value = 100`
- Duration: Adjust timeout in `generate100HzTone(duration)` parameter
- Volume range: Modify volume slider `min/max` in HTML and `updateVolume()` validation

### Styling Changes
All colors, spacing, and shadows use CSS variables defined in `:root`. Update variables in `style.css` at the top for global changes. Component-specific styles follow Bootstrap class patterns.

### UI Workflow Changes
State transitions happen in event listeners (bottom of `app.js`). Update `style.display` toggles and scroll behavior as needed. `resetDemoToStart()` defines initial state.

## Browser Compatibility

- Requires Web Audio API support (all modern browsers)
- Uses `window.AudioContext` with fallback to `window.webkitAudioContext` for older Safari
- Audio context state suspension handling included for iOS/user-gesture restrictions
- No polyfills needed for modern browsers (Chrome, Firefox, Safari, Edge)

## Privacy & Offline

The app is designed to be completely private:
- All audio generation happens in browser memory only
- No network requests beyond loading initial page
- No cookies, tracking, or data collection
- Can be saved and run offline with dependencies bundled (Bootstrap CSS/JS loaded from CDN currently)

## Accessibility Notes

- Uses semantic HTML structure (nav, heading hierarchy, button elements)
- Progress bar uses ARIA role="progressbar"
- Headphone recommendation for best audio results
- Could benefit from ARIA labels on audio-related controls if expanded
