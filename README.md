# Medial Axes

## Setup

To install the things needed to run the web app you first need to install
`node`. With `brew`, this is 

```sh
brew install node
```

### Install Wasm-pack 

Wasm-pack is the tool we use to generate webassembly from Rust code.
To install wasm-pack, run
```sh
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```


### Run the frontend

Then go to the `web/` directory and run
```sh
npm i # install the things. Only need the first time.
npm run dev # start the server
```


It'll tell you to which URL to go to to open the page; probably it's
[http://localhost:5173](http://localhost:5173). While the server is running you
get live edit of all the files.

### Build the wasm bindings

This is required every time you change the Rust code, and want that change to
be in the frontend. Go to the `mars-wasm/` directory and run
```shell
wasm-pack build --target web
```

This will output a bunch of stuff to `mars-wasm/pkg`, but you don't have to worry about that.


### Build the CLI
For convenience or large jobs, we also have a cli in `mars-cli/`.
To install it as a binary you can use, go to the directory and run
```sh
cargo install --path .
```

Now the binary `mars-cli` should be possible to use in the terminal. It's
builtin help is the most up-to-date info on how to use it. At the time of
writing, it looks like this:

```sh
mars-cli
Usage: mars-cli <COMMAND>

Commands:
  print-prune
  run
  help         Print this message or the help of the given subcommand(s)

Options:
  -h, --help     Print help
  -V, --version  Print version
```

Computing everything is (at the time of writing) done like this:

```sh
mars-cli run  complex.obj  -m grid.obj  -o output
```

The output file `output` can then be uploaded in the web interface. See
`mars-cli run --help` for more options.



# Usage license
# What the program does

# Input
The user inputs an .obj file containing a three-dimensional manifold represented as a simplicial complex.
# Grids
## Creating dual grids
We create a grid aligned to the x,y,z axes by taking the bounding box of the imported .obj and subdividing it according to the selected grid density. The grid can afterwards be moved around and adjusted manually by the user using the Grid Controls context. We refer to the created grid as the Vineyards Grid and its dual grid as the Medial Axis Grid. The grid we visualize in the display window is the Vineyards Grid.
## Importing grids
## Splitting grids for parallelization
# Sneaky Matrices and other optimizations
# Medial Axes

# Webworkers and parallelization
# A Toast to error handling
# Usage
## Making a good input complex
## Making a good grid
A heuristic we use is having at least two grid cells per triangle of the input object.
