"""
Shared utility helpers for the face detection & recognition pipeline.
"""
import base64
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


# ------------------------------------------------------------------ #
#  Image I/O                                                           #
# ------------------------------------------------------------------ #
def load_image(path: str) -> np.ndarray:
    """Load an image from disk and return as BGR numpy array."""
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {path}")
    return img


def save_output(image: np.ndarray, prefix: str = "result") -> Path:
    """Save an annotated image to the output directory."""
    ts   = int(time.time())
    dest = OUTPUT_DIR / f"{prefix}_{ts}.jpg"
    cv2.imwrite(str(dest), image)
    return dest


def pil_to_cv2(pil_img: Image.Image) -> np.ndarray:
    arr = np.array(pil_img.convert("RGB"))
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def cv2_to_pil(cv2_img: np.ndarray) -> Image.Image:
    rgb = cv2.cvtColor(cv2_img, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def bytes_to_cv2(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def cv2_to_b64(img: np.ndarray, fmt: str = ".jpg") -> str:
    """Encode a CV2 image as a base-64 JPEG/PNG string."""
    _, buf = cv2.imencode(fmt, img)
    return base64.b64encode(buf).decode()


# ------------------------------------------------------------------ #
#  Frame encoding for MJPEG streaming                                  #
# ------------------------------------------------------------------ #
def encode_frame(frame: np.ndarray, quality: int = 85) -> bytes:
    encode_params = [cv2.IMWRITE_JPEG_QUALITY, quality]
    _, buf = cv2.imencode(".jpg", frame, encode_params)
    return (
        b"--frame\r\n"
        b"Content-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n"
    )


# ------------------------------------------------------------------ #
#  FPS counter                                                         #
# ------------------------------------------------------------------ #
class FPSCounter:
    def __init__(self, window: int = 30):
        self._times: list = []
        self._window = window

    def tick(self) -> float:
        now = time.time()
        self._times.append(now)
        if len(self._times) > self._window:
            self._times.pop(0)
        if len(self._times) < 2:
            return 0.0
        return (len(self._times) - 1) / (self._times[-1] - self._times[0])
