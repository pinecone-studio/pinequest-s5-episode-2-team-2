import hashlib
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import prepare_face_models as subject


class ModelBundleTests(unittest.TestCase):
    def bundle(self, valid=True, names=subject.MODELS):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            for name in names:
                archive.writestr(name, b"\x00\x00\x00\x00TFL3" if valid else b"invalid")
        return buffer.getvalue()

    def test_verified_bundle_extracts_only_expected_models(self):
        bundle = self.bundle()
        with patch.object(subject, "SHA256", hashlib.sha256(bundle).hexdigest()):
            self.assertEqual(set(subject.extract_models(bundle)), set(subject.MODELS))

    def test_corrupt_bundle_fails_before_extraction(self):
        with self.assertRaisesRegex(ValueError, "checksum"):
            subject.extract_models(self.bundle())

    def test_wrong_file_type_fails(self):
        bundle = self.bundle(valid=False)
        with patch.object(subject, "SHA256", hashlib.sha256(bundle).hexdigest()):
            with self.assertRaisesRegex(ValueError, "Invalid TFLite"):
                subject.extract_models(bundle)

    def test_hand_and_pose_bundles_use_their_own_checksum_and_files(self):
        for _, sha256, names in subject.HAND_POSE_BUNDLES:
            bundle = self.bundle(names=names)
            with self.assertRaisesRegex(ValueError, "checksum"):
                subject.extract_models(bundle, sha256, names)
            digest = hashlib.sha256(bundle).hexdigest()
            self.assertEqual(set(subject.extract_models(bundle, digest, names)), set(names))

    def test_full_range_cached_model_is_checked_before_use(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "face_detection_full_range_sparse.tflite"
            data = b"\x00\x00\x00\x00TFL3"
            path.write_bytes(data)
            with patch.object(subject, "DESTINATION", Path(folder)):
                with self.assertRaisesRegex(ValueError, "checksum"):
                    subject.prepare_full_range()
                with patch.object(subject, "FULL_RANGE_SHA256", hashlib.sha256(data).hexdigest()):
                    subject.prepare_full_range()
                    self.assertEqual(path.read_bytes(), data)


if __name__ == "__main__":
    unittest.main()
