import { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Select, Button, Table, Tag, Space, Spin, Empty, Tabs, message, Modal, Input, Form } from 'antd';
import { PlayCircleOutlined, BarChartOutlined, UploadOutlined, DatabaseOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { datasetApi, analysisApi, Dataset, AnalysisResult } from '../api/client';
import { DatasetSelector } from '../components/DatasetSelector';
import { FileUploader } from '../components/FileUploader';
import { ProgressPanel } from '../components/ProgressPanel';
import { ComparisonCard } from '../components/ComparisonCard';
import { FeedbackPanel } from '../components/FeedbackPanel';

export default function AnalysisPage() {
  // Dataset management state
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | undefined>();
  const [datasetsLoading, setDatasetsLoading] = useState(false);

  // Analysis state
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ job_id: string; track?: 'tool' | 'llm'; status: string; progress: number } | null>(null);
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);

  // Modal state
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('dataset');

  // Analysis params
  const [groupControl, setGroupControl] = useState('control');
  const [groupTreatment, setGroupTreatment] = useState('treatment');

  // Load datasets
  const loadDatasets = useCallback(async () => {
    setDatasetsLoading(true);
    try {
      const response = await datasetApi.getAll();
      // API 返回直接数组
      setDatasets(response.data);
    } catch (error) {
      console.error('Failed to load datasets:', error);
    } finally {
      setDatasetsLoading(false);
    }
  }, []);

  // Load analysis results
  const loadAnalysisResults = useCallback(async () => {
    try {
      // Using mock data for now - would call API in production
      setAnalysisResults([]);
    } catch (error) {
      console.error('Failed to load analysis results:', error);
    }
  }, []);

  useEffect(() => {
    loadDatasets();
    loadAnalysisResults();
  }, [loadDatasets, loadAnalysisResults]);

  // Run dual-track analysis
  const handleRunAnalysis = async () => {
    if (!selectedDatasetId) {
      message.warning('请选择数据集');
      return;
    }

    setIsAnalyzing(true);
    setProgress({ job_id: '', status: '正在启动分析...', progress: 0 });
    setSelectedResult(null);

    try {
      // Start analysis
      const response = await analysisApi.compare({
        dataset_id: selectedDatasetId,
        group_control: groupControl,
        group_treatment: groupTreatment,
        pvalue_threshold: 0.05,
        log2fc_threshold: 1,
      });

      const jobId = response.data.data.job_id;

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/analysis/compare/${jobId}/status`);
          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            setIsAnalyzing(false);
            setProgress(null);

            // Get result
            const resultRes = await analysisApi.getResult(jobId);
            const result = resultRes.data.data;
            setSelectedResult(result);
            setAnalysisResults(prev => [result, ...prev]);
            setActiveTab('analysis');
            message.success('分析完成');
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            setIsAnalyzing(false);
            setProgress(null);
            message.error('分析失败');
          } else {
            setProgress({
              job_id: jobId,
              track: statusData.track,
              status: statusData.message || '分析中...',
              progress: statusData.progress || 0,
            });
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 2000);

    } catch (error: any) {
      setIsAnalyzing(false);
      setProgress(null);
      message.error(error.response?.data?.detail || '启动分析失败');
    }
  };

  // Delete dataset
  const handleDeleteDataset = async (id: string) => {
    try {
      await datasetApi.delete(id);
      message.success('删除成功');
      loadDatasets();
      if (selectedDatasetId === id) {
        setSelectedDatasetId(undefined);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // Dataset columns for table
  const datasetColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'data_type',
      key: 'data_type',
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: '基因数',
      dataIndex: 'gene_count',
      key: 'gene_count',
    },
    {
      title: '样本数',
      dataIndex: 'sample_count',
      key: 'sample_count',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Dataset) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteDataset(record.id)}
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* 标题栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <BarChartOutlined style={{ color: 'var(--color-accent)' }} />
            数据分析
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
            双轨分析：工具轨 (scipy) + 大模型轨 (千问)
          </p>
        </div>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => setUploadModalVisible(true)}
        >
          上传数据集
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'dataset',
            label: (
              <span>
                <DatabaseOutlined />
                数据集管理
              </span>
            ),
            children: (
              <Card
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {datasets.length === 0 ? (
                  <Empty
                    description="暂无数据集"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  >
                    <Button type="primary" onClick={() => setUploadModalVisible(true)}>
                      上传数据集
                    </Button>
                  </Empty>
                ) : (
                  <Table
                    dataSource={datasets}
                    columns={datasetColumns}
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                  />
                )}
              </Card>
            ),
          },
          {
            key: 'analysis',
            label: (
              <span>
                <BarChartOutlined />
                双轨分析
              </span>
            ),
            children: (
              <>
                {/* Dataset Selection and Analysis Controls */}
                <Card
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    marginBottom: 16,
                  }}
                >
                  <Row gutter={16} align="middle">
                    <Col span={10}>
                      <div style={{ marginBottom: 8, color: 'var(--color-text-secondary)', fontSize: 12 }}>
                        选择数据集
                      </div>
                      <DatasetSelector
                        datasets={datasets}
                        selectedId={selectedDatasetId}
                        onSelect={setSelectedDatasetId}
                        loading={datasetsLoading}
                      />
                    </Col>
                    <Col span={4}>
                      <div style={{ marginBottom: 8, color: 'var(--color-text-secondary)', fontSize: 12 }}>
                        对照组
                      </div>
                      <Input
                        value={groupControl}
                        onChange={(e) => setGroupControl(e.target.value)}
                        placeholder="对照组名称"
                      />
                    </Col>
                    <Col span={4}>
                      <div style={{ marginBottom: 8, color: 'var(--color-text-secondary)', fontSize: 12 }}>
                        处理组
                      </div>
                      <Input
                        value={groupTreatment}
                        onChange={(e) => setGroupTreatment(e.target.value)}
                        placeholder="处理组名称"
                      />
                    </Col>
                    <Col span={6}>
                      <div style={{ marginBottom: 8 }}>&nbsp;</div>
                      <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={handleRunAnalysis}
                        loading={isAnalyzing}
                        disabled={!selectedDatasetId}
                        style={{
                          background: 'var(--gradient-accent)',
                          border: 'none',
                          height: 40,
                          boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)',
                        }}
                      >
                        开始双轨分析
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {/* Progress Panel */}
                <ProgressPanel progress={progress} isAnalyzing={isAnalyzing} />

                {/* Analysis Results */}
                {selectedResult ? (
                  <ComparisonCard result={selectedResult} />
                ) : !isAnalyzing ? (
                  <Card
                    style={{
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <Empty
                      description="请选择数据集并开始分析"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  </Card>
                ) : null}

                {/* Feedback */}
                {selectedResult && (
                  <Row gutter={16}>
                    <Col span={12}>
                      <FeedbackPanel analysisId={selectedResult.id} track="tool" />
                    </Col>
                    <Col span={12}>
                      <FeedbackPanel analysisId={selectedResult.id} track="llm" />
                    </Col>
                  </Row>
                )}
              </>
            ),
          },
        ]}
      />

      {/* Upload Modal */}
      <Modal
        title="上传数据集"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
        width={600}
      >
        <FileUploader onUploadSuccess={() => {
          loadDatasets();
          setUploadModalVisible(false);
        }} />
      </Modal>
    </div>
  );
}
