import { Upload, Button, message, Form, Input, Row, Col } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { datasetApi } from '../api/client';

interface FileUploaderProps {
  onUploadSuccess: () => void;
}

export function FileUploader({ onUploadSuccess }: FileUploaderProps) {
  const [form] = Form.useForm();

  const handleUpload = async (values: any) => {
    const { file, name, description, groupControl, groupTreatment, controlSamples, treatmentSamples } = values;

    if (!file || !file.fileList[0]) {
      message.error('请选择文件');
      return;
    }

    const formData = new FormData();
    formData.append('file', file.fileList[0].originFileObj);
    formData.append('name', name);
    formData.append('description', description || '');
    formData.append('group_control', groupControl || 'control');
    formData.append('group_treatment', groupTreatment || 'treatment');
    formData.append('control_samples', controlSamples);
    formData.append('treatment_samples', treatmentSamples);

    try {
      await datasetApi.upload(formData);
      message.success('上传成功');
      form.resetFields();
      onUploadSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '上传失败');
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleUpload}>
      <Form.Item name="name" label="数据集名称" rules={[{ required: true }]}>
        <Input placeholder="例如: 3月6日表达数据" />
      </Form.Item>

      <Form.Item name="description" label="描述">
        <Input.TextArea rows={2} placeholder="可选描述" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="groupControl" label="对照组名称" initialValue="control">
            <Input />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="groupTreatment" label="处理组名称" initialValue="treatment">
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="controlSamples"
            label="对照组样本(逗号分隔)"
            rules={[{ required: true }]}
            initialValue="sample1,sample2,sample3"
          >
            <Input placeholder="sample1,sample2,sample3" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="treatmentSamples"
            label="处理组样本(逗号分隔)"
            rules={[{ required: true }]}
            initialValue="sample4,sample5,sample6"
          >
            <Input placeholder="sample4,sample5,sample6" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="file" rules={[{ required: true }]} label="表达矩阵文件">
        <Upload.Dragger maxCount={1} accept=".csv,.xlsx,.xls">
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域</p>
          <p className="ant-upload-hint">支持 CSV、Excel 格式</p>
        </Upload.Dragger>
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit">
          上传数据集
        </Button>
      </Form.Item>
    </Form>
  );
}
