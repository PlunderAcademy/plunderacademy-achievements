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
#   ./convert-cards-to-png.sh --hollow 0040-background.webp  # Hollow out center of background

# Configuration
IMAGE_DIR="./training/images"
# Resize to this width (height will scale proportionally to maintain aspect ratio)
# Twitter optimal: 800-1200px wide is good for most posts
# Set to empty string to skip resizing
RESIZE_WIDTH="800"
# Background images (frames) - slightly larger to wrap around cards
BACKGROUND_RESIZE_WIDTH="800"
# Border thickness for hollowing out background images (in pixels at original size)
# This creates a transparent center, keeping only the border
BORDER_THICKNESS="100"

# Parse command line arguments
HOLLOW_CENTER=false
SPECIFIC_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --hollow|-h)
            HOLLOW_CENTER=true
            shift
            ;;
        *)
            SPECIFIC_FILE="$1"
            shift
            ;;
    esac
done

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
    echo "Resizing regular images to: ${RESIZE_WIDTH}px width"
fi
if [ -n "$BACKGROUND_RESIZE_WIDTH" ]; then
    echo "Resizing background images to: ${BACKGROUND_RESIZE_WIDTH}px width"
else
    echo "Background images: keeping original size"
fi
if [ "$HOLLOW_CENTER" = true ]; then
    echo "Hollow mode: will clear center of background images (border: ${BORDER_THICKNESS}px)"
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
    
    # Check if it's a .webp file
    if ! echo "$SPECIFIC_FILE" | grep -qE '\.webp$'; then
        echo "Error: File must be a .webp file"
        echo "Got: $SPECIFIC_FILE"
        exit 1
    fi
    
    # Process only this file
    FILES_TO_PROCESS=("$SPECIFIC_FILE")
    echo "Processing single file: $SPECIFIC_FILE"
    echo ""
else
    # Process all matching files (only main card files, not variants)
    FILES_TO_PROCESS=([0-9][0-9][0-9][0-9].webp)
    echo "Processing all card files (variants excluded)"
    echo ""
fi

# Function to hollow out the center of an image (for background/frame images)
hollow_center() {
    local img="$1"
    local border="$2"
    
    # Get image dimensions
    local dims=$(identify -format "%wx%h" "$img")
    local width=$(echo "$dims" | cut -d'x' -f1)
    local height=$(echo "$dims" | cut -d'x' -f2)
    
    # Calculate inner rectangle (the part to make transparent)
    local inner_x=$border
    local inner_y=$border
    local inner_w=$((width - 2 * border))
    local inner_h=$((height - 2 * border))
    
    # Make sure inner dimensions are positive
    if [ $inner_w -le 0 ] || [ $inner_h -le 0 ]; then
        echo "  ⚠️  Image too small to hollow (border would exceed image)"
        return 1
    fi
    
    # Create a transparent center using region selection (more reliable)
    # -alpha set ensures alpha channel exists
    # -region selects the inner area, -alpha transparent makes it transparent
    convert "$img" \
        -alpha set \
        -region "${inner_w}x${inner_h}+${inner_x}+${inner_y}" \
        -alpha transparent \
        +region \
        "${img}.tmp" && mv "${img}.tmp" "$img"
    
    echo "  Hollowed center (keeping ${border}px border, cleared ${inner_w}x${inner_h} area)"
}

# Loop through files to process
for file in "${FILES_TO_PROCESS[@]}"; do
    # Check if file exists (handles case where no files match)
    if [ ! -f "$file" ]; then
        echo "No matching WebP files found."
        exit 0
    fi
    
    # Get the output filename
    output="${file%.webp}.png"
    
    # Check if this is a background image
    is_background=false
    if echo "$file" | grep -qE '\-background\.webp$'; then
        is_background=true
    fi
    
    # Convert the file (with optional resizing)
    echo "Converting: $file -> $output"
    
    # Determine resize width based on image type
    if [ "$is_background" = true ]; then
        current_resize="$BACKGROUND_RESIZE_WIDTH"
        if [ -n "$current_resize" ]; then
            echo "  (background image - resizing to ${current_resize}px)"
        else
            echo "  (background image - keeping original size)"
        fi
    else
        current_resize="$RESIZE_WIDTH"
    fi
    
    if [ -n "$current_resize" ]; then
        # Resize while maintaining aspect ratio
        # -resize WIDTHx means: scale to WIDTH pixels wide, height auto
        # -quality 95 for high quality
        convert "$file" -resize "${current_resize}x" -quality 95 "$output"
    else
        convert "$file" "$output"
    fi
    
    if [ $? -eq 0 ]; then
        # Hollow out center if requested and this is a background image
        if [ "$HOLLOW_CENTER" = true ] && [ "$is_background" = true ]; then
            hollow_center "$output" "$BORDER_THICKNESS"
        fi
        
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
                    # Final fallback: force pngquant with no quality floor (always succeeds)
                    echo "  Second pass failed, forcing compression..."
                    if pngquant 256 --force --ext .png "$output" 2>/dev/null; then
                        echo "  Compressed with pngquant (forced 256 colors)"
                    else
                        echo "  ⚠️  pngquant failed, using ImageMagick fallback"
                        # Aggressive fallback: reduce colors with dithering
                        convert "$output" -dither FloydSteinberg -colors 256 -depth 8 PNG8:"${output}.tmp" && mv "${output}.tmp" "$output"
                    fi
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
