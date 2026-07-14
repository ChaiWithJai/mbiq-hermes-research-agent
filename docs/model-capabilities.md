# Bonsai 27B capability assessment

## Base model

Ternary Bonsai 27B keeps the Qwen3.6-27B architecture and changes the weight representation. The base model is a 27B causal language model with a vision encoder, 64 layers, hybrid linear and full attention, native 262,144-token context, and an advertised path to about one million tokens. Qwen emphasizes repository-level coding, tool-using agent work, reasoning, knowledge, document understanding, and vision.

The most relevant base-model results are strong but harness-dependent. Qwen reports 59.3 on Terminal-Bench 2.0, 48.2 on SkillsBench, 72.4 average on Claw-Eval, 93.5 on MMLU-Redux, 87.8 on GPQA Diamond, and 78.4 on the CharXiv document-understanding task. These are not MBIQ research scores. They show that the model is a plausible tool-using worker, not that it produces reliable local-history briefs.

## Ternary conversion

PrismML reports that the ternary model uses `{-1, 0, +1}` weights with group-wise FP16 scaling. The ideal language-weight size is 5.9 GB, while the current MLX package is about 8.49 GB because of its packing and bundled components. The model retains 95 percent of the full-precision average across PrismML's 15-benchmark suite.

The important category scores are:

| Capability | Full Qwen3.6 27B | Ternary Bonsai 27B |
|---|---:|---:|
| Math | 95.3 | 93.4 |
| Coding | 88.7 | 86.0 |
| Agentic and tool calling | 80.0 | 74.0 |
| Instruction following | 78.4 | 71.8 |
| Knowledge and STEM | 83.1 | 77.0 |
| Vision | 72.6 | 65.2 |

The compression cost is most visible in instruction following, tool use, knowledge, and vision. That is why this repo uses explicit source gates, a fixed brief contract, and a job-level evaluation. Local weights improve privacy and marginal cost. They do not remove hallucination risk or the need for an editor.

## Fit for the MBIQ job

Good fit:

- reading a structured event calendar;
- planning and revising web searches;
- calling Exa tools;
- extracting claims into a source ledger;
- comparing sources and surfacing gaps;
- drafting structured story routes in a grounded brand voice.

Needs measurement:

- sustained tool-call reliability across a full brief;
- resistance to treating snippets as sources;
- accurate separation of Queens-specific evidence from general NYC context;
- citation completeness after long research sessions;
- recovery when community or primary sources are hard to find.

Not delegated without human review:

- publication;
- outreach to community members;
- claims that a source represents a whole community;
- resolving conflicting historical accounts without attribution;
- final cultural framing.

## Sources

- [Qwen3.6-27B model card](https://huggingface.co/Qwen/Qwen3.6-27B)
- [Ternary Bonsai 27B model card](https://huggingface.co/prism-ml/Ternary-Bonsai-27B-mlx-2bit)
- [Bonsai 27B release and benchmark summary](https://prismml.com/news/bonsai-27b)
- [Bonsai whitepaper](https://github.com/PrismML-Eng/Bonsai-demo/blob/main/bonsai-27b-whitepaper.pdf)

