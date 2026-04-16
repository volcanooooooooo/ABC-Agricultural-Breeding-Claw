<div align="center">
<img src="src/img/icon.png" alt="ABC Logo" width="120" />

# ABC: Agricultural Breeding Claw

### AI-Powered Agricultural Breeding Research Assistant

[English](README.md) | [简体中文](README.zh-CN.md)

[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)](https://www.python.org)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

<br/>

**ABC** is an AI-assisted analysis platform for agricultural breeding researchers. Without any programming, users can perform differential expression analysis, KEGG/GO enrichment analysis, BLAST sequence alignment, and gene ontology visualization through natural language.

Built on the [LangChain](https://github.com/langchain-ai/langchain) ReAct Agent framework with Qianwen LLM, featuring a dual-track analysis mechanism that combines traditional statistical tools with LLM reasoning.

## Contents

- [Overview](#overview)
- [Usage Modes](#usage-modes)
- [Quick Start](#quick-start)
- [Core Features](#core-features)
- [Built-in Dataset](#built-in-dataset)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Notes](#notes)
- [License](#license)

## Overview

The rapid growth of genomic data has created a high computational barrier for breeding researchers. Tools like DESeq2 and edgeR require programming expertise that most field-oriented breeders lack.

**ABC** addresses this by providing a conversational interface to a comprehensive bioinformatics toolkit. Researchers can:

- **Differential Expression Analysis** — Run t-test / DESeq2-based DEG analysis with volcano plot visualization
- **Enrichment Analysis** — GO/KEGG enrichment using local MH63 rice annotation database (offline, no API dependency)
- **BLAST Alignment** — blastn / blastp / blastx / tblastn against local MH63 database
- **Dual-Track Validation** — Parallel statistical tool + LLM reasoning with consistency scoring
- **Gene Ontology** — Interactive knowledge graph with React Flow for browsing and editing
- **File Upload** — Drag-and-drop expression matrices, gene lists, or FASTA files for instant analysis

## Usage Modes

### Natural Language

```
Analyze differentially expressed genes between WT and osbzip23
Run GO/KEGG enrichment on the significant genes from the last analysis
Align this sequence: ATGCGATCGATCG...
```

### Command Mode

```
/analyze --control WT --treatment osbzip23
/analyze --control WT --treatment osbzip23 --pvalue 0.01 --log2fc 2
/tools      # list available tools
/datasets   # list available datasets
```

### File Upload

- **Expression matrix** (TSV/CSV): specify control/treatment groups, auto-run differential analysis
- **Gene ID list** (TXT): directly run enrichment analysis
- **FASTA file**: directly run BLAST alignment

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- Qianwen API Key ([apply here](https://dashscope.aliyun.com))

### Backend

```bash
cd backend
pip install -r requirements.txt

# Configure API Key
echo "QWEN_API_KEY=your_api_key_here" > .env

# Start
PYTHONPATH=backend uvicorn app.main:app --reload --port 8003
```

### Frontend

```bash
# In project root
npm install
npm run dev
```

### Access

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3003 |
| Backend API | http://localhost:8003 |
| API Docs (Swagger) | http://localhost:8003/docs |

## Core Features

### Dual-Track Differential Expression Analysis

Parallel execution of statistical tool track and LLM reasoning track:

- **Tool Track**: t-test across all genes with log2FC + p-value filtering, volcano plot output
- **LLM Track**: Qianwen model reasons over expression data using biological prior knowledge
- **Consistency Analysis**: Overlap rate quantification, identifying high-confidence genes confirmed by both tracks

In validation on GSE242459, the two tracks achieved **83.3% gene overlap**, with LLM identifying biologically meaningful candidates missed by strict statistical thresholds.

### KEGG/GO Enrichment Analysis

Local MH63 rice annotation database (Fisher exact test + BH correction):

- Bubble chart (enrichment score vs pathway, bubble size = gene count)
- Sortable result table with KEGG pathway links

### BLAST Sequence Alignment

Supports blastn / blastp / blastx / tblastn against local MH63 database:

- Hit table (identity, E-value, coverage)
- Alignment detail view

### Gene Ontology Graph

React Flow-based interactive knowledge graph with node search, editing, and relationship browsing.

## Built-in Dataset

Rice transcriptome dataset **GSE242459** (OsbZIP23 transcription factor under stress conditions):

| Group | Samples |
|-------|---------|
| Control (WT) | DS_WT_rep1, DS_WT_rep2, N_WT_rep1, N_WT_rep2, RE_WT_rep1, RE_WT_rep2 |
| Treatment (osbzip23) | DS_osbzip23_rep1, DS_osbzip23_rep2 |

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Presentation Layer                  │
│  React 18 + TypeScript + Recharts + React Flow      │
│  Chat UI | Volcano Plot | Bubble Chart | Ontology   │
├─────────────────────────────────────────────────────┤
│              SSE Real-time Progress Stream           │
├─────────────────────────────────────────────────────┤
│                   Service Layer                      │
│  FastAPI | AnalysisService | LLMService             │
│  OntologyService | DatasetService | FeedbackService │
├─────────────────────────────────────────────────────┤
│                    Agent Layer                       │
│  LangChain ReAct Agent (Qianwen LLM)                │
│  Differential Tool | Enrichment Tool | BLAST Tool   │
├─────────────────────────────────────────────────────┤
│                    Data Layer                        │
│  Expression Matrix (TSV) | GO/KEGG Annotations     │
│  BLAST Database (MH63)                              │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Ant Design |
| Backend | FastAPI + LangChain Agent + Qianwen API |
| Data Analysis | Pandas / SciPy / PyDESeq2 / goatools / statsmodels |
| Sequence Alignment | BLAST+ (local) |
| Visualization | Recharts + React Flow |

## Project Structure

```
ABC-Agricultural-Breeding-Claw/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Configuration
│   │   ├── agent/               # LangChain ReAct Agent
│   │   ├── tools/               # Analysis tools (DEG, enrichment, BLAST)
│   │   ├── routers/             # API routes
│   │   ├── services/            # Business logic
│   │   └── models/              # Data models
│   ├── data/
│   │   ├── datasets/            # Dataset files
│   │   └── annotations/         # MH63 GO/KEGG annotation files
│   └── requirements.txt
├── src/                         # Frontend source
│   ├── pages/                   # Page components
│   ├── components/              # Reusable components
│   ├── api/                     # API client
│   └── hooks/                   # Custom hooks
├── docs/
│   └── paper/                   # Technical paper
├── package.json
└── vite.config.ts
```

## Notes

- Conversation history is stored in browser `localStorage` and will be lost if browser cache is cleared
- Enrichment analysis uses local MH63 rice annotation files; only rice gene IDs (`OsMH_` prefix) are supported
- Annotation files take ~10–30 seconds to load on first startup
- Default LLM model is `qwen-turbo`; can be switched in the Settings page

## License

MIT
