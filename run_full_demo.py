#!/usr/bin/env python3
"""
FULL DEMO RUNNER
Executes the complete overlay workflow in one command:
1. Generate test pattern video
2. Generate focus overlay
3. Composite both videos
"""

import subprocess
import sys
from pathlib import Path
import json


def run_command(script: str, description: str) -> bool:
    """
    Run a Python script and handle errors.

    Args:
        script: Script filename to execute
        description: Human-readable description

    Returns:
        True if successful, False otherwise
    """
    print("\n" + "=" * 70)
    print(f"STEP: {description}")
    print("=" * 70)

    try:
        result = subprocess.run(
            [sys.executable, script],
            check=True,
            capture_output=False
        )
        print(f"\n✓ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n✗ {description} failed with error code {e.returncode}")
        return False
    except FileNotFoundError:
        print(f"\n✗ Script not found: {script}")
        return False


def check_prerequisites() -> bool:
    """Check if required dependencies are installed."""
    print("Checking prerequisites...")

    # Check Python packages
    required_packages = ['cv2', 'numpy']
    missing = []

    for package in required_packages:
        try:
            __import__(package)
            print(f"  ✓ {package} installed")
        except ImportError:
            print(f"  ✗ {package} NOT installed")
            missing.append(package)

    if missing:
        print("\nMissing dependencies! Install with:")
        print("  pip install -r requirements.txt")
        return False

    # Check if scripts exist
    required_scripts = [
        'demo_test_pattern.py',
        'video_focus_overlay.py',
        'composite_overlay.py'
    ]

    for script in required_scripts:
        if not Path(script).exists():
            print(f"\n✗ Required script missing: {script}")
            return False

    print("\n✓ All prerequisites met!")
    return True


def update_overlay_script_for_demo():
    """
    Temporarily modify video_focus_overlay.py to use demo_config.json
    """
    print("\nConfiguring scripts for demo...")

    # Read the overlay generator script
    overlay_script = Path('video_focus_overlay.py')
    if not overlay_script.exists():
        return

    content = overlay_script.read_text()

    # Check if already configured for demo
    if 'demo_config.json' in content:
        print("  Scripts already configured for demo")
        return

    # Create a demo-specific version
    demo_script = Path('video_focus_overlay_demo.py')
    modified_content = content.replace(
        'overlay_config.json',
        'demo_config.json'
    )
    demo_script.write_text(modified_content)
    print("  ✓ Created demo-specific script: video_focus_overlay_demo.py")


def create_composite_demo_script():
    """Create demo version of composite script."""
    composite_script = Path('composite_overlay.py')
    if not composite_script.exists():
        return

    content = composite_script.read_text()

    # Create automated demo version (no user prompts)
    demo_content = content.replace(
        'overlay_config.json',
        'demo_config.json'
    )

    # Replace the main() function to auto-select FFmpeg
    demo_content = demo_content.replace(
        'choice = input("Enter choice (1 or 2): ").strip()',
        'choice = "1"  # Auto-select FFmpeg for demo'
    )
    demo_content = demo_content.replace(
        'quality = input("Quality (high/medium/fast) [high]: ").strip() or "high"',
        'quality = "high"  # Auto-select high quality for demo'
    )

    demo_script = Path('composite_overlay_demo.py')
    demo_script.write_text(demo_content)
    print("  ✓ Created demo-specific composite script")


def main():
    """Run the complete demo workflow."""
    print("\n" + "=" * 70)
    print("VIDEO FOCUS OVERLAY SYSTEM - FULL DEMO")
    print("=" * 70)
    print("\nThis script will:")
    print("  1. Generate a test pattern video (20 seconds)")
    print("  2. Create a focus overlay with effects")
    print("  3. Composite both videos into final output")
    print("\nExpected runtime: 1-3 minutes (depending on your hardware)")
    print("=" * 70)

    # Check prerequisites
    if not check_prerequisites():
        print("\n✗ Prerequisites check failed. Please install dependencies.")
        sys.exit(1)

    # Confirm start
    response = input("\nReady to start demo? (y/N): ").strip().lower()
    if response not in ['y', 'yes']:
        print("Demo cancelled.")
        sys.exit(0)

    # Create demo-specific scripts
    update_overlay_script_for_demo()
    create_composite_demo_script()

    # Step 1: Generate test pattern
    if not run_command('demo_test_pattern.py', 'Generate test pattern video'):
        print("\n✗ Demo failed at step 1")
        sys.exit(1)

    # Step 2: Generate overlay
    # Use demo-specific script if available, otherwise use main script
    overlay_script = 'video_focus_overlay_demo.py' if Path('video_focus_overlay_demo.py').exists() else 'video_focus_overlay.py'

    # Modify the main() call to use demo config
    print("\nGenerating focus overlay...")
    try:
        # Import and run with demo config
        import importlib.util
        spec = importlib.util.spec_from_file_location("overlay_module", "video_focus_overlay.py")
        overlay_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(overlay_module)

        # Load demo config
        with open('demo_config.json', 'r') as f:
            config = json.load(f)

        # Create generator with demo config
        generator = overlay_module.FocusOverlayGenerator(
            width=config['video']['width'],
            height=config['video']['height'],
            fps=config['video']['fps'],
            center_region=config['center_region'],
            output_path='focus_overlay_alpha.mp4'
        )

        # Generate overlay
        generator.generate_overlay(config['timeline'])
        print("\n✓ Overlay generation completed successfully")

    except Exception as e:
        print(f"\n✗ Overlay generation failed: {e}")
        sys.exit(1)

    # Step 3: Composite videos
    print("\nCompositing videos...")
    try:
        # Load config
        with open('demo_config.json', 'r') as f:
            config = json.load(f)

        # Use FFmpeg for compositing
        import subprocess
        cmd = [
            'ffmpeg',
            '-i', config['video']['base_video'],
            '-i', 'focus_overlay_alpha.mp4',
            '-filter_complex', '[0:v][1:v]overlay',
            '-c:v', 'libx264',
            '-crf', '18',
            '-preset', 'slow',
            '-y',
            config['video']['output_video']
        ]

        subprocess.run(cmd, check=True)
        print(f"\n✓ Composite video created: {config['video']['output_video']}")

    except FileNotFoundError:
        print("\n✗ FFmpeg not found. Trying OpenCV fallback...")
        if not run_command('composite_overlay_demo.py', 'Composite videos (OpenCV)'):
            print("\n✗ Demo failed at step 3")
            sys.exit(1)
    except Exception as e:
        print(f"\n✗ Compositing failed: {e}")
        sys.exit(1)

    # Success summary
    print("\n" + "=" * 70)
    print("DEMO COMPLETED SUCCESSFULLY!")
    print("=" * 70)
    print("\nGenerated files:")
    print("  1. test_pattern_base.mp4       - Base test pattern video")
    print("  2. focus_overlay_alpha.mp4     - Focus overlay with alpha")
    print("  3. demo_final_output.mp4       - Final composited result")
    print("\nNext steps:")
    print("  • Review demo_final_output.mp4 to see the effect")
    print("  • Edit demo_config.json to experiment with settings")
    print("  • Modify video_focus_overlay.py to adjust effect intensity")
    print("  • Use overlay_config.json for your real videos")
    print("\n" + "=" * 70)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✗ Demo interrupted by user")
        sys.exit(1)
