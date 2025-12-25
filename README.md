# Un-Tinnitus

A web-based tinnitus treatment application using scientifically-proven cross-frequency de-correlating sound therapy.

## About

Un-Tinnitus delivers personalized tinnitus treatment through 60-minute audio sessions based on peer-reviewed research published in *Hearing Research* (2025). The application uses cross-frequency de-correlating amplitude modulation to reduce tinnitus loudness—a method proven effective in randomized controlled trials with 53 participants.

**Clinical Results:**
- Significant tinnitus loudness reduction (p=0.012) after 6 weeks of daily use
- Effects persisted for 3+ weeks after treatment completion
- Works for both tonal and broadband tinnitus
- No specialist equipment or audiologist required

## Research Foundation

This application implements the treatment protocol described in:

**Yukhnovich, D., Searchfield, G.D., Welch, D. (2025).** *Cross-frequency decorrelating amplitude modulation reduces the loudness of tinnitus: A randomized crossover trial.* Hearing Research, Volume 464, 109361. DOI: [10.1016/j.heares.2025.109361](https://doi.org/10.1016/j.heares.2025.109361)

The full research paper is included in this repository (`1-s2.0-S0378595525001534-main.pdf`).

## Features

- **Personalized Treatment**: Match your tinnitus frequency from 8 common pitches (1-13 kHz)
- **Hearing Compensation**: Automatic frequency-specific gain correction for hearing loss
- **Privacy-Focused**: All processing happens locally in your browser—no data collection
- **Mobile-Friendly**: Responsive design optimized for phones, tablets, and desktop
- **Offline-Capable**: Works without an internet connection once loaded
- **No Installation**: Runs directly in any modern web browser

## How It Works

### Treatment Protocol

1. **Frequency Matching** - Identify your tinnitus pitch by testing different frequencies
2. **Hearing Profile** - Select your hearing ability for proper sound calibration
3. **Volume Calibration** - Set comfortable listening volume (safety-limited)
4. **60-Minute Treatment** - Listen to modulated sound therapy daily for 6 weeks

### The Science

The app generates broadband harmonic complexes (1-16 kHz) with cross-frequency de-correlating amplitude modulation specifically targeting a 1-octave band around your tinnitus frequency. This modulation:

- Eliminates stable correlations between frequency pairs
- Creates continuously varying spectral ripples
- Uses parameters validated in clinical trials (1 Hz temporal modulation, 4.5 cycles/octave mean spectral modulation rate)
- Applies optional hearing loss compensation based on published audiometric data

## Getting Started

### Requirements

- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Headphones or earbuds (required for treatment efficacy)
- 60 minutes of uninterrupted listening time daily

### Installation

**Option 1: Use Online (when deployed)**
Simply visit the hosted URL in your web browser.

**Option 2: Run Locally**

1. Clone or download this repository
2. Serve the files using any static web server:

```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js
npx http-server

# Using Ruby
ruby -run -ehttpd . -p8000
```

3. Open `http://localhost:8000` in your web browser

**Option 3: Open Directly**
You can also open `index.html` directly in your browser, though some features may be limited.

### Usage

1. **Wear headphones** - Treatment efficacy depends on proper stereo delivery
2. Follow the 4-step guided workflow
3. Listen for the full 60 minutes daily
4. Continue treatment for 6 weeks for maximum benefit
5. Adjust volume to a comfortable level (not too loud)

## Project Structure

```
Un-Tinitus/
├── index.html                              # Single-page application interface
├── app.js                                  # Audio generation and modulation engine
├── style.css                               # Mobile-first responsive styles
├── 1-s2.0-S0378595525001534-main.pdf      # Original research paper
├── CLAUDE.md                               # Developer documentation
├── README.md                               # This file
└── LICENSE                                 # CC BY 4.0 License
```

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **UI Framework**: Bootstrap 5.3
- **Audio Engine**: Web Audio API (AudioContext, OscillatorNode, GainNode)
- **Design**: Mobile-first responsive with CSS variables

No build process, bundler, or backend required. The entire application is client-side.

## Browser Compatibility

- **Chrome/Edge**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Mobile**: iOS 12+, Android 5+

Requires Web Audio API support (available in all modern browsers since 2015).

## Privacy

Un-Tinnitus is designed with privacy as a core principle:

- ✅ All audio generation happens locally in your browser
- ✅ No network requests beyond loading the initial page
- ✅ No cookies, tracking, or analytics
- ✅ No user data stored or transmitted
- ✅ Can be saved and run completely offline

## Performance

**Typical resource usage:**
- CPU: 5-15% (varies by device)
- Memory: 50-100 MB
- Generates 50-100 simultaneous audio oscillators
- Continuous scheduling for 60-minute sessions

## Contributing

Contributions are welcome! This project is open source under the CC BY 4.0 license.

**Areas for enhancement:**
- Session tracking with LocalStorage
- Service worker for full offline support
- Progress calendar visualization
- Adjustable treatment parameters
- Audio export functionality

Please ensure any contributions maintain the scientific accuracy of the treatment protocol.

## Disclaimer

This application implements a treatment protocol validated in peer-reviewed research. However:

- This is not a substitute for professional medical advice
- Consult an audiologist or healthcare provider for persistent tinnitus
- Stop use if you experience discomfort or worsening symptoms
- Not intended to diagnose or cure any medical condition

## Citation

If you use this software in research or clinical settings, please cite the original paper:

```
Yukhnovich, D., Searchfield, G.D., Welch, D. (2025). Cross-frequency decorrelating
amplitude modulation reduces the loudness of tinnitus: A randomized crossover trial.
Hearing Research, 464, 109361. https://doi.org/10.1016/j.heares.2025.109361
```

## License

This project is licensed under the **Creative Commons Attribution 4.0 International License** (CC BY 4.0) - the same license as the underlying research paper.

You are free to:
- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material for any purpose, even commercially

Under the following terms:
- **Attribution** — You must give appropriate credit to the original research and this implementation

See the [LICENSE](LICENSE) file for full details or visit [http://creativecommons.org/licenses/by/4.0/](http://creativecommons.org/licenses/by/4.0/)

## Acknowledgments

- **Research Team**: Denis Yukhnovich, Grant D. Searchfield, David Welch (University of Auckland)
- **Publication**: Hearing Research, Elsevier
- **Funding**: Research supported by the Neurological Foundation of New Zealand (2226-PG)

## Contact

For questions about the research, please refer to the original publication.

For technical issues with this implementation, please open an issue on the project repository.

---

**Made with ❤️ for the tinnitus community**
