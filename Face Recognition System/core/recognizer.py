"""
Face Recognition Engine
Uses DeepFace (ArcFace model) to generate embeddings and match against
the known-faces database.  Falls back gracefully if DeepFace is absent.
"""
from __future__ import annotations

import pickle
import warnings
from pathlib import Path

import cv2
import numpy as np

warnings.filterwarnings("ignore")

DB_CACHE       = Path(__file__).parent.parent / "models" / "face_db.pkl"
MODEL_NAME     = "ArcFace"
THRESHOLD      = 0.40     # cosine distance – lower = stricter

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
    print("[Recognizer] DeepFace loaded.")
except ImportError:
    DEEPFACE_AVAILABLE = False
    print("[Recognizer] DeepFace not installed – detection-only mode.")


class FaceRecognizer:
    """Recognize faces using ArcFace embeddings via DeepFace."""

    def __init__(self, database):
        self.database  = database
        self.available = DEEPFACE_AVAILABLE
        self._db: dict[str, list[np.ndarray]] = {}
        if self.available:
            self._build_db()

    # ------------------------------------------------------------------ #
    #  Database building                                                   #
    # ------------------------------------------------------------------ #
    def _build_db(self, force: bool = False):
        if DB_CACHE.exists() and not force:
            with open(DB_CACHE, "rb") as f:
                self._db = pickle.load(f)
            print(f"[Recognizer] Loaded {len(self._db)} person(s) from cache.")
            return

        print("[Recognizer] Building face embeddings …")
        all_paths = self.database.get_all_image_paths()
        self._db  = {}

        for name, paths in all_paths.items():
            embs = []
            for p in paths:
                try:
                    res = DeepFace.represent(
                        img_path=str(p),
                        model_name=MODEL_NAME,
                        enforce_detection=False,
                    )
                    if res:
                        embs.append(np.array(res[0]["embedding"]))
                except Exception as e:
                    print(f"[Recognizer] Skipping {p.name}: {e}")
            if embs:
                self._db[name] = embs

        with open(DB_CACHE, "wb") as f:
            pickle.dump(self._db, f)
        print(f"[Recognizer] Done – {len(self._db)} person(s) indexed.")

    def rebuild(self):
        """Force-rebuild the embedding cache."""
        self._build_db(force=True)

    # ------------------------------------------------------------------ #
    #  Recognition                                                         #
    # ------------------------------------------------------------------ #
    def recognize_crop(self, crop: np.ndarray) -> tuple:
        """Return (name, confidence) for a single face crop."""
        if not self.available or not self._db:
            return "Unknown", 0.0
        try:
            res = DeepFace.represent(
                img_path=crop,
                model_name=MODEL_NAME,
                enforce_detection=False,
            )
            if not res:
                return "Unknown", 0.0
            q = np.array(res[0]["embedding"])
        except Exception as e:
            print(f"[Recognizer] Embed error: {e}")
            return "Unknown", 0.0

        best_name, best_dist = "Unknown", float("inf")
        for name, embs in self._db.items():
            for emb in embs:
                d = self._cosine(q, emb)
                if d < best_dist:
                    best_dist, best_name = d, name

        if best_dist > THRESHOLD:
            return "Unknown", 0.0
        return best_name.replace("_", " "), round(1.0 - best_dist, 3)

    def recognize_all(self, image: np.ndarray, faces: list) -> list:
        """Recognize every detected face in an image."""
        results = []
        for (x, y, w, h, _) in faces:
            crop = image[y: y + h, x: x + w]
            results.append(self.recognize_crop(crop) if crop.size else ("Unknown", 0.0))
        return results

    # ------------------------------------------------------------------ #
    #  Helpers                                                             #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _cosine(a: np.ndarray, b: np.ndarray) -> float:
        a = a / (np.linalg.norm(a) + 1e-10)
        b = b / (np.linalg.norm(b) + 1e-10)
        return float(1.0 - np.dot(a, b))
