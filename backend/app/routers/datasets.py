from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import List

from app.models.dataset import Dataset, DatasetUploadRequest
from app.services.dataset_service import dataset_service

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("", response_model=List[Dataset])
async def get_datasets():
    """获取数据集列表"""
    return dataset_service.get_all()


@router.get("/{dataset_id}", response_model=Dataset)
async def get_dataset(dataset_id: str):
    """获取数据集详情"""
    dataset = dataset_service.get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.post("/upload", response_model=Dataset)
async def upload_dataset(
    name: str,
    description: str = None,
    group_control: str = "control",
    group_treatment: str = "treatment",
    control_samples: str = "",
    treatment_samples: str = "",
    file: UploadFile = File(...)
):
    """上传数据集"""
    ALLOWED_CONTENT_TYPES = ['text/csv', 'application/vnd.ms-excel',
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            'application/octet-stream']

    content_type = file.content_type or 'application/octet-stream'
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Unsupported file format")

    control_list = [s.strip() for s in control_samples.split(",") if s.strip()]
    treatment_list = [s.strip() for s in treatment_samples.split(",") if s.strip()]

    if len(control_list) < 2 or len(treatment_list) < 2:
        raise HTTPException(status_code=400, detail="Each group must have at least 2 samples")

    request = DatasetUploadRequest(
        name=name,
        description=description,
        group_control=group_control,
        group_treatment=group_treatment,
        control_samples=control_list,
        treatment_samples=treatment_list
    )

    file_content = await file.read()

    try:
        dataset = await dataset_service.upload(request, file_content)
        return dataset
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str):
    """删除数据集"""
    success = dataset_service.delete(dataset_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"message": "Dataset deleted"}
