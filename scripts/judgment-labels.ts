// Judgment labels for the critic distillation (Cycle 15).
// 150 near-decision development pairs — top-2 audition candidates whose
// grammar logits nearly tied — judged one by one by Claude Fable 5 on
// 2026-07-07 from full notation (contour, phrase arc, register, rhythm
// speech, cadence handling, motif development). The notation regenerates
// deterministically from (planSeed, seed) via scripts/generate-judgment-pairs.ts;
// goals come from judgmentGoalForSeed in scripts/judgment-shared.ts.
// Pairs p150-p239 of the generator's output remain unlabeled — banked for
// a future labeling session.

export interface JudgmentLabel {
  id: string;
  planSeed: number;
  aSeed: number;
  bSeed: number;
  preferred: "A" | "B";
}

export const JUDGMENT_LABELS: readonly JudgmentLabel[] = [
 {
  "id": "p0",
  "planSeed": 20174,
  "aSeed": 1483375497,
  "bSeed": 20174,
  "preferred": "A"
 },
 {
  "id": "p1",
  "planSeed": 20347,
  "aSeed": 1436739920,
  "bSeed": 1961788654,
  "preferred": "A"
 },
 {
  "id": "p2",
  "planSeed": 20520,
  "aSeed": 1941021683,
  "bSeed": 1532661665,
  "preferred": "B"
 },
 {
  "id": "p3",
  "planSeed": 20693,
  "aSeed": 1798492069,
  "bSeed": 1838067702,
  "preferred": "B"
 },
 {
  "id": "p4",
  "planSeed": 20866,
  "aSeed": 1204560164,
  "bSeed": 362746979,
  "preferred": "A"
 },
 {
  "id": "p5",
  "planSeed": 21039,
  "aSeed": 21039,
  "bSeed": 338405626,
  "preferred": "A"
 },
 {
  "id": "p6",
  "planSeed": 21212,
  "aSeed": 216119895,
  "bSeed": 98161497,
  "preferred": "A"
 },
 {
  "id": "p7",
  "planSeed": 21385,
  "aSeed": 21385,
  "bSeed": 1015115620,
  "preferred": "B"
 },
 {
  "id": "p8",
  "planSeed": 21558,
  "aSeed": 939288632,
  "bSeed": 21558,
  "preferred": "B"
 },
 {
  "id": "p9",
  "planSeed": 21731,
  "aSeed": 1242840987,
  "bSeed": 1859827441,
  "preferred": "A"
 },
 {
  "id": "p10",
  "planSeed": 21904,
  "aSeed": 382497916,
  "bSeed": 21904,
  "preferred": "B"
 },
 {
  "id": "p11",
  "planSeed": 22077,
  "aSeed": 22077,
  "bSeed": 956348727,
  "preferred": "A"
 },
 {
  "id": "p12",
  "planSeed": 22250,
  "aSeed": 1137776030,
  "bSeed": 716117299,
  "preferred": "A"
 },
 {
  "id": "p13",
  "planSeed": 22423,
  "aSeed": 1127528228,
  "bSeed": 22423,
  "preferred": "A"
 },
 {
  "id": "p14",
  "planSeed": 22596,
  "aSeed": 22596,
  "bSeed": 2010323178,
  "preferred": "A"
 },
 {
  "id": "p15",
  "planSeed": 22769,
  "aSeed": 1088021279,
  "bSeed": 22769,
  "preferred": "A"
 },
 {
  "id": "p16",
  "planSeed": 22942,
  "aSeed": 1361757590,
  "bSeed": 1577534377,
  "preferred": "B"
 },
 {
  "id": "p17",
  "planSeed": 23115,
  "aSeed": 1290740138,
  "bSeed": 708454457,
  "preferred": "B"
 },
 {
  "id": "p18",
  "planSeed": 23288,
  "aSeed": 36092380,
  "bSeed": 23288,
  "preferred": "A"
 },
 {
  "id": "p19",
  "planSeed": 23461,
  "aSeed": 637613959,
  "bSeed": 23461,
  "preferred": "B"
 },
 {
  "id": "p20",
  "planSeed": 23634,
  "aSeed": 87996819,
  "bSeed": 1795787953,
  "preferred": "A"
 },
 {
  "id": "p21",
  "planSeed": 23807,
  "aSeed": 23807,
  "bSeed": 1639741186,
  "preferred": "A"
 },
 {
  "id": "p22",
  "planSeed": 23980,
  "aSeed": 1706056775,
  "bSeed": 748835334,
  "preferred": "B"
 },
 {
  "id": "p23",
  "planSeed": 24153,
  "aSeed": 1033881997,
  "bSeed": 1240728746,
  "preferred": "A"
 },
 {
  "id": "p24",
  "planSeed": 24326,
  "aSeed": 1432413479,
  "bSeed": 1398216530,
  "preferred": "B"
 },
 {
  "id": "p25",
  "planSeed": 24499,
  "aSeed": 2134220075,
  "bSeed": 268452937,
  "preferred": "B"
 },
 {
  "id": "p26",
  "planSeed": 24672,
  "aSeed": 1767109332,
  "bSeed": 24672,
  "preferred": "B"
 },
 {
  "id": "p27",
  "planSeed": 24845,
  "aSeed": 88537610,
  "bSeed": 24845,
  "preferred": "B"
 },
 {
  "id": "p28",
  "planSeed": 25018,
  "aSeed": 2102781673,
  "bSeed": 25018,
  "preferred": "A"
 },
 {
  "id": "p29",
  "planSeed": 25191,
  "aSeed": 60308677,
  "bSeed": 2070694246,
  "preferred": "A"
 },
 {
  "id": "p30",
  "planSeed": 25364,
  "aSeed": 16233420,
  "bSeed": 848492335,
  "preferred": "B"
 },
 {
  "id": "p31",
  "planSeed": 25537,
  "aSeed": 296819575,
  "bSeed": 25537,
  "preferred": "A"
 },
 {
  "id": "p32",
  "planSeed": 25710,
  "aSeed": 1528481947,
  "bSeed": 1202260945,
  "preferred": "B"
 },
 {
  "id": "p33",
  "planSeed": 25883,
  "aSeed": 1325593576,
  "bSeed": 25883,
  "preferred": "A"
 },
 {
  "id": "p34",
  "planSeed": 26056,
  "aSeed": 2094516662,
  "bSeed": 1620211076,
  "preferred": "B"
 },
 {
  "id": "p35",
  "planSeed": 26229,
  "aSeed": 1471490745,
  "bSeed": 550778960,
  "preferred": "A"
 },
 {
  "id": "p36",
  "planSeed": 26402,
  "aSeed": 1422781725,
  "bSeed": 1228958530,
  "preferred": "B"
 },
 {
  "id": "p37",
  "planSeed": 26575,
  "aSeed": 2073715268,
  "bSeed": 1536467438,
  "preferred": "B"
 },
 {
  "id": "p38",
  "planSeed": 26748,
  "aSeed": 1776148903,
  "bSeed": 1791983969,
  "preferred": "B"
 },
 {
  "id": "p39",
  "planSeed": 26921,
  "aSeed": 26921,
  "bSeed": 1771050062,
  "preferred": "A"
 },
 {
  "id": "p40",
  "planSeed": 27094,
  "aSeed": 1258903118,
  "bSeed": 396108442,
  "preferred": "A"
 },
 {
  "id": "p41",
  "planSeed": 27267,
  "aSeed": 27267,
  "bSeed": 425657675,
  "preferred": "B"
 },
 {
  "id": "p42",
  "planSeed": 27440,
  "aSeed": 27440,
  "bSeed": 2130963352,
  "preferred": "A"
 },
 {
  "id": "p43",
  "planSeed": 27613,
  "aSeed": 18421389,
  "bSeed": 1926451278,
  "preferred": "B"
 },
 {
  "id": "p44",
  "planSeed": 27786,
  "aSeed": 339735581,
  "bSeed": 4111222,
  "preferred": "A"
 },
 {
  "id": "p45",
  "planSeed": 27959,
  "aSeed": 1691132230,
  "bSeed": 1027963600,
  "preferred": "A"
 },
 {
  "id": "p46",
  "planSeed": 28132,
  "aSeed": 683812553,
  "bSeed": 28132,
  "preferred": "A"
 },
 {
  "id": "p47",
  "planSeed": 28305,
  "aSeed": 375000549,
  "bSeed": 28305,
  "preferred": "B"
 },
 {
  "id": "p48",
  "planSeed": 28478,
  "aSeed": 793486288,
  "bSeed": 269731977,
  "preferred": "A"
 },
 {
  "id": "p49",
  "planSeed": 28651,
  "aSeed": 253998667,
  "bSeed": 508058468,
  "preferred": "A"
 },
 {
  "id": "p50",
  "planSeed": 28824,
  "aSeed": 1913626085,
  "bSeed": 372149952,
  "preferred": "B"
 },
 {
  "id": "p51",
  "planSeed": 28997,
  "aSeed": 1776457144,
  "bSeed": 1095366928,
  "preferred": "A"
 },
 {
  "id": "p52",
  "planSeed": 29170,
  "aSeed": 1886229649,
  "bSeed": 29170,
  "preferred": "B"
 },
 {
  "id": "p53",
  "planSeed": 29343,
  "aSeed": 1619584607,
  "bSeed": 1212811150,
  "preferred": "B"
 },
 {
  "id": "p54",
  "planSeed": 29516,
  "aSeed": 29516,
  "bSeed": 1079313974,
  "preferred": "B"
 },
 {
  "id": "p55",
  "planSeed": 29689,
  "aSeed": 29689,
  "bSeed": 2084187139,
  "preferred": "A"
 },
 {
  "id": "p56",
  "planSeed": 29862,
  "aSeed": 29862,
  "bSeed": 1420111149,
  "preferred": "A"
 },
 {
  "id": "p57",
  "planSeed": 30035,
  "aSeed": 1102954771,
  "bSeed": 476316456,
  "preferred": "A"
 },
 {
  "id": "p58",
  "planSeed": 30208,
  "aSeed": 478285033,
  "bSeed": 320438675,
  "preferred": "B"
 },
 {
  "id": "p59",
  "planSeed": 30381,
  "aSeed": 41238108,
  "bSeed": 1053654578,
  "preferred": "B"
 },
 {
  "id": "p60",
  "planSeed": 30554,
  "aSeed": 1883840429,
  "bSeed": 1158606276,
  "preferred": "B"
 },
 {
  "id": "p61",
  "planSeed": 30727,
  "aSeed": 2114783718,
  "bSeed": 600208564,
  "preferred": "B"
 },
 {
  "id": "p62",
  "planSeed": 30900,
  "aSeed": 647960135,
  "bSeed": 1709682903,
  "preferred": "A"
 },
 {
  "id": "p63",
  "planSeed": 31073,
  "aSeed": 479723167,
  "bSeed": 1044155514,
  "preferred": "A"
 },
 {
  "id": "p64",
  "planSeed": 31246,
  "aSeed": 31246,
  "bSeed": 568461245,
  "preferred": "A"
 },
 {
  "id": "p65",
  "planSeed": 31419,
  "aSeed": 480317102,
  "bSeed": 223558690,
  "preferred": "B"
 },
 {
  "id": "p66",
  "planSeed": 31592,
  "aSeed": 1648561863,
  "bSeed": 224641647,
  "preferred": "B"
 },
 {
  "id": "p67",
  "planSeed": 31765,
  "aSeed": 1099553620,
  "bSeed": 974009606,
  "preferred": "B"
 },
 {
  "id": "p68",
  "planSeed": 31938,
  "aSeed": 2099964836,
  "bSeed": 31938,
  "preferred": "B"
 },
 {
  "id": "p69",
  "planSeed": 32111,
  "aSeed": 32111,
  "bSeed": 2102819993,
  "preferred": "B"
 },
 {
  "id": "p70",
  "planSeed": 32284,
  "aSeed": 610968955,
  "bSeed": 32284,
  "preferred": "A"
 },
 {
  "id": "p71",
  "planSeed": 32457,
  "aSeed": 136332751,
  "bSeed": 478226526,
  "preferred": "B"
 },
 {
  "id": "p72",
  "planSeed": 32630,
  "aSeed": 1647780647,
  "bSeed": 1064384290,
  "preferred": "A"
 },
 {
  "id": "p73",
  "planSeed": 32803,
  "aSeed": 1042944419,
  "bSeed": 1701313163,
  "preferred": "A"
 },
 {
  "id": "p74",
  "planSeed": 32976,
  "aSeed": 514253405,
  "bSeed": 1688647439,
  "preferred": "B"
 },
 {
  "id": "p75",
  "planSeed": 33149,
  "aSeed": 2052300411,
  "bSeed": 487285712,
  "preferred": "B"
 },
 {
  "id": "p76",
  "planSeed": 33322,
  "aSeed": 324758287,
  "bSeed": 1474969268,
  "preferred": "A"
 },
 {
  "id": "p77",
  "planSeed": 33495,
  "aSeed": 1474516076,
  "bSeed": 1525316987,
  "preferred": "A"
 },
 {
  "id": "p78",
  "planSeed": 33668,
  "aSeed": 1717791928,
  "bSeed": 33668,
  "preferred": "A"
 },
 {
  "id": "p79",
  "planSeed": 33841,
  "aSeed": 1558564704,
  "bSeed": 439848329,
  "preferred": "B"
 },
 {
  "id": "p80",
  "planSeed": 34014,
  "aSeed": 230958964,
  "bSeed": 83591958,
  "preferred": "B"
 },
 {
  "id": "p81",
  "planSeed": 34187,
  "aSeed": 1057862241,
  "bSeed": 34187,
  "preferred": "B"
 },
 {
  "id": "p82",
  "planSeed": 34360,
  "aSeed": 320712111,
  "bSeed": 938736754,
  "preferred": "A"
 },
 {
  "id": "p83",
  "planSeed": 34533,
  "aSeed": 34533,
  "bSeed": 1757048594,
  "preferred": "A"
 },
 {
  "id": "p84",
  "planSeed": 34706,
  "aSeed": 34706,
  "bSeed": 1587841189,
  "preferred": "B"
 },
 {
  "id": "p85",
  "planSeed": 34879,
  "aSeed": 1609298457,
  "bSeed": 622193673,
  "preferred": "B"
 },
 {
  "id": "p86",
  "planSeed": 35052,
  "aSeed": 977086343,
  "bSeed": 913843393,
  "preferred": "B"
 },
 {
  "id": "p87",
  "planSeed": 35225,
  "aSeed": 2031577876,
  "bSeed": 1633022343,
  "preferred": "B"
 },
 {
  "id": "p88",
  "planSeed": 35398,
  "aSeed": 1995432547,
  "bSeed": 1119992761,
  "preferred": "A"
 },
 {
  "id": "p89",
  "planSeed": 35571,
  "aSeed": 1647616949,
  "bSeed": 1113098344,
  "preferred": "A"
 },
 {
  "id": "p90",
  "planSeed": 35744,
  "aSeed": 35744,
  "bSeed": 1584849986,
  "preferred": "A"
 },
 {
  "id": "p91",
  "planSeed": 35917,
  "aSeed": 1214367619,
  "bSeed": 1529199520,
  "preferred": "A"
 },
 {
  "id": "p92",
  "planSeed": 36090,
  "aSeed": 380621202,
  "bSeed": 496024085,
  "preferred": "A"
 },
 {
  "id": "p93",
  "planSeed": 36263,
  "aSeed": 36263,
  "bSeed": 1378620412,
  "preferred": "A"
 },
 {
  "id": "p94",
  "planSeed": 36436,
  "aSeed": 479298498,
  "bSeed": 537012284,
  "preferred": "B"
 },
 {
  "id": "p95",
  "planSeed": 36609,
  "aSeed": 955938660,
  "bSeed": 36609,
  "preferred": "B"
 },
 {
  "id": "p96",
  "planSeed": 36782,
  "aSeed": 837258628,
  "bSeed": 2114078911,
  "preferred": "B"
 },
 {
  "id": "p97",
  "planSeed": 36955,
  "aSeed": 55179693,
  "bSeed": 2086700594,
  "preferred": "B"
 },
 {
  "id": "p98",
  "planSeed": 37128,
  "aSeed": 37128,
  "bSeed": 2110850180,
  "preferred": "A"
 },
 {
  "id": "p99",
  "planSeed": 37301,
  "aSeed": 1784098513,
  "bSeed": 37301,
  "preferred": "B"
 },
 {
  "id": "p100",
  "planSeed": 37474,
  "aSeed": 841930193,
  "bSeed": 952329545,
  "preferred": "B"
 },
 {
  "id": "p101",
  "planSeed": 37647,
  "aSeed": 37647,
  "bSeed": 1323833438,
  "preferred": "A"
 },
 {
  "id": "p102",
  "planSeed": 37820,
  "aSeed": 609850189,
  "bSeed": 742166419,
  "preferred": "A"
 },
 {
  "id": "p103",
  "planSeed": 37993,
  "aSeed": 1288490663,
  "bSeed": 738550018,
  "preferred": "B"
 },
 {
  "id": "p104",
  "planSeed": 38166,
  "aSeed": 38166,
  "bSeed": 2105965723,
  "preferred": "A"
 },
 {
  "id": "p105",
  "planSeed": 38339,
  "aSeed": 373117471,
  "bSeed": 911473906,
  "preferred": "A"
 },
 {
  "id": "p106",
  "planSeed": 38512,
  "aSeed": 1091555005,
  "bSeed": 1194274242,
  "preferred": "B"
 },
 {
  "id": "p107",
  "planSeed": 38685,
  "aSeed": 518867791,
  "bSeed": 282030204,
  "preferred": "A"
 },
 {
  "id": "p108",
  "planSeed": 38858,
  "aSeed": 1590145435,
  "bSeed": 1293866336,
  "preferred": "B"
 },
 {
  "id": "p109",
  "planSeed": 39031,
  "aSeed": 1841644824,
  "bSeed": 849627951,
  "preferred": "B"
 },
 {
  "id": "p110",
  "planSeed": 39204,
  "aSeed": 127135193,
  "bSeed": 432984221,
  "preferred": "A"
 },
 {
  "id": "p111",
  "planSeed": 39377,
  "aSeed": 39377,
  "bSeed": 2083338759,
  "preferred": "B"
 },
 {
  "id": "p112",
  "planSeed": 39550,
  "aSeed": 1548126769,
  "bSeed": 39550,
  "preferred": "B"
 },
 {
  "id": "p113",
  "planSeed": 39723,
  "aSeed": 1553728726,
  "bSeed": 601599874,
  "preferred": "B"
 },
 {
  "id": "p114",
  "planSeed": 39896,
  "aSeed": 639032613,
  "bSeed": 412476473,
  "preferred": "B"
 },
 {
  "id": "p115",
  "planSeed": 40069,
  "aSeed": 374071307,
  "bSeed": 877581277,
  "preferred": "A"
 },
 {
  "id": "p116",
  "planSeed": 40242,
  "aSeed": 1989659513,
  "bSeed": 40242,
  "preferred": "B"
 },
 {
  "id": "p117",
  "planSeed": 40415,
  "aSeed": 422315171,
  "bSeed": 1014069372,
  "preferred": "A"
 },
 {
  "id": "p118",
  "planSeed": 40588,
  "aSeed": 405722023,
  "bSeed": 646446570,
  "preferred": "B"
 },
 {
  "id": "p119",
  "planSeed": 40761,
  "aSeed": 1044456046,
  "bSeed": 115421789,
  "preferred": "B"
 },
 {
  "id": "p120",
  "planSeed": 40934,
  "aSeed": 962624439,
  "bSeed": 83398291,
  "preferred": "A"
 },
 {
  "id": "p121",
  "planSeed": 41107,
  "aSeed": 1097959413,
  "bSeed": 1780516250,
  "preferred": "B"
 },
 {
  "id": "p122",
  "planSeed": 41280,
  "aSeed": 41280,
  "bSeed": 327911132,
  "preferred": "A"
 },
 {
  "id": "p123",
  "planSeed": 41453,
  "aSeed": 41453,
  "bSeed": 164779894,
  "preferred": "B"
 },
 {
  "id": "p124",
  "planSeed": 41626,
  "aSeed": 41626,
  "bSeed": 417602536,
  "preferred": "A"
 },
 {
  "id": "p125",
  "planSeed": 41799,
  "aSeed": 1111720544,
  "bSeed": 1639798500,
  "preferred": "A"
 },
 {
  "id": "p126",
  "planSeed": 41972,
  "aSeed": 41972,
  "bSeed": 1275794343,
  "preferred": "B"
 },
 {
  "id": "p127",
  "planSeed": 42145,
  "aSeed": 846468775,
  "bSeed": 1246257867,
  "preferred": "B"
 },
 {
  "id": "p128",
  "planSeed": 42318,
  "aSeed": 42318,
  "bSeed": 155078821,
  "preferred": "A"
 },
 {
  "id": "p129",
  "planSeed": 42491,
  "aSeed": 1447611555,
  "bSeed": 1710435460,
  "preferred": "B"
 },
 {
  "id": "p130",
  "planSeed": 42664,
  "aSeed": 2110239315,
  "bSeed": 1711970702,
  "preferred": "B"
 },
 {
  "id": "p131",
  "planSeed": 42837,
  "aSeed": 42837,
  "bSeed": 630173602,
  "preferred": "B"
 },
 {
  "id": "p132",
  "planSeed": 43010,
  "aSeed": 1200172006,
  "bSeed": 920916541,
  "preferred": "B"
 },
 {
  "id": "p133",
  "planSeed": 43183,
  "aSeed": 1770141091,
  "bSeed": 1535844065,
  "preferred": "A"
 },
 {
  "id": "p134",
  "planSeed": 43356,
  "aSeed": 647872201,
  "bSeed": 2076418561,
  "preferred": "A"
 },
 {
  "id": "p135",
  "planSeed": 43529,
  "aSeed": 867369955,
  "bSeed": 1551220669,
  "preferred": "A"
 },
 {
  "id": "p136",
  "planSeed": 43702,
  "aSeed": 43702,
  "bSeed": 876914961,
  "preferred": "B"
 },
 {
  "id": "p137",
  "planSeed": 43875,
  "aSeed": 801523726,
  "bSeed": 1121357626,
  "preferred": "B"
 },
 {
  "id": "p138",
  "planSeed": 44048,
  "aSeed": 1536116004,
  "bSeed": 500637233,
  "preferred": "A"
 },
 {
  "id": "p139",
  "planSeed": 44221,
  "aSeed": 1793617200,
  "bSeed": 1108332725,
  "preferred": "A"
 },
 {
  "id": "p140",
  "planSeed": 44394,
  "aSeed": 1480777167,
  "bSeed": 251405315,
  "preferred": "A"
 },
 {
  "id": "p141",
  "planSeed": 44567,
  "aSeed": 1931940210,
  "bSeed": 474296069,
  "preferred": "B"
 },
 {
  "id": "p142",
  "planSeed": 44740,
  "aSeed": 300523855,
  "bSeed": 1935522215,
  "preferred": "B"
 },
 {
  "id": "p143",
  "planSeed": 44913,
  "aSeed": 44913,
  "bSeed": 820076312,
  "preferred": "A"
 },
 {
  "id": "p144",
  "planSeed": 45086,
  "aSeed": 547238813,
  "bSeed": 707459419,
  "preferred": "B"
 },
 {
  "id": "p145",
  "planSeed": 45259,
  "aSeed": 930169970,
  "bSeed": 958651027,
  "preferred": "A"
 },
 {
  "id": "p146",
  "planSeed": 45432,
  "aSeed": 1677373039,
  "bSeed": 617400967,
  "preferred": "A"
 },
 {
  "id": "p147",
  "planSeed": 45605,
  "aSeed": 1074730502,
  "bSeed": 45605,
  "preferred": "A"
 },
 {
  "id": "p148",
  "planSeed": 45778,
  "aSeed": 10204410,
  "bSeed": 45778,
  "preferred": "B"
 },
 {
  "id": "p149",
  "planSeed": 45951,
  "aSeed": 1259971409,
  "bSeed": 45951,
  "preferred": "A"
 }
];
