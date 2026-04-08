"""Download MH63 rice annotation files from Ensembl Plants BioMart and KEGG REST API.

Usage:
    cd backend && python -m scripts.prepare_annotations
"""

import csv
import os
import time
from pathlib import Path

import httpx

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / "data" / "annotations"

GO_OBO_URL = "http://purl.obolibrary.org/obo/go/go-basic.obo"
BIOMART_URL = "https://plants.ensembl.org/biomart/martservice"
KEGG_LIST_URL = "https://rest.kegg.jp/list/pathway/osa"
KEGG_LINK_URL = "https://rest.kegg.jp/link/genes/{pathway_id}"

KEGG_RATE_LIMIT = 1.0 / 3  # seconds between requests (~3 req/s)

# ---------------------------------------------------------------------------
# BioMart XML query helpers
# ---------------------------------------------------------------------------

_BIOMART_GO_XML = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Query>
<Query virtualSchemaName="plants_mart" formatter="TSV" header="0"
       uniqueRows="1" count="" datasetConfigVersion="0.6">
  <Dataset name="osativa_mh63_eg_gene" interface="default">
    <Attribute name="ensembl_gene_id"/>
    <Attribute name="go_id"/>
    <Attribute name="name_1006"/>
    <Attribute name="namespace_1003"/>
  </Dataset>
</Query>"""

_BIOMART_ENTREZ_XML = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Query>
<Query virtualSchemaName="plants_mart" formatter="TSV" header="0"
       uniqueRows="1" count="" datasetConfigVersion="0.6">
  <Dataset name="osativa_mh63_eg_gene" interface="default">
    <Attribute name="ensembl_gene_id"/>
    <Attribute name="entrezgene_id"/>
  </Dataset>
</Query>"""


def _biomart_query(xml: str, client: httpx.Client) -> list[list[str]]:
    """POST a BioMart XML query and return parsed TSV rows."""
    resp = client.post(BIOMART_URL, data={"query": xml}, timeout=300)
    resp.raise_for_status()
    rows = []
    for line in resp.text.splitlines():
        if line.strip():
            rows.append(line.split("\t"))
    return rows


# ---------------------------------------------------------------------------
# Download functions
# ---------------------------------------------------------------------------


def download_go_obo(client: httpx.Client) -> None:
    out_path = DATA_DIR / "go-basic.obo"
    if out_path.exists():
        print(f"[skip] {out_path} already exists")
        return
    print(f"[download] go-basic.obo from {GO_OBO_URL}")
    with client.stream("GET", GO_OBO_URL, timeout=300, follow_redirects=True) as resp:
        resp.raise_for_status()
        with open(out_path, "wb") as f:
            for chunk in resp.iter_bytes(chunk_size=65536):
                f.write(chunk)
    print(f"[done] saved {out_path}")


def download_go_annotation(client: httpx.Client) -> None:
    out_path = DATA_DIR / "mh63_go_annotation.tsv"
    if out_path.exists():
        print(f"[skip] {out_path} already exists")
        return
    print("[download] MH63 GO annotation from Ensembl Plants BioMart ...")
    rows = _biomart_query(_BIOMART_GO_XML, client)
    written = 0
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter="\t")
        writer.writerow(["gene_id", "go_id", "go_name", "go_namespace"])
        for row in rows:
            if len(row) < 4:
                continue
            gene_id, go_id, go_name, go_namespace = row[0], row[1], row[2], row[3]
            if not gene_id or not go_id:
                continue
            writer.writerow([gene_id, go_id, go_name, go_namespace])
            written += 1
    print(f"[done] saved {out_path} ({written} rows)")


def download_kegg_annotation(client: httpx.Client) -> None:
    out_path = DATA_DIR / "mh63_kegg_annotation.tsv"
    if out_path.exists():
        print(f"[skip] {out_path} already exists")
        return

    # Step 1: get MH63 gene_id -> entrez_id mapping from BioMart
    print("[download] MH63 gene_id -> Entrez ID mapping from BioMart ...")
    entrez_rows = _biomart_query(_BIOMART_ENTREZ_XML, client)
    entrez_map: dict[str, str] = {}  # entrez_id -> gene_id
    for row in entrez_rows:
        if len(row) < 2:
            continue
        gene_id, entrez_id = row[0].strip(), row[1].strip()
        if gene_id and entrez_id:
            entrez_map[entrez_id] = gene_id
    print(f"[info] {len(entrez_map)} entrez->gene_id mappings loaded")

    # Step 2: get rice KEGG pathway list
    print(f"[download] KEGG pathway list from {KEGG_LIST_URL}")
    time.sleep(KEGG_RATE_LIMIT)
    resp = client.get(KEGG_LIST_URL, timeout=60)
    resp.raise_for_status()
    pathways: list[tuple[str, str]] = []  # (pathway_id, pathway_name)
    for line in resp.text.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t", 1)
        if len(parts) == 2:
            pathway_id = parts[0].strip()   # e.g. "path:osa00010"
            pathway_name = parts[1].strip()
            pathways.append((pathway_id, pathway_name))
    print(f"[info] {len(pathways)} KEGG pathways found")

    # Step 3: for each pathway, get genes and map to MH63 gene IDs
    records: list[tuple[str, str, str]] = []  # (gene_id, pathway_id, pathway_name)
    for i, (pathway_id, pathway_name) in enumerate(pathways):
        # pathway_id is like "path:osa00010"; KEGG link endpoint uses "osa00010"
        short_id = pathway_id.replace("path:", "")
        url = KEGG_LINK_URL.format(pathway_id=short_id)
        time.sleep(KEGG_RATE_LIMIT)
        try:
            resp = client.get(url, timeout=60)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            print(f"[warn] {short_id}: HTTP {exc.response.status_code}, skipping")
            continue
        except httpx.RequestError as exc:
            print(f"[warn] {short_id}: request error {exc}, skipping")
            continue

        for line in resp.text.splitlines():
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            # gene entry looks like "osa:4324567"
            kegg_gene = parts[1].strip()
            entrez_id = kegg_gene.split(":")[-1]
            gene_id = entrez_map.get(entrez_id)
            if gene_id:
                records.append((gene_id, short_id, pathway_name))

        if (i + 1) % 20 == 0:
            print(f"[progress] {i + 1}/{len(pathways)} pathways processed ...")

    print(f"[info] {len(records)} gene-pathway associations found")

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter="\t")
        writer.writerow(["gene_id", "kegg_pathway_id", "kegg_pathway_name"])
        for gene_id, pathway_id, pathway_name in records:
            writer.writerow([gene_id, pathway_id, pathway_name])
    print(f"[done] saved {out_path} ({len(records)} rows)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[info] annotation directory: {DATA_DIR}")

    with httpx.Client(follow_redirects=True) as client:
        download_go_obo(client)
        download_go_annotation(client)
        download_kegg_annotation(client)

    print("[done] all annotation files ready")


if __name__ == "__main__":
    main()
