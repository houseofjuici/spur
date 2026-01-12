# VIDEO FOCUS OVERLAY SYSTEM
## Non-Destructive Viewer Focus Manipulation

---

## OVERVIEW

This system generates a **separate alpha-transparent overlay** that manipulates viewer focus without modifying your original video. The overlay creates a "protected center region" that remains perfectly clear while applying visual effects (blur, TV static, analog artifacts) to the peripheral areas.

### Key Features

- ✓ **Non-destructive**: Original video remains completely untouched
- ✓ **Center protection**: Defined region stays 100% transparent (no effects)
- ✓ **Peripheral effects**: Blur, TV static, RGB shift, horizontal jitter
- ✓ **Time-based states**: Switch between "focused" and "unfocused" modes
- ✓ **Iris animations**: Looney Tunes-style opening and closing effects
- ✓ **Parameterized**: Easily adjust effect intensity and timing
- ✓ **Production-ready**: High-quality output suitable for final delivery

---

## SYSTEM ARCHITECTURE

```
┌──────────────────────────────────────────┐
│       LAYER 1: BASE VIDEO                │
│       (Your Original Video)              │
│       ● Completely untouched             │
│       ● Full resolution maintained       │
└──────────────────────────────────────────┘
                   ▼ Composited with
┌──────────────────────────────────────────┐
│       LAYER 2: FOCUS OVERLAY             │
│       (Generated Alpha Video)            │
│  ┌────────────────────────────────────┐  │
│  │  PERIPHERAL REGION (Effects Zone)  │  │
│  │  • Gaussian blur                   │  │
│  │  • TV static noise                 │  │
│  │  • Analog artifacts                │  │
│  │                                    │  │
│  │     ┌────────────────────┐         │  │
│  │     │  CENTER REGION     │         │  │
│  │     │  (Protected Zone)  │         │  │
│  │     │  ● Alpha = 0       │         │  │
│  │     │  ● Fully transparent│        │  │
│  │     │  ● No effects      │         │  │
│  │     └────────────────────┘         │  │
│  │            ▲                       │  │
│  │       Feathered Edge               │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

---

## QUICK START

### Prerequisites

```bash
# Python 3.8+
python --version

# OpenCV
pip install opencv-python opencv-contrib-python numpy

# FFmpeg (for compositing)
# Ubuntu/Debian:
sudo apt install ffmpeg

# macOS:
brew install ffmpeg

# Windows:
# Download from https://ffmpeg.org/
```

### Installation

```bash
# Clone or download the following files:
# 1. video_focus_overlay.py      - Overlay generator
# 2. overlay_config.json          - Configuration file
# 3. composite_overlay.py         - Compositing script
# 4. VIDEO_OVERLAY_README.md      - This file

# Make scripts executable (Linux/macOS)
chmod +x video_focus_overlay.py composite_overlay.py
```

---

## WORKFLOW

### Step 1: Configure Your Settings

Edit `overlay_config.json`:

```json
{
  "video": {
    "width": 1920,              // Match your video resolution
    "height": 1080,
    "fps": 30.0,                // Match your video frame rate
    "base_video": "my_video.mp4",     // Your original video
    "output_video": "final_output.mp4"
  },
  "center_region": {
    "width_percent": 0.4,       // Center width (40% of frame)
    "height_percent": 0.6,      // Center height (60% of frame)
    "feather_pixels": 50        // Soft edge width
  },
  "timeline": [
    {
      "start": 0.0,             // Start time (seconds)
      "end": 5.0,               // End time (seconds)
      "state": "focused",       // "focused" or "unfocused"
      "effects": {
        "blur": true,           // Enable Gaussian blur
        "noise": true,          // Enable TV static
        "artifacts": true       // Enable RGB shift + jitter
      }
    },
    // Add more timeline segments...
  ]
}
```

### Step 2: Generate the Overlay

```bash
python video_focus_overlay.py
```

This creates `focus_overlay_alpha.mp4` - your alpha-transparent overlay.

**Expected output:**
```
Generating overlay: 1500 frames at 30.0 fps
Segment 1: focused (150 frames)
  Progress: 10.0% (150/1500 frames)
Segment 2: unfocused (300 frames)
  Progress: 30.0% (450/1500 frames)
...
Overlay generation complete!

✓ Overlay generated: focus_overlay_alpha.mp4
```

### Step 3: Preview the Overlay

Open `focus_overlay_alpha.mp4` in a video player:
- **Transparent areas** (center) will appear black/checkerboard
- **Effect areas** (periphery) will show blur + noise

### Step 4: Composite with Base Video

```bash
python composite_overlay.py
```

Follow the prompts:
1. Choose FFmpeg (recommended) or OpenCV
2. Select quality preset (high/medium/fast)

**Result:** `final_output.mp4` combines your base video with the overlay.

---

## DETAILED CONFIGURATION

### Video Settings

```json
"video": {
  "width": 1920,        // Must match base video
  "height": 1080,       // Must match base video
  "fps": 30.0,          // Must match base video
  "base_video": "path/to/video.mp4",
  "output_video": "result.mp4"
}
```

**How to find your video specs:**
```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate \
  -of json your_video.mp4
```

### Center Region Configuration

```json
"center_region": {
  "width_percent": 0.4,    // 0.0 to 1.0 (0.4 = 40% of frame width)
  "height_percent": 0.6,   // 0.0 to 1.0 (0.6 = 60% of frame height)
  "feather_pixels": 50     // Soft edge width (larger = softer)
}
```

**Visual guide for center sizing:**
```
width_percent: 0.3 → ┌────────┐  Small center
                     │  ART   │
                     └────────┘

width_percent: 0.5 → ┌──────────────┐  Medium center
                     │     ART      │
                     └──────────────┘

width_percent: 0.7 → ┌────────────────────┐  Large center
                     │        ART         │
                     └────────────────────┘
```

### Timeline States

#### FOCUSED State (Effects Active)
```json
{
  "start": 0.0,
  "end": 5.0,
  "state": "focused",
  "effects": {
    "blur": true,      // Heavy Gaussian blur on periphery
    "noise": true,     // TV static overlay
    "artifacts": true  // RGB shift + horizontal jitter
  }
}
```

**Use for:** Song sections, key moments, dramatic emphasis

#### UNFOCUSED State (Effects Disabled)
```json
{
  "start": 5.0,
  "end": 10.0,
  "state": "unfocused",
  "effects": {
    "blur": false,
    "noise": false,
    "artifacts": false
  }
}
```

**Use for:** Film clips, scenes you want fully visible

### Effect Parameters

Edit `video_focus_overlay.py` to customize effect intensity:

```python
# In FocusOverlayGenerator.__init__():

self.blur_strength = 25        # Blur kernel size (higher = more blur)
                               # Must be odd number (15, 25, 35, etc.)

self.noise_intensity = 0.3     # TV static opacity (0.0-1.0)
                               # 0.0 = invisible, 1.0 = full opacity

self.rgb_shift_amount = 3      # RGB channel separation in pixels
                               # Creates analog TV "ghosting" effect

self.jitter_amount = 2         # Horizontal scanline jitter in pixels
                               # Simulates analog video instability
```

---

## IRIS ANIMATION

The system automatically applies Looney Tunes-style iris effects:

### Opening (First Segment)
- First 0.5 seconds: Iris expands from point to full center region
- Draws viewer attention to center artwork
- Creates dramatic entrance

### Closing (Last Segment)
- Last 0.5 seconds: Iris contracts from center to point
- Classic cartoon ending effect
- Smooth exit transition

**Duration control:**
```python
# In generate_overlay():
iris_frames = int(0.5 * self.fps)  # Change 0.5 to adjust duration
```

---

## ADVANCED USAGE

### Custom Effect Intensity Per Segment

```json
{
  "start": 10.0,
  "end": 15.0,
  "state": "focused",
  "effects": {
    "blur": true,
    "noise": false,      // No static noise
    "artifacts": true    // Only blur + artifacts
  }
}
```

### Multiple State Transitions

```json
"timeline": [
  {"start": 0, "end": 3, "state": "focused"},      // Intro song
  {"start": 3, "end": 8, "state": "unfocused"},    // Film clip
  {"start": 8, "end": 12, "state": "focused"},     // Song
  {"start": 12, "end": 18, "state": "unfocused"},  // Film clip
  {"start": 18, "end": 22, "state": "focused"}     // Outro song
]
```

### Manual FFmpeg Compositing

If you prefer direct FFmpeg control:

```bash
# Basic overlay
ffmpeg -i base_video.mp4 -i focus_overlay_alpha.mp4 \
  -filter_complex '[0:v][1:v]overlay' \
  -c:v libx264 -crf 18 -preset slow \
  -c:a copy output.mp4

# With fade transitions
ffmpeg -i base_video.mp4 -i focus_overlay_alpha.mp4 \
  -filter_complex '[1:v]fade=t=in:st=0:d=0.5,fade=t=out:st=21.5:d=0.5[overlay];
                   [0:v][overlay]overlay' \
  -c:v libx264 -crf 18 -preset slow output.mp4
```

---

## TROUBLESHOOTING

### Problem: "Module 'cv2' not found"
```bash
pip install opencv-python opencv-contrib-python
```

### Problem: "FFmpeg not found"
Install FFmpeg for your platform (see Prerequisites above).

### Problem: Overlay doesn't match base video size
Ensure `overlay_config.json` width/height match your base video exactly:
```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height your_video.mp4
```

### Problem: Center region too small/large
Adjust `center_region.width_percent` and `height_percent` in config:
```json
"center_region": {
  "width_percent": 0.5,   // Try different values: 0.3, 0.4, 0.5, 0.6
  "height_percent": 0.7
}
```

### Problem: Effects too subtle
Increase effect parameters in `video_focus_overlay.py`:
```python
self.blur_strength = 45      # Higher = more blur
self.noise_intensity = 0.6   # Higher = more visible static
```

### Problem: Feather edge too harsh
Increase `feather_pixels`:
```json
"center_region": {
  "feather_pixels": 100  // Higher = softer transition
}
```

---

## PERFORMANCE OPTIMIZATION

### Fast Preview Generation
```python
# Reduce resolution for testing
VIDEO_CONFIG = {
    'width': 960,   # Half resolution
    'height': 540,
    'fps': 15.0     # Half frame rate
}
```

### Production Quality
```python
# Full resolution + smooth frame rate
VIDEO_CONFIG = {
    'width': 1920,
    'height': 1080,
    'fps': 60.0     // 60fps for ultra-smooth motion
}
```

### Memory Management
For very long videos (>10 minutes), process in segments:
```python
# Split timeline into chunks
TIMELINE_PART_1 = [...]  # 0-5 minutes
TIMELINE_PART_2 = [...]  # 5-10 minutes
# Generate separate overlays, then concatenate
```

---

## EXPORT FORMATS

### For Web Delivery
```bash
# H.264 with web-optimized settings
ffmpeg -i base.mp4 -i overlay.mp4 \
  -filter_complex '[0:v][1:v]overlay' \
  -c:v libx264 -crf 23 -preset fast \
  -movflags +faststart \  # Enable streaming
  web_output.mp4
```

### For High-Quality Archive
```bash
# ProRes 422 HQ (large file size)
ffmpeg -i base.mp4 -i overlay.mp4 \
  -filter_complex '[0:v][1:v]overlay' \
  -c:v prores_ks -profile:v 3 \
  -c:a pcm_s16le \
  archive.mov
```

### For Social Media
```bash
# Instagram/TikTok (1080x1920, portrait)
ffmpeg -i base.mp4 -i overlay.mp4 \
  -filter_complex '[0:v][1:v]overlay,scale=1080:1920:force_original_aspect_ratio=decrease' \
  -c:v libx264 -crf 23 -preset fast \
  social_media.mp4
```

---

## CREATIVE VARIATIONS

### Subtle Focus (Minimal Effects)
```python
self.blur_strength = 11       # Light blur
self.noise_intensity = 0.1    # Barely visible static
self.rgb_shift_amount = 0     # No RGB shift
self.jitter_amount = 0        # No jitter
```

### Extreme Focus (Heavy Effects)
```python
self.blur_strength = 51       # Heavy blur
self.noise_intensity = 0.7    # Strong static
self.rgb_shift_amount = 8     # Pronounced ghosting
self.jitter_amount = 5        # Significant jitter
```

### Circular Center Region
Modify `_create_center_mask()`:
```python
# Replace rectangular mask with circular mask
center_x = self.width // 2
center_y = self.height // 2
radius = min(self.center_width, self.center_height) // 2

y_grid, x_grid = np.ogrid[:self.height, :self.width]
dist_from_center = np.sqrt((x_grid - center_x)**2 + (y_grid - center_y)**2)
mask = np.where(dist_from_center <= radius, 1.0, 0.0)
```

---

## TECHNICAL SPECIFICATIONS

### Supported Input Formats
- Video: MP4, MOV, AVI, MKV, WebM
- Codecs: H.264, H.265/HEVC, ProRes, VP9

### Output Specifications
- **Overlay video**: MP4 with alpha channel (BGRA)
- **Composite video**: H.264 MP4 (configurable quality)
- **Resolution**: Up to 4K (3840×2160)
- **Frame rates**: 24, 25, 30, 60 fps

### Effect Processing
- **Blur algorithm**: Gaussian blur (OpenCV)
- **Noise generation**: Random uniform distribution
- **Alpha blending**: Porter-Duff compositing
- **Feathering**: Gaussian kernel soft masking

---

## CREDITS & LICENSE

**Author:** Senior Video Systems Engineer
**License:** MIT (modify and distribute freely)

**Dependencies:**
- OpenCV (BSD License)
- NumPy (BSD License)
- FFmpeg (LGPL/GPL)

---

## SUPPORT

For issues, questions, or feature requests:
1. Check the Troubleshooting section above
2. Verify your configuration matches your base video specs
3. Test with a short video clip first (10-15 seconds)
4. Review effect parameters for intensity adjustments

---

## WORKFLOW CHECKLIST

- [ ] Install prerequisites (Python, OpenCV, FFmpeg)
- [ ] Download all script files
- [ ] Get video specs (`ffprobe your_video.mp4`)
- [ ] Edit `overlay_config.json` with your settings
- [ ] Run `python video_focus_overlay.py`
- [ ] Preview `focus_overlay_alpha.mp4`
- [ ] Adjust timeline/effects if needed
- [ ] Run `python composite_overlay.py`
- [ ] Review `final_output.mp4`
- [ ] Export for your target platform

---

**Ready to create your focus overlay? Start with Step 1 in the Quick Start section!**
