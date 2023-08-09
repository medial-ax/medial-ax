# Setup

```bash
# Need python 3.9
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
