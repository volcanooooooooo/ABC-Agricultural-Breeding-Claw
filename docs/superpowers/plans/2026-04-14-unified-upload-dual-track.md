# Unified Upload Dual-Track Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "上传文件" analysis path go through the same dual-track analysis + card display pipeline as "内置数据集", with automatic group detection and manual fallback.

**Architecture:** Backend gets a group auto-detection utility and a new endpoint to register uploaded files as temporary datasets. Frontend wires the upload flow into the existing `handleAnalysisRequest` → SSE → `DualTrackResultCard` pipeline, with a group selection modal as fallback when auto-detection fails.

**Tech Stack:** FastAPI (backend), React + Ant Design (frontend), existing `analysisApi.compare` + SSE streaming

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/app/routers/analysis.py` | Modify | Add `suggested_groups` to `upload-matrix` response, add `register-temp` endpoint |
| `backend/app/services/dataset_service.py` | Modify | Add `register_temp()` method |
| `backend/app/models/dataset.py` | Modify | Relax `sample_count` constraint to `ge=2` for temp datasets |
| `src/api/client.ts` | Modify | Add `registerTemp` API method, update `uploadMatrix` return type |
| `src/components/GroupSelectModal.tsx` | Create | Modal for manual group assignment when auto-detection fails |
| `src/pages/ChatPage.tsx` | Modify | Wire upload flow into dual-track pipeline |

---

### Task 1: Backend — Group Auto-Detection + Upload Response Enhancement

**Files:**
- Modify: `backend/app/routers/analysis.py:290-329` (upload-matrix endpoint)

**Context:** The `upload-matrix` endpoint currently uploads the file and returns basic info (file_path, filename, columns, row_count). We need it to also auto-detect groups from column names and return suggested groups.

- [ ] **Step 1: Add group auto-detection logic to `upload-matrix`**

Add a helper function and modify the response in `backend/app/routers/analysis.py`:

```python
# Add this function before the upload-matrix endpoint

CONTROL_KEYWORDS = ['wt', 'ck', 'ctrl', 'control', 'mock', 'nc', 'wild', 'normal', 'untreated']

def infer_groups(columns: list[str]) -> dict | None:
    """Auto-detect control/treatment groups from column names.

    Strategy: columns containing any CONTROL_KEYWORDS substring → control group,
    all others → treatment group. Return None if detection fails.
    """
    control_cols = []
    treatment_cols = []

    for col in columns:
        col_lower = col.lower()
        if any(kw in col_lower for kw in CONTROL_KEYWORDS):
            control_cols.append(col)
        else:
            treatment_cols.append(col)

    # Need at least 2 samples per group for t-test
    if len(control_cols) >= 2 and len(treatment_cols) >= 2:
        # Derive group names from common substrings
        control_name = _extract_group_name(control_cols) or "control"
        treatment_name = _extract_group_name(treatment_cols) or "treatment"
        return {
            control_name: control_cols,
            treatment_name: treatment_cols,
        }
    return None


def _extract_group_name(cols: list[str]) -> str:
    """Extract a short group label from column names (e.g. 'DS_WT_rep1' → 'WT')."""
    for kw in CONTROL_KEYWORDS:
        for col in cols:
            if kw in col.lower():
                return kw.upper()
    # Fallback: find longest common substring segment
    if not cols:
        return ""
    parts_list = [col.replace("_", " ").replace("-", " ").split() for col in cols]
    if not parts_list:
        return ""
    common = set(parts_list[0])
    for parts in parts_list[1:]:
        common &= set(parts)
    # Remove numeric tokens (like rep1, rep2)
    common = {p for p in common if not p.replace("rep", "").isdigit()}
    return "_".join(sorted(common)) if common else ""
```

- [ ] **Step 2: Modify `upload-matrix` response to include `suggested_groups`**

In the same file, modify the `upload_matrix` endpoint's return statement:

```python
@router.post("/upload-matrix")
async def upload_matrix(file: UploadFile = File(...)):
    """上传表达矩阵文件（CSV/TSV），用于差异表达分析"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed_exts = {".csv", ".tsv", ".txt", ".xls", ".xlsx"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型 '{ext}'，请上传 CSV/TSV 格式文件")

    uploads_dir = Path(__file__).resolve().parent.parent.parent / "data" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    dest = uploads_dir / safe_name

    content = await file.read()
    dest.write_bytes(content)

    # 尝试读取文件获取基本信息
    columns = []
    row_count = 0
    try:
        sep = '\t' if ext in {'.tsv', '.txt'} else ','
        df = pd.read_csv(dest, sep=sep, index_col=0, nrows=5)
        columns = list(df.columns)
        row_count_df = pd.read_csv(dest, sep=sep, index_col=0, usecols=[0])
        row_count = len(row_count_df)
    except Exception:
        pass

    # Auto-detect groups
    suggested_groups = infer_groups(columns) if columns else None

    return {
        "status": "success",
        "data": {
            "file_path": str(dest),
            "filename": file.filename,
            "columns": columns,
            "row_count": row_count,
            "suggested_groups": suggested_groups,
        }
    }
```

- [ ] **Step 3: Verify backend starts without errors**

Run: `cd /data/chenghuang11/ABC-Agricultural-Breeding-Claw && PYTHONPATH=backend python -c "from app.routers.analysis import infer_groups; print(infer_groups(['DS_WT_rep1','DS_WT_rep2','N_WT_rep1','DS_osbzip23_rep1','DS_osbzip23_rep2']))"`

Expected: A dict with WT columns as control and osbzip23 columns as treatment.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/analysis.py
git commit -m "feat: add group auto-detection to upload-matrix endpoint"
```

---

### Task 2: Backend — Register Temp Dataset Endpoint

**Files:**
- Modify: `backend/app/services/dataset_service.py` (add `register_temp` method)
- Modify: `backend/app/routers/analysis.py` (add `/register-temp` endpoint)
- Modify: `backend/app/models/dataset.py` (relax sample_count constraint)

- [ ] **Step 1: Relax Dataset model sample_count constraint**

In `backend/app/models/dataset.py`, change line 22:

```python
# Before:
sample_count: int = Field(..., ge=4)  # 至少4个样本

# After:
sample_count: int = Field(..., ge=2)  # 至少2个样本（每组至少1个，但推荐每组≥2）
```

- [ ] **Step 2: Add `register_temp` method to DatasetService**

In `backend/app/services/dataset_service.py`, add this method to the `DatasetService` class:

```python
def register_temp(self, file_path: str, filename: str, groups: Dict[str, List[str]]) -> Dataset:
    """Register an uploaded file as a temporary dataset for dual-track analysis."""
    import uuid as _uuid
    from datetime import datetime

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

    dataset_id = f"ds_tmp_{_uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().isoformat() + "Z"

    dataset = Dataset(
        id=dataset_id,
        name=filename,
        description=f"用户上传文件: {filename}",
        data_type="expression_matrix",
        file_path=str(path),
        file_size=path.stat().st_size,
        gene_count=max(gene_count, 1),
        sample_count=len(all_samples),
        groups=groups,
        created_at=now,
        updated_at=now,
    )

    datasets = self._load_datasets()
    datasets.append(dataset.model_dump())
    self._save_datasets(datasets)

    return dataset
```

- [ ] **Step 3: Add `/register-temp` endpoint**

In `backend/app/routers/analysis.py`, add a new Pydantic model and endpoint:

```python
class RegisterTempRequest(BaseModel):
    """注册临时数据集请求"""
    file_path: str
    filename: str
    groups: Dict[str, List[str]]


@router.post("/register-temp")
async def register_temp_dataset(request: RegisterTempRequest):
    """将已上传的文件注册为临时数据集，用于双轨分析"""
    try:
        dataset = dataset_service.register_temp(
            file_path=request.file_path,
            filename=request.filename,
            groups=request.groups,
        )
        return {"status": "success", "data": dataset.model_dump()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

Don't forget to add `Dict` to the existing `typing` import at the top of `analysis.py` (it's already imported).

- [ ] **Step 4: Verify endpoint works**

Run: `cd /data/chenghuang11/ABC-Agricultural-Breeding-Claw && PYTHONPATH=backend python -c "from app.services.dataset_service import dataset_service; print('OK')"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/analysis.py backend/app/services/dataset_service.py backend/app/models/dataset.py
git commit -m "feat: add register-temp endpoint for uploaded matrix datasets"
```

---

### Task 3: Frontend — Update API Client

**Files:**
- Modify: `src/api/client.ts`

- [ ] **Step 1: Update `uploadMatrix` return type to include `suggested_groups`**

In `src/api/client.ts`, modify the `uploadMatrix` method (around line 202-208):

```typescript
  // 表达矩阵文件上传（用于差异分析）
  uploadMatrix: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<{
      file_path: string
      filename: string
      columns: string[]
      row_count: number
      suggested_groups: Record<string, string[]> | null
    }>>('/analysis/upload-matrix', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
```

- [ ] **Step 2: Add `registerTemp` method**

Add this method to `analysisApi` object, right after `uploadMatrix`:

```typescript
  // 注册临时数据集（上传文件 → 双轨分析）
  registerTemp: (filePath: string, filename: string, groups: Record<string, string[]>) =>
    api.post<ApiResponse<Dataset>>('/analysis/register-temp', {
      file_path: filePath,
      filename: filename,
      groups: groups,
    }),
```

- [ ] **Step 3: Commit**

```bash
git add src/api/client.ts
git commit -m "feat: add registerTemp API and update uploadMatrix types"
```

---

### Task 4: Frontend — Group Selection Modal Component

**Files:**
- Create: `src/components/GroupSelectModal.tsx`

**Context:** This modal shows when group auto-detection fails. It lists all column names and lets the user drag/check them into control vs treatment groups.

- [ ] **Step 1: Create `GroupSelectModal.tsx`**

```tsx
import React, { useState } from 'react'
import { Modal, Transfer, Input, message } from 'antd'

interface GroupSelectModalProps {
  open: boolean
  columns: string[]
  onConfirm: (groups: Record<string, string[]>) => void
  onCancel: () => void
}

export function GroupSelectModal({ open, columns, onConfirm, onCancel }: GroupSelectModalProps) {
  const [controlKeys, setControlKeys] = useState<string[]>([])
  const [controlName, setControlName] = useState('control')
  const [treatmentName, setTreatmentName] = useState('treatment')

  const dataSource = columns.map(col => ({ key: col, title: col }))

  const handleConfirm = () => {
    const controlCols = controlKeys
    const treatmentCols = columns.filter(c => !controlKeys.includes(c))

    if (controlCols.length < 2) {
      message.error('对照组至少需要 2 个样本')
      return
    }
    if (treatmentCols.length < 2) {
      message.error('处理组至少需要 2 个样本')
      return
    }
    if (!controlName.trim() || !treatmentName.trim()) {
      message.error('请输入分组名称')
      return
    }

    onConfirm({
      [controlName.trim()]: controlCols,
      [treatmentName.trim()]: treatmentCols,
    })
  }

  return (
    <Modal
      title="选择分组"
      open={open}
      onOk={handleConfirm}
      onCancel={onCancel}
      width={680}
      okText="确认分组并开始分析"
      cancelText="取消"
      styles={{ body: { paddingTop: 16 } }}
    >
      <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        无法自动识别分组，请将样本列分配到对照组和处理组：
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--color-text-muted)' }}>对照组名称</div>
          <Input value={controlName} onChange={e => setControlName(e.target.value)} size="small" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--color-text-muted)' }}>处理组名称</div>
          <Input value={treatmentName} onChange={e => setTreatmentName(e.target.value)} size="small" />
        </div>
      </div>

      <Transfer
        dataSource={dataSource}
        titles={['处理组 (右侧未选中)', '对照组']}
        targetKeys={controlKeys}
        onChange={setControlKeys}
        render={item => item.title}
        listStyle={{ width: 280, height: 320 }}
        locale={{
          itemUnit: '列',
          itemsUnit: '列',
          searchPlaceholder: '搜索样本列',
        }}
        showSearch
      />
    </Modal>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GroupSelectModal.tsx
git commit -m "feat: add GroupSelectModal for manual group assignment"
```

---

### Task 5: Frontend — Wire Upload Flow Into Dual-Track Pipeline

**Files:**
- Modify: `src/pages/ChatPage.tsx`

**Context:** This is the main change. When user clicks "上传表达矩阵文件" from the analysis-method-select card, instead of just uploading the file and showing a text hint, we now:
1. Upload file → get `suggested_groups`
2. If auto-detected → register as temp dataset → start dual-track analysis
3. If not → show GroupSelectModal → user assigns groups → register → start analysis

- [ ] **Step 1: Add imports and state for GroupSelectModal**

At the top of `ChatPage.tsx`, add the import:

```typescript
import { GroupSelectModal } from '../components/GroupSelectModal'
```

Add new state variables inside the `ChatPage` component (after existing state declarations around line 67):

```typescript
const [groupModalOpen, setGroupModalOpen] = useState(false)
const [pendingUpload, setPendingUpload] = useState<{
  filePath: string
  filename: string
  columns: string[]
  rowCount: number
} | null>(null)
```

- [ ] **Step 2: Create `handleUploadAndAnalyze` function**

Add this new function after `handleMatrixFileChange` (around line 435). This is the core logic that ties upload → register → dual-track analysis:

```typescript
// 上传文件 → 自动推断分组 → 双轨分析
const handleUploadAndAnalyze = async (file: File) => {
  try {
    const res = await analysisApi.uploadMatrix(file)
    const data = (res.data as any).data ?? res.data
    const { file_path, filename, columns, row_count, suggested_groups } = data

    if (suggested_groups && Object.keys(suggested_groups).length >= 2) {
      // 自动推断成功 → 注册临时数据集 → 直接开始双轨分析
      const groupKeys = Object.keys(suggested_groups)
      const totalSamples = groupKeys.reduce(
        (sum, k) => sum + (suggested_groups[k]?.length || 0), 0
      )

      // 显示上传成功消息
      updateCurrentSession(msgs => [...msgs, {
        id: `${Date.now()}-upload-success`,
        role: 'assistant',
        content: `文件 **${filename}** 上传成功（${row_count} 基因, ${totalSamples} 样本）。\n\n已自动识别分组：**${groupKeys[0]}**（${suggested_groups[groupKeys[0]].length} 样本）vs **${groupKeys[1]}**（${suggested_groups[groupKeys[1]].length} 样本），正在开始双轨分析...`,
        timestamp: new Date().toString(),
      }])

      // 注册临时数据集
      const regRes = await analysisApi.registerTemp(file_path, filename, suggested_groups)
      const dataset: Dataset = (regRes.data as any).data ?? regRes.data

      // 开始双轨分析
      setLoading(true)
      setIsAtBottom(true)
      setAnalysisStartTime(Date.now())
      await handleAnalysisRequest('', dataset)
      setLoading(false)
    } else {
      // 自动推断失败 → 弹出分组选择 Modal
      message.info(`文件 ${filename} 上传成功，请手动选择分组`)
      setPendingUpload({ filePath: file_path, filename, columns: columns || [], rowCount: row_count })
      setGroupModalOpen(true)
    }
  } catch (err: any) {
    message.error('文件上传失败: ' + (err.message || '未知错误'))
  }
}
```

- [ ] **Step 3: Create `handleGroupConfirm` function**

Add this function right after `handleUploadAndAnalyze`:

```typescript
// 用户手动确认分组后 → 注册临时数据集 → 双轨分析
const handleGroupConfirm = async (groups: Record<string, string[]>) => {
  if (!pendingUpload) return
  setGroupModalOpen(false)

  const groupKeys = Object.keys(groups)
  const totalSamples = groupKeys.reduce(
    (sum, k) => sum + (groups[k]?.length || 0), 0
  )

  // 显示确认消息
  updateCurrentSession(msgs => [...msgs, {
    id: `${Date.now()}-group-confirmed`,
    role: 'assistant',
    content: `文件 **${pendingUpload.filename}** 分组确认：**${groupKeys[0]}**（${groups[groupKeys[0]].length} 样本）vs **${groupKeys[1]}**（${groups[groupKeys[1]].length} 样本），正在开始双轨分析...`,
    timestamp: new Date().toString(),
  }])

  try {
    // 注册临时数据集
    const regRes = await analysisApi.registerTemp(
      pendingUpload.filePath, pendingUpload.filename, groups
    )
    const dataset: Dataset = (regRes.data as any).data ?? regRes.data

    // 开始双轨分析
    setLoading(true)
    setIsAtBottom(true)
    setAnalysisStartTime(Date.now())
    await handleAnalysisRequest('', dataset)
    setLoading(false)
  } catch (err: any) {
    message.error('注册数据集失败: ' + (err.message || '未知错误'))
  }

  setPendingUpload(null)
}
```

- [ ] **Step 4: Modify `handleSelectUploadMatrix` to use file picker callback**

Replace the existing `handleSelectUploadMatrix` function (around line 411-414):

```typescript
// Before:
const handleSelectUploadMatrix = () => {
  updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'analysis-method-select'))
  matrixFileInputRef.current?.click()
}

// After:
const handleSelectUploadMatrix = () => {
  updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'analysis-method-select'))
  matrixFileInputRef.current?.click()
}
```

(This function stays the same — the change is in `handleMatrixFileChange`.)

- [ ] **Step 5: Modify `handleMatrixFileChange` to route through dual-track**

Replace the existing `handleMatrixFileChange` function (around line 417-435):

```typescript
// 表达矩阵文件选择回调
const handleMatrixFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = '' // reset

  // 添加用户消息
  updateCurrentSession(msgs => [...msgs, {
    id: `${Date.now()}-upload-user`,
    role: 'user' as const,
    content: `上传表达矩阵文件：${file.name}`,
    timestamp: new Date().toString(),
  }])

  await handleUploadAndAnalyze(file)
}
```

- [ ] **Step 6: Also handle drag-and-drop matrix files through dual-track**

Modify the `handleDrop` function. Find the matrix file handling branch (around line 710-721) and replace it:

```typescript
    } else if (matrixExts.includes(ext) || ext === '.txt') {
      // 添加用户消息
      updateCurrentSession(msgs => [...msgs, {
        id: `${Date.now()}-drop-user`,
        role: 'user' as const,
        content: `上传表达矩阵文件：${file.name}`,
        timestamp: new Date().toString(),
      }])
      await handleUploadAndAnalyze(file)
```

- [ ] **Step 7: Add GroupSelectModal to the JSX render**

In the JSX, add the modal right after the `OntologyModal` (around line 1548):

```tsx
{/* 分组选择弹窗（上传文件自动推断失败时） */}
<GroupSelectModal
  open={groupModalOpen}
  columns={pendingUpload?.columns || []}
  onConfirm={handleGroupConfirm}
  onCancel={() => {
    setGroupModalOpen(false)
    setPendingUpload(null)
  }}
/>
```

- [ ] **Step 8: Remove the old upload-only flow for detectAnalysisIntent with uploadedFile**

In the `handleSend` function, the block around line 278-305 that checks `detectAnalysisIntent` with `uploadedFile?.type === 'matrix'` and falls through to `handleNormalChat` — this is the old flow. Since uploaded matrix files now go directly through dual-track via `handleMatrixFileChange`, we can simplify this. Remove the matrix-upload special case:

```typescript
    // 检查是否是差异分析意图
    if (detectAnalysisIntent(input)) {
      // 无上传文件 → 显示分析方式选择卡片
      if (!uploadedFile) {
        const userMsg: ChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'user',
          content: input.trim(),
          timestamp: new Date().toString(),
        }
        updateCurrentSession(msgs => [...msgs, userMsg])
        setInput('')

        // 显示分析方式选择卡片
        updateCurrentSession(msgs => [...msgs, {
          id: `${Date.now()}-analysis-method`,
          role: 'assistant',
          content: '',
          timestamp: new Date().toString(),
          type: 'analysis-method-select',
        }])
        return
      }
      // 有 FASTA 文件但说差异分析 → 走对话
    }
```

- [ ] **Step 9: Commit**

```bash
git add src/pages/ChatPage.tsx src/components/GroupSelectModal.tsx
git commit -m "feat: wire upload flow into dual-track analysis pipeline"
```

---

### Task 6: End-to-End Verification

- [ ] **Step 1: Start backend**

```bash
cd /data/chenghuang11/ABC-Agricultural-Breeding-Claw
PYTHONPATH=backend uvicorn app.main:app --reload --port 8003
```

- [ ] **Step 2: Start frontend**

```bash
npm run dev
```

- [ ] **Step 3: Test flow A — Upload file with auto-detected groups**

1. Open http://localhost:3003
2. Type "差异分析"
3. Click "上传表达矩阵文件"
4. Select a file with WT/CK columns (e.g., `GSE242459_Count_matrix.txt`)
5. Verify: auto-detection message appears → progress bar → DualTrackResultCard

- [ ] **Step 4: Test flow B — Upload file without recognizable groups**

1. Upload a file where columns don't contain WT/CK/Control keywords
2. Verify: GroupSelectModal appears
3. Assign groups manually
4. Verify: progress bar → DualTrackResultCard

- [ ] **Step 5: Test flow C — Built-in dataset (regression check)**

1. Type "差异分析"
2. Click "选择内置数据集"
3. Select a dataset
4. Verify: same dual-track flow as before

- [ ] **Step 6: Test flow D — Manual input (regression check)**

1. Type "差异分析"
2. Click "手动输入表达数据"
3. Verify: text hint appears, normal chat flow, no dual-track

- [ ] **Step 7: Test flow E — Drag-and-drop matrix file**

1. Drag a matrix file into the chat area
2. Verify: same dual-track flow as file picker upload

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: unified upload dual-track analysis with auto group detection"
```
