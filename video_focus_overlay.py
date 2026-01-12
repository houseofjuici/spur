#!/usr/bin/env python3
"""
VIDEO FOCUS OVERLAY GENERATOR
Non-destructive overlay system for manipulating viewer focus
Creates alpha-transparent video layer for compositing
"""

import cv2
import numpy as np
from pathlib import Path
from typing import Tuple, List, Dict
import json


class FocusOverlayGenerator:
    """
    Generates a focus overlay video with:
    - Protected center region (fully transparent)
    - Peripheral effects (blur, noise, artifacts)
    - Time-based state management
    - Iris opening/closing effects
    """

    def __init__(
        self,
        width: int,
        height: int,
        fps: float,
        center_region: Dict[str, float],
        output_path: str
    ):
        """
        Initialize overlay generator.

        Args:
            width: Video width in pixels
            height: Video height in pixels
            fps: Frames per second
            center_region: Dict with 'width_percent', 'height_percent', 'feather_pixels'
            output_path: Output video file path
        """
        self.width = width
        self.height = height
        self.fps = fps
        self.output_path = output_path

        # Calculate center region dimensions
        self.center_width = int(width * center_region['width_percent'])
        self.center_height = int(height * center_region['height_percent'])
        self.center_x = (width - self.center_width) // 2
        self.center_y = (height - self.center_height) // 2
        self.feather_pixels = center_region['feather_pixels']

        # Effect parameters
        self.blur_strength = 25  # Gaussian blur kernel size (must be odd)
        self.noise_intensity = 0.3  # TV static opacity (0-1)
        self.rgb_shift_amount = 3  # Pixels of RGB channel separation
        self.jitter_amount = 2  # Horizontal jitter in pixels

        # Pre-generate masks for efficiency
        self.center_mask = self._create_center_mask()
        self.peripheral_mask = 1.0 - self.center_mask

        # Video writer setup (ProRes 4444 with alpha)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # Can change to 'png ' for PNG sequence
        self.writer = cv2.VideoWriter(
            output_path,
            fourcc,
            fps,
            (width, height),
            True  # isColor=True for BGRA
        )

    def _create_center_mask(self) -> np.ndarray:
        """
        Create feathered center mask (1.0 = center, 0.0 = periphery).
        Uses soft rectangular mask with Gaussian feathering.

        Returns:
            2D float array (height x width) with values 0.0 to 1.0
        """
        mask = np.zeros((self.height, self.width), dtype=np.float32)

        # Create hard rectangular mask
        mask[
            self.center_y:self.center_y + self.center_height,
            self.center_x:self.center_x + self.center_width
        ] = 1.0

        # Apply Gaussian blur for feathering
        if self.feather_pixels > 0:
            kernel_size = self.feather_pixels * 2 + 1  # Must be odd
            mask = cv2.GaussianBlur(mask, (kernel_size, kernel_size), 0)

        return mask

    def _generate_tv_static(self, intensity: float = 1.0) -> np.ndarray:
        """
        Generate TV static / white noise texture.

        Args:
            intensity: Noise visibility (0.0 = none, 1.0 = full)

        Returns:
            BGRA image with noise texture
        """
        # Generate random grayscale noise
        noise = np.random.randint(0, 256, (self.height, self.width), dtype=np.uint8)

        # Convert to BGRA (grayscale replicated across B, G, R)
        noise_bgra = cv2.cvtColor(noise, cv2.COLOR_GRAY2BGR)

        # Add alpha channel (controlled by intensity)
        alpha = np.full((self.height, self.width), int(255 * intensity), dtype=np.uint8)
        noise_bgra = np.dstack([noise_bgra, alpha])

        return noise_bgra

    def _apply_rgb_shift(self, frame: np.ndarray, shift: int) -> np.ndarray:
        """
        Apply analog RGB channel separation artifact.

        Args:
            frame: Input BGRA frame
            shift: Pixel shift amount

        Returns:
            Frame with RGB channels shifted
        """
        if shift == 0:
            return frame

        output = frame.copy()
        # Shift red channel right
        output[:, shift:, 2] = frame[:, :-shift, 2]
        # Shift blue channel left
        output[:, :-shift, 0] = frame[:, shift:, 0]

        return output

    def _apply_horizontal_jitter(self, frame: np.ndarray, jitter: int) -> np.ndarray:
        """
        Apply horizontal jitter artifact (random horizontal shift per scanline).

        Args:
            frame: Input BGRA frame
            jitter: Maximum jitter amount in pixels

        Returns:
            Frame with horizontal jitter applied
        """
        if jitter == 0:
            return frame

        output = frame.copy()
        for y in range(0, self.height, 4):  # Apply every 4 lines for performance
            shift = np.random.randint(-jitter, jitter + 1)
            if shift > 0:
                output[y:y+4, shift:] = frame[y:y+4, :-shift]
            elif shift < 0:
                output[y:y+4, :shift] = frame[y:y+4, -shift:]

        return output

    def _create_peripheral_effect(
        self,
        apply_blur: bool = True,
        apply_noise: bool = True,
        apply_artifacts: bool = True
    ) -> np.ndarray:
        """
        Generate peripheral effect layer.

        Args:
            apply_blur: Enable Gaussian blur
            apply_noise: Enable TV static
            apply_artifacts: Enable analog artifacts (RGB shift, jitter)

        Returns:
            BGRA frame with effects applied only to peripheral region
        """
        # Start with blank canvas
        effect_layer = np.zeros((self.height, self.width, 4), dtype=np.uint8)

        if not (apply_blur or apply_noise or apply_artifacts):
            return effect_layer  # Return transparent frame

        # Create base gray texture for blur effect
        if apply_blur:
            base_texture = np.full(
                (self.height, self.width, 3),
                128,  # Mid-gray
                dtype=np.uint8
            )
            blurred = cv2.GaussianBlur(base_texture, (self.blur_strength, self.blur_strength), 0)
            effect_layer[:, :, :3] = blurred

        # Add TV static noise
        if apply_noise:
            noise = self._generate_tv_static(self.noise_intensity)
            # Blend noise with existing effect
            effect_layer = cv2.addWeighted(effect_layer, 0.7, noise, 0.3, 0)

        # Apply analog artifacts
        if apply_artifacts:
            effect_layer = self._apply_rgb_shift(effect_layer, self.rgb_shift_amount)
            effect_layer = self._apply_horizontal_jitter(effect_layer, self.jitter_amount)

        # Apply peripheral mask (center region becomes fully transparent)
        alpha_mask = (self.peripheral_mask * 255).astype(np.uint8)
        effect_layer[:, :, 3] = alpha_mask

        # Reduce overall opacity for blending
        effect_layer[:, :, 3] = (effect_layer[:, :, 3] * 0.6).astype(np.uint8)

        return effect_layer

    def _create_iris_frame(self, progress: float, closing: bool = False) -> np.ndarray:
        """
        Create iris opening/closing effect frame.

        Args:
            progress: Animation progress (0.0 = start, 1.0 = end)
            closing: If True, iris closes; if False, iris opens

        Returns:
            BGRA frame with iris effect
        """
        if closing:
            progress = 1.0 - progress

        # Calculate current iris size (interpolate from 0 to full center size)
        current_width = int(self.center_width * progress)
        current_height = int(self.center_height * progress)
        current_x = (self.width - current_width) // 2
        current_y = (self.height - current_height) // 2

        # Create temporary mask for current iris size
        iris_mask = np.zeros((self.height, self.width), dtype=np.float32)
        if current_width > 0 and current_height > 0:
            iris_mask[
                current_y:current_y + current_height,
                current_x:current_x + current_width
            ] = 1.0

            # Apply feathering
            if self.feather_pixels > 0:
                kernel_size = self.feather_pixels * 2 + 1
                iris_mask = cv2.GaussianBlur(iris_mask, (kernel_size, kernel_size), 0)

        # Create effect layer for everything outside iris
        peripheral_mask = 1.0 - iris_mask
        effect_layer = self._create_peripheral_effect(
            apply_blur=True,
            apply_noise=True,
            apply_artifacts=False  # Skip artifacts during iris animation
        )

        # Apply iris mask
        alpha_mask = (peripheral_mask * 255).astype(np.uint8)
        effect_layer[:, :, 3] = alpha_mask

        return effect_layer

    def generate_overlay(self, timeline: List[Dict]) -> None:
        """
        Generate complete overlay video based on timeline.

        Args:
            timeline: List of dicts with structure:
                {
                    'start': start_time_seconds,
                    'end': end_time_seconds,
                    'state': 'focused' | 'unfocused',
                    'effects': {
                        'blur': bool,
                        'noise': bool,
                        'artifacts': bool
                    }
                }
        """
        total_frames = 0

        # Calculate total frames from timeline
        for segment in timeline:
            duration = segment['end'] - segment['start']
            total_frames += int(duration * self.fps)

        print(f"Generating overlay: {total_frames} frames at {self.fps} fps")

        current_frame = 0

        for segment_idx, segment in enumerate(timeline):
            start_time = segment['start']
            end_time = segment['end']
            state = segment['state']
            effects = segment.get('effects', {
                'blur': True,
                'noise': True,
                'artifacts': True
            })

            segment_frames = int((end_time - start_time) * self.fps)

            print(f"Segment {segment_idx + 1}: {state} ({segment_frames} frames)")

            # Handle special iris effects for first/last segments
            is_first = segment_idx == 0
            is_last = segment_idx == len(timeline) - 1
            iris_frames = int(0.5 * self.fps)  # 0.5 second iris animation

            for frame_in_segment in range(segment_frames):
                # Opening iris (first segment)
                if is_first and frame_in_segment < iris_frames:
                    progress = frame_in_segment / iris_frames
                    frame = self._create_iris_frame(progress, closing=False)

                # Closing iris (last segment)
                elif is_last and frame_in_segment >= segment_frames - iris_frames:
                    frames_into_closing = frame_in_segment - (segment_frames - iris_frames)
                    progress = frames_into_closing / iris_frames
                    frame = self._create_iris_frame(progress, closing=True)

                # Normal state-based rendering
                else:
                    if state == 'focused':
                        frame = self._create_peripheral_effect(
                            apply_blur=effects.get('blur', True),
                            apply_noise=effects.get('noise', True),
                            apply_artifacts=effects.get('artifacts', True)
                        )
                    else:  # unfocused
                        # Minimal or no effects
                        frame = np.zeros((self.height, self.width, 4), dtype=np.uint8)

                # Write frame
                self.writer.write(frame)
                current_frame += 1

                # Progress indicator
                if current_frame % 100 == 0:
                    progress_pct = (current_frame / total_frames) * 100
                    print(f"  Progress: {progress_pct:.1f}% ({current_frame}/{total_frames} frames)")

        print("Overlay generation complete!")

    def __del__(self):
        """Release video writer."""
        if hasattr(self, 'writer'):
            self.writer.release()


# =======================
# USAGE EXAMPLE
# =======================

def main():
    """
    Example usage of FocusOverlayGenerator.
    """

    # Video specifications (match your base video)
    VIDEO_CONFIG = {
        'width': 1920,
        'height': 1080,
        'fps': 30.0
    }

    # Center region configuration
    CENTER_REGION = {
        'width_percent': 0.4,   # Center is 40% of video width
        'height_percent': 0.6,  # Center is 60% of video height
        'feather_pixels': 50    # 50 pixels of soft feathering at edges
    }

    # Timeline definition
    # Adjust these timestamps to match your video structure
    TIMELINE = [
        {
            'start': 0.0,
            'end': 5.0,
            'state': 'focused',  # Song section - effects ON
            'effects': {
                'blur': True,
                'noise': True,
                'artifacts': True
            }
        },
        {
            'start': 5.0,
            'end': 10.0,
            'state': 'unfocused',  # Film clip - effects OFF
            'effects': {
                'blur': False,
                'noise': False,
                'artifacts': False
            }
        },
        {
            'start': 10.0,
            'end': 15.0,
            'state': 'focused',  # Another song - effects ON
            'effects': {
                'blur': True,
                'noise': True,
                'artifacts': True
            }
        },
        # Add more segments as needed
    ]

    # Output path
    output_path = "focus_overlay_alpha.mp4"

    # Generate overlay
    generator = FocusOverlayGenerator(
        width=VIDEO_CONFIG['width'],
        height=VIDEO_CONFIG['height'],
        fps=VIDEO_CONFIG['fps'],
        center_region=CENTER_REGION,
        output_path=output_path
    )

    generator.generate_overlay(TIMELINE)

    print(f"\n✓ Overlay generated: {output_path}")
    print("\nNext steps:")
    print("1. Review the overlay video")
    print("2. Adjust CENTER_REGION and TIMELINE as needed")
    print("3. Composite with your base video using the command:")
    print(f"\n   ffmpeg -i base_video.mp4 -i {output_path} \\")
    print("          -filter_complex '[0:v][1:v]overlay' \\")
    print("          -c:v libx264 -crf 18 -preset slow \\")
    print("          final_output.mp4")


if __name__ == "__main__":
    main()
