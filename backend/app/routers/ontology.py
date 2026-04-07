from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.services.ontology_service import ontology_service
from app.models.ontology import (
    OntologyGraph, OntologyNode, OntologyEdge, OntologyType,
    OntologyCreate, OntologyUpdate, OntologyListResponse
)

router = APIRouter(redirect_slashes=False)


@router.get("/", response_model=OntologyGraph)
async def get_ontology_graph():
    """获取完整本体图谱"""
    return ontology_service.get_graph()


@router.get("/nodes", response_model=OntologyListResponse)
async def get_nodes(type: Optional[OntologyType] = Query(None, description="节点类型过滤")):
    """获取节点列表"""
    nodes = ontology_service.get_nodes(type)
    return OntologyListResponse(total=len(nodes), items=nodes)


@router.get("/nodes/{node_id}", response_model=OntologyNode)
async def get_node(node_id: str):
    """获取单个节点"""
    node = ontology_service.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.post("/nodes", response_model=OntologyNode)
async def create_node(node_data: OntologyCreate):
    """创建节点"""
    return ontology_service.create_node(node_data)


@router.patch("/nodes/{node_id}", response_model=OntologyNode)
async def update_node(node_id: str, updates: OntologyUpdate):
    """更新节点"""
    node = ontology_service.update_node(node_id, updates)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.delete("/nodes/{node_id}")
async def delete_node(node_id: str):
    """删除节点"""
    success = ontology_service.delete_node(node_id)
    if not success:
        raise HTTPException(status_code=404, detail="Node not found")
    return {"message": "Node deleted successfully"}


@router.get("/edges")
async def get_edges(
    source: Optional[str] = Query(None, description="源节点ID"),
    target: Optional[str] = Query(None, description="目标节点ID")
):
    """获取边列表"""
    edges = ontology_service.get_edges(source, target)
    return {"total": len(edges), "items": edges}


@router.post("/edges", response_model=OntologyEdge)
async def create_edge(edge: OntologyEdge):
    """创建边"""
    try:
        return ontology_service.create_edge(edge)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/edges")
async def delete_edge(source: str, target: str, relation: str):
    """删除边"""
    success = ontology_service.delete_edge(source, target, relation)
    if not success:
        raise HTTPException(status_code=404, detail="Edge not found")
    return {"message": "Edge deleted successfully"}


@router.get("/nodes/{node_id}/relations")
async def get_node_relations(node_id: str):
    """获取节点的所有关联"""
    return ontology_service.get_node_relations(node_id)


@router.get("/search")
async def search_ontology(keyword: str = Query(..., description="搜索关键词")):
    """搜索本体节点"""
    results = ontology_service.search_nodes(keyword)
    return {"total": len(results), "items": results}


class GeneSyncItem(BaseModel):
    """单个基因同步项"""
    gene_id: str
    expression_change: str  # "up" | "down" | "none"
    log2fc: Optional[float] = None
    pvalue: Optional[float] = None


class SyncAnalysisResultRequest(BaseModel):
    """同步分析结果到本体库的请求"""
    analysis_id: str
    dataset_id: str
    dataset_name: str
    genes: List[GeneSyncItem]


@router.post("/sync-analysis")
async def sync_analysis_result(request: SyncAnalysisResultRequest):
    """将分析结果中的显著基因同步到本体库"""
    synced_genes = []
    skipped_genes = []

    for gene in request.genes:
        # 跳过无变化的基因
        if gene.expression_change == "none":
            continue

        try:
            # 获取或创建基因节点
            node = ontology_service.get_or_create_gene_node(
                gene_id=gene.gene_id,
                properties={
                    "expression_change": gene.expression_change,
                    "log2fc": gene.log2fc,
                    "pvalue": gene.pvalue,
                    "source_analysis": request.analysis_id,
                    "source_dataset": request.dataset_id,
                    "source_dataset_name": request.dataset_name,
                }
            )

            # 添加与分析结果的关联边
            ontology_service.add_analysis_result_edge(
                gene_id=gene.gene_id,
                analysis_id=request.analysis_id,
                expression_change=gene.expression_change
            )

            synced_genes.append(gene.gene_id)
        except Exception as e:
            skipped_genes.append({"gene_id": gene.gene_id, "error": str(e)})

    return {
        "status": "success",
        "synced_count": len(synced_genes),
        "skipped_count": len(skipped_genes),
        "synced_genes": synced_genes,
        "skipped_genes": skipped_genes,
    }
