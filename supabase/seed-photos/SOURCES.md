# Seed photo sources

All six photos come from Wikimedia Commons and are released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain dedication), so
they can be used without attribution. They were downloaded on 15 November 2026, resized to
at most 1000 px on the long side and re-saved as JPEG. Nothing else was changed.

| File | Used for seeded job | Commons file | Author | Licence |
| --- | --- | --- | --- | --- |
| `power-point-1.jpg` | Power point not working | [Plugs and Switches (1543292135).jpg](https://commons.wikimedia.org/wiki/File:Plugs_and_Switches_(1543292135).jpg) | cogdogblog | CC0 |
| `split-system-1.jpg` | Split system leaking water | [Split Hisense-2.jpg](https://commons.wikimedia.org/wiki/File:Split_Hisense-2.jpg) | Air fans | CC0 |
| `front-door-1.jpg` | Sticking front door | [Close-up of an old door with peeling pink and blue paint.jpg](https://commons.wikimedia.org/wiki/File:Close-up_of_an_old_door_with_peeling_pink_and_blue_paint.jpg) | Nanihiv90 | CC0 |
| `kitchen-tap-1.jpg` | Leaking kitchen tap | [Franke faucet FF 380 kitchen sink showing drip.jpg](https://commons.wikimedia.org/wiki/File:Franke_faucet_FF_380_kitchen_sink_showing_drip.jpg) | Tomwsulcer | CC0 |
| `kitchen-tap-2.jpg` | Leaking kitchen tap | [Water running from kitchen tap.jpg](https://commons.wikimedia.org/wiki/File:Water_running_from_kitchen_tap.jpg) | Fourteenzerozero | CC0 |
| `ceiling-fan-1.jpg` | Install ceiling fan | [01 Rotating Ceiling fan at 640th of a second.JPG](https://commons.wikimedia.org/wiki/File:01_Rotating_Ceiling_fan_at_640th_of_a_second.JPG) | Veera.sj | CC0 |

## How well each photo matches

Commons has few CC0 photos of household faults, so two are stand-ins:

- `power-point-1.jpg` shows an Australian double power point with a plug in it. It is not
  visibly broken.
- `split-system-1.jpg` shows a wall-mounted split system. No water leak is visible.

The other four show the thing described: a weathered timber door with a damaged latch, a
dripping kitchen mixer, a kitchen tap, and a ceiling fan. Replace any of them by dropping
your own JPEG in this folder with the same file name and running `npm run seed`.
