# Metro path compatibility

Use the patched upstream image-size 2.0.4 parser through an npm alias. Metro 0.83 passes both paths and Buffers, while v2 accepts only byte arrays. This build-only adapter reads paths into Buffers, retaining Metro's synchronous API without copying or modifying upstream parser code. Upstream licensing is retained in the dependency.
