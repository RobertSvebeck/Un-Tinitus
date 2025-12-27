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

    // Wake Lock for preventing screen from sleeping
    let wakeLock = null;

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

    const downloadSession = document.getElementById('downloadSession');

    // Audio streaming elements
    const treatmentAudio = document.getElementById('treatmentAudio');
    const audioLoadingIndicator = document.getElementById('audioLoadingIndicator');
    const audioLoadingProgress = document.getElementById('audioLoadingProgress');

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


    // ==================== WAKE LOCK API ====================
    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock activated - screen will stay on');

                wakeLock.addEventListener('release', () => {
                    console.log('Wake Lock released');
                });

                return true;
            } else {
                console.warn('Wake Lock API not supported in this browser');
                return false;
            }
        } catch (err) {
            console.error('Wake Lock request failed:', err);
            return false;
        }
    }

    async function releaseWakeLock() {
        if (wakeLock !== null) {
            try {
                await wakeLock.release();
                wakeLock = null;
                console.log('Wake Lock released manually');
            } catch (err) {
                console.error('Wake Lock release failed:', err);
            }
        }
    }

    // ==================== MEDIA SESSION API ====================
    function initializeMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'Un-Tinnitus Treatment Session',
                artist: 'Un-Tinnitus',
                album: 'Tinnitus Sound Therapy',
                artwork: []
            });

            navigator.mediaSession.setActionHandler('play', () => {
                if (audioContext && audioContext.state === 'suspended') {
                    audioContext.resume();
                }
            });

            navigator.mediaSession.setActionHandler('pause', () => {
                stopTreatment(false);
            });

            navigator.mediaSession.setActionHandler('stop', () => {
                stopTreatment(false);
            });

            console.log('MediaSession initialized for background playback');
        }
    }

    function clearMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.setActionHandler('play', null);
            navigator.mediaSession.setActionHandler('pause', null);
            navigator.mediaSession.setActionHandler('stop', null);
        }
    }

    // ==================== TIMER FUNCTIONS ====================
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function startTimer() {
        // Timer is now synced with audio timeupdate events
        // This function just initializes the display
        demoTimeRemaining.textContent = formatTime(3600);
        demoProgressBar.style.width = '0%';
    }

    function stopTreatment(completed = false) {
        clearInterval(timer);
        isPlaying = false;

        // Stop audio playback
        if (treatmentAudio) {
            treatmentAudio.pause();
            treatmentAudio.currentTime = 0;
        }

        // Stop all oscillators (for Web Audio API test tones)
        currentOscillators.forEach(osc => {
            try {
                osc.stop();
            } catch (e) {
                // Already stopped
            }
        });
        currentOscillators = [];

        // Clear MediaSession
        clearMediaSession();

        // Release Wake Lock
        releaseWakeLock();

        // Hide loading indicator
        if (audioLoadingIndicator) {
            audioLoadingIndicator.style.display = 'none';
        }

        // Re-enable start button
        if (demoStartTreatment) {
            demoStartTreatment.disabled = false;
        }

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

    // ==================== AUDIO ELEMENT EVENT LISTENERS ====================

    // Audio loading progress
    if (treatmentAudio) {
        treatmentAudio.addEventListener('progress', () => {
            if (treatmentAudio.buffered.length > 0) {
                const buffered = treatmentAudio.buffered.end(treatmentAudio.buffered.length - 1);
                const duration = treatmentAudio.duration;
                if (duration > 0) {
                    const percent = (buffered / duration) * 100;
                    audioLoadingProgress.style.width = `${percent}%`;
                }
            }
        });

        // Audio can play through - enough data loaded
        treatmentAudio.addEventListener('canplaythrough', () => {
            console.log('Audio ready to play');
            audioLoadingIndicator.style.display = 'none';
            demoStartTreatment.disabled = false;
        });

        // Audio can start playing (but might need to buffer)
        treatmentAudio.addEventListener('canplay', () => {
            if (isPlaying && treatmentAudio.paused) {
                treatmentAudio.play().then(() => {
                    console.log('Audio playback started');
                    startTimer();
                }).catch(err => {
                    console.error('Playback failed:', err);
                    alert('Failed to start playback. Please try again.');
                    stopTreatment(false);
                });
            }
        });

        // Audio is playing
        treatmentAudio.addEventListener('playing', () => {
            audioLoadingIndicator.style.display = 'none';
        });

        // Audio is waiting for more data (buffering)
        treatmentAudio.addEventListener('waiting', () => {
            console.log('Audio buffering...');
            audioLoadingIndicator.querySelector('strong').textContent = '⏳ Buffering...';
            audioLoadingIndicator.style.display = 'block';
        });

        // Audio playback ended
        treatmentAudio.addEventListener('ended', () => {
            console.log('Audio ended');
            stopTreatment(true);
        });

        // Audio error
        treatmentAudio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            let errorMsg = 'Failed to load audio file.';

            if (treatmentAudio.error) {
                switch (treatmentAudio.error.code) {
                    case treatmentAudio.error.MEDIA_ERR_ABORTED:
                        errorMsg = 'Audio loading was aborted.';
                        break;
                    case treatmentAudio.error.MEDIA_ERR_NETWORK:
                        errorMsg = 'Network error while loading audio.';
                        break;
                    case treatmentAudio.error.MEDIA_ERR_DECODE:
                        errorMsg = 'Audio file is corrupted or unsupported.';
                        break;
                    case treatmentAudio.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMsg = 'Audio file not found or not available yet.';
                        break;
                }
            }

            alert(`${errorMsg}\n\nPlease try:\n• Checking your internet connection\n• Using the "Download MP3 File" option instead\n• Selecting a different frequency (8000 Hz has all files available)`);
            stopTreatment(false);
        });

        // Sync timer with actual audio time
        treatmentAudio.addEventListener('timeupdate', () => {
            if (isPlaying && treatmentAudio.duration > 0) {
                const elapsed = treatmentAudio.currentTime;
                const remaining = Math.floor(treatmentAudio.duration - elapsed);

                if (remaining >= 0 && remaining !== remainingSeconds) {
                    remainingSeconds = remaining;
                    demoTimeRemaining.textContent = formatTime(remainingSeconds);
                    const progress = (elapsed / treatmentAudio.duration) * 100;
                    demoProgressBar.style.width = `${progress}%`;
                }
            }
        });
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
            if (treatmentAudio) {
                treatmentAudio.volume = volume;
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

    // Treatment - Stream pre-generated audio
    if (demoStartTreatment) {
        demoStartTreatment.addEventListener('click', async () => {
            if (!selectedTinnitusFreq) {
                alert('Please complete the frequency matching first.');
                return;
            }

            // Build file URL for GitHub raw content
            const filename = `untinnitus-${selectedTinnitusFreq}Hz-${selectedHearingProfile}.mp3`;
            const githubRepo = 'RobertSvebeck/Un-Tinitus';
            const branch = 'main';
            const fileUrl = `https://raw.githubusercontent.com/${githubRepo}/${branch}/audio-files/${filename}`;

            // Show progress section
            demoTreatmentProgress.style.display = 'block';
            audioLoadingIndicator.style.display = 'block';
            audioLoadingProgress.style.width = '0%';

            // Disable start button during loading
            demoStartTreatment.disabled = true;

            // Set audio source and volume
            treatmentAudio.src = fileUrl;
            treatmentAudio.volume = volume;

            // Try to load the audio
            try {
                await treatmentAudio.load();

                // Request Wake Lock to prevent screen from sleeping
                const wakeLockEnabled = await requestWakeLock();

                // Initialize MediaSession for background playback
                initializeMediaSession();

                isPlaying = true;

                demoTreatmentProgress.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (error) {
                console.error('Failed to load audio:', error);
                alert(`Failed to load audio file: ${filename}\n\nPlease check your internet connection or try the "Download MP3 File" option instead.`);
                demoTreatmentProgress.style.display = 'none';
                demoStartTreatment.disabled = false;
                isPlaying = false;
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

    // Download session
    if (downloadSession) {
        downloadSession.addEventListener('click', async () => {
            if (!selectedTinnitusFreq) {
                alert('Please complete the frequency matching first.');
                return;
            }

            // Create filename for pre-generated audio file
            const filename = `untinnitus-${selectedTinnitusFreq}Hz-${selectedHearingProfile}.mp3`;

            // Use GitHub raw URL for hosted files
            const githubRepo = 'RobertSvebeck/Un-Tinitus';
            const branch = 'main';
            const fileUrl = `https://raw.githubusercontent.com/${githubRepo}/${branch}/audio-files/${filename}`;

            // Disable button temporarily
            downloadSession.disabled = true;
            const originalText = downloadSession.textContent;
            downloadSession.textContent = 'Checking file...';

            try {
                // Check if file exists with a simple fetch
                const checkResponse = await fetch(fileUrl, {
                    method: 'GET',
                    headers: { 'Range': 'bytes=0-0' } // Only fetch first byte to check existence
                });

                if (!checkResponse.ok) {
                    throw new Error('File not available');
                }

                // File exists, trigger download
                window.open(fileUrl, '_blank');

                console.log(`Downloading pre-generated file: ${filename}`);
                console.log(`URL: ${fileUrl}`);

                // Show success message
                setTimeout(() => {
                    alert('Download started! The file will open in a new tab. Right-click and "Save As" to download. You can play this file anytime, even with your screen off.');
                }, 500);

            } catch (error) {
                console.error('Download failed:', error);

                // Show helpful error message
                const availableFreqs = '8000 Hz (normal hearing)';
                const message = `Sorry, the audio file for ${selectedTinnitusFreq} Hz (${selectedHearingProfile} hearing) is not available yet.\n\n` +
                                `Currently available: ${availableFreqs}\n\n` +
                                `You can either:\n` +
                                `• Try "Stream Now" instead (works for all frequencies)\n` +
                                `• Select 8000 Hz with normal hearing profile\n` +
                                `• Wait for more files to be generated`;

                alert(message);
            } finally {
                // Re-enable button
                downloadSession.disabled = false;
                downloadSession.textContent = originalText;
            }
        });
    }

    // Handle page visibility change
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'hidden' && isPlaying && audioContext) {
            // Keep playing in background - try to resume if suspended
            if (audioContext.state === 'suspended') {
                try {
                    await audioContext.resume();
                    console.log('Audio context resumed while hidden');
                } catch (err) {
                    console.error('Failed to resume audio context:', err);
                }
            }
        } else if (document.visibilityState === 'visible' && isPlaying && audioContext) {
            // Resume when page becomes visible again
            if (audioContext.state === 'suspended') {
                try {
                    await audioContext.resume();
                    console.log('Audio context resumed when visible');
                } catch (err) {
                    console.error('Failed to resume audio context:', err);
                }
            }
        }
    });

    // Handle audio context state changes
    document.addEventListener('resume', async () => {
        if (audioContext && audioContext.state === 'suspended' && isPlaying) {
            try {
                await audioContext.resume();
                console.log('Audio context resumed on app resume');
            } catch (err) {
                console.error('Failed to resume audio:', err);
            }
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
