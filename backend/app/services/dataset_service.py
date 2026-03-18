import os
import re
import uuid
import json
from pathlib import Path
from typing import List, Optional
from datetime import datetime
import pandas as pd

from app.models.dataset import Dataset, DatasetUploadRequest, MAX_FILE_SIZE

DATA_DIR = Path("backend/data")
DATASETS_DIR = DATA_DIR / "datasets"
DATASETS_FILE = DATA_DIR / "datasets.json"


def validate_filename(filename: str) -> bool:
    """验证文件名安全，防止路径遍历攻击"""
    if not re.match(r'^[a-zA-Z0-9_\-\.]+$', filename):
        return False
    if filename.startswith('.'):
        return False
    return True


class DatasetService:
    def __init__(self):
        DATASETS_DIR.mkdir(parents=True, exist_ok=True)

    def _load_datasets(self) -> List[dict]:
        if DATASETS_FILE.exists():
            with open(DATASETS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("datasets", [])
        return []

    def _save_datasets(self, datasets: List[dict]):
        DATASETS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(DATASETS_FILE, "w", encoding="utf-8") as f:
            json.dump({"datasets": datasets}, f, ensure_ascii=False, indent=2)

    def get_all(self) -> List[Dataset]:
        data = self._load_datasets()
        return [Dataset(**d) for d in data]

    def get_by_id(self, dataset_id: str) -> Optional[Dataset]:
        datasets = self._load_datasets()
        for d in datasets:
            if d["id"] == dataset_id:
                return Dataset(**d)
        return None

    async def upload(self, request: DatasetUploadRequest, file_content: bytes) -> Dataset:
        # 安全检查：文件大小
        if len(file_content) > MAX_FILE_SIZE:
            raise ValueError(f"File too large. Max size: {MAX_FILE_SIZE / (1024*1024)}MB")

        dataset_id = f"ds_{uuid.uuid4().hex[:8]}"
        file_ext = "csv"
        file_name = f"{dataset_id}.{file_ext}"

        if not validate_filename(file_name):
            raise ValueError("Invalid file name")

        file_path = DATASETS_DIR / file_name

        with open(file_path, "wb") as f:
            f.write(file_content)

        df = pd.read_csv(file_path)
        gene_count = len(df)
        sample_count = len(df.columns) - 1

        now = datetime.utcnow().isoformat() + "Z"
        dataset = Dataset(
            id=dataset_id,
            name=request.name,
            description=request.description,
            data_type="expression_matrix",
            file_path=str(file_path),
            file_size=len(file_content),
            gene_count=gene_count,
            sample_count=sample_count,
            groups={
                request.group_control: request.control_samples,
                request.group_treatment: request.treatment_samples
            },
            created_at=now,
            updated_at=now
        )

        datasets = self._load_datasets()
        datasets.append(dataset.model_dump())
        self._save_datasets(datasets)

        return dataset

    def delete(self, dataset_id: str) -> bool:
        datasets = self._load_datasets()
        dataset = None
        for d in datasets:
            if d["id"] == dataset_id:
                dataset = d
                break

        if not dataset:
            return False

        file_path = Path(dataset["file_path"])
        if file_path.exists():
            file_path.unlink()

        datasets = [d for d in datasets if d["id"] != dataset_id]
        self._save_datasets(datasets)

        return True


dataset_service = DatasetService()
