use anyhow::{anyhow, Context, Result};
use mars_core::{complex::Complex, grid::VineyardsGridMesh, PruningParam};
use std::{io::Write, path::PathBuf};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

use clap::{Args, Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(version, about)]
struct Cli {
    #[command(subcommand)]
    command: Sub,
}

#[derive(Debug, Subcommand)]
enum Sub {
    PrintPrune,
    Run(RunArgs),
}

#[derive(Debug, Args)]
struct RunArgs {
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

    #[arg(
        short,
        long,
        help = "Whether to pre-prune, with an optional prune file",
        value_name = "PRUNE.json",
        num_args=0..=1
    )]
    prune: Option<Option<PathBuf>>,
}

fn default_pruning_params() -> [PruningParam; 3] {
    let dim0 = PruningParam {
        euclidean: true,
        euclidean_distance: Some(0.01),
        coface: true,
        face: false,
        persistence: false,
        persistence_threshold: None,
    };
    let dim1 = PruningParam {
        euclidean: true,
        euclidean_distance: Some(0.01),
        coface: false,
        face: true,
        persistence: true,
        persistence_threshold: Some(0.01),
    };
    let dim2 = PruningParam {
        euclidean: true,
        euclidean_distance: Some(0.01),
        coface: false,
        face: true,
        persistence: false,
        persistence_threshold: None,
    };

    [dim0, dim1, dim2]
}

fn print_prune_config() -> Result<()> {
    let cfgs = default_pruning_params();
    let string = serde_json::to_string_pretty(&cfgs)?;
    println!("{}", string);
    Ok(())
}

fn run(args: &RunArgs) -> Result<()> {
    let complex = Complex::read_from_obj_path(&args.obj_path)
        .map_err(|e| anyhow!(e))
        .context("failed to read complex")
        .unwrap();

    let mesh_grid = {
        let obj_string = std::fs::read_to_string(&args.mesh_path)
            .with_context(|| format!("failed to read mesh path: {:?}", args.mesh_path))
            .unwrap();
        VineyardsGridMesh::read_from_obj_string(&obj_string)
    }
    .map_err(|e| anyhow!(e))
    .context("failed to read complex")
    .unwrap();

    let mars = mars_core::Mars {
        complex: Some(complex),
        grid: Some(mars_core::Grid::Mesh(mesh_grid)),
    };

    let mut vin = mars
        .run(|i, n| {
            if i % 127 == 0 {
                let percent = (i as f64 / n as f64) * 100.0;
                info!("vineyards: {percent:3.0}%");
            }
        })
        .map_err(|e| anyhow!(e))
        .context("run mars")?;

    if let Some(ref prune) = args.prune {
        info!("Prune output");
        let prune_params = if let Some(path) = prune {
            info!("Use pruning parameters from {}", path.display());
            let file_contents = std::fs::read_to_string(path).context("read prune file")?;
            let params: [PruningParam; 3] =
                serde_json::from_slice(file_contents.as_bytes()).context("read json")?;
            params
        } else {
            info!("Use default pruning parameters");
            default_pruning_params()
        };

        let c = mars.complex.as_ref().unwrap();

        let s0 = vin.prune_dim(0, &prune_params[0], &c, |i, n| {
            if i % 511 == 0 {
                let percent = (i as f64 / n as f64) * 100.0;
                info!("prune dim 0: {percent:3.0}%");
            }
        });
        let s1 = vin.prune_dim(1, &prune_params[1], &c, |i, n| {
            if i % 511 == 0 {
                let percent = (i as f64 / n as f64) * 100.0;
                info!("prune dim 1: {percent:3.0}%");
            }
        });
        let s2 = vin.prune_dim(2, &prune_params[2], &c, |i, n| {
            if i % 511 == 0 {
                let percent = (i as f64 / n as f64) * 100.0;
                info!("prune dim 2: {percent:3.0}%");
            }
        });

        vin.swaps = [s0, s1, s2];
    }

    info!("Write output");
    let output = (mars, vin);
    let output_bytes = rmp_serde::to_vec(&output)?;

    if let Some(ref path) = args.output_path {
        let mut f = std::fs::File::create(path).context("create output file")?;
        f.write_all(&output_bytes).context("write to output file")?;
    } else {
        std::io::stdout()
            .write_all(&output_bytes)
            .context("write to stdout")?;
    }

    Ok(())
}

fn main() -> Result<()> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::TRACE)
        .with_writer(std::io::stderr)
        .finish();

    tracing::subscriber::set_global_default(subscriber)
        .expect("set global default subscriber failed");

    let cli = Cli::parse();
    match cli.command {
        Sub::PrintPrune => print_prune_config(),
        Sub::Run(r) => run(&r),
    }
}
