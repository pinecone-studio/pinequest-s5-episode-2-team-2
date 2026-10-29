import unittest

from prepare_speech_model import MAGIC, MIN_BYTES, check_model


class CheckModelTest(unittest.TestCase):
    def test_accepts_a_ggml_file_of_the_expected_size(self):
        check_model(MAGIC + bytes(MIN_BYTES))

    def test_rejects_other_files(self):
        with self.assertRaises(ValueError):
            check_model(b"<htm" + bytes(MIN_BYTES))

    def test_rejects_truncated_downloads(self):
        with self.assertRaises(ValueError):
            check_model(MAGIC + bytes(1000))


if __name__ == "__main__":
    unittest.main()
