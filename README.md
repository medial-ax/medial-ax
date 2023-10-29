# Setup

```bash
# Need python 3.10
# if no venv, get venv
pip3 install virtualenv
# To create a new env
virtualenv venv
# To activate it
source venv/bin/activate
# To deactivate it (if you ever want to)
deactivate
# Install all of the requirements
pip install -r requirements.txt
# Install rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# setup environment for Rust
source "$HOME/.cargo/env"
```

See the README in `ma-rs/` for how to build the Rust component.
This can be installed by the python component by running

```bash
# Exact naming of the `.whl` can vary.
pip install ma-rs/target/wheels/mars-0.1.1-cp310-cp310-macosx_11_0_arm64.whl --force-reinstall
```

## VS Code

We're using `black` as our formatter.

We're type annotating the Python code. To ensure these are actually checked,
put this in your `settings.json`:

```json
    "python.analysis.typeCheckingMode": "basic"
```

## Tests

We've also got tests. To run the tests, run

```bash
python -m unittest
```

This should print something like this (if all is well):

```bash
$ python -m unittest
..
----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```
