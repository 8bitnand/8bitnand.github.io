---
layout: post.njk
title: "I Ran MisoTTS Locally on Apple Silicon. It Worked, But It Was Not Real-Time."
description: "A practical MisoTTS MLX run on local hardware: five voice samples, load time, generation speed, memory usage, audio outputs, and playback-ready blog samples."
date: 2026-06-09
cover: "./cover.png"
coverAlt: "Can Local TTS Beat the Cloud cover comparing ElevenLabs and OpenAI cloud TTS with local MisoTTS on Apple Silicon"
tags:
  - "posts"
  - "ai"
  - "tts"
  - "mlx"
  - "benchmark"
---

I wanted to test a very simple thing:

> Can I run MisoTTS locally, generate a few emotionally different voice samples, and get usable audio without depending on a hosted demo?

Short answer: **yes**.

Longer answer: the local MLX path worked reliably, but it was not real-time.

This is not a polished academic benchmark. It is the kind of test I actually care about as a builder: install it, run it, produce audio, measure how painful it is, and keep the artifacts.

![](./cover.svg)

## What I tested

I used a local MLX version of MisoTTS and generated five short WAV files.

The goal was not to find the best possible voice. The goal was to stress a few common speaking styles:

| Sample | Intent |
| --- | --- |
| `01_calm_assistant.wav` | calm assistant voice |
| `02_excited_demo.wav` | excited product demo voice |
| `03_serious_warning.wav` | serious warning voice |
| `04_sad_reflective.wav` | sad reflective voice |
| `05_fast_product_update.wav` | faster product update voice |

Each output was **6.48 seconds** long.

## The local run

The local model path was:

```txt
tmp/misotts_mlx/model
```

The model loaded in about **10.1 seconds**. After that, each sample generated successfully.

| Sample | Duration | Generation time | Real-time factor | Peak memory |
| --- | ---: | ---: | ---: | ---: |
| calm assistant | 6.48s | 37.04s | 5.66x | 10.50 GB |
| excited demo | 6.48s | 26.74s | 4.11x | 10.94 GB |
| serious warning | 6.48s | 26.16s | 4.03x | 10.95 GB |
| sad reflective | 6.48s | 29.94s | 4.61x | 11.08 GB |
| fast product update | 6.48s | 28.46s | 4.38x | 11.08 GB |

That means the run was stable, but slow. The fastest sample still took roughly **4x the audio duration** to generate. The slowest one took more than **5.6x**.

<aside class="article-callout">
  <strong>Result</strong>
  <p>Local MisoTTS on MLX generated 5/5 samples successfully. It was reliable, but not fast enough for real-time voice applications in this setup.</p>
</aside>

## The audio samples

Here are the actual outputs from the local run.

### Calm assistant

<audio controls preload="metadata" src="./01_calm_assistant.wav"></audio>

### Excited demo

<audio controls preload="metadata" src="./02_excited_demo.wav"></audio>

### Serious warning

<audio controls preload="metadata" src="./03_serious_warning.wav"></audio>

### Sad reflective

<audio controls preload="metadata" src="./04_sad_reflective.wav"></audio>

### Fast product update

<audio controls preload="metadata" src="./05_fast_product_update.wav"></audio>

## The useful part: it actually produced files

This sounds obvious, but for local AI tooling this is the whole game.

A hosted demo can look nice and still be useless if the queue is down, the backend is broken, or the UI hides the error. A local run that writes WAV files is boring in the best possible way.

The output folder had:

```txt
01_calm_assistant.wav
02_excited_demo.wav
03_serious_warning.wav
04_sad_reflective.wav
05_fast_product_update.wav
run_log.txt
```

The important thing is that all five samples completed and were saved cleanly.

## What I would test next

This first run answered the basic question: local MisoTTS generation works.

The next useful tests would be:

- compare it against ElevenLabs, OpenAI TTS, and Piper on the same text,
- test longer paragraphs instead of 6.48 second clips,
- measure whether batch generation improves throughput,
- try different voices and prompts for emotional control,
- profile where the generation time is actually going,
- check whether quantization or smaller variants reduce memory without ruining quality.

I would also like to test streaming. A model can be slow overall and still feel usable if it starts speaking quickly enough. This run only measured completed WAV generation, not time-to-first-audio.
