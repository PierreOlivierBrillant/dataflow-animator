# Component terminals

In `direction: "circuit"`, a `connection` (or `arrow` / `move` / `flow` step)
targets a terminal with `"node:pin"` — e.g. `"R1:a"`, `"batt:+"`. Names
separated by `/` are aliases of the SAME terminal. Sides are given for the
unrotated symbol; terminals rotate with `rotation`. A type absent from this
table has no named terminals (wire it by its bare id). A `block` declares
its own terminals in `pins`.

| type | terminals |
| --- | --- |
| `resistor` | `a` (left); `b` (right) |
| `potentiometer` | `a` (left); `b` (right); `wiper` / `w` (top) |
| `capacitor` | `a` (left); `b` (right) |
| `polarized_capacitor` | `-` / `a` (left); `+` / `b` (right) |
| `inductor` | `a` (left); `b` (right) |
| `fuse` | `a` (left); `b` (right) |
| `diode` | `a` / `anode` (left); `b` / `cathode` (right) |
| `led` | `a` / `anode` (left); `b` / `cathode` (right) |
| `lamp` | `a` (left); `b` (right) |
| `motor` | `a` (left); `b` (right) |
| `buzzer` | `-` / `a` (left); `+` / `b` (right) |
| `ammeter` | `a` (left); `b` (right) |
| `voltmeter` | `a` (left); `b` (right) |
| `switch` | `a` (left); `b` (right) |
| `push_button` | `a` (left); `b` (right) |
| `battery` | `-` / `a` (left); `+` / `b` (right) |
| `dc_source` | `-` / `a` (left); `+` / `b` (right) |
| `ac_source` | `a` (left); `b` (right) |
| `current_source` | `-` / `a` (left); `+` / `b` (right) |
| `transformer` | `p1` (left, upper); `p2` (left, lower); `s1` (right, upper); `s2` (right, lower) |
| `transistor_npn` | `base` / `b` (left); `collector` / `c` (top); `emitter` / `e` (bottom) |
| `transistor_pnp` | `base` / `b` (left); `collector` / `c` (top); `emitter` / `e` (bottom) |
| `opamp` | `in_plus` / `+` (left, lower); `in_minus` / `-` (left, upper); `out` (right) |
| `mosfet_n` | `gate` / `g` (left); `drain` / `d` (right, upper); `source` / `s` (right, lower) |
| `mosfet_p` | `gate` / `g` (left); `source` / `s` (right, upper); `drain` / `d` (right, lower) |
| `transmission_gate` | `a` / `in` (left); `b` / `out` (right); `en` (top); `enb` (bottom) |
| `and_gate` | `a` (left, upper); `b` (left, lower); `y` / `out` (right) |
| `or_gate` | `a` (left, upper); `b` (left, lower); `y` / `out` (right) |
| `nand_gate` | `a` (left, upper); `b` (left, lower); `y` / `out` (right) |
| `nor_gate` | `a` (left, upper); `b` (left, lower); `y` / `out` (right) |
| `xor_gate` | `a` (left, upper); `b` (left, lower); `y` / `out` (right) |
| `xnor_gate` | `a` (left, upper); `b` (left, lower); `y` / `out` (right) |
| `not_gate` | `a` / `in` (left); `y` / `out` (right) |
| `buffer_gate` | `a` / `in` (left); `y` / `out` (right) |
| `and3_gate` | `a` (left, upper); `b` (left); `c` (left, lower); `y` / `out` (right) |
| `or3_gate` | `a` (left, upper); `b` (left); `c` (left, lower); `y` / `out` (right) |
| `nand3_gate` | `a` (left, upper); `b` (left); `c` (left, lower); `y` / `out` (right) |
| `nor3_gate` | `a` (left, upper); `b` (left); `c` (left, lower); `y` / `out` (right) |
| `xor3_gate` | `a` (left, upper); `b` (left); `c` (left, lower); `y` / `out` (right) |
| `d_flip_flop` | `d` (left, upper); `clk` (left, lower); `q` (right, upper); `qn` / `q_bar` (right, lower) |
| `jk_flip_flop` | `j` (left, upper); `clk` (left); `k` (left, lower); `q` (right, upper); `qn` / `q_bar` (right, lower) |
| `t_flip_flop` | `t` (left, upper); `clk` (left, lower); `q` (right, upper); `qn` / `q_bar` (right, lower) |
| `sr_latch` | `s` (left, upper); `r` (left, lower); `q` (right, upper); `qn` / `q_bar` (right, lower) |
| `mux_2to1` | `i0` (left, upper); `i1` (left, lower); `sel` / `s` (bottom); `y` / `out` (right) |
| `demux_1to2` | `i` / `in` (left); `sel` / `s` (bottom); `y0` (right, upper); `y1` (right, lower) |
| `half_adder` | `a` (left, upper); `b` (left, lower); `s` / `sum` (right, upper); `c` / `cout` (right, lower) |
| `full_adder` | `a` (left, upper); `b` (left); `cin` (left, lower); `s` / `sum` (right, upper); `cout` (right, lower) |
| `ground` | `a` / `t` (top) |
| `antenna` | `a` / `t` (bottom) |
