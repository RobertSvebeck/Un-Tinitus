# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Un-Tinnitus** is a web application that helps reduce tinnitus loudness using scientifically-proven cross-frequency de-correlating sound therapy. Based on peer-reviewed research published in *Hearing Research* (2025), the app delivers personalized tinnitus treatment through 60-minute audio sessions. The project is a privacy-focused single-page application with no backend dependencies.

## Stack

- **Frontend**: HTML5, CSS3, JavaScript (vanilla)
- **UI Framework**: Bootstrap 5.3
- **Audio**: Web Audio API (AudioContext, OscillatorNode, GainNode)
- **Styling**: Custom CSS with CSS variables, mobile-first responsive design
- **Treatment**: Cross-frequency de-correlating amplitude modulation

## Project Structure

The entire application consists of three files:

- `index.html` (~200 lines) - Single page with multi-step treatment workflow, science section, usage instructions
- `app.js` (~460 lines) - Advanced audio generation, modulation algorithms, UI state management
- `style.css` (~710 lines) - Mobile-first responsive styles with extensive media queries
- `1-s2.0-S0378595525001534-main.pdf` - Research paper (Yukhnovich et al., 2025)

No build process, bundler, or server required. The app is completely client-side and works offline once loaded.

## Key Features & Implementation

### Multi-Step Treatment Workflow
The app guides users through 4 steps:

1. **Frequency Matching** - Users test 8 frequencies (1-13 kHz) to identify their tinnitus pitch
   - Individual play buttons for each frequency
   - Visual descriptions (e.g., "High-pitched ringing", "Deep hum")
   - Common frequencies marked with badges

2. **Hearing Profile** - Radio button selection for hearing compensation
   - Normal, mild, moderate, or significant hearing difficulty
   - Applies frequency-specific gain correction (0-45 dB boost)

3. **Volume Calibration** - Test sound playback with slider adjustment
   - Safety-limited to 60% max volume
   - 2-second test of actual treatment sound

4. **60-Minute Treatment** - Continuous modulated sound playback
   - Real-time progress bar and timer (MM:SS format)
   - Background playback support
   - Completion screen with recommendations

### Advanced Audio Generation

#### Harmonic Complex Generation
The core audio engine generates broadband harmonic complexes (app.js:118-213):
- **Frequency range**: 1-16 kHz (harmonics of randomized 96-256 Hz fundamental)
- **Duration**: 4-second chunks, continuously scheduled
- **Hearing correction**: Applies frequency-specific gain based on user's profile (Fig. 1 from paper)

#### Cross-Frequency De-Correlating Modulation
Implements the exact algorithm from the research paper (Eq. 1-5):

**Key parameters** (app.js:128-135):
```javascript
d = 1.0        // Modulation depth
omega = 1.0    // Temporal modulation rate (1 Hz)
mu = 4.5       // Mean spectral modulation rate (cycles/octave)
r = 3.0        // Variability of SMR
nu = 0.125     // Rate of change of SMR (8s full cycle)
```

**Modulation formula** (app.js:169-187):
```
An(t) = 1 + d*sin(2π[ωt + Fn*S(t)] + q)
where:
  S(t) = μ + r*sin(p + 2πνt)
  Fn = log2(freq / centerFreq)
```

The modulation:
- Targets only the 1-octave band around tinnitus frequency
- Updates gain values every 50ms for smooth amplitude changes
- Eliminates stable correlations between frequency pairs
- Creates continuously varying spectral ripples

**Functions**:
- `generateModulatedHarmonicComplex(startTime)` - Creates one 4s harmonic complex with modulation
- `scheduleNextSound()` - Continuously schedules chunks with 100ms look-ahead
- `getHearingCorrectionGain(freq, profile)` - Calculates dB boost per frequency
- `calculateModulationBand(tinnitusFreq)` - Determines ±0.5 octave band

### UI State Management

State machine with 5 sections:
1. `frequencyMatching` (visible)
2. `hearingProfile` (hidden)
3. `demoCalibration` (hidden)
4. `demoTreatment` (hidden)
5. `demoComplete` (hidden)

**Key functions**:
- `resetDemoToStart()` - Returns to Step 1, clears all selections
- `stopTreatment(completed)` - Stops audio, handles completion state
- `startTimer()` - 60-minute countdown with progress bar updates
- `formatTime(seconds)` - Converts seconds to MM:SS display

### Mobile-First Design System

**Responsive breakpoints**:
- Desktop: Default (>768px)
- Tablet: 577-768px (2-column frequency grid)
- Mobile: <576px (single column, larger touch targets)
- Small phones: <380px (extra compact)

**Mobile optimizations**:
- 16px base font (prevents iOS auto-zoom)
- 28px slider thumbs (easy thumb control)
- Full-width buttons on mobile
- 44px minimum touch targets
- System font stack for native feel
- Touch-action: manipulation (no 300ms delay)
- iOS PWA meta tags

**CSS variables**:
- **Colors**: Warm coral-orange primary (#FF6B5B), sage green success
- **Spacing**: Responsive padding (2rem desktop, 1rem mobile)
- **Typography**: -apple-system, BlinkMacSystemFont font stack
- **Shadows & Radius**: Consistent depth with var(--shadow-sm/md/lg)

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

Then navigate to `http://localhost:8000` in your browser. **Use headphones for testing!**

## Common Tasks

### Modifying Audio Parameters

**Change modulation intensity**:
- Edit `d` (modulation depth) in app.js:129 (range 0-1)
- Edit `mu` (spectral modulation rate) in app.js:131

**Adjust treatment duration**:
- Change `remainingSeconds = 3600` in app.js:259 (currently 60 minutes)
- Update display text in HTML

**Modify frequency range**:
- Change `minHarmonic` calculation in app.js:138 (currently 1 kHz)
- Change `maxHarmonic` calculation in app.js:139 (currently 16 kHz)

### Adding New Frequencies

To add more tinnitus test frequencies:
1. Add option to `<select id="tinnitusFrequency">` in HTML
2. Add matching frequency card with `.freq-play-btn` in frequency matching section
3. No JavaScript changes needed - event listeners use `data-freq` attribute

### Styling Changes

All colors use CSS variables in `:root` (style.css:1-37).

**Key variables**:
- `--primary-color: #FF6B5B` - Main brand color
- `--success-color: #A8D8A8` - Success states
- `--warning-color: #FDB750` - Warnings/alerts

**Mobile breakpoints** (style.css:512-712):
- Tablet: 768px
- Mobile: 576px
- Small phones: 380px

### UI Workflow Changes

State transitions in event listeners (app.js:327-430):
- Frequency selection enables "Continue" button
- Hearing profile selection updates global state
- Volume calibration plays test sound
- Treatment starts continuous scheduling

## Research Foundation

Based on: *Yukhnovich et al. (2025), Hearing Research, Vol. 464*

**Clinical results** (53 participants, randomized crossover trial):
- Significant tinnitus loudness reduction (p=0.012) after 6 weeks
- Effects persisted for 3+ weeks after treatment
- Works for both tonal and broadband tinnitus
- No specialist equipment or audiologist required
- Completely automated, self-guided process

**Treatment protocol**:
- 60 minutes daily listening
- 6 weeks for maximum benefit
- Approximate frequency matching (±0.5 octave tolerance)
- Optional hearing loss compensation

## Browser Compatibility

- **Required**: Web Audio API (all modern browsers since 2015)
- **Tested**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Fallback**: `window.webkitAudioContext` for older Safari
- **Mobile**: iOS 12+, Android 5+
- **Features**:
  - Audio context state suspension handling for iOS
  - Touch-action optimization for mobile
  - No polyfills needed

**Known limitations**:
- Requires user gesture to start audio (browser security)
- Cannot play in background on some mobile browsers without screen wake
- Performance: Generates 50-100 simultaneous oscillators

## Privacy & Offline

The app is designed to be completely private:
- All audio generation happens in browser memory only
- No network requests beyond loading initial page
- No cookies, tracking, or data collection
- No user data stored or transmitted
- Can be saved and run offline (save page + dependencies)
- Works as Progressive Web App (PWA) on iOS/Android

## Performance Notes

**Audio scheduling**:
- 4-second chunks prevent memory buildup
- 100ms look-ahead scheduling prevents gaps
- Oscillators auto-cleanup after completion
- Master gain node for efficient volume control

**Typical resource usage**:
- CPU: 5-15% (varies by device)
- Memory: 50-100 MB
- Generates ~50-100 oscillators per 4-second chunk
- Schedules sounds continuously for 60 minutes

## Accessibility Notes

- Semantic HTML structure (nav, headings, buttons)
- Progress bar with proper aria attributes
- Radio buttons for hearing profile (keyboard accessible)
- Large touch targets (44px minimum on mobile)
- High contrast text (WCAG AA compliant)
- Screen reader friendly labels
- **Headphones required** for treatment efficacy
- Could benefit from ARIA live regions for timer updates

## Future Enhancements

Potential improvements:
- **Session tracking**: LocalStorage for daily listening history
- **Phase modulation**: Implement alternative modulation type from paper
- **Custom sounds**: Allow user to upload carrier sounds (music, etc.)
- **Offline mode**: Service worker for full offline support
- **Progress tracking**: Visual calendar of completed sessions
- **Settings**: Adjustable treatment duration, modulation parameters
- **Export**: Save personalized treatment as audio file
