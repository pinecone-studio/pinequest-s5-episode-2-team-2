"""Fetch the pinned MediaPipe bundle; model weights stay outside git."""
import hashlib
import io
from pathlib import Path
import urllib.request
import zipfile

URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
SHA256 = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"
MODELS = ("face_detector.tflite", "face_landmarks_detector.tflite")
DESTINATION = Path(__file__).resolve().parents[1] / "apps/mobile/assets/models"


def extract_models(bundle: bytes) -> dict[str, bytes]:
    if hashlib.sha256(bundle).hexdigest() != SHA256:
        raise ValueError("MediaPipe bundle checksum mismatch")
    with zipfile.ZipFile(io.BytesIO(bundle)) as archive:
        models = {name: archive.read(name) for name in MODELS}
    if any(data[4:8] != b"TFL3" for data in models.values()):
        raise ValueError("Invalid TFLite model")
    return models


def main() -> None:
    # Keep the verified bundle locally so repeated starts work offline.
    cache = DESTINATION / "face_landmarker.task"
    if cache.exists():
        bundle = cache.read_bytes()
    else:
        with urllib.request.urlopen(URL, timeout=60) as response:
            bundle = response.read(10_000_001)
        if len(bundle) > 10_000_000:
            raise ValueError("Unexpected model bundle size")
    models = extract_models(bundle)
    DESTINATION.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(bundle)
    for name, data in models.items():
        (DESTINATION / name).write_bytes(data)
    print("Verified MediaPipe face models ready (CPU; weights ignored by git).")


if __name__ == "__main__":
    main()
