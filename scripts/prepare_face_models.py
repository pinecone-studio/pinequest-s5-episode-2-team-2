"""Fetch the pinned MediaPipe bundles; model weights stay outside git."""
import hashlib
import io
from pathlib import Path
import urllib.request
import zipfile

URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
SHA256 = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"
MODELS = ("face_detector.tflite", "face_landmarks_detector.tflite")
# Hand and body models for answering the vision check by pointing, as in the web demo.
HAND_POSE_BUNDLES = (
    (
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1",
        ("hand_detector.tflite", "hand_landmarks_detector.tflite"),
    ),
    (
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a",
        ("pose_detector.tflite", "pose_landmarks_detector.tflite"),
    ),
)
FULL_RANGE_URL = "https://storage.googleapis.com/mediapipe-assets/face_detection_full_range_sparse.tflite"
FULL_RANGE_SHA256 = "2c3728e6da56f21e21a320433396fb06d40d9088f2247c05e5635a688d45dfe1"
DESTINATION = Path(__file__).resolve().parents[1] / "apps/mobile/assets/models"


def extract_models(
    bundle: bytes, sha256: str | None = None, names: tuple[str, ...] | None = None
) -> dict[str, bytes]:
    if hashlib.sha256(bundle).hexdigest() != (sha256 or SHA256):
        raise ValueError("MediaPipe bundle checksum mismatch")
    with zipfile.ZipFile(io.BytesIO(bundle)) as archive:
        models = {name: archive.read(name) for name in (names or MODELS)}
    if any(data[4:8] != b"TFL3" for data in models.values()):
        raise ValueError("Invalid TFLite model")
    return models


def prepare(url: str, sha256: str, names: tuple[str, ...]) -> None:
    # Keep the verified bundle locally so repeated starts work offline.
    cache = DESTINATION / url.rsplit("/", 1)[1]
    if cache.exists():
        bundle = cache.read_bytes()
    else:
        with urllib.request.urlopen(url, timeout=60) as response:
            bundle = response.read(10_000_001)
        if len(bundle) > 10_000_000:
            raise ValueError("Unexpected model bundle size")
    models = extract_models(bundle, sha256, names)
    DESTINATION.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(bundle)
    for name, data in models.items():
        (DESTINATION / name).write_bytes(data)


def prepare_full_range() -> None:
    path = DESTINATION / "face_detection_full_range_sparse.tflite"
    if path.exists():
        data = path.read_bytes()
    else:
        with urllib.request.urlopen(FULL_RANGE_URL, timeout=60) as response:
            data = response.read(1_000_001)
    if len(data) > 1_000_000 or hashlib.sha256(data).hexdigest() != FULL_RANGE_SHA256:
        raise ValueError("Full-range face model checksum mismatch")
    if data[4:8] != b"TFL3":
        raise ValueError("Invalid full-range TFLite model")
    DESTINATION.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def main() -> None:
    prepare(URL, SHA256, MODELS)
    for url, sha256, names in HAND_POSE_BUNDLES:
        prepare(url, sha256, names)
    prepare_full_range()
    print("Verified MediaPipe face, hand and pose models ready (CPU; weights ignored by git).")

if __name__ == "__main__":
    main()
