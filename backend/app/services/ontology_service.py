import json
import os
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.models.ontology import (
    OntologyGraph, OntologyNode, OntologyEdge,
    OntologyType, OntologyCreate, OntologyUpdate, OntologyListResponse
)
from app.config import settings

class OntologyService:
    """本体服务"""

    def __init__(self):
        self.graph: OntologyGraph = OntologyGraph()
        self._load_ontology()

    def _load_ontology(self):
        """加载本体数据"""
        ontology_path = os.path.join(settings.data_dir, settings.ontology_file)
        if os.path.exists(ontology_path):
            try:
                with open(ontology_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.graph = OntologyGraph(**data)
            except Exception as e:
                print(f"Failed to load ontology: {e}")
                self.graph = self._create_default_ontology()
                self._save_ontology()
        else:
            self.graph = self._create_default_ontology()
            self._save_ontology()

    def _save_ontology(self):
        """保存本体数据"""
        ontology_path = os.path.join(settings.data_dir, settings.ontology_file)
        os.makedirs(settings.data_dir, exist_ok=True)

        def serialize_datetime(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            return obj

        with open(ontology_path, 'w', encoding='utf-8') as f:
            json.dump(self.graph.model_dump(), f, ensure_ascii=False, indent=2, default=serialize_datetime)

    def _create_default_ontology(self) -> OntologyGraph:
        """创建默认本体图谱"""
        nodes = [
            OntologyNode(id="genotype_1", type=OntologyType.GENOTYPE, name="水稻基因型",
                        properties={"category": "crop", "description": "水稻的遗传构成"}),
            OntologyNode(id="genotype_2", type=OntologyType.GENOTYPE, name="小麦基因型",
                        properties={"category": "crop", "description": "小麦的遗传构成"}),
            OntologyNode(id="genotype_3", type=OntologyType.GENOTYPE, name="玉米基因型",
                        properties={"category": "crop", "description": "玉米的遗传构成"}),
            OntologyNode(id="trait_1", type=OntologyType.TRAIT, name="产量",
                        properties={"category": "agronomic", "description": "作物产量性状"}),
            OntologyNode(id="trait_2", type=OntologyType.TRAIT, name="品质",
                        properties={"category": "agronomic", "description": "作物品质性状"}),
            OntologyNode(id="trait_3", type=OntologyType.TRAIT, name="抗病性",
                        properties={"category": "resistance", "description": "抗病抗逆性状"}),
            OntologyNode(id="trait_4", type=OntologyType.TRAIT, name="生育期",
                        properties={"category": "phenological", "description": "生长周期性状"}),
            OntologyNode(id="metabolome_1", type=OntologyType.METABOLOME, name="蛋白质含量",
                        properties={"category": "nutritional", "description": "营养成分含量"}),
            OntologyNode(id="metabolome_2", type=OntologyType.METABOLOME, name="淀粉含量",
                        properties={"category": "nutritional", "description": "营养成分含量"}),
            OntologyNode(id="metabolome_3", type=OntologyType.METABOLOME, name="维生素含量",
                        properties={"category": "nutritional", "description": "营养成分含量"}),
            OntologyNode(id="env_1", type=OntologyType.ENVIRONMENT, name="温度",
                        properties={"category": "climate", "description": "温度条件"}),
            OntologyNode(id="env_2", type=OntologyType.ENVIRONMENT, name="降雨量",
                        properties={"category": "climate", "description": "水分条件"}),
            OntologyNode(id="env_3", type=OntologyType.ENVIRONMENT, name="土壤类型",
                        properties={"category": "soil", "description": "土壤条件"}),
            OntologyNode(id="method_1", type=OntologyType.METHOD, name="杂交育种",
                        properties={"category": "breeding", "description": "传统育种方法"}),
            OntologyNode(id="method_2", type=OntologyType.METHOD, name="分子标记辅助选择",
                        properties={"category": "breeding", "description": "现代育种技术"}),
            OntologyNode(id="method_3", type=OntologyType.METHOD, name="基因编辑",
                        properties={"category": "biotech", "description": "生物技术方法"}),
        ]
        edges = [
            OntologyEdge(source="genotype_1", target="trait_1", relation="决定"),
            OntologyEdge(source="genotype_1", target="trait_2", relation="影响"),
            OntologyEdge(source="genotype_1", target="trait_3", relation="决定"),
            OntologyEdge(source="genotype_2", target="trait_1", relation="决定"),
            OntologyEdge(source="genotype_2", target="trait_2", relation="影响"),
            OntologyEdge(source="genotype_3", target="trait_1", relation="决定"),
            OntologyEdge(source="genotype_3", target="trait_4", relation="影响"),
            OntologyEdge(source="trait_1", target="metabolome_1", relation="关联"),
            OntologyEdge(source="trait_2", target="metabolome_2", relation="影响"),
            OntologyEdge(source="trait_2", target="metabolome_3", relation="影响"),
            OntologyEdge(source="env_1", target="trait_1", relation="影响"),
            OntologyEdge(source="env_1", target="trait_4", relation="影响"),
            OntologyEdge(source="env_2", target="trait_1", relation="影响"),
            OntologyEdge(source="env_2", target="trait_3", relation="影响"),
            OntologyEdge(source="env_3", target="trait_1", relation="影响"),
            OntologyEdge(source="method_1", target="genotype_1", relation="应用于"),
            OntologyEdge(source="method_2", target="genotype_1", relation="应用于"),
            OntologyEdge(source="method_3", target="genotype_1", relation="应用于"),
        ]
        return OntologyGraph(nodes=nodes, edges=edges)

    def get_graph(self) -> OntologyGraph:
        """获取完整本体图谱"""
        return self.graph

    def get_nodes(self, node_type: Optional[OntologyType] = None) -> List[OntologyNode]:
        """获取节点列表"""
        if node_type:
            return [n for n in self.graph.nodes if n.type == node_type]
        return self.graph.nodes

    def get_node(self, node_id: str) -> Optional[OntologyNode]:
        """获取单个节点"""
        for n in self.graph.nodes:
            if n.id == node_id:
                return n
        return None

    def get_edges(self, source_id: Optional[str] = None, target_id: Optional[str] = None) -> List[OntologyEdge]:
        """获取边列表"""
        edges = self.graph.edges
        if source_id:
            edges = [e for e in edges if e.source == source_id]
        if target_id:
            edges = [e for e in edges if e.target == target_id]
        return edges

    def get_node_relations(self, node_id: str) -> Dict[str, List[OntologyEdge]]:
        """获取节点的所有关联边"""
        incoming = [e for e in self.graph.edges if e.target == node_id]
        outgoing = [e for e in self.graph.edges if e.source == node_id]
        return {"incoming": incoming, "outgoing": outgoing}

    def search_nodes(self, keyword: str) -> List[OntologyNode]:
        """搜索节点"""
        keyword = keyword.lower()
        results = []
        for n in self.graph.nodes:
            if (keyword in n.name.lower() or
                keyword in n.properties.get("description", "").lower() or
                keyword in n.properties.get("category", "").lower()):
                results.append(n)
        return results

    def create_node(self, node_data: OntologyCreate) -> OntologyNode:
        """创建节点"""
        node = OntologyNode(
            id=f"{node_data.type.value}_{len(self.graph.nodes) + 1}",
            type=node_data.type,
            name=node_data.name,
            properties=node_data.properties
        )
        self.graph.nodes.append(node)
        self._save_ontology()
        return node

    def update_node(self, node_id: str, updates: OntologyUpdate) -> Optional[OntologyNode]:
        """更新节点"""
        for n in self.graph.nodes:
            if n.id == node_id:
                if updates.name is not None:
                    n.name = updates.name
                if updates.properties is not None:
                    n.properties = updates.properties
                n.updated_at = datetime.now()
                self._save_ontology()
                return n
        return None

    def delete_node(self, node_id: str) -> bool:
        """删除节点"""
        self.graph.nodes = [n for n in self.graph.nodes if n.id != node_id]
        self.graph.edges = [
            e for e in self.graph.edges
            if e.source != node_id and e.target != node_id
        ]
        self._save_ontology()
        return True

    def create_edge(self, edge: OntologyEdge) -> OntologyEdge:
        """创建边"""
        # 验证源节点和目标节点存在
        source_exists = any(n.id == edge.source for n in self.graph.nodes)
        target_exists = any(n.id == edge.target for n in self.graph.nodes)
        if not source_exists or not target_exists:
            raise ValueError("Source or target node does not exist")
        self.graph.edges.append(edge)
        self._save_ontology()
        return edge

    def delete_edge(self, source: str, target: str, relation: str) -> bool:
        """删除边"""
        self.graph.edges = [
            e for e in self.graph.edges
            if not (e.source == source and e.target == target and e.relation == relation)
        ]
        self._save_ontology()
        return True


# 全局单例
ontology_service = OntologyService()
