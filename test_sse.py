import sys
sys.path.insert(0, 'backend')

import asyncio
import uuid
import json
from app.models.analysis import CompareRequest
from app.routers.analysis import analysis_tasks

# 创建一个测试任务
job_id = f"job_{uuid.uuid4().hex[:8]}"
request = CompareRequest(
    dataset_id='ds_gse242459',
    group_control='WT',
    group_treatment='osbzip23'
)
analysis_tasks[job_id] = request
print(f"Created task: {job_id}")

# 现在测试获取 SSE
async def test_sse():
    from app.services.dataset_service import dataset_service
    from app.services.analysis_service import run_tool_analysis

    dataset = dataset_service.get_by_id(request.dataset_id)
    control_samples = dataset.groups[request.group_control]
    treatment_samples = dataset.groups[request.group_treatment]

    print(f"Dataset: {dataset.name}")
    print(f"File: {dataset.file_path}")

    # 读取 CSV
    import pandas as pd
    df = pd.read_csv(dataset.file_path, sep='\t')
    print(f"CSV loaded: {df.shape}")

    # 模拟 SSE 事件生成器
    async def event_generator():
        yield f"data: Job ID: {job_id}\n\n"

        await asyncio.sleep(0.5)
        yield "data: Starting analysis...\n\n"

        # 运行分析
        result = await run_tool_analysis(
            df, control_samples, treatment_samples,
            request.pvalue_threshold, request.log2fc_threshold
        )

        yield f"data: Analysis done: {len(result.significant_genes)} genes\n\n"

    # 测试事件生成器
    gen = event_generator()
    count = 0
    async for event in gen:
        count += 1
        print(f"Event {count}: {event.strip()}")
        if count >= 3:
            break

asyncio.run(test_sse())
print("Test complete")