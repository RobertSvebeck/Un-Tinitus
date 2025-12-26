#!/bin/bash
# Resume audio file generation
# This will skip already-generated files and continue where you left off

echo "Resuming Un-Tinnitus audio file generation..."
echo "Files already completed: $(ls audio-files/*.mp3 2>/dev/null | wc -l)"
echo ""

# Run in background and save output to log
nohup node generate-audio-files.js > generation.log 2>&1 &

echo "Generation running in background!"
echo "Check progress: tail -f generation.log"
echo "Or check file count: ls audio-files/*.mp3 | wc -l"
echo ""
