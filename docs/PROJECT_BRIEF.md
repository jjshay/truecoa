# TrueCOA — Project Brief

## At a glance

| Field | Value |
|---|---|
| Portfolio area | Provenance systems |
| Repository | [jjshay/truecoa](https://github.com/jjshay/truecoa) |
| Status | Source available; runtime not revalidated in this documentation review |
| Evidence review | 2026-09-11; [commit ddf9dbc](https://github.com/jjshay/truecoa/tree/ddf9dbcc76036f7794c7037211608592440092aa) |

## Problem and intended value

Physical certificates need an accessible digital record and verifiable registration trail.

The intended value is a repeatable workflow whose inputs, transformations, and outputs can be inspected. Use the evidence below to distinguish implementation from business outcomes.

## Architecture and data flow

QR or certificate code → verification UI → operational metadata → chain lookup → certificate display.

```mermaid
flowchart LR
    N0["QR or certificate code"]
    N1["verification UI"]
    N2["operational metadata"]
    N3["chain lookup"]
    N4["certificate display"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
```

## Implementation evidence

| Source | Reading purpose |
|---|---|
| [backend/index.js](../backend/index.js) | Application entry point, interface, or integration boundary. |
| [frontend/src/App.jsx](../frontend/src/App.jsx) | Application entry point, interface, or integration boundary. |
| [scripts/mint.js](../scripts/mint.js) | Implementation component supporting the data flow described above. |

The links above point to the current repository. The review reference identifies the version used to prepare this brief.

## Setup and operation

Use the existing [README](../README.md) for setup and operating commands. Configuration and dependency references: [package.json](../package.json), [.env.example](../.env.example).

Start with sample or fixture inputs. Where external services are involved, configure a test account and check the distinction between a local preview, a generated artifact, and a remote write. Credentials and operational datasets are environment-specific.

## Validation and outcomes

**Review result:** Repository tree and referenced source reviewed. Existing application tests, hosted deployments, paid providers, and external mutations were not re-run in this documentation review.

No conventional test suite was identified in the reviewed repository tree; validation should begin with the next improvement below.

The source implements the workflow described above. No new revenue, accuracy, conversion, or production-uptime result is asserted by this documentation update.

Documentation itself is checked by `python3 scripts/check_project_docs.py`; that check validates this structure and its source references, not application behavior.

## Decisions and limitations

Blockchain anchoring makes a record inspectable; the quality of the original authentication evidence remains a separate responsibility.

Keep provider-dependent observations dated and separate from deterministic transformations. State which assumptions a demonstration uses and which integrations it actually exercises.

## Interview talking points

- **Problem and product judgment:** Explain why this workflow mattered to its intended operator: Physical certificates need an accessible digital record and verifiable registration trail.
- **Technical walkthrough:** Trace one concrete input through this sequence: QR or certificate code → verification UI → operational metadata → chain lookup → certificate display.
- **Engineering tradeoff:** Blockchain anchoring makes a record inspectable; the quality of the original authentication evidence remains a separate responsibility.
- **Evidence and ownership:** Open the source links above, identify the specific design or implementation decisions you personally drove, and distinguish AI-assisted implementation from measured operating results.
- **What comes next:** Test the full certificate lifecycle with synthetic records and make off-chain versus on-chain status explicit.

## Next improvements

Test the full certificate lifecycle with synthetic records and make off-chain versus on-chain status explicit.

Record any follow-up result with a date, exact command or evaluation method, input scope, observed output, and limitations. Update `project.json` alongside this brief.

## Related projects

- [TrueCOA Integrated Snapshot](https://github.com/jjshay/gauntlet-coa) — Provenance systems.
- [TrueCOA API](https://github.com/jjshay/gauntlet-coa-backend) — Provenance systems.
- [TrueCOA Verification Portal](https://github.com/jjshay/gauntlet-coa-frontend) — Provenance systems.
- [TrueCOA Print Generator](https://github.com/jjshay/gauntlet-coa-generator) — Provenance systems.

Some related repositories require authorized GitHub access.
