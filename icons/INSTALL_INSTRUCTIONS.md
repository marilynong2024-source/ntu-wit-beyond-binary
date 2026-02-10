# Step-by-Step: Installing Icons After Favicon Generation

## After Generating Icons on Favicon Generator

### Step 1: Download the Generated Icons

Most favicon generators will give you a ZIP file or individual files. You need these three sizes:
- **16x16 pixels** (or smallest size)
- **48x48 pixels** (or medium size) 
- **128x128 pixels** (or largest size)

### Step 2: Rename the Files

Rename the downloaded files to match exactly:
- `favicon-16x16.png` → **`icon16.png`**
- `favicon-48x48.png` → **`icon48.png`** (or resize a larger one to 48x48)
- `favicon-96x96.png` or `favicon-128x128.png` → **`icon128.png`**

**Important**: The names must be exactly `icon16.png`, `icon48.png`, and `icon128.png` (case-sensitive)

### Step 3: Place Files in the Icons Folder

1. Navigate to your project folder: `/Users/hui/ciazam/icons/`
2. Copy or move the three renamed icon files into this folder
3. You should have:
   ```
   icons/
   ├── icon16.png  ✅
   ├── icon48.png  ✅
   └── icon128.png ✅
   ```

### Step 4: Verify Files Are Correct

Check that:
- ✅ All three files exist in `/Users/hui/ciazam/icons/`
- ✅ File names are exactly: `icon16.png`, `icon48.png`, `icon128.png`
- ✅ Files are PNG format
- ✅ Files are not corrupted (you can open them to check)

### Step 5: Test the Extension

1. Open Chrome and go to `chrome://extensions/`
2. If extension is already loaded, click the refresh icon on the extension card
3. The extension icon should now appear in your Chrome toolbar
4. If you see a broken icon or error, check the browser console for missing file errors

## Quick Troubleshooting

**Problem**: Extension shows error about missing icons
- **Solution**: Double-check file names are exactly `icon16.png`, `icon48.png`, `icon128.png` (no extra spaces or characters)

**Problem**: I only have one size icon
- **Solution**: You can use the same image for all three sizes - Chrome will resize automatically. Just copy the file three times with the correct names.

**Problem**: Files are in wrong format (JPG, SVG, etc.)
- **Solution**: Convert to PNG format using an online converter or image editor

**Problem**: Can't see the icons folder
- **Solution**: Make sure you're in the project root (`ciazam` folder), and the `icons` folder should be there. If not, create it: `mkdir icons`

## Alternative: Quick Test Icons

If you just want to test quickly, you can create simple colored squares:

1. Create a 128x128 pixel colored square image (any color)
2. Save it as `icon128.png` in the `icons` folder
3. Copy it and rename to `icon48.png` and `icon16.png`
4. This will work for testing, though it won't look professional

---

Once icons are in place, you're ready to load the extension! 🎉

