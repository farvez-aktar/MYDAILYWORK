"""
Known-Faces Database
Manages enrollment, storage, and retrieval of known face images.
"""
import shutil
import base64
from pathlib import Path

import cv2
import numpy as np

KNOWN_FACES_DIR = Path(__file__).parent.parent / "known_faces"
DB_CACHE        = Path(__file__).parent.parent / "models" / "face_db.pkl"


class FaceDatabase:
    """File-based known-face store."""

    def __init__(self):
        KNOWN_FACES_DIR.mkdir(exist_ok=True)
        DB_CACHE.parent.mkdir(exist_ok=True)

    # ------------------------------------------------------------------ #
    #  CRUD                                                                #
    # ------------------------------------------------------------------ #
    def add_face(self, name: str, image: np.ndarray) -> bool:
        """Save face image and invalidate embedding cache."""
        person_dir = KNOWN_FACES_DIR / self._safe(name)
        person_dir.mkdir(exist_ok=True)
        existing   = list(person_dir.glob("*.jpg"))
        img_path   = person_dir / f"{len(existing):03d}.jpg"
        cv2.imwrite(str(img_path), image)
        self._invalidate_cache()
        return True

    def remove_face(self, name: str) -> bool:
        """Delete all images for a person."""
        person_dir = KNOWN_FACES_DIR / self._safe(name)
        if person_dir.exists():
            shutil.rmtree(person_dir)
            self._invalidate_cache()
            return True
        return False

    def list_people(self) -> list:
        """Return info dicts for each enrolled person."""
        people = []
        for d in sorted(KNOWN_FACES_DIR.iterdir()):
            if not d.is_dir():
                continue
            imgs = list(d.glob("*.jpg"))
            thumb_b64 = None
            if imgs:
                img = cv2.imread(str(imgs[0]))
                if img is not None:
                    img = cv2.resize(img, (80, 80))
                    _, buf = cv2.imencode(".jpg", img)
                    thumb_b64 = base64.b64encode(buf).decode()
            people.append({
                "name":      d.name.replace("_", " "),
                "raw_name":  d.name,
                "count":     len(imgs),
                "thumbnail": thumb_b64,
            })
        return people

    def get_all_image_paths(self) -> dict:
        """Return {name: [Path, ...]} for all enrolled people."""
        result = {}
        for d in KNOWN_FACES_DIR.iterdir():
            if d.is_dir():
                imgs = list(d.glob("*.jpg"))
                if imgs:
                    result[d.name] = imgs
        return result

    def count(self) -> int:
        return len(list(KNOWN_FACES_DIR.iterdir()))

    # ------------------------------------------------------------------ #
    #  Helpers                                                             #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _safe(name: str) -> str:
        return name.strip().replace(" ", "_").replace("/", "_")

    @staticmethod
    def _invalidate_cache():
        if DB_CACHE.exists():
            DB_CACHE.unlink()
