#!/bin/sh
# Makes the sample media in samples/ with ffmpeg: a test pattern with a tone, and a short
# arpeggio. Everything is generated here, so the samples carry no third-party content.
#   sh tools/samples.sh
set -e
cd "$(dirname "$0")/../samples"

# Notes of a C major arpeggio, half a second each, each faded in and out so there are no clicks.
NOTES='if(lt(mod(t,4),0.5),261.63,if(lt(mod(t,4),1),329.63,if(lt(mod(t,4),1.5),392,if(lt(mod(t,4),2),523.25,if(lt(mod(t,4),2.5),392,if(lt(mod(t,4),3),329.63,if(lt(mod(t,4),3.5),261.63,196)))))))'
TONE="0.35*sin(2*PI*t*($NOTES))*sin(PI*mod(t,0.5)/0.5)"

# 8 s of 640 × 360 test pattern with the arpeggio, H.264 + AAC, moov atom first so it starts at once.
ffmpeg -y -loglevel error -f lavfi -i "testsrc2=size=640x360:rate=25:duration=8" \
  -f lavfi -i "aevalsrc='$TONE':s=44100:d=8" \
  -c:v libx264 -profile:v baseline -pix_fmt yuv420p -crf 30 -preset slow \
  -c:a aac -b:a 64k -ac 1 -movflags +faststart test-pattern.mp4

# The same as WebM (VP9 + Opus).
ffmpeg -y -loglevel error -f lavfi -i "testsrc2=size=640x360:rate=25:duration=8" \
  -f lavfi -i "aevalsrc='$TONE':s=48000:d=8" \
  -c:v libvpx-vp9 -b:v 0 -crf 42 -row-mt 1 -c:a libopus -b:a 48k -ac 1 test-pattern.webm

# Just the arpeggio, as MP3 and as Ogg Opus.
# Both carry tags (title, artist, album); the MP3 also carries cover art (ID3v2.3 APIC), drawn in
# tools/cover.svg and rendered with rsvg-convert.
rsvg-convert -w 300 -h 300 ../tools/cover.svg -o /tmp/arpeggio-cover.png
ffmpeg -y -loglevel error -i /tmp/arpeggio-cover.png -q:v 4 /tmp/arpeggio-cover.jpg
ffmpeg -y -loglevel error -f lavfi -i "aevalsrc='$TONE':s=44100:d=8" -i /tmp/arpeggio-cover.jpg \
  -map 0:a -map 1:v -c:a libmp3lame -b:a 96k -ac 1 -c:v copy -id3v2_version 3 -metadata title=Arpeggio -metadata artist='Solid panes' -metadata album=Samples \
  -metadata:s:v title='Album cover' -metadata:s:v comment='Cover (front)' -disposition:v attached_pic arpeggio.mp3
ffmpeg -y -loglevel error -f lavfi -i "aevalsrc='$TONE':s=48000:d=8" -c:a libopus -b:a 48k -ac 1 -metadata title=Arpeggio -metadata artist='Solid panes' -metadata album=Samples arpeggio.ogg
rm -f /tmp/arpeggio-cover.png /tmp/arpeggio-cover.jpg

ls -l
