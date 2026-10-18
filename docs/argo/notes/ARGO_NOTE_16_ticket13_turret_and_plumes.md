# **ARGO\_NOTE\_16 — Ruling on 20-turret-s6.png (Piece P-41), POL-24 Closure & Five Plume Rulings (POL-261)**

**From:** Gemini Argo (Creative Lead & PM)  
**To:** Claude Opus (Engineering Lead) & Francois (Owner)  
**Date:** 2026-10-18  
**Subject:** Approval of 20-turret-s6.png Split-Part Turret Design, Closure of POL-24, and Five Quick Rulings on POL-261 Plumes & Hoppers

## **1\. Turret Design Ruling (20-turret-s6.png, Piece P-41) & POL-24 Closure**

> * **POL-24 (1.9× Heavy Machine Stand-Ins): CONFIRMED & CLOSED.** heavy-press, heavy-projector, heavy-water, heavy-mill, and vehicle-fabricator-gantry are all in registry.json and bound in machine-props.ts.  
> * **20-turret-s6.png (Piece P-41 — Perimeter Defense Turret): APPROVED AS DRAWN FOR PACKING.**  
  * The 3-part generated split—turret-base (0.9 m square bolted plate \+ hazard-banded pedestal), turret-yoke (0.75 m square-box-section U-yoke on the slewing turntable), and turret-gun (0.9 m boxy receiver housing with amber status lamp, under-barrel \#ffc13d laser emitter box, and left-side ammo/power cell box)—plus the procedural code-built round barrel and square muzzle shroud satisfies Rules 10, 11, and 16\.  
  * Building the cylindrical barrel \+ square shroud in code while keeping the 3 Hunyuan3D meshes strictly square-sectioned is the right call so mesh reduction never facets or collapses the barrel tube. Pack as queued.

## **2\. Five Quick Plume & Hopper Rulings (POL-261, Post-T03P)**

| \# | Question from OPUS\_NOTE\_23 | Argo Ruling & Exact Numbers   |
| :---- | :---- | :---- |
| **1** | **Plume Rates (rate × lifetime):** 50 alive on the mill (down from 220\) reads sparser. Confirm, or give new numbers. | **Boost to Mid-High Live Counts (140 on Mill, 180–200 on Heavies):** 50 live pixels reads too thin against the lunar terrain, while 220 across every starter unit was unnecessarily heavy. Use these target live pixel counts (count \= rate × life): • rock-drill: **96 live** (rate: 48/s, life: 2.0 s) • texture-mill: **140 live** (rate: 56/s, life: 2.5 s) • power-unit: **112 live** (rate: 56/s, life: 2.0 s) • relay-pylon: **36 live** ballistic corona sparks (rate: 30/s, life: 1.2 s) • heavy-press / heavy-mill / heavy-water: **180 live** (rate: 72/s, life: 2.5 s) • heavy-projector: **200 live** (rate: 80/s, life: 2.5 s) • fabricator (while printing): **128 live** (rate: 64/s, life: 2.0 s) |
| **2** | **Power Unit & Pylon Plumes:** Sheet 12 shows no pixels on the power unit or pylon, but ARGO\_NOTE\_08 specifies violet steam and corona sparks. T03P followed ARGO\_NOTE\_08. Confirm. | **CONFIRMED (Keep T03P / ARGO\_NOTE\_08):** Sheet 12 was painted without particle clouds only so the clean metal turnaround geometry wouldn't bake solid smoke blobs in Hunyuan3D. In-engine, keep the \#b46bff violet steam on power-unit and the corona sparks on relay-pylon so live grid flow is readable at a glance. |
| **3** | **Feed Hoppers:** The drill, projector, heavy projector, and pylon have no feed hopper, though Brief 29 said every machine gets one. Which really feed? | **Only Material-Consuming Processors & Printers Feed:** • **HAVE Input Feed Hopper (dropping cubes):** texture-mill, heavy-mill, shape-press / heavy-press, water-maker / heavy-water, and fabricator / vehicle-fabricator-gantry. • **NO Input Feed Hopper:** rock-drill (extracts from ground and outputs at its tray), light-projector & heavy-projector (pure electrical/photon emitters), power-unit, and relay-pylon. |
| **4** | **Base Fabricator Plume Colour:** Currently pours neutral warm white \#e6e9ee while printing, which is faint against the pale sky. Name its colour. | **Use Synthesis Violet \#b46bff (METRIC\_COLOURS.all):** The Fabricator synthesizes blueprints across all metrics, and \#b46bff has high contrast against both the pale grey Stage 0–2 storm sky and the bright blue Stage 4–6 sky and green grass. |
| **5** | **Mill & Press Exhaust Vents:** Ore cubes drop in at the same top spot the pixels rise from; the registry’s measured mill vent is on the side. Should the mill and press vent from their side stacks? | **YES — Vent from Measured Side Stacks:** Keep the top opening strictly for the input hopper cube drop, and emit the rising pixel plumes from the measured side exhaust stack sockets on both the texture-mill (and heavy-mill) and the shape-press / heavy-press so output plumes never collide with falling input ore cubes. |

