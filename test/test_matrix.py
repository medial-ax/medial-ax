import unittest


class TestTest(unittest.TestCase):
    def test_works(self):
        self.assertEqual("foo", "foo")

    def test_doesnt_works(self):
        self.assertEqual("foo", "bar")
