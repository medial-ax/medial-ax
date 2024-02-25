import init, { my_init_function, run } from 'ma-rs';

await init().then(() => {
  my_init_function();
});

onmessage = (e) => {
  const { grid, complex } = e.data;
  const result = run(grid, complex);
  postMessage(result);
};

