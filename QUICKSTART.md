# QUICK START GUIDE
## Video Focus Overlay System - Get Started in 5 Minutes

---

## INSTALLATION (1 minute)

```bash
# Install Python dependencies
pip install -r requirements.txt

# Verify FFmpeg is installed
ffmpeg -version

# If FFmpeg missing:
# Ubuntu/Debian: sudo apt install ffmpeg
# macOS: brew install ffmpeg
# Windows: Download from https://ffmpeg.org/
```

---

## TRY THE DEMO (2 minutes)

```bash
# Option 1: Automated full demo
python run_full_demo.py

# Option 2: Step-by-step demo
python demo_test_pattern.py        # Generate test video
python video_focus_overlay.py      # Generate overlay
python composite_overlay.py        # Combine videos
```

**Result:** `demo_final_output.mp4` shows the complete effect

---

## USE WITH YOUR VIDEO (2 minutes)

### Step 1: Get your video specs
```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate \
  your_video.mp4
```

### Step 2: Edit `overlay_config.json`
```json
{
  "video": {
    "width": 1920,              // Your video width
    "height": 1080,             // Your video height
    "fps": 30.0,                // Your video FPS
    "base_video": "your_video.mp4",
    "output_video": "final.mp4"
  },
  "center_region": {
    "width_percent": 0.4,       // Center size (0.3-0.7 recommended)
    "height_percent": 0.6,
    "feather_pixels": 50        // Soft edge (30-100)
  },
  "timeline": [
    {
      "start": 0.0,             // When to start effect
      "end": 5.0,               // When to end effect
      "state": "focused",       // "focused" = effects ON
      "effects": {
        "blur": true,
        "noise": true,
        "artifacts": true
      }
    }
    // Add more timeline segments...
  ]
}
```

### Step 3: Generate and composite
```bash
python video_focus_overlay.py     # Creates focus_overlay_alpha.mp4
python composite_overlay.py       # Creates final.mp4
```

---

## TIMELINE STATES

### FOCUSED (Effects Active)
```json
{
  "start": 0.0,
  "end": 5.0,
  "state": "focused",
  "effects": {"blur": true, "noise": true, "artifacts": true}
}
```
- ✓ Use for: Song sections, key moments
- ✓ Effect: Center clear, periphery blurred + static

### UNFOCUSED (Effects Off)
```json
{
  "start": 5.0,
  "end": 10.0,
  "state": "unfocused",
  "effects": {"blur": false, "noise": false, "artifacts": false}
}
```
- ✓ Use for: Film clips, scenes
- ✓ Effect: Full video visible

---

## ADJUST CENTER SIZE

```json
"center_region": {
  "width_percent": 0.3,   // Small center  ┌────┐
  "width_percent": 0.5,   // Medium center ┌─────────┐
  "width_percent": 0.7    // Large center  ┌──────────────┐
}
```

---

## ADJUST EFFECT INTENSITY

Edit `video_focus_overlay.py` (around line 45):

```python
# Light effects
self.blur_strength = 15
self.noise_intensity = 0.1

# Medium effects (default)
self.blur_strength = 25
self.noise_intensity = 0.3

# Heavy effects
self.blur_strength = 45
self.noise_intensity = 0.7
```

---

## COMMON ISSUES

**"Module cv2 not found"**
```bash
pip install opencv-python opencv-contrib-python
```

**"FFmpeg not found"**
```bash
# See installation instructions above
```

**Center region wrong size**
```json
// Adjust these in overlay_config.json:
"width_percent": 0.5,   // Try 0.3, 0.4, 0.5, 0.6, 0.7
"height_percent": 0.6
```

**Effects too subtle**
```python
# In video_focus_overlay.py:
self.blur_strength = 45      # Increase for more blur
self.noise_intensity = 0.6   # Increase for more static
```

---

## FILE STRUCTURE

```
your_project/
├── video_focus_overlay.py          # Main overlay generator
├── overlay_config.json             # Your settings
├── composite_overlay.py            # Compositing tool
├── requirements.txt                # Python dependencies
├── VIDEO_OVERLAY_README.md         # Full documentation
├── QUICKSTART.md                   # This file
├── demo_test_pattern.py            # Demo test pattern
├── demo_config.json                # Demo settings
└── run_full_demo.py                # Automated demo
```

---

## WORKFLOW SUMMARY

```
┌─────────────────┐
│  Your Video     │
└────────┬────────┘
         │
         ├──→ Edit overlay_config.json
         │
         ├──→ python video_focus_overlay.py
         │    (generates focus_overlay_alpha.mp4)
         │
         └──→ python composite_overlay.py
              (generates final.mp4)
```

---

## WHAT GETS CREATED?

1. **focus_overlay_alpha.mp4** - Transparent overlay layer
   - Center: Fully transparent (alpha = 0)
   - Periphery: Effects (blur, noise, artifacts)

2. **final.mp4** - Your video + overlay composited
   - Original video untouched underneath
   - Effects applied on top
   - Ready for distribution

---

## NEXT STEPS

- ✓ Try the demo: `python run_full_demo.py`
- ✓ Read full docs: `VIDEO_OVERLAY_README.md`
- ✓ Experiment with timeline states
- ✓ Adjust effect intensity
- ✓ Fine-tune center region size

---

## ONE-LINE COMMANDS

```bash
# Full demo
python run_full_demo.py

# Quick preview (lower quality, faster)
python video_focus_overlay.py && python composite_overlay.py

# High quality production
# (Edit overlay_config.json first, then:)
python video_focus_overlay.py && \
  ffmpeg -i your_video.mp4 -i focus_overlay_alpha.mp4 \
  -filter_complex '[0:v][1:v]overlay' \
  -c:v libx264 -crf 18 -preset slow -c:a copy final.mp4
```

---

**Ready to start? Run: `python run_full_demo.py`**
