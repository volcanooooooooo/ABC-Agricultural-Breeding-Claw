import React from 'react'
import {
  MessageOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  FileSearchOutlined,
  ArrowRightOutlined
} from '@ant-design/icons'
import iconImg from '../img/icon.png'
import cogLogo from '../img/cog.jpg'
import whutLogo from '../img/武汉理工.webp'
import hznydxLogo from '../img/华中农业大学.jpg'
import jlnndLogo from '../img/吉林农大.jpg'
import ahsnkyLogo from '../img/安徽省农科院.png'
import anndLogo from '../img/安农大.png'

interface FlowStep {
  title: string
  description: string
  icon: React.ReactNode
  color: string
}

const flowSteps: FlowStep[] = [
  { title: '自然语言输入', description: '描述分析需求', icon: <MessageOutlined />, color: '#c9a87c' },
  { title: 'AI Agent 理解', description: '解析意图并规划', icon: <RobotOutlined />, color: '#7cb342' },
  { title: '数据集选择', description: '智能匹配数据集', icon: <DatabaseOutlined />, color: '#ffa726' },
  { title: '双轨分析', description: '统计 + LLM 并行', icon: <ThunderboltOutlined />, color: '#ef5350' },
  { title: '工具执行', description: '差异/富集/BLAST', icon: <ExperimentOutlined />, color: '#42a5f5' },
  { title: '结果可视化', description: '火山图/GO/KEGG', icon: <BarChartOutlined />, color: '#ab47bc' },
  { title: '反馈优化', description: '持续改进质量', icon: <CheckCircleOutlined />, color: '#66bb6a' },
]

export function AnalysisFlowChart() {
  return (
    <div style={{
      padding: '32px 24px 20px',
      maxWidth: 1200,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
    }}>
      {/* 标题区 */}
      <div style={{ textAlign: 'center', marginBottom: 24, flexShrink: 0 }}>
        <img src={iconImg} alt="ABC Logo" width={120} height={120} style={{ borderRadius: '50%', filter: 'drop-shadow(0 0 12px rgba(201,168,124,0.35))' }} />
        <h1 style={{ fontSize: 30, fontWeight: 600, background: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '12px 0 6px' }}>
          Agricultural Breeding Claw 分析流程
        </h1>
        <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', margin: 0 }}>
          从自然语言到科学洞察的智能分析管道
        </p>
      </div>

      {/* 流程步骤 - 横向一行 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {flowSteps.map((step, idx) => (
          <React.Fragment key={step.title}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '14px 12px', borderRadius: 12, background: 'var(--gradient-card)',
              border: '1px solid var(--color-border)', minWidth: 120, maxWidth: 140,
              position: 'relative',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${step.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: step.color }}>
                {step.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'center' }}>{step.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.4 }}>{step.description}</div>
              <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 12, color: step.color, fontWeight: 600 }}>{idx + 1}</div>
            </div>
            {idx < flowSteps.length - 1 && (
              <ArrowRightOutlined style={{ color: 'var(--color-accent)', fontSize: 16, opacity: 0.4, flexShrink: 0 }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* 特色功能 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { icon: <ThunderboltOutlined />, title: '双轨分析', desc: '统计工具与 LLM 并行，结果对比验证', color: '#ef5350' },
          { icon: <FileSearchOutlined />, title: '多工具集成', desc: '差异表达、GO/KEGG 富集、BLAST 比对', color: '#42a5f5' },
          { icon: <RobotOutlined />, title: '智能 Agent', desc: '自然语言理解，自动选择工具和参数', color: '#7cb342' },
        ].map(f => (
          <div key={f.title} className="card-hover" style={{ padding: '16px 18px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <div style={{ fontSize: 28, color: f.color, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* 开始提示 */}
      <div style={{ textAlign: 'center', padding: '18px 28px', background: 'var(--gradient-card)', borderRadius: 14, border: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>开始您的分析之旅</div>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
          在下方输入框中描述分析需求，例如：
          <code style={{ background: 'var(--color-bg-input)', padding: '3px 10px', borderRadius: 4, fontSize: 14, color: 'var(--color-accent)', marginLeft: 4 }}>
            帮我使用基因计数矩阵数据进行差异分析
          </code>
        </div>
      </div>

      {/* 合作单位 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, marginTop: 'auto', paddingTop: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>合作单位</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <img src={cogLogo} alt="认知智能全国重点实验室" height={80} style={{ objectFit: 'contain', borderRadius: 8 }} />
          <img src={whutLogo} alt="三亚研究院" height={75} style={{ objectFit: 'contain', borderRadius: 8 }} />
          <div style={{ height: 80, width: 80, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={hznydxLogo} alt="华中农业大学" height={76} style={{ objectFit: 'contain' }} />
          </div>
          <div style={{ height: 80, width: 80, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={jlnndLogo} alt="吉林农大" height={76} style={{ objectFit: 'contain' }} />
          </div>
          <img src={ahsnkyLogo} alt="安徽省农业科学院" height={80} style={{ objectFit: 'contain', borderRadius: 8 }} />
          <div style={{ height: 80, width: 80, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={anndLogo} alt="安徽农业大学" height={76} style={{ objectFit: 'contain' }} />
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 0, color: 'var(--color-text-muted)', fontSize: 12 }}>
        © 2026 Agricultural Breeding Claw. All rights reserved.
      </div>
    </div>
  )
}
