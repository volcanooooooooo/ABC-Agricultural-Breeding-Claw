import os
import re
import uuid
import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import pandas as pd

from app.models.dataset import Dataset, DatasetUploadRequest, MAX_FILE_SIZE

# 使用相对于项目根目录的路径
# 确保无论从哪个目录启动后端，路径都正确
import app
APP_DIR = Path(app.__file__).parent.parent  # backend/app/ -> backend/
DATA_DIR = APP_DIR / "data"
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
                # 解析文件路径：如果不是绝对路径，则相对于 APP_DIR
                file_path = Path(d["file_path"])
                if not file_path.is_absolute():
                    file_path = APP_DIR / file_path
                d["file_path"] = str(file_path)
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

    def register_temp(self, file_path: str, filename: str, groups: Dict[str, List[str]]) -> Dataset:
        """Register an uploaded file as a temporary dataset for dual-track analysis."""
        path = Path(file_path)
        if not path.exists():
            raise ValueError(f"File not found: {file_path}")

        # Read file to get gene_count
        ext = path.suffix.lower()
        sep = '\t' if ext in {'.tsv', '.txt'} else ','
        try:
            df = pd.read_csv(path, sep=sep, index_col=0, usecols=[0])
            gene_count = len(df)
        except Exception:
            gene_count = 0

        all_samples = []
        for samples in groups.values():
            all_samples.extend(samples)

        dataset_id = f"ds_tmp_{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow().isoformat() + "Z"

        dataset = Dataset(
            id=dataset_id,
            name=filename,
            description=f"用户上传文件: {filename}",
            data_type="expression_matrix",
            file_path=str(path),
            file_size=path.stat().st_size,
            gene_count=max(gene_count, 1),
            sample_count=max(len(all_samples), 2),
            groups=groups,
            created_at=now,
            updated_at=now,
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
