"""Unit tests for the local MH63 enrichment analysis tool."""

import json
import pytest

from app.tools.enrichment import enrichment_analysis


class TestEnrichmentAnalysis:
    """Tests for enrichment_analysis function."""

    def test_empty_gene_list_returns_error(self):
        result = json.loads(enrichment_analysis(""))
        assert "error" in result
        assert "empty" in result["error"].lower()

    def test_whitespace_gene_list_returns_error(self):
        result = json.loads(enrichment_analysis("  ,  , "))
        assert "error" in result

    def test_returns_valid_json_structure(self):
        result = json.loads(enrichment_analysis("OsMH_01G0000400,OsMH_02G0001200"))
        assert "kegg_results" in result
        assert "go_results" in result
        assert "summary" in result
        assert isinstance(result["kegg_results"], list)
        assert isinstance(result["go_results"], list)
        assert isinstance(result["summary"], dict)

    def test_summary_fields(self):
        result = json.loads(enrichment_analysis("OsMH_01G0000400,OsMH_02G0001200"))
        summary = result["summary"]
        assert "input_gene_count" in summary
        assert "organism" in summary
        assert "pvalue_cutoff" in summary
        assert "MH63" in summary["organism"]
        assert summary["pvalue_cutoff"] == 0.05
        assert summary["input_gene_count"] == 2

    def test_analysis_type_go_only(self):
        result = json.loads(
            enrichment_analysis("OsMH_01G0000400,OsMH_02G0001200", analysis_type="GO")
        )
        assert result["kegg_results"] == []

    def test_analysis_type_kegg_only(self):
        result = json.loads(
            enrichment_analysis("OsMH_01G0000400,OsMH_02G0001200", analysis_type="KEGG")
        )
        assert result["go_results"] == []

    def test_result_pathway_fields(self):
        result = json.loads(enrichment_analysis("OsMH_01G0000400,OsMH_02G0001200"))
        all_results = result["kegg_results"] + result["go_results"]
        required_fields = {
            "pathway", "pathway_id", "gene_count", "total_genes",
            "pvalue", "adjusted_pvalue", "enrichment_score", "genes",
        }
        for item in all_results:
            for field in required_fields:
                assert field in item, f"Missing field '{field}' in result: {item}"
            assert isinstance(item["genes"], list)
