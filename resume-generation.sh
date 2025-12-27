#!/bin/bash
# Resume audio file generation
# This will skip already-generated files and continue where you left off

# Check if already running
if pgrep -f "generate-audio-files.js" > /dev/null; then
    echo "⚠️  Generation is already running!"
    echo "Current progress: $(ls audio-files/*.mp3 2>/dev/null | wc -l)/32 files"
    echo ""
    echo "To stop it:  pkill -f 'generate-audio-files.js'"
    echo "To monitor:  tail -f generation.log"
    exit 1
fi

echo "Resuming Un-Tinnitus audio file generation..."
echo "Files already completed: $(ls audio-files/*.mp3 2>/dev/null | wc -l)/32"
echo "Files will be skipped if they already exist."
echo ""

# Run in background and save output to log
nohup node generate-audio-files.js > generation.log 2>&1 &
PID=$!

echo "✓ Generation started in background (PID: $PID)"
echo ""
echo "Commands:"
echo "  Check progress:  tail -f generation.log"
echo "  Count files:     ls audio-files/*.mp3 | wc -l"
echo "  Stop process:    pkill -f 'generate-audio-files.js'"
echo ""
