// Default substages and checklist items for each stage (keyed by stage order 1-11)
// All items start as pending/unchecked for new projects
// Standards referenced: IS codes, NBC 2016, CPWD Manual, etc.

const DEFAULT_SUBSTAGES = {
  1: [
    { name: "Site Survey & Soil Investigation", checklist: [
      { item: "Topographical survey completed with contour mapping at 0.5m intervals", std: "IS 1892:1979", m: 1 },
      { item: "Soil boring test conducted at minimum 2 locations per 200 sqm", std: "IS 2720 (All Parts)", m: 1 },
      { item: "Standard Penetration Test (SPT) performed to determine bearing capacity", std: "IS 2131:1981", m: 1 },
      { item: "Soil classification report prepared (type, moisture, pH, sulphate content)", std: "IS 1498:1970", m: 1 },
      { item: "Safe bearing capacity of soil determined and documented", std: "IS 6403:1981", m: 1 },
      { item: "Ground water table level recorded", std: "IS 2720-Part 2", m: 0 },
      { item: "Chemical analysis of soil for aggressive conditions", std: "IS 2720-Part 26", m: 0 }
    ]},
    { name: "Architectural Design & Planning", checklist: [
      { item: "Floor plans comply with local building bye-laws (setbacks, FAR, coverage)", std: "NBC 2016 Part 3", m: 1 },
      { item: "Minimum room dimensions met: Habitable room >= 9.5 sqm, Kitchen >= 5.0 sqm", std: "NBC 2016 Cl. 8.2", m: 1 },
      { item: "Minimum ceiling height 2.75m for habitable rooms, 2.4m for others", std: "NBC 2016 Cl. 8.4", m: 1 },
      { item: "Ventilation openings >= 1/6th of floor area for habitable rooms", std: "NBC 2016 Cl. 8.5", m: 1 },
      { item: "Staircase width >= 1.0m, riser <= 190mm, tread >= 250mm", std: "NBC 2016 Cl. 8.7", m: 1 },
      { item: "Parking provisions as per local authority norms", std: "Local Bye-Laws", m: 1 },
      { item: "Fire safety provisions including exit routes", std: "NBC 2016 Part 4", m: 0 },
      { item: "Barrier-free accessibility features", std: "NBC 2016 Cl. 11", m: 0 }
    ]},
    { name: "Structural Design", checklist: [
      { item: "Structural design for all load combinations (DL+LL+EQ+Wind)", std: "IS 456:2000", m: 1 },
      { item: "Seismic design parameters applied as per zone", std: "IS 1893:2016 Part 1", m: 1 },
      { item: "Foundation design based on safe bearing capacity with FOS >= 2.5", std: "IS 1904:1986", m: 1 },
      { item: "Ductile detailing provisions for earthquake resistance", std: "IS 13920:2016", m: 1 },
      { item: "Wind load analysis as per basic wind speed", std: "IS 875:2015 Part 3", m: 1 },
      { item: "Deflection limits checked: Span/250 for beams", std: "IS 456:2000 Cl. 23.2", m: 1 },
      { item: "Minimum reinforcement requirements verified", std: "IS 456:2000 Cl. 26", m: 1 },
      { item: "Structural drawings include bar bending schedules", std: "SP 34:1987", m: 0 }
    ]},
    { name: "MEP Design", checklist: [
      { item: "Electrical load calculation and DB sizing completed", std: "IS 732:1989", m: 1 },
      { item: "Water supply demand calculation at 135 lpcd", std: "IS 1172:1993", m: 1 },
      { item: "Drainage system designed with self-cleansing velocity >= 0.6 m/s", std: "IS 1742:1983", m: 1 },
      { item: "Earthing system designed with resistance < 5 ohms", std: "IS 3043:2018", m: 1 },
      { item: "Rainwater harvesting system designed", std: "NBC 2016 Part 9", m: 0 },
      { item: "Solar panel provision allocated on roof", std: "NBC 2016 Part 11", m: 0 }
    ]},
    { name: "BOQ Preparation & Cost Estimation", checklist: [
      { item: "Detailed Bill of Quantities prepared", std: "IS 1200 (All Parts)", m: 1 },
      { item: "Material quantities computed using standard methods", std: "IS 1200:1992", m: 1 },
      { item: "Rate analysis done based on current DSR/SSR rates", std: "CPWD/State PWD DSR", m: 1 },
      { item: "Contingency provision (3-5%) included", std: "CPWD Manual", m: 0 },
      { item: "Escalation clause provision included", std: "CPWD Manual", m: 0 }
    ]}
  ],
  2: [
    { name: "Building Plan Submission & Approval", checklist: [
      { item: "Building plan submitted with site plan showing setbacks", std: "Local Building Bye-Laws", m: 1 },
      { item: "Floor plans, sections, and elevations as per sanctioned layout", std: "NBC 2016 Part 3", m: 1 },
      { item: "FAR/FSI calculation within permissible limits", std: "Local Bye-Laws", m: 1 },
      { item: "Ground coverage within permissible limits", std: "Local Bye-Laws", m: 1 },
      { item: "Setback compliance verified", std: "Local Bye-Laws", m: 1 },
      { item: "Height restriction compliance", std: "Local Bye-Laws", m: 1 }
    ]},
    { name: "Structural Stability Certificate", checklist: [
      { item: "Structural stability certificate from licensed engineer", std: "Local Authority", m: 1 },
      { item: "Structural drawings reviewed and stamped", std: "IS 456:2000", m: 1 },
      { item: "Soil investigation report attached", std: "IS 1892:1979", m: 1 },
      { item: "Seismic compliance certificate for Zone III/IV/V", std: "IS 1893:2016", m: 1 }
    ]},
    { name: "Environmental & Utility Clearances", checklist: [
      { item: "Water supply connection application submitted", std: "Local Water Board", m: 1 },
      { item: "Sewerage connection application submitted", std: "Local Municipality", m: 1 },
      { item: "Electrical supply connection application", std: "State Electricity Act", m: 1 },
      { item: "Tree cutting permission if applicable", std: "Local Authority", m: 0 },
      { item: "NOC from airport authority if in restricted zone", std: "AAI Guidelines", m: 0 }
    ]},
    { name: "Commencement Certificate", checklist: [
      { item: "Commencement certificate obtained", std: "Local Building Act", m: 1 },
      { item: "Boundary demarcation done and verified", std: "Local Survey Dept", m: 1 },
      { item: "Display board erected at site", std: "Local Bye-Laws", m: 1 },
      { item: "Copy of approved plan available at site", std: "Local Bye-Laws", m: 1 }
    ]}
  ],
  3: [
    { name: "Site Clearing & Excavation", checklist: [
      { item: "Site cleared of vegetation, debris to min 150mm depth", std: "IS 3764:1992", m: 1 },
      { item: "Excavation dimensions as per drawing +/- 50mm", std: "IS 3764:1992", m: 1 },
      { item: "Excavation sides properly sloped for depth > 1.5m", std: "IS 3764:1992 Cl. 5", m: 1 },
      { item: "Bottom of excavation compacted to 95% MDD", std: "IS 2720-Part 7", m: 1 },
      { item: "Dewatering arrangement if groundwater encountered", std: "IS 9759:1981", m: 0 },
      { item: "Excavated soil stacked min 1m from edge", std: "IS 3764:1992", m: 1 },
      { item: "Excavation depth verified before concreting", std: "IS 1200-Part 1", m: 1 }
    ]},
    { name: "PCC Bed", checklist: [
      { item: "PCC mix M10 or M15 as per specification", std: "IS 456:2000 Cl. 9", m: 1 },
      { item: "PCC thickness min 100mm over entire footing area", std: "IS 456:2000", m: 1 },
      { item: "PCC extends min 150mm beyond footing", std: "IS 456:2000", m: 1 },
      { item: "Surface leveled to receive footing formwork", std: "IS 456:2000", m: 1 },
      { item: "Curing of PCC for minimum 7 days", std: "IS 456:2000 Cl. 13.5", m: 1 }
    ]},
    { name: "Footing Construction", checklist: [
      { item: "Footing dimensions match drawing within +/-10mm", std: "IS 456:2000", m: 1 },
      { item: "Reinforcement placed with correct cover (50mm earth face)", std: "IS 456:2000 Cl. 26.4", m: 1 },
      { item: "Clear cover of 50mm on earth-contact faces", std: "IS 456:2000 Table 16", m: 1 },
      { item: "Rebar spacing, diameter, lap lengths verified", std: "SP 34:1987", m: 1 },
      { item: "Starter bars for columns at correct position", std: "IS 13920:2016", m: 1 },
      { item: "Concrete grade min M20 for RCC footings", std: "IS 456:2000 Cl. 6.1", m: 1 },
      { item: "Concrete cube samples taken: min 3 per 15 cum", std: "IS 456:2000 Cl. 15.2", m: 1 },
      { item: "Footing cured for min 7 days by ponding", std: "IS 456:2000 Cl. 13.5", m: 1 }
    ]},
    { name: "Plinth Beam Construction", checklist: [
      { item: "Plinth beam dimensions as per drawing", std: "IS 456:2000", m: 1 },
      { item: "Min 2 bars of 12mm dia at top and bottom", std: "IS 456:2000 Cl. 26.5", m: 1 },
      { item: "Stirrup spacing max 300mm c/c or d/2", std: "IS 456:2000 Cl. 26.5.1.6", m: 1 },
      { item: "Formwork aligned, plumb, and supported", std: "IS 14687:1999", m: 1 },
      { item: "Concrete placed without segregation, vibrated", std: "IS 456:2000 Cl. 13.3", m: 1 },
      { item: "Construction joints treated with bonding agent", std: "IS 456:2000 Cl. 13.4", m: 0 },
      { item: "Plinth level verified with benchmark", std: "Site Drawing", m: 1 }
    ]},
    { name: "Anti-Termite Treatment", checklist: [
      { item: "Soil treatment with approved termiticide", std: "IS 6313:2013 Part 2", m: 1 },
      { item: "Chemical barrier at 5 litres/sqm at plinth level", std: "IS 6313:2013 Part 2", m: 1 },
      { item: "Treatment on both sides of foundation walls", std: "IS 6313:2013", m: 1 },
      { item: "Treatment certificate from pest control agency", std: "IS 6313:2013", m: 1 }
    ]},
    { name: "DPC (Damp Proof Course)", checklist: [
      { item: "DPC at plinth level min 150mm above ground", std: "IS 2645:2003", m: 1 },
      { item: "DPC material: 1:1.5:3 with waterproofing (min 50mm)", std: "IS 2645:2003", m: 1 },
      { item: "DPC continuous across all walls", std: "IS 2645:2003", m: 1 },
      { item: "Surface below DPC cleaned and wetted", std: "IS 2645:2003", m: 1 }
    ]},
    { name: "Backfilling & Compaction", checklist: [
      { item: "Backfill free from organic matter and debris", std: "IS 2720-Part 4", m: 1 },
      { item: "Backfilling in layers max 200-300mm", std: "IS 2720-Part 7", m: 1 },
      { item: "Each layer compacted to min 95% MDD", std: "IS 2720-Part 8", m: 1 },
      { item: "Optimum moisture content maintained", std: "IS 2720-Part 7", m: 1 },
      { item: "No backfilling against green concrete (min 7 days)", std: "IS 456:2000", m: 1 },
      { item: "Sand filling below floor slab min 150mm", std: "IS 2720", m: 1 }
    ]}
  ],
  4: [
    { name: "Column Reinforcement & Casting", checklist: [
      { item: "Column rebar as per drawing - dia, number verified", std: "IS 456:2000 Cl. 26.5.3", m: 1 },
      { item: "Min 4 bars for rectangular, 6 for circular columns", std: "IS 456:2000 Cl. 26.5.3", m: 1 },
      { item: "Longitudinal steel: 0.8%-6% of cross-section", std: "IS 456:2000 Cl. 26.5.3.1", m: 1 },
      { item: "Lateral ties: min 8mm dia, spacing <= 300mm", std: "IS 456:2000 Cl. 26.5.3.2", m: 1 },
      { item: "Lap length min 45d compression, 50d tension", std: "IS 456:2000 Cl. 26.2.5", m: 1 },
      { item: "Clear cover 40mm with cover blocks at max 1m", std: "IS 456:2000 Table 16", m: 1 },
      { item: "Column formwork plumb within +/-5mm per 3m", std: "IS 14687:1999", m: 1 },
      { item: "Concrete M20 or higher, slump 75-100mm", std: "IS 456:2000", m: 1 },
      { item: "Concrete vibrated, no honeycombing", std: "IS 456:2000 Cl. 13.3", m: 1 },
      { item: "Cube test specimens: min 3 per batch", std: "IS 516:1959", m: 1 }
    ]},
    { name: "Beam Reinforcement & Formwork", checklist: [
      { item: "Beam dimensions as per drawing +/-5mm", std: "IS 456:2000", m: 1 },
      { item: "Main reinforcement as per BBS verified", std: "IS 456:2000 Cl. 26.5.1", m: 1 },
      { item: "Min tension steel: 0.85bd/fy", std: "IS 456:2000 Cl. 26.5.1.1", m: 1 },
      { item: "Shear stirrups max d/2 or 300mm", std: "IS 456:2000 Cl. 26.5.1.6", m: 1 },
      { item: "Extra stirrups at beam-column junction", std: "IS 13920:2016 Cl. 6.3", m: 1 },
      { item: "Beam formwork level and alignment checked", std: "IS 14687:1999", m: 1 },
      { item: "Props at min 1.2m spacing", std: "IS 14687:1999", m: 1 },
      { item: "Clear cover 25mm for beams", std: "IS 456:2000 Table 16", m: 1 },
      { item: "Side face reinforcement if depth > 750mm", std: "IS 456:2000 Cl. 26.5.1.3", m: 0 }
    ]},
    { name: "Slab Reinforcement & Casting", checklist: [
      { item: "Slab thickness as per drawing, min 120mm", std: "IS 456:2000", m: 1 },
      { item: "Main reinforcement as per drawing, min 8mm bars", std: "IS 456:2000 Cl. 26.5.2", m: 1 },
      { item: "Distribution steel min 0.12% for HYSD", std: "IS 456:2000 Cl. 26.5.2.1", m: 1 },
      { item: "Max spacing min(3d,300mm) main, min(5d,450mm) dist", std: "IS 456:2000 Cl. 26.3.3", m: 1 },
      { item: "Slab formwork level checked +/-3mm", std: "IS 14687:1999", m: 1 },
      { item: "Electrical/plumbing sleeves placed before concreting", std: "IS 732:1989", m: 1 },
      { item: "Slab concreted in one continuous pour", std: "IS 456:2000 Cl. 13.3", m: 1 },
      { item: "Concrete surface finished to level and slope", std: "IS 456:2000", m: 1 },
      { item: "Ponding curing within 24 hours, min 7 days", std: "IS 456:2000 Cl. 13.5", m: 1 },
      { item: "Formwork not removed before 14 days", std: "IS 456:2000 Table 11", m: 1 }
    ]},
    { name: "Lintel & Chajja", checklist: [
      { item: "Lintel over every opening with min 150mm bearing", std: "IS 456:2000", m: 1 },
      { item: "Lintel depth min 100mm or per design", std: "IS 456:2000", m: 1 },
      { item: "Min 2 bars of 10mm at top and bottom", std: "IS 456:2000", m: 1 },
      { item: "Chajja reinforcement per cantilever design", std: "IS 456:2000", m: 1 },
      { item: "Chajja slope for water drainage min 1:100", std: "NBC 2016", m: 1 },
      { item: "Drip mould at chajja edge", std: "Good Practice", m: 0 }
    ]},
    { name: "Staircase Construction", checklist: [
      { item: "Width >= 1000mm, riser <= 190mm, tread >= 250mm", std: "NBC 2016 Cl. 8.7", m: 1 },
      { item: "Riser and tread uniform within +/-3mm", std: "NBC 2016 Cl. 8.7", m: 1 },
      { item: "Waist slab per structural drawing", std: "IS 456:2000", m: 1 },
      { item: "Landing at every floor min 1.0m x 1.0m", std: "NBC 2016", m: 1 },
      { item: "Handrail height min 900mm", std: "NBC 2016 Cl. 8.7.5", m: 1 },
      { item: "Anti-slip nosing on stair treads", std: "NBC 2016", m: 0 },
      { item: "Max 12 risers per flight without landing", std: "NBC 2016", m: 1 }
    ]}
  ],
  5: [
    { name: "External Wall Construction (230mm)", checklist: [
      { item: "Bricks min compressive strength 3.5 N/mm2 (Class A)", std: "IS 1077:1992", m: 1 },
      { item: "Bricks soaked min 2 hours before use", std: "IS 2212:1991", m: 1 },
      { item: "Mortar CM 1:6 for superstructure", std: "IS 2250:1981", m: 1 },
      { item: "Bed joints uniform 10mm +/-3mm", std: "IS 2212:1991", m: 1 },
      { item: "Vertical joints 10mm, staggered", std: "IS 2212:1991", m: 1 },
      { item: "Wall plumbness +/-5mm per 3m", std: "IS 2212:1991", m: 1 },
      { item: "Toothing/bonding at wall junctions", std: "IS 2212:1991", m: 1 },
      { item: "Max height per day: 1.5m", std: "IS 2212:1991", m: 1 },
      { item: "Curing for min 7 days", std: "IS 2212:1991", m: 1 }
    ]},
    { name: "Internal Partition Walls (115mm)", checklist: [
      { item: "Partition wall 115mm or per drawing", std: "IS 1905:1987", m: 1 },
      { item: "Bonded to main walls with L-ties", std: "IS 1905:1987", m: 1 },
      { item: "Door frame positions per drawing", std: "Site Drawing", m: 1 },
      { item: "RCC band at lintel level (seismic)", std: "IS 4326:2013 Cl. 8.4", m: 1 },
      { item: "Chase depth max 1/3 wall thickness", std: "IS 2212:1991", m: 1 },
      { item: "Top course filled after 14 days", std: "Good Practice", m: 0 }
    ]},
    { name: "Parapet Wall Construction", checklist: [
      { item: "Height min 1.0m above terrace FFL", std: "NBC 2016 Cl. 8.8", m: 1 },
      { item: "Thickness min 230mm", std: "NBC 2016", m: 1 },
      { item: "Anchored with dowels at 600mm c/c", std: "IS 4326:2013", m: 1 },
      { item: "Coping with outward slope", std: "Good Practice", m: 1 },
      { item: "Weep holes at 2m c/c", std: "Good Practice", m: 1 }
    ]},
    { name: "Masonry Curing & Quality Checks", checklist: [
      { item: "Brickwork cured min 7 days", std: "IS 2212:1991", m: 1 },
      { item: "Mortar cube test: min 3 per floor", std: "IS 2250:1981", m: 1 },
      { item: "Alignment and plumbness at every 3 courses", std: "IS 2212:1991", m: 1 },
      { item: "Opening dimensions verified", std: "Site Drawing", m: 1 },
      { item: "No through cracks in masonry", std: "IS 1905:1987", m: 1 }
    ]}
  ],
  6: [
    { name: "Roof Slab Casting", checklist: [
      { item: "Thickness as per design min 120mm", std: "IS 456:2000", m: 1 },
      { item: "Reinforcement with correct spacing and cover", std: "IS 456:2000 Cl. 26.5.2", m: 1 },
      { item: "Slope towards rainwater outlets min 1:100", std: "NBC 2016", m: 1 },
      { item: "Openings for staircase, tank supports marked", std: "Site Drawing", m: 1 },
      { item: "Concrete placed and vibrated, no cold joints", std: "IS 456:2000", m: 1 },
      { item: "Curing by ponding min 14 days", std: "IS 456:2000 Cl. 13.5", m: 1 },
      { item: "Formwork removal not before 14 days", std: "IS 456:2000 Table 11", m: 1 }
    ]},
    { name: "Waterproofing Treatment", checklist: [
      { item: "Surface cleaned, cracks repaired before treatment", std: "IS 3067:1988", m: 1 },
      { item: "Membrane/coating per manufacturer spec", std: "IS 3067:1988", m: 1 },
      { item: "Brick bat coba: 80mm avg with CM 1:4", std: "IS 3067:1988", m: 1 },
      { item: "IPS finish: CM 1:2 with 20mm thickness", std: "IS 3067:1988", m: 1 },
      { item: "Turned up on parapet min 300mm", std: "IS 3067:1988", m: 1 },
      { item: "Ponding test 72 hours - no leakage", std: "IS 3067:1988", m: 1 },
      { item: "Groove joints at 3m x 3m grid", std: "Good Practice", m: 0 }
    ]},
    { name: "Thermal Insulation", checklist: [
      { item: "Insulation material per design", std: "IS 3346:1980", m: 1 },
      { item: "Thickness per heat calculation (OTTV)", std: "NBC 2016 Part 11", m: 1 },
      { item: "Laid on waterproofing without puncturing", std: "Good Practice", m: 1 },
      { item: "Reflective/cool roof coating if specified", std: "ECBC Guidelines", m: 0 }
    ]},
    { name: "Roof Drainage System", checklist: [
      { item: "Downpipes: 1 per 40 sqm roof area", std: "NBC 2016 Part 9", m: 1 },
      { item: "Downpipe min 100mm dia", std: "IS 1742:1983", m: 1 },
      { item: "Outlets at lowest points of slope", std: "IS 1742:1983", m: 1 },
      { item: "Overflow provisions at parapet", std: "Good Practice", m: 1 },
      { item: "Connected to harvesting/drain", std: "NBC 2016 Part 9", m: 1 }
    ]}
  ],
  7: [
    { name: "Electrical Conduit Laying", checklist: [
      { item: "PVC conduit 20mm lighting, 25mm power", std: "IS 9537:2000", m: 1 },
      { item: "Concealed in walls, chase max 1/3 thickness", std: "IS 732:1989", m: 1 },
      { item: "Junction boxes at max 4.5m intervals", std: "IS 732:1989", m: 1 },
      { item: "Max 4 right-angle bends between boxes", std: "IS 732:1989", m: 1 },
      { item: "Fixed with saddle clamps max 600mm", std: "IS 732:1989", m: 1 },
      { item: "Separate conduits lighting/power", std: "IS 732:1989", m: 1 },
      { item: "Switch board heights: 1.2m general, 2.0m AC", std: "IS 732:1989", m: 0 }
    ]},
    { name: "Wiring & Distribution Board", checklist: [
      { item: "Wire gauge: 1.5 sqmm lighting, 2.5 sqmm power", std: "IS 694:2010", m: 1 },
      { item: "Separate circuits per load type", std: "IS 732:1989", m: 1 },
      { item: "MCBs sized per circuit load", std: "IS 8828:1996", m: 1 },
      { item: "RCCB 30mA per floor/DB", std: "IS 12640:2000", m: 1 },
      { item: "Phase-neutral colour coding", std: "IS 732:1989", m: 1 },
      { item: "Insulation resistance min 1 MOhm", std: "IS 732:1989", m: 1 },
      { item: "DB at 1.5m from FFL", std: "IS 732:1989", m: 1 }
    ]},
    { name: "Earthing & Lightning Protection", checklist: [
      { item: "Plate or pipe earthing per design", std: "IS 3043:2018", m: 1 },
      { item: "Earth resistance < 5 ohms (megger tested)", std: "IS 3043:2018", m: 1 },
      { item: "Earth pit accessible with CI frame", std: "IS 3043:2018", m: 1 },
      { item: "Earth continuity to all sockets", std: "IS 3043:2018", m: 1 },
      { item: "Lightning protection if > 15m height", std: "IS 2309:1989", m: 0 }
    ]},
    { name: "Plumbing - Water Supply", checklist: [
      { item: "CPVC/PPR for hot, uPVC for cold", std: "IS 15778:2007", m: 1 },
      { item: "Pipe sizing per fixture unit calculation", std: "IS 2065:1983", m: 1 },
      { item: "Pressure tested at 1.5x for 30 min", std: "IS 2065:1983", m: 1 },
      { item: "Water meter at main entry", std: "IS 779:1994", m: 1 },
      { item: "Stop valves at each floor/room", std: "IS 1172:1993", m: 1 },
      { item: "Pipes concealed with protection", std: "Good Practice", m: 1 }
    ]},
    { name: "Plumbing - Drainage & Sewage", checklist: [
      { item: "Drain pipes 100mm soil, 75mm waste", std: "IS 1742:1983", m: 1 },
      { item: "Gradient 1:60 for 100mm, 1:40 for 75mm", std: "IS 1742:1983", m: 1 },
      { item: "P-trap/S-trap with 50mm water seal", std: "IS 1742:1983", m: 1 },
      { item: "Vent pipe min 75mm, 1m above roof", std: "IS 1742:1983", m: 1 },
      { item: "Inspection chambers at direction changes", std: "IS 1742:1983", m: 1 },
      { item: "Smoke/water test for entire system", std: "IS 1742:1983", m: 1 },
      { item: "Septic tank/sewer per local norms", std: "IS 2470:1985", m: 1 }
    ]},
    { name: "Water Tank & Pump", checklist: [
      { item: "OHT: 135 lpcd x persons x 1 day", std: "IS 1172:1993", m: 1 },
      { item: "Sump: min 1 day storage", std: "IS 1172:1993", m: 1 },
      { item: "Food-grade waterproofing inside", std: "IS 3370:2009", m: 1 },
      { item: "Ball valve, overflow, drain installed", std: "Good Practice", m: 1 },
      { item: "Pump matched to head and flow", std: "IS 9079:2002", m: 1 },
      { item: "Float switch/level controller", std: "Good Practice", m: 0 }
    ]}
  ],
  8: [
    { name: "Internal Wall Plastering", checklist: [
      { item: "Surface cleaned, joints raked 10mm, wetted", std: "IS 2402:1963", m: 1 },
      { item: "CM 1:6 internal, CM 1:4 wet areas", std: "IS 2402:1963", m: 1 },
      { item: "Thickness 12mm single or 15-20mm two coat", std: "IS 2402:1963", m: 1 },
      { item: "Chicken mesh at RCC-brick junction", std: "Good Practice", m: 1 },
      { item: "True to plumb within +/-3mm per 1.5m", std: "IS 2402:1963", m: 1 },
      { item: "No hollow sound (good bond)", std: "IS 2402:1963", m: 1 },
      { item: "Neat cement finish on corners", std: "IS 2402:1963", m: 0 }
    ]},
    { name: "External Wall Plastering", checklist: [
      { item: "CM 1:4 or 1:5 with waterproofing additive", std: "IS 2402:1963", m: 1 },
      { item: "Two-coat: first 12mm rough, second 8mm finish", std: "IS 2402:1963", m: 1 },
      { item: "Total thickness 18-20mm", std: "IS 2402:1963", m: 1 },
      { item: "Drip moulds at sills, chajjas, projections", std: "Good Practice", m: 1 },
      { item: "Safe scaffolding for external work", std: "IS 3696:1987", m: 1 },
      { item: "Grooves at floor line for crack control", std: "Good Practice", m: 0 }
    ]},
    { name: "Ceiling Plastering", checklist: [
      { item: "Concrete hacked/roughened for adhesion", std: "IS 2402:1963", m: 1 },
      { item: "Thickness 6-8mm with CM 1:4", std: "IS 2402:1963", m: 1 },
      { item: "Cement slurry bonding agent on RCC", std: "IS 2402:1963", m: 1 },
      { item: "Level and flat, verified with straight edge", std: "IS 2402:1963", m: 1 },
      { item: "No sagging or undulations", std: "IS 2402:1963", m: 1 }
    ]},
    { name: "Curing of Plastered Surfaces", checklist: [
      { item: "Curing started after initial set (6-8 hours)", std: "IS 2402:1963", m: 1 },
      { item: "Continuous curing min 7 days", std: "IS 2402:1963", m: 1 },
      { item: "External walls: wet gunny bags if needed", std: "IS 2402:1963", m: 1 },
      { item: "No premature drying / direct sunlight", std: "IS 2402:1963", m: 1 },
      { item: "Crack inspection after curing, patch if needed", std: "IS 2402:1963", m: 1 }
    ]}
  ],
  9: [
    { name: "Floor Base Preparation", checklist: [
      { item: "Sub-base compacted to 95% MDD", std: "IS 2720-Part 8", m: 1 },
      { item: "PCC/screed 50mm min to correct level", std: "IS 456:2000", m: 1 },
      { item: "Level verified +/-3mm", std: "Site Drawing", m: 1 },
      { item: "Waterproofing in wet areas", std: "IS 3067:1988", m: 1 },
      { item: "Turned up on walls 150mm (300mm shower)", std: "IS 3067:1988", m: 1 },
      { item: "Ponding test 48 hours in wet areas", std: "IS 3067:1988", m: 1 }
    ]},
    { name: "Tile / Stone / Marble Laying", checklist: [
      { item: "Tiles soaked min 30 minutes", std: "IS 13753:1993", m: 1 },
      { item: "Adhesive or CM 1:3 bed 20-25mm", std: "IS 13753:1993", m: 1 },
      { item: "Joints: 2mm vitrified, 3-5mm ceramic", std: "IS 13753:1993", m: 1 },
      { item: "All tiles tapped - no hollow spots", std: "IS 13753:1993", m: 1 },
      { item: "Slope towards drain min 1:100", std: "IS 13753:1993", m: 1 },
      { item: "Cuts neat at edges and fixtures", std: "Good Practice", m: 1 },
      { item: "Pattern as per approved drawing", std: "Site Drawing", m: 1 },
      { item: "Grout filled after 24 hours", std: "IS 13753:1993", m: 1 }
    ]},
    { name: "Skirting Installation", checklist: [
      { item: "Height 100mm or per spec", std: "Site Drawing", m: 1 },
      { item: "Material matching floor tiles", std: "Site Drawing", m: 1 },
      { item: "Aligned level +/-2mm", std: "Good Practice", m: 1 },
      { item: "Joint sealed with sealant", std: "Good Practice", m: 0 }
    ]},
    { name: "Anti-Skid & Special Treatments", checklist: [
      { item: "Anti-skid in wet areas", std: "NBC 2016 Cl. 11", m: 1 },
      { item: "Friction coefficient >= 0.5 wet areas", std: "IS 13753:1993", m: 1 },
      { item: "Expansion joints at 3-4m intervals", std: "IS 456:2000", m: 0 },
      { item: "Movement joints at thresholds", std: "Good Practice", m: 0 },
      { item: "Floor hardener/polish for marble", std: "Manufacturer Specs", m: 0 }
    ]}
  ],
  10: [
    { name: "Painting - Primer, Putty & Final", checklist: [
      { item: "Surface cleaned of loose particles", std: "IS 2395:1994", m: 1 },
      { item: "Alkali-resistant primer applied", std: "IS 2395:1994 Part 1", m: 1 },
      { item: "Wall putty 2 coats max 1.5mm each", std: "Manufacturer Specs", m: 1 },
      { item: "Sanded smooth between coats", std: "IS 2395:1994", m: 1 },
      { item: "Min 2 coats emulsion interior", std: "IS 15489:2004", m: 1 },
      { item: "External: primer + 2 coats exterior", std: "IS 15489:2004", m: 1 },
      { item: "Enamel on MS/wood: primer + 2 coats", std: "IS 2932:1993", m: 1 },
      { item: "Coverage per spec, no brush marks", std: "IS 2395:1994", m: 1 }
    ]},
    { name: "Door & Window Installation", checklist: [
      { item: "Frame plumb and square, diagonal diff <= 3mm", std: "IS 4021:1995", m: 1 },
      { item: "Main door min 1.0m x 2.1m", std: "NBC 2016 Cl. 8.3", m: 1 },
      { item: "Holdfast min 100mm in wall, 3 per side", std: "IS 4021:1995", m: 1 },
      { item: "Window frames level, plumb, secure", std: "IS 1361:1978", m: 1 },
      { item: "Shutters operate smoothly, 3mm clearance", std: "IS 4021:1995", m: 1 },
      { item: "All hardware fitted and functional", std: "IS 3564:1996", m: 1 },
      { item: "Window glazing min 4mm glass", std: "IS 2553:1989", m: 1 },
      { item: "Sealant around all frames", std: "Good Practice", m: 1 }
    ]},
    { name: "Kitchen Platform & Fittings", checklist: [
      { item: "Platform height 850-900mm from FFL", std: "NBC 2016", m: 1 },
      { item: "RCC/prefab with granite/marble finish", std: "Site Drawing", m: 1 },
      { item: "Sink cutout with slope to drain", std: "IS 2548:1966", m: 1 },
      { item: "Waterproofing below sink area", std: "Good Practice", m: 1 },
      { item: "Gas pipe and exhaust provision", std: "IS 8423:1987", m: 1 },
      { item: "Dedicated 15A power points", std: "IS 732:1989", m: 1 }
    ]},
    { name: "Bathroom Fittings & Fixtures", checklist: [
      { item: "WC fixed at correct height, secured", std: "IS 2556:2004", m: 1 },
      { item: "Wash basin at 800mm, level and secure", std: "IS 2556:2004", m: 1 },
      { item: "All taps tested leak-free", std: "IS 8931:2003", m: 1 },
      { item: "Floor trap at lowest point", std: "IS 1742:1983", m: 1 },
      { item: "Shower: mixer 1.1m, head 2.0m", std: "Good Practice", m: 1 },
      { item: "Accessories installed at standard heights", std: "Good Practice", m: 0 },
      { item: "All waste connections verified", std: "IS 1742:1983", m: 1 }
    ]},
    { name: "Electrical Fixture Installation", checklist: [
      { item: "All switches/sockets at standard heights", std: "IS 732:1989", m: 1 },
      { item: "Switch 1.2m general, 2.0m AC/geyser", std: "IS 732:1989", m: 1 },
      { item: "Socket 300mm general, 1.2m kitchen", std: "IS 732:1989", m: 1 },
      { item: "5A for lighting, 15A for power", std: "IS 732:1989", m: 1 },
      { item: "All lights installed and operational", std: "IS 732:1989", m: 1 },
      { item: "Fan hooks tested 3x weight", std: "IS 732:1989", m: 1 },
      { item: "Final circuit testing complete", std: "IS 732:1989", m: 1 },
      { item: "Electrical completion certificate", std: "Indian Electricity Rules", m: 1 }
    ]},
    { name: "Final Plumbing Fixtures & Testing", checklist: [
      { item: "All supply points adequate pressure", std: "IS 1172:1993", m: 1 },
      { item: "Hot water system installed and tested", std: "IS 2082:1993", m: 1 },
      { item: "All drains tested - no blockages", std: "IS 1742:1983", m: 1 },
      { item: "Tank float valves operational", std: "Good Practice", m: 1 },
      { item: "Pump auto controller tested", std: "Good Practice", m: 1 },
      { item: "No leaks at any joint", std: "IS 1742:1983", m: 1 }
    ]}
  ],
  11: [
    { name: "Pre-Handover Inspection & Snag List", checklist: [
      { item: "Complete walk-through all rooms and external", std: "Good Practice", m: 1 },
      { item: "Snag list with photo documentation", std: "Good Practice", m: 1 },
      { item: "All doors/windows checked for operation", std: "IS 4021:1995", m: 1 },
      { item: "All switches/sockets/lights tested", std: "IS 732:1989", m: 1 },
      { item: "All plumbing points tested", std: "IS 1742:1983", m: 1 },
      { item: "Tile condition checked", std: "IS 13753:1993", m: 1 },
      { item: "Paint finish inspected", std: "IS 2395:1994", m: 1 },
      { item: "External areas checked", std: "Site Drawing", m: 1 }
    ]},
    { name: "Snag Rectification", checklist: [
      { item: "All snags assigned with deadline", std: "Good Practice", m: 1 },
      { item: "Each item re-inspected and signed off", std: "Good Practice", m: 1 },
      { item: "Paint touch-up completed", std: "IS 2395:1994", m: 1 },
      { item: "Final cleaning after snag work", std: "Good Practice", m: 1 },
      { item: "Zero open snags before handover", std: "Good Practice", m: 1 }
    ]},
    { name: "Testing & Commissioning", checklist: [
      { item: "Complete electrical testing: IR, earth, load", std: "IS 732:1989", m: 1 },
      { item: "Plumbing pressure test 1.5x for 30 min", std: "IS 2065:1983", m: 1 },
      { item: "Drainage flow test all points", std: "IS 1742:1983", m: 1 },
      { item: "Pump and tank automation tested", std: "Good Practice", m: 1 },
      { item: "Fire extinguishers installed", std: "NBC 2016 Part 4", m: 1 },
      { item: "Lifts tested and certified if applicable", std: "IS 14665:2000", m: 0 }
    ]},
    { name: "Documentation & Certificates", checklist: [
      { item: "Completion certificate obtained", std: "Local Building Act", m: 1 },
      { item: "Occupancy certificate obtained", std: "Local Building Act", m: 1 },
      { item: "Electrical completion certificate", std: "Indian Electricity Rules", m: 1 },
      { item: "Structural stability certificate", std: "Local Authority", m: 1 },
      { item: "As-built drawings prepared", std: "Good Practice", m: 1 },
      { item: "Material test reports compiled", std: "Good Practice", m: 1 },
      { item: "Warranty documents handed over", std: "Good Practice", m: 1 },
      { item: "Vendor contact list provided", std: "Good Practice", m: 0 }
    ]},
    { name: "Formal Handover to Owner", checklist: [
      { item: "All keys handed over with register", std: "Good Practice", m: 1 },
      { item: "Owner walk-through with PM", std: "Good Practice", m: 1 },
      { item: "User manuals for all equipment", std: "Good Practice", m: 1 },
      { item: "Maintenance schedule document", std: "Good Practice", m: 0 },
      { item: "Defect liability period communicated", std: "Contract Terms", m: 1 },
      { item: "Formal handover document signed", std: "Good Practice", m: 1 }
    ]}
  ]
};

export default DEFAULT_SUBSTAGES;
