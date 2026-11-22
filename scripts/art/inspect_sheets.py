import glob, sys
from PIL import Image
for pat in sys.argv[1:]:
    for f in sorted(glob.glob(pat)):
        im = Image.open(f)
        print(f, im.size, im.mode)
