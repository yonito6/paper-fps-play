# Foldiers sound loudness report (auto, tools/audio/render.js)

89 sounds, 172 variants, 100.2 s of audio in one sprite. Files: foldiers_sfx.ogg 691 KB, foldiers_sfx.mp3 1370 KB (budget 6 MB). Mono, 44.1 kHz.

Loudness = max momentary LUFS (BS.1770 K-weighted, 400 ms window), measured AFTER Ogg encoding (decoded back). Every variant of a sound is normalised to the same target, so repeated shots / hits never jump in level. Largest miss from a target: 0.48 LU.

Targets by group: guns -11 to -16 (sniper / shotgun / plane blast loudest), hit confirms -12.5 (headshot) to -15.5, deaths -15, world impacts -18 to -20, foley -21 to -28, UI -14 (stingers) to -32 (hover). Footsteps are rendered in the game from data/surfaces.json (own equal-loudness rule).

| id | group | variants | length s | target LUFS | measured LUFS (avg) | spread LU | peak dBFS |
|---|---|---|---|---|---|---|---|
| gun_rifle | gun | 3 | 0.23 | -13 | -13.3 | 0.0 | 0.0 |
| gun_rifle_far | gun | 2 | 0.30 | -15 | -15.1 | 0.2 | 0.0 |
| gun_smg | gun | 4 | 0.13 | -14 | -14.4 | 0.1 | 0.0 |
| gun_smg_far | gun | 2 | 0.21 | -16 | -16.1 | 0.1 | 0.0 |
| gun_shotgun | gun | 2 | 0.42 | -11.5 | -11.7 | 0.0 | 0.0 |
| gun_shotgun_far | gun | 2 | 0.37 | -14 | -14.2 | 0.1 | 0.0 |
| gun_sniper | gun | 2 | 0.60 | -11 | -11.2 | 0.1 | 0.0 |
| gun_sniper_far | gun | 2 | 0.47 | -13.5 | -13.6 | 0.1 | 0.0 |
| gun_pump | foley | 1 | 0.45 | -21 | -21.1 | 0.0 | -2.1 |
| gun_bolt | foley | 1 | 0.65 | -21 | -21.1 | 0.0 | -1.3 |
| dry_rifle | foley | 1 | 0.08 | -27 | -27.3 | 0.0 | -6.5 |
| dry_smg | foley | 1 | 0.08 | -27 | -27.2 | 0.0 | -5.3 |
| dry_shotgun | foley | 1 | 0.08 | -27 | -27.1 | 0.0 | -4.4 |
| dry_sniper | foley | 1 | 0.08 | -27 | -27.1 | 0.0 | -4.3 |
| mag_out | foley | 1 | 0.20 | -24 | -24.2 | 0.0 | -2.9 |
| mag_in | foley | 1 | 0.24 | -22 | -22.1 | 0.0 | -1.6 |
| tape_rip | foley | 1 | 0.24 | -24 | -24.2 | 0.0 | -6.1 |
| shell_in | foley | 1 | 0.12 | -24 | -24.0 | 0.0 | -3.5 |
| equip | foley | 2 | 0.25 | -24 | -24.1 | 0.1 | -3.8 |
| ads_in | foley | 1 | 0.14 | -28 | -28.2 | 0.0 | -10.6 |
| pickup | ui | 1 | 0.35 | -22 | -22.1 | 0.0 | -9.7 |
| boom_throw | gun | 2 | 0.50 | -16 | -16.2 | 0.0 | -2.0 |
| boom_whirr | world | 3 | 0.22 | -20 | -20.1 | 0.1 | -2.3 |
| boom_clang | world | 2 | 0.36 | -16 | -16.1 | 0.0 | 0.0 |
| boom_catch | foley | 1 | 0.19 | -18 | -18.0 | 0.0 | -1.5 |
| boom_hit | hit | 2 | 0.30 | -15 | -15.2 | 0.0 | -0.2 |
| boom_wind | foley | 3 | 0.12 | -27 | -27.2 | 0.4 | -3.7 |
| plane_unfold | foley | 1 | 0.34 | -22 | -22.2 | 0.0 | -6.9 |
| plane_throw | gun | 2 | 0.39 | -17 | -17.3 | 0.1 | -2.8 |
| plane_loop | world | 1 | 1.20 | -22 | -22.2 | 0.0 | -9.0 |
| plane_pop | gun | 2 | 1.90 | -10.5 | -10.6 | 0.0 | 0.0 |
| plane_down | world | 1 | 0.70 | -16 | -16.2 | 0.0 | 0.0 |
| plane_catch | hit | 1 | 0.50 | -14 | -14.1 | 0.0 | -1.0 |
| plane_rts | ui | 1 | 1.40 | -14 | -14.1 | 0.0 | -1.7 |
| plane_prompt | ui | 1 | 0.22 | -20 | -20.0 | 0.0 | -7.2 |
| knife_swing | foley | 3 | 0.24 | -20 | -20.3 | 0.1 | -3.5 |
| knife_swing_heavy | foley | 1 | 0.32 | -18 | -18.2 | 0.0 | -2.9 |
| knife_stab | hit | 2 | 0.30 | -14 | -14.1 | 0.0 | -0.0 |
| knife_slice | world | 4 | 0.27 | -20 | -20.2 | 0.0 | -3.0 |
| hit_body | hit | 4 | 0.25 | -14 | -14.0 | 0.1 | 0.0 |
| hit_head | hit | 3 | 0.50 | -12.5 | -12.6 | 0.0 | 0.0 |
| hit_limb | hit | 2 | 0.20 | -15.5 | -15.5 | 0.0 | -0.5 |
| hit_wall | hit | 2 | 0.25 | -14.5 | -14.5 | 0.0 | -0.9 |
| hit_shield | hit | 1 | 0.20 | -17 | -17.1 | 0.0 | -0.6 |
| kill_confirm | hit | 2 | 0.90 | -13.5 | -13.5 | 0.0 | -1.3 |
| kill_confirm_head | hit | 2 | 0.95 | -12.5 | -12.6 | 0.0 | -0.9 |
| body_impact | world | 4 | 0.25 | -16 | -16.0 | 0.0 | -0.3 |
| head_impact | world | 3 | 0.22 | -15 | -15.3 | 0.1 | 0.0 |
| hurt | hit | 3 | 0.30 | -15 | -15.0 | 0.1 | -1.3 |
| hurt_head | hit | 2 | 0.32 | -13.5 | -13.5 | 0.1 | -0.9 |
| death_confetti | death | 2 | 1.45 | -15 | -15.1 | 0.1 | -0.0 |
| death_shred | death | 2 | 1.19 | -14.5 | -14.7 | 0.1 | -0.3 |
| death_crumple | death | 2 | 1.24 | -15 | -15.2 | 0.0 | -2.1 |
| death_halve | death | 2 | 1.20 | -15 | -15.0 | 0.0 | -1.2 |
| death_flatten | death | 2 | 1.25 | -15 | -15.1 | 0.0 | -1.8 |
| death_unfold | death | 2 | 1.62 | -15 | -15.1 | 0.1 | -1.0 |
| death_puff | death | 1 | 0.40 | -22 | -22.2 | 0.0 | -7.0 |
| death_me | death | 1 | 1.90 | -16 | -16.0 | 0.0 | -3.3 |
| spawn_me | ui | 1 | 0.40 | -22 | -22.1 | 0.0 | -4.4 |
| imp_card_thin | world | 4 | 0.13 | -18 | -18.2 | 0.1 | -1.1 |
| imp_card_thick | world | 4 | 0.20 | -18 | -18.0 | 0.0 | -1.5 |
| imp_wood | world | 3 | 0.25 | -18 | -18.1 | 0.0 | -1.0 |
| imp_paper | world | 3 | 0.14 | -19 | -19.2 | 0.1 | -2.1 |
| imp_plastic | world | 3 | 0.12 | -19 | -19.3 | 0.4 | -1.4 |
| imp_metal | world | 3 | 0.45 | -19 | -18.9 | 0.1 | -4.8 |
| imp_mat | world | 2 | 0.12 | -20 | -20.0 | 0.0 | -1.4 |
| shred_wall | world | 2 | 0.52 | -15 | -15.1 | 0.1 | 0.0 |
| flap_tear | world | 1 | 0.85 | -15 | -15.2 | 0.0 | -1.6 |
| floor_break | world | 1 | 1.25 | -13.5 | -13.6 | 0.0 | -0.7 |
| debris | world | 3 | 0.50 | -24 | -24.1 | 0.2 | -4.5 |
| whiz | world | 3 | 0.19 | -19 | -19.3 | 0.3 | -2.1 |
| jump | move | 2 | 0.16 | -27 | -27.1 | 0.1 | -8.1 |
| crouch | move | 2 | 0.20 | -30 | -30.3 | 0.0 | -9.1 |
| paper_flap | move | 1 | 0.32 | -22 | -22.1 | 0.0 | -7.4 |
| heart | ui | 1 | 0.32 | -22 | -22.0 | 0.0 | -5.7 |
| ui_click | ui | 2 | 0.08 | -24 | -24.0 | 0.1 | -0.9 |
| ui_hover | ui | 1 | 0.04 | -32 | -32.1 | 0.0 | -5.7 |
| ui_back | ui | 1 | 0.16 | -25 | -25.2 | 0.0 | -8.0 |
| ui_tick | ui | 5 | 0.30 | -21 | -21.0 | 0.1 | -2.8 |
| kill_feed | ui | 1 | 0.15 | -28 | -28.1 | 0.0 | -10.9 |
| round_start | ui | 1 | 1.40 | -15 | -15.0 | 0.0 | -1.6 |
| round_go | ui | 1 | 0.80 | -15 | -15.1 | 0.0 | -1.6 |
| sting_win | ui | 1 | 2.20 | -14 | -14.1 | 0.0 | -1.4 |
| sting_lose | ui | 1 | 1.80 | -15 | -15.0 | 0.0 | -2.8 |
| sting_victory | ui | 1 | 2.60 | -13.5 | -13.6 | 0.0 | -1.2 |
| match_point | ui | 1 | 1.00 | -16 | -16.0 | 0.0 | -3.4 |
| score_tick | ui | 1 | 0.12 | -24 | -24.1 | 0.0 | -9.0 |
| medal | ui | 5 | 0.35 | -20 | -20.0 | 0.1 | -7.8 |
| streak | ui | 3 | 0.35 | -18 | -18.0 | 0.1 | -7.0 |
