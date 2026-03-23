
# Lafayette Homes — Auto-installer
# Double-click this file to run it, OR open PowerShell and run: python extract_to_upload.py
# It will extract the zip and put all files in the Lafayette-Upload folder.

import zipfile, shutil, os, urllib.request, pathlib

DOWNLOAD_DIR = pathlib.Path.home() / "Downloads"
OUTPUT_DIR = DOWNLOAD_DIR / "Lafayette-Upload"
ZIP_PATH = DOWNLOAD_DIR / "lafayette-v2-final.zip"

# If zip doesn't exist locally, we'll note it
if not ZIP_PATH.exists():
    print(f"ZIP not found at {ZIP_PATH}")
    print("Download lafayette-v2-final.zip from the chat and put it in Downloads.")
    input("Press Enter to exit.")
    exit()

OUTPUT_DIR.mkdir(exist_ok=True)

with zipfile.ZipFile(ZIP_PATH, 'r') as z:
    for member in z.namelist():
        # Flatten the path (strip the lafayette-v2/ prefix)
        name = member.replace("lafayette-v2/", "").replace("lafayette-v2\\", "")
        if not name or name.endswith("/"):
            continue
        dest = OUTPUT_DIR / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        with z.open(member) as src, open(dest, 'wb') as dst:
            shutil.copyfileobj(src, dst)
        print(f"  Extracted: {name}")

print(f"\nDone! All files are in: {OUTPUT_DIR}")
print("Now upload them to GitHub (see README-DO-THIS-FIRST.txt)")
input("Press Enter to exit.")
