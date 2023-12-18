#!/usr/bin/env bash
bash -c "source venv/bin/activate && cd ma-rs && maturin build --release -i python3.10" && pip install ma-rs/target/wheels/mars-0.1.1-cp310-cp310-macosx_11_0_arm64.whl --force-reinstall
