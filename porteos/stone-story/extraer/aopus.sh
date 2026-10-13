#!/bin/bash
# WAV -> Opus mono 32 kb/s (musica estereo 48 kb/s)
cd /tmp/claude-0/ss/audio
for f in *.wav; do
  o=/tmp/claude-0/ss/opus/${f%.wav}.ogg
  [ -f "$o" ] && continue
  ch=$(ffprobe -v error -show_entries stream=channels -of csv=p=0 "$f")
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" | cut -d. -f1)
  if [ "${dur:-0}" -gt 30 ]; then br=48k; ac=2; else br=32k; ac=1; fi
  ffmpeg -v error -i "$f" -ac $ac -c:a libopus -b:a $br "$o" </dev/null
done
echo listo
