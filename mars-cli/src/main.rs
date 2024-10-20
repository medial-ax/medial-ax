use anyhow::{anyhow, Context, Result};
use mars_core::{complex::Complex, grid::VineyardsGridMesh};
use std::{io::Write, path::PathBuf};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

use clap::Parser;

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

    let mars = mars_core::Mars {
        complex: Some(complex),
        grid: Some(mars_core::Grid::Mesh(mesh_grid)),
    };

    let vin = mars
        .run(|i, n| {
            if i % 127 == 0 {
                let percent = (i as f64 / n as f64) * 100.0;
                info!("vineyards: {percent:3.0}%");
            }
        })
        .map_err(|e| anyhow!(e))
        .context("run mars")?;

    let output = (mars, vin);
    let output_bytes = rmp_serde::to_vec(&output)?;

    if let Some(path) = cli.output_path {
        let mut f = std::fs::File::create(path).context("create output file")?;
        f.write_all(&output_bytes).context("write to output file")?;
    } else {
        std::io::stdout()
            .write_all(&output_bytes)
            .context("write to output file")?;
    }

    Ok(())
}
