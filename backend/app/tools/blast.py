"""BLAST sequence alignment tool - plain function + JSON schema for Agent Loop."""

import json
import subprocess
import tempfile
from io import StringIO
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_BLASTDB_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "blastdb"
_UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "uploads"
_DATABASES_JSON = _BLASTDB_DIR / "databases.json"

_TABULAR_FIELDS = [
    "qseqid", "sseqid", "pident", "length", "mismatch", "gapopen",
    "qstart", "qend", "sstart", "send", "evalue", "bitscore", "qcovs", "stitle",
]
_OUTFMT = "6 " + " ".join(_TABULAR_FIELDS)

VALID_PROGRAMS = {"blastn", "blastp", "blastx", "tblastn"}

# Program → required database type mapping
_PROGRAM_DB_TYPE = {
    "blastn": "nucl",
    "blastp": "prot",
    "blastx": "prot",
    "tblastn": "nucl",
}


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _load_databases() -> List[Dict[str, Any]]:
    """Read database entries from databases.json.

    Returns an empty list if the file does not exist or cannot be parsed.
    """
    if not _DATABASES_JSON.exists():
        return []
    try:
        with open(_DATABASES_JSON, encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "databases" in data:
            return data["databases"]
        return []
    except Exception:
        return []


def _find_database(name: str) -> Optional[Dict[str, Any]]:
    """Find a database entry by name (case-insensitive)."""
    databases = _load_databases()
    name_lower = name.lower()
    for db in databases:
        if db.get("name", "").lower() == name_lower:
            return db
    return None


def _resolve_db_path(db_name: str) -> Optional[str]:
    """Resolve the filesystem path to a BLAST database.

    Looks up the database entry and returns the path field,
    resolved relative to _BLASTDB_DIR if not absolute.
    """
    db_entry = _find_database(db_name)
    if not db_entry:
        return None
    db_path = db_entry.get("path", "")
    if not db_path:
        return None
    p = Path(db_path)
    if not p.is_absolute():
        p = _BLASTDB_DIR / db_path
    return str(p)


def _extract_sequence_by_id(gene_id: str, db_name: str) -> Optional[str]:
    """Extract a FASTA sequence from the source FASTA file by gene ID.

    Reads the 'source_fasta' field of the database entry and scans
    for a record whose header contains the given gene_id.
    Returns the FASTA string (header + sequence) or None.
    """
    db_entry = _find_database(db_name)
    if not db_entry:
        return None
    source_fasta = db_entry.get("source_fasta", "")
    if not source_fasta:
        return None

    fasta_path = Path(source_fasta)
    if not fasta_path.is_absolute():
        fasta_path = _BLASTDB_DIR / source_fasta
    if not fasta_path.exists():
        return None

    # Scan FASTA file for the matching record
    found = False
    lines: List[str] = []
    try:
        with open(fasta_path, encoding="utf-8") as fh:
            for line in fh:
                if line.startswith(">"):
                    if found:
                        break  # Next record reached; stop
                    if gene_id in line:
                        found = True
                        lines.append(line.rstrip("\n"))
                elif found:
                    lines.append(line.rstrip("\n"))
    except Exception:
        return None

    if not lines:
        return None
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Main BLAST search function
# ---------------------------------------------------------------------------

def blast_search(
    query: str,
    query_type: str = "sequence",
    program: str = "blastn",
    database: str = "MH63_cds",
    evalue: float = 1e-5,
    max_hits: int = 50,
    identity_threshold: float = 0.0,
) -> str:
    """Run a BLAST search and return results as JSON string.

    Args:
        query: Sequence in FASTA format, a gene ID, or an uploaded file path.
        query_type: "sequence" | "gene_id" | "file"
        program: BLAST program — blastn, blastp, blastx, tblastn
        database: Target database name (must exist in databases.json)
        evalue: E-value threshold, default 1e-5
        max_hits: Maximum number of hits to return, default 50
        identity_threshold: Minimum percent identity to keep (0-100), default 0

    Returns:
        JSON string with {"hits": [...], "summary": {...}} or {"error": "..."}.
    """
    try:
        # 1. Validate program
        if program not in VALID_PROGRAMS:
            return json.dumps(
                {"error": f"Invalid BLAST program '{program}'. "
                          f"Valid options: {', '.join(sorted(VALID_PROGRAMS))}"},
                ensure_ascii=False,
            )

        # 2. Find database and check compatibility
        db_entry = _find_database(database)
        if not db_entry:
            available = [d.get("name", "") for d in _load_databases()]
            return json.dumps(
                {"error": f"Database '{database}' not found. "
                          f"Available databases: {', '.join(available) or 'none'}"},
                ensure_ascii=False,
            )

        db_type = db_entry.get("type", "nucl")
        expected_type = _PROGRAM_DB_TYPE.get(program)
        if expected_type and db_type != expected_type:
            return json.dumps(
                {"error": f"Program '{program}' requires a '{expected_type}' database, "
                          f"but '{database}' is '{db_type}'."},
                ensure_ascii=False,
            )

        db_path = _resolve_db_path(database)
        if not db_path:
            return json.dumps(
                {"error": f"Cannot resolve filesystem path for database '{database}'."},
                ensure_ascii=False,
            )

        # 3. Resolve query sequence
        query_seq: str = ""
        if query_type == "gene_id":
            seq = _extract_sequence_by_id(query, database)
            if not seq:
                return json.dumps(
                    {"error": f"Cannot extract sequence for gene ID '{query}' "
                              f"from database '{database}'."},
                    ensure_ascii=False,
                )
            query_seq = seq
        elif query_type == "file":
            file_path = Path(query)
            if not file_path.is_absolute():
                file_path = _UPLOADS_DIR / query
            if not file_path.exists():
                return json.dumps(
                    {"error": f"Query file not found: {file_path}"},
                    ensure_ascii=False,
                )
            try:
                query_seq = file_path.read_text(encoding="utf-8")
            except Exception as e:
                return json.dumps(
                    {"error": f"Cannot read query file: {e}"},
                    ensure_ascii=False,
                )
        else:
            # query_type == "sequence" (default)
            query_seq = query.strip()
            if not query_seq.startswith(">"):
                query_seq = f">query\n{query_seq}"

        if not query_seq.strip():
            return json.dumps({"error": "Query sequence is empty."}, ensure_ascii=False)

        # 4. Write query to temp file
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".fasta", delete=False, encoding="utf-8",
        ) as tmp:
            tmp.write(query_seq)
            tmp_path = tmp.name

        try:
            # 5. Build BLAST command
            cmd = [
                program,
                "-query", tmp_path,
                "-db", db_path,
                "-outfmt", _OUTFMT,
                "-evalue", str(evalue),
                "-max_target_seqs", str(max_hits),
            ]

            # 6. Run BLAST
            proc = subprocess.run(
                cmd, capture_output=True, text=True, timeout=300,
            )

            if proc.returncode != 0:
                stderr = proc.stderr.strip() if proc.stderr else "unknown error"
                return json.dumps(
                    {"error": f"BLAST exited with code {proc.returncode}: {stderr}"},
                    ensure_ascii=False,
                )

            if not proc.stdout.strip():
                return json.dumps(
                    {
                        "hits": [],
                        "summary": {
                            "program": program,
                            "database": database,
                            "total_hits": 0,
                            "message": "No hits found.",
                        },
                    },
                    ensure_ascii=False,
                )

            # 7. Parse tabular output
            df = pd.read_csv(
                StringIO(proc.stdout),
                sep="\t",
                names=_TABULAR_FIELDS,
                header=None,
            )

            # 8. Filter by identity threshold
            if identity_threshold > 0:
                df = df[df["pident"] >= identity_threshold]

            # 9. Build hits list
            hits: List[Dict[str, Any]] = []
            for _, row in df.iterrows():
                hits.append({
                    "query_id": str(row["qseqid"]),
                    "subject_id": str(row["sseqid"]),
                    "identity": float(row["pident"]),
                    "alignment_length": int(row["length"]),
                    "mismatches": int(row["mismatch"]),
                    "gap_opens": int(row["gapopen"]),
                    "query_start": int(row["qstart"]),
                    "query_end": int(row["qend"]),
                    "subject_start": int(row["sstart"]),
                    "subject_end": int(row["send"]),
                    "evalue": float(row["evalue"]),
                    "bit_score": float(row["bitscore"]),
                    "query_coverage": float(row["qcovs"]),
                    "subject_title": str(row["stitle"]) if pd.notna(row["stitle"]) else "",
                })

            # 10. Build summary
            summary: Dict[str, Any] = {
                "program": program,
                "database": database,
                "total_hits": len(hits),
                "evalue_threshold": evalue,
                "identity_threshold": identity_threshold,
            }
            if hits:
                summary["best_hit"] = hits[0]["subject_id"]
                summary["best_identity"] = hits[0]["identity"]
                summary["best_evalue"] = hits[0]["evalue"]

            return json.dumps(
                {"hits": hits, "summary": summary},
                ensure_ascii=False,
            )

        finally:
            # Clean up temp file
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except Exception:
                pass

    except subprocess.TimeoutExpired:
        return json.dumps(
            {"error": "BLAST search timed out after 300 seconds."},
            ensure_ascii=False,
        )
    except Exception as e:
        return json.dumps(
            {"error": f"BLAST search failed: {str(e)}"},
            ensure_ascii=False,
        )


# ---------------------------------------------------------------------------
# Schema for LLM function calling
# ---------------------------------------------------------------------------

BLAST_SEARCH_SCHEMA = {
    "type": "function",
    "function": {
        "name": "blast_search",
        "description": (
            "BLAST 序列比对搜索工具。支持四种比对模式：\n"
            "- blastn：核酸序列 vs 核酸数据库\n"
            "- blastp：蛋白质序列 vs 蛋白质数据库\n"
            "- blastx：核酸序列翻译后 vs 蛋白质数据库\n"
            "- tblastn：蛋白质序列 vs 核酸数据库（翻译后比对）\n"
            "可通过基因 ID、直接输入序列或上传文件进行查询，"
            "返回比对命中列表和统计摘要。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": (
                        "查询内容：FASTA 格式序列、基因 ID（如 OsMH63_01G000010）、"
                        "或上传文件路径"
                    ),
                },
                "query_type": {
                    "type": "string",
                    "enum": ["sequence", "gene_id", "file"],
                    "description": "查询类型：sequence（直接序列）、gene_id（基因ID）、file（文件路径），默认 sequence",
                    "default": "sequence",
                },
                "program": {
                    "type": "string",
                    "enum": ["blastn", "blastp", "blastx", "tblastn"],
                    "description": "BLAST 程序：blastn、blastp、blastx、tblastn，默认 blastn",
                    "default": "blastn",
                },
                "database": {
                    "type": "string",
                    "description": "目标数据库名称，默认 MH63_cds",
                    "default": "MH63_cds",
                },
                "evalue": {
                    "type": "number",
                    "description": "E-value 阈值，默认 1e-5",
                    "default": 1e-5,
                },
                "max_hits": {
                    "type": "integer",
                    "description": "最大返回命中数，默认 50",
                    "default": 50,
                },
                "identity_threshold": {
                    "type": "number",
                    "description": "最低序列一致性百分比（0-100），默认 0（不过滤）",
                    "default": 0,
                },
            },
            "required": ["query"],
        },
    },
}
