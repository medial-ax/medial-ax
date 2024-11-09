# Mars Core


## Testing

We have snapshot tests using [insta][insta]. These are checked with `cargo test` 

To overwrite old tests, run

```sh
INSTA_UPDATE=always cargo test --release 
```

[insta]: https://insta.rs/docs/quickstart/
