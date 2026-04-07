import json
import os
import csv
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path
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

    def _get_ref_doc_data_dir(self) -> Path:
        """获取 ref_doc/data 目录路径"""
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        return base_dir / "ref_doc" / "data"

    def _load_ontology(self):
        """加载本体数据，优先从 ref_doc CSV 加载"""
        ref_doc_dir = self._get_ref_doc_data_dir()
        nodes_csv = ref_doc_dir / "ontology_nodes.csv"
        edges_csv = ref_doc_dir / "ontology_edges.csv"

        if nodes_csv.exists() and edges_csv.exists():
            try:
                nodes = self._load_nodes_from_csv(nodes_csv)
                edges = self._load_edges_from_csv(edges_csv)
                self.graph = OntologyGraph(nodes=nodes, edges=edges)
                print(f"Loaded ontology from ref_doc: {len(nodes)} nodes, {len(edges)} edges")
                return
            except Exception as e:
                print(f"Failed to load ontology from ref_doc: {e}")

        # 回退：尝试加载本地 JSON 文件
        ontology_path = os.path.join(settings.data_dir, settings.ontology_file)
        if os.path.exists(ontology_path):
            try:
                with open(ontology_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.graph = OntologyGraph(**data)
                print(f"Loaded ontology from JSON: {len(self.graph.nodes)} nodes, {len(self.graph.edges)} edges")
            except Exception as e:
                print(f"Failed to load ontology from JSON: {e}")
                self.graph = OntologyGraph()
        else:
            self.graph = OntologyGraph()

    def _load_nodes_from_csv(self, csv_path: Path) -> List[OntologyNode]:
        """从 CSV 加载节点"""
        nodes = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                node_id = row['id']
                type_str = row.get('type', 'Dataset')

                # 映射类型字符串到枚举
                try:
                    node_type = OntologyType(type_str)
                except ValueError:
                    node_type = OntologyType.DATASET

                # 解析 properties JSON
                properties = {}
                if row.get('properties'):
                    try:
                        properties = json.loads(row['properties'])
                    except json.JSONDecodeError:
                        pass

                nodes.append(OntologyNode(
                    id=node_id,
                    type=node_type,
                    name=row['label'],
                    properties=properties
                ))
        return nodes

    def _load_edges_from_csv(self, csv_path: Path) -> List[OntologyEdge]:
        """从 CSV 加载边"""
        edges = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                edges.append(OntologyEdge(
                    source=row['source'],
                    target=row['target'],
                    relation=row['type']
                ))
        return edges

    def _save_ontology(self):
        """保存本体数据到 JSON 和 CSV"""
        ontology_path = os.path.join(settings.data_dir, settings.ontology_file)
        os.makedirs(settings.data_dir, exist_ok=True)

        def serialize_datetime(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            return obj

        # 保存到 JSON
        with open(ontology_path, 'w', encoding='utf-8') as f:
            json.dump(self.graph.model_dump(), f, ensure_ascii=False, indent=2, default=serialize_datetime)

        # 同时保存到 CSV（保持与 ref_doc 数据格式一致）
        try:
            ref_doc_dir = self._get_ref_doc_data_dir()
            ref_doc_dir.mkdir(parents=True, exist_ok=True)
            nodes_csv = ref_doc_dir / "ontology_nodes.csv"
            edges_csv = ref_doc_dir / "ontology_edges.csv"

            # 保存节点到 CSV
            with open(nodes_csv, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['id', 'label', 'type', 'properties'])
                for node in self.graph.nodes:
                    writer.writerow([
                        node.id,
                        node.name,
                        node.type.value if hasattr(node.type, 'value') else node.type,
                        json.dumps(node.properties, ensure_ascii=False)
                    ])

            # 保存边到 CSV
            with open(edges_csv, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['source', 'target', 'type'])
                for edge in self.graph.edges:
                    writer.writerow([edge.source, edge.target, edge.relation])
        except Exception as e:
            print(f"Failed to save ontology to CSV: {e}")

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

    def node_exists(self, node_id: str) -> bool:
        """检查节点是否存在"""
        return any(n.id == node_id for n in self.graph.nodes)

    def get_or_create_gene_node(self, gene_id: str, properties: Optional[Dict[str, Any]] = None) -> OntologyNode:
        """获取或创建基因节点"""
        existing = self.get_node(gene_id)
        if existing:
            # 更新属性
            if properties:
                existing.properties.update(properties)
                self._save_ontology()
            return existing

        # 创建新节点
        node = OntologyNode(
            id=gene_id,
            type=OntologyType.GENE,
            name=gene_id,
            properties=properties or {}
        )
        self.graph.nodes.append(node)
        self._save_ontology()
        return node

    def add_analysis_result_edge(self, gene_id: str, analysis_id: str, expression_change: str) -> Optional[OntologyEdge]:
        """添加基因与分析结果的关联边"""
        # 检查是否已存在相同的边
        for edge in self.graph.edges:
            if edge.source == gene_id and edge.target == analysis_id and edge.relation == "detected_in":
                return edge  # 已存在，直接返回

        edge = OntologyEdge(
            source=gene_id,
            target=analysis_id,
            relation="detected_in"
        )
        self.graph.edges.append(edge)
        self._save_ontology()
        return edge

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
