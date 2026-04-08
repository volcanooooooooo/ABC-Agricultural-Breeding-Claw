"""Download MH63 rice annotation files from Ensembl Plants BioMart and KEGG REST API.

Usage:
    cd backend && python -m scripts.prepare_annotations
"""

import csv
import os
import time
import warnings
from pathlib import Path

import httpx

# Suppress SSL warnings when using verify=False (proxy environments)
warnings.filterwarnings("ignore", message="Unverified HTTPS request")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / "data" / "annotations"

GO_OBO_URL = "http://purl.obolibrary.org/obo/go/go-basic.obo"
BIOMART_URL = "https://plants.ensembl.org/biomart/martservice"
KEGG_LIST_URL = "https://rest.kegg.jp/list/pathway/osa"
KEGG_LINK_ALL_URL = "https://rest.kegg.jp/link/pathway/osa"  # bulk: all osa gene→pathway

# ---------------------------------------------------------------------------
# BioMart XML query helpers
# ---------------------------------------------------------------------------

_BIOMART_GO_XML = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Query>
<Query virtualSchemaName="plants_mart" formatter="TSV" header="0"
       uniqueRows="1" count="" datasetConfigVersion="0.6">
  <Dataset name="osmh63_eg_gene" interface="default">
    <Attribute name="ensembl_gene_id"/>
    <Attribute name="go_id"/>
    <Attribute name="name_1006"/>
    <Attribute name="namespace_1003"/>
  </Dataset>
</Query>"""

_BIOMART_MH63_HOMOLOG_XML = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Query>
<Query virtualSchemaName="plants_mart" formatter="TSV" header="0"
       uniqueRows="1" count="" datasetConfigVersion="0.6">
  <Dataset name="osmh63_eg_gene" interface="default">
    <Attribute name="ensembl_gene_id"/>
    <Attribute name="osativa_eg_homolog_ensembl_gene"/>
  </Dataset>
</Query>"""

_BIOMART_JAPONICA_ENTREZ_XML = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Query>
<Query virtualSchemaName="plants_mart" formatter="TSV" header="0"
       uniqueRows="1" count="" datasetConfigVersion="0.6">
  <Dataset name="osativa_eg_gene" interface="default">
    <Attribute name="ensembl_gene_id"/>
    <Attribute name="entrezgene_id"/>
  </Dataset>
</Query>"""


def _biomart_query(xml: str, client: httpx.Client, max_retries: int = 3) -> list[list[str]]:
    """Query BioMart via GET (more proxy-friendly) with retry."""
    for attempt in range(max_retries):
        try:
            resp = client.get(
                BIOMART_URL,
                params={"query": xml.strip()},
                timeout=300,
            )
            resp.raise_for_status()
            rows = []
            for line in resp.text.splitlines():
                if line.strip():
                    rows.append(line.split("\t"))
            return rows
        except (httpx.RemoteProtocolError, httpx.ReadTimeout, httpx.ConnectError) as e:
            if attempt < max_retries - 1:
                wait = (attempt + 1) * 10
                print(f"  [retry] attempt {attempt + 1} failed: {e}, retrying in {wait}s ...")
                time.sleep(wait)
            else:
                raise
    return []


def _kegg_get(url: str, client: httpx.Client, max_retries: int = 3) -> httpx.Response | None:
    """GET a KEGG REST API URL with retry for proxy/SSL issues."""
    for attempt in range(max_retries):
        try:
            resp = client.get(url, timeout=120)
            resp.raise_for_status()
            return resp
        except (httpx.RemoteProtocolError, httpx.ReadTimeout, httpx.ConnectError) as e:
            if attempt < max_retries - 1:
                wait = (attempt + 1) * 10
                print(f"  [retry] attempt {attempt + 1} failed: {e}, retrying in {wait}s ...")
                time.sleep(wait)
            else:
                print(f"  [error] all {max_retries} attempts failed: {e}")
                return None
        except httpx.HTTPStatusError as e:
            print(f"  [error] HTTP {e.response.status_code} for {url}")
            return None


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

    # Step 1: BioMart — MH63 gene → japonica ortholog
    print("[download] MH63 → japonica ortholog mapping from BioMart ...")
    homolog_rows = _biomart_query(_BIOMART_MH63_HOMOLOG_XML, client)
    japonica_to_mh63: dict[str, str] = {}
    for row in homolog_rows:
        if len(row) < 2:
            continue
        mh63_id, jap_id = row[0].strip(), row[1].strip()
        if mh63_id and jap_id:
            japonica_to_mh63[jap_id] = mh63_id
    print(f"[info] {len(japonica_to_mh63)} japonica → MH63 ortholog mappings")

    # Step 2: BioMart — japonica gene → Entrez ID
    print("[download] japonica gene → Entrez ID mapping from BioMart ...")
    entrez_rows = _biomart_query(_BIOMART_JAPONICA_ENTREZ_XML, client)
    entrez_to_japonica: dict[str, str] = {}
    for row in entrez_rows:
        if len(row) < 2:
            continue
        jap_id, entrez_id = row[0].strip(), row[1].strip()
        if jap_id and entrez_id:
            entrez_to_japonica[entrez_id] = jap_id
    print(f"[info] {len(entrez_to_japonica)} entrez → japonica mappings")

    # Build entrez → MH63 (entrez → japonica → MH63)
    entrez_to_mh63: dict[str, str] = {}
    for entrez_id, jap_id in entrez_to_japonica.items():
        mh63_id = japonica_to_mh63.get(jap_id)
        if mh63_id:
            entrez_to_mh63[entrez_id] = mh63_id
    print(f"[info] {len(entrez_to_mh63)} entrez → MH63 mappings (via japonica)")

    # Step 2: KEGG — bulk get all osa gene→pathway links
    print(f"[download] all osa gene→pathway links from KEGG (bulk) ...")
    time.sleep(1)
    resp = _kegg_get(KEGG_LINK_ALL_URL, client)
    if resp is None:
        print("[error] failed to fetch KEGG gene→pathway links")
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            csv.writer(f, delimiter="\t").writerow(["gene_id", "kegg_pathway_id", "kegg_pathway_name"])
        return

    # Parse: each line is "osa:ENTREZ_ID\tpath:osaXXXXX"
    entrez_pathway: list[tuple[str, str]] = []
    for line in resp.text.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        entrez_id = parts[0].strip().replace("osa:", "")
        pathway_id = parts[1].strip().replace("path:", "")
        entrez_pathway.append((entrez_id, pathway_id))
    print(f"[info] {len(entrez_pathway)} gene-pathway links from KEGG")

    # Step 3: KEGG — get pathway names
    print(f"[download] KEGG pathway names ...")
    time.sleep(1)
    resp = _kegg_get(KEGG_LIST_URL, client)
    pathway_names: dict[str, str] = {}
    if resp:
        for line in resp.text.splitlines():
            if not line.strip():
                continue
            parts = line.split("\t", 1)
            if len(parts) == 2:
                pw_id = parts[0].strip().replace("path:", "")
                pw_name = parts[1].strip()
                pathway_names[pw_id] = pw_name
    print(f"[info] {len(pathway_names)} pathway names loaded")

    # Step 4: Join — entrez → MH63, pathway_id → name
    records: list[tuple[str, str, str]] = []
    for entrez_id, pathway_id in entrez_pathway:
        mh63_id = entrez_to_mh63.get(entrez_id)
        if mh63_id:
            pw_name = pathway_names.get(pathway_id, pathway_id)
            records.append((mh63_id, pathway_id, pw_name))

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter="\t")
        writer.writerow(["gene_id", "kegg_pathway_id", "kegg_pathway_name"])
        for row in records:
            writer.writerow(row)
    print(f"[done] saved {out_path} ({len(records)} gene-pathway pairs)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[info] annotation directory: {DATA_DIR}")

    with httpx.Client(follow_redirects=True, verify=False) as client:
        download_go_obo(client)
        download_go_annotation(client)
        download_kegg_annotation(client)

    print("[done] all annotation files ready")


if __name__ == "__main__":
    main()
