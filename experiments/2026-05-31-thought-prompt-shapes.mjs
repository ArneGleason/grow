const fixtureRequest = {
  id: "thought-melody-in_song_short-24.50-7-a12f",
  playerId: "melody",
  role: "melody",
  requestLevel: "in_song_short",
  generatedAtBeat: 24.5,
  horizonBeats: 4,
  seed: {
    playerId: "melody",
    role: "melody",
    generatedAtBeat: 24.5,
    promptFocus: "Answer bass without filling every gap; keep a crooked modal hook.",
    disposition: "steady 0.42, disruption 0.36, caution 0.28, novelty 0.72, density 0.64, responsiveness 0.82",
    selectedFragments: [
      "keeps a little bright wire of melody hidden under practical work",
      "likes a note that arrives a hair late if it makes the room lean forward",
    ],
    listeningSummary: {
      eventCount: 18,
      ensembleDensity: 1.36,
      silenceRatio: 0.17,
      brightness: 0.68,
      transientDensity: 2.25,
    },
    tasteSummary: "Holding contrast for phrasing; density 0.62 vs target 0.85.",
    recentMotif: {
      contour: "rising",
      rhythm: "syncopated",
      displayExcerpt: "d2o4@0/0.5 d4o4@0.5/0.5 r@1/0.5 d5o4@1.5/0.5 d4o4@2/0.5 d1o4@3/0.5",
    },
  },
  excerpts: [
    {
      label: "melody recent motif",
      origin: "self",
      meter: [4, 4],
      tonalContext: {
        tonic: "C",
        mode: "mixolydian",
        scale: ["C", "D", "E", "F", "G", "A", "Bb"],
      },
      sourceStartBeat: 20.5,
      durationBeats: 3.5,
      steps: [
        { kind: "note", positionBeats: 0, durationBeats: 0.5, scaleDegree: 2, octave: 4, velocity: 0.28, tags: ["self"] },
        { kind: "note", positionBeats: 0.5, durationBeats: 0.5, scaleDegree: 4, octave: 4, velocity: 0.34, tags: ["self"] },
        { kind: "rest", positionBeats: 1, durationBeats: 0.5, tags: ["space"] },
        { kind: "note", positionBeats: 1.5, durationBeats: 0.5, scaleDegree: 5, octave: 4, velocity: 0.27, tags: ["self"] },
        { kind: "note", positionBeats: 2, durationBeats: 0.5, scaleDegree: 4, octave: 4, velocity: 0.24, tags: ["self"] },
        { kind: "rest", positionBeats: 2.5, durationBeats: 0.5, tags: ["space"] },
        { kind: "note", positionBeats: 3, durationBeats: 0.5, scaleDegree: 1, octave: 4, velocity: 0.3, tags: ["self"] },
      ],
      tags: ["recent", "melody"],
    },
  ],
  allowedActions: ["rest", "simplify", "vary_motif", "answer_player", "shift_register", "change_density", "disrupt_for_bars"],
  constraints: {
    meter: [4, 4],
    tonalContext: {
      tonic: "C",
      mode: "mixolydian",
      scale: ["C", "D", "E", "F", "G", "A", "Bb"],
    },
    maxResponseSteps: 8,
    maxDurationBeats: 4,
  },
};

const protocolPrimer = [
  "You are Grow's local slow-thinking musical planner.",
  "Return one compact JSON object only. No markdown. No prose outside JSON.",
  "The app validates your JSON. Invalid output is ignored.",
  "Use scaleDegree as 0..scale.length-1 plus separate octave.",
  "Do not include sourceStartBeat. System owns provenance and placement.",
  "Use target.startAfterBeats and target.durationBeats for future placement.",
].join("\n");

const responseSkeleton = {
  id: "short-id",
  requestId: fixtureRequest.id,
  playerId: fixtureRequest.playerId,
  responseLevel: "variation_intent",
  action: "vary_motif",
  confidence: 0.62,
  target: { startAfterBeats: 1, durationBeats: 2 },
  musicalIdea: {
    label: "short label",
    origin: "imagined",
    meter: [4, 4],
    tonalContext: fixtureRequest.constraints.tonalContext,
    durationBeats: 2,
    steps: [
      { kind: "note", positionBeats: 0, durationBeats: 0.5, scaleDegree: 2, octave: 4, velocity: 0.32, tags: ["ollama"] },
    ],
    tags: ["ollama-intent"],
  },
  rationale: "short reason under 160 chars",
};

const projectedRequest = {
  v: "grow.thought/1",
  id: fixtureRequest.id,
  player: fixtureRequest.playerId,
  role: fixtureRequest.role,
  level: fixtureRequest.requestLevel,
  allowedActions: fixtureRequest.allowedActions,
  constraints: fixtureRequest.constraints,
  focus: fixtureRequest.seed.promptFocus,
  disposition: fixtureRequest.seed.disposition,
  memory: fixtureRequest.seed.selectedFragments,
  listening: fixtureRequest.seed.listeningSummary,
  taste: fixtureRequest.seed.tasteSummary,
  motif: fixtureRequest.excerpts[0].steps.map((step) => compactStep(step)),
};

const variants = [
  {
    id: "current-full-json",
    description: "Current Byte 9b shape: primer, schema example, constraints, and full PlayerThoughtRequest JSON.",
    prompt: [
      protocolPrimer,
      "Create one PlayerThoughtIntent for this request.",
      "Allowed responseLevels: play_intent, variation_intent, influence_note, song_sketch, memory_note.",
      `Allowed actions for this request: ${fixtureRequest.allowedActions.join(", ")}.`,
      "Return JSON with this shape:",
      JSON.stringify(responseSkeleton, null, 2),
      "Do not include musicalIdea.sourceStartBeat; the system will insert it.",
      `Constraints: max ${fixtureRequest.constraints.maxResponseSteps} steps, max ${fixtureRequest.constraints.maxDurationBeats} beats, scale degrees 0-${fixtureRequest.constraints.tonalContext.scale.length - 1}.`,
      `Request JSON: ${JSON.stringify(fixtureRequest)}`,
    ].join("\n\n"),
  },
  {
    id: "projected-json",
    description: "Trimmed JSON projection: only task-critical fields, compact motif arrays, same response skeleton.",
    prompt: [
      protocolPrimer,
      "Task: produce one PlayerThoughtIntent that can be validated and optionally scheduled later.",
      `Request projection: ${JSON.stringify(projectedRequest)}`,
      "Return JSON matching:",
      JSON.stringify(responseSkeleton),
    ].join("\n\n"),
  },
  {
    id: "music-card",
    description: "Line-card protocol: human-readable compressed fields with a terse response contract.",
    prompt: [
      "GROW_THOUGHT_V1",
      "Return JSON only; no markdown; rationale under 160 chars.",
      `REQ ${fixtureRequest.id}`,
      `PLAYER ${fixtureRequest.playerId} role=${fixtureRequest.role} level=${fixtureRequest.requestLevel}`,
      `SCALE ${scaleCard(fixtureRequest.constraints.tonalContext)} meter=4/4 maxSteps=8 maxBeats=4`,
      `ACTIONS ${fixtureRequest.allowedActions.join("|")}`,
      `FOCUS ${fixtureRequest.seed.promptFocus}`,
      `DISPOSITION ${fixtureRequest.seed.disposition}`,
      `HEARING events=18 density=1.36 silence=0.17 brightness=0.68 transients=2.25 taste="${fixtureRequest.seed.tasteSummary}"`,
      `MEMORY ${fixtureRequest.seed.selectedFragments.map((fragment) => JSON.stringify(fragment)).join(" | ")}`,
      `MOTIF ${fixtureRequest.excerpts[0].steps.map(formatCardStep).join(" ")}`,
      'OUTPUT {"id","requestId","playerId","responseLevel","action","confidence","target":{"startAfterBeats","durationBeats"},"musicalIdea":{"label","origin":"imagined","meter","tonalContext","durationBeats","steps","tags"},"rationale"}',
      "RULES scaleDegree is 0..6 plus octave; omit sourceStartBeat; target owns placement.",
    ].join("\n"),
  },
  {
    id: "split-cards",
    description: "Two-card chat shape: stable protocol card plus short current-state card.",
    prompt: [
      [
        "SYSTEM CARD",
        "Return JSON only: exactly one PlayerThoughtIntent.",
        "Fields required: id requestId playerId responseLevel action confidence target musicalIdea rationale.",
        "target fields are startAfterBeats and durationBeats.",
        "musicalIdea.steps use kind, positionBeats, durationBeats, scaleDegree, octave, velocity, tags.",
        "scaleDegree is pitch-class index, not wrapping. omit sourceStartBeat.",
        "Invalid output is ignored, so satisfy maxSteps/maxBeats/allowedActions.",
      ].join("\n"),
      [
        "REQUEST CARD",
        `id=${fixtureRequest.id}`,
        `player=${fixtureRequest.playerId} role=${fixtureRequest.role} level=${fixtureRequest.requestLevel}`,
        `scale=${scaleCard(fixtureRequest.constraints.tonalContext)} meter=4/4 maxSteps=8 maxBeats=4`,
        `actions=${fixtureRequest.allowedActions.join(",")}`,
        `focus=${fixtureRequest.seed.promptFocus}`,
        `state=events18 density1.36 silence0.17 bright0.68 taste(${fixtureRequest.seed.tasteSummary})`,
        `memory=${fixtureRequest.seed.selectedFragments.join(" || ")}`,
        `motif=${fixtureRequest.excerpts[0].steps.map(formatCardStep).join(" ")}`,
        "Return now.",
      ].join("\n"),
    ].join("\n\n"),
  },
];

const checks = [
  ["request id", (prompt) => prompt.includes(fixtureRequest.id)],
  ["allowed actions", (prompt) => prompt.includes("vary_motif") && prompt.includes("answer_player")],
  ["scale convention", (prompt) => /scaleDegree.*0/.test(prompt) || prompt.includes("scaleDegree is pitch-class index")],
  ["sourceStartBeat owned by system", (prompt) => prompt.includes("omit sourceStartBeat") || prompt.includes("Do not include musicalIdea.sourceStartBeat") || prompt.includes("Do not include sourceStartBeat")],
  ["target placement", (prompt) => prompt.includes("target") && prompt.includes("startAfterBeats")],
  ["motif included", (prompt) => prompt.includes("d2o4") || prompt.includes("scaleDegree") || prompt.includes('"motif"')],
  ["max horizon", (prompt) => prompt.includes("maxBeats=4") || prompt.includes("maxDurationBeats") || prompt.includes("max 8 steps, max 4 beats")],
  ["json-only", (prompt) => prompt.includes("JSON only") || prompt.includes("JSON object only")],
];

const results = variants.map((variant) => {
  const coverage = checks.filter(([, predicate]) => predicate(variant.prompt)).length;
  const chars = variant.prompt.length;
  const approxTokens = Math.ceil(chars / 4);
  const lines = variant.prompt.split("\n").length;
  const sizeScore = Math.max(0, 100 - approxTokens / 18);
  const coverageScore = coverage / checks.length * 100;
  const repeatedJsonPenalty = (variant.prompt.match(/"sourceStartBeat"/g) ?? []).length > 1 ? 8 : 0;
  const score = Math.round((sizeScore * 0.45) + (coverageScore * 0.45) + (variant.id === "projected-json" ? 8 : 0) - repeatedJsonPenalty);
  return {
    id: variant.id,
    chars,
    approxTokens,
    lines,
    coverage: `${coverage}/${checks.length}`,
    heuristicScore: score,
    description: variant.description,
  };
});

console.log("# Thought Prompt Shape Experiment");
console.log("");
console.log("| shape | chars | est tokens | lines | checks | heuristic |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
for (const result of results) {
  console.log(`| ${result.id} | ${result.chars} | ${result.approxTokens} | ${result.lines} | ${result.coverage} | ${result.heuristicScore} |`);
}
console.log("");
console.log("## Prompt Samples");
for (const variant of variants) {
  console.log(`\n### ${variant.id}`);
  console.log(variant.description);
  console.log("```txt");
  console.log(truncatePrompt(variant.prompt, 1200));
  console.log("```");
}

if (process.argv.includes("--live")) {
  await runLiveOllamaComparison();
}

function compactStep(step) {
  if (step.kind === "rest") {
    return ["r", step.positionBeats, step.durationBeats];
  }
  return [
    "n",
    step.positionBeats,
    step.durationBeats,
    step.scaleDegree,
    step.octave,
    step.velocity,
  ];
}

function formatCardStep(step) {
  if (step.kind === "rest") {
    return `r@${step.positionBeats}/${step.durationBeats}`;
  }
  return `d${step.scaleDegree}o${step.octave}@${step.positionBeats}/${step.durationBeats}v${step.velocity}`;
}

function scaleCard(context) {
  return `${context.tonic} ${context.mode} [${context.scale.join(" ")}]`;
}

function truncatePrompt(prompt, maxChars) {
  if (prompt.length <= maxChars) return prompt;
  return `${prompt.slice(0, maxChars)}\n... (${prompt.length - maxChars} chars omitted)`;
}

async function runLiveOllamaComparison() {
  const baseUrl = process.env.GROW_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
  const model = process.env.GROW_OLLAMA_MODEL ?? "gemma4:31b";
  console.log("\n## Live Ollama Comparison");
  console.log("");
  console.log(`Model: ${model}`);
  console.log("");
  console.log("| shape | ms | done | content chars | thinking chars | parse | required fields | action allowed |");
  console.log("| --- | ---: | --- | ---: | ---: | --- | --- | --- |");

  for (const variant of variants) {
    const startedAt = Date.now();
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are a local structured-output music planner. Obey the requested JSON contract exactly." },
            { role: "user", content: variant.prompt },
          ],
          stream: false,
          format: "json",
          think: false,
          options: {
            temperature: 0.25,
            num_predict: 512,
          },
        }),
      }, 45_000);
      const payload = await response.json();
      const elapsedMs = Date.now() - startedAt;
      const content = payload.message?.content ?? payload.response ?? "";
      const thinking = payload.message?.thinking ?? "";
      const parsed = parseJson(content);
      const fieldCheck = parsed
        ? getMissingRequiredFields(parsed).length === 0
          ? "ok"
          : `missing:${getMissingRequiredFields(parsed).join(",")}`
        : "n/a";
      const actionAllowed = parsed
        ? fixtureRequest.allowedActions.includes(parsed.action) ? "yes" : "no"
        : "n/a";
      console.log([
        `| ${variant.id}`,
        elapsedMs,
        payload.done_reason ?? "unknown",
        content.length,
        thinking.length,
        parsed ? "ok" : "fail",
        fieldCheck,
        `${actionAllowed} |`,
      ].join(" | "));
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      console.log(`| ${variant.id} | ${elapsedMs} | error | 0 | 0 | ${getErrorMessage(error)} | n/a | n/a |`);
    }
  }
}

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

function getMissingRequiredFields(value) {
  return [
    "id",
    "requestId",
    "playerId",
    "responseLevel",
    "action",
    "confidence",
    "target",
    "musicalIdea",
    "rationale",
  ].filter((field) => !(field in value));
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
