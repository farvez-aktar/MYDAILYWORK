"""
Face Detection Engine
Supports two backends:
  - dnn  : OpenCV ResNet-SSD (deep-learning, accurate)
  - haar : Haar Cascade      (lightweight fallback)
"""
import cv2
import numpy as np
import urllib.request
from pathlib import Path

MODELS_DIR = Path(__file__).parent.parent / "models"

DNN_PROTO_URL = (
    "https://raw.githubusercontent.com/opencv/opencv/master/"
    "samples/dnn/face_detector/deploy.prototxt"
)
DNN_WEIGHTS_URL = (
    "https://github.com/opencv/opencv_3rdparty/raw/"
    "dnn_samples_face_detector_20170830/"
    "res10_300x300_ssd_iter_140000.caffemodel"
)


class FaceDetector:
    """Multi-backend face detector."""

    def __init__(self, backend: str = "dnn", confidence_threshold: float = 0.5):
        self.backend = backend.lower()
        self.confidence_threshold = confidence_threshold
        self.net = None
        self.haar = None
        MODELS_DIR.mkdir(exist_ok=True)
        self._load()

    # ------------------------------------------------------------------ #
    #  Loading                                                             #
    # ------------------------------------------------------------------ #
    def _load(self):
        if self.backend == "dnn":
            self._load_dnn()
        else:
            self._load_haar()

    def _load_dnn(self):
        proto   = MODELS_DIR / "deploy.prototxt"
        weights = MODELS_DIR / "res10_300x300_ssd_iter_140000.caffemodel"

        if not proto.exists():
            print("[Detector] Downloading deploy.prototxt …")
            urllib.request.urlretrieve(DNN_PROTO_URL, proto)

        if not weights.exists():
            print("[Detector] Downloading caffemodel weights …")
            urllib.request.urlretrieve(DNN_WEIGHTS_URL, weights)

        self.net = cv2.dnn.readNetFromCaffe(str(proto), str(weights))
        print("[Detector] DNN model ready.")

    def _load_haar(self):
        path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self.haar = cv2.CascadeClassifier(path)
        print("[Detector] Haar cascade ready.")

    # ------------------------------------------------------------------ #
    #  Detection                                                           #
    # ------------------------------------------------------------------ #
    def detect(self, image: np.ndarray) -> list:
        """Return list of (x, y, w, h, confidence) tuples."""
        if self.backend == "dnn":
            return self._detect_dnn(image)
        return self._detect_haar(image)

    def _detect_dnn(self, img: np.ndarray) -> list:
        h, w = img.shape[:2]
        blob = cv2.dnn.blobFromImage(
            cv2.resize(img, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0)
        )
        self.net.setInput(blob)
        dets = self.net.forward()
        faces = []
        for i in range(dets.shape[2]):
            conf = float(dets[0, 0, i, 2])
            if conf < self.confidence_threshold:
                continue
            box = dets[0, 0, i, 3:7] * np.array([w, h, w, h])
            x1, y1, x2, y2 = box.astype(int)
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w - 1, x2), min(h - 1, y2)
            if x2 > x1 and y2 > y1:
                faces.append((x1, y1, x2 - x1, y2 - y1, conf))
        return faces

    def _detect_haar(self, img: np.ndarray) -> list:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        dets = self.haar.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )
        if len(dets) == 0:
            return []
        return [(int(x), int(y), int(w), int(h), 1.0) for x, y, w, h in dets]

    # ------------------------------------------------------------------ #
    #  Annotation                                                          #
    # ------------------------------------------------------------------ #
    def annotate(
        self,
        image: np.ndarray,
        faces: list,
        labels: list = None,
        color: tuple = (0, 220, 180),
    ) -> np.ndarray:
        """Draw bounding boxes and labels onto a copy of the image."""
        out = image.copy()
        for idx, (x, y, w, h, conf) in enumerate(faces):
            name    = labels[idx] if labels else "Face"
            caption = f"{name}  {conf:.0%}"
            cv2.rectangle(out, (x, y), (x + w, y + h), color, 2)
            (tw, th), _ = cv2.getTextSize(caption, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
            cv2.rectangle(out, (x, y - th - 12), (x + tw + 8, y), color, cv2.FILLED)
            cv2.putText(
                out, caption, (x + 4, y - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 1, cv2.LINE_AA,
            )
        return out
