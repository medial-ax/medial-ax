# Only 0th MA

Here we only used the vertex simplices through the whole pipeline to see what the performance would be like, if we switch to per-dim boundary matrices.

`subdiv-3` with `0.15, 0.1` param.

```
for_each_edge called 9451 times
|======== Timed report ========
| initialize_vineyards            :      53.91ms  (53.914ms per; #1)
| vine_to_vine.ordering           :   11827.66ms  ( 1.666ms per; #7098)
| vine_to_vine.transpositions_lean:   29097.13ms  ( 4.099ms per; #7098)
| vine_to_vine.matrix copies      :   55469.69ms  ( 7.815ms per; #7098)
| low_inv                         : 9422270.88ms  ( 0.429ms per; #21955607)
| perform_one_swap case 1         : 9547677.54ms  ( 0.435ms per; #21955607)
| perform_one_swap                : 9582240.40ms  ( 0.436ms per; #21959179)
| perform_one_swap case 3         :     840.41ms  ( 0.235ms per; #3572)
| vine_to_vine.loop               : 9644032.02ms  (1358.697ms per; #7098)
| vine_to_vine                    : 9741320.44ms  (1372.404ms per; #7098)
| flood_fill_visit                : 9742716.24ms  (9742716.243ms per; #1)
|==============================
```
