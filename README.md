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

To both build the rust component and install it, run

```bash
./update-rust.sh
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

## Web App

To install the things needed to run the web app you first need to install `node`. With `brew`, this is 
```sh
brew install node
```

### Install Wasm 
This is also in the `ma-rs/` directory README, but for convenience we put it here as well: inside the `ma-rs` directory, run 
```sh
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```
to install wasm if you do not have it. 

### Build Wasm
To update rust after getting wasm, still in the `ma-rs/`, run 
```shell
wasm-pack build --target web --features wasm
```
Note that this does not have the release option like inside the other README.

### Compile the web things
Then go to the `web/` directory and run
```sh
npm i # install the things. Only need the first time.
npm run dev # start the server
```

It'll tell you to which URL to go to to open the page;
probably it's `http://localhost:5173`.
While the server is running you get live edit of all the files.