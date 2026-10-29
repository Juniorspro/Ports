#!/bin/bash
# uso: bisect.sh DIR PC IDX L  -> primer limite de instrucciones donde JS y Unicorn difieren
S=/tmp/claude-0/-home-user-Ports/fd502c23-592a-55b1-954d-57f3fdf78eef/scratchpad
D=$1
python3 -I vectores.py bisect $D $2 $3 $4 && node difftest.js run $D/bis/in.bin $D/bis/out.bin $S/cod/lk2/imagen.bin 0x104000 | tail -1 && MOSTRAR=3 python3 -I vectores.py check $D/bis $S/cod/lk2/imagen.bin 0x104000 | cut -c1-300 | tail -4
