# FaceAI – Face Detection & Recognition

A complete AI application for **real-time face detection and recognition** using
deep learning. Includes a Flask web UI and a command-line interface.

---

## Features

| Feature | Details |
|---------|---------|
| **Detection** | OpenCV DNN (ResNet-SSD) · Haar Cascade fallback |
| **Recognition** | ArcFace via DeepFace (512-d embeddings, cosine similarity) |
| **Web UI** | Drag-and-drop image upload · Live webcam stream (MJPEG) |
| **Enrollment** | Add/remove people via the UI or CLI |
| **CLI** | Process images, videos, webcam, or enroll from terminal |

---

## Installation

### 1. Prerequisites
- Python 3.9 – 3.11
- pip or conda

### 2. Create a virtual environment (recommended)
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

> **Note:** `deepface` will automatically download ArcFace model weights (~500 MB)
> on first run. This is a one-time download.

---

## Running the Web Application

```bash
python app.py
```

Open **http://localhost:5000** in your browser.

### Web UI Tabs

| Tab | Description |
|-----|-------------|
| 🔍 Detect Image | Upload any image – see bounding boxes + recognised names |
| 📷 Live Webcam | Real-time webcam feed with live face detection |
| ➕ Enroll Face | Add a new person to the recognition database |
| 🗄 Database | View and manage enrolled faces |

---

## Command-Line Interface

```bash
# Detect faces in an image
python main.py --mode image --input photo.jpg

# Process a video file
python main.py --mode video --input clip.mp4

# Real-time webcam detection
python main.py --mode webcam

# Enroll a new face
python main.py --mode enroll --name "Alice" --input alice.jpg

# Use Haar cascade instead of DNN
python main.py --mode image --input photo.jpg --detector haar

# Disable recognition (detection only)
python main.py --mode webcam --no-recog
```

---

## Project Structure

```
Face Detection and Recognition/
├── app.py               # Flask web application
├── main.py              # CLI entry point
├── requirements.txt
├── core/
│   ├── detector.py      # Face detection (DNN + Haar)
│   ├── recognizer.py    # Face recognition (ArcFace / DeepFace)
│   ├── database.py      # Known-face store
│   └── utils.py         # Shared helpers
├── models/              # Downloaded model weights (auto-created)
├── known_faces/         # Enrolled face images (auto-created)
├── output/              # Annotated results (auto-created)
└── ui/
    ├── templates/index.html
    └── static/
        ├── style.css
        └── script.js
```

---

## How It Works

### Detection Pipeline
1. Input image/frame → resize to 300×300
2. ResNet-SSD DNN forward pass → bounding boxes + confidence scores
3. Filter by confidence threshold (default 0.5)

### Recognition Pipeline
1. Crop detected face region
2. Generate 512-dimensional ArcFace embedding via DeepFace
3. Compute cosine distance against all enrolled face embeddings
4. Match if distance < threshold (default 0.40) → return name + confidence

### Enrollment
1. Detect face in uploaded image
2. Crop the largest detected face
3. Save crop to `known_faces/<name>/` directory
4. Rebuild embedding cache (`models/face_db.pkl`)

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| `No module named 'deepface'` | Run `pip install deepface tf-keras` |
| Webcam not opening | Check camera permissions; try `--detector haar` |
| Slow first recognition | DeepFace downloads weights on first run (normal) |
| "No face detected" on enroll | Use a clear, well-lit, front-facing photo |
| DNN model download fails | Run with `--detector haar` as fallback |

---

## Technologies

- **OpenCV** – Image processing, DNN inference, video capture
- **DeepFace** – ArcFace face recognition embeddings
- **Flask** – Web server, REST API, MJPEG streaming
- **NumPy** – Numerical operations on embeddings
- **Pillow** – Image format handling
