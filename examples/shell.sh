set -euxo pipefail

PRE=../examples
OBJ=cylinder


mars-cli run $PRE/$OBJ.obj -m $PRE/"$OBJ"_grid.obj -s -o $PRE/"$OBJ"_out.txt && mars-cli prune -s $PRE/"$OBJ"_out.txt -o $PRE/"$OBJ"_out_pruned.txt -p $PRE/prune_"$OBJ".txt && mars-cli obj -s $PRE/"$OBJ"_out_pruned.txt -a $PRE/"$OBJ"_ma.obj


