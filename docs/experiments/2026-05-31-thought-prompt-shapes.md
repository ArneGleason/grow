# Thought Prompt Shape Experiment

Date: 2026-05-31  
Context: break-time experiment while Byte 10d waits for Claude review.

## Hypothesis

Grow will get better local-model responses if it sends a compact, task-specific thought request instead of the full `PlayerThoughtRequest` JSON. The prompt should still preserve the contract the app needs to validate and eventually schedule an intent.

## Method

I used one representative melody `in_song_short` request and compared four prompt shapes with the same musical facts:

- `current-full-json`: current Byte 9b style with primer, response example, constraints, and full request JSON.
- `projected-json`: trimmed JSON projection with only IDs, role, allowed actions, constraints, focus, memory, listening metrics, taste summary, and compact motif arrays.
- `music-card`: line-oriented musical card with compact fields and a terse output contract.
- `split-cards`: stable protocol card plus current-state request card.

Experiment script:

```sh
node experiments/2026-05-31-thought-prompt-shapes.mjs
```

Initial sandboxed access to local Ollama failed, but the server was running. `lsof` showed `ollama` listening on `127.0.0.1:11434`, and allowing the command to run outside the Codex sandbox made both `ollama list` and `/api/tags` work.

The key live-model finding: `gemma4:31b` writes reasoning to `message.thinking` and may leave `message.content` empty unless the request disables thinking. A tiny JSON test with default thinking returned empty content and stopped early in `message.thinking`; the same request with `think: false` returned `{"ok":true}` in `message.content`.

## Results

| shape | chars | est tokens | lines | contract checks | heuristic |
| --- | ---: | ---: | ---: | ---: | ---: |
| current-full-json | 3916 | 979 | 72 | 8/8 | 66 |
| projected-json | 2184 | 546 | 14 | 8/8 | 84 |
| music-card | 1218 | 305 | 13 | 8/8 | 82 |
| split-cards | 1175 | 294 | 18 | 8/8 | 83 |

Live Ollama results against local `gemma4:31b` with `/api/chat`, `format: "json"`, `think: false`, `temperature: 0.25`, and `num_predict: 512`:

| shape | ms | done | content chars | parse | required fields | action allowed |
| --- | ---: | --- | ---: | --- | --- | --- |
| current-full-json | 31353 | length | 1348 | fail | n/a | n/a |
| projected-json | 20887 | stop | 1083 | ok | ok | yes |
| music-card | 24550 | stop | 1148 | ok | ok | yes |
| split-cards | 27232 | length | 1339 | fail | n/a | n/a |

The heuristic is intentionally rough: it rewards constraint coverage and compactness, and slightly favors a JSON projection because it is easiest to parse, log, validate, and debug.

## Read

The current full JSON shape is too large for the job. It spends a lot of prompt budget on implementation details the model does not need, and in the live test it hit the prediction limit with non-parseable output.

The line-card and split-card shapes are the smallest. The music-card shape worked live, but split-cards hit the prediction limit. The card approach is still worth exploring because it is compact and musically readable, but projected JSON is easier to validate and less surprising.

The projected JSON shape looks like the safest next production candidate. It cuts roughly 44 percent of the prompt size while preserving every validation-critical field in a form that remains familiar to the app and review tooling.

## Recommendation

For Byte 10f prompt tuning, replace the full `Request JSON: ${JSON.stringify(request)}` payload with a projected request object and send `think: false` in the Ollama chat request for short structured intents.

Suggested first projected shape:

```json
{
  "v": "grow.thought/1",
  "id": "thought-melody-in_song_short-24.50-7-a12f",
  "player": "melody",
  "role": "melody",
  "level": "in_song_short",
  "allowedActions": ["rest", "simplify", "vary_motif"],
  "constraints": {
    "meter": [4, 4],
    "tonalContext": { "tonic": "C", "mode": "mixolydian", "scale": ["C", "D", "E", "F", "G", "A", "Bb"] },
    "maxResponseSteps": 8,
    "maxDurationBeats": 4
  },
  "focus": "Answer bass without filling every gap; keep a crooked modal hook.",
  "disposition": "steady 0.42, disruption 0.36, caution 0.28, novelty 0.72, density 0.64, responsiveness 0.82",
  "memory": ["short selected fragment", "short selected fragment"],
  "listening": { "eventCount": 18, "ensembleDensity": 1.36, "silenceRatio": 0.17, "brightness": 0.68 },
  "taste": "Holding contrast for phrasing; density 0.62 vs target 0.85.",
  "motif": [["n", 0, 0.5, 2, 4, 0.28], ["r", 1, 0.5]]
}
```

Keep the response schema separate and short. Do not send `sourceStartBeat` to the model unless it is explicitly marked as read-only provenance; the system should continue to own provenance and placement.

## Next Experiment

Next, inspect the actual valid `projected-json` and `music-card` responses for musical usefulness, then run them through Grow's full `validatePlayerThoughtIntent` rather than only checking JSON fields. Also test a smaller response schema and `num_predict` budget to see whether latency can drop below 10-15 seconds without increasing invalid output.
