#!/usr/bin/env node

/**
 * Pre-generate all Un-Tinnitus treatment audio files
 * Generates 32 files: 8 frequencies × 4 hearing profiles
 * Each file is 60 minutes of personalized treatment audio
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const QUICK_MODE = process.argv.includes('--quick');

const ALL_FREQUENCIES = [1000, 2000, 4000, 5700, 8000, 9500, 11000, 13000];
const QUICK_FREQUENCIES = [8000]; // Most common tinnitus frequency

const FREQUENCIES = QUICK_MODE ? QUICK_FREQUENCIES : ALL_FREQUENCIES;
const HEARING_PROFILES = ['normal', 'mild', 'moderate', 'severe'];
const DURATION = 3600; // 60 minutes
const SAMPLE_RATE = 44100;
const OUTPUT_DIR = path.join(__dirname, 'audio-files');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ==================== HEARING CORRECTION PROFILES ====================
function getHearingCorrectionGain(frequency, profile) {
    const freqKHz = frequency / 1000;

    let maxCorrection = 0;
    switch(profile) {
        case 'mild': maxCorrection = 15; break;
        case 'moderate': maxCorrection = 30; break;
        case 'severe': maxCorrection = 45; break;
        default: maxCorrection = 0; // normal
    }

    if (maxCorrection === 0) return 0;

    if (freqKHz <= 2) return 0;

    if (freqKHz <= 2.8) {
        const t = (freqKHz - 2) / (2.8 - 2);
        return t * (maxCorrection / 9);
    }

    if (freqKHz <= 8) {
        const t = (freqKHz - 2.8) / (8 - 2.8);
        return (maxCorrection / 9) + t * (7 * maxCorrection / 9);
    }

    return maxCorrection;
}

// ==================== AUDIO GENERATION ====================
function generateAudioSamples(tinnitusFreq, hearingProfile) {
    console.log(`  Generating audio buffer for ${tinnitusFreq}Hz, ${hearingProfile} profile...`);

    const numSamples = SAMPLE_RATE * DURATION;
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);

    // Calculate modulation band
    const modulatedBandCenter = tinnitusFreq;
    const modulatedBandLower = tinnitusFreq / Math.sqrt(2);
    const modulatedBandUpper = tinnitusFreq * Math.sqrt(2);

    // Modulation parameters
    const d = 1.0;
    const omega = 1.0;
    const mu = 4.5;
    const r = 3.0;
    const nu = 0.125;
    const q = Math.random() * 2 * Math.PI;
    const p = Math.random() * 2 * Math.PI;

    // Generate in 4-second chunks
    const chunkDuration = 4;
    const numChunks = Math.ceil(DURATION / chunkDuration);

    console.log(`  Processing ${numChunks} chunks...`);

    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
        if (chunkIndex % 100 === 0) {
            const progress = ((chunkIndex / numChunks) * 100).toFixed(1);
            console.log(`    Progress: ${progress}%`);
        }

        const chunkStartTime = chunkIndex * chunkDuration;
        const chunkStartSample = chunkStartTime * SAMPLE_RATE;
        const chunkSamples = Math.min(chunkDuration * SAMPLE_RATE, numSamples - chunkStartSample);

        // Random fundamental frequency
        const f0 = 96 + Math.random() * (256 - 96);

        const minHarmonic = Math.ceil(1000 / f0);
        const maxHarmonic = Math.floor(16000 / f0);
        const numHarmonics = maxHarmonic - minHarmonic + 1;

        // Generate each harmonic
        for (let n = minHarmonic; n <= maxHarmonic; n++) {
            const freq = n * f0;
            const isInModulatedBand = freq >= modulatedBandLower && freq <= modulatedBandUpper;

            // Hearing correction
            const correctionDB = getHearingCorrectionGain(freq, hearingProfile);
            const hearingGain = Math.pow(10, correctionDB / 20);

            const Fn = Math.log2(freq / modulatedBandCenter);
            const baseGain = (0.5 / numHarmonics) * hearingGain;

            // Generate samples for this harmonic
            for (let i = 0; i < chunkSamples; i++) {
                const sampleIndex = chunkStartSample + i;
                const t = sampleIndex / SAMPLE_RATE;

                // Calculate amplitude modulation
                let gain = baseGain;
                if (isInModulatedBand) {
                    const S_t = mu + r * Math.sin(p + 2 * Math.PI * nu * t);
                    const An_t = 1 + d * Math.sin(2 * Math.PI * (omega * t + Fn * S_t) + q);
                    gain = An_t * baseGain;
                }

                // Generate sine wave sample
                const sample = Math.sin(2 * Math.PI * freq * t) * gain;

                // Add to both channels
                leftChannel[sampleIndex] += sample;
                rightChannel[sampleIndex] += sample;
            }
        }
    }

    console.log(`  Audio buffer generation complete!`);
    return { leftChannel, rightChannel };
}

// ==================== WAV ENCODER ====================
function createWavFile(leftChannel, rightChannel, filename) {
    console.log(`  Creating WAV file...`);

    const numChannels = 2;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = leftChannel.length * blockAlign;
    const buffer = Buffer.alloc(44 + dataSize);

    // WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // fmt chunk size
    buffer.writeUInt16LE(1, 20);  // PCM format
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(SAMPLE_RATE, 24);
    buffer.writeUInt32LE(SAMPLE_RATE * blockAlign, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34); // bits per sample
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < leftChannel.length; i++) {
        // Clamp and convert to 16-bit PCM
        let leftSample = Math.max(-1, Math.min(1, leftChannel[i]));
        let rightSample = Math.max(-1, Math.min(1, rightChannel[i]));

        leftSample = leftSample < 0 ? leftSample * 0x8000 : leftSample * 0x7FFF;
        rightSample = rightSample < 0 ? rightSample * 0x8000 : rightSample * 0x7FFF;

        buffer.writeInt16LE(Math.round(leftSample), offset);
        buffer.writeInt16LE(Math.round(rightSample), offset + 2);
        offset += 4;
    }

    fs.writeFileSync(filename, buffer);
    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    console.log(`  WAV file created: ${sizeMB} MB`);
}

// ==================== MP3 CONVERSION ====================
async function convertToMP3(wavFile, mp3File) {
    console.log(`  Converting to MP3...`);

    // Use ffmpeg to convert WAV to MP3 at 128kbps
    const command = `ffmpeg -i "${wavFile}" -codec:a libmp3lame -b:a 128k -y "${mp3File}"`;

    try {
        await execAsync(command);
        const stats = fs.statSync(mp3File);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`  MP3 file created: ${sizeMB} MB`);

        // Delete WAV file to save space
        fs.unlinkSync(wavFile);
        console.log(`  Temporary WAV file deleted`);

        return true;
    } catch (error) {
        console.error(`  Error converting to MP3:`, error.message);
        return false;
    }
}

// ==================== MAIN GENERATION FUNCTION ====================
async function generateAllFiles() {
    console.log('='.repeat(60));
    console.log('Un-Tinnitus Audio File Generator');
    if (QUICK_MODE) {
        console.log('QUICK MODE: Generating 8000Hz only (most common)');
    }
    console.log('='.repeat(60));
    console.log(`Generating ${FREQUENCIES.length * HEARING_PROFILES.length} files...`);
    console.log(`Frequencies: ${FREQUENCIES.join(', ')} Hz`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
    console.log('');

    // Check if ffmpeg is available
    try {
        await execAsync('ffmpeg -version');
    } catch (error) {
        console.error('ERROR: ffmpeg not found. Please install ffmpeg first:');
        console.error('  macOS: brew install ffmpeg');
        console.error('  Ubuntu: sudo apt-get install ffmpeg');
        console.error('  Windows: Download from https://ffmpeg.org/download.html');
        process.exit(1);
    }

    let totalGenerated = 0;
    const totalFiles = FREQUENCIES.length * HEARING_PROFILES.length;

    for (const freq of FREQUENCIES) {
        for (const profile of HEARING_PROFILES) {
            totalGenerated++;
            console.log(`\n[${ totalGenerated}/${totalFiles}] Generating ${freq}Hz - ${profile} hearing`);
            console.log('-'.repeat(60));

            const filename = `untinnitus-${freq}Hz-${profile}`;
            const wavPath = path.join(OUTPUT_DIR, `${filename}.wav`);
            const mp3Path = path.join(OUTPUT_DIR, `${filename}.mp3`);

            // Skip if MP3 already exists
            if (fs.existsSync(mp3Path)) {
                console.log(`  ✓ File already exists, skipping: ${filename}.mp3`);
                continue;
            }

            try {
                // Generate audio samples
                const { leftChannel, rightChannel } = generateAudioSamples(freq, profile);

                // Create WAV file
                createWavFile(leftChannel, rightChannel, wavPath);

                // Convert to MP3
                const success = await convertToMP3(wavPath, mp3Path);

                if (success) {
                    console.log(`  ✓ Successfully generated: ${filename}.mp3`);
                } else {
                    console.log(`  ✗ Failed to generate: ${filename}.mp3`);
                }
            } catch (error) {
                console.error(`  ✗ Error generating ${filename}:`, error.message);
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Generation complete!');
    console.log(`Files saved to: ${OUTPUT_DIR}`);

    // Calculate total size
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.mp3'));
    let totalSize = 0;
    files.forEach(file => {
        const stats = fs.statSync(path.join(OUTPUT_DIR, file));
        totalSize += stats.size;
    });

    console.log(`Total files: ${files.length}`);
    console.log(`Total size: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log('='.repeat(60));
}

// Run the generator
if (require.main === module) {
    generateAllFiles().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { generateAllFiles };
