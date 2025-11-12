#!/bin/bash

# Script to convert WebP achievement card images to PNG format with compression
# Converts only the main card files (e.g., 0001.webp, 0002.webp)
# Skips variant files (e.g., *-plain-card.webp, *-trinket.webp, *-background.webp)
# Resizes images to be more suitable for social media
# Uses pngquant for high-quality lossy compression
#
# Usage:
#   ./convert-cards-to-png.sh              # Convert all cards
#   ./convert-cards-to-png.sh 0054.webp    # Convert specific card only

# Configuration
IMAGE_DIR="./training/images"
# Resize to this width (height will scale proportionally to maintain aspect ratio)
# Twitter optimal: 800-1200px wide is good for most posts
# Set to empty string to skip resizing
RESIZE_WIDTH="800"

# Parse command line arguments
SPECIFIC_FILE="$1"

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed."
    echo "Please install it first:"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  macOS: brew install imagemagick"
    echo "  Windows (WSL): sudo apt-get install imagemagick"
    exit 1
fi

# Check for compression tools (pngquant preferred, optipng as fallback)
COMPRESSOR=""
if command -v pngquant &> /dev/null; then
    COMPRESSOR="pngquant"
    echo "Using pngquant for compression (lossy, high quality)"
elif command -v optipng &> /dev/null; then
    COMPRESSOR="optipng"
    echo "Using optipng for compression (lossless, slower)"
else
    echo "Warning: No PNG compression tool found."
    echo "Install pngquant (recommended) or optipng for smaller file sizes:"
    echo "  Ubuntu/Debian/WSL: sudo apt-get install pngquant"
    echo "  macOS: brew install pngquant"
    echo ""
    echo "Continuing without compression..."
    echo ""
fi

# Change to the image directory
cd "$IMAGE_DIR" || exit 1

echo "Converting WebP cards to PNG format..."
echo "Directory: $(pwd)"
if [ -n "$RESIZE_WIDTH" ]; then
    echo "Resizing images to: ${RESIZE_WIDTH}px width (maintaining aspect ratio)"
fi
echo ""

# Counter for converted files
count=0

# Determine which files to process
if [ -n "$SPECIFIC_FILE" ]; then
    # Check if the specific file exists
    if [ ! -f "$SPECIFIC_FILE" ]; then
        echo "Error: File not found: $SPECIFIC_FILE"
        exit 1
    fi
    
    # Check if it's a valid card file (4 digits + .webp)
    if ! echo "$SPECIFIC_FILE" | grep -qE '^[0-9]{4}\.webp$'; then
        echo "Error: File must match pattern xxxx.webp (e.g., 0001.webp, 0054.webp)"
        echo "Got: $SPECIFIC_FILE"
        exit 1
    fi
    
    # Process only this file
    FILES_TO_PROCESS=("$SPECIFIC_FILE")
    echo "Processing single file: $SPECIFIC_FILE"
    echo ""
else
    # Process all matching files
    FILES_TO_PROCESS=([0-9][0-9][0-9][0-9].webp)
    echo "Processing all card files"
    echo ""
fi

# Loop through files to process
for file in "${FILES_TO_PROCESS[@]}"; do
    # Check if file exists (handles case where no files match)
    if [ ! -f "$file" ]; then
        echo "No matching WebP files found."
        exit 0
    fi
    
    # Get the output filename
    output="${file%.webp}.png"
    
    # Convert the file (with optional resizing)
    echo "Converting: $file -> $output"
    
    if [ -n "$RESIZE_WIDTH" ]; then
        # Resize while maintaining aspect ratio
        # -resize WIDTHx means: scale to WIDTH pixels wide, height auto
        # -quality 95 for high quality
        convert "$file" -resize "${RESIZE_WIDTH}x" -quality 95 "$output"
    else
        convert "$file" "$output"
    fi
    
    if [ $? -eq 0 ]; then
        # Get size before compression
        size_before=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null)
        
        # Compress the PNG if a compressor is available
        if [ "$COMPRESSOR" = "pngquant" ]; then
            # pngquant with high quality settings (65-80 quality range)
            # --force overwrites existing file, --ext .png keeps same extension
            # Try with strict quality first
            if pngquant --quality=65-80 --force --ext .png "$output" 2>/dev/null; then
                echo "  Compressed with pngquant (65-80 quality)"
            else
                # If that fails, try with lower quality threshold for stubborn images
                echo "  First pass failed, trying lower quality..."
                if pngquant --quality=50-80 --force --ext .png "$output" 2>/dev/null; then
                    echo "  Compressed with pngquant (50-80 quality)"
                else
                    echo "  ⚠️  pngquant unable to compress, using ImageMagick fallback"
                    # Fallback: use ImageMagick to reduce colors and quality slightly
                    convert "$output" -colors 256 -quality 85 "${output}.tmp" && mv "${output}.tmp" "$output"
                fi
            fi
        elif [ "$COMPRESSOR" = "optipng" ]; then
            # optipng with -o2 (moderate optimization, good balance of speed/compression)
            optipng -o2 -quiet "$output"
            echo "  Compressed with optipng"
        fi
        
        # Get final size and show savings
        size_after=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null)
        
        # Calculate percentage using awk instead of bc (more portable)
        if [ -n "$COMPRESSOR" ]; then
            savings=$(awk "BEGIN {printf \"%.1f\", (1 - $size_after / $size_before) * 100}")
            # Format sizes for display
            size_before_fmt=$(numfmt --to=iec-i --suffix=B $size_before 2>/dev/null || echo "$size_before bytes")
            size_after_fmt=$(numfmt --to=iec-i --suffix=B $size_after 2>/dev/null || echo "$size_after bytes")
            echo "  Size: $size_before_fmt -> $size_after_fmt (${savings}% reduction)"
        fi
        
        ((count++))
    else
        echo "  ⚠️  Failed to convert $file"
    fi
done

echo ""
echo "✓ Conversion complete! Converted $count files."
echo "PNG files saved in: $IMAGE_DIR"

