"""
app.py – Flask Web Application
================================
Run:  python app.py
Open: http://localhost:5000
"""

import io
import threading
import time

import cv2
from flask import (Flask, Response, jsonify, render_template,
                   request, send_from_directory)
from PIL import Image

from core.database   import FaceDatabase
from core.detector   import FaceDetector
from core.recognizer import FaceRecognizer
from core.utils      import (FPSCounter, bytes_to_cv2, cv2_to_b64,
                              encode_frame, pil_to_cv2, save_output)

# ------------------------------------------------------------------ #
#  App setup                                                           #
# ------------------------------------------------------------------ #
app = Flask(__name__, template_folder="ui/templates", static_folder="ui/static")

database   = FaceDatabase()
detector   = FaceDetector(backend="dnn")
recognizer = FaceRecognizer(database)

# Webcam state
_cam_lock     = threading.Lock()
_cam          = None
_streaming    = False
_fps_counter  = FPSCounter()
_face_count   = 0
_current_fps  = 0.0


# ------------------------------------------------------------------ #
#  Pages                                                               #
# ------------------------------------------------------------------ #
@app.route("/")
def index():
    return render_template("index.html")


# ------------------------------------------------------------------ #
#  Image detection                                                     #
# ------------------------------------------------------------------ #
@app.route("/api/detect", methods=["POST"])
def api_detect():
    """Detect (and optionally recognise) faces in an uploaded image."""
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "No image provided"}), 400

    img = bytes_to_cv2(file.read())
    if img is None:
        return jsonify({"error": "Cannot decode image"}), 400

    use_recog = request.form.get("recognition", "true").lower() == "true"

    faces = detector.detect(img)
    labels = None
    label_data = []

    if use_recog and recognizer.available and faces:
        results = recognizer.recognize_all(img, faces)
        labels  = [f"{n} ({c:.0%})" if n != "Unknown" else "Unknown"
                   for n, c in results]
        label_data = [{"name": n, "confidence": float(c)} for n, c in results]
    else:
        label_data = [{"name": "Face", "confidence": float(conf)}
                      for *_, conf in faces]

    annotated = detector.annotate(img, faces, labels)
    save_output(annotated)
    b64 = cv2_to_b64(annotated)

    face_list = []
    for i, (x, y, w, h, conf) in enumerate(faces):
        entry = {
            "id":         int(i + 1),
            "x":          int(x),
            "y":          int(y),
            "w":          int(w),
            "h":          int(h),
            "confidence": float(round(conf, 3)),
        }
        if label_data:
            entry.update(label_data[i])
        face_list.append(entry)

    return jsonify({
        "face_count":    int(len(faces)),
        "faces":         face_list,
        "annotated_b64": b64,
        "recognition":   bool(recognizer.available and use_recog),
    })


# ------------------------------------------------------------------ #
#  Webcam streaming                                                    #
# ------------------------------------------------------------------ #
def _gen_frames():
    global _streaming, _cam, _face_count, _current_fps
    
    with _cam_lock:
        if _cam is not None:
            try:
                _cam.release()
            except Exception:
                pass
            _cam = None

        _cam = cv2.VideoCapture(0)
        if not _cam.isOpened():
            _cam = None
            return

    _streaming = True
    counter    = FPSCounter()

    try:
        while _streaming:
            cam_ref = _cam
            if cam_ref is None:
                break
            ret, frame = cam_ref.read()
            if not ret:
                break

            faces = detector.detect(frame)
            _face_count = len(faces)

            labels = None
            if recognizer.available and faces:
                results = recognizer.recognize_all(frame, faces)
                labels  = [f"{n} ({c:.0%})" if n != "Unknown" else "Unknown"
                           for n, c in results]

            frame = detector.annotate(frame, faces, labels)
            fps   = counter.tick()
            _current_fps = fps

            cv2.putText(frame, f"FPS: {fps:.1f}  |  Faces: {_face_count}",
                        (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 220, 180), 2)

            yield encode_frame(frame)
    finally:
        with _cam_lock:
            if _cam is not None:
                try:
                    _cam.release()
                except Exception:
                    pass
                _cam = None
            _streaming = False


@app.route("/video_feed")
def video_feed():
    return Response(
        _gen_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/api/webcam/start", methods=["POST"])
def webcam_start():
    global _streaming
    if not _streaming:
        _streaming = True
    return jsonify({"status": "started"})


@app.route("/api/webcam/stop", methods=["POST"])
def webcam_stop():
    global _streaming, _cam
    _streaming = False
    with _cam_lock:
        if _cam is not None:
            try:
                _cam.release()
            except Exception:
                pass
            _cam = None
    return jsonify({"status": "stopped"})


@app.route("/api/webcam/stats")
def webcam_stats():
    return jsonify({"fps": round(_current_fps, 1), "face_count": _face_count})


# ------------------------------------------------------------------ #
#  Enrollment                                                          #
# ------------------------------------------------------------------ #
@app.route("/api/enroll", methods=["POST"])
def api_enroll():
    name = request.form.get("name", "").strip()
    file = request.files.get("image")

    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not file:
        return jsonify({"error": "Image is required"}), 400

    img = bytes_to_cv2(file.read())
    if img is None:
        return jsonify({"error": "Cannot decode image"}), 400

    faces = detector.detect(img)
    if not faces:
        return jsonify({"error": "No face detected in the image – please use a clear face photo."}), 400

    # Crop the largest face
    faces_sorted = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    x, y, w, h, _ = faces_sorted[0]
    crop = img[max(0, y - 20): y + h + 20, max(0, x - 20): x + w + 20]

    database.add_face(name, crop)
    if recognizer.available:
        recognizer.rebuild()

    return jsonify({"success": True, "name": name, "message": f"'{name}' enrolled successfully!"})


# ------------------------------------------------------------------ #
#  Database API                                                        #
# ------------------------------------------------------------------ #
@app.route("/api/database")
def api_database():
    return jsonify({"people": database.list_people(), "total": database.count()})


@app.route("/api/database/<raw_name>", methods=["DELETE"])
def api_delete_person(raw_name):
    ok = database.remove_face(raw_name)
    if ok and recognizer.available:
        recognizer.rebuild()
    return jsonify({"success": ok})


# ------------------------------------------------------------------ #
#  Run                                                                 #
# ------------------------------------------------------------------ #
if __name__ == "__main__":
    print("\n>>> Face Detection & Recognition Web App")
    print("    Open http://localhost:5000 in your browser\n")
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
