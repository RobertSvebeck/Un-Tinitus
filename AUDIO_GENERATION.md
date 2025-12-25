# Audio File Generation Guide

This guide explains how to pre-generate all the Un-Tinnitus treatment audio files.

## Overview

The app requires 32 pre-generated MP3 files:
- **8 frequencies**: 1000Hz, 2000Hz, 4000Hz, 5700Hz, 8000Hz, 9500Hz, 11000Hz, 13000Hz
- **4 hearing profiles**: normal, mild, moderate, severe
- **Total**: 32 files (~2GB total)

Each file is a 60-minute personalized treatment session at ~60MB per file.

## Prerequisites

1. **Node.js** (v14 or higher)
   - Check: `node --version`
   - Install from: https://nodejs.org/

2. **FFmpeg** (for MP3 encoding)
   - **macOS**: `brew install ffmpeg`
   - **Ubuntu/Debian**: `sudo apt-get install ffmpeg`
   - **Windows**: Download from https://ffmpeg.org/download.html
   - Check: `ffmpeg -version`

## Generation Process

### Step 1: Install Dependencies

No additional npm packages are needed. The script uses Node.js built-in modules.

### Step 2: Run the Generator

```bash
node generate-audio-files.js
```

This will:
1. Create an `audio-files/` directory
2. Generate each file (takes ~2-3 minutes per file)
3. Convert to MP3 format (128kbps)
4. Delete temporary WAV files

**Total generation time**: ~1-2 hours for all 32 files

### Step 3: Monitor Progress

The script shows progress for each file:

```
[1/32] Generating 1000Hz - normal hearing
------------------------------------------------------------
  Generating audio buffer for 1000Hz, normal profile...
  Processing 900 chunks...
    Progress: 0.0%
    Progress: 11.1%
    Progress: 22.2%
    ...
  Audio buffer generation complete!
  Creating WAV file...
  WAV file created: 617.85 MB
  Converting to MP3...
  MP3 file created: 58.23 MB
  Temporary WAV file deleted
  ✓ Successfully generated: untinnitus-1000Hz-normal.mp3
```

### Step 4: Verify Output

After completion, check the `audio-files/` directory:

```bash
ls -lh audio-files/
```

You should see 32 MP3 files:
- `untinnitus-1000Hz-normal.mp3`
- `untinnitus-1000Hz-mild.mp3`
- `untinnitus-1000Hz-moderate.mp3`
- `untinnitus-1000Hz-severe.mp3`
- ... (and so on for all frequencies)

## File Naming Convention

Files are named following this pattern:
```
untinnitus-{FREQUENCY}Hz-{PROFILE}.mp3
```

Examples:
- `untinnitus-8000Hz-normal.mp3` - 8kHz tinnitus, normal hearing
- `untinnitus-4000Hz-moderate.mp3` - 4kHz tinnitus, moderate hearing loss

## Deployment

After generating all files:

1. **Upload to your server** or **commit to repository**:
   ```bash
   git add audio-files/*.mp3
   git commit -m "Add pre-generated treatment audio files"
   git push
   ```

2. **Or use a CDN** for better performance:
   - Upload to AWS S3, Google Cloud Storage, or similar
   - Update `app.js` line 695 to point to your CDN URL:
     ```javascript
     const fileUrl = `https://your-cdn.com/audio-files/${filename}`;
     ```

## Troubleshooting

### Error: "ffmpeg not found"
- Install ffmpeg using the instructions above
- Ensure ffmpeg is in your system PATH

### Error: "ENOMEM" or "JavaScript heap out of memory"
- This is rare but can happen on low-memory systems
- Increase Node.js memory limit:
  ```bash
  NODE_OPTIONS="--max-old-space-size=4096" node generate-audio-files.js
  ```

### Files are too large
- The script uses 128kbps MP3 encoding (good quality/size balance)
- To reduce size further, edit line 218 in `generate-audio-files.js`:
  ```javascript
  const command = `ffmpeg -i "${wavFile}" -codec:a libmp3lame -b:a 96k -y "${mp3File}"`;
  ```
  (96kbps will create ~44MB files instead of ~60MB)

### Generation is slow
- Each file takes 2-3 minutes to generate (this is normal)
- The script generates 60 minutes of complex audio with modulation
- You can run multiple instances in parallel:
  ```bash
  # Terminal 1: Generate first 16 files
  # Modify script to process only frequencies 1000-5700

  # Terminal 2: Generate last 16 files
  # Modify script to process only frequencies 8000-13000
  ```

## Re-generating Specific Files

If you need to regenerate only specific files, delete them first:

```bash
# Delete specific file
rm audio-files/untinnitus-8000Hz-normal.mp3

# Re-run generator (it skips existing files)
node generate-audio-files.js
```

## Technical Details

### Audio Specifications
- **Sample Rate**: 44.1 kHz
- **Channels**: Stereo (2 channels)
- **Duration**: 3600 seconds (60 minutes)
- **Format**: MP3, 128 kbps CBR
- **Frequency Range**: 1-16 kHz harmonic complexes
- **Modulation**: Cross-frequency de-correlating amplitude modulation

### Algorithm
The generator implements the exact algorithm from the research paper:
- Broadband harmonic complexes (96-256 Hz fundamental)
- 1-octave modulation band centered on tinnitus frequency
- Continuously varying spectral modulation rate (4.5 ± 3 cycles/octave)
- 1 Hz temporal modulation rate
- Hearing loss compensation (0-45 dB frequency-dependent boost)

### Memory Usage
During generation:
- **Peak RAM**: ~2-3 GB per file
- **Disk Space**: ~620 MB temporary WAV file + ~60 MB final MP3
- **Total Final Size**: ~2 GB for all 32 files

## Support

If you encounter issues:
1. Check Node.js version: `node --version` (should be v14+)
2. Check FFmpeg version: `ffmpeg -version`
3. Check available disk space: `df -h`
4. Check available RAM: `free -h` (Linux) or Activity Monitor (macOS)

For more help, open an issue on GitHub.
