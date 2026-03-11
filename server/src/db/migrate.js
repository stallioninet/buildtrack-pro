import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/buildtrack.db');
const DATA_DIR = path.join(__dirname, '../../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Delete existing DB for clean seed
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Running schema...');
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// ===== ROLES =====
console.log('Seeding roles...');
const insertRole = db.prepare('INSERT INTO roles (name, display_name, avatar_code) VALUES (?, ?, ?)');
const roles = [
  ['owner', 'Owner', 'OW'],
  ['pm', 'Project Manager', 'PM'],
  ['engineer', 'Site Engineer', 'SE'],
  ['contractor', 'Contractor', 'CO'],
  ['procurement', 'Procurement Manager', 'PR'],
  ['accounts', 'Accounts', 'AC'],
  ['inspector', 'Quality Inspector', 'QI'],
];
for (const r of roles) insertRole.run(...r);

// ===== USERS =====
console.log('Seeding users...');
const SALT_ROUNDS = 10;

// Owner account (admin) - id 1
const ownerHash = bcrypt.hashSync('password123', SALT_ROUNDS);
db.prepare('INSERT INTO users (email, password_hash, name, role_id, owner_type) VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = ?), ?)').run(
  'owner@buildtrack.com', ownerHash, 'Mr. Kumar', 'owner', 'individual'
);

// Team members created by the owner - ids 2-7
const teamMembers = [
  { email: 'pm@buildtrack.com', name: 'Rajesh Sharma', role: 'pm' },
  { email: 'engineer@buildtrack.com', name: 'Ramesh K.', role: 'engineer' },
  { email: 'contractor@buildtrack.com', name: 'MK Construction', role: 'contractor' },
  { email: 'procurement@buildtrack.com', name: 'Suresh P.', role: 'procurement' },
  { email: 'accounts@buildtrack.com', name: 'Meena A.', role: 'accounts' },
  { email: 'inspector@buildtrack.com', name: 'Vijay R.', role: 'inspector' },
];
const insertUser = db.prepare('INSERT INTO users (email, password_hash, name, role_id, created_by) VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = ?), ?)');
for (const u of teamMembers) {
  const hash = bcrypt.hashSync('password123', SALT_ROUNDS);
  insertUser.run(u.email, hash, u.name, u.role, 1); // created_by = owner (id 1)
}

// Second owner account (Construction Firm) - id 8
const firmHash = bcrypt.hashSync('password123', SALT_ROUNDS);
db.prepare('INSERT INTO users (email, password_hash, name, role_id, owner_type) VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = ?), ?)').run(
  'firm@buildtrack.com', firmHash, 'BuildRight Constructions', 'owner', 'firm'
);

// ===== PROJECTS =====
console.log('Seeding projects...');
const insertProject = db.prepare('INSERT INTO projects (name, location, plot_size, start_date, planned_end, status, total_budget, spent, completion, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
insertProject.run('Kumar Villa Project', 'Whitefield, Bangalore', '2400 sqft', '2025-09-01', '2026-08-30', 'active', 8500000, 3420000, 38, 1);
insertProject.run('Sharma Duplex', 'Koramangala, Bangalore', '1800 sqft', '2026-01-15', '2026-12-30', 'active', 6200000, 450000, 12, 1);
insertProject.run('Patel Farmhouse', 'Devanahalli, Bangalore', '4000 sqft', '2026-04-01', '2027-06-30', 'planning', 15000000, 0, 0, 1);

// ===== STAGES =====
console.log('Seeding stages...');
const stagesData = [
  [1,'Planning & Design',1,'completed',100,200000,185000,'2025-09-01','2025-09-30','Comprehensive site analysis, architectural design, structural engineering, and project planning.'],
  [1,'Approvals & Permits',2,'completed',100,150000,142000,'2025-10-01','2025-10-20','Obtaining all statutory approvals, permits, and clearances from local authorities.'],
  [1,'Foundation',3,'completed',100,1200000,1180000,'2025-10-21','2025-12-15','Complete below-ground structural work including excavation, footings, plinth beams, and DPC.'],
  [1,'Structure',4,'in-progress',65,2200000,1450000,'2025-12-16','2026-02-28','Superstructure construction including columns, beams, slabs, lintel, and staircase.'],
  [1,'Brickwork',5,'pending',0,800000,0,'2026-03-01','2026-03-31','Construction of external walls, internal partitions, and parapet walls.'],
  [1,'Roofing',6,'pending',0,600000,0,'2026-04-01','2026-04-20','Roof slab construction, waterproofing treatment, thermal insulation, and drainage.'],
  [1,'Electrical & Plumbing',7,'pending',0,900000,0,'2026-04-21','2026-05-30','Complete electrical wiring, plumbing rough-in, water supply, drainage, and sanitary installations.'],
  [1,'Plastering',8,'pending',0,500000,0,'2026-06-01','2026-06-20','Internal and external wall plastering, ceiling plastering, and curing.'],
  [1,'Flooring',9,'pending',0,700000,0,'2026-06-21','2026-07-15','Floor base preparation, tile/stone/marble laying, skirting, waterproofing.'],
  [1,'Finishing',10,'pending',0,850000,0,'2026-07-16','2026-08-15','Painting, door/window installation, kitchen and bathroom fittings, fixture installations.'],
  [1,'Handover',11,'pending',0,400000,0,'2026-08-16','2026-08-30','Final inspection, testing, snag rectification, documentation, and formal handover.'],
];
const insertStage = db.prepare('INSERT INTO stages (project_id,name,stage_order,status,completion,budget,spent,start_date,end_date,description) VALUES (?,?,?,?,?,?,?,?,?,?)');
for (const s of stagesData) insertStage.run(...s);

// Stages for Project 2 - Sharma Duplex
const stagesProject2 = [
  [2,'Planning & Design',1,'completed',100,150000,145000,'2026-01-15','2026-02-10','Site analysis and architectural design.'],
  [2,'Approvals & Permits',2,'completed',100,100000,95000,'2026-02-11','2026-02-28','Statutory approvals and clearances.'],
  [2,'Foundation',3,'in_progress',40,900000,210000,'2026-03-01','2026-04-15','Foundation and below-ground structural work.'],
  [2,'Structure',4,'pending',0,1800000,0,'2026-04-16','2026-06-30','Superstructure construction.'],
  [2,'Brickwork',5,'pending',0,600000,0,'2026-07-01','2026-07-31','External and internal walls.'],
  [2,'Electrical & Plumbing',6,'pending',0,700000,0,'2026-08-01','2026-09-15','MEP installations.'],
  [2,'Finishing',7,'pending',0,650000,0,'2026-09-16','2026-11-30','Painting, fixtures, and fittings.'],
  [2,'Handover',8,'pending',0,300000,0,'2026-12-01','2026-12-30','Final inspection and handover.'],
];
for (const s of stagesProject2) insertStage.run(...s);

// Stages for Project 3 - Patel Farmhouse
const stagesProject3 = [
  [3,'Planning & Design',1,'in_progress',60,400000,0,'2026-04-01','2026-05-15','Comprehensive design for farmhouse.'],
  [3,'Approvals & Permits',2,'pending',0,200000,0,'2026-05-16','2026-06-15','All statutory approvals.'],
  [3,'Foundation',3,'pending',0,2000000,0,'2026-06-16','2026-08-31','Foundation work for large plot.'],
  [3,'Structure',4,'pending',0,3500000,0,'2026-09-01','2026-12-31','Superstructure construction.'],
  [3,'Finishing',5,'pending',0,4000000,0,'2027-01-01','2027-05-31','Complete finishing works.'],
  [3,'Handover',6,'pending',0,900000,0,'2027-06-01','2027-06-30','Final handover.'],
]
for (const s of stagesProject3) insertStage.run(...s);

// ===== PROJECT MEMBERS =====
console.log('Seeding project members...');
const insertMember = db.prepare('INSERT INTO project_members (project_id, user_id, role, added_by) VALUES (?, ?, ?, ?)');
// Project 1 - Kumar Villa: all team members assigned
insertMember.run(1, 2, 'pm', 1);         // Rajesh as PM
insertMember.run(1, 3, 'engineer', 1);   // Ramesh as engineer
insertMember.run(1, 4, 'contractor', 1); // MK Construction as contractor
insertMember.run(1, 5, 'procurement', 1);// Suresh as procurement
insertMember.run(1, 6, 'accounts', 1);   // Meena as accounts
insertMember.run(1, 7, 'inspector', 1);  // Vijay as inspector

// Project 2 - Sharma Duplex: some team members
insertMember.run(2, 2, 'pm', 1);         // Rajesh as PM
insertMember.run(2, 3, 'engineer', 1);   // Ramesh as engineer
insertMember.run(2, 4, 'contractor', 1); // MK Construction as contractor

// Project 3 - Patel Farmhouse: just PM for now (planning stage)
insertMember.run(3, 2, 'pm', 1);

// ===== SUBSTAGES & CHECKLISTS =====
console.log('Seeding substages and checklist items (344 items across 54 substages)...');
const STAGE_DETAILS = {
  1: [
    { name:"Site Survey & Soil Investigation", completion:100, status:"completed", checklist:[
      {item:"Topographical survey completed with contour mapping at 0.5m intervals",std:"IS 1892:1979",m:1,c:1},
      {item:"Soil boring test conducted at minimum 2 locations per 200 sqm",std:"IS 2720 (All Parts)",m:1,c:1},
      {item:"Standard Penetration Test (SPT) performed to determine bearing capacity",std:"IS 2131:1981",m:1,c:1},
      {item:"Soil classification report prepared (type, moisture, pH, sulphate content)",std:"IS 1498:1970",m:1,c:1},
      {item:"Safe bearing capacity of soil determined and documented",std:"IS 6403:1981",m:1,c:1},
      {item:"Ground water table level recorded",std:"IS 2720-Part 2",m:0,c:1},
      {item:"Chemical analysis of soil for aggressive conditions",std:"IS 2720-Part 26",m:0,c:1}
    ]},
    { name:"Architectural Design & Planning", completion:100, status:"completed", checklist:[
      {item:"Floor plans comply with local building bye-laws (setbacks, FAR, coverage)",std:"NBC 2016 Part 3",m:1,c:1},
      {item:"Minimum room dimensions met: Habitable room >= 9.5 sqm, Kitchen >= 5.0 sqm",std:"NBC 2016 Cl. 8.2",m:1,c:1},
      {item:"Minimum ceiling height 2.75m for habitable rooms, 2.4m for others",std:"NBC 2016 Cl. 8.4",m:1,c:1},
      {item:"Ventilation openings >= 1/6th of floor area for habitable rooms",std:"NBC 2016 Cl. 8.5",m:1,c:1},
      {item:"Staircase width >= 1.0m, riser <= 190mm, tread >= 250mm",std:"NBC 2016 Cl. 8.7",m:1,c:1},
      {item:"Parking provisions as per local authority norms",std:"Local Bye-Laws",m:1,c:1},
      {item:"Fire safety provisions including exit routes",std:"NBC 2016 Part 4",m:0,c:1},
      {item:"Barrier-free accessibility features",std:"NBC 2016 Cl. 11",m:0,c:1}
    ]},
    { name:"Structural Design", completion:100, status:"completed", checklist:[
      {item:"Structural design for all load combinations (DL+LL+EQ+Wind)",std:"IS 456:2000",m:1,c:1},
      {item:"Seismic design parameters applied as per zone",std:"IS 1893:2016 Part 1",m:1,c:1},
      {item:"Foundation design based on safe bearing capacity with FOS >= 2.5",std:"IS 1904:1986",m:1,c:1},
      {item:"Ductile detailing provisions for earthquake resistance",std:"IS 13920:2016",m:1,c:1},
      {item:"Wind load analysis as per basic wind speed",std:"IS 875:2015 Part 3",m:1,c:1},
      {item:"Deflection limits checked: Span/250 for beams",std:"IS 456:2000 Cl. 23.2",m:1,c:1},
      {item:"Minimum reinforcement requirements verified",std:"IS 456:2000 Cl. 26",m:1,c:1},
      {item:"Structural drawings include bar bending schedules",std:"SP 34:1987",m:0,c:1}
    ]},
    { name:"MEP Design", completion:100, status:"completed", checklist:[
      {item:"Electrical load calculation and DB sizing completed",std:"IS 732:1989",m:1,c:1},
      {item:"Water supply demand calculation at 135 lpcd",std:"IS 1172:1993",m:1,c:1},
      {item:"Drainage system designed with self-cleansing velocity >= 0.6 m/s",std:"IS 1742:1983",m:1,c:1},
      {item:"Earthing system designed with resistance < 5 ohms",std:"IS 3043:2018",m:1,c:1},
      {item:"Rainwater harvesting system designed",std:"NBC 2016 Part 9",m:0,c:1},
      {item:"Solar panel provision allocated on roof",std:"NBC 2016 Part 11",m:0,c:1}
    ]},
    { name:"BOQ Preparation & Cost Estimation", completion:100, status:"completed", checklist:[
      {item:"Detailed Bill of Quantities prepared",std:"IS 1200 (All Parts)",m:1,c:1},
      {item:"Material quantities computed using standard methods",std:"IS 1200:1992",m:1,c:1},
      {item:"Rate analysis done based on current DSR/SSR rates",std:"CPWD/State PWD DSR",m:1,c:1},
      {item:"Contingency provision (3-5%) included",std:"CPWD Manual",m:0,c:1},
      {item:"Escalation clause provision included",std:"CPWD Manual",m:0,c:1}
    ]}
  ],
  2: [
    { name:"Building Plan Submission & Approval", completion:100, status:"completed", checklist:[
      {item:"Building plan submitted with site plan showing setbacks",std:"Local Building Bye-Laws",m:1,c:1},
      {item:"Floor plans, sections, and elevations as per sanctioned layout",std:"NBC 2016 Part 3",m:1,c:1},
      {item:"FAR/FSI calculation within permissible limits",std:"Local Bye-Laws",m:1,c:1},
      {item:"Ground coverage within permissible limits",std:"Local Bye-Laws",m:1,c:1},
      {item:"Setback compliance verified",std:"Local Bye-Laws",m:1,c:1},
      {item:"Height restriction compliance",std:"Local Bye-Laws",m:1,c:1}
    ]},
    { name:"Structural Stability Certificate", completion:100, status:"completed", checklist:[
      {item:"Structural stability certificate from licensed engineer",std:"Local Authority",m:1,c:1},
      {item:"Structural drawings reviewed and stamped",std:"IS 456:2000",m:1,c:1},
      {item:"Soil investigation report attached",std:"IS 1892:1979",m:1,c:1},
      {item:"Seismic compliance certificate for Zone III/IV/V",std:"IS 1893:2016",m:1,c:1}
    ]},
    { name:"Environmental & Utility Clearances", completion:100, status:"completed", checklist:[
      {item:"Water supply connection application submitted",std:"Local Water Board",m:1,c:1},
      {item:"Sewerage connection application submitted",std:"Local Municipality",m:1,c:1},
      {item:"Electrical supply connection application",std:"State Electricity Act",m:1,c:1},
      {item:"Tree cutting permission if applicable",std:"Local Authority",m:0,c:1},
      {item:"NOC from airport authority if in restricted zone",std:"AAI Guidelines",m:0,c:1}
    ]},
    { name:"Commencement Certificate", completion:100, status:"completed", checklist:[
      {item:"Commencement certificate obtained",std:"Local Building Act",m:1,c:1},
      {item:"Boundary demarcation done and verified",std:"Local Survey Dept",m:1,c:1},
      {item:"Display board erected at site",std:"Local Bye-Laws",m:1,c:1},
      {item:"Copy of approved plan available at site",std:"Local Bye-Laws",m:1,c:1}
    ]}
  ],
  3: [
    { name:"Site Clearing & Excavation", completion:100, status:"completed", checklist:[
      {item:"Site cleared of vegetation, debris to min 150mm depth",std:"IS 3764:1992",m:1,c:1},
      {item:"Excavation dimensions as per drawing +/- 50mm",std:"IS 3764:1992",m:1,c:1},
      {item:"Excavation sides properly sloped for depth > 1.5m",std:"IS 3764:1992 Cl. 5",m:1,c:1},
      {item:"Bottom of excavation compacted to 95% MDD",std:"IS 2720-Part 7",m:1,c:1},
      {item:"Dewatering arrangement if groundwater encountered",std:"IS 9759:1981",m:0,c:1},
      {item:"Excavated soil stacked min 1m from edge",std:"IS 3764:1992",m:1,c:1},
      {item:"Excavation depth verified before concreting",std:"IS 1200-Part 1",m:1,c:1}
    ]},
    { name:"PCC Bed", completion:100, status:"completed", checklist:[
      {item:"PCC mix M10 or M15 as per specification",std:"IS 456:2000 Cl. 9",m:1,c:1},
      {item:"PCC thickness min 100mm over entire footing area",std:"IS 456:2000",m:1,c:1},
      {item:"PCC extends min 150mm beyond footing",std:"IS 456:2000",m:1,c:1},
      {item:"Surface leveled to receive footing formwork",std:"IS 456:2000",m:1,c:1},
      {item:"Curing of PCC for minimum 7 days",std:"IS 456:2000 Cl. 13.5",m:1,c:1}
    ]},
    { name:"Footing Construction", completion:100, status:"completed", checklist:[
      {item:"Footing dimensions match drawing within +/-10mm",std:"IS 456:2000",m:1,c:1},
      {item:"Reinforcement placed with correct cover (50mm earth face)",std:"IS 456:2000 Cl. 26.4",m:1,c:1},
      {item:"Clear cover of 50mm on earth-contact faces",std:"IS 456:2000 Table 16",m:1,c:1},
      {item:"Rebar spacing, diameter, lap lengths verified",std:"SP 34:1987",m:1,c:1},
      {item:"Starter bars for columns at correct position",std:"IS 13920:2016",m:1,c:1},
      {item:"Concrete grade min M20 for RCC footings",std:"IS 456:2000 Cl. 6.1",m:1,c:1},
      {item:"Concrete cube samples taken: min 3 per 15 cum",std:"IS 456:2000 Cl. 15.2",m:1,c:1},
      {item:"Footing cured for min 7 days by ponding",std:"IS 456:2000 Cl. 13.5",m:1,c:1}
    ]},
    { name:"Plinth Beam Construction", completion:100, status:"completed", checklist:[
      {item:"Plinth beam dimensions as per drawing",std:"IS 456:2000",m:1,c:1},
      {item:"Min 2 bars of 12mm dia at top and bottom",std:"IS 456:2000 Cl. 26.5",m:1,c:1},
      {item:"Stirrup spacing max 300mm c/c or d/2",std:"IS 456:2000 Cl. 26.5.1.6",m:1,c:1},
      {item:"Formwork aligned, plumb, and supported",std:"IS 14687:1999",m:1,c:1},
      {item:"Concrete placed without segregation, vibrated",std:"IS 456:2000 Cl. 13.3",m:1,c:1},
      {item:"Construction joints treated with bonding agent",std:"IS 456:2000 Cl. 13.4",m:0,c:1},
      {item:"Plinth level verified with benchmark",std:"Site Drawing",m:1,c:1}
    ]},
    { name:"Anti-Termite Treatment", completion:100, status:"completed", checklist:[
      {item:"Soil treatment with approved termiticide",std:"IS 6313:2013 Part 2",m:1,c:1},
      {item:"Chemical barrier at 5 litres/sqm at plinth level",std:"IS 6313:2013 Part 2",m:1,c:1},
      {item:"Treatment on both sides of foundation walls",std:"IS 6313:2013",m:1,c:1},
      {item:"Treatment certificate from pest control agency",std:"IS 6313:2013",m:1,c:1}
    ]},
    { name:"DPC (Damp Proof Course)", completion:100, status:"completed", checklist:[
      {item:"DPC at plinth level min 150mm above ground",std:"IS 2645:2003",m:1,c:1},
      {item:"DPC material: 1:1.5:3 with waterproofing (min 50mm)",std:"IS 2645:2003",m:1,c:1},
      {item:"DPC continuous across all walls",std:"IS 2645:2003",m:1,c:1},
      {item:"Surface below DPC cleaned and wetted",std:"IS 2645:2003",m:1,c:1}
    ]},
    { name:"Backfilling & Compaction", completion:100, status:"completed", checklist:[
      {item:"Backfill free from organic matter and debris",std:"IS 2720-Part 4",m:1,c:1},
      {item:"Backfilling in layers max 200-300mm",std:"IS 2720-Part 7",m:1,c:1},
      {item:"Each layer compacted to min 95% MDD",std:"IS 2720-Part 8",m:1,c:1},
      {item:"Optimum moisture content maintained",std:"IS 2720-Part 7",m:1,c:1},
      {item:"No backfilling against green concrete (min 7 days)",std:"IS 456:2000",m:1,c:1},
      {item:"Sand filling below floor slab min 150mm",std:"IS 2720",m:1,c:1}
    ]}
  ],
  4: [
    { name:"Column Reinforcement & Casting", completion:80, status:"in-progress", checklist:[
      {item:"Column rebar as per drawing - dia, number verified",std:"IS 456:2000 Cl. 26.5.3",m:1,c:1},
      {item:"Min 4 bars for rectangular, 6 for circular columns",std:"IS 456:2000 Cl. 26.5.3",m:1,c:1},
      {item:"Longitudinal steel: 0.8%-6% of cross-section",std:"IS 456:2000 Cl. 26.5.3.1",m:1,c:1},
      {item:"Lateral ties: min 8mm dia, spacing <= 300mm",std:"IS 456:2000 Cl. 26.5.3.2",m:1,c:1},
      {item:"Lap length min 45d compression, 50d tension",std:"IS 456:2000 Cl. 26.2.5",m:1,c:1},
      {item:"Clear cover 40mm with cover blocks at max 1m",std:"IS 456:2000 Table 16",m:1,c:1},
      {item:"Column formwork plumb within +/-5mm per 3m",std:"IS 14687:1999",m:1,c:1},
      {item:"Concrete M20 or higher, slump 75-100mm",std:"IS 456:2000",m:1,c:1},
      {item:"Concrete vibrated, no honeycombing",std:"IS 456:2000 Cl. 13.3",m:1,c:1},
      {item:"Cube test specimens: min 3 per batch",std:"IS 516:1959",m:1,c:1}
    ]},
    { name:"Beam Reinforcement & Formwork", completion:70, status:"in-progress", checklist:[
      {item:"Beam dimensions as per drawing +/-5mm",std:"IS 456:2000",m:1,c:1},
      {item:"Main reinforcement as per BBS verified",std:"IS 456:2000 Cl. 26.5.1",m:1,c:1},
      {item:"Min tension steel: 0.85bd/fy",std:"IS 456:2000 Cl. 26.5.1.1",m:1,c:1},
      {item:"Shear stirrups max d/2 or 300mm",std:"IS 456:2000 Cl. 26.5.1.6",m:1,c:1},
      {item:"Extra stirrups at beam-column junction",std:"IS 13920:2016 Cl. 6.3",m:1,c:1},
      {item:"Beam formwork level and alignment checked",std:"IS 14687:1999",m:1,c:1},
      {item:"Props at min 1.2m spacing",std:"IS 14687:1999",m:1,c:1},
      {item:"Clear cover 25mm for beams",std:"IS 456:2000 Table 16",m:1,c:1},
      {item:"Side face reinforcement if depth > 750mm",std:"IS 456:2000 Cl. 26.5.1.3",m:0,c:0}
    ]},
    { name:"Slab Reinforcement & Casting", completion:55, status:"in-progress", checklist:[
      {item:"Slab thickness as per drawing, min 120mm",std:"IS 456:2000",m:1,c:1},
      {item:"Main reinforcement as per drawing, min 8mm bars",std:"IS 456:2000 Cl. 26.5.2",m:1,c:1},
      {item:"Distribution steel min 0.12% for HYSD",std:"IS 456:2000 Cl. 26.5.2.1",m:1,c:1},
      {item:"Max spacing min(3d,300mm) main, min(5d,450mm) dist",std:"IS 456:2000 Cl. 26.3.3",m:1,c:1},
      {item:"Slab formwork level checked +/-3mm",std:"IS 14687:1999",m:1,c:1},
      {item:"Electrical/plumbing sleeves placed before concreting",std:"IS 732:1989",m:1,c:1},
      {item:"Slab concreted in one continuous pour",std:"IS 456:2000 Cl. 13.3",m:1,c:1},
      {item:"Concrete surface finished to level and slope",std:"IS 456:2000",m:1,c:1},
      {item:"Ponding curing within 24 hours, min 7 days",std:"IS 456:2000 Cl. 13.5",m:1,c:1},
      {item:"Formwork not removed before 14 days",std:"IS 456:2000 Table 11",m:1,c:1}
    ]},
    { name:"Lintel & Chajja", completion:30, status:"in-progress", checklist:[
      {item:"Lintel over every opening with min 150mm bearing",std:"IS 456:2000",m:1,c:1},
      {item:"Lintel depth min 100mm or per design",std:"IS 456:2000",m:1,c:1},
      {item:"Min 2 bars of 10mm at top and bottom",std:"IS 456:2000",m:1,c:1},
      {item:"Chajja reinforcement per cantilever design",std:"IS 456:2000",m:1,c:1},
      {item:"Chajja slope for water drainage min 1:100",std:"NBC 2016",m:1,c:0},
      {item:"Drip mould at chajja edge",std:"Good Practice",m:0,c:0}
    ]},
    { name:"Staircase Construction", completion:0, status:"pending", checklist:[
      {item:"Width >= 1000mm, riser <= 190mm, tread >= 250mm",std:"NBC 2016 Cl. 8.7",m:1,c:0},
      {item:"Riser and tread uniform within +/-3mm",std:"NBC 2016 Cl. 8.7",m:1,c:0},
      {item:"Waist slab per structural drawing",std:"IS 456:2000",m:1,c:0},
      {item:"Landing at every floor min 1.0m x 1.0m",std:"NBC 2016",m:1,c:0},
      {item:"Handrail height min 900mm",std:"NBC 2016 Cl. 8.7.5",m:1,c:0},
      {item:"Anti-slip nosing on stair treads",std:"NBC 2016",m:0,c:0},
      {item:"Max 12 risers per flight without landing",std:"NBC 2016",m:1,c:0}
    ]}
  ],
  5: [
    { name:"External Wall Construction (230mm)", completion:0, status:"pending", checklist:[
      {item:"Bricks min compressive strength 3.5 N/mm2 (Class A)",std:"IS 1077:1992",m:1,c:0},
      {item:"Bricks soaked min 2 hours before use",std:"IS 2212:1991",m:1,c:0},
      {item:"Mortar CM 1:6 for superstructure",std:"IS 2250:1981",m:1,c:0},
      {item:"Bed joints uniform 10mm +/-3mm",std:"IS 2212:1991",m:1,c:0},
      {item:"Vertical joints 10mm, staggered",std:"IS 2212:1991",m:1,c:0},
      {item:"Wall plumbness +/-5mm per 3m",std:"IS 2212:1991",m:1,c:0},
      {item:"Toothing/bonding at wall junctions",std:"IS 2212:1991",m:1,c:0},
      {item:"Max height per day: 1.5m",std:"IS 2212:1991",m:1,c:0},
      {item:"Curing for min 7 days",std:"IS 2212:1991",m:1,c:0}
    ]},
    { name:"Internal Partition Walls (115mm)", completion:0, status:"pending", checklist:[
      {item:"Partition wall 115mm or per drawing",std:"IS 1905:1987",m:1,c:0},
      {item:"Bonded to main walls with L-ties",std:"IS 1905:1987",m:1,c:0},
      {item:"Door frame positions per drawing",std:"Site Drawing",m:1,c:0},
      {item:"RCC band at lintel level (seismic)",std:"IS 4326:2013 Cl. 8.4",m:1,c:0},
      {item:"Chase depth max 1/3 wall thickness",std:"IS 2212:1991",m:1,c:0},
      {item:"Top course filled after 14 days",std:"Good Practice",m:0,c:0}
    ]},
    { name:"Parapet Wall Construction", completion:0, status:"pending", checklist:[
      {item:"Height min 1.0m above terrace FFL",std:"NBC 2016 Cl. 8.8",m:1,c:0},
      {item:"Thickness min 230mm",std:"NBC 2016",m:1,c:0},
      {item:"Anchored with dowels at 600mm c/c",std:"IS 4326:2013",m:1,c:0},
      {item:"Coping with outward slope",std:"Good Practice",m:1,c:0},
      {item:"Weep holes at 2m c/c",std:"Good Practice",m:1,c:0}
    ]},
    { name:"Masonry Curing & Quality Checks", completion:0, status:"pending", checklist:[
      {item:"Brickwork cured min 7 days",std:"IS 2212:1991",m:1,c:0},
      {item:"Mortar cube test: min 3 per floor",std:"IS 2250:1981",m:1,c:0},
      {item:"Alignment and plumbness at every 3 courses",std:"IS 2212:1991",m:1,c:0},
      {item:"Opening dimensions verified",std:"Site Drawing",m:1,c:0},
      {item:"No through cracks in masonry",std:"IS 1905:1987",m:1,c:0}
    ]}
  ],
  6: [
    { name:"Roof Slab Casting", completion:0, status:"pending", checklist:[
      {item:"Thickness as per design min 120mm",std:"IS 456:2000",m:1,c:0},
      {item:"Reinforcement with correct spacing and cover",std:"IS 456:2000 Cl. 26.5.2",m:1,c:0},
      {item:"Slope towards rainwater outlets min 1:100",std:"NBC 2016",m:1,c:0},
      {item:"Openings for staircase, tank supports marked",std:"Site Drawing",m:1,c:0},
      {item:"Concrete placed and vibrated, no cold joints",std:"IS 456:2000",m:1,c:0},
      {item:"Curing by ponding min 14 days",std:"IS 456:2000 Cl. 13.5",m:1,c:0},
      {item:"Formwork removal not before 14 days",std:"IS 456:2000 Table 11",m:1,c:0}
    ]},
    { name:"Waterproofing Treatment", completion:0, status:"pending", checklist:[
      {item:"Surface cleaned, cracks repaired before treatment",std:"IS 3067:1988",m:1,c:0},
      {item:"Membrane/coating per manufacturer spec",std:"IS 3067:1988",m:1,c:0},
      {item:"Brick bat coba: 80mm avg with CM 1:4",std:"IS 3067:1988",m:1,c:0},
      {item:"IPS finish: CM 1:2 with 20mm thickness",std:"IS 3067:1988",m:1,c:0},
      {item:"Turned up on parapet min 300mm",std:"IS 3067:1988",m:1,c:0},
      {item:"Ponding test 72 hours - no leakage",std:"IS 3067:1988",m:1,c:0},
      {item:"Groove joints at 3m x 3m grid",std:"Good Practice",m:0,c:0}
    ]},
    { name:"Thermal Insulation", completion:0, status:"pending", checklist:[
      {item:"Insulation material per design",std:"IS 3346:1980",m:1,c:0},
      {item:"Thickness per heat calculation (OTTV)",std:"NBC 2016 Part 11",m:1,c:0},
      {item:"Laid on waterproofing without puncturing",std:"Good Practice",m:1,c:0},
      {item:"Reflective/cool roof coating if specified",std:"ECBC Guidelines",m:0,c:0}
    ]},
    { name:"Roof Drainage System", completion:0, status:"pending", checklist:[
      {item:"Downpipes: 1 per 40 sqm roof area",std:"NBC 2016 Part 9",m:1,c:0},
      {item:"Downpipe min 100mm dia",std:"IS 1742:1983",m:1,c:0},
      {item:"Outlets at lowest points of slope",std:"IS 1742:1983",m:1,c:0},
      {item:"Overflow provisions at parapet",std:"Good Practice",m:1,c:0},
      {item:"Connected to harvesting/drain",std:"NBC 2016 Part 9",m:1,c:0}
    ]}
  ],
  7: [
    { name:"Electrical Conduit Laying", completion:0, status:"pending", checklist:[
      {item:"PVC conduit 20mm lighting, 25mm power",std:"IS 9537:2000",m:1,c:0},
      {item:"Concealed in walls, chase max 1/3 thickness",std:"IS 732:1989",m:1,c:0},
      {item:"Junction boxes at max 4.5m intervals",std:"IS 732:1989",m:1,c:0},
      {item:"Max 4 right-angle bends between boxes",std:"IS 732:1989",m:1,c:0},
      {item:"Fixed with saddle clamps max 600mm",std:"IS 732:1989",m:1,c:0},
      {item:"Separate conduits lighting/power",std:"IS 732:1989",m:1,c:0},
      {item:"Switch board heights: 1.2m general, 2.0m AC",std:"IS 732:1989",m:0,c:0}
    ]},
    { name:"Wiring & Distribution Board", completion:0, status:"pending", checklist:[
      {item:"Wire gauge: 1.5 sqmm lighting, 2.5 sqmm power",std:"IS 694:2010",m:1,c:0},
      {item:"Separate circuits per load type",std:"IS 732:1989",m:1,c:0},
      {item:"MCBs sized per circuit load",std:"IS 8828:1996",m:1,c:0},
      {item:"RCCB 30mA per floor/DB",std:"IS 12640:2000",m:1,c:0},
      {item:"Phase-neutral colour coding",std:"IS 732:1989",m:1,c:0},
      {item:"Insulation resistance min 1 MOhm",std:"IS 732:1989",m:1,c:0},
      {item:"DB at 1.5m from FFL",std:"IS 732:1989",m:1,c:0}
    ]},
    { name:"Earthing & Lightning Protection", completion:0, status:"pending", checklist:[
      {item:"Plate or pipe earthing per design",std:"IS 3043:2018",m:1,c:0},
      {item:"Earth resistance < 5 ohms (megger tested)",std:"IS 3043:2018",m:1,c:0},
      {item:"Earth pit accessible with CI frame",std:"IS 3043:2018",m:1,c:0},
      {item:"Earth continuity to all sockets",std:"IS 3043:2018",m:1,c:0},
      {item:"Lightning protection if > 15m height",std:"IS 2309:1989",m:0,c:0}
    ]},
    { name:"Plumbing - Water Supply", completion:0, status:"pending", checklist:[
      {item:"CPVC/PPR for hot, uPVC for cold",std:"IS 15778:2007",m:1,c:0},
      {item:"Pipe sizing per fixture unit calculation",std:"IS 2065:1983",m:1,c:0},
      {item:"Pressure tested at 1.5x for 30 min",std:"IS 2065:1983",m:1,c:0},
      {item:"Water meter at main entry",std:"IS 779:1994",m:1,c:0},
      {item:"Stop valves at each floor/room",std:"IS 1172:1993",m:1,c:0},
      {item:"Pipes concealed with protection",std:"Good Practice",m:1,c:0}
    ]},
    { name:"Plumbing - Drainage & Sewage", completion:0, status:"pending", checklist:[
      {item:"Drain pipes 100mm soil, 75mm waste",std:"IS 1742:1983",m:1,c:0},
      {item:"Gradient 1:60 for 100mm, 1:40 for 75mm",std:"IS 1742:1983",m:1,c:0},
      {item:"P-trap/S-trap with 50mm water seal",std:"IS 1742:1983",m:1,c:0},
      {item:"Vent pipe min 75mm, 1m above roof",std:"IS 1742:1983",m:1,c:0},
      {item:"Inspection chambers at direction changes",std:"IS 1742:1983",m:1,c:0},
      {item:"Smoke/water test for entire system",std:"IS 1742:1983",m:1,c:0},
      {item:"Septic tank/sewer per local norms",std:"IS 2470:1985",m:1,c:0}
    ]},
    { name:"Water Tank & Pump", completion:0, status:"pending", checklist:[
      {item:"OHT: 135 lpcd x persons x 1 day",std:"IS 1172:1993",m:1,c:0},
      {item:"Sump: min 1 day storage",std:"IS 1172:1993",m:1,c:0},
      {item:"Food-grade waterproofing inside",std:"IS 3370:2009",m:1,c:0},
      {item:"Ball valve, overflow, drain installed",std:"Good Practice",m:1,c:0},
      {item:"Pump matched to head and flow",std:"IS 9079:2002",m:1,c:0},
      {item:"Float switch/level controller",std:"Good Practice",m:0,c:0}
    ]}
  ],
  8: [
    { name:"Internal Wall Plastering", completion:0, status:"pending", checklist:[
      {item:"Surface cleaned, joints raked 10mm, wetted",std:"IS 2402:1963",m:1,c:0},
      {item:"CM 1:6 internal, CM 1:4 wet areas",std:"IS 2402:1963",m:1,c:0},
      {item:"Thickness 12mm single or 15-20mm two coat",std:"IS 2402:1963",m:1,c:0},
      {item:"Chicken mesh at RCC-brick junction",std:"Good Practice",m:1,c:0},
      {item:"True to plumb within +/-3mm per 1.5m",std:"IS 2402:1963",m:1,c:0},
      {item:"No hollow sound (good bond)",std:"IS 2402:1963",m:1,c:0},
      {item:"Neat cement finish on corners",std:"IS 2402:1963",m:0,c:0}
    ]},
    { name:"External Wall Plastering", completion:0, status:"pending", checklist:[
      {item:"CM 1:4 or 1:5 with waterproofing additive",std:"IS 2402:1963",m:1,c:0},
      {item:"Two-coat: first 12mm rough, second 8mm finish",std:"IS 2402:1963",m:1,c:0},
      {item:"Total thickness 18-20mm",std:"IS 2402:1963",m:1,c:0},
      {item:"Drip moulds at sills, chajjas, projections",std:"Good Practice",m:1,c:0},
      {item:"Safe scaffolding for external work",std:"IS 3696:1987",m:1,c:0},
      {item:"Grooves at floor line for crack control",std:"Good Practice",m:0,c:0}
    ]},
    { name:"Ceiling Plastering", completion:0, status:"pending", checklist:[
      {item:"Concrete hacked/roughened for adhesion",std:"IS 2402:1963",m:1,c:0},
      {item:"Thickness 6-8mm with CM 1:4",std:"IS 2402:1963",m:1,c:0},
      {item:"Cement slurry bonding agent on RCC",std:"IS 2402:1963",m:1,c:0},
      {item:"Level and flat, verified with straight edge",std:"IS 2402:1963",m:1,c:0},
      {item:"No sagging or undulations",std:"IS 2402:1963",m:1,c:0}
    ]},
    { name:"Curing of Plastered Surfaces", completion:0, status:"pending", checklist:[
      {item:"Curing started after initial set (6-8 hours)",std:"IS 2402:1963",m:1,c:0},
      {item:"Continuous curing min 7 days",std:"IS 2402:1963",m:1,c:0},
      {item:"External walls: wet gunny bags if needed",std:"IS 2402:1963",m:1,c:0},
      {item:"No premature drying / direct sunlight",std:"IS 2402:1963",m:1,c:0},
      {item:"Crack inspection after curing, patch if needed",std:"IS 2402:1963",m:1,c:0}
    ]}
  ],
  9: [
    { name:"Floor Base Preparation", completion:0, status:"pending", checklist:[
      {item:"Sub-base compacted to 95% MDD",std:"IS 2720-Part 8",m:1,c:0},
      {item:"PCC/screed 50mm min to correct level",std:"IS 456:2000",m:1,c:0},
      {item:"Level verified +/-3mm",std:"Site Drawing",m:1,c:0},
      {item:"Waterproofing in wet areas",std:"IS 3067:1988",m:1,c:0},
      {item:"Turned up on walls 150mm (300mm shower)",std:"IS 3067:1988",m:1,c:0},
      {item:"Ponding test 48 hours in wet areas",std:"IS 3067:1988",m:1,c:0}
    ]},
    { name:"Tile / Stone / Marble Laying", completion:0, status:"pending", checklist:[
      {item:"Tiles soaked min 30 minutes",std:"IS 13753:1993",m:1,c:0},
      {item:"Adhesive or CM 1:3 bed 20-25mm",std:"IS 13753:1993",m:1,c:0},
      {item:"Joints: 2mm vitrified, 3-5mm ceramic",std:"IS 13753:1993",m:1,c:0},
      {item:"All tiles tapped - no hollow spots",std:"IS 13753:1993",m:1,c:0},
      {item:"Slope towards drain min 1:100",std:"IS 13753:1993",m:1,c:0},
      {item:"Cuts neat at edges and fixtures",std:"Good Practice",m:1,c:0},
      {item:"Pattern as per approved drawing",std:"Site Drawing",m:1,c:0},
      {item:"Grout filled after 24 hours",std:"IS 13753:1993",m:1,c:0}
    ]},
    { name:"Skirting Installation", completion:0, status:"pending", checklist:[
      {item:"Height 100mm or per spec",std:"Site Drawing",m:1,c:0},
      {item:"Material matching floor tiles",std:"Site Drawing",m:1,c:0},
      {item:"Aligned level +/-2mm",std:"Good Practice",m:1,c:0},
      {item:"Joint sealed with sealant",std:"Good Practice",m:0,c:0}
    ]},
    { name:"Anti-Skid & Special Treatments", completion:0, status:"pending", checklist:[
      {item:"Anti-skid in wet areas",std:"NBC 2016 Cl. 11",m:1,c:0},
      {item:"Friction coefficient >= 0.5 wet areas",std:"IS 13753:1993",m:1,c:0},
      {item:"Expansion joints at 3-4m intervals",std:"IS 456:2000",m:0,c:0},
      {item:"Movement joints at thresholds",std:"Good Practice",m:0,c:0},
      {item:"Floor hardener/polish for marble",std:"Manufacturer Specs",m:0,c:0}
    ]}
  ],
  10: [
    { name:"Painting - Primer, Putty & Final", completion:0, status:"pending", checklist:[
      {item:"Surface cleaned of loose particles",std:"IS 2395:1994",m:1,c:0},
      {item:"Alkali-resistant primer applied",std:"IS 2395:1994 Part 1",m:1,c:0},
      {item:"Wall putty 2 coats max 1.5mm each",std:"Manufacturer Specs",m:1,c:0},
      {item:"Sanded smooth between coats",std:"IS 2395:1994",m:1,c:0},
      {item:"Min 2 coats emulsion interior",std:"IS 15489:2004",m:1,c:0},
      {item:"External: primer + 2 coats exterior",std:"IS 15489:2004",m:1,c:0},
      {item:"Enamel on MS/wood: primer + 2 coats",std:"IS 2932:1993",m:1,c:0},
      {item:"Coverage per spec, no brush marks",std:"IS 2395:1994",m:1,c:0}
    ]},
    { name:"Door & Window Installation", completion:0, status:"pending", checklist:[
      {item:"Frame plumb and square, diagonal diff <= 3mm",std:"IS 4021:1995",m:1,c:0},
      {item:"Main door min 1.0m x 2.1m",std:"NBC 2016 Cl. 8.3",m:1,c:0},
      {item:"Holdfast min 100mm in wall, 3 per side",std:"IS 4021:1995",m:1,c:0},
      {item:"Window frames level, plumb, secure",std:"IS 1361:1978",m:1,c:0},
      {item:"Shutters operate smoothly, 3mm clearance",std:"IS 4021:1995",m:1,c:0},
      {item:"All hardware fitted and functional",std:"IS 3564:1996",m:1,c:0},
      {item:"Window glazing min 4mm glass",std:"IS 2553:1989",m:1,c:0},
      {item:"Sealant around all frames",std:"Good Practice",m:1,c:0}
    ]},
    { name:"Kitchen Platform & Fittings", completion:0, status:"pending", checklist:[
      {item:"Platform height 850-900mm from FFL",std:"NBC 2016",m:1,c:0},
      {item:"RCC/prefab with granite/marble finish",std:"Site Drawing",m:1,c:0},
      {item:"Sink cutout with slope to drain",std:"IS 2548:1966",m:1,c:0},
      {item:"Waterproofing below sink area",std:"Good Practice",m:1,c:0},
      {item:"Gas pipe and exhaust provision",std:"IS 8423:1987",m:1,c:0},
      {item:"Dedicated 15A power points",std:"IS 732:1989",m:1,c:0}
    ]},
    { name:"Bathroom Fittings & Fixtures", completion:0, status:"pending", checklist:[
      {item:"WC fixed at correct height, secured",std:"IS 2556:2004",m:1,c:0},
      {item:"Wash basin at 800mm, level and secure",std:"IS 2556:2004",m:1,c:0},
      {item:"All taps tested leak-free",std:"IS 8931:2003",m:1,c:0},
      {item:"Floor trap at lowest point",std:"IS 1742:1983",m:1,c:0},
      {item:"Shower: mixer 1.1m, head 2.0m",std:"Good Practice",m:1,c:0},
      {item:"Accessories installed at standard heights",std:"Good Practice",m:0,c:0},
      {item:"All waste connections verified",std:"IS 1742:1983",m:1,c:0}
    ]},
    { name:"Electrical Fixture Installation", completion:0, status:"pending", checklist:[
      {item:"All switches/sockets at standard heights",std:"IS 732:1989",m:1,c:0},
      {item:"Switch 1.2m general, 2.0m AC/geyser",std:"IS 732:1989",m:1,c:0},
      {item:"Socket 300mm general, 1.2m kitchen",std:"IS 732:1989",m:1,c:0},
      {item:"5A for lighting, 15A for power",std:"IS 732:1989",m:1,c:0},
      {item:"All lights installed and operational",std:"IS 732:1989",m:1,c:0},
      {item:"Fan hooks tested 3x weight",std:"IS 732:1989",m:1,c:0},
      {item:"Final circuit testing complete",std:"IS 732:1989",m:1,c:0},
      {item:"Electrical completion certificate",std:"Indian Electricity Rules",m:1,c:0}
    ]},
    { name:"Final Plumbing Fixtures & Testing", completion:0, status:"pending", checklist:[
      {item:"All supply points adequate pressure",std:"IS 1172:1993",m:1,c:0},
      {item:"Hot water system installed and tested",std:"IS 2082:1993",m:1,c:0},
      {item:"All drains tested - no blockages",std:"IS 1742:1983",m:1,c:0},
      {item:"Tank float valves operational",std:"Good Practice",m:1,c:0},
      {item:"Pump auto controller tested",std:"Good Practice",m:1,c:0},
      {item:"No leaks at any joint",std:"IS 1742:1983",m:1,c:0}
    ]}
  ],
  11: [
    { name:"Pre-Handover Inspection & Snag List", completion:0, status:"pending", checklist:[
      {item:"Complete walk-through all rooms and external",std:"Good Practice",m:1,c:0},
      {item:"Snag list with photo documentation",std:"Good Practice",m:1,c:0},
      {item:"All doors/windows checked for operation",std:"IS 4021:1995",m:1,c:0},
      {item:"All switches/sockets/lights tested",std:"IS 732:1989",m:1,c:0},
      {item:"All plumbing points tested",std:"IS 1742:1983",m:1,c:0},
      {item:"Tile condition checked",std:"IS 13753:1993",m:1,c:0},
      {item:"Paint finish inspected",std:"IS 2395:1994",m:1,c:0},
      {item:"External areas checked",std:"Site Drawing",m:1,c:0}
    ]},
    { name:"Snag Rectification", completion:0, status:"pending", checklist:[
      {item:"All snags assigned with deadline",std:"Good Practice",m:1,c:0},
      {item:"Each item re-inspected and signed off",std:"Good Practice",m:1,c:0},
      {item:"Paint touch-up completed",std:"IS 2395:1994",m:1,c:0},
      {item:"Final cleaning after snag work",std:"Good Practice",m:1,c:0},
      {item:"Zero open snags before handover",std:"Good Practice",m:1,c:0}
    ]},
    { name:"Testing & Commissioning", completion:0, status:"pending", checklist:[
      {item:"Complete electrical testing: IR, earth, load",std:"IS 732:1989",m:1,c:0},
      {item:"Plumbing pressure test 1.5x for 30 min",std:"IS 2065:1983",m:1,c:0},
      {item:"Drainage flow test all points",std:"IS 1742:1983",m:1,c:0},
      {item:"Pump and tank automation tested",std:"Good Practice",m:1,c:0},
      {item:"Fire extinguishers installed",std:"NBC 2016 Part 4",m:1,c:0},
      {item:"Lifts tested and certified if applicable",std:"IS 14665:2000",m:0,c:0}
    ]},
    { name:"Documentation & Certificates", completion:0, status:"pending", checklist:[
      {item:"Completion certificate obtained",std:"Local Building Act",m:1,c:0},
      {item:"Occupancy certificate obtained",std:"Local Building Act",m:1,c:0},
      {item:"Electrical completion certificate",std:"Indian Electricity Rules",m:1,c:0},
      {item:"Structural stability certificate",std:"Local Authority",m:1,c:0},
      {item:"As-built drawings prepared",std:"Good Practice",m:1,c:0},
      {item:"Material test reports compiled",std:"Good Practice",m:1,c:0},
      {item:"Warranty documents handed over",std:"Good Practice",m:1,c:0},
      {item:"Vendor contact list provided",std:"Good Practice",m:0,c:0}
    ]},
    { name:"Formal Handover to Owner", completion:0, status:"pending", checklist:[
      {item:"All keys handed over with register",std:"Good Practice",m:1,c:0},
      {item:"Owner walk-through with PM",std:"Good Practice",m:1,c:0},
      {item:"User manuals for all equipment",std:"Good Practice",m:1,c:0},
      {item:"Maintenance schedule document",std:"Good Practice",m:0,c:0},
      {item:"Defect liability period communicated",std:"Contract Terms",m:1,c:0},
      {item:"Formal handover document signed",std:"Good Practice",m:1,c:0}
    ]}
  ]
};

const insertSubstage = db.prepare('INSERT INTO substages (stage_id,name,substage_order,completion,status) VALUES (?,?,?,?,?)');
const insertChecklist = db.prepare('INSERT INTO checklist_items (substage_id,item_order,description,standard_ref,is_mandatory,is_checked) VALUES (?,?,?,?,?,?)');

let totalSS = 0, totalCL = 0;
for (const [stageOrder, substages] of Object.entries(STAGE_DETAILS)) {
  const stageId = parseInt(stageOrder);
  substages.forEach((ss, ssIdx) => {
    const ssResult = insertSubstage.run(stageId, ss.name, ssIdx + 1, ss.completion, ss.status);
    const ssId = ssResult.lastInsertRowid;
    totalSS++;
    ss.checklist.forEach((cl, clIdx) => {
      insertChecklist.run(ssId, clIdx + 1, cl.item, cl.std, cl.m, cl.c);
      totalCL++;
    });
  });
}
console.log(`  Inserted ${totalSS} substages, ${totalCL} checklist items`);

// ===== VENDORS =====
console.log('Seeding vendors...');
const insertVendor = db.prepare('INSERT INTO vendors (name,type,rating,status,phone,project_id) VALUES (?,?,?,?,?,?)');
insertVendor.run('Ambuja Cement Dealers','Supplier',4.2,'Active','9876543210',1);
insertVendor.run('Raj Steel Traders','Supplier',4.5,'Active','9876543211',1);
insertVendor.run('MK Construction Co.','Contractor',3.8,'Active','9876543212',1);
insertVendor.run('Gupta Electricals','Subcontractor',4.0,'Active','9876543213',1);
insertVendor.run('Sharma Plumbing Works','Subcontractor',3.5,'Active','9876543214',1);

// ===== MATERIAL REQUESTS =====
console.log('Seeding material requests...');
const insertMR = db.prepare('INSERT INTO material_requests (request_code,material,quantity,stage_id,status,requested_date,requested_by) VALUES (?,?,?,?,?,?,?)');
insertMR.run('MR-001','TMT Steel 12mm','500 kg',4,'Delivered','2026-01-15',3);
insertMR.run('MR-002','OPC Cement 53 Grade','200 bags',4,'Approved','2026-02-10',3);
insertMR.run('MR-003','River Sand','20 units',4,'Pending','2026-02-18',3);
insertMR.run('MR-004','M20 Concrete','30 cum',4,'Ordered','2026-02-12',5);
insertMR.run('MR-005','Bricks (Class A)','10000 pcs',5,'Pending','2026-02-19',3);

// ===== DAILY LOGS =====
console.log('Seeding daily logs...');
const insertDL = db.prepare('INSERT INTO daily_logs (project_id,log_date,weather,work_description,labor_count,issues,logged_by) VALUES (?,?,?,?,?,?,?)');
insertDL.run(1,'2026-02-20','Sunny','Column casting 2nd floor - 4 columns completed. Formwork for beam B3-B6.',18,'Minor delay in rebar delivery',3);
insertDL.run(1,'2026-02-19','Partly Cloudy','Slab reinforcement 1st floor 70% done. Plumbing sleeves placed.',22,'None',3);
insertDL.run(1,'2026-02-18','Sunny','Column rebar tying for 2nd floor. Curing of 1st floor slab.',20,'Water supply interrupted 2 hours',3);

// ===== INSPECTIONS =====
console.log('Seeding inspections...');
const insertInsp = db.prepare('INSERT INTO inspections (inspection_code,project_id,stage_id,type,category,inspection_date,inspector_id,status,result,defect_count,notes,location,standard_ref,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

// Project 1 inspections
insertInsp.run('INS-001',1,3,'Foundation Check','hold_point','2025-12-14',7,'Completed','Pass',0,'Foundation PCC and footing dimensions verified. All within permissible limits per IS 456.','Block A - Foundation','IS 456:2000',2);
insertInsp.run('INS-002',1,3,'Soil Bearing','hold_point','2025-12-10',7,'Completed','Pass',0,'Plate load test results satisfactory. SBC = 18 T/sqm as per geotechnical report.','Block A - Site','IS 1904:1986',2);
insertInsp.run('INS-003',1,4,'Concrete Cube Test','hold_point','2026-02-05',7,'Completed','Conditional',2,'7-day cube test: 22.5 MPa (target 25 MPa). 28-day retest required. Honeycombing found in C3.','Block A - 1st Floor','IS 456:2000',2);
insertInsp.run('INS-004',1,4,'Rebar Inspection','hold_point','2026-02-10',7,'Completed','Pass',0,'Rebar spacing and cover verified for columns C1-C8. Lap length per SP 34.','Block A - 2nd Floor Columns','SP 34:1987',2);
insertInsp.run('INS-005',1,4,'Formwork Check','witness_point','2026-02-15',7,'Completed','Fail',1,'Beam B2-B3 formwork misaligned by 15mm. Propping inadequate at 2 locations.','Block A - 2nd Floor Beams','IS 14687:1999',2);
insertInsp.run('INS-006',1,4,'Concrete Pour','hold_point','2026-02-20',7,'In Progress',null,0,'Pre-pour checklist for 2nd floor slab. Slump test in progress.','Block A - 2nd Floor Slab','IS 456:2000',2);
insertInsp.run('INS-007',1,4,'Safety Audit','surveillance','2026-02-22',7,'Scheduled',null,0,null,'Full Site','IS 3764:1992',2);
insertInsp.run('INS-008',1,5,'Brick Quality','hold_point','2026-03-01',7,'Scheduled',null,0,null,'Block A - External Walls','IS 1077:1992',2);

// Project 2 inspections
insertInsp.run('INS-009',2,14,'Foundation Check','hold_point','2026-01-20',7,'Completed','Pass',0,'Raft foundation dimensions and reinforcement verified.','Tower A - Foundation','IS 456:2000',2);
insertInsp.run('INS-010',2,14,'Waterproofing','witness_point','2026-01-28',7,'Completed','Conditional',1,'Waterproofing membrane application checked. Overlap joints need re-sealing at 3 locations.','Tower A - Basement','IS 3067:1988',2);
insertInsp.run('INS-011',2,15,'Concrete Grade Test','hold_point','2026-02-12',7,'Completed','Pass',0,'M30 concrete cube test - 28 day results: 34.2 MPa. Satisfactory.','Tower A - Ground Floor','IS 456:2000',2);
insertInsp.run('INS-012',2,15,'Structural Alignment','hold_point','2026-02-25',7,'Scheduled',null,0,null,'Tower A - 1st Floor','IS 456:2000',2);

// ===== DEFECTS =====
console.log('Seeding defects...');
const insertDef = db.prepare('INSERT INTO defects (defect_code,inspection_id,project_id,description,severity,status,category,location,assigned_to,due_date,resolution_notes,resolved_by,resolved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');

// Defects from INS-003 (concrete cube test)
insertDef.run('DEF-001',3,1,'Honeycombing observed in column C3 at 1st floor level. Approx 200mm x 150mm area affected.','High','In Progress','Structural','Column C3 - 1st Floor','MK Construction Co.','2026-02-28',null,null,null);
insertDef.run('DEF-002',3,1,'Cold joint visible in beam B2-B3 junction due to delayed pour continuation.','Medium','Open','Structural','Beam B2-B3 Junction - 1st Floor','MK Construction Co.','2026-03-05',null,null,null);

// Defect from INS-005 (formwork)
insertDef.run('DEF-003',5,1,'Beam formwork misaligned by 15mm at B2-B3 span. Affects cover to reinforcement.','High','Resolved','Workmanship','Block A - 2nd Floor Beams','MK Construction Co.','2026-02-18','Formwork stripped, realigned and re-fixed. Verified by site engineer.',3,'2026-02-17');
insertDef.run('DEF-004',5,1,'Inadequate propping under beam soffit - only single props used instead of double.','Medium','Resolved','Safety','Block A - 2nd Floor Beams','MK Construction Co.','2026-02-18','Additional props installed. Load distribution checked.',3,'2026-02-16');

// Defect from INS-010 (waterproofing)
insertDef.run('DEF-005',10,2,'Waterproofing membrane overlap insufficient at 3 joint locations in basement wall.','Medium','Open','Waterproofing','Tower A - Basement Walls','SubCon Waterproofing','2026-02-10',null,null,null);

// Standalone defects (found outside formal inspection)
insertDef.run('DEF-006',null,1,'Exposed rebar at column C5 base - cover block displaced during pour.','Low','Open','Workmanship','Column C5 - Ground Floor','MK Construction Co.','2026-03-10',null,null,null);
insertDef.run('DEF-007',null,1,'Curing not maintained for slab S2 - dry patches observed after 3 days.','Medium','Resolved','Workmanship','Block A - 1st Floor Slab','MK Construction Co.','2026-02-12','Ponding curing resumed. 7-day curing completed satisfactorily.',3,'2026-02-14');

// ===== EXPENSES =====
console.log('Seeding expenses...');
const insertExp = db.prepare('INSERT INTO expenses (expense_date,category,description,amount,stage_id,status,created_by) VALUES (?,?,?,?,?,?,?)');
insertExp.run('2026-02-18','Material','TMT Steel 12mm - 500kg',225000,4,'Posted',6);
insertExp.run('2026-02-15','Labor','Mason team wages - Week 6',48000,4,'Approved',6);
insertExp.run('2026-02-12','Material','OPC Cement 200 bags',72000,4,'Pending',6);
insertExp.run('2026-02-10','Equipment','Crane rental - 3 days',36000,4,'Posted',6);
insertExp.run('2026-02-08','Labor','Electrician advance',15000,7,'Approved',6);

// ===== PAYMENTS =====
console.log('Seeding payments...');
const insertPay = db.prepare('INSERT INTO payments (payment_code,vendor_id,stage_id,amount,status,payment_date) VALUES (?,?,?,?,?,?)');
insertPay.run('PAY-001',3,3,450000,'Paid','2025-12-20');
insertPay.run('PAY-002',3,4,350000,'Under Review','2026-02-15');
insertPay.run('PAY-003',1,4,225000,'Approved','2026-02-18');
insertPay.run('PAY-004',4,7,80000,'Draft','2026-02-20');

// ===== INVENTORY =====
console.log('Seeding inventory...');
const insertInv = db.prepare('INSERT INTO inventory (material,unit,total_inward,consumed,stock,wastage_percent,project_id) VALUES (?,?,?,?,?,?,?)');
insertInv.run('OPC Cement 53 Grade','bags',400,310,90,2.3,1);
insertInv.run('TMT Steel 12mm','kg',1200,980,220,1.8,1);
insertInv.run('River Sand','units',45,38,7,3.1,1);
insertInv.run('M20 Concrete','cum',60,52,8,1.2,1);
insertInv.run('Bricks Class A','pcs',15000,14200,800,4.5,1);

// ===== AUDIT LOG =====
console.log('Seeding audit log...');
const insertAudit = db.prepare('INSERT INTO audit_log (project_id,timestamp,entity,entity_id,from_state,to_state,action,user_display,details,type) VALUES (?,?,?,?,?,?,?,?,?,?)');
const auditData = [
  [1,'2026-02-20 14:30','Stage','Structure','In Progress','In Progress','Task Updated','Ramesh K. (SE)','Column casting 2F - 4 columns completed','info'],
  [1,'2026-02-20 10:15','Material Request','MR-003','Draft','Submitted','Request Submitted','Ramesh K. (SE)','River Sand - 20 units for Structure stage','info'],
  [1,'2026-02-19 16:45','Payment','PAY-002','Submitted','Under Review','Auto Budget Check','System','Budget check passed. Forwarded for owner review.','warning'],
  [1,'2026-02-18 11:20','Expense','EXP-001','Approved','Posted','Expense Posted','Accounts (AC)','TMT Steel 12mm - Rs.2,25,000 posted to ledger','success'],
  [1,'2026-02-15 09:00','Material Request','MR-002','Submitted','Approved','PM Approved','PM','OPC Cement 200 bags - Budget available, approved','success'],
  [1,'2026-02-12 14:10','Purchase Order','PO-2026-003','Created','Issued','PO Issued','Procurement (PR)','TMT Steel 16mm to Raj Steel Traders','info'],
  [1,'2026-02-10 10:00','Inspection','INS-002','In Progress','Conditional','Conditional Pass','Vijay R. (QI)','Structure - 1 defect: honeycombing in column C3','warning'],
  [1,'2026-02-05 16:00','Defect','DEF-001','Open','Assigned','Defect Assigned','PM','Honeycombing in C3 assigned to MK Construction Co.','danger'],
  [1,'2025-12-15 12:00','Stage','Foundation','Inspection Pending','Completed','Inspection Passed','Vijay R. (QI)','All checks passed. Stage completed.','success'],
  [1,'2025-12-14 14:30','Stage','Foundation','In Progress','Inspection Pending','Ready for Inspection','Ramesh K. (SE)','Tasks >= 95%. Mandatory checklists completed.','info'],
  [1,'2025-10-20 10:00','Project','Kumar Villa','Budget Pending','Active','Budget Approved','Mr. Kumar (Owner)','Total budget Rs.85,00,000 approved.','success'],
  [1,'2025-09-01 09:00','Project','Kumar Villa','Draft','Budget Pending','BOQ Uploaded','PM','Detailed BOQ with 11 stages prepared and uploaded.','info'],
];
for (const a of auditData) insertAudit.run(...a);

// ===== SP62 CHAPTERS =====
console.log('Seeding SP62 chapter references...');
const insertSP62 = db.prepare('INSERT INTO sp62_chapters (stage_id,chapter_number,title,note) VALUES (?,?,?,?)');
const sp62Data = [
  [1,1,'Construction Planning & Storage of Materials','PERT/CPM techniques for project scheduling. Safe storage of cement, steel, sand, aggregates.'],
  [3,2,'Earthwork','Soil classification per IS standards. Excavation for various depths. Shoring, timbering, dewatering.'],
  [3,3,'Foundations','Construction of shallow, deep, spread and strip foundations. Pile foundations.'],
  [3,6,'Anti-termite Measures','Chemical barrier methods, design criteria for anti-termite shields.'],
  [4,5,'Plain and Reinforced Concrete','Cement concrete materials, grades, production. Formwork, reinforcement placement per IS 456.'],
  [4,8,'Steel Construction','Hot rolled sections, tubular sections. Rivets, bolts, welding. Shop and site erection.'],
  [4,17,'Special Construction - Earthquake Effects','Construction procedures for earthquake resistance. Seismic zone categorization.'],
  [5,4,'Masonry','Mortars, brickwork bonds, blockwork, stonework. Laying procedures, joint thickness.'],
  [6,11,'Roofs and Roofing','Flat roofs, sloping roofs, shell roofs. Precast roofing elements.'],
  [6,12,'Damp-Proofing and Waterproofing','Surface preparation. Damp-proofing and waterproofing materials and methods.'],
  [7,7,'Doors and Windows (Wood and Metal)','Timber classification. Wooden/steel/aluminium frames, shutters. Hardware fittings.'],
  [7,16,'Water Supply and Drainage','Piping, potable water, pipe laying. Waste water, sewage, storm drainage.'],
  [8,10,'Wall and Ceiling Finishes','Lime plaster, cement plaster. External finishes, facing, veneers.'],
  [8,13,'Joints in Buildings','Expansion/contraction joints. Crack prevention through proper joint design.'],
  [9,9,'Floors and Floor Coverings','Brick floors, cement concrete floors, terrazzo, special floors, timber floors.'],
  [10,14,'Whitewashing, Colour Washing & Painting','Surface preparation. Painting calcareous surfaces. Primer, undercoat, finishing.'],
  [10,15,'Painting, Varnishing & Allied Finishes','Timber priming, surface prep. Ferrous and non-ferrous metal finishing.'],
  [10,7,'Doors and Windows (Installation)','Frame installation, shutters, hardware fittings. Glazing per IS 2553.'],
  [11,13,'Joints in Buildings','Crack control verification at handover stage.'],
  [11,1,'Construction Planning','Final documentation, as-built drawing preparation, completion procedures.'],
];
for (const s of sp62Data) insertSP62.run(...s);

// ===== TASKS (with subtasks) =====
console.log('Seeding tasks with subtasks...');
const insertTaskSeed = db.prepare('INSERT INTO tasks (task_code,stage_id,parent_task_id,title,description,assigned_to,status,priority,is_default,start_date,due_date,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
let tNum = 1;
const tCode = () => `T-${String(tNum++).padStart(3,'0')}`;

// ====================================
// PLANNING & DESIGN (stage 1) - Completed
// ====================================

// 1. Preliminary Feasibility & Site Assessment
const t1 = tNum; insertTaskSeed.run(tCode(),1,null,'Preliminary feasibility study and site assessment','Verify land records, assess site conditions and check DCR compliance',2,'completed','high',1,'2025-07-01','2025-07-15',2);
insertTaskSeed.run(tCode(),1,t1,'Verify land ownership documents and title deed clearance',null,2,'completed','high',1,'2025-07-01','2025-07-03',2);
insertTaskSeed.run(tCode(),1,t1,'Collect property survey number, village map and revenue records',null,2,'completed','high',1,'2025-07-01','2025-07-03',2);
insertTaskSeed.run(tCode(),1,t1,'Assess site access roads, approach width and connectivity',null,3,'completed','medium',1,'2025-07-03','2025-07-05',2);
insertTaskSeed.run(tCode(),1,t1,'Study local DCR — FAR/FSI, ground coverage, height limits and setbacks',null,2,'completed','high',1,'2025-07-05','2025-07-08',2);
insertTaskSeed.run(tCode(),1,t1,'Assess municipal water supply and sewage connection availability',null,3,'completed','medium',1,'2025-07-08','2025-07-10',2);
insertTaskSeed.run(tCode(),1,t1,'Check electrical power availability and nearest transformer capacity',null,3,'completed','medium',1,'2025-07-08','2025-07-10',2);
insertTaskSeed.run(tCode(),1,t1,'Evaluate neighborhood context — adjoining structures and party walls',null,3,'completed','medium',1,'2025-07-10','2025-07-12',2);
insertTaskSeed.run(tCode(),1,t1,'Prepare preliminary feasibility report with risk assessment',null,2,'completed','high',1,'2025-07-12','2025-07-15',2);

// 2. Topographic Survey & Site Mapping
const t2 = tNum; insertTaskSeed.run(tCode(),1,null,'Topographic survey and site mapping','Conduct total station survey, establish benchmarks and prepare site plan',3,'completed','high',1,'2025-07-10','2025-07-25',2);
insertTaskSeed.run(tCode(),1,t2,'Engage licensed surveyor for total station / GPS survey',null,2,'completed','high',1,'2025-07-10','2025-07-12',2);
insertTaskSeed.run(tCode(),1,t2,'Conduct topographical survey with contour mapping at 0.5m intervals (IS 1892)',null,3,'completed','high',1,'2025-07-12','2025-07-16',2);
insertTaskSeed.run(tCode(),1,t2,'Mark plot boundaries with permanent stones and GPS coordinates',null,3,'completed','high',1,'2025-07-16','2025-07-18',2);
insertTaskSeed.run(tCode(),1,t2,'Record existing trees, utility lines, manholes and overhead cables',null,3,'completed','medium',1,'2025-07-16','2025-07-18',2);
insertTaskSeed.run(tCode(),1,t2,'Establish site bench mark (BM) and temporary bench marks (TBM)',null,3,'completed','high',1,'2025-07-18','2025-07-19',2);
insertTaskSeed.run(tCode(),1,t2,'Measure and document road levels at plot entry points',null,3,'completed','medium',1,'2025-07-18','2025-07-20',2);
insertTaskSeed.run(tCode(),1,t2,'Note natural drainage patterns, slope direction and water flow',null,3,'completed','medium',1,'2025-07-19','2025-07-21',2);
insertTaskSeed.run(tCode(),1,t2,'Prepare site plan with north direction, dimensions and spot levels',null,3,'completed','high',1,'2025-07-21','2025-07-25',2);

// 3. Geotechnical Investigation
const t3 = tNum; insertTaskSeed.run(tCode(),1,null,'Geotechnical investigation and soil testing','Bore holes, SPT, lab testing and SBC determination',3,'completed','high',1,'2025-07-15','2025-08-05',2);
insertTaskSeed.run(tCode(),1,t3,'Engage geotechnical consultant and plan borehole locations',null,2,'completed','high',1,'2025-07-15','2025-07-17',2);
insertTaskSeed.run(tCode(),1,t3,'Conduct soil boring at min 2 locations per 200 sqm (IS 1892:1979)',null,3,'completed','high',1,'2025-07-17','2025-07-22',2);
insertTaskSeed.run(tCode(),1,t3,'Perform SPT at every 1.5m depth (IS 2131:1981)',null,3,'completed','high',1,'2025-07-17','2025-07-22',2);
insertTaskSeed.run(tCode(),1,t3,'Collect undisturbed soil samples for laboratory testing',null,3,'completed','high',1,'2025-07-22','2025-07-24',2);
insertTaskSeed.run(tCode(),1,t3,'Conduct grain size analysis and soil classification (IS 1498:1970)',null,3,'completed','high',1,'2025-07-24','2025-07-27',2);
insertTaskSeed.run(tCode(),1,t3,'Test natural moisture content, bulk density and Atterberg limits',null,3,'completed','medium',1,'2025-07-24','2025-07-27',2);
insertTaskSeed.run(tCode(),1,t3,'Record groundwater table level and seasonal variation',null,3,'completed','medium',1,'2025-07-22','2025-07-25',2);
insertTaskSeed.run(tCode(),1,t3,'Conduct chemical analysis — sulphates, chlorides, pH (IS 2720-Part 26)',null,3,'completed','medium',1,'2025-07-27','2025-07-30',2);
insertTaskSeed.run(tCode(),1,t3,'Determine SBC with FOS >= 2.5 (IS 6403:1981)',null,3,'completed','high',1,'2025-07-28','2025-08-01',2);
insertTaskSeed.run(tCode(),1,t3,'Prepare geotechnical investigation report with foundation recommendations',null,3,'completed','high',1,'2025-08-01','2025-08-05',2);

// 4. Architectural Planning & Concept Design
const t4 = tNum; insertTaskSeed.run(tCode(),1,null,'Architectural planning and concept design','Client brief, concept layouts, NBC compliance and scheme finalization',2,'completed','high',1,'2025-07-20','2025-08-10',2);
insertTaskSeed.run(tCode(),1,t4,'Gather detailed client brief — rooms, lifestyle, budget range',null,2,'completed','high',1,'2025-07-20','2025-07-23',2);
insertTaskSeed.run(tCode(),1,t4,'Study vastu/orientation preferences and sun path analysis',null,2,'completed','medium',1,'2025-07-23','2025-07-25',2);
insertTaskSeed.run(tCode(),1,t4,'Prepare 2-3 concept layout options with bubble diagrams',null,2,'completed','high',1,'2025-07-25','2025-07-30',2);
insertTaskSeed.run(tCode(),1,t4,'Design floor plans — habitable >= 9.5 sqm, kitchen >= 5 sqm (NBC Cl. 8.2)',null,2,'completed','high',1,'2025-07-30','2025-08-03',2);
insertTaskSeed.run(tCode(),1,t4,'Verify ceiling heights — 2.75m habitable, 2.4m non-habitable (NBC Cl. 8.4)',null,2,'completed','high',1,'2025-07-30','2025-08-03',2);
insertTaskSeed.run(tCode(),1,t4,'Plan staircase — width >= 1m, riser <= 190mm, tread >= 250mm (NBC Cl. 8.7)',null,2,'completed','high',1,'2025-08-01','2025-08-04',2);
insertTaskSeed.run(tCode(),1,t4,'Present concept options and finalize preferred scheme with client',null,2,'completed','high',1,'2025-08-05','2025-08-10',2);

// 5. Detailed Architectural Drawings
const t5 = tNum; insertTaskSeed.run(tCode(),1,null,'Detailed architectural drawing preparation','Complete working drawings — plans, sections, elevations, schedules',2,'completed','high',1,'2025-08-05','2025-08-25',2);
insertTaskSeed.run(tCode(),1,t5,'Prepare detailed floor plans for all levels with dimensions',null,2,'completed','high',1,'2025-08-05','2025-08-10',2);
insertTaskSeed.run(tCode(),1,t5,'Draw cross-sections (min 2) showing floor heights, slab levels, foundation',null,2,'completed','high',1,'2025-08-10','2025-08-13',2);
insertTaskSeed.run(tCode(),1,t5,'Prepare all four elevation drawings with material finishes indicated',null,2,'completed','high',1,'2025-08-10','2025-08-14',2);
insertTaskSeed.run(tCode(),1,t5,'Prepare door and window schedule with sizes, types and materials',null,2,'completed','medium',1,'2025-08-14','2025-08-16',2);
insertTaskSeed.run(tCode(),1,t5,'Draw detailed kitchen layout with platform, sink and appliance positions',null,2,'completed','medium',1,'2025-08-14','2025-08-17',2);
insertTaskSeed.run(tCode(),1,t5,'Design bathroom layouts with fixture positions and drainage slopes',null,2,'completed','medium',1,'2025-08-14','2025-08-17',2);
insertTaskSeed.run(tCode(),1,t5,'Prepare site plan with landscaping, driveway and compound wall layout',null,2,'completed','medium',1,'2025-08-17','2025-08-20',2);
insertTaskSeed.run(tCode(),1,t5,'Include area statement — carpet, built-up, super built-up and FAR calculation',null,2,'completed','high',1,'2025-08-20','2025-08-22',2);
insertTaskSeed.run(tCode(),1,t5,'Prepare 3D visualization / walkthrough for client review',null,2,'completed','medium',1,'2025-08-20','2025-08-25',2);

// 6. Structural Engineering Design
const t6 = tNum; insertTaskSeed.run(tCode(),1,null,'Structural engineering design and analysis','Complete structural analysis and member design per IS 456, IS 1893',3,'completed','high',1,'2025-08-10','2025-09-05',2);
insertTaskSeed.run(tCode(),1,t6,'Determine structural system — RCC frame, concrete grade M20/M25, steel Fe 500D',null,3,'completed','high',1,'2025-08-10','2025-08-12',2);
insertTaskSeed.run(tCode(),1,t6,'Calculate dead loads per IS 875-Part 1 and live loads per IS 875-Part 2',null,3,'completed','high',1,'2025-08-12','2025-08-15',2);
insertTaskSeed.run(tCode(),1,t6,'Perform seismic analysis per IS 1893:2016 — zone factor, response reduction',null,3,'completed','high',1,'2025-08-15','2025-08-18',2);
insertTaskSeed.run(tCode(),1,t6,'Perform wind load analysis based on basic wind speed (IS 875:2015 Part 3)',null,3,'completed','high',1,'2025-08-15','2025-08-18',2);
insertTaskSeed.run(tCode(),1,t6,'Run structural analysis using ETABS/STAAD for all load combinations',null,3,'completed','high',1,'2025-08-18','2025-08-22',2);
insertTaskSeed.run(tCode(),1,t6,'Design footings based on SBC and load calculations (IS 456)',null,3,'completed','high',1,'2025-08-22','2025-08-25',2);
insertTaskSeed.run(tCode(),1,t6,'Design columns — check slenderness, steel 0.8-4% (IS 456 Cl. 26.5.3)',null,3,'completed','high',1,'2025-08-22','2025-08-26',2);
insertTaskSeed.run(tCode(),1,t6,'Design beams for flexure, shear and deflection span/250 (IS 456 Cl. 23.2)',null,3,'completed','high',1,'2025-08-25','2025-08-28',2);
insertTaskSeed.run(tCode(),1,t6,'Design slabs — bending, shear, deflection, min thickness 120mm',null,3,'completed','high',1,'2025-08-25','2025-08-28',2);
insertTaskSeed.run(tCode(),1,t6,'Apply ductile detailing per IS 13920:2016 at beam-column junctions',null,3,'completed','high',1,'2025-08-28','2025-09-01',2);
insertTaskSeed.run(tCode(),1,t6,'Prepare structural design report with assumptions, calculations, conclusions',null,3,'completed','high',1,'2025-09-01','2025-09-05',2);

// 7. Structural Drawings & Detailing
const t7 = tNum; insertTaskSeed.run(tCode(),1,null,'Structural drawing preparation and detailing','Foundation layout, reinforcement details, BBS per SP 34:1987',3,'completed','high',1,'2025-08-28','2025-09-15',2);
insertTaskSeed.run(tCode(),1,t7,'Prepare foundation layout plan with footing sizes and pedestal locations',null,3,'completed','high',1,'2025-08-28','2025-09-01',2);
insertTaskSeed.run(tCode(),1,t7,'Draw footing reinforcement details — bottom mat, top mat, cover 50mm',null,3,'completed','high',1,'2025-08-30','2025-09-02',2);
insertTaskSeed.run(tCode(),1,t7,'Prepare column schedule — sizes, main bars, ties spacing per floor',null,3,'completed','high',1,'2025-09-01','2025-09-04',2);
insertTaskSeed.run(tCode(),1,t7,'Draw beam schedule — sizes, top/bottom reinforcement, stirrup spacing',null,3,'completed','high',1,'2025-09-02','2025-09-05',2);
insertTaskSeed.run(tCode(),1,t7,'Prepare slab reinforcement layout — main, distribution, extra bars at supports',null,3,'completed','high',1,'2025-09-04','2025-09-07',2);
insertTaskSeed.run(tCode(),1,t7,'Draw staircase and lintel reinforcement details',null,3,'completed','medium',1,'2025-09-06','2025-09-09',2);
insertTaskSeed.run(tCode(),1,t7,'Prepare bar bending schedule (BBS) with cutting lengths per SP 34:1987',null,3,'completed','high',1,'2025-09-08','2025-09-12',2);
insertTaskSeed.run(tCode(),1,t7,'Calculate total steel quantity from BBS — grade-wise (8mm to 20mm)',null,3,'completed','high',1,'2025-09-12','2025-09-15',2);

// 8. Electrical System Design
const t8 = tNum; insertTaskSeed.run(tCode(),1,null,'Electrical system design and drawing','Load calculation, lighting layout, DB sizing, earthing per IS 732',3,'completed','high',1,'2025-08-20','2025-09-08',2);
insertTaskSeed.run(tCode(),1,t8,'Calculate total connected electrical load (IS 732:1989)',null,3,'completed','high',1,'2025-08-20','2025-08-22',2);
insertTaskSeed.run(tCode(),1,t8,'Design lighting layout — points per room based on lux levels (IS 3646)',null,3,'completed','high',1,'2025-08-22','2025-08-25',2);
insertTaskSeed.run(tCode(),1,t8,'Design power socket layout — 5A lighting, 15A heavy appliances',null,3,'completed','medium',1,'2025-08-22','2025-08-25',2);
insertTaskSeed.run(tCode(),1,t8,'Design DB layout — MCB sizing and circuit allocation',null,3,'completed','high',1,'2025-08-25','2025-08-28',2);
insertTaskSeed.run(tCode(),1,t8,'Design earthing system — plate/pipe earthing, resistance < 5 ohms (IS 3043)',null,3,'completed','high',1,'2025-08-28','2025-09-01',2);
insertTaskSeed.run(tCode(),1,t8,'Plan conduit routing — concealed PVC in slab and walls',null,3,'completed','medium',1,'2025-09-01','2025-09-04',2);
insertTaskSeed.run(tCode(),1,t8,'Prepare single line diagram, load chart and wiring schedule',null,3,'completed','high',1,'2025-09-04','2025-09-08',2);

// 9. Plumbing & Sanitary System Design
const t9 = tNum; insertTaskSeed.run(tCode(),1,null,'Plumbing and sanitary system design','Water demand, pipe sizing, drainage layout, rainwater harvesting',3,'completed','high',1,'2025-08-20','2025-09-08',2);
insertTaskSeed.run(tCode(),1,t9,'Calculate water demand at 135 LPCD and tank capacity (IS 1172:1993)',null,3,'completed','high',1,'2025-08-20','2025-08-23',2);
insertTaskSeed.run(tCode(),1,t9,'Design cold and hot water distribution — pipe sizing and routing',null,3,'completed','high',1,'2025-08-23','2025-08-26',2);
insertTaskSeed.run(tCode(),1,t9,'Design soil and waste pipe layout — 100mm soil, 75mm waste (IS 1742)',null,3,'completed','high',1,'2025-08-26','2025-08-29',2);
insertTaskSeed.run(tCode(),1,t9,'Plan floor drain locations with min 1:40 slope towards drain',null,3,'completed','medium',1,'2025-08-26','2025-08-29',2);
insertTaskSeed.run(tCode(),1,t9,'Design rainwater harvesting — rooftop collection, filter, recharge well',null,3,'completed','medium',1,'2025-08-29','2025-09-02',2);
insertTaskSeed.run(tCode(),1,t9,'Design septic tank/soak pit if municipal sewer unavailable (IS 2470)',null,3,'completed','medium',1,'2025-09-01','2025-09-04',2);
insertTaskSeed.run(tCode(),1,t9,'Prepare plumbing isometric drawings and fixture schedule',null,3,'completed','high',1,'2025-09-04','2025-09-08',2);

// 10. Cost Estimation & BOQ
const t10 = tNum; insertTaskSeed.run(tCode(),1,null,'Detailed cost estimation and BOQ preparation','Compute quantities, rate analysis, abstract of cost per IS 1200',2,'completed','high',1,'2025-09-01','2025-09-20',2);
insertTaskSeed.run(tCode(),1,t10,'Compute earthwork quantities — excavation, backfilling (IS 1200-Part 1)',null,2,'completed','high',1,'2025-09-01','2025-09-04',2);
insertTaskSeed.run(tCode(),1,t10,'Calculate concrete quantities grade-wise — PCC, M20, M25 (IS 1200-Part 2)',null,2,'completed','high',1,'2025-09-04','2025-09-07',2);
insertTaskSeed.run(tCode(),1,t10,'Calculate steel reinforcement quantity from BBS — total weight grade-wise',null,3,'completed','high',1,'2025-09-04','2025-09-07',2);
insertTaskSeed.run(tCode(),1,t10,'Compute brickwork quantities — 230mm external, 115mm internal (IS 1200-Part 6)',null,2,'completed','high',1,'2025-09-07','2025-09-09',2);
insertTaskSeed.run(tCode(),1,t10,'Calculate plastering, flooring, painting quantities (IS 1200)',null,2,'completed','medium',1,'2025-09-09','2025-09-12',2);
insertTaskSeed.run(tCode(),1,t10,'Compute plumbing and electrical material quantities',null,2,'completed','medium',1,'2025-09-09','2025-09-12',2);
insertTaskSeed.run(tCode(),1,t10,'Prepare detailed rate analysis using current DSR/SSR rates (CPWD/State PWD)',null,2,'completed','high',1,'2025-09-12','2025-09-16',2);
insertTaskSeed.run(tCode(),1,t10,'Compile abstract of cost — stage-wise with material and labour breakup',null,2,'completed','high',1,'2025-09-16','2025-09-18',2);
insertTaskSeed.run(tCode(),1,t10,'Present cost estimate to client and get budget approval',null,2,'completed','high',1,'2025-09-18','2025-09-20',2);

// 11. Construction Planning & Scheduling
const t11 = tNum; insertTaskSeed.run(tCode(),1,null,'Construction planning and project scheduling','WBS, CPM/PERT, Gantt chart, resource planning per SP 62 Ch.1',2,'completed','medium',1,'2025-09-10','2025-09-25',2);
insertTaskSeed.run(tCode(),1,t11,'Prepare work breakdown structure (WBS) for all construction stages',null,2,'completed','medium',1,'2025-09-10','2025-09-13',2);
insertTaskSeed.run(tCode(),1,t11,'Define activity sequence and dependencies',null,2,'completed','medium',1,'2025-09-12','2025-09-15',2);
insertTaskSeed.run(tCode(),1,t11,'Prepare CPM/PERT network diagram (SP 62:1997 Chapter 1)',null,2,'completed','medium',1,'2025-09-15','2025-09-18',2);
insertTaskSeed.run(tCode(),1,t11,'Create Gantt chart with milestones and critical path',null,2,'completed','medium',1,'2025-09-18','2025-09-20',2);
insertTaskSeed.run(tCode(),1,t11,'Plan resource leveling — labour, equipment, material delivery schedules',null,2,'completed','medium',1,'2025-09-18','2025-09-22',2);
insertTaskSeed.run(tCode(),1,t11,'Identify long-lead procurement items and advance orders',null,5,'completed','medium',1,'2025-09-20','2025-09-25',2);

// 12. Quality & Safety Planning
const t12 = tNum; insertTaskSeed.run(tCode(),1,null,'Quality assurance and site safety planning','QAP, material testing plan, safety protocols per IS 3764',2,'completed','medium',1,'2025-09-15','2025-09-28',2);
insertTaskSeed.run(tCode(),1,t12,'Prepare quality assurance plan (QAP) — inspection and test procedures',null,2,'completed','medium',1,'2025-09-15','2025-09-18',2);
insertTaskSeed.run(tCode(),1,t12,'Define material testing requirements — cement, steel, aggregate, brick',null,3,'completed','medium',1,'2025-09-18','2025-09-21',2);
insertTaskSeed.run(tCode(),1,t12,'Establish concrete mix design protocol — trial mix, cube testing',null,3,'completed','medium',1,'2025-09-18','2025-09-21',2);
insertTaskSeed.run(tCode(),1,t12,'Prepare site safety plan — PPE, fall protection, scaffolding (IS 3764)',null,2,'completed','medium',1,'2025-09-21','2025-09-25',2);
insertTaskSeed.run(tCode(),1,t12,'Prepare construction waste management and disposal plan',null,2,'completed','low',1,'2025-09-25','2025-09-28',2);

// 13. Drawing Coordination & Design Review
const t13 = tNum; insertTaskSeed.run(tCode(),1,null,'Drawing coordination and interdisciplinary design review','Clash detection, cross-verification and client sign-off on final drawing set',2,'completed','high',1,'2025-09-20','2025-10-05',2);
insertTaskSeed.run(tCode(),1,t13,'Conduct clash detection between architectural, structural and MEP drawings',null,2,'completed','high',1,'2025-09-20','2025-09-23',2);
insertTaskSeed.run(tCode(),1,t13,'Verify beam locations do not conflict with door/window openings',null,3,'completed','high',1,'2025-09-23','2025-09-25',2);
insertTaskSeed.run(tCode(),1,t13,'Check plumbing risers and drainage routes do not conflict with structure',null,3,'completed','high',1,'2025-09-23','2025-09-25',2);
insertTaskSeed.run(tCode(),1,t13,'Cross-verify all drawings use consistent floor levels and grid lines',null,2,'completed','high',1,'2025-09-25','2025-09-27',2);
insertTaskSeed.run(tCode(),1,t13,'Compile final coordinated drawing set — architecture, structure, MEP',null,2,'completed','high',1,'2025-09-27','2025-09-30',2);
insertTaskSeed.run(tCode(),1,t13,'Conduct design review meeting with all consultants',null,2,'completed','high',1,'2025-09-30','2025-10-02',2);
insertTaskSeed.run(tCode(),1,t13,'Obtain client sign-off on final coordinated drawing set',null,2,'completed','high',1,'2025-10-02','2025-10-05',2);

// 14. Tender & Contractor Selection
const t14 = tNum; insertTaskSeed.run(tCode(),1,null,'Tender preparation and contractor selection','Prepare tender docs, invite quotations, negotiate and finalize contract',2,'completed','medium',1,'2025-09-25','2025-10-15',2);
insertTaskSeed.run(tCode(),1,t14,'Prepare tender documents — BOQ, drawings, specifications, T&C',null,2,'completed','medium',1,'2025-09-25','2025-09-30',2);
insertTaskSeed.run(tCode(),1,t14,'Define scope of work — inclusions, exclusions, owner-supplied items',null,2,'completed','medium',1,'2025-09-28','2025-10-01',2);
insertTaskSeed.run(tCode(),1,t14,'Invite quotations from minimum 3 qualified contractors',null,2,'completed','medium',1,'2025-10-01','2025-10-05',2);
insertTaskSeed.run(tCode(),1,t14,'Conduct comparative analysis of received quotations',null,2,'completed','medium',1,'2025-10-05','2025-10-08',2);
insertTaskSeed.run(tCode(),1,t14,'Verify contractor credentials — experience, past projects, financial capacity',null,2,'completed','medium',1,'2025-10-05','2025-10-08',2);
insertTaskSeed.run(tCode(),1,t14,'Negotiate rates and finalize contract value',null,2,'completed','medium',1,'2025-10-08','2025-10-12',2);
insertTaskSeed.run(tCode(),1,t14,'Prepare construction agreement and issue work order',null,2,'completed','medium',1,'2025-10-12','2025-10-15',2);

// ====================================
// FOUNDATION (stage 3) - Completed
// ====================================

const tf1 = tNum; insertTaskSeed.run(tCode(),3,null,'Site preparation and excavation','Clear site and excavate to required depth',3,'completed','high',1,'2025-11-01','2025-11-10',2);
insertTaskSeed.run(tCode(),3,tf1,'Clear site and remove debris',null,3,'completed','high',1,'2025-11-01','2025-11-03',2);
insertTaskSeed.run(tCode(),3,tf1,'Mark foundation layout with centerlines',null,3,'completed','high',1,'2025-11-03','2025-11-05',2);
insertTaskSeed.run(tCode(),3,tf1,'Excavate trenches to required depth',null,4,'completed','high',1,'2025-11-05','2025-11-10',2);

const tf2 = tNum; insertTaskSeed.run(tCode(),3,null,'PCC and footing construction','Lay PCC, place rebar, cast footings',3,'completed','high',1,'2025-11-10','2025-11-25',2);
insertTaskSeed.run(tCode(),3,tf2,'Lay PCC bed',null,4,'completed','high',1,'2025-11-10','2025-11-12',2);
insertTaskSeed.run(tCode(),3,tf2,'Place footing reinforcement per BBS',null,3,'completed','high',1,'2025-11-12','2025-11-15',2);
insertTaskSeed.run(tCode(),3,tf2,'Cast footings with M20 concrete',null,4,'completed','high',1,'2025-11-15','2025-11-18',2);
insertTaskSeed.run(tCode(),3,tf2,'Cure footings for 7 days',null,3,'completed','medium',1,'2025-11-18','2025-11-25',2);

const tf3 = tNum; insertTaskSeed.run(tCode(),3,null,'Plinth beam and DPC','Construct plinth beam and apply DPC',3,'completed','high',1,'2025-11-20','2025-12-05',2);
insertTaskSeed.run(tCode(),3,tf3,'Construct plinth beam formwork',null,4,'completed','high',1,'2025-11-20','2025-11-23',2);
insertTaskSeed.run(tCode(),3,tf3,'Place plinth beam reinforcement',null,3,'completed','high',1,'2025-11-23','2025-11-26',2);
insertTaskSeed.run(tCode(),3,tf3,'Cast plinth beam and cure',null,4,'completed','high',1,'2025-11-26','2025-12-02',2);
insertTaskSeed.run(tCode(),3,tf3,'Apply DPC treatment',null,4,'completed','medium',1,'2025-12-02','2025-12-05',2);

// ====================================
// STRUCTURE (stage 4) - In Progress
// ====================================

const ts1 = tNum; insertTaskSeed.run(tCode(),4,null,'Column construction','Erect, formwork, cast and strip columns',3,'in_progress','high',1,'2026-01-15','2026-02-15',2);
insertTaskSeed.run(tCode(),4,ts1,'Erect column reinforcement cage',null,4,'completed','high',1,'2026-01-15','2026-01-22',2);
insertTaskSeed.run(tCode(),4,ts1,'Fix column formwork and check plumb',null,3,'ready_for_inspection','high',1,'2026-01-22','2026-02-01',2);
insertTaskSeed.run(tCode(),4,ts1,'Cast columns with M25 concrete',null,4,'not_started','high',1,'2026-02-01','2026-02-10',2);
insertTaskSeed.run(tCode(),4,ts1,'Strip formwork after curing',null,4,'not_started','medium',1,'2026-02-10','2026-02-15',2);

const ts2 = tNum; insertTaskSeed.run(tCode(),4,null,'Beam and slab construction','Install reinforcement, formwork, cast slab',3,'rework','high',1,'2026-02-01','2026-03-01',2);
insertTaskSeed.run(tCode(),4,ts2,'Install beam bottom reinforcement',null,4,'completed','high',1,'2026-02-01','2026-02-08',2);
insertTaskSeed.run(tCode(),4,ts2,'Fix slab formwork and shuttering',null,4,'rework','high',1,'2026-02-05','2026-02-12',2);
insertTaskSeed.run(tCode(),4,ts2,'Place slab reinforcement per drawing',null,3,'not_started','high',1,'2026-02-12','2026-02-18',2);
insertTaskSeed.run(tCode(),4,ts2,'Cast beam and slab together',null,4,'not_started','high',1,'2026-02-18','2026-02-22',2);

const ts3 = tNum; insertTaskSeed.run(tCode(),4,null,'Concrete quality testing','Collect and test cube samples',3,'in_progress','high',1,'2026-02-10','2026-03-10',2);
insertTaskSeed.run(tCode(),4,ts3,'Collect concrete cube samples per pour',null,3,'ready_for_inspection','high',1,'2026-02-10','2026-02-25',2);
insertTaskSeed.run(tCode(),4,ts3,'Test 7-day cube strength',null,7,'in_progress','medium',1,'2026-02-17','2026-02-28',2);
insertTaskSeed.run(tCode(),4,ts3,'Test 28-day cube strength',null,7,'not_started','medium',1,'2026-03-01','2026-03-10',2);

// ====================================
// BRICKWORK (stage 5) - Not Started
// ====================================

const tb1 = tNum; insertTaskSeed.run(tCode(),5,null,'External wall construction','Lay external walls in English bond',4,'not_started','high',1,'2026-02-25','2026-03-15',2);
insertTaskSeed.run(tCode(),5,tb1,'Procure Class A bricks with test certificate',null,4,'not_started','high',1,'2026-02-25','2026-03-01',2);
insertTaskSeed.run(tCode(),5,tb1,'Lay external walls in English bond (230mm)',null,4,'not_started','high',1,'2026-03-01','2026-03-12',2);
insertTaskSeed.run(tCode(),5,tb1,'Check wall plumb and alignment daily',null,3,'not_started','medium',1,'2026-03-01','2026-03-12',2);

const tb2 = tNum; insertTaskSeed.run(tCode(),5,null,'Mortar mix design approval','Prepare and approve mortar mix',3,'not_started','medium',1,'2026-02-28','2026-03-08',3);
insertTaskSeed.run(tCode(),5,tb2,'Prepare mortar mix as per design',null,4,'not_started','medium',1,'2026-02-28','2026-03-03',3);
insertTaskSeed.run(tCode(),5,tb2,'Get engineer approval on mix',null,3,'not_started','medium',1,'2026-03-03','2026-03-08',3);

console.log(`  Inserted ${tNum-1} manual tasks for project 1 stages 1,3,4,5`);

// Auto-seed default tasks for all stages that don't have any tasks yet
import DEFAULT_STAGE_TASKS from '../config/defaultTasks.js';
const allStages = db.prepare('SELECT s.id, s.project_id, s.name FROM stages s ORDER BY s.project_id, s.stage_order').all();
const stagesWithTasks = new Set(db.prepare('SELECT DISTINCT stage_id FROM tasks').all().map(r => r.stage_id));

let autoCount = 0;
for (const stage of allStages) {
  if (stagesWithTasks.has(stage.id)) continue; // already has manual tasks
  const taskDefs = DEFAULT_STAGE_TASKS[stage.name] || [];
  for (const taskDef of taskDefs) {
    const taskCode = `T-${String(tNum++).padStart(3,'0')}`;
    const taskResult = insertTaskSeed.run(taskCode, stage.id, null, taskDef.title, null, null, 'not_started', taskDef.priority || 'medium', 1, null, null, 1);
    const parentId = taskResult.lastInsertRowid;
    autoCount++;
    if (taskDef.subtasks) {
      for (const subTitle of taskDef.subtasks) {
        const subCode = `T-${String(tNum++).padStart(3,'0')}`;
        insertTaskSeed.run(subCode, stage.id, parentId, subTitle, null, null, 'not_started', taskDef.priority || 'medium', 1, null, null, 1);
        autoCount++;
      }
    }
  }
}
console.log(`  Auto-seeded ${autoCount} default tasks for remaining stages`);

// ===== TASK-INSPECTION LINKS =====
console.log('Seeding task-inspection links...');
const insertTI = db.prepare('INSERT INTO task_inspections (task_id, inspection_id, link_type, created_by) VALUES (?, ?, ?, ?)');

function findTask(stageId, titlePattern) {
  return db.prepare('SELECT id FROM tasks WHERE stage_id = ? AND title LIKE ? AND parent_task_id IS NULL LIMIT 1').get(stageId, `%${titlePattern}%`);
}
function findSubtask(parentId, titlePattern) {
  return db.prepare('SELECT id FROM tasks WHERE parent_task_id = ? AND title LIKE ? LIMIT 1').get(parentId, `%${titlePattern}%`);
}

// INS-001 (Foundation Check, stage 3) → Foundation quality tasks
const foundQC = findTask(3, 'Foundation quality control');
if (foundQC) insertTI.run(foundQC.id, 1, 'required', 2);

// INS-002 (Soil Bearing, stage 3) → Geotechnical investigation
const geoTask = findTask(1, 'Geotechnical investigation');
if (geoTask) insertTI.run(geoTask.id, 2, 'related', 2);

// INS-003 (Concrete Cube Test, stage 4) → Concrete quality testing
const concQC = findTask(4, 'Concrete quality testing');
if (concQC) {
  insertTI.run(concQC.id, 3, 'required', 2);
  const sub7day = findSubtask(concQC.id, '7-day cube');
  if (sub7day) insertTI.run(sub7day.id, 3, 'required', 2);
  const sub28day = findSubtask(concQC.id, '28-day cube');
  if (sub28day) insertTI.run(sub28day.id, 3, 'required', 2);
}

// INS-004 (Rebar Inspection, stage 4) → Column reinforcement
const colTask = findTask(4, 'Column reinforcement');
if (colTask) insertTI.run(colTask.id, 4, 'required', 2);

// INS-005 (Formwork Check, stage 4) → Beam and slab
const fwTask = findTask(4, 'Beam and slab');
if (fwTask) insertTI.run(fwTask.id, 5, 'required', 2);

// INS-006 (Concrete Pour, stage 4)
const slabTask = findTask(4, 'Slab casting');
if (slabTask) {
  insertTI.run(slabTask.id, 6, 'related', 2);
} else if (fwTask) {
  insertTI.run(fwTask.id, 6, 'related', 2);
}

// INS-008 (Brick Quality, stage 5)
const brickTask = findTask(5, 'Brick');
if (brickTask) insertTI.run(brickTask.id, 8, 'required', 2);

// Link defects to tasks
if (concQC) {
  db.prepare('UPDATE defects SET task_id = ? WHERE defect_code = ?').run(concQC.id, 'DEF-001');
  db.prepare('UPDATE defects SET task_id = ? WHERE defect_code = ?').run(concQC.id, 'DEF-002');
}
if (fwTask) {
  db.prepare('UPDATE defects SET task_id = ? WHERE defect_code = ?').run(fwTask.id, 'DEF-003');
  db.prepare('UPDATE defects SET task_id = ? WHERE defect_code = ?').run(fwTask.id, 'DEF-004');
}

const tiCount = db.prepare('SELECT COUNT(*) as c FROM task_inspections').get().c;
console.log(`  Linked ${tiCount} task-inspection pairs`);

// ===== STATE MACHINES =====
console.log('Seeding state machine definitions...');
const insertSM = db.prepare('INSERT INTO state_machines (machine_key,name,entity,category,states_json,current_state,transitions_json,rules_json,blocking_json) VALUES (?,?,?,?,?,?,?,?,?)');
const smData = [
  // ─── PROJECT MANAGEMENT ───
  ['project','Project Lifecycle','Project','project',
    JSON.stringify(["Draft","Budget Pending","Active","On Hold","Completed","Archived"]),
    'Active',
    JSON.stringify([
      {from:"Draft",to:"Budget Pending",trigger:"Budget Created",guard:"BOQ uploaded",role:"pm"},
      {from:"Budget Pending",to:"Active",trigger:"Budget Approved",guard:"Owner approval",role:"owner"},
      {from:"Active",to:"On Hold",trigger:"Manual Hold",guard:"PM permission",role:"pm"},
      {from:"On Hold",to:"Active",trigger:"Resume",guard:"PM permission",role:"pm"},
      {from:"Active",to:"Completed",trigger:"Final Stage Closed",guard:"All stages completed",role:"pm"},
      {from:"Completed",to:"Archived",trigger:"Archive",guard:"Owner approval",role:"owner"}
    ]),null,null],

  ['stage','Stage Execution','Project_Stage','project',
    JSON.stringify(["Not Started","In Progress","Inspection Pending","Rework Required","Completed","Locked"]),
    'In Progress',
    JSON.stringify([
      {from:"Not Started",to:"In Progress",trigger:"Start Stage",guard:"Previous stage completed or first stage",role:"pm"},
      {from:"In Progress",to:"Inspection Pending",trigger:"Request Inspection",guard:"Tasks >= 95% complete, mandatory checklist items done",role:"engineer"},
      {from:"Inspection Pending",to:"Completed",trigger:"Inspection Passed",guard:"No critical defects, all NCRs resolved",role:"inspector"},
      {from:"Inspection Pending",to:"Rework Required",trigger:"Inspection Failed",guard:"Defects logged with severity",role:"inspector"},
      {from:"Rework Required",to:"Inspection Pending",trigger:"Rework Done",guard:"All defects rectified and verified",role:"engineer"},
      {from:"Completed",to:"Locked",trigger:"Payment Released",guard:"RA Bill approved and payment confirmed",role:"accounts"}
    ]),
    JSON.stringify(["Cannot revert from Locked state","Cannot skip stage sequence — previous stage must be Completed","Payment blocked if stage is not in Completed state","Stage cannot start if predecessor has critical NCRs"]),null],

  ['task','Task Lifecycle','Task','project',
    JSON.stringify(["New","Assigned","In Progress","On Hold","Blocked","Ready for Review","Completed"]),
    'New',
    JSON.stringify([
      {from:"New",to:"Assigned",trigger:"Assign to Team Member",guard:"Assignee is project member",role:"pm"},
      {from:"Assigned",to:"In Progress",trigger:"Start Work",guard:"Worker acknowledges task",role:"engineer,contractor"},
      {from:"In Progress",to:"On Hold",trigger:"Put on Hold",guard:"Reason documented — dependency or resource issue",role:"pm,engineer"},
      {from:"In Progress",to:"Blocked",trigger:"Block Task",guard:"Blocking reason documented — missing info, material, approval",role:"engineer,contractor"},
      {from:"On Hold",to:"In Progress",trigger:"Resume",guard:"Hold condition resolved",role:"pm,engineer"},
      {from:"Blocked",to:"In Progress",trigger:"Unblock",guard:"Blocking issue resolved",role:"pm,engineer"},
      {from:"In Progress",to:"Ready for Review",trigger:"Mark Complete",guard:"All subtasks completed",role:"engineer,contractor"},
      {from:"Ready for Review",to:"Completed",trigger:"Approve",guard:"PM/QC verifies work quality",role:"pm,inspector"},
      {from:"Ready for Review",to:"In Progress",trigger:"Reject — Rework",guard:"Deficiencies noted, rework required",role:"pm,inspector"}
    ]),null,null],

  // ─── QUALITY CONTROL ───
  ['inspection','Inspection & QC Check','Inspection','quality',
    JSON.stringify(["Scheduled","In Progress","Passed","Failed","Conditional","Reinspection"]),
    'Scheduled',
    JSON.stringify([
      {from:"Scheduled",to:"In Progress",trigger:"Start Inspection",guard:"Inspector on-site, checklist prepared",role:"inspector"},
      {from:"In Progress",to:"Passed",trigger:"All Clear",guard:"No defects found, all checklist items passed",role:"inspector"},
      {from:"In Progress",to:"Failed",trigger:"Critical Defects",guard:"Critical/major defects logged with photos",role:"inspector"},
      {from:"In Progress",to:"Conditional",trigger:"Minor Issues",guard:"Non-critical defects, work may proceed with conditions",role:"inspector"},
      {from:"Failed",to:"Reinspection",trigger:"Rework Completed",guard:"Contractor certifies defects rectified",role:"engineer"},
      {from:"Conditional",to:"Passed",trigger:"Conditions Met",guard:"All conditional items addressed and verified",role:"inspector"},
      {from:"Reinspection",to:"Passed",trigger:"Re-inspection Passed",guard:"All defects verified as rectified",role:"inspector"},
      {from:"Reinspection",to:"Failed",trigger:"Re-inspection Failed",guard:"Defects still present or new defects found",role:"inspector"}
    ]),null,null],

  ['ncr','Non-Conformance Report (NCR)','NCR','quality',
    JSON.stringify(["Identified","Reported","Under Review","Root Cause Analysis","Disposition","Corrective Action","Verification","Closed"]),
    'Identified',
    JSON.stringify([
      {from:"Identified",to:"Reported",trigger:"Raise NCR",guard:"NCR form completed with evidence — photos, measurements, IS code reference",role:"inspector,engineer"},
      {from:"Reported",to:"Under Review",trigger:"Review NCR",guard:"Severity classified: Minor / Major / Critical",role:"pm"},
      {from:"Under Review",to:"Root Cause Analysis",trigger:"Assign RCA",guard:"Responsible party identified",role:"pm"},
      {from:"Root Cause Analysis",to:"Disposition",trigger:"RCA Complete",guard:"Root cause documented — 5 Whys or fishbone analysis",role:"engineer"},
      {from:"Disposition",to:"Corrective Action",guard:"Disposition decided: Rework / Repair / Use-As-Is / Reject",trigger:"Assign Corrective Action",role:"pm"},
      {from:"Corrective Action",to:"Verification",trigger:"Action Complete",guard:"Contractor certifies corrective work done",role:"contractor"},
      {from:"Verification",to:"Closed",trigger:"Verify & Close",guard:"Re-inspection confirms NCR resolved satisfactorily",role:"inspector"},
      {from:"Verification",to:"Corrective Action",trigger:"Reject Fix",guard:"Corrective action insufficient, further work required",role:"inspector"}
    ]),
    JSON.stringify(["Critical NCRs block stage completion","NCR must reference specific IS code violation","Photographic evidence mandatory at Reported and Closed stages","NCR register must be maintained with sequential numbering"]),null],

  ['submittal','Submittal / Shop Drawing Review','Submittal','quality',
    JSON.stringify(["Draft","Submitted","Under Review","Approved","Approved as Noted","Revise and Resubmit","Rejected"]),
    'Draft',
    JSON.stringify([
      {from:"Draft",to:"Submitted",trigger:"Submit for Review",guard:"Drawing/document package complete with specifications",role:"contractor"},
      {from:"Submitted",to:"Under Review",trigger:"Assign Reviewer",guard:"Reviewer assigned — architect, structural or MEP engineer",role:"pm"},
      {from:"Under Review",to:"Approved",trigger:"Approve (A)",guard:"Fully compliant with specifications — proceed with work",role:"pm,engineer"},
      {from:"Under Review",to:"Approved as Noted",trigger:"Approve with Comments (B)",guard:"Minor comments — proceed incorporating notes",role:"pm,engineer"},
      {from:"Under Review",to:"Revise and Resubmit",trigger:"Return for Revision (C)",guard:"Significant issues — cannot proceed until revised",role:"pm,engineer"},
      {from:"Under Review",to:"Rejected",trigger:"Reject (D)",guard:"Non-compliant — does not meet IS code / specification requirements",role:"pm,engineer"},
      {from:"Revise and Resubmit",to:"Submitted",trigger:"Resubmit",guard:"Revised package addressing all review comments",role:"contractor"},
      {from:"Rejected",to:"Submitted",trigger:"Resubmit After Rejection",guard:"Complete rework of submittal per specifications",role:"contractor"}
    ]),
    JSON.stringify(["Submittal register must track revision number for each resubmission","Approved submittals must be stamped and distributed to site","Code A/B allows work to proceed; Code C/D requires resubmission before work"]),null],

  ['drawingRevision','Drawing Revision Control','Drawing','quality',
    JSON.stringify(["P-Series (Preliminary)","T-Series (Tender)","C-Series (Construction)","As-Built"]),
    'P-Series (Preliminary)',
    JSON.stringify([
      {from:"P-Series (Preliminary)",to:"T-Series (Tender)",trigger:"Design Finalized",guard:"All review comments addressed, design team sign-off",role:"pm,engineer"},
      {from:"T-Series (Tender)",to:"C-Series (Construction)",trigger:"Issued for Construction",guard:"All approvals obtained, contractor awarded",role:"pm"},
      {from:"C-Series (Construction)",to:"As-Built",trigger:"Record Actual Construction",guard:"Field modifications documented, project completed",role:"engineer"}
    ]),
    JSON.stringify(["P1, P2, P3... indicate preliminary revision sequence","T1, T2... indicate tender revision sequence","C1, C2... indicate construction revision sequence","Every revision must log: revision number, date, description of change, author"]),null],

  // ─── FINANCIAL ───
  ['material','Material Requisition & Procurement','Material_Request','financial',
    JSON.stringify(["Indent Raised","PM Approved","RFQ Sent","PO Created","Vendor Acknowledged","Dispatched","GRN Received","Stock Updated","Rejected","Closed"]),
    'Indent Raised',
    JSON.stringify([
      {from:"Indent Raised",to:"PM Approved",trigger:"Approve Indent",guard:"Specification, quantity and budget verified by PM",role:"pm"},
      {from:"Indent Raised",to:"Rejected",trigger:"Reject Indent",guard:"Reason documented — not required, over-budget, wrong spec",role:"pm"},
      {from:"PM Approved",to:"RFQ Sent",trigger:"Send RFQ",guard:"Minimum 3 vendor quotations requested",role:"procurement"},
      {from:"RFQ Sent",to:"PO Created",trigger:"Create Purchase Order",guard:"Vendor selected based on comparative statement, rates approved",role:"procurement"},
      {from:"PO Created",to:"Vendor Acknowledged",trigger:"Vendor Confirms",guard:"Vendor acknowledges PO with delivery date commitment",role:"procurement"},
      {from:"Vendor Acknowledged",to:"Dispatched",trigger:"Material Dispatched",guard:"Vendor confirms dispatch with challan/LR number",role:"procurement"},
      {from:"Dispatched",to:"GRN Received",trigger:"Goods Received",guard:"Storekeeper inspects: quantity, quality, condition per PO specs",role:"procurement"},
      {from:"GRN Received",to:"Stock Updated",trigger:"Update Inventory",guard:"Material added to stock register with batch/lot details",role:"procurement"},
      {from:"Stock Updated",to:"Closed",trigger:"Invoice Matched & Closed",guard:"3-way match: Invoice vs PO vs GRN — accounts processes payment",role:"accounts"}
    ]),
    JSON.stringify(["Material indent must reference task/stage for cost allocation","GRN must verify: quantity per PO, IS code compliance, physical condition","Rejection at GRN creates debit note to vendor","Cement must be tested per IS 4031 before use — store in dry godown max 3 months"]),null],

  ['purchaseOrder','Purchase Order Lifecycle','Purchase_Order','financial',
    JSON.stringify(["Created","Issued","Partially Delivered","Delivered","Closed","Cancelled"]),
    'Issued',
    JSON.stringify([
      {from:"Created",to:"Issued",trigger:"Issue PO",guard:"Vendor confirmed, budget approved, delivery schedule agreed",role:"procurement"},
      {from:"Issued",to:"Partially Delivered",trigger:"Partial Delivery",guard:"GRN raised for partial quantity, balance tracked",role:"procurement"},
      {from:"Issued",to:"Delivered",trigger:"Full Delivery",guard:"GRN raised for full PO quantity, quality accepted",role:"procurement"},
      {from:"Partially Delivered",to:"Delivered",trigger:"Remaining Delivered",guard:"Final GRN matches total PO quantity",role:"procurement"},
      {from:"Delivered",to:"Closed",trigger:"Close PO",guard:"Invoice matched, payment processed, inventory reconciled",role:"accounts"},
      {from:"Created",to:"Cancelled",trigger:"Cancel PO",guard:"No delivery exists, cancellation reason documented",role:"pm,procurement"}
    ]),null,null],

  ['raBill','Running Account (RA) Bill — CPWD Process','RA_Bill','financial',
    JSON.stringify(["Measurement Recorded","Check Measurement Done","Bill Prepared","Technical Check","AE/EE Certified","Payment Processing","Payment Released","Disputed"]),
    'Measurement Recorded',
    JSON.stringify([
      {from:"Measurement Recorded",trigger:"Record in MB",to:"Check Measurement Done",guard:"JE records measurements in Measurement Book (Form 23) with date and signature",role:"engineer"},
      {from:"Check Measurement Done",to:"Bill Prepared",trigger:"Prepare RA Bill",guard:"AE verifies sample measurements on site, certifies check measurement",role:"engineer"},
      {from:"Bill Prepared",to:"Technical Check",trigger:"Submit for Technical Check",guard:"RA Bill prepared (Form 25/26/27) with BOQ rates, abstracts, deductions",role:"engineer"},
      {from:"Technical Check",to:"AE/EE Certified",trigger:"Technical Sanction",guard:"Arithmetic verified, rates correct, specifications compliance checked",role:"pm"},
      {from:"AE/EE Certified",to:"Payment Processing",trigger:"Forward to Accounts",guard:"Executive Engineer certifies bill amount for payment",role:"owner,pm"},
      {from:"Payment Processing",to:"Payment Released",trigger:"Release Payment",guard:"Deductions applied: advance recovery, retention 5%, TDS, GST adjustment",role:"accounts"},
      {from:"Technical Check",to:"Disputed",trigger:"Dispute Raised",guard:"Rate disagreement, quantity dispute, or specification non-compliance",role:"pm"},
      {from:"Disputed",to:"Bill Prepared",trigger:"Dispute Resolved",guard:"Revised measurement or agreed rates documented",role:"engineer"}
    ]),
    JSON.stringify(["MB entries must be in ink — copying from elsewhere is prohibited per CPWD Manual","Check measurement percentage: 100% for first bill, 50% for subsequent bills","Deviation beyond 25% in any BOQ item requires prior technical sanction","Retention: 5% withheld from each bill, 50% released at completion, 50% after DLP","Secured advance: up to 75% of material value brought to site but not yet used"]),null],

  ['payment','Payment Certification','Stage_Payment','financial',
    JSON.stringify(["Draft","Submitted","Under Review","Approved","Rejected","Paid","Retention Released"]),
    'Under Review',
    JSON.stringify([
      {from:"Draft",to:"Submitted",trigger:"Contractor Submits",guard:"Work progress >= threshold, measurement recorded",role:"contractor"},
      {from:"Submitted",to:"Under Review",trigger:"Budget Check",guard:"Budget check passed, within approved contract value",role:"accounts"},
      {from:"Under Review",to:"Approved",trigger:"Certify Payment",guard:"Inspection passed, no critical NCRs, quantities verified",role:"owner,pm"},
      {from:"Under Review",to:"Rejected",trigger:"Reject Bill",guard:"Reason mandatory — defects, measurement dispute, budget overshoot",role:"owner,pm"},
      {from:"Rejected",to:"Submitted",trigger:"Revise & Resubmit",guard:"Contractor addresses rejection comments, revised bill submitted",role:"contractor"},
      {from:"Approved",to:"Paid",trigger:"Release Payment",guard:"Deductions calculated: retention 5-10%, advance recovery, TDS",role:"accounts"},
      {from:"Paid",to:"Retention Released",trigger:"Release Retention",guard:"Defect liability period complete, no pending claims",role:"owner,accounts"}
    ]),
    JSON.stringify(["Open critical defects block payment approval","Budget overshoot beyond 10% tolerance requires owner approval","Stage must be in Completed state for final payment","Retention: 5-10% withheld per bill, released after defect liability period (12 months)"]),null],

  ['expense','Expense Control','Expense','financial',
    JSON.stringify(["Draft","Submitted","Approved","Posted","Locked"]),
    'Approved',
    JSON.stringify([
      {from:"Draft",to:"Submitted",trigger:"Submit Expense",guard:"All details complete — amount, category, stage, supporting documents",role:"engineer,pm"},
      {from:"Submitted",to:"Approved",trigger:"Approve Expense",guard:"Within budget allocation, proper documentation attached",role:"pm,owner"},
      {from:"Approved",to:"Posted",trigger:"Post to Ledger",guard:"Cost code mapped, accounting entry created",role:"accounts"},
      {from:"Posted",to:"Locked",trigger:"Period Close",guard:"Monthly reconciliation done, no pending adjustments",role:"accounts"}
    ]),
    JSON.stringify(["Cannot modify expense after Locked state","Each expense must map to a project stage for cost tracking"]),null],

  // ─── SAFETY ───
  ['permitToWork','Permit to Work (PTW)','Safety_Permit','safety',
    JSON.stringify(["Requested","Reviewed","Approved","Active","Extended","Closed","Expired","Denied"]),
    'Requested',
    JSON.stringify([
      {from:"Requested",to:"Reviewed",trigger:"Safety Review",guard:"Safety officer reviews hazards, PPE requirements, precautions",role:"inspector"},
      {from:"Reviewed",to:"Approved",trigger:"Approve Permit",guard:"All safety precautions in place, emergency procedures briefed",role:"pm,inspector"},
      {from:"Reviewed",to:"Denied",trigger:"Deny Permit",guard:"Safety conditions not met — reason documented",role:"inspector"},
      {from:"Approved",to:"Active",trigger:"Activate",guard:"Work commences under permit conditions, display permit at work area",role:"engineer"},
      {from:"Active",to:"Extended",trigger:"Extend Permit",guard:"Original time limit exceeded, conditions still safe, re-approval needed",role:"inspector"},
      {from:"Extended",to:"Active",trigger:"Re-activate",guard:"Extension approved, safety conditions re-verified",role:"inspector"},
      {from:"Active",to:"Closed",trigger:"Close Permit",guard:"Work completed safely, area restored, permit formally closed",role:"engineer"},
      {from:"Active",to:"Expired",trigger:"Auto-expire",guard:"Validity period exceeded without extension, work must stop",role:"inspector"}
    ]),
    JSON.stringify(["PTW types: Hot Work, Confined Space Entry, Excavation > 1.5m, Working at Height > 2m, Electrical Isolation, Lifting Operations","Permit valid for single shift only unless Extended","Display permit prominently at work location","Emergency stop: Any person can stop work if unsafe condition observed","IS 3764:1992 — Safety requirements for construction sites"]),null],

  ['safetyIncident','Safety Incident & Investigation','Incident','safety',
    JSON.stringify(["Reported","Under Investigation","Root Cause Identified","Corrective Action","Implemented","Verified","Closed"]),
    'Reported',
    JSON.stringify([
      {from:"Reported",to:"Under Investigation",trigger:"Begin Investigation",guard:"Incident details recorded: who, what, where, when, severity, witness statements",role:"inspector,pm"},
      {from:"Under Investigation",to:"Root Cause Identified",trigger:"RCA Complete",guard:"Root cause analysis done — 5 Whys or fishbone diagram documented",role:"inspector"},
      {from:"Root Cause Identified",to:"Corrective Action",trigger:"Assign Actions",guard:"Corrective and preventive actions defined with responsibility and deadline",role:"pm"},
      {from:"Corrective Action",to:"Implemented",trigger:"Actions Done",guard:"All corrective measures implemented on site",role:"engineer,contractor"},
      {from:"Implemented",to:"Verified",trigger:"Verify Actions",guard:"Safety officer verifies measures are effective",role:"inspector"},
      {from:"Verified",to:"Closed",trigger:"Close Incident",guard:"Documentation complete, lessons learned shared in toolbox talk",role:"pm"}
    ]),
    JSON.stringify(["Fatality: Report to authorities within 8 hours","Serious injury: Report within 24 hours per Building & Other Construction Workers Act","Near-miss incidents must also be reported and investigated","Monthly safety statistics: frequency rate, severity rate to be computed","All incidents require corrective action — no incident can be closed without action"]),null],

  // ─── DOCUMENT MANAGEMENT ───
  ['rfi','Request for Information (RFI)','RFI','document',
    JSON.stringify(["Draft","Open","Responded","Closed","Void"]),
    'Draft',
    JSON.stringify([
      {from:"Draft",to:"Open",trigger:"Submit RFI",guard:"Question clearly stated with reference to drawing/spec number and location",role:"contractor,engineer"},
      {from:"Open",to:"Responded",trigger:"Provide Response",guard:"Response addresses the query with technical justification or drawing reference",role:"pm,engineer"},
      {from:"Responded",to:"Closed",trigger:"Accept Response",guard:"Originator accepts response — no further clarification needed",role:"contractor,engineer"},
      {from:"Responded",to:"Open",trigger:"Request Clarification",guard:"Response insufficient, additional detail requested",role:"contractor,engineer"},
      {from:"Draft",to:"Void",trigger:"Cancel RFI",guard:"RFI no longer relevant or duplicate",role:"pm"}
    ]),
    JSON.stringify(["RFI must reference specific drawing number, specification clause or site location","Response deadline: typically 10-14 working days","Ball-in-court tracking: at any time one party is responsible for next action","Unanswered RFIs that impact work progress should be escalated to Owner","Cost/schedule impact of RFI response must be documented if applicable"]),null],

  ['changeOrder','Change Order / Variation Order','Change_Order','document',
    JSON.stringify(["Identified","PCO Created","COR Prepared","PCCO Draft","Under Review","Approved","Rejected","Executed"]),
    'Identified',
    JSON.stringify([
      {from:"Identified",to:"PCO Created",trigger:"Create Potential CO",guard:"Scope change identified with cost and schedule impact estimate",role:"engineer,pm"},
      {from:"PCO Created",to:"COR Prepared",trigger:"Prepare Change Request",guard:"Detailed cost breakdown, BOQ comparison, rate analysis attached",role:"pm"},
      {from:"COR Prepared",to:"PCCO Draft",trigger:"Bundle into Contract CO",guard:"One or more CORs grouped into Prime Contract Change Order",role:"pm"},
      {from:"PCCO Draft",to:"Under Review",trigger:"Submit for Approval",guard:"Change order document with full justification submitted to Owner",role:"pm"},
      {from:"Under Review",to:"Approved",trigger:"Owner Approves",guard:"Cost and schedule impact accepted, budget allocation confirmed",role:"owner"},
      {from:"Under Review",to:"Rejected",trigger:"Owner Rejects",guard:"Rejection reason documented, alternative approach required",role:"owner"},
      {from:"Approved",to:"Executed",trigger:"Execute Change Order",guard:"Signed by all parties, BOQ updated, revised drawings issued",role:"owner,pm"},
      {from:"Rejected",to:"PCO Created",trigger:"Revise Scope",guard:"Alternative approach proposed with revised cost estimate",role:"pm"}
    ]),
    JSON.stringify(["Procore-style tiers: 1-Tier (PCCO only), 2-Tier (PCO→PCCO), 3-Tier (PCO→COR→PCCO)","Change orders must reference original BOQ item and deviation quantity","Rate for extra items: per contract clause or CPWD DSR current rates","Deviation beyond 25% in any item requires prior approval per CPWD norms","Time extension claim must accompany change orders affecting critical path"]),null],
];
for (const s of smData) insertSM.run(...s);
console.log(`  Inserted ${smData.length} workflow state machines`);

// ===== NCRs =====
console.log('Seeding NCRs...');
const insertNCR = db.prepare('INSERT INTO ncrs (ncr_code, project_id, stage_id, task_id, inspection_id, title, description, severity, category, root_cause, root_cause_method, disposition, corrective_action, verification_notes, location, is_code_ref, status, raised_by, assigned_to, due_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

// Use stage IDs from the seeded project (stage 4 = Structure, stage 5 = Brickwork)
const stage4 = db.prepare("SELECT id FROM stages WHERE name LIKE '%Structure%' LIMIT 1").get();
const stage5 = db.prepare("SELECT id FROM stages WHERE name LIKE '%Brickwork%' LIMIT 1").get();
const inspUser = db.prepare("SELECT id FROM users WHERE email = 'inspector@buildtrack.com'").get();
const engUser = db.prepare("SELECT id FROM users WHERE email = 'engineer@buildtrack.com'").get();
const contUser = db.prepare("SELECT id FROM users WHERE email = 'contractor@buildtrack.com'").get();

if (stage4 && inspUser && engUser) {
  insertNCR.run('NCR-001', 1, stage4.id, null, null,
    'Honeycomb in Column C3 at 2nd Floor',
    'Significant honeycombing observed on Column C3 east face between 2nd floor slab and beam junction. Exposed aggregate visible over approximately 200x300mm area. Likely caused by insufficient vibration during concrete placement.',
    'Major', 'Workmanship',
    'Insufficient vibration during concrete pour. Congested reinforcement at beam-column junction prevented proper consolidation.',
    '5_whys', 'Rework',
    'Chip out loose concrete, clean exposed reinforcement, apply bonding agent, repair with micro-concrete per IS 456 Cl. 14.3',
    null, 'Column C3, 2nd Floor, Grid 3-D',
    'IS 456:2000 Cl. 14.3 — Compaction, IS 516 — Cube test for repair concrete',
    'Corrective Action', inspUser.id, contUser.id, '2026-03-25');

  insertNCR.run('NCR-002', 1, stage4.id, null, null,
    'Rebar cover insufficient in Slab S2',
    'Cover meter survey shows concrete cover to bottom reinforcement is 15mm against specified minimum of 25mm (exposure condition: Moderate). Affects area of 4m x 3m in Slab S2.',
    'Critical', 'Workmanship',
    'Spacers not placed at required frequency. Chair bars missing in the affected zone.',
    '5_whys', null, null, null,
    'Slab S2, 1st Floor, Grid A-B/2-3',
    'IS 456:2000 Cl. 26.4.1 — Nominal Cover, Table 16',
    'Under Review', inspUser.id, engUser.id, '2026-03-20');

  insertNCR.run('NCR-003', 1, stage5?.id || stage4.id, null, null,
    'Brick wall plumb deviation exceeds tolerance',
    'External wall on west elevation shows 18mm deviation from plumb over 3m height. IS 2212 tolerance is 12mm per 3m. Wall needs partial rebuilding.',
    'Minor', 'Workmanship',
    null, null, null, null, null,
    'West elevation, Ground floor, Grid A/1-3',
    'IS 2212:1991 Cl. 5.2 — Permitted deviations in brickwork',
    'Identified', inspUser.id, null, '2026-04-01');
}
console.log('  Inserted 3 sample NCRs');

// ===== RFIs =====
console.log('Seeding RFIs...');
const insertRFI = db.prepare('INSERT INTO rfis (rfi_code, project_id, stage_id, task_id, subject, question, drawing_ref, spec_ref, location, response, response_by, response_date, cost_impact, schedule_impact, status, priority, due_date, raised_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

if (engUser && stage4) {
  insertRFI.run('RFI-001', 1, stage4.id, null,
    'Beam reinforcement conflict at Grid B-3',
    'Structural drawing S-201 Rev C2 shows 4-25mm dia bars at top of beam B3, but at the column junction there is insufficient space for lapping with column vertical bars per IS 13920 Cl. 6.2.5. Please clarify lap arrangement or provide revised detail.',
    'S-201 Rev C2', 'IS 13920:2016 Cl. 6.2.5',
    'Beam B3, 2nd Floor, Grid B-3 junction',
    'Stagger the laps — alternate bars lapped at different sections. Revised detail SK-045 attached. Maintain minimum lap length of 50d as per IS 456 Cl. 26.2.5.',
    db.prepare("SELECT id FROM users WHERE email = 'pm@buildtrack.com'").get()?.id || 1,
    '2026-03-05', null, null,
    'Closed', 'high', '2026-03-10', engUser.id);

  insertRFI.run('RFI-002', 1, stage4.id, null,
    'Concrete grade clarification for water tank',
    'Bill of Quantities specifies M30 grade concrete for overhead water tank, but structural drawing S-301 notes M35. Which grade should be used? Also confirm admixture requirements for water-retaining structure per IS 3370.',
    'S-301 Rev C1', 'IS 3370:2009, IS 456:2000',
    'Overhead water tank, Terrace level',
    null, null, null, null, null,
    'Open', 'high', '2026-03-18', engUser.id);

  insertRFI.run('RFI-003', 1, stage5?.id || stage4.id, null,
    'Window lintel depth in non-load-bearing walls',
    'Drawings do not specify lintel details for window openings W3 (1200x1500mm) in non-load-bearing brick partition walls. Please confirm: (a) lintel depth, (b) bearing length, (c) reinforcement detail.',
    'A-105 Rev C1', 'IS 2212:1991',
    'Internal partition walls, 1st Floor',
    null, null, null, null, null,
    'Draft', 'medium', '2026-03-28', contUser?.id || engUser.id);
}
console.log('  Inserted 3 sample RFIs');

// ===== ESTIMATOR MASTER RATES =====
console.log('Seeding estimator master rates...');
const insertRate = db.prepare('INSERT INTO estimator_rates (category, item_key, label, value_json, sort_order) VALUES (?, ?, ?, ?, ?)');

// Material rates
const materialRates = [
  ['material', 'cement', 'Cement (OPC 53 Grade)', { qty: 0.4, unit: 'bags', unitPrice: 380, note: '1 bag = 50 kg, IS 12269' }, 1],
  ['material', 'steel', 'TMT Steel (Fe 500D)', { qty: 4.0, unit: 'kg', unitPrice: 65, note: 'IS 1786, Fe 500D grade' }, 2],
  ['material', 'bricks', 'Clay Bricks (Class A)', { qty: 8, unit: 'nos', unitPrice: 8, note: 'IS 1077, 230x110x75mm' }, 3],
  ['material', 'sand', 'River Sand (M-Sand)', { qty: 0.816, unit: 'cft', unitPrice: 55, note: 'IS 383, Zone II grading' }, 4],
  ['material', 'aggregate', 'Coarse Aggregate (20mm)', { qty: 0.608, unit: 'cft', unitPrice: 38, note: 'IS 383, angular crushed' }, 5],
  ['material', 'paint', 'Interior & Exterior Paint', { qty: 0.18, unit: 'ltr', unitPrice: 320, note: '2 coats primer + 2 coats finish' }, 6],
  ['material', 'tiles', 'Floor Tiles (Vitrified)', { qty: 1.3, unit: 'sqft', unitPrice: 50, note: '600x600mm, 8mm thick' }, 7],
  ['material', 'water', 'Water for Construction', { qty: 0.2, unit: 'kL', unitPrice: 50, note: 'IS 456 compliant' }, 8],
  ['material', 'wood', 'Wood (Doors & Frames)', { qty: 0.02, unit: 'cft', unitPrice: 2800, note: 'IS 1003, seasoned timber' }, 9],
];
for (const [cat, key, label, val, ord] of materialRates) insertRate.run(cat, key, label, JSON.stringify(val), ord);

// Labour rates
const labourRates = [
  ['labour', 'excavation', 'Excavation & Foundation', { rate: 75, percent: 12 }, 1],
  ['labour', 'rcc_structure', 'RCC Structure (Column, Beam, Slab)', { rate: 180, percent: 28 }, 2],
  ['labour', 'brickwork', 'Brickwork & Masonry', { rate: 95, percent: 16 }, 3],
  ['labour', 'plastering', 'Plastering (Int + Ext)', { rate: 55, percent: 9 }, 4],
  ['labour', 'flooring', 'Flooring & Tiling', { rate: 42, percent: 7 }, 5],
  ['labour', 'painting', 'Painting & Finishing', { rate: 45, percent: 7 }, 6],
  ['labour', 'plumbing', 'Plumbing & Sanitary', { rate: 50, percent: 8 }, 7],
  ['labour', 'electrical', 'Electrical Wiring & Fittings', { rate: 40, percent: 6 }, 8],
  ['labour', 'carpentry', 'Carpentry (Doors & Windows)', { rate: 30, percent: 5 }, 9],
  ['labour', 'misc', 'Miscellaneous & Cleanup', { rate: 15, percent: 2 }, 10],
];
for (const [cat, key, label, val, ord] of labourRates) insertRate.run(cat, key, label, JSON.stringify(val), ord);

// City multipliers
const cityRates = [
  ['city', 'mumbai', 'Mumbai', { factor: 1.25 }, 1],
  ['city', 'delhi', 'Delhi NCR', { factor: 1.15 }, 2],
  ['city', 'bangalore', 'Bangalore', { factor: 1.10 }, 3],
  ['city', 'chennai', 'Chennai', { factor: 1.05 }, 4],
  ['city', 'hyderabad', 'Hyderabad', { factor: 1.05 }, 5],
  ['city', 'kolkata', 'Kolkata', { factor: 0.95 }, 6],
  ['city', 'pune', 'Pune', { factor: 1.08 }, 7],
  ['city', 'ahmedabad', 'Ahmedabad', { factor: 0.98 }, 8],
  ['city', 'tier2', 'Tier-II City', { factor: 0.90 }, 9],
  ['city', 'tier3', 'Small Town / Rural', { factor: 0.80 }, 10],
];
for (const [cat, key, label, val, ord] of cityRates) insertRate.run(cat, key, label, JSON.stringify(val), ord);

// Finish levels
const finishRates = [
  ['finish', 'basic', 'Basic', { costPerSqft: 1600, description: 'Standard fittings, basic tiles, economy paint' }, 1],
  ['finish', 'standard', 'Standard', { costPerSqft: 2200, description: 'Branded fittings, vitrified tiles, quality paint' }, 2],
  ['finish', 'premium', 'Premium', { costPerSqft: 3200, description: 'Imported fittings, marble/granite, designer finishes' }, 3],
  ['finish', 'luxury', 'Luxury', { costPerSqft: 4500, description: 'Top-tier imported materials, smart home, custom design' }, 4],
];
for (const [cat, key, label, val, ord] of finishRates) insertRate.run(cat, key, label, JSON.stringify(val), ord);

// Cost categories (stage-wise breakdown per sqft by finish)
const costCatRates = [
  ['cost_category', 'excavation', 'Excavation & Foundation', { basic: 150, standard: 175, premium: 200, luxury: 225 }, 1],
  ['cost_category', 'rcc', 'RCC Structure', { basic: 700, standard: 800, premium: 900, luxury: 1000 }, 2],
  ['cost_category', 'brickwork', 'Brickwork & Walls', { basic: 200, standard: 250, premium: 300, luxury: 350 }, 3],
  ['cost_category', 'plastering', 'Plastering', { basic: 80, standard: 100, premium: 130, luxury: 160 }, 4],
  ['cost_category', 'flooring', 'Flooring & Tiling', { basic: 80, standard: 120, premium: 200, luxury: 350 }, 5],
  ['cost_category', 'plumbing', 'Plumbing & Sanitary', { basic: 100, standard: 150, premium: 200, luxury: 300 }, 6],
  ['cost_category', 'electrical', 'Electrical Work', { basic: 90, standard: 130, premium: 175, luxury: 250 }, 7],
  ['cost_category', 'painting', 'Painting & Finishing', { basic: 45, standard: 80, premium: 130, luxury: 200 }, 8],
  ['cost_category', 'doors', 'Doors, Windows & Carpentry', { basic: 60, standard: 100, premium: 180, luxury: 280 }, 9],
  ['cost_category', 'misc', 'Miscellaneous & Contingency', { basic: 95, standard: 115, premium: 185, luxury: 285 }, 10],
];
for (const [cat, key, label, val, ord] of costCatRates) insertRate.run(cat, key, label, JSON.stringify(val), ord);

// Steel distribution
const steelDistRates = [
  ['steel_distribution', 'footings', 'Footings', { percent: 18 }, 1],
  ['steel_distribution', 'columns', 'Columns', { percent: 22 }, 2],
  ['steel_distribution', 'beams', 'Beams', { percent: 23 }, 3],
  ['steel_distribution', 'slabs', 'Slabs', { percent: 27 }, 4],
  ['steel_distribution', 'staircase', 'Staircase', { percent: 6 }, 5],
  ['steel_distribution', 'misc', 'Lintels & Misc', { percent: 4 }, 6],
];
for (const [cat, key, label, val, ord] of steelDistRates) insertRate.run(cat, key, label, JSON.stringify(val), ord);

// Floor steel rates
const floorSteelRates = [
  ['floor_steel', '1', 'G (Single Storey)', { steelPerSqft: 3.5 }, 1],
  ['floor_steel', '2', 'G+1 (Two Storey)', { steelPerSqft: 4.5 }, 2],
  ['floor_steel', '3', 'G+2 (Three Storey)', { steelPerSqft: 5.0 }, 3],
  ['floor_steel', '4', 'G+3 (Four Storey)', { steelPerSqft: 5.5 }, 4],
];
for (const [cat, key, label, val, ord] of floorSteelRates) insertRate.run(cat, key, label, JSON.stringify(val), ord);

console.log('  Inserted estimator master rates across 7 categories');

// ===== CHANGE ORDERS =====
console.log('Seeding change orders...');
const insertCO = db.prepare(`INSERT INTO change_orders (co_code, project_id, stage_id, title, description, reason, type, cost_impact, schedule_impact_days, status, requested_by, approved_by, approved_at, due_date, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
insertCO.run('CO-001', 1, 4, 'Additional structural reinforcement for 2nd floor slab', 'Engineer recommended additional top reinforcement in slab S4 due to revised load calculation for overhead water tank.', 'Revised structural analysis showed higher bending moment at mid-span. Additional 10mm bars at 150mm c/c required.', 'design_change', 85000, 5, 'Approved', 3, 1, '2026-02-15 10:30:00', '2026-02-20', '2026-02-10 09:00:00', '2026-02-15 10:30:00');
insertCO.run('CO-002', 1, 7, 'Upgrade electrical wiring from copper to FRLS cable', 'Client requested fire-retardant low-smoke (FRLS) cables throughout the building for enhanced safety compliance.', 'Client preference after reviewing NBC 2016 Part 4 fire safety recommendations. FRLS cables provide 30% better fire resistance.', 'client_request', 120000, 3, 'Approved', 2, 1, '2026-02-18 14:00:00', '2026-02-25', '2026-02-12 11:00:00', '2026-02-18 14:00:00');
insertCO.run('CO-003', 1, 5, 'Change external wall from 230mm brick to 200mm AAC block', 'Replace conventional clay brick external walls with AAC blocks for better thermal insulation and faster construction.', 'AAC blocks offer 4x better thermal insulation, 30% lighter weight reducing structural load, and faster laying speed.', 'value_engineering', -45000, -7, 'Under Review', 2, null, null, '2026-03-10', '2026-03-01 10:00:00', '2026-03-01 10:00:00');
insertCO.run('CO-004', 1, 9, 'Upgrade master bedroom flooring to Italian marble', 'Client requested premium Italian Statuario marble for master bedroom and living room instead of standard vitrified tiles.', 'Client visited showroom and selected Statuario marble (Rs. 450/sqft vs Rs. 90/sqft for vitrified tiles). Area: 650 sqft.', 'client_request', 234000, 8, 'Submitted', 1, null, null, '2026-03-15', '2026-03-05 16:00:00', '2026-03-05 16:00:00');
insertCO.run('CO-005', 1, 3, 'Additional anti-termite treatment for compound wall foundation', 'Extended anti-termite chemical barrier treatment to compound wall foundation area which was not in original scope.', 'During foundation inspection, soil showed high organic content near compound wall area. Preventive treatment recommended per IS 6313:2013.', 'site_condition', 28000, 2, 'Executed', 3, 1, '2026-01-10 09:00:00', '2026-01-15', '2025-12-28 14:00:00', '2026-01-10 09:00:00');
insertCO.run('CO-006', 2, 14, 'Add solar panel mounting brackets on roof slab', 'Provision for future 5kW rooftop solar panel installation — embed mounting brackets during roof slab casting.', 'Green building compliance and long-term energy savings. Embedding brackets during casting is 60% cheaper than retrofitting.', 'scope_change', 35000, 2, 'Draft', 2, null, null, '2026-04-01', '2026-03-08 11:00:00', '2026-03-08 11:00:00');
insertCO.run('CO-007', 1, 6, 'Upgrade terrace waterproofing to APP membrane system', 'Replace conventional brick bat coba waterproofing with APP modified bitumen membrane for 15-year warranty.', 'After reviewing warranty options, APP membrane offers 15-year guarantee vs 5-year for BBC. Cost premium justified by maintenance savings.', 'value_engineering', 65000, 4, 'Approved', 2, 1, '2026-02-25 11:00:00', '2026-03-05', '2026-02-20 10:00:00', '2026-02-25 11:00:00');
insertCO.run('CO-008', 1, 10, 'Add CCTV conduit and provision in compound wall', 'Pre-install conduit and junction boxes for 8-camera CCTV system in compound wall and building exterior.', 'Security requirement identified during client meeting. Pre-installing conduits during construction avoids wall cutting later.', 'scope_change', 42000, 3, 'Submitted', 2, null, null, '2026-03-20', '2026-03-06 09:00:00', '2026-03-06 09:00:00');

// ===== SAFETY PERMITS =====
console.log('Seeding safety permits...');
const insertPermit = db.prepare(`INSERT INTO safety_permits (permit_code, project_id, stage_id, permit_type, title, description, location, risk_level, precautions, valid_from, valid_to, status, requested_by, approved_by, approved_at, closed_by, closed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
insertPermit.run('PTW-001', 1, 4, 'Height Work', 'Slab formwork and casting at 2nd floor level', 'Working at height >3m for slab formwork erection, reinforcement placement and concrete casting at 2nd floor level (6.5m from ground).', 'Block A - 2nd Floor', 'high', 'Full body harness mandatory for all workers above 2m. Safety net below working platform. Toe boards on all scaffold edges. Tool lanyards for hand tools. Barricade ground level below work area.', '2026-02-15', '2026-02-28', 'Approved', 3, 2, '2026-02-14 16:00:00', null, null);
insertPermit.run('PTW-002', 1, 4, 'Hot Work', 'Welding of steel beam connections at 1st floor', 'Gas cutting and arc welding for steel plate connections at beam-column junctions. Includes grinding of weld beads.', 'Block A - 1st Floor Beam Junctions', 'high', 'Fire extinguisher (ABC type) within 5m. Fire watcher posted during and 30 min after welding. Welding screen to protect adjacent workers. No flammable materials within 10m radius. Hot work area wetted.', '2026-02-10', '2026-02-12', 'Closed', 3, 2, '2026-02-09 10:00:00', 2, '2026-02-12 17:00:00');
insertPermit.run('PTW-003', 1, 3, 'Excavation', 'Foundation trench excavation for compound wall', 'Excavation of trenches 1.2m deep and 0.6m wide for compound wall strip foundation along the plot boundary.', 'Plot Boundary - South & West Side', 'medium', 'Excavated soil stacked min 1m from edge. Barricade tape around open trenches. Ladder access every 15m. No heavy equipment within 2m of trench edge. Daily inspection of trench walls for cracks.', '2025-11-01', '2025-11-15', 'Closed', 3, 2, '2025-10-30 09:00:00', 3, '2025-11-14 16:00:00');
insertPermit.run('PTW-004', 1, 7, 'Electrical', 'Temporary electrical supply connection and DB installation', 'Installation of temporary 3-phase power supply, main DB, and distribution to construction floors. Live wire work involved.', 'Site Entrance & Distribution Points', 'high', 'Only licensed electrician to handle live connections. LOTO procedure for all switching operations. Rubber gloves and insulated tools mandatory. Earth leakage relay tested before energizing. Danger signage at all DBs.', '2026-01-05', '2026-01-10', 'Closed', 3, 2, '2026-01-04 11:00:00', 3, '2026-01-10 18:00:00');
insertPermit.run('PTW-005', 1, 6, 'Height Work', 'Roof waterproofing membrane application', 'Application of APP modified bitumen membrane on terrace slab using gas torch at roof level (10m height).', 'Terrace Slab - Full Area', 'high', 'Full body harness near parapet edges. Gas cylinder secured upright with chain. Fire extinguisher on roof. No work during high wind (>40 kmph). Rubber-soled shoes mandatory for membrane surface.', '2026-04-05', '2026-04-15', 'Draft', 3, null, null, null, null);
insertPermit.run('PTW-006', 1, 4, 'Confined Space', 'Inspection of underground sump before waterproofing', 'Personnel entry into underground water sump (2.5m x 2.5m x 2m deep) for inspection and surface preparation before waterproofing application.', 'Underground Sump - North Side', 'high', 'Atmospheric testing before entry (O2 >19.5%, LEL <10%). Continuous ventilation with blower. Standby person at entry point at all times. Communication device for entrant. Rescue tripod with harness. Entry permit valid for 4 hours only.', '2026-03-01', '2026-03-02', 'Approved', 3, 2, '2026-02-28 15:00:00', null, null);
insertPermit.run('PTW-007', 1, 4, 'General', 'Crane operation for steel beam lifting', 'Mobile crane operation for lifting steel beams (max 2 tonnes) to 2nd floor level. Includes rigging and signaling.', 'Block A - External, Crane Access Road', 'medium', 'Crane operator with valid license. Outrigger pads on firm ground. Load test certificate current. Tagline on all loads. Exclusion zone = 1.5x boom length. Trained signal person with radio. Wind limit 30 kmph.', '2026-02-20', '2026-02-22', 'Approved', 4, 2, '2026-02-19 14:00:00', null, null);

// ===== SAFETY INCIDENTS =====
console.log('Seeding safety incidents...');
const insertIncident = db.prepare(`INSERT INTO safety_incidents (incident_code, project_id, stage_id, incident_type, severity, title, description, location, incident_date, incident_time, persons_involved, injuries, root_cause, corrective_action, preventive_action, status, reported_by, investigated_by, closed_by, closed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
insertIncident.run('INC-001', 1, 4, 'Near Miss', 'minor', 'Unsecured formwork panel fell from 1st floor', 'A loose plywood formwork panel (1.2m x 0.6m) slipped from 1st floor slab edge and fell to ground level. No workers were in the fall zone at the time.', 'Block A - 1st Floor South Edge', '2026-02-08', '11:30', 'Raju (carpenter), Mohan (helper)', 'None - no one in fall zone', 'Formwork panels were stacked vertically against parapet without securing with nails or wire. Wind gust dislodged the panel.', 'All loose formwork panels secured immediately with wire ties. Ground-level barricade extended by 2m around working area.', 'Toolbox talk on securing materials at height. Mandatory wire-tying of all stacked panels. Daily inspection checklist updated to include formwork securing check.', 'Closed', 3, 7, 2, '2026-02-10 16:00:00');
insertIncident.run('INC-002', 1, 4, 'Injury', 'moderate', 'Worker stepped on exposed rebar and punctured foot', 'A mason helper stepped on a vertical starter bar (12mm) projecting from the plinth beam while walking across the work area. The rebar penetrated through the sole of his regular shoes.', 'Block A - Ground Floor, Column Line C', '2026-02-12', '14:15', 'Sunil Kumar (mason helper)', 'Puncture wound on right foot sole, approximately 15mm deep. First aid administered on site, referred to clinic.', 'Exposed vertical rebar ends were not capped with mushroom caps or bent over. Worker was wearing regular footwear instead of safety shoes with steel sole plate.', 'All exposed rebar ends capped with plastic mushroom caps within 2 hours. Worker provided with steel-soled safety shoes. Medical expenses covered.', 'Mandatory steel-soled safety shoes for all workers in rebar areas. Rebar cap installation added as daily checklist item. Weekly safety audit to check compliance.', 'Closed', 4, 7, 2, '2026-02-15 10:00:00');
insertIncident.run('INC-003', 1, 4, 'Near Miss', 'minor', 'Concrete bucket swung during crane lifting', 'During concrete pouring using crane and bucket, the 0.5 cum concrete bucket swung approximately 1.5m due to sudden crane slew. Two workers on the slab moved away in time.', 'Block A - 2nd Floor Slab', '2026-02-18', '10:45', 'Crane operator Shankar, signal man Ramu, 2 slab workers', 'None - workers moved clear', 'Crane operator slewed too fast while positioning bucket. Tagline was not being used to control bucket swing. Signal man was distracted.', 'Crane operator counseled. Tagline use made mandatory for all suspended loads. Dedicated signal man assigned with no other duties during lifting.', 'Crane operation SOP updated. Pre-lift briefing mandatory. Signal man to have radio communication with operator. Maximum slew speed restricted to 50%.', 'Investigated', 3, 7, null, null);
insertIncident.run('INC-004', 1, 4, 'Property Damage', 'minor', 'Scaffolding collapsed during dismantling', 'Two bays of cup-lock scaffolding (height 4m) collapsed during dismantling when a worker removed the bottom standard before upper sections were lowered. No injuries as area was barricaded.', 'Block A - East Side External Wall', '2026-02-22', '16:00', 'Scaffolding crew (3 workers)', 'None - area was barricaded', 'Incorrect dismantling sequence — bottom standards removed before top sections. Scaffolding crew was not trained in correct dismantling procedure.', 'Scaffolding crew retrained on correct dismantling sequence (top-down). Damaged scaffolding materials replaced. Supervisor to be present during all dismantling.', 'Only trained and certified scaffolders to erect/dismantle scaffolding. Written method statement required for scaffolding operations. Permit required for scaffold modification.', 'Reported', 4, null, null, null);
insertIncident.run('INC-005', 1, 3, 'Injury', 'major', 'Worker fell into open excavation trench', 'A laborer fell into an unbarricaded section of the foundation excavation trench (1.8m deep) while carrying a head-load of bricks in low-light conditions at 6:15 PM.', 'Plot Boundary - West Side Trench', '2025-11-12', '18:15', 'Ramaiah (laborer)', 'Fractured left wrist, multiple abrasions on arms and face. Taken to hospital by ambulance. 6 weeks medical leave.', 'Section of barricade tape had been removed for material access and not replaced. Work continued past daylight without adequate artificial lighting. Worker carrying head-load had restricted downward vision.', 'All excavation barricades restored with rigid barriers (not tape). Portable flood lights installed at all open excavations. Head-load carrying prohibited near open trenches. Ambulance contact displayed at site.', 'Rigid barricading with reflective strips mandatory for all excavations >1m. Adequate lighting (min 50 lux) at all open excavation areas. Work stoppage 30 minutes before sunset unless flood-lit. Safety induction refreshed for all workers.', 'Closed', 3, 7, 2, '2025-11-25 14:00:00');
insertIncident.run('INC-006', 1, 4, 'Environmental', 'minor', 'Cement slurry discharge into storm drain', 'During concrete curing, cement-laden water from slab curing ran off through a gap in the bund wall into the site storm drain leading to the public drain.', 'Block A - Ground Floor Slab, North Side', '2026-01-20', '09:00', 'Site supervisor Pradeep', 'None - environmental concern', 'Curing water containment bund had a 300mm gap where a pipe penetrated. No silt trap installed at the storm drain inlet.', 'Gap in bund wall sealed immediately. Temporary silt trap installed at drain inlet. Affected drain section flushed with clean water.', 'Bund walls inspected weekly for gaps. Permanent silt trap with filter fabric at all drain inlets. Curing water to be recycled where possible. Monthly water quality check at site discharge point.', 'Closed', 3, 7, 2, '2026-01-28 11:00:00');

// ===== RA BILLS =====
console.log('Seeding RA bills...');
const insertRABill = db.prepare(`INSERT INTO ra_bills (bill_code, project_id, vendor_id, bill_number, title, description, period_from, period_to, gross_amount, previous_amount, current_amount, retention_percent, retention_amount, deductions, net_payable, status, prepared_by, verified_by, approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
insertRABill.run('RAB-001', 1, 3, 1, 'RA Bill #1 - Foundation Work', 'First running account bill for foundation stage — excavation, PCC, footing, plinth beam, anti-termite treatment and backfilling as per BOQ items 3.1 to 3.7.', '2025-10-21', '2025-12-15', 1180000, 0, 1180000, 5, 59000, 15000, 1106000, 'Approved', 6, 3, 1, '2025-12-28 10:00:00');
insertRABill.run('RAB-002', 1, 3, 2, 'RA Bill #2 - Structure (Part 1)', 'Second RA bill covering structural work up to 1st floor slab — columns, beams, slab reinforcement and casting for ground and first floors.', '2025-12-16', '2026-01-31', 2100000, 1180000, 920000, 5, 46000, 8000, 866000, 'Approved', 6, 3, 1, '2026-02-10 14:00:00');
insertRABill.run('RAB-003', 1, 3, 3, 'RA Bill #3 - Structure (Part 2)', 'Third RA bill for 2nd floor column and beam work, lintel casting, and partial slab reinforcement. Includes crane charges and formwork.', '2026-02-01', '2026-02-28', 2850000, 2100000, 750000, 5, 37500, 5000, 707500, 'Under Review', 6, 3, null, null);
insertRABill.run('RAB-004', 1, 4, 1, 'RA Bill #1 - Electrical Rough-in (Advance)', 'Advance bill for electrical conduit laying in ground floor walls and slab — conduit material, junction boxes and labor for concealed wiring preparation.', '2026-01-15', '2026-02-15', 180000, 0, 180000, 10, 18000, 2000, 160000, 'Submitted', 6, null, null, null);
insertRABill.run('RAB-005', 1, 5, 1, 'RA Bill #1 - Plumbing Rough-in', 'First bill for plumbing rough-in work — underground drainage, soil pipe installation, water supply pipe laying for ground floor.', '2026-01-20', '2026-02-20', 95000, 0, 95000, 5, 4750, 0, 90250, 'Draft', 6, null, null, null);
insertRABill.run('RAB-006', 2, 3, 1, 'RA Bill #1 - Sharma Duplex Foundation', 'First running account bill for Sharma Duplex foundation work — excavation, PCC, isolated footings and plinth beam.', '2026-03-01', '2026-03-31', 210000, 0, 210000, 5, 10500, 0, 199500, 'Submitted', 6, null, null, null);

// ===== DOCUMENTS =====
console.log('Seeding documents...');
const insertDoc = db.prepare(`INSERT INTO documents (doc_code, project_id, stage_id, title, category, doc_type, revision, revision_date, description, status, uploaded_by, reviewed_by, approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
insertDoc.run('DOC-001', 1, null, 'Architectural Floor Plans - All Levels', 'Architectural', 'drawing', 'R2', '2025-09-15', 'Complete floor plans for ground floor, first floor, second floor and terrace level with dimensions, room labels and area statements.', 'Approved', 2, 7, 1, '2025-09-20 10:00:00');
insertDoc.run('DOC-002', 1, null, 'Structural Design Report', 'Structural', 'report', 'R1', '2025-09-05', 'Detailed structural analysis report including load calculations, member design, seismic analysis per IS 1893, wind load per IS 875, and foundation design recommendations.', 'Approved', 3, 7, 1, '2025-09-10 14:00:00');
insertDoc.run('DOC-003', 1, 3, 'Foundation Reinforcement Details', 'Structural', 'drawing', 'R1', '2025-10-20', 'Footing reinforcement layout, pedestal details, plinth beam reinforcement with bar bending schedule as per SP 34:1987.', 'Approved', 3, 7, 1, '2025-10-25 09:00:00');
insertDoc.run('DOC-004', 1, 4, 'Column & Beam Schedule - Superstructure', 'Structural', 'drawing', 'R2', '2026-01-10', 'Column sizes, reinforcement and tie spacing per floor. Beam schedule with top/bottom bars, stirrup details. Updated for revised 2nd floor slab loading.', 'Approved', 3, 7, 2, '2026-01-15 11:00:00');
insertDoc.run('DOC-005', 1, 7, 'Electrical Layout and Single Line Diagram', 'MEP', 'drawing', 'R1', '2025-09-08', 'Floor-wise electrical layout showing conduit runs, switch board positions, DB locations. Single line diagram with MCB sizing.', 'Under Review', 3, null, null, null);
insertDoc.run('DOC-006', 1, 7, 'Plumbing Isometric and Drainage Layout', 'MEP', 'drawing', 'R1', '2025-09-08', 'Water supply isometric drawing, drainage layout with pipe sizes and slopes, fixture schedule and rainwater harvesting plan.', 'Under Review', 3, null, null, null);
insertDoc.run('DOC-007', 1, null, 'Soil Investigation Report', 'Civil', 'report', 'R0', '2025-08-05', 'Complete geotechnical investigation report with borehole logs, SPT values, soil classification per IS 1498, SBC determination and foundation recommendations.', 'Approved', 3, 7, 1, '2025-08-10 10:00:00');
insertDoc.run('DOC-008', 1, null, 'Bill of Quantities (BOQ)', 'Specification', 'specification', 'R1', '2025-09-20', 'Detailed bill of quantities with 11 stages, item descriptions, quantities computed per IS 1200, unit rates from current DSR, and abstract of cost.', 'Approved', 2, 6, 1, '2025-09-25 16:00:00');
insertDoc.run('DOC-009', 1, null, 'Building Plan Approval Copy', 'Civil', 'certificate', 'R0', '2025-10-18', 'Sanctioned building plan from BBMP with approval number, FAR/FSI verification, setback compliance and commencement certificate.', 'Approved', 2, null, 1, '2025-10-20 09:00:00');
insertDoc.run('DOC-010', 1, 3, 'Foundation Completion Certificate', 'Civil', 'certificate', 'R0', '2025-12-15', 'Foundation stage completion certificate signed by structural engineer and quality inspector. Includes concrete cube test results and as-built dimensions.', 'Approved', 7, 3, 1, '2025-12-18 14:00:00');
insertDoc.run('DOC-011', 1, null, 'Safety Management Plan', 'Safety', 'manual', 'R1', '2025-10-01', 'Comprehensive safety management plan covering PPE requirements, permit-to-work procedures, emergency evacuation plan, first aid provisions and safety training schedule.', 'Approved', 2, 7, 1, '2025-10-05 10:00:00');
insertDoc.run('DOC-012', 1, 4, 'Concrete Mix Design Report - M25', 'Specification', 'report', 'R0', '2025-12-10', 'Concrete mix design for M25 grade per IS 10262:2019. Water-cement ratio 0.44, slump 100mm, target mean strength 31.6 MPa. Trial mix results attached.', 'Approved', 3, 7, 2, '2025-12-12 11:00:00');
insertDoc.run('DOC-013', 2, null, 'Sharma Duplex - Architectural Plans', 'Architectural', 'drawing', 'R0', '2026-02-08', 'Floor plans, sections and elevations for Sharma Duplex project. Ground floor + First floor layout with staircase details.', 'Approved', 2, null, 1, '2026-02-12 10:00:00');
insertDoc.run('DOC-014', 2, null, 'Sharma Duplex - Structural Drawings', 'Structural', 'drawing', 'R0', '2026-02-15', 'Foundation layout, column schedule, beam schedule and slab reinforcement details for Sharma Duplex.', 'Under Review', 3, null, null, null);
insertDoc.run('DOC-015', 1, 4, 'Cube Test Results - February 2026', 'Specification', 'report', 'R0', '2026-02-28', '7-day and 28-day compressive strength results for concrete cubes collected during February. All 12 samples above target mean strength.', 'Draft', 7, null, null, null);

// ===== COMMENTS =====
console.log('Seeding comments...');
const insertComment = db.prepare(`INSERT INTO comments (entity_type, entity_id, user_id, content, parent_id, created_at) VALUES (?,?,?,?,?,?)`);
// Comments on NCR-001 (entity_id=1)
insertComment.run('ncr', 1, 7, 'Honeycombing observed at column C3 beam junction. Area approximately 300mm x 200mm. Concrete core test recommended before repair.', null, '2026-02-05 16:30:00');
insertComment.run('ncr', 1, 2, 'Agreed. Please arrange for core cutting test at 3 locations on C3. Also check adjacent columns C2 and C4 for similar issues.', null, '2026-02-06 09:15:00');
insertComment.run('ncr', 1, 3, 'Core test done — strength at 98% of design value. Honeycombing is superficial (depth < 25mm). Recommend epoxy grouting repair per IS 15988.', null, '2026-02-08 14:00:00');
insertComment.run('ncr', 1, 4, 'Repair work scheduled for 12th Feb. Will use Fosroc Renderoc RG for grouting. Method statement submitted for approval.', null, '2026-02-09 11:00:00');
// Comments on RFI-001 (entity_id=1)
insertComment.run('rfi', 1, 3, 'Drawing shows 16mm bars for beam B4 but the schedule has 12mm. Which one to follow? Need clarification before reinforcement cutting.', null, '2026-02-10 08:30:00');
insertComment.run('rfi', 1, 2, 'Checked with structural consultant. Drawing is correct — use 16mm. Schedule had a typo. Revised BBS will be issued today.', null, '2026-02-10 14:45:00');
// Comments on Change Order CO-003
insertComment.run('change_order', 3, 2, 'AAC blocks will also reduce dead load on structure by approximately 30%. This could allow us to optimize beam sizes at brickwork stage.', null, '2026-03-02 10:00:00');
insertComment.run('change_order', 3, 3, 'Confirmed — AAC block density 550-650 kg/m3 vs brick 1800 kg/m3. Structural loads will reduce significantly. Recommend proceeding.', null, '2026-03-03 09:30:00');
insertComment.run('change_order', 3, 1, 'Good analysis. Please provide a comparative cost sheet — material + labor for both options before I approve.', null, '2026-03-04 16:00:00');
// Comments on Safety Incident INC-002
insertComment.run('safety_incident', 2, 7, 'Inspected the site — found 23 exposed rebar ends without caps in the work area. This is a serious PPE compliance gap.', null, '2026-02-13 09:00:00');
insertComment.run('safety_incident', 2, 2, 'Ordered 500 mushroom caps immediately. All exposed bars to be capped by end of day. Steel-soled shoes ordered for all workers in rebar zones.', null, '2026-02-13 10:30:00');
// Comments on RA Bill RAB-003
insertComment.run('ra_bill', 3, 6, 'Bill amount verified against site measurements. Quantity of column concrete is 2 cum higher than measured — needs reconciliation.', null, '2026-03-02 14:00:00');
insertComment.run('ra_bill', 3, 3, 'Rechecked measurements — the 2 cum difference is from column C7 and C8 pedestal widening approved in CO-001. Supporting measurement sheet attached.', null, '2026-03-03 11:00:00');
// Comments on Document DOC-004
insertComment.run('document', 4, 7, 'Revision R2 shows updated reinforcement for 2nd floor as per CO-001. All changes marked in cloud. Ready for site use.', null, '2026-01-12 10:00:00');
insertComment.run('document', 4, 3, 'Confirmed. R2 drawings downloaded and distributed to site team. Old R1 copies collected and stamped SUPERSEDED.', null, '2026-01-15 14:00:00');

// ===== NOTIFICATIONS =====
console.log('Seeding notifications...');
const insertNotif = db.prepare(`INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, triggered_by, is_read, created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
// Notifications for PM (user 2)
insertNotif.run(2, 'ncr', 'New NCR Raised', 'NCR-001: Honeycombing in Column C3 has been raised by Inspector', 'ncr', 1, 7, 1, '2026-02-05 16:00:00');
insertNotif.run(2, 'safety', 'Safety Incident Reported', 'INC-002: Worker foot puncture by exposed rebar reported at Block A', 'safety_incident', 2, 4, 1, '2026-02-12 14:30:00');
insertNotif.run(2, 'change_order', 'Change Order Comment', 'Mr. Kumar asked for comparative cost sheet on CO-003 (AAC block change)', 'change_order', 3, 1, 0, '2026-03-04 16:00:00');
insertNotif.run(2, 'ra_bill', 'RA Bill Submitted', 'RAB-003 for Structure Part 2 (Rs. 7,50,000) submitted for review', 'ra_bill', 3, 6, 0, '2026-03-01 09:00:00');
insertNotif.run(2, 'document', 'Document Revision', 'DOC-004 Column & Beam Schedule revised to R2 with CO-001 changes', 'document', 4, 3, 1, '2026-01-10 11:00:00');
// Notifications for Owner (user 1)
insertNotif.run(1, 'change_order', 'Change Order Submitted', 'CO-004: Italian marble upgrade for master bedroom (Rs. 2,34,000 impact) needs your review', 'change_order', 4, 1, 0, '2026-03-05 16:30:00');
insertNotif.run(1, 'ra_bill', 'RA Bill Pending Approval', 'RAB-003 verified by site engineer, pending your approval (Net: Rs. 7,07,500)', 'ra_bill', 3, 3, 0, '2026-03-03 12:00:00');
insertNotif.run(1, 'safety', 'Major Safety Incident', 'INC-005: Worker fell into excavation trench — fractured wrist, hospitalized', 'safety_incident', 5, 3, 1, '2025-11-12 19:00:00');
// Notifications for Engineer (user 3)
insertNotif.run(3, 'ncr', 'NCR Assigned to You', 'NCR-001: Investigate honeycombing in Column C3 and recommend repair method', 'ncr', 1, 2, 1, '2026-02-06 09:30:00');
insertNotif.run(3, 'rfi', 'RFI Response Needed', 'RFI about beam B4 reinforcement discrepancy — drawing vs schedule conflict', 'rfi', 1, 3, 1, '2026-02-10 09:00:00');
insertNotif.run(3, 'safety', 'Permit Approved', 'PTW-006: Confined space entry permit for sump inspection approved', 'safety_permit', 6, 2, 0, '2026-02-28 15:30:00');
// Notifications for Contractor (user 4)
insertNotif.run(4, 'ncr', 'NCR Repair Assignment', 'NCR-001: Repair honeycombing in Column C3 — method statement required', 'ncr', 1, 2, 1, '2026-02-07 10:00:00');
insertNotif.run(4, 'safety', 'Safety Alert', 'All scaffolding operations now require written permit and certified scaffolder presence', 'safety_incident', 4, 2, 0, '2026-02-23 08:00:00');
// Notifications for Inspector (user 7)
insertNotif.run(7, 'document', 'Document for Review', 'DOC-005: Electrical Layout drawing submitted for your review', 'document', 5, 3, 0, '2025-09-09 10:00:00');
insertNotif.run(7, 'safety', 'Incident Investigation Assigned', 'INC-003: Investigate concrete bucket swing near-miss during crane operation', 'safety_incident', 3, 2, 0, '2026-02-18 12:00:00');
// Notifications for Accounts (user 6)
insertNotif.run(6, 'ra_bill', 'RA Bill Approved', 'RAB-002 approved by owner. Net payable Rs. 8,66,000 — process payment', 'ra_bill', 2, 1, 1, '2026-02-10 15:00:00');
insertNotif.run(6, 'ra_bill', 'New RA Bill for Verification', 'RAB-004: Electrical rough-in advance bill (Rs. 1,60,000) from Gupta Electricals', 'ra_bill', 4, 4, 0, '2026-02-16 09:00:00');

// ===== SUBMITTALS =====
console.log('Seeding submittals...');
const insertSub = db.prepare(`INSERT INTO submittals (submittal_code, project_id, stage_id, title, spec_section, submittal_type, description, vendor_id, revision, revision_date, due_date, priority, status, submitted_by, reviewer_id, reviewed_at, review_notes, approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
insertSub.run('SUB-001', 1, 4, 'Structural Steel Shop Drawings - Beams B1 to B8', '05 12 00', 'shop_drawing', 'Shop drawings for all ground floor beams showing reinforcement details, bar bending schedules, connection details and cover requirements as per IS 456:2000.', 2, 'R1', '2026-01-15', '2026-01-25', 'high', 'Approved', 3, 7, '2026-01-20 14:00:00', 'Reviewed and found compliant with structural design. Minor annotation corrections noted.', 1, '2026-01-22 10:00:00');
insertSub.run('SUB-002', 1, 7, 'Electrical Panel and DB Specifications', '26 24 00', 'product_data', 'Product data sheets for main distribution board, sub-DBs, MCBs, RCCBs and surge protection devices. Includes manufacturer catalogues and compliance certificates.', 4, 'R0', '2026-02-01', '2026-02-15', 'medium', 'Under Review', 4, 7, null, null, null, null);
insertSub.run('SUB-003', 1, 9, 'Vitrified Tile Samples - Living and Bedroom Areas', '09 30 00', 'sample', 'Physical samples of 600x600mm vitrified tiles — 3 options for living room (polished glazed) and 2 options for bedrooms (matt finish). Includes slip resistance test reports.', 1, 'R0', '2026-02-10', '2026-02-28', 'medium', 'Submitted', 3, null, null, null, null, null);
insertSub.run('SUB-004', 1, 6, 'Waterproofing Membrane - APP Modified Bitumen', '07 13 00', 'product_data', 'Product data and test certificates for APP modified bitumen waterproofing membrane. Includes manufacturer warranty document, application method statement and third-party test report.', null, 'R0', '2026-02-05', '2026-02-20', 'high', 'Approved as Noted', 3, 7, '2026-02-12 10:00:00', 'Approved. Note: Ensure minimum 100mm overlap at joints and 300mm upturn at parapet as per IS 3067:1988.', 2, '2026-02-14 09:00:00');
insertSub.run('SUB-005', 1, 4, 'Concrete Mix Design Report - M25 Grade', '03 30 00', 'test_report', 'Concrete mix design for M25 grade per IS 10262:2019. Includes trial mix results, 7-day and 28-day cube strength, slump test, and water-cement ratio verification.', 3, 'R0', '2025-12-10', '2025-12-20', 'high', 'Approved', 3, 7, '2025-12-15 11:00:00', 'Mix design meets all specified parameters. Target mean strength 31.6 MPa achieved.', 2, '2025-12-16 10:00:00');
insertSub.run('SUB-006', 1, 5, 'AAC Block Technical Specifications', '04 22 00', 'product_data', 'Technical data for AAC blocks (600x200x200mm) — density, compressive strength, thermal conductivity, fire rating, and IS 2185-Part 3 compliance certificate.', null, 'R0', '2026-03-05', '2026-03-15', 'medium', 'Draft', 3, null, null, null, null, null);
insertSub.run('SUB-007', 1, 7, 'Plumbing Fixture Schedule and Cut Sheets', '22 40 00', 'product_data', 'Complete fixture schedule with manufacturer cut sheets for WC, wash basin, kitchen sink, floor traps, CP fittings. Includes ISI mark certificates.', 5, 'R1', '2026-02-08', '2026-02-22', 'low', 'Revise & Resubmit', 3, 7, '2026-02-18 16:00:00', 'Kitchen sink specification does not match approved drawing. Floor trap grating pattern needs architect approval. Resubmit with corrections.', null, null);
insertSub.run('SUB-008', 1, 10, 'Paint System Method Statement', '09 90 00', 'method_statement', 'Detailed method statement for interior and exterior painting — surface preparation, primer application, putty coats, paint system (2 coats emulsion interior, 2 coats weatherproof exterior).', null, 'R0', '2026-03-01', '2026-03-20', 'low', 'Draft', 4, null, null, null, null, null);

// ===== MEETINGS =====
console.log('Seeding meetings...');
const insertMeeting = db.prepare(`INSERT INTO meetings (meeting_code, project_id, title, meeting_type, meeting_date, start_time, end_time, location, attendees, agenda, minutes, decisions, status, organized_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insertAction = db.prepare(`INSERT INTO meeting_action_items (meeting_id, description, assigned_to, due_date, status, completed_at) VALUES (?,?,?,?,?,?)`);

const m1 = insertMeeting.run('MOM-001', 1, 'Weekly Progress Review - Week 8', 'progress', '2026-02-20', '10:00', '11:30', 'Site Office', 'Rajesh Sharma, Ramesh K., MK Construction, Vijay R., Mr. Kumar', '1. Review structural work progress\n2. Column casting schedule for 2nd floor\n3. Material delivery status\n4. Safety compliance review\n5. Budget status update', '1. Structure stage at 65% completion. 2nd floor columns 80% cast.\n2. Beam formwork for B3-B6 underway. Slab casting planned for March 5th.\n3. Steel delivery delayed by 2 days — supplier confirmed delivery by Feb 22.\n4. One near-miss incident reported (formwork panel). Safety briefing conducted.\n5. Structure stage budget 66% utilized (Rs. 14.5L of Rs. 22L).', '1. Slab casting date confirmed: March 5th (subject to beam formwork completion)\n2. Additional safety nets to be installed before slab work begins\n3. Next concrete cube test: Feb 25th for 2nd floor columns', 'Completed', 2).lastInsertRowid;
insertAction.run(m1, 'Arrange steel delivery follow-up with Raj Steel Traders', 5, '2026-02-22', 'completed', '2026-02-21 14:00:00');
insertAction.run(m1, 'Install safety nets at 2nd floor slab perimeter before March 1', 4, '2026-03-01', 'completed', '2026-02-28 16:00:00');
insertAction.run(m1, 'Schedule concrete cube test for Feb 25 and inform lab', 3, '2026-02-23', 'completed', '2026-02-23 09:00:00');
insertAction.run(m1, 'Prepare revised slab casting schedule incorporating beam delays', 2, '2026-02-25', 'completed', '2026-02-24 11:00:00');

const m2 = insertMeeting.run('MOM-002', 1, 'Safety Review Meeting', 'safety', '2026-02-15', '14:00', '15:00', 'Site Office', 'Rajesh Sharma, Ramesh K., MK Construction, Vijay R.', '1. Review of recent incidents and near-misses\n2. PPE compliance audit results\n3. Scaffolding inspection findings\n4. Permit-to-work status\n5. Emergency preparedness drill planning', '1. Two incidents reviewed: INC-001 (formwork fall) and INC-002 (rebar puncture).\n2. PPE compliance at 85% — 3 workers found without safety helmets.\n3. Cup-lock scaffolding inspection passed with minor observations.\n4. Three active PTWs — all valid and displayed at work locations.\n5. Fire drill scheduled for March 1st.', '1. Zero tolerance for PPE non-compliance — offenders to be sent off site\n2. All rebar ends must be capped within 24 hours of exposure\n3. Weekly scaffolding inspection mandatory before Monday start', 'Completed', 2).lastInsertRowid;
insertAction.run(m2, 'Procure 500 mushroom caps for rebar protection', 5, '2026-02-18', 'completed', '2026-02-17 10:00:00');
insertAction.run(m2, 'Conduct PPE compliance training for all workers', 4, '2026-02-20', 'completed', '2026-02-19 08:00:00');
insertAction.run(m2, 'Prepare fire drill plan and coordinate with local fire station', 3, '2026-02-25', 'open', null);

const m3 = insertMeeting.run('MOM-003', 1, 'Client Design Review - Interior Finishes', 'client', '2026-03-05', '11:00', '12:30', 'Architect Office', 'Mr. Kumar, Rajesh Sharma, Architect Priya M.', '1. Review flooring material selections\n2. Kitchen layout finalization\n3. Bathroom fixture selections\n4. Paint color scheme approval\n5. Electrical fixture positions review', '1. Mr. Kumar selected Statuario marble for master bedroom (CO-004 raised).\n2. Kitchen layout approved with modification to platform height (36 inch).\n3. Bathroom fixtures: Kohler selected for master bath, Parryware for other baths.\n4. Paint colors: Asian Paints Royale Matt — living room "Ivory Coast", bedrooms "Serene Beige".\n5. Electrical positions reviewed — 4 additional power points requested in living room.', '1. Marble flooring change order to be processed (CO-004)\n2. Kitchen platform height changed to 36 inches from 34 inches\n3. Architect to issue revised interior finish schedule by March 10\n4. Additional power points to be included in revised electrical layout', 'Completed', 2).lastInsertRowid;
insertAction.run(m3, 'Process Change Order CO-004 for marble flooring upgrade', 2, '2026-03-10', 'open', null);
insertAction.run(m3, 'Issue revised interior finish schedule with all selections', 2, '2026-03-10', 'open', null);
insertAction.run(m3, 'Update electrical layout drawing with 4 additional power points in living room', 3, '2026-03-12', 'open', null);

const m4 = insertMeeting.run('MOM-004', 1, 'Weekly Progress Review - Week 10', 'progress', '2026-03-06', '10:00', '11:30', 'Site Office', 'Rajesh Sharma, Ramesh K., MK Construction, Mr. Kumar', '1. 2nd floor slab readiness review\n2. Change orders status update\n3. RA Bill #3 review\n4. Brickwork planning\n5. Schedule update', null, null, 'Scheduled', 2).lastInsertRowid;

const m5 = insertMeeting.run('MOM-005', 1, 'Coordination Meeting - MEP Services', 'coordination', '2026-03-12', '14:00', '15:30', 'Site Office', 'Rajesh Sharma, Ramesh K., Gupta Electricals, Sharma Plumbing', '1. Coordinate electrical and plumbing sleeve positions for 2nd floor slab\n2. Review conduit clash points in beam zones\n3. Water supply riser shaft dimensions\n4. Drainage slope verification\n5. Pre-slab MEP checklist review', null, null, 'Scheduled', 2).lastInsertRowid;

const m6 = insertMeeting.run('MOM-006', 2, 'Sharma Duplex - Project Kickoff', 'kickoff', '2026-03-01', '10:00', '12:00', 'Client Office', 'Rajesh Sharma, Ramesh K., MK Construction', '1. Project scope and timeline review\n2. Team roles and responsibilities\n3. Communication plan\n4. Safety requirements\n5. Quality standards and inspection plan', '1. Foundation work started on schedule. Target completion: April 15.\n2. Team deployed: 1 site engineer, 1 supervisor, 8 masons, 12 laborers.\n3. Weekly progress meetings on Fridays at 3 PM.\n4. Same safety standards as Kumar Villa project.\n5. Hold point inspections at PCC, footing, and plinth beam stages.', '1. Weekly progress reports to be submitted by Friday 5 PM\n2. Material indent to be raised 7 days in advance\n3. First hold point inspection: PCC completion (expected March 10)', 'Completed', 2).lastInsertRowid;
insertAction.run(m6, 'Submit project quality plan for Sharma Duplex', 2, '2026-03-08', 'completed', '2026-03-07 16:00:00');
insertAction.run(m6, 'Arrange soil testing at foundation location', 3, '2026-03-05', 'completed', '2026-03-04 10:00:00');

console.log('\nDatabase seeded successfully!');
console.log('DB location:', DB_PATH);
db.close();
