#!/usr/bin/env python3
"""
DEMO TEST PATTERN GENERATOR
Creates a test video to demonstrate the overlay system without needing an existing video.
Generates a colorful test pattern with center artwork simulation.
"""

import cv2
import numpy as np
from pathlib import Path


def generate_test_pattern_video(
    output_path: str = "test_pattern_base.mp4",
    width: int = 1920,
    height: int = 1080,
    fps: float = 30.0,
    duration: float = 20.0
):
    """
    Generate a test pattern video simulating your artwork setup.

    Args:
        output_path: Where to save the test video
        width: Video width
        height: Video height
        fps: Frames per second
        duration: Video length in seconds
    """

    total_frames = int(duration * fps)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    print(f"Generating test pattern video: {output_path}")
    print(f"Duration: {duration}s, Resolution: {width}x{height}, FPS: {fps}")

    # Calculate center region (matching overlay config)
    center_width = int(width * 0.4)
    center_height = int(height * 0.6)
    center_x = (width - center_width) // 2
    center_y = (height - center_height) // 2

    for frame_num in range(total_frames):
        # Create base frame with gradient background
        frame = np.zeros((height, width, 3), dtype=np.uint8)

        # Animated gradient background
        hue_offset = (frame_num * 2) % 180
        for y in range(height):
            for x in range(width):
                hue = (x // 10 + y // 10 + hue_offset) % 180
                saturation = 100 + (x * 155 // width)
                value = 150 + (y * 105 // height)
                frame[y, x] = [hue, saturation, value]

        frame = cv2.cvtColor(frame, cv2.COLOR_HSV2BGR)

        # Add "peripheral" pattern (will be blurred by overlay)
        # Grid pattern
        for i in range(0, width, 100):
            cv2.line(frame, (i, 0), (i, height), (50, 50, 50), 1)
        for i in range(0, height, 100):
            cv2.line(frame, (0, i), (width, i), (50, 50, 50), 1)

        # Add text labels in corners (will be blurred)
        cv2.putText(frame, "PERIPHERAL AREA", (50, 100),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        cv2.putText(frame, f"Frame: {frame_num}", (50, height - 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        # Draw center "artwork" region (will remain clear)
        # Background for center
        center_bg_color = (
            int(127 + 127 * np.sin(frame_num / 30)),
            int(127 + 127 * np.cos(frame_num / 45)),
            int(127 + 127 * np.sin(frame_num / 60))
        )
        cv2.rectangle(
            frame,
            (center_x, center_y),
            (center_x + center_width, center_y + center_height),
            center_bg_color,
            -1
        )

        # Animated "artwork" in center
        # Draw abstract shapes
        num_shapes = 5
        for i in range(num_shapes):
            angle = (frame_num / 30 + i * 360 / num_shapes) * np.pi / 180
            shape_x = center_x + center_width // 2 + int(100 * np.cos(angle))
            shape_y = center_y + center_height // 2 + int(100 * np.sin(angle))
            color = (
                int(255 * abs(np.sin(angle + i))),
                int(255 * abs(np.cos(angle + i))),
                int(255 * abs(np.sin(angle * 2 + i)))
            )
            cv2.circle(frame, (shape_x, shape_y), 40, color, -1)
            cv2.circle(frame, (shape_x, shape_y), 40, (255, 255, 255), 2)

        # Draw border around center region
        cv2.rectangle(
            frame,
            (center_x, center_y),
            (center_x + center_width, center_y + center_height),
            (255, 255, 255),
            3
        )

        # Label center region
        cv2.putText(
            frame,
            "CENTER ARTWORK",
            (center_x + 10, center_y + 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.2,
            (255, 255, 255),
            3
        )
        cv2.putText(
            frame,
            "(Will remain clear)",
            (center_x + 10, center_y + 80),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (200, 200, 200),
            2
        )

        # Write frame
        writer.write(frame)

        # Progress indicator
        if (frame_num + 1) % 100 == 0:
            progress = ((frame_num + 1) / total_frames) * 100
            print(f"  Progress: {progress:.1f}% ({frame_num + 1}/{total_frames} frames)")

    writer.release()
    print(f"\n✓ Test pattern generated: {output_path}")
    print("\nNext steps:")
    print("1. Update overlay_config.json:")
    print(f'   "base_video": "{output_path}"')
    print("2. Run: python video_focus_overlay.py")
    print("3. Run: python composite_overlay.py")


def create_demo_config():
    """Create a demo configuration file matching the test pattern."""
    import json

    config = {
        "video": {
            "width": 1920,
            "height": 1080,
            "fps": 30.0,
            "base_video": "test_pattern_base.mp4",
            "output_video": "demo_final_output.mp4"
        },
        "center_region": {
            "width_percent": 0.4,
            "height_percent": 0.6,
            "feather_pixels": 50,
            "description": "Matches test pattern center region"
        },
        "effects": {
            "blur_strength": 25,
            "noise_intensity": 0.3,
            "rgb_shift_amount": 3,
            "jitter_amount": 2,
            "peripheral_opacity": 0.6
        },
        "timeline": [
            {
                "start": 0.0,
                "end": 5.0,
                "state": "focused",
                "description": "Opening with iris + focused state",
                "effects": {"blur": True, "noise": True, "artifacts": True}
            },
            {
                "start": 5.0,
                "end": 10.0,
                "state": "unfocused",
                "description": "Full view (no effects)",
                "effects": {"blur": False, "noise": False, "artifacts": False}
            },
            {
                "start": 10.0,
                "end": 15.0,
                "state": "focused",
                "description": "Focused again",
                "effects": {"blur": True, "noise": True, "artifacts": True}
            },
            {
                "start": 15.0,
                "end": 20.0,
                "state": "focused",
                "description": "Closing with iris",
                "effects": {"blur": True, "noise": True, "artifacts": True}
            }
        ]
    }

    config_path = "demo_config.json"
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)

    print(f"\n✓ Demo configuration created: {config_path}")


def main():
    """Generate test pattern and demo configuration."""
    print("=" * 60)
    print("VIDEO FOCUS OVERLAY - DEMO TEST PATTERN")
    print("=" * 60)
    print()

    # Generate test pattern video
    generate_test_pattern_video(
        output_path="test_pattern_base.mp4",
        width=1920,
        height=1080,
        fps=30.0,
        duration=20.0
    )

    # Create matching configuration
    create_demo_config()

    print("\n" + "=" * 60)
    print("DEMO SETUP COMPLETE!")
    print("=" * 60)
    print("\nTo test the overlay system:")
    print("1. python video_focus_overlay.py  # (use demo_config.json)")
    print("2. python composite_overlay.py")
    print("\nOr run the full demo pipeline:")
    print("  python demo_test_pattern.py && \\")
    print("  python video_focus_overlay.py && \\")
    print("  python composite_overlay.py")


if __name__ == "__main__":
    main()
