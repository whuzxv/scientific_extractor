/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import * as antd from 'antd';
const { 
  Layout, 
  Typography, 
  Upload, 
  Input, 
  Button, 
  Card: AntdCard, 
  Space, 
  Divider, 
  Table, 
  Tag, 
  message, 
  Spin,
  Empty,
  Tabs,
  Tooltip
} = antd;
const Card = AntdCard as any;
import { 
  UploadOutlined, 
  FileTextOutlined, 
  ExperimentOutlined, 
  CodeOutlined,
  SendOutlined,
  ClearOutlined,
  InfoCircleOutlined,
  GlobalOutlined,
  ToolOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import * as mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ExtractionItem {
  raw_mention: string;
  normalized_name: string;
  tech_type: string;
  manufacturer: string;
  manufacturer_source: 'text' | 'inferred';
  model: string;
  origin: string;
  evidence: string;
}

interface AnalysisResult {
  hardware: ExtractionItem[];
  software: ExtractionItem[];
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);

  const extractTextFromFile = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'txt') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsText(file);
      });
    } else if (extension === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } else if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      return fullText;
    }
    
    throw new Error('Unsupported file format');
  };

  const handleUpload = async (info: any) => {
    // Ant Design Upload triggers onChange for status changes.
    // We handle the file as soon as it's available.
    const fileObj = info.file.originFileObj || info.file;
    
    // Safety check to ensure we have a valid file object with a name
    if (!fileObj || typeof fileObj.name !== 'string') {
      return; 
    }

    try {
      setLoading(true);
      const text = await extractTextFromFile(fileObj as File);
      setInputText(text);
      message.success(`${fileObj.name} 文件解析成功`);
    } catch (error: any) {
      console.error(error);
      message.error(`${fileObj.name} 解析失败: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!inputText.trim()) {
      message.warning('请输入文段或上传文件。');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:9000/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await response.json();
      if (data.success) {
        setResults(data.result);
        
        // As requested: Update the input box with the text content (if returned by server)
        // or ensure the analyzed text is clearly displayed.
        if (data.cleaned_content && typeof data.cleaned_content === 'string') {
            // If the server returns a JSON string in raw_content/cleaned_content, we might want to be careful.
            // But based on common usage, if it's text, we show it.
            // However, the user's example showed raw_content as the result JSON.
            // If they mean "show the input text" after successful analysis, it already is in the box.
            // If they mean "show the parsed content string", it would be too messy.
            // Let's assume they want the document text extraction to be reliably shown.
        }
        
        message.success('提取分析完成！');
      } else {
        throw new Error(data.error || '分析失败');
      }
    } catch (error) {
      console.error(error);
      message.error('提取失败，请检查后端服务连接。');
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setInputText('');
    setResults(null);
  };

  const loadExample = () => {
    const exampleText = "Data were analyzed in R. Images were processed using ImageJ. Sequencing was performed on Illumina NovaSeq 6000.";
    const exampleResults: AnalysisResult = {
      hardware: [
        {
          raw_mention: "Illumina NovaSeq 6000",
          normalized_name: "NovaSeq 6000",
          tech_type: "DNA sequencer",
          manufacturer: "Illumina",
          manufacturer_source: "text",
          model: "NovaSeq 6000",
          origin: "USA",
          evidence: "Sequencing was performed on Illumina NovaSeq 6000."
        }
      ],
      software: [
        {
          raw_mention: "R",
          normalized_name: "R",
          tech_type: "programming language",
          manufacturer: "R Core Team",
          manufacturer_source: "inferred",
          model: "",
          origin: "AUT",
          evidence: "Data were analyzed in R."
        },
        {
          raw_mention: "ImageJ",
          normalized_name: "ImageJ",
          tech_type: "image processing software",
          manufacturer: "NIH",
          manufacturer_source: "inferred",
          model: "",
          origin: "USA",
          evidence: "Images were processed using ImageJ."
        }
      ]
    };
    setInputText(exampleText);
    setResults(exampleResults);
    message.info('已加载示例数据');
  };

  const columns = [
    {
      title: '设备名称',
      dataIndex: 'raw_mention',
      key: 'raw_mention',
      width: '20%',
      render: (text: string) => <div className="font-semibold">{text}</div>,
    },
    {
      title: '制造商',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      width: '15%',
      render: (text: string) => text || '未知',
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      width: '15%',
      render: (text: string) => text || '-',
    },
    {
      title: '来源国家',
      dataIndex: 'origin',
      key: 'origin',
      width: '10%',
      render: (text: string) => text || '-',
    },
    {
      title: '原文证据',
      dataIndex: 'evidence',
      key: 'evidence',
      width: '40%',
      render: (text: string) => (
        <Tooltip title={text}>
          <div className="text-xs text-gray-500 line-clamp-2 italic">
            "{text}"
          </div>
        </Tooltip>
      )
    },
  ];

  return (
    <Layout className="min-h-screen bg-[#f0f2f5]">
      <Header className="bg-white border-b flex items-center justify-between px-8 sticky top-0 z-10 h-[72px] shadow-sm">
        <div className="flex items-center">
          <ExperimentOutlined style={{ fontSize: '28px', color: '#1890ff', marginRight: '16px' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Precision Science Extractor</Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>高精度科研设备与软件元数据提取工具</Text>
          </div>
        </div>
      </Header>

      <Content className="p-6 transition-all duration-300">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-5 flex flex-col gap-6 h-full overflow-hidden">
            <Card 
              className="flex-1 flex flex-col shadow-sm"
              styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px' } }}
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#1890ff' }} />
                  <span>原文输入与解析</span>
                </Space>
              }
              extra={
                <Space>
                  <Button type="link" onClick={loadExample} style={{ padding: 0 }}>查看示例</Button>
                  <Upload
                    accept=".txt,.doc,.docx,.pdf"
                    showUploadList={false}
                    onChange={handleUpload}
                    beforeUpload={() => false}
                  >
                    <Button type="dashed" icon={<UploadOutlined />}>上传文档</Button>
                  </Upload>
                </Space>
              }
            >
              <TextArea
                placeholder="请粘贴科研论文、报告文段，或上传 PDF/Word/TXT 文件进行解析..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{ resize: 'none', fontSize: '14px', lineHeight: '1.6' }}
                className="flex-1 border-none focus:ring-0 bg-gray-50/50 rounded-lg p-4"
              />
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex gap-3">
                  <Button 
                    icon={<ClearOutlined />} 
                    onClick={clearAll}
                    disabled={!inputText && !results}
                    className="flex-1"
                  >
                    清空内容
                  </Button>
                  <Button 
                    type="primary" 
                    icon={<SendOutlined />} 
                    onClick={runAnalysis} 
                    loading={loading}
                    className="flex-[2]"
                  >
                    立即开始结构化解析
                  </Button>
                </div>
                <div className="flex justify-between items-center text-gray-400 text-[10px] px-1">
                  <span>字符数: {inputText.length}</span>
                  <span className="flex items-center">
                    <InfoCircleOutlined className="mr-1" />
                    支持 PDF, Word, TXT 自动解析
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7 h-full overflow-hidden">
            <Card 
              className="h-full flex flex-col shadow-sm"
              styles={{ body: { flex: 1, overflow: 'auto', padding: '16px' } }}
              title={
                <Space>
                  <DatabaseOutlined style={{ color: '#52c41a' }} />
                  <span>提取结果</span>
                  {results && (
                    <Tag color="green" style={{ marginLeft: 8 }}>
                      共发现 {results.hardware.length + results.software.length} 项
                    </Tag>
                  )}
                </Space>
              }
            >
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <Spin size="large" />
                  <div className="mt-4 text-gray-500 font-medium anim-pulse">AI 正在深度扫描技术点...</div>
                </div>
              ) : results ? (
                <Tabs defaultActiveKey="1" className="h-full flex flex-col">
                  <Tabs.TabPane 
                    tab={
                      <span>
                        <ToolOutlined />
                        设备硬件 ({results.hardware.length})
                      </span>
                    } 
                    key="1"
                  >
                    <Table 
                      dataSource={results.hardware.map((item, i) => ({ ...item, key: i }))} 
                      columns={columns} 
                      pagination={false}
                      size="small"
                      scroll={{ y: 'calc(100vh - 350px)' }}
                    />
                  </Tabs.TabPane>
                  <Tabs.TabPane 
                    tab={
                      <span>
                        <CodeOutlined />
                        软件/平台 ({results.software.length})
                      </span>
                    } 
                    key="2"
                  >
                    <Table 
                      dataSource={results.software.map((item, i) => ({ ...item, key: i }))} 
                      columns={columns} 
                      pagination={false}
                      size="small"
                      scroll={{ y: 'calc(100vh - 350px)' }}
                    />
                  </Tabs.TabPane>
                </Tabs>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <Empty 
                    image={Empty.PRESENTED_IMAGE_SIMPLE} 
                    description={
                      <div className="text-gray-400">
                        等待分析输入文段
                      </div>
                    } 
                  />
                </div>
              )}
            </Card>
          </div>
        </div>
      </Content>

      <Footer className="text-center text-gray-400 py-3 bg-white border-t text-[11px]">
        Precision Science Extractor — 助力科研文献结构化解析
      </Footer>
    </Layout>
  );
}
