document.addEventListener('DOMContentLoaded', function() {
    // ==================== GLOBAL STATE ====================
    let audioContext = null;
    let volume = 0.3;
    let timer = null;
    let remainingSeconds = 3600; // 60 minutes
    let isPlaying = false;

    // Treatment parameters
    let selectedTinnitusFreq = null;
    let selectedHearingProfile = 'normal';
    let modulatedBandCenter = null;
    let modulatedBandLower = null;
    let modulatedBandUpper = null;

    // Audio nodes for continuous playback
    let currentOscillators = [];
    let masterGainNode = null;
    let nextSoundScheduledTime = 0;
    const SOUND_CHUNK_DURATION = 4; // 4 seconds per harmonic complex
    const LOOK_AHEAD_TIME = 0.1; // Schedule sounds 100ms ahead

    // ==================== DOM ELEMENTS ====================
    const frequencyMatching = document.getElementById('frequencyMatching');
    const tinnitusFrequency = document.getElementById('tinnitusFrequency');
    const playFrequencyTest = document.getElementById('playFrequencyTest');
    const confirmFrequency = document.getElementById('confirmFrequency');

    const hearingProfile = document.getElementById('hearingProfile');
    const hearingSlope = document.getElementById('hearingSlope');
    const confirmHearing = document.getElementById('confirmHearing');

    const demoCalibration = document.getElementById('demoCalibration');
    const demoVolumeSlider = document.getElementById('demoVolumeSlider');
    const demoTestTone = document.getElementById('demoTestTone');
    const demoCalibrationDone = document.getElementById('demoCalibrationDone');

    const demoTreatment = document.getElementById('demoTreatment');
    const demoStartTreatment = document.getElementById('demoStartTreatment');
    const demoTreatmentProgress = document.getElementById('demoTreatmentProgress');
    const demoTimeRemaining = document.getElementById('demoTimeRemaining');
    const demoProgressBar = document.getElementById('demoProgressBar');
    const demoStopTreatment = document.getElementById('demoStopTreatment');

    const demoComplete = document.getElementById('demoComplete');
    const resetDemo = document.getElementById('resetDemo');

    // ==================== AUDIO CONTEXT INITIALIZATION ====================
    function initAudio() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();

                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }

                // Create master gain node
                masterGainNode = audioContext.createGain();
                masterGainNode.gain.value = volume;
                masterGainNode.connect(audioContext.destination);

                return true;
            } catch (error) {
                console.error('Audio context initialization failed:', error);
                alert('Audio is not supported in your browser. Please try a different browser.');
                return false;
            }
        }
        return true;
    }

    // ==================== HEARING CORRECTION PROFILES ====================
    function getHearingCorrectionGain(frequency, profile) {
        // Based on the research paper's hearing correction profiles (Fig. 1)
        const freqKHz = frequency / 1000;

        let maxCorrection = 0;
        switch(profile) {
            case 'mild': maxCorrection = 15; break;
            case 'moderate': maxCorrection = 30; break;
            case 'severe': maxCorrection = 45; break;
            default: maxCorrection = 0; // normal
        }

        if (maxCorrection === 0) return 0;

        // Correction is 0 up to 2 kHz
        if (freqKHz <= 2) return 0;

        // 1/9 of maximum at 2.8 kHz
        if (freqKHz <= 2.8) {
            const t = (freqKHz - 2) / (2.8 - 2);
            return t * (maxCorrection / 9);
        }

        // Increases linearly to 8/9 of maximum at 8 kHz
        if (freqKHz <= 8) {
            const t = (freqKHz - 2.8) / (8 - 2.8);
            return (maxCorrection / 9) + t * (7 * maxCorrection / 9);
        }

        // Maximum above 8 kHz
        return maxCorrection;
    }

    // ==================== MODULATION BAND CALCULATION ====================
    function calculateModulationBand(tinnitusFreq) {
        // Calculate 1-octave band centered on tinnitus frequency
        modulatedBandCenter = tinnitusFreq;
        modulatedBandLower = tinnitusFreq / Math.sqrt(2); // -0.5 octave
        modulatedBandUpper = tinnitusFreq * Math.sqrt(2); // +0.5 octave

        console.log(`Modulation band: ${modulatedBandLower.toFixed(0)} - ${modulatedBandUpper.toFixed(0)} Hz (center: ${modulatedBandCenter.toFixed(0)} Hz)`);
    }

    // ==================== CROSS-FREQUENCY DE-CORRELATING MODULATION ====================
    function generateModulatedHarmonicComplex(startTime) {
        if (!audioContext || !masterGainNode) return;

        const sampleRate = 44100; // audioContext.sampleRate;
        const duration = SOUND_CHUNK_DURATION;
        const numSamples = Math.floor(sampleRate * duration);

        // Random fundamental frequency (96-256 Hz)
        const f0 = 96 + Math.random() * (256 - 96);

        // Modulation parameters (from research paper)
        const d = 1.0; // modulation depth
        const omega = 1.0; // temporal modulation rate (1 Hz)
        const mu = 4.5; // mean spectral modulation rate
        const r = 3.0; // variability of spectral modulation rate
        const nu = 0.125; // rate of change of SMR (full cycle = 8s)
        const q = Math.random() * 2 * Math.PI; // random phase offset per stimulus
        const p = Math.random() * 2 * Math.PI; // random phase offset for SMR

        // Create harmonics from 1kHz to 16kHz
        const minHarmonic = Math.ceil(1000 / f0);
        const maxHarmonic = Math.floor(16000 / f0);

        const oscillatorsToStart = [];

        for (let n = minHarmonic; n <= maxHarmonic; n++) {
            const freq = n * f0;
            const isInModulatedBand = freq >= modulatedBandLower && freq <= modulatedBandUpper;

            // Calculate hearing correction gain (in dB)
            const correctionDB = getHearingCorrectionGain(freq, selectedHearingProfile);
            const hearingGain = Math.pow(10, correctionDB / 20);

            // Calculate octave distance from center (Fn)
            const Fn = Math.log2(freq / modulatedBandCenter);

            // Create oscillator for this harmonic
            const osc = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            // Apply hearing correction to base gain
            const baseGain = (0.5 / (maxHarmonic - minHarmonic + 1)) * hearingGain;

            if (isInModulatedBand) {
                // Apply amplitude modulation to this harmonic
                // An(t) = 1 + d*sin(2π[ωt + Fn*S(t)] + q)
                // where S(t) = μ + r*sin(p + 2πνt)

                const modulationValues = [];
                for (let i = 0; i < numSamples; i++) {
                    const t = i / sampleRate;
                    const S_t = mu + r * Math.sin(p + 2 * Math.PI * nu * t);
                    const An_t = 1 + d * Math.sin(2 * Math.PI * (omega * t + Fn * S_t) + q);
                    modulationValues.push(An_t * baseGain);
                }

                // Set initial gain
                gainNode.gain.value = modulationValues[0];

                // Schedule gain changes for amplitude modulation
                const updateInterval = 0.05; // Update every 50ms
                const samplesPerUpdate = Math.floor(sampleRate * updateInterval);

                for (let i = 0; i < modulationValues.length; i += samplesPerUpdate) {
                    const timeOffset = i / sampleRate;
                    gainNode.gain.setValueAtTime(modulationValues[i], startTime + timeOffset);
                }
            } else {
                // Outside modulated band - constant amplitude
                gainNode.gain.value = baseGain;
            }

            osc.connect(gainNode);
            gainNode.connect(masterGainNode);

            oscillatorsToStart.push({ osc, startTime, duration });
        }

        // Start all oscillators for this chunk
        oscillatorsToStart.forEach(({ osc, startTime, duration }) => {
            osc.start(startTime);
            osc.stop(startTime + duration);
            currentOscillators.push(osc);
        });

        // Clean up stopped oscillators
        setTimeout(() => {
            oscillatorsToStart.forEach(({ osc }) => {
                const index = currentOscillators.indexOf(osc);
                if (index > -1) currentOscillators.splice(index, 1);
            });
        }, (duration + 0.1) * 1000);
    }

    // ==================== TREATMENT PLAYBACK SCHEDULER ====================
    function scheduleNextSound() {
        if (!isPlaying || !audioContext) return;

        const currentTime = audioContext.currentTime;

        // Schedule sounds ahead of time
        while (nextSoundScheduledTime < currentTime + LOOK_AHEAD_TIME) {
            generateModulatedHarmonicComplex(nextSoundScheduledTime);
            nextSoundScheduledTime += SOUND_CHUNK_DURATION;
        }

        // Continue scheduling
        setTimeout(scheduleNextSound, 50); // Check every 50ms
    }

    // ==================== SIMPLE TONE GENERATION (for testing) ====================
    function playSimpleTone(frequency, duration) {
        if (!audioContext) return;

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.value = volume;

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.start();
        setTimeout(() => {
            osc.stop();
        }, duration);
    }

    // ==================== TIMER FUNCTIONS ====================
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function startTimer() {
        remainingSeconds = 3600; // 60 minutes
        demoTimeRemaining.textContent = formatTime(remainingSeconds);
        demoProgressBar.style.width = '0%';

        timer = setInterval(() => {
            remainingSeconds--;
            demoTimeRemaining.textContent = formatTime(remainingSeconds);
            const progress = (3600 - remainingSeconds) / 3600 * 100;
            demoProgressBar.style.width = `${progress}%`;

            if (remainingSeconds <= 0) {
                stopTreatment(true);
            }
        }, 1000);
    }

    function stopTreatment(completed = false) {
        clearInterval(timer);
        isPlaying = false;

        // Stop all oscillators
        currentOscillators.forEach(osc => {
            try {
                osc.stop();
            } catch (e) {
                // Already stopped
            }
        });
        currentOscillators = [];

        demoTreatmentProgress.style.display = 'none';

        if (completed) {
            demoComplete.style.display = 'block';
            demoComplete.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function resetDemoToStart() {
        stopTreatment(false);

        // Reset all sections
        frequencyMatching.style.display = 'block';
        hearingProfile.style.display = 'none';
        demoCalibration.style.display = 'none';
        demoTreatment.style.display = 'none';
        demoTreatmentProgress.style.display = 'none';
        demoComplete.style.display = 'none';

        // Reset selections
        tinnitusFrequency.value = '';

        // Reset hearing profile radio buttons
        const hearingRadios = document.querySelectorAll('input[name="hearingProfile"]');
        hearingRadios.forEach(radio => {
            radio.checked = (radio.value === 'normal');
        });

        demoVolumeSlider.value = 0.3;
        volume = 0.3;

        confirmFrequency.disabled = true;

        selectedTinnitusFreq = null;
        selectedHearingProfile = 'normal';

        remainingSeconds = 3600;
        demoTimeRemaining.textContent = formatTime(remainingSeconds);
        demoProgressBar.style.width = '0%';

        frequencyMatching.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ==================== EVENT LISTENERS ====================

    // Frequency play buttons (individual test buttons)
    document.querySelectorAll('.freq-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const freq = parseInt(btn.getAttribute('data-freq'));
            if (freq && initAudio()) {
                playSimpleTone(freq, 2000); // 2 second test
                // Visual feedback
                btn.textContent = '⏸ Playing...';
                btn.disabled = true;
                setTimeout(() => {
                    btn.textContent = '▶ Play';
                    btn.disabled = false;
                }, 2100);
            }
        });
    });

    // Frequency matching - dropdown selection
    if (tinnitusFrequency) {
        tinnitusFrequency.addEventListener('change', () => {
            const freq = parseInt(tinnitusFrequency.value);
            if (freq) {
                selectedTinnitusFreq = freq;
                confirmFrequency.disabled = false;
            } else {
                confirmFrequency.disabled = true;
            }
        });
    }

    if (confirmFrequency) {
        confirmFrequency.addEventListener('click', () => {
            if (selectedTinnitusFreq) {
                calculateModulationBand(selectedTinnitusFreq);
                frequencyMatching.style.display = 'none';
                hearingProfile.style.display = 'block';
                hearingProfile.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    // Hearing profile - radio buttons
    const hearingRadios = document.querySelectorAll('input[name="hearingProfile"]');
    hearingRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            selectedHearingProfile = radio.value;
        });
    });

    if (confirmHearing) {
        confirmHearing.addEventListener('click', () => {
            hearingProfile.style.display = 'none';
            demoCalibration.style.display = 'block';
            demoCalibration.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    // Volume calibration
    if (demoVolumeSlider) {
        demoVolumeSlider.addEventListener('input', () => {
            volume = parseFloat(demoVolumeSlider.value);
            if (masterGainNode) {
                masterGainNode.gain.value = volume;
            }
        });
    }

    if (demoTestTone) {
        demoTestTone.addEventListener('click', () => {
            if (initAudio() && selectedTinnitusFreq) {
                // Play a brief sample of the modulated sound
                nextSoundScheduledTime = audioContext.currentTime;
                generateModulatedHarmonicComplex(nextSoundScheduledTime);
            }
        });
    }

    if (demoCalibrationDone) {
        demoCalibrationDone.addEventListener('click', () => {
            demoCalibration.style.display = 'none';
            demoTreatment.style.display = 'block';
            demoTreatment.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    // Treatment
    if (demoStartTreatment) {
        demoStartTreatment.addEventListener('click', () => {
            if (initAudio()) {
                isPlaying = true;
                demoTreatmentProgress.style.display = 'block';
                nextSoundScheduledTime = audioContext.currentTime;

                // Start scheduling sounds
                scheduleNextSound();

                // Start timer
                startTimer();

                demoTreatmentProgress.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    if (demoStopTreatment) {
        demoStopTreatment.addEventListener('click', () => {
            stopTreatment(false);
        });
    }

    if (resetDemo) {
        resetDemo.addEventListener('click', () => {
            resetDemoToStart();
        });
    }

    // Handle page visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && isPlaying) {
            // Keep playing in background - research suggests 60 min daily listening
        }
    });

    // Handle audio context state changes
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        document.addEventListener('click', () => {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
        }, { once: true });
    }

    // Prevent accidental page refresh during treatment
    window.addEventListener('beforeunload', (e) => {
        if (isPlaying && remainingSeconds > 0 && remainingSeconds < 3600) {
            e.preventDefault();
            e.returnValue = 'Your treatment is in progress. Are you sure you want to leave?';
            return 'Your treatment is in progress. Are you sure you want to leave?';
        }
    });

    console.log('Un-Tinnitus app initialized successfully');
});
