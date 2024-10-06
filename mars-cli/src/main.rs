use anyhow::{anyhow, Context, Result};
use mars_core::{
    complex::Complex,
    grid::{Index, VineyardsGrid, VineyardsGridMesh},
    Reduction, Swaps,
};
use std::{collections::HashMap, io::Write, path::PathBuf};
use tracing::{trace, Level};
use tracing_subscriber::FmtSubscriber;

use clap::Parser;
use serde::{Deserialize, Serialize};

#[derive(Parser, Debug)]
#[command(version, about)]
struct Cli {
    #[arg(
        value_name = "complex.obj",
        help = "Path to the .obj file for the input complex."
    )]
    obj_path: PathBuf,

    #[arg(
        short,
        long,
        help = "Path to the .obj file for a grid mesh.",
        value_name = "mesh.obj"
    )]
    mesh_path: PathBuf,

    #[arg(short, long, help = "Number of threads to run in parallel.")]
    threads: Option<usize>,

    #[arg(
        short,
        long,
        help = "Path to the output state file.",
        value_name = "STATE"
    )]
    output_path: Option<PathBuf>,
}

#[derive(Serialize, Deserialize)]
pub struct State {
    pub grid: Option<VineyardsGrid>,
    pub mesh_grid: Option<VineyardsGridMesh>,

    pub complex: Complex,
    pub grid_index_to_reduction: HashMap<Index, Reduction>,

    pub swaps0: Vec<(Index, Index, Swaps)>,
    pub swaps1: Vec<(Index, Index, Swaps)>,
    pub swaps2: Vec<(Index, Index, Swaps)>,
}

fn run_without_prune_inner(
    complex: Complex,
    mesh_grid: VineyardsGridMesh,
    mut write: impl Write,
) -> Result<()> {
    let mut results = mesh_grid.run_vineyards(&complex, false, |i, n| {
        if i & 15 == 0 {
            trace!("{}/{}", i, n);
        }
    });

    // Bake permutations so that it is easier to serialize.
    trace!("Bake data 🧑‍🍳");
    for reduction in results.0.values_mut() {
        for st in reduction.stacks.iter_mut() {
            st.D.bake_in_permutations();
            st.R.bake_in_permutations();
            st.U_t.bake_in_permutations();
        }
    }

    trace!("Move state to global");

    fn filter_dim(v: &[(Index, Index, Swaps)], dim: usize) -> Vec<(Index, Index, Swaps)> {
        v.iter()
            .flat_map(|(i, j, s)| {
                let v: Vec<_> = s.v.iter().filter(|s| s.dim == dim).cloned().collect();
                (0 < v.len()).then(|| (*i, *j, Swaps { v }))
            })
            .collect()
    }

    let state = State {
        grid: None,
        mesh_grid: Some(mesh_grid),
        complex,
        grid_index_to_reduction: results.0,
        swaps0: filter_dim(&results.1, 0),
        swaps1: filter_dim(&results.1, 1),
        swaps2: filter_dim(&results.1, 2),
    };

    let bytes = rmp_serde::to_vec(&state).context("rmp serialize state")?;

    Ok(write.write_all(&bytes).context("write to output")?)
}

fn main() -> Result<()> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::TRACE)
        .with_writer(std::io::stderr)
        .finish();

    tracing::subscriber::set_global_default(subscriber)
        .expect("set global default subscriber failed");

    let cli = Cli::parse();

    let complex = Complex::read_from_obj_path(cli.obj_path)
        .map_err(|e| anyhow!(e))
        .context("failed to read complex")
        .unwrap();

    let mesh_grid = {
        let obj_string = std::fs::read_to_string(&cli.mesh_path)
            .with_context(|| format!("failed to read mesh path: {:?}", cli.mesh_path))
            .unwrap();
        VineyardsGridMesh::read_from_obj_string(&obj_string)
    }
    .map_err(|e| anyhow!(e))
    .context("failed to read complex")
    .unwrap();

    let mut out_bytes = Vec::new();
    run_without_prune_inner(complex, mesh_grid, &mut out_bytes).unwrap();

    if let Some(path) = cli.output_path {
        let mut f = std::fs::File::create(path).context("create output file")?;
        f.write_all(&out_bytes).context("write to output file")?;
    } else {
        std::io::stdout()
            .write_all(&out_bytes)
            .context("write to output file")?;
    }

    Ok(())
}
