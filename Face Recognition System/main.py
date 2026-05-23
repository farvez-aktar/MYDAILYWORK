"""
main.py – Command-Line Interface
=================================
Usage examples
--------------
  python main.py --mode image   --input photo.jpg
  python main.py --mode video   --input clip.mp4
  python main.py --mode webcam
  python main.py --mode enroll  --name "Alice" --input alice.jpg

Flags
-----
  --detector  [dnn|haar]   Face detector backend (default: dnn)
  --no-recog               Disable face recognition
  --threshold  0.4         Recognition distance threshold
  --output                 Where to save annotated result
"""

import argparse
import sys
import time

import cv2

from core.detector    import FaceDetector
from core.database    import FaceDatabase
from core.recognizer  import FaceRecognizer
from core.utils       import load_image, save_output, FPSCounter


# ------------------------------------------------------------------ #
#  Helpers                                                             #
# ------------------------------------------------------------------ #
def build_label(name: str, conf: float) -> str:
    if name == "Unknown":
        return "Unknown"
    return f"{name} ({conf:.0%})"


def process_frame(frame, detector, recognizer, use_recog: bool):
    faces = detector.detect(frame)
    labels = None
    if use_recog and faces:
        results = recognizer.recognize_all(frame, faces)
        labels  = [build_label(n, c) for n, c in results]
    return detector.annotate(frame, faces, labels), len(faces)


# ------------------------------------------------------------------ #
#  Modes                                                               #
# ------------------------------------------------------------------ #
def mode_image(args, detector, recognizer, use_recog):
    print(f"[main] Processing image: {args.input}")
    img = load_image(args.input)
    out, n = process_frame(img, detector, recognizer, use_recog)
    print(f"[main] Detected {n} face(s).")
    dest = save_output(out, "image_result")
    print(f"[main] Saved → {dest}")
    cv2.imshow("Face Detection & Recognition", out)
    cv2.waitKey(0)
    cv2.destroyAllWindows()


def mode_video(args, detector, recognizer, use_recog):
    cap = cv2.VideoCapture(args.input)
    if not cap.isOpened():
        print(f"[main] Cannot open video: {args.input}")
        sys.exit(1)

    fps_counter = FPSCounter()
    print("[main] Processing video … press Q to quit.")
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        out, n  = process_frame(frame, detector, recognizer, use_recog)
        fps     = fps_counter.tick()
        cv2.putText(out, f"FPS: {fps:.1f}  Faces: {n}",
                    (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 220, 180), 2)
        cv2.imshow("Face Detection & Recognition", out)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


def mode_webcam(args, detector, recognizer, use_recog):
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[main] Cannot open webcam.")
        sys.exit(1)

    fps_counter = FPSCounter()
    print("[main] Webcam started … press Q to quit.")
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        out, n = process_frame(frame, detector, recognizer, use_recog)
        fps    = fps_counter.tick()
        cv2.putText(out, f"FPS: {fps:.1f}  Faces: {n}",
                    (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 220, 180), 2)
        cv2.imshow("Face Detection & Recognition", out)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


def mode_enroll(args, database, recognizer):
    if not args.name:
        print("[main] --name is required for enroll mode.")
        sys.exit(1)
    img = load_image(args.input)
    database.add_face(args.name, img)
    if recognizer.available:
        print("[main] Rebuilding face embeddings …")
        recognizer.rebuild()
    print(f"[main] ✓ Enrolled '{args.name}' successfully.")


# ------------------------------------------------------------------ #
#  Entry point                                                         #
# ------------------------------------------------------------------ #
def main():
    parser = argparse.ArgumentParser(description="Face Detection & Recognition CLI")
    parser.add_argument("--mode",      choices=["image", "video", "webcam", "enroll"],
                        default="webcam")
    parser.add_argument("--input",     default="",     help="Input image or video path")
    parser.add_argument("--name",      default="",     help="Person name (for enroll mode)")
    parser.add_argument("--detector",  choices=["dnn", "haar"], default="dnn")
    parser.add_argument("--no-recog",  action="store_true",     help="Disable recognition")
    parser.add_argument("--threshold", type=float, default=0.40)
    parser.add_argument("--output",    default="",     help="Output file path")
    args = parser.parse_args()

    detector   = FaceDetector(backend=args.detector)
    database   = FaceDatabase()
    recognizer = FaceRecognizer(database)
    use_recog  = not args.no_recog

    if args.mode == "image":
        mode_image(args, detector, recognizer, use_recog)
    elif args.mode == "video":
        mode_video(args, detector, recognizer, use_recog)
    elif args.mode == "webcam":
        mode_webcam(args, detector, recognizer, use_recog)
    elif args.mode == "enroll":
        mode_enroll(args, database, recognizer)


if __name__ == "__main__":
    main()
