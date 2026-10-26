import hashlib
import io
import unittest
from unittest.mock import patch
import zipfile

import prepare_face_models as subject


class ModelBundleTests(unittest.TestCase):
    def bundle(self, valid=True):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            for name in subject.MODELS:
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


if __name__ == "__main__":
    unittest.main()
