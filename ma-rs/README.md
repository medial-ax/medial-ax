# Setup

Setup is in the README in the dir above.

# Building

To build with optimizations, run

```bash
maturin build --release -i python3.10
```

(we need `python3.10` for whatever reason, and `maturin` doesn't figure out this by default for some reason, even though it's in `pyproject.toml`)

This will build a [wheel](https://peps.python.org/pep-0427/) in the root directory `./target/wheels/`, which can be directly installed with `pip install <path/to/wheel.whl>`. Note that the python versions has to match the one you're using to build the wheel.
