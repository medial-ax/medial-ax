# Setup

Setup is in the README in the dir above.

# Building

To build with optimizations, run 
```bash
maturin build --release
```

This will build a [wheel](https://peps.python.org/pep-0427/) in the root directory `./target/wheels/`, which can be directly installed with `pip install <path/to/wheel.whl>`. Note that the python versions has to match the one you're using to build the wheel.
