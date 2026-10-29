"""Fetch the multilingual Whisper base model for spoken E-test answers; weights stay outside git."""
from pathlib import Path
import urllib.request

URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin"
NAME = "ggml-base-q5_1.bin"
# ggml model files start with the magic number 0x67676d6c, stored little-endian.
MAGIC = b"lmgg"
MIN_BYTES, MAX_BYTES = 40_000_000, 80_000_000
DESTINATION = Path(__file__).resolve().parents[1] / "apps/mobile/assets/models"


def check_model(data: bytes) -> None:
    if data[:4] != MAGIC:
        raise ValueError("Not a ggml Whisper model")
    if not MIN_BYTES <= len(data) <= MAX_BYTES:
        raise ValueError("Unexpected Whisper model size")


def main() -> None:
    target = DESTINATION / NAME
    # Keep the downloaded model so repeated starts work offline.
    if target.exists():
        check_model(target.read_bytes())
    else:
        with urllib.request.urlopen(URL, timeout=120) as response:
            data = response.read(MAX_BYTES + 1)
        check_model(data)
        DESTINATION.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    print("Whisper speech model ready (offline; weights ignored by git).")


if __name__ == "__main__":
    main()
